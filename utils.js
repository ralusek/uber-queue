'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');

// Stores values that shouldn't be recalculated once bootstrapped.
const bootstrapped = {};


function getUQVersion() {
  return new Promise((resolve) => {
    if (bootstrapped.UQVersion) return resolve(bootstrapped.UQVersion);
    fs.readFile(path.resolve(__dirname, 'package.json'), 'UTF-8', (err, data) => {
      resolve(bootstrapped.UQVersion = JSON.parse(data).version);
    });
  });   
}
module.exports.getUQVersion = getUQVersion;
