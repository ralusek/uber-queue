'use strict';

const Promise = require('bluebird');

const DEFAULT = Object.freeze({
  TIME: 1000
});

let uniqueCounter = 0;


/**
 * Fetch a 'user' from a 'database'.
 * If your name happens to be 'First N', where 'N' is an integer between 0 and
 * Infinity, please not that given enough time and resources, part of your personal
 * information may be disclosed.
 */
module.exports.fetchUser = (time) => {
  const counter = uniqueCounter++;
  time = time == null ? DEFAULT.TIME : time;

  return new Promise(resolve => {
    setTimeout(() => resolve({
      firstName: `First ${counter}`,
      lastName: `Last ${counter}`,
      email: `email@${counter}.com`
    }), time);
  });
};


/**
 * Just fetches a new user. This database isn't very good.
 */
module.exports.addUser = (time) => {
  return module.exports.fetchUser(time);
};
