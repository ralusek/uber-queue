'use strict';

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

const DEFAULT = Object.freeze({
  concurrency: Object.freeze({
    [PHASE.RESOLVE]: 15
  }),

  waitMin: Object.freeze({
    [PHASE.PULL]: 0,
    [PHASE.RESOLVE]: 0,
    [PHASE.PUSH]: 0
  })
});


module.exports = Object.freeze({
  DEFAULT,
  PHASE,
  ERROR
});
