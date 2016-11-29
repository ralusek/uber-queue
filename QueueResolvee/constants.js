'use strict';

const ERROR = Object.freeze({
  NOT_VALID_TYPE: (val) => `Not a valid resolvee type: ${val}`,
  NOT_MULTI_USE: 'Cannot resolve a non-multi-use resolvee multiple times.'
});

const RESOLVEE_TYPE = Object.freeze({
  FUNCTION: 'function',
  // QUEUE: 'queue'
});

module.exports = Object.freeze({
  ERROR,
  RESOLVEE_TYPE
});
