'use strict';

const Promise = require('bluebird');
const Stream = require('stream');
const utils = require('./utils');

const QueueReader = require('./QueueReader');
const QueueResolvee = require('./QueueResolvee');
const QueueResult = require('./QueueResult');
const QueueEmitter = require('./QueueEmitter');

const CONSTANTS = require('./constants');
const DEFAULT = CONSTANTS.DEFAULT;
const PHASE = CONSTANTS.PHASE;


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

    p(this).metrics = {
      resolving: 0,
      totalQueued: 0,
      successful: 0,
      errored: 0
    };

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


    // Conditionals to see if can resolve.
    // Additional conditionals can be set by the user.
    p(this).conditionals = new Set([
      () => p(this).queue.size,
      () => !p(this).state.paused,
      () => p(this).metrics.resolving < p(this).concurrency
    ]);

    p(this).inactivityTimeout;


    // User References.
    p(this).emitter = new QueueEmitter();

    p(this).streams = new WeakMap();

    this.refresh();
  }

  /**
   *
   */
  getVersion() {
    return utils.getUQVersion();
  }

  /**
   * V3 Complete.
   */
  on(phase, callback) {
    if (!callback) return;
    p(this).emitter.on(phase, callback);

    // Return callback so it is easy to remove with `off`
    return callback;
  }

  /**
   *
   */
  off(phase, callbackOrPromise) {
    p(this).emitter.off(phase, callbackOrPromise);
  }

  /**
   * V3 Complete.
   */
  once(phase) {
    return p(this).emitter.once(phase);
  }

  /**
   * Adds resolvee to inbound.
   */
  resolve(resolvee) {
    const queueResolvee = new QueueResolvee(resolvee);

    p(this).queue.add(queueResolvee);

    p(this).metrics.totalQueued++;

    this.refresh();
  }

  /**
   * Stream is created set to object mode. Everything written to the stream
   * will be treated as a resolvee and passed directly to UberQueue.add.
   */
  toStream() {
    const stream = new Stream.Duplex({
      objectMode: true,
      write: (chunk, encoding, callback) => {
        // Add chunk to queue.
        this.resolve(chunk);
        callback();
      }
    });

    const callback = p(this).on(PHASE.RESOLVE, (err, result) => {
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

    this.off(PHASE.RESOLVE, callback);
  }

  /**
   * Progress any part of the queue which is able to progress. These behaviors
   * do not need to be called in asynchronous series, but can be performed in
   * parallel. Any advancement of the queue which requires any of these actions
   * to complete will be handled in a subsequent `refresh`.
   */
  refresh() {
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
    });
  }

  /**
   *
   */
  addConditional(conditional) {
    p(this).conditionals.add(conditional);
  }

  /**
   *
   */
  removeConditional(conditional) {
    p(this).conditionals.delete(conditional);

    this.refresh();
  }

  /**
   *
   */
  getMetadata() {
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

    // If everything has been resolved and pull conditinals have still not been
    // met, nothing will force a refresh. This allows for a refresh to be forced
    // after a MS minimum of inactivity. Can be integer (ms) or false.
    p(this).inactivityRefreshPeriod = config.inactivityRefreshPeriod || DEFAULT.inactivityRefreshPeriod;

    // TODO: implement
    // TODO: add options for concurrent wait times.
    // `waitMin` is the minium wait time between handling.
    config.waitMin = config.waitMin || {};
    p(this).waitMin = Object.freeze({
      [PHASE.PULL]: config.waitMin[PHASE.PULL] || DEFAULT.waitMin[PHASE.PULL],
      [PHASE.RESOLVE]: config
    });
  }

  /**
   *
   */
  _allConditionals() {
    const values = p(this).conditionals.values();
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
    return this._allConditionals();
  }

  /**
   * V3 complete w/todo
   */
  _resolveNext() {
    if (!this._canResolve()) return;
    
    const resolvee = p(this).queue.values().next().value;

    // Ensure resolvee is capable of resolving. If not, remove it from inbound
    // and refresh.
    if (!resolvee.canResolve()) {
      p(this).queue.delete(resolvee);
      return this.refresh();
    }

    // If resolvee is not multi-use, remove from inbound.
    if (!resolvee.isMultiUse()) p(this).queue.delete(resolvee);

    p(this).metrics.resolving++;
    
    resolvee.resolve(this._shiftPreviousResult())
    .tap(queueResult => {
      // Add to previous results list to pass into subsequent resolvees.
      p(this).previousResults.add(queueResult);

      if (queueResult.error) {
        p(this).emitter.trigger(PHASE.RESOLVE, queueResult);
        p(this).metrics.errored++;
      }
      else {
        p(this).emitter.trigger(PHASE.RESOLVE, null, queueResult);
        p(this).metrics.successful++;
      }
    })
    .finally(() => {
      p(this).metrics.resolving--;
      this.refresh();
    });
  }

  /**
   *
   */
  _shiftPreviousResult() {
    const result = p(this).previousResults.values().next().value;
    p(this).previousResults.delete(result);
    return result;
  }
}

UberQueue.QueueReader = QueueReader;


module.exports = UberQueue;
