'use strict';

const UberQueue = require('..');
const db = require('./mock/database');

const PHASE = UberQueue.PHASE;

// Create two UberQueue instances. One is for calls we make to fetch users
// from the database, the other is for calls we make to add users to the databse.
const queue = {
  readFromDB: new UberQueue({concurrency: {[PHASE.RESOLVE]: 2}}),
  writeToDB: new UberQueue({concurrency: {[PHASE.RESOLVE]: 2}})
};


// Here we are add 10 items to the read queue to fetch users from the db, and
// 10 items to the write queue to add users to the db. Note that the call
// to add users to the DB will take 3x as long.
function startExample() {
  for (let i = 0; i < 10; i++) {
    queue.readFromDB.add(() => db.fetchUser(500));
    queue.writeToDB.add(() => db.addUser(1500));
  }
}


// Imagine if these calls were somewhat dependent on each other. In later ex.
// we'll go over how to connect the queues, but for now, let's discuss how to
// make the resolution of one queue dependent on the state of another.
//
// Because the fetchUser call takes 1/3 the time as the addUser call, maybe we
// don't want it to get too far ahead. How about we add a conditional that only
// allows us to fetch more users as long as the writeToDB queue only has < 5
// items in its `inbound` queue? They aren't actually dependent on each other
// here, but you'll see the principle of conditionals in action.

let canRead; // just for logging purposes.

queue.readFromDB.addConditional(PHASE.RESOLVE, () => {
  const writeInbound = queue.writeToDB.getMetadata().metrics.inbound;
  const readCanResolve = writeInbound < 5;
  if (readCanResolve !== canRead) {
    canRead = readCanResolve;
    console.log('Can read:', canRead);
  }
  return readCanResolve;
});

// If these queues are dependent on each other, this will typically not be
// necessary, but because they're entirely unrelated, we're calling `.refresh`
// on the `readFromDB` queue whenever `writeToDB` resolves. `.refresh` will
// include calling all conditionals.
queue.writeToDB.onResult(() => {
  const writeInbound = queue.writeToDB.getMetadata().metrics.inbound;
  console.log('User added. writeToDB inbound queue size:', writeInbound);
  queue.readFromDB.refresh();
});

startExample();

