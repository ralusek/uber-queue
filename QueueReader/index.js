'use strict';

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
  constructor(queue) {
    p(this).queue = queue;
  }

  next() {
    return p(this).queue.nextInReaderQueue(this);
  }
}

module.exports = QueueReader;
