'use strict';

const DEFAULT = Object.freeze({
  concurrency: 15
});

const PHASE = Object.freeze({
  PULL: 'pull',
  INBOUND: 'inbound',
  RESOLVE: 'resolve',
  OUTBOUND: 'outbound',
  PUSH: 'push'
});

const ERROR = Object.freeze({
  CANT_PULL: ''
});


module.exports = Object.freeze({
  DEFAULT,
  PHASE,
  ERROR
});
