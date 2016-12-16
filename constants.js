'use strict';

const MODE = Object.freeze({
  ACTIVE: 'active',
  PASSIVE: 'passive'
});

const ACTION = Object.freeze({
  REFRESH: 'refresh',
  RESOLVE: 'resolve'
});

const EVENT = Object.freeze({
  RESOLVED: 'resolved',
  RESOLVING: 'resolving',
  QUEUED: 'queued'
});

const ERROR = Object.freeze({
  CANT_PULL: ''
});

const DEFAULT = Object.freeze({
  mode: MODE.PASSIVE,

  concurrency: 15,

  inactivityRefreshPeriod: 100,

  STREAM: () => {
    objectMode: true
  }
});


module.exports = Object.freeze({
  MODE,
  DEFAULT,
  ACTION,
  EVENT,
  ERROR
});
