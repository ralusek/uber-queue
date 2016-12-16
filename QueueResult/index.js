'use strict';

// This establishes a private namespace.
const resultNamespace = new WeakMap();
function p(object) {
  if (!resultNamespace.has(object)) resultNamespace.set(object, {});
  return resultNamespace.get(object);
}



/**
 *
 */
class QueueResult {
  constructor(config) {
    config = config || {};
    if (config.error) {
      if (config.error.IS_QUEUE_RESULT) return config.error;
      p(this).error = config.error;
    }
    else if (config.value) {
      if (config.value.IS_QUEUE_RESULT) return config.value;
      p(this).value = config.value;
    }

    p(this).timeResolving = config.timeResolving;
    p(this).timeInQueue = config.timeInQueue;

    Object.defineProperties(this, {
      'value': {
        get: function() { return p(this).value; }
      },
      'error': {
        get: function() { return p(this).error; }
      },
      'IS_QUEUE_RESULT': {
        get: function() { return true; }
      }
    });
  }
}

module.exports = QueueResult;
