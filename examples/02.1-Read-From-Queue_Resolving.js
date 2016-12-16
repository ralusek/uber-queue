'use strict';

const UberQueue = require('..');
const db = require('./mock/database');

const queue = new UberQueue();

queue.resolve(() => db.fetchUser())
.then((user) => {
  console.log('User', user);
});