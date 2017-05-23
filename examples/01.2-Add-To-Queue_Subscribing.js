'use strict';

const UberQueue = require('..');
const db = require('./mock/database');

console.log(UberQueue.MODE.ACTIVE);

const queue1 = new UberQueue();
queue1.x = true;
const queue2 = new UberQueue({mode: UberQueue.MODE.ACTIVE});

queue2.subscribe(queue1);

queue1.resolve(() => db.fetchUser());
queue1.resolve(() => db.fetchUser());
queue1.resolve(() => db.fetchUser());
queue1.resolve(() => db.fetchUser());
queue1.resolve(() => db.fetchUser());
queue1.resolve(() => db.fetchUser());

queue2.next()
.then(() => {
  console.log('SUP');
});

setTimeout(() => {
  console.log('Queue 1 After', queue1.getMetadata());
  console.log('Timeout.', queue2.getMetadata());

  // queue2.next()
  // .then((x) => {
  //   console.log('SUPs', x);
  // });
}, 2500);
