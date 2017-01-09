'use strict';

const Promise = require('bluebird');
const Stream = require('stream');
const utils = require('./utils');

const QueueResolvee = require('./QueueResolvee');
const QueueResult = require('./QueueResult');
const QueueEmitter = require('./QueueEmitter');

const CONSTANTS = require('./constants');
const MODE = CONSTANTS.MODE;
const DEFAULT = CONSTANTS.DEFAULT;
const ACTION = CONSTANTS.ACTION;
const EVENT = CONSTANTS.EVENT;


// This establishes a private namespace.
const queueNamespace = new WeakMap();
function p(object) {
  if (!queueNamespace.has(object)) queueNamespace.set(object, {});
  return queueNamespace.get(object);
}


/**
 *
 */
class UberQueue {
  constructor(config) {
    this._configure(config);

    p(this).createdAt = Date.now();

    p(this).metrics = CONSTANTS.METRIC_BOILERPLATE();

    p(this).state = {
      completed: false,
      paused: false
    };

    // Use sets for more performant shift operation. At higher item counts,
    // `array.shift()` becomes very slow for arrays,
    // `set.delete(set.values().next().value)` will outperform.
    // Additionally, concurrent queues mean that things will not necessarily be
    // dequeued from the beginning, for which Set provides O(1) delete.
    p(this).queue = new Set(); // Queue will consist only of QueueResolvees.

    // Previous results to feed into resolvees if available. There will be up to
    // `concurrency.resolving` amount of times a resolvee will be called without
    // a previous result being passed in, but they will otherwise be passed in
    // the order they arrive.
    p(this).previousResults = new Set();


    // Conditionals to see if various Actions can be performed.
    // Additional conditionals can be set by the user.
    p(this).conditionals = Object.freeze({
      [ACTION.REFRESH]: new Set([
        // Ensures that not in Active mode and already awaiting next value.
        () => !((p(this).mode === MODE.ACTIVE) && !p(this).emitter.isAwaitingNext(EVENT.RESOLVED))
      ]),
      [ACTION.RESOLVE]: new Set([
        () => !!p(this).queue.size,
        () => !p(this).state.paused,
        () => p(this).metrics.resolving < p(this).concurrency
      ])
    });

    p(this).inactivityTimeout;


    // User References.
    p(this).emitter = new QueueEmitter();

    p(this).streams = new WeakMap();

    // Previous promise returned from `next`.
    p(this).lastNext = null;

    // Is set when the queue is empty and the resolver is waiting for an entry.
    p(this).deferredEmptyQueueChecker = null;

    this.refresh();
  }


  /**
   * Returns the Version of UberQueue from the package.json. Can be used for
   * compatibility checks.
   */
  getVersion() {
    return utils.getUQVersion();
  }


  /**
   * Subscribe to the output of another UberQueue.
   */
  subscribe(queue) {
    if (!queue || !queue.getVersion()) throw new Error('UberQueue.subscribe expects an instance of UberQueue.');
    queue.on(EVENT.RESOLVED, (error, result) => this.resolve(error || result));
  }


  /**
   * Adds item to queue. Item will be resolved according to QueueResolvee's
   * handling of the type provided.
   * 
   * Functions will be called as a promise resolution, and be passed the previous
   * queue result if available.
   *
   * QueueResults will be resolved or rejected depending on their error status.
   *
   * Anything else is considered wild and resolved as a promise using
   * `Promise.resolve()`.
   */
  resolve(resolvee, returnResolvee) {
    const queueResolvee = new QueueResolvee(resolvee);

    p(this).queue.add(queueResolvee);

    p(this).metrics.totalQueued++;
    p(this).emitter.trigger(EVENT.QUEUED, null, resolvee);

    // Use callback because synchronosity/blocking required.
    queueResolvee.once(EVENT.RESOLVING, (err, content) => {
      p(this).queue.delete(queueResolvee);
      p(this).metrics.resolving++;
    });

    // Use callback because synchronosity/blocking required.
    queueResolvee.once(EVENT.RESOLVED, (err, content) => {
      const queueResult = err || content;
      // Add to previous results list to pass into subsequent resolvees.
      p(this).previousResults.add(queueResult);

      if (err) p(this).emitter.trigger(EVENT.RESOLVED, queueResult);
      else p(this).emitter.trigger(EVENT.RESOLVED, null, queueResult);
      p(this).metrics.resolving--;

      this._calculateMetricsFromResult(queueResult);

      this.refresh();
    });

    this.refresh();

    return returnResolvee === true ? queueResolvee :
        queueResolvee.once(EVENT.RESOLVED);
  }


  /**
   * This will retrieve the next available value, where each subsequent call
   * to `next` will retrieve subsequent values. For example, 2 calls to `next`
   * immediately after one another will have the next available result passed
   * to the first promise, with the next available result after that passed to
   * the second.
   *
   * ACTIVE MODE NOTE:
   * If the UberQueue is in Active Mode, usage of `next` is the ONLY way to
   * make the queue resolve its items. Resolution of items will only happen so
   * long as there is a backlog of calls to `next` which are awaiting their
   * resolved queue item.
   */
  next(event) {
    const promise = p(this).emitter.next(event || EVENT.RESOLVED);

    this.refresh();

    return promise
    .finally(() => this.refresh());
  }


  /**
   * Will have the callback called with the next event triggered's event response.
   * Most common case is with event EVENT.RESOLVED, for getting the next resolved
   * items in the queue.
   */
  on(event, callback) {
    if (!callback) return;
    p(this).emitter.on(event, callback);

    // Return callback so it is easy to remove with `off`
    return callback;
  }


  /**
   * Same as `on`, but removes the listener after it is called once.
   * Returns a promise in addition to accepting a callback.
   */
  once(event, callback) {
    return p(this).emitter.once(event, callback);
  }


  /**
   * Removes a callback or promise generated by `next`, `on` or `once`.
   */
  off(event, callbackOrPromise) {
    p(this).emitter.off(event, callbackOrPromise);
  }

  

  /**
   *
   */
  toStream(streamConfig) {
    streamConfig = streamConfig || {};

    const stream = new Stream.Duplex(
      Object.assign(
        DEFAULT.STREAM(),
        streamConfig,
        {
          write: (chunk, encoding, callback) => {
            // Add chunk to queue.
            this.resolve(chunk);
            callback();
          }
        }
      )
    );

    const callback = p(this).on(EVENT.RESOLVED, (err, result) => {
      if (err) return; // TODO handle this error properly.
      stream.push(result);
    });

    p(this).streams.set(stream, callback);

    return stream;
  }

  /**
   *
   */
  removeStream(stream) {
    const callback = p(this).streams.get(stream);
    p(this).streams.delete(stream);
    stream.end(); // TODO make sure this is right.

    this.off(EVENT.RESOLVED, callback);
  }

  /**
   * Progress any part of the queue which is able to progress. These behaviors
   * do not need to be called in asynchronous series, but can be performed in
   * parallel. Any advancement of the queue which requires any of these actions
   * to complete will be handled in a subsequent `refresh`.
   */
  refresh() {
    if (!this._canRefresh()) return;

    setTimeout(() => {
      this._resolveNext();

      // Fire 'on refresh' events.
      p(this).emitter.trigger('refresh');

      // Reset previous inactivity timeout, which will call refresh after a
      // period of inactivity.
      if (p(this).inactivityRefreshPeriod !== false) {
        const currentTimeout = p(this).inactivityTimeout;
        currentTimeout && clearTimeout(currentTimeout);
        p(this).inactivityTimeout = setTimeout(() => {
          this.refresh();
        }, p(this).inactivityRefreshPeriod);
      }
    }, 100);
  }

  _canRefresh() {
    return this._allConditionals(ACTION.REFRESH);
  }

  /**
   *
   */
  addConditional(action, conditional) {
    p(this).conditionals[action].add(conditional);
  }

  /**
   *
   */
  removeConditional(action, conditional) {
    p(this).conditionals[action].delete(conditional);

    this.refresh();
  }

  /**
   *
   */
  getMetadata() {
    // TODO: make entire p(this).metrics returned immutable.
    return {
      completed: p(this).state.completed,
      paused: p(this).state.paused,
      metrics: Object.assign({
        queued: p(this).queue.size
      }, p(this).metrics)
    };
  }

  /**
   *
   */
  pause() {
    p(this).state.paused = true;
  }

  /**
   *
   */
  resume() {
    p(this).state.paused = false;

    this.refresh();
  }

  /**
   *
   */
  setComplete() {
    p(this).state.completed = true;
    p(this).emitter.trigger('completed');
  }

  /**
   *
   */
  _configure(config) {
    config = config || {};

    // `concurrency` is how many items can be handled in parallel.
    p(this).concurrency = config.concurrency || DEFAULT.concurrency;

    p(this).mode = config.mode || DEFAULT.mode;

    // If everything has been resolved and pull conditinals have still not been
    // met, nothing will force a refresh. This allows for a refresh to be forced
    // after a MS minimum of inactivity. Can be integer (ms) or false.
    p(this).inactivityRefreshPeriod = config.inactivityRefreshPeriod || DEFAULT.inactivityRefreshPeriod;
  }

  /**
   *
   */
  _allConditionals(action) {
    const values = p(this).conditionals[action].values();
    let current;
    while (!(current = values.next()).done) {
      if (!current.value(this)) return false;
    }
    return true;
  }

  /**
   *
   */
  _canResolve() {
    return this._allConditionals(ACTION.RESOLVE);
  }

  /**
   * V3 complete w/todo
   */
  _resolveNext() {
    if (!this._canResolve()) {
      // Handle cases where there is nothing queued.
      if (!p(this).queue.size && !p(this).deferredEmptyQueueChecker) {
        p(this).deferredEmptyQueueChecker = p(this).emitter.once(EVENT.QUEUED)
        .finally(() => {
          p(this).deferredEmptyQueueChecker = null;
          this._resolveNext()
        });
      }
      return;
    }
    
    const resolvee = p(this).queue.values().next().value;

    resolvee.resolve(this._shiftPreviousResult());
  }

  /**
   *
   */
  _shiftPreviousResult() {
    const result = p(this).previousResults.values().next().value;
    p(this).previousResults.delete(result);
    return result;
  }

  /**
   *
   */
  _calculateMetricsFromResult(result) {
    const metrics = p(this).metrics;
    const metadata = result.getMetadata();
    const inQueue = metadata.timeInQueue;
    const resolving = metadata.timeResolving;

    const outcome = result.error ? 'error' : 'success';

    // Calculate min.
    if (inQueue < metrics.timeInQueue.min[outcome]) metrics.timeInQueue.min[outcome] = inQueue;
    if (resolving < metrics.timeResolving.min[outcome]) metrics.timeResolving.min[outcome] = resolving;
    // Calculate max.
    if (inQueue > metrics.timeInQueue.max[outcome]) metrics.timeInQueue.max[outcome] = inQueue;
    if (resolving > metrics.timeResolving.max[outcome]) metrics.timeResolving.max[outcome] = resolving;
    // Calculate average.
    metrics.timeInQueue.average[outcome] = ((metrics.timeInQueue.average[outcome] * metrics[outcome]) + inQueue) / (metrics[outcome] + 1); 
    metrics.timeResolving.average[outcome] = ((metrics.timeResolving.average[outcome] * metrics[outcome]) + resolving) / (metrics[outcome] + 1); 

    metrics[outcome]++;

    const now = Date.now();
    const secondsPassed = (now - p(this).createdAt) / 1000;
    metrics.resolvedPerSecond[outcome] = metrics[outcome] / secondsPassed;
  }
}

Object.freeze(Object.assign(UberQueue, {ACTION, MODE, EVENT}));



module.exports = UberQueue;
