'use strict';

const PHASE = Object.freeze({
  RESOLVE: 'resolve'
});

const ERROR = Object.freeze({
  CANT_PULL: ''
});

const DEFAULT = Object.freeze({
  concurrency: 15,

  inactivityRefreshPeriod: 100,

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
