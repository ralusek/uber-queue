'use strict';

const Promise = require('bluebird');

const DEFAULT = Object.freeze({
  TIME: 1000
});

let uniqueCounter = 0;


/**
 * Fetch a 'user' from a 'database'.
 */
module.exports.fetchUser = (time) => {
  const counter = uniqueCounter++;
  time = time == null ? DEFAULT.TIME : time;

  return new Promise(resolve => {
    setTimeout(() => resolve({
      firstName: `First ${counter}`,
      lastName: `Last ${counter}`,
      email: `email@${counter}.com`
    }), (time * Math.random));
  });
};


/**
 * Just fetches a new user. This database isn't very good.
 */
module.exports.addUser = (time) => {
  return module.exports.fetchUser(time);
};
