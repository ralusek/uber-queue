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

const METRIC_BOILERPLATE = () => ({
  resolving: 0,
  totalQueued: 0,
  success: 0,
  error: 0,
  timeInQueue: {
    average: {
      success: 0,
      error: 0
    },
    max: {
      success: 0,
      error: 0
    },
    min: {
      success: Infinity,
      error: Infinity
    }
  },
  timeResolving: {
    average: {
      success: 0,
      error: 0
    },
    max: {
      success: 0,
      error: 0
    },
    min: {
      success: Infinity,
      error: Infinity
    }
  },
  resolvedPerSecond: {
    success: 0,
    error: 0
  }
});


module.exports = Object.freeze({
  MODE,
  DEFAULT,
  ACTION,
  EVENT,
  ERROR,
  METRIC_BOILERPLATE
});
