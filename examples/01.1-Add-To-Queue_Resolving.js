'use strict';

const UberQueue = require('..');
const db = require('./mock/database');

const queue = new UberQueue();

// `resolve` is the primary mechanism for entering resolvees into the queue.

// The primary purpose of the queue is resolving resolvees which are functions,
// the code within will be executed when the queue is allowed to do so. It is
// also possible, however, to pass any arbitrary value into the queue.
queue.resolve(() => db.fetchUser());

// In the above example, we are passing a single argument to the `resolve`. Note
// that we are NOT passing `db.fetchUser()` directly, and are therefore not
// calling it. What we are passing is a function which will be executed when
// the queue is able to. Any arbitrary code can be placed within the handler,
// but the response will be resolved as a promise using Promise.resolve().


queue.resolve('hello');
// You can of course pass an arbitrary value, like this string, and the queue
// can be used to store the value and retrieve the values when desired. This
// may seem pointless, but considering that any logic can be performed in
// conditionals, and the input and output can interface with stream piping,
// there are cases where this can actually be quite useful. Other cases where
// storing arbitrary values can be useful are addressed in the documentation
// regarding Subscribing.

