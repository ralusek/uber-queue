'use strict';

const UberQueue = require('..');
const db = require('./mock/database');

// The strings of the UberQueue Phases are available as a constant PHASE on the
// UberQueue class.
const PHASE = UberQueue.PHASE;


// Here we'll create an instance of UberQueue and configure it to resolve up to
// 2 items concurrently.
const queue = new UberQueue({
  concurrency: {
    [PHASE.RESOLVE]: 2
  }
});


// Here we have a simple loop where we will be fetching a user from the mock
// database 10 times. We will pass 10 functions which call the database into
// the queue, but they will only be resolved as our Queue config specifies.
for (let i = 0; i < 10; i++) {
  (() => {

    // The `.add` method allows you to pass in a function that will be resolved
    // as soon as the queue is allowed to. In this example, that means that
    // the items will be resolved so long as the `concurrency` restriction we
    // specified allows for it.
    const queued = queue.add(() => db.fetchUser());

    // An important thing to note about `add` is that it returns a promise that
    // will be resolved as soon as that particular queue item is resolved. Here
    // we have set the response from `queue.add` to `queued`, which is the
    // promise from that particular item being added.
    //
    // By performing subsequent logic on this queue result by using the promise
    // returned by `add`, as opposed to putting the logic directly on the
    // `fetchUser` call within the `add`, we allow the queue to move on.
    queued
    .then((result) => {
      console.log('Result:', result.value);

      const metrics = JSON.stringify(queue.getMetadata().metrics, null, 2);
      console.log('Queue metrics:', metrics);
    });
  })();
}

