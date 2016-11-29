'use strict';

const Promise = require('bluebird');
const Stream = require('stream');
const utils = require('./utils');

const QueueReader = require('./QueueReader');
const QueueResolvee = require('./QueueResolvee');
const QueueResult = require('./QueueResult');

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
    config = config || {};

    p(this).concurrency = config.concurrency || DEFAULT.concurrency;

    p(this).pullSource;
    // Maintains individual output queues per reader.
    p(this).queueReaders = new Map();

    p(this).metrics = {
      resolving: 0,
      totalQueued: 0
    };

    // Use sets for more performant shift operation. At higher item counts,
    // `array.shift()` becomes very slow for arrays,
    // `set.delete(set.values().next().value)` will outperform.
    // Additionally, concurrent queues mean that things will not necessarily be
    // dequeued from the beginning, for which Set provides O(1) delete.
    p(this).queue = Object.freeze({
      // Inbound queue should only have QueueResolvees in it.
      [PHASE.INBOUND]: new Set(),
      // Outbound queue should only have QueueResults in it.
      [PHASE.OUTBOUND]: new Set()
    });


    // Conditionals to see if can progress inbound, resolving, and outbound.
    // Additional conditionals can be set by the user.
    p(this).conditionals = Object.freeze({
      [PHASE.PULL]: new Set([
        () => !!p(this).pullSource,
        () => !(p(this).paused.all || p(this).paused[PHASE.PULL])
      ]),
      [PHASE.RESOLVE]: new Set([
        () => p(this).queue[PHASE.INBOUND].size,
        () => !(p(this).paused.all || p(this).paused[PHASE.RESOLVE]),
        () => p(this).metrics.resolving < p(this).concurrency
      ]),
      [PHASE.PUSH]: new Set([
        () => p(this).queue[PHASE.OUTBOUND].size,
        () => !(p(this).paused.all || p(this).paused[PHASE.PUSH]),
        () => (
          p(this).callbacks.onResult.size ||
          p(this).deferred.onceResult.size
        )
      ])
    });

    p(this).paused = {
      all: false,
      [PHASE.PULL]: false,
      [PHASE.RESOLVE]: false,
      [PHASE.PUSH]: false
    };

    p(this).state = {
      completed: false
    };


    // User References.
    p(this).callbacks = Object.freeze({
      onResult: new Set()
    });

    p(this).deferred = Object.freeze({
      onceResult: new Set()
    })

    p(this).streams = new WeakMap();
  }

  /**
   *
   */
  getVersion() {
    return utils.getUQVersion();
  }

  /**
   * V3 Complete.
   * Accepts function or queue.
   */
  setPullSource(source) {
    p(this).pullSource = source;

    this.refresh();
  }

  /**
   *
   */
  newQueueReader() {
    const reader = new QueueReader(this);
    p(this).queueReaders.set(reader, new Set());
    return reader;
  }

  /**
   *
   */
  nextInReaderQueue(reader) {
    return new Promise((resolve, reject) => {
      const queue = p(this).queueReaders.get(reader);
      const next = queue.values().next();
      if (next.done) {
        return this.onceResult()
        .finally(() => resolve(this.nextInReaderQueue(reader)));
      }

      queue.delete(next.value);
      next.value.error ? reject(next.value) : resolve(next.value);
    });
  }

  /**
   * V3 Complete.
   */
  removeQueueReader(reader) {
    p(this).queueReaders.delete(reader);
  }

  /**
   * V3 Complete.
   */
  onResult(callback) {
    if (!callback) return;
    p(this).callbacks.onResult.add(callback);

    this.refresh();

    // Return callback so it is easy to remove with `offResult`
    return callback;
  }

  /**
   *
   */
  offResult(callback) {
    if (!callback) return;
    p(this).callbacks.onResult.delete(callback);
  }

  /**
   * V3 Complete.
   */
  onceResult() {
    return new Promise((resolve, reject) => {
      p(this).deferred.onceResult.add({resolve, reject});
    });

    this.refresh();
  }

  /**
   * Adds resolvee to inbound.
   */
  add(resolvee) {
    const queueResolvee = new QueueResolvee(resolvee);

    p(this).queue[PHASE.INBOUND].add(queueResolvee);

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
        this.add(chunk)
        callback();
      }
    });

    const callback = p(this).onResult((err, result) => {
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

    this.offResult(callback);
  }

  /**
   * Progress any part of the queue which is able to progress. These behaviors
   * do not need to be called in asynchronous series, but can be performed in
   * parallel. Any advancement of the queue which requires any of these actions
   * to complete will be handled in a subsequent `refresh`.
   */
  refresh() {
    setTimeout(() => {
      this._pullNext();
      this._resolveNext();
      this._pushNext();
    });
  }

  /**
   *
   */
  addConditional(phase, conditional) {
    p(this).conditionals[phase].add(conditional);
  }

  /**
   *
   */
  getMetadata() {
    return {
      metrics: Object.assign({
        inbound: p(this).queue[PHASE.INBOUND].size,
        outbound: p(this).queue[PHASE.OUTBOUND].size
      }, p(this).metrics)
    };
  }

  /**
   *
   */
  pause(phase) {
    if (!phase) p(this).paused.all = true;
    if (p(this).paused[phase]) p(this).paused[phase] = true;
  }

   /**
   *
   */
  resume(phase) {
    if (!phase) p(this).paused.all = false;
    if (p(this).paused[phase]) p(this).paused[phase] = false;
  }

  /**
   *
   */
  setComplete() {
    p(this).state.complete = true;
  }

  /**
   *
   */
  isComplete() {
    return p(this).state.complete;
  }

  /**
   *
   */
  _allConditionals(conditionals) {
    const values = conditionals.values();
    let current;
    while (!(current = values.next()).done) {
      if (!current.value(this)) return false;
    }
    return true;
  }

  /**
   *
   */
  _canPull() {
    return this._allConditionals(p(this).conditionals[PHASE.PULL]);
  }

  /**
   *
   */
  _canResolve() {
    return this._allConditionals(p(this).conditionals[PHASE.RESOLVE]);
  }

  /**
   *
   */
  _canPush() {
    return this._allConditionals(p(this).conditionals[PHASE.PUSH])
  }

  /**
   *
   */
  _pullNext() {
    if (!this._canPull()) return;

    this.add(p(this).pullSource);

    // Refresh happens in `add`.
  }


  /**
   * V3 complete w/todo
   */
  _resolveNext() {
    if (!this._canResolve()) return;

    const inboundQueue = p(this).queue[PHASE.INBOUND];
    
    const resolvee = inboundQueue.values().next().value;

    // Ensure resolvee is capable of resolving. If not, remove it from inbound
    // and refresh.
    if (!resolvee.canResolve()) {
      inboundQueue.delete(resolvee);
      return this.refresh();
    }

    // If resolvee is not multi-use, remove from inbound.
    if (!resolvee.isMultiUse()) inboundQueue.delete(resolvee);

    p(this).metrics.resolving++;
    
    resolvee.resolve()
    .tap(queueResult => {
      // Add to primary outbound queue.
      p(this).queue[PHASE.OUTBOUND].add(queueResult);
      // Add to individual reader outbound queues.
      p(this).queueReaders.forEach((queue) => {
        queue.add(queueResult);
      });
    })
    .finally(() => {
      p(this).metrics.resolving--;
      this.refresh();
    });
    
    this.refresh();
  }


  /**
   * Pushes the result from the queue to any listeners.
   */
  _pushNext() {
    if (!this._canPush()) return;

    const queue = p(this).queue[PHASE.OUTBOUND];

    const result = queue.values().next().value;
    queue.delete(result);

    // Resolve callbacks and deferred.
    if (result.error) {
      p(this).callbacks.onResult.forEach(callback => callback(result));
      p(this).deferred.onceResult.forEach(deferred => deferred.reject(result));
    }
    else {
      p(this).callbacks.onResult.forEach(callback => callback(null, result));
      p(this).deferred.onceResult.forEach(deferred => deferred.resolve(result));
    }
    p(this).deferred.onceResult.clear();

    this.refresh();
  }
}
