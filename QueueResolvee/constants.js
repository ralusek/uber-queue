'use strict';

const ERROR = Object.freeze({
  NOT_VALID_TYPE: (val) => `Not a valid resolvee type: ${val}`,
  NOT_MULTI_USE: 'Cannot resolve a non-multi-use resolvee multiple times.'
});

const EVENT = Object.freeze({
  RESOLVED: 'resolved',
  RESOLVING: 'resolving'
});

const RESOLVEE_TYPE = Object.freeze({
  FUNCTION: 'function',
  QUEUE_RESULT: 'queue-result',
  WILD: '*'
});

module.exports = Object.freeze({
  ERROR,
  EVENT,
  RESOLVEE_TYPE
});
