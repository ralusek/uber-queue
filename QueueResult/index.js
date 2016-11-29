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
    if (config.value) p(this).value = config.value;
    else if (config.error)  p(this).error = config.error;

    p(this).timeResolving = config.timeResolving;
    p(this).timeInQueue = config.timeInQueue;

    Object.defineProperties(this, {
      'value': {
        get: function() { return p(this).value; }
      },
      'error': {
        get: function() { return p(this).error; }
      }
    });
  }
}

module.exports = QueueResult;
