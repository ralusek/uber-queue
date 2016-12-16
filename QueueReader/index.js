'use strict';

const QueueEmitter = require('../QueueEmitter');

// This establishes a private namespace.
const readerNamespace = new WeakMap();
function p(object) {
  if (!readerNamespace.has(object)) readerNamespace.set(object, {});
  return readerNamespace.get(object);
}



/**
 *
 */
class QueueReader {
  constructor(uberQueue) {
    p(this).uberQueue = uberQueue;
    p(this).queue = new Set();

    p(this).emitter = new QueueEmitter();

    p(this).uberQueue.on('resolve', (error, content) => {
      p(this).queue.add(error || content);
      p(this).emitter.trigger('value', null, (error || content));
    });
  }

  next() {
    return new Promise((resolve, reject) => {
      const queuedValue = p(this).queue.values().next().value;
      let getValue;
      if (queuedValue) getValue = Promise.resolve(queuedValue);
      else getValue = p(this).emitter.once('value');

      getValue
      .then(value => {
        p(this).queue.delete(value);
        value.error ? reject(value) : resolve(value);
      });
    });
      
  }
}

module.exports = QueueReader;
