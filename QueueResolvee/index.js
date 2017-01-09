'use strict';

const Promise = require('bluebird');
const QueueEmitter = require('../QueueEmitter');
const QueueResult = require('../QueueResult');
const utils = require('./utils');

const CONSTANTS = require('./constants');
const EVENT = CONSTANTS.EVENT;
const ERROR = CONSTANTS.ERROR;
const RESOLVEE_TYPE = CONSTANTS.RESOLVEE_TYPE;

const resolve = Object.freeze({
  // Resolve Resolvee which is a Function.
  [RESOLVEE_TYPE.FUNCTION]: (queueResolvee, previous) => {
    return Promise.resolve(p(queueResolvee).resolvee(previous));
  },
  // Resolve Resolvee which is a QueueResult.
  [RESOLVEE_TYPE.QUEUE_RESULT]: (queueResolvee, previous) => {
    return p(queueResolvee).resolvee.resolve();
  },
  // Resolve Resolvee which is an undetermined type.
  [RESOLVEE_TYPE.WILD]: (queueResolvee, previous) => {
    return Promise.resolve(p(queueResolvee).resolvee);
  }
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
      type: this._determineResolveeType(resolvee)
    };

    p(this).emitter = new QueueEmitter();

    p(this).resolvee = resolvee;

    p(this).result;
  }


  /**
   * Is responsibility of caller to call `canResolve` prior to using.
   */
  resolve(previous) {
    if (p(this).metadata.startedAt) return this._returnResult();
    p(this).metadata.startedAt = Date.now();

    p(this).emitter.trigger(EVENT.RESOLVING);

    const createResult = (result) => {
      const resolvedAt = Date.now();
      p(this).resolvedAt = resolvedAt;

      result = new QueueResult(Object.assign({
        timeResolving: resolvedAt - p(this).metadata.startedAt,
        timeInQueue: resolvedAt - p(this).metadata.createdAt
      }, result));

      return result;
    }

    return resolve[p(this).metadata.type](this, previous)
    .then(result => {
      result = createResult({value: result});
      p(this).emitter.trigger(EVENT.RESOLVED, null, result);
      p(this).result = result;
      return this._returnResult();
    })
    .catch(err => {
      err = createResult({error: err});
      p(this).emitter.trigger(EVENT.RESOLVED, err);
      p(this).result = err;
      return this._returnResult();
    });
  }

  once(event, callback) {
    return p(this).emitter.once(event || EVENT.RESOLVED, callback);
  }

  /**
   *
   */
  _returnResult() {
    if (!p(this).result) return this.once();
    if (p(this).result.error) return Promise.reject(p(this).result);
    return Promise.resolve(p(this).result);
  }

  /**
   *
   */
  _determineResolveeType(resolvee) {
    if (!resolvee) throw new Error(ERROR.NOT_VALID_TYPE(resolvee));
    if (utils.isFunction(resolvee)) return RESOLVEE_TYPE.FUNCTION;
    if (resolvee.IS_QUEUE_RESULT) return RESOLVEE_TYPE.QUEUE_RESULT;

    return RESOLVEE_TYPE.WILD;
  }
}

module.exports = QueueResolvee;
