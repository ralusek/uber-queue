'use strict';

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
    p(this).callbacks = {};
    p(this).deferred = {};

    p(this).promises = new WeakMap();
  }

  /**
   *
   */
  on(eventName, callback) {
    if (!p(this).callbacks[eventName]) {
      p(this).callbacks[eventName] = new Set();
    }
    p(this).callbacks[eventName].add(callback);

    // Return callback for easy reference.
    return callback;
  }

  /**
   *
   */
  once(eventName) {
    let deferred;
    const promise = new Promise((resolve, reject) => {
      if (!p(this).deferred[eventName]) {
        p(this).deferred[eventName] = new Set();
      }
      
      deferred = {resolve, reject};

      p(this).deferred[eventName].add(deferred);
    });

    // Map the deferred to the promise, to remove the deferred in case the
    // promise is provided in the 'off' method.
    p(this).promises.set(promise, deferred);

    return promise;
  }

  /**
   *
   */
  off(eventName, callbackOrPromise) {
    const deferred = p(this).deferred[eventName];
    const callbacks = p(this).callbacks[eventName];
    if (callbackOrPromise) {
      callbacks && callbacks.delete(callback);
      if (deferred) {
        const matchingDeferred = p(this).promises.get(callbackOrPromise);
        if (matchingDeferred) deferred.delete(matched);
      }
    }
    else {
      deferred && deferred.clear();
      callbacks && callbacks.clear();
    }
  }

  /**
   *
   */
  trigger(eventName, error, content) {
    const deferred = p(this).deferred[eventName];
    const callbacks = p(this).callbacks[eventName];

    if (error) {
      if (deferred) deferred.forEach(deferred => deferred.reject(error));
      if (callbacks) callbacks.forEach(callbacks => callbacks(error));
    }
    else {
      if (deferred) deferred.forEach(deferred => deferred.resolve(content));
      if (callbacks) callbacks.forEach(callbacks => callbacks(null, content));
    }

    deferred && deferred.clear();
  }
};


/**
 *
 */
module.exports = Emitter;
