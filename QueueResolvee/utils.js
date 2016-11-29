'use strict';

const FUNCTION_TAG = '[object Function]';

const OBJECT_PROTO = Object.prototype;

const objectToString = OBJECT_PROTO.toString;


/**
 *
 */
function isFunction(subject) {
  return !!subject && objectToString.call(subject) === FUNCTION_TAG;
}
module.exports.isFunction = isFunction;
