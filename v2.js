'use strict';


const Emittie = require('emittie');



// This establishes a private namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 *
 */
class UberQueue {
  constructor(config) {
    p(this).createPromise = config.createPromise || ((cb) => (new Promise(cb)));

    p(this).emitter = new Emittie({createPromise: p(this).createPromise});

    p(this).emitter.on(EVENT.PUSH_REQUEST, (value) => {
      
    });

    p(this).queue = [];


    p(this).state = {};

    // Conditionals to determine whether or not the queue should resolve the
    // next available item.
    p(this).conditionals = new Set([
      () => {}
    ]);
  }

  push(value) {
    p(this).queue.push({value});
  }

  pull() {
    const current = p(this).queue.shift();
  }

  on() {
    return p(this).emitter.on.apply(p(this).emitter, arguments);
  }

  once() {
    return p(this).emitter.on.apply(p(this).emitter, arguments);
  }

  off() {
    return p(this).emitter.on.apply(p(this).emitter, arguments);
  }
}
