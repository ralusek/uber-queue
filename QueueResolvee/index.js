'use strict';

const Promise = require('bluebird');
const QueueResult = require('../QueueResult');
const utils = require('./utils');

const CONSTANTS = require('./constants');
const ERROR = CONSTANTS.ERROR;
const RESOLVEE_TYPE = CONSTANTS.RESOLVEE_TYPE;

const canResolve = Object.freeze({
  [RESOLVEE_TYPE.FUNCTION]: (queueResolvee) => Promise.resolve(),
  // [RESOLVEE_TYPE.QUEUE]: (resolvee) => (new Promise((resolve, reject) => {
  //   if (resolvee.isComplete()) return reject(ERROR.QUEUE_COMPLETE);
  //   resolve(resolvee.onNextOutbound());
  // }))
});

const resolve = Object.freeze({
  [RESOLVEE_TYPE.FUNCTION]: (queueResolvee, previous) => {
    return Promise.resolve(p(queueResolvee).resolvee(previous));
  },
  // [RESOLVEE_TYPE.QUEUE]: (resolvee) => Promise.resolve()
});

const multiUse = Object.freeze({
  [RESOLVEE_TYPE.FUNCTION]: false
});


// This establishes a private namespace.
const resolveeNamespace = new WeakMap();
function p(object) {
  if (!resolveeNamespace.has(object)) resolveeNamespace.set(object, {});
  return resolveeNamespace.get(object);
}



/**
 *
 */
class QueueResolvee {
  constructor(resolvee) {
    p(this).metadata = {
      createdAt: Date.now(),
      type: this._determineResolveeType(resolvee),
      resolved: {
        last: {
          tried: null,
          resolved: null
        }
      }
    };

    p(this).resolvee = resolvee;

    p(this).lastResolvedAt;
  }

  canResolve() {
    return canResolve[p(this).metadata.type](this);
  }

  /**
   * Is responsibility of caller to call `canResolve` prior to using.
   */
  resolve(previous) {
    if (!this.isMultiUse() && p(this).metadata.resolved.last.tried) {
      return Promise.reject(ERROR.NOT_MULTI_USE);
    }
    const startedAt = p(this).metadata.resolved.last.tried = Date.now();

    const createResult = (result) => {
      const lastQueued =
          (this.isMultiUse() && p(this).metadata.resolved.last.resolved) ||
          p(this).metadata.createdAt;
      const resolvedAt = p(this).metadata.resolved.last.resolved = Date.now();
      result = new QueueResult(Object.assign({
        timeResolving: resolvedAt - startedAt,
        timeInQueue: resolvedAt - lastQueued
      }, result));

      return result;
    };

    return resolve[p(this).metadata.type](this, previous)
    .then(result => createResult({value: result}))
    .catch(err => createResult({error: err}));
  }

  isMultiUse() {
    return multiUse[p(this).metadata.type]
  }

  /**
   *
   */
  _determineResolveeType(resolvee) {
    if (!resolvee) throw new Error(ERROR.NOT_VALID_TYPE(resolvee));
    if (utils.isFunction(resolvee)) return RESOLVEE_TYPE.FUNCTION;

    throw new Error(ERROR.NOT_VALID_TYPE(resolvee));
  }
}

module.exports = QueueResolvee;
