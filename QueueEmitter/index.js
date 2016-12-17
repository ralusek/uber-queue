'use strict';

const Promise = require('bluebird');


// This establishes a private namespace.
const emitterNamespace = new WeakMap();
function p(object) {
  if (!emitterNamespace.has(object)) emitterNamespace.set(object, {});
  return emitterNamespace.get(object);
}



/**
 *
 */
class Emitter {
  constructor() {
    p(this).callbacks = {
      on: {},
      once: {}
    };
    p(this).deferred = {
      once: {},
      next: {}
    };
    p(this).nextSequence = {};

    p(this).promises = new WeakMap();
  }

  /**
   *
   */
  on(eventName, callback) {
    this._addCallback(p(this).callbacks.on, eventName, callback);

    // Return callback for easy reference.
    return callback;
  }

  /**
   * Accepts a callback and returns a Promise. Using the Promise response is
   * recommended, although the callback should be used for any results which
   * require synchronous/blocking execution. i.e. if precision/execution order
   * matters, use the callback.
   */
  once(eventName, callback) {
    let deferred;
    const promise = new Promise((resolve, reject) => {
      this._addDeferred(p(this).deferred.once, eventName, {resolve, reject});
    });

    // Map the deferred to the promise, to remove the deferred in case the
    // promise is provided in the 'off' method.
    p(this).promises.set(promise, deferred);

    if (callback) this._addCallback(p(this).callbacks.once, eventName, callback);

    return promise;
  }

  /**
   *
   */
  off(eventName, callbackOrPromise) {
    const deferredOnce = p(this).deferred.once[eventName];
    const deferredNext = p(this).deferred.next[eventName];
    const callbacksOn = p(this).callbacks.on[eventName];
    const callbacksOnce = p(this).callbacks.once[eventName];
    if (callbackOrPromise) {
      callbacksOn && callbacksOn.delete(callback);
      callbacksOnce && callbacksOnce.delete(callback);

      const matchingDeferred = p(this).promises.get(callbackOrPromise);
      if (deferredOnce) deferredOnce.delete(matchingDeferred);
      if (deferredNext) deferredNext.delete(matchingDeferred);
    }
    else {
      deferredOnce && deferredOnce.clear();
      callbacksOn && callbacksOn.clear();
      callbacksOnce && callbacksOnce.clear();
    }
  }

  /**
   *
   */
  next(eventName) {
    let deferred;
    const promise = new Promise((resolve, reject) => {
      this._addDeferred(p(this).deferred.next, eventName, {resolve, reject});
    });

    // Map the deferred to the promise, to remove the deferred in case the
    // promise is provided in the 'off' method.
    p(this).promises.set(promise, deferred);

    return promise;
  }

  /**
   *
   */
  trigger(eventName, error, content) {
    const deferredNext = p(this).deferred.next[eventName];
    const deferredOnce = Array.from(p(this).deferred.once[eventName] || []);
    const callbacksOn = p(this).callbacks.on[eventName];
    const callbacksOnce = Array.from(p(this).callbacks.once[eventName] || []);

    p(this).deferred.once[eventName] && p(this).deferred.once[eventName].clear();
    p(this).callbacks.once[eventName] && p(this).callbacks.once[eventName].clear();

    let next;
    if (deferredNext) {
      next = deferredNext.values().next().value;
      if (next) deferredNext.delete(next);
    }

    if (error) {
      if (next) next.reject(error);
      if (deferredOnce) deferredOnce.forEach(deferred => deferred.reject(error));
      if (callbacksOn) callbacksOn.forEach(callback => callback(error));
      if (callbacksOnce) callbacksOnce.forEach(callback => callback(error));
    }
    else {
      if (next) next.resolve(content);
      if (deferredOnce) deferredOnce.forEach(deferred => {
        deferred.resolve(content)
      });
      if (callbacksOn) callbacksOn.forEach(callback => callback(null, content));
      if (callbacksOnce) callbacksOnce.forEach(callback => callback(null, content));
    }
  }

  /**
   *
   */
  isAwaitingNext(eventName) {
    return !!(p(this).deferred.next[eventName] && p(this).deferred.next[eventName].size);
  }

  /**
   *
   */
  _addCallback(callbacks, eventName, callback) {
    if (!callbacks[eventName]) callbacks[eventName] = new Set();
    callbacks[eventName].add(callback);
  }

  /**
   *
   */
  _addDeferred(deferreds, eventName, deferred) {
    if (!deferreds[eventName]) deferreds[eventName] = new Set();
    deferreds[eventName].add(deferred);
  }
};


/**
 *
 */
module.exports = Emitter;
