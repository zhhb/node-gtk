/*
 * __common__.js
 */

const chalk = require('chalk')
const isEqual = require('lodash.isequal')
const deasync = require('deasync')

module.exports = {
  assert,
  expect,
  isntUndefined,
  describe,
  it,
  mustThrow,
  skip,
}

let calledIt
let currentTest
let currentSubtest

function assert(condition, message) {
  if (condition)
    return condition;

  _failed(message)

  process.exit(1)
}

function isntUndefined(value, message) {
  if (value !== undefined)
    return value;

  _failed(message)

  process.exit(1)
}

function expect(value, expected) {
  assert(isEqual(value, expected),
    `Expected: "${expected}", got: "${value}"`)
  return value
}

function describe(message, fn) {
  currentTest = message
  calledIt = false

  const isAsync = fn.toString().startsWith('async')

  if (isAsync) {
    let done = false

    fn()
    .then(() => { done = true })
    .catch(e => {
      _failed()
      console.error(e)
      process.exit(1)
    })
    deasync.loopWhile(function(){ return !done })
  }
  else {
    try {
      fn()
    } catch(e) {
      _failed()
      console.error(e)
      process.exit(1)
    }
  }

  if (!calledIt)
    _success()

  currentTest = undefined
}

function it(message, fn) {
  currentSubtest = message
  calledIt = true
  try {
    fn()
  } catch(e) {
    _failed()
    console.error(e)
    process.exit(1)
  }
  _success()
  currentSubtest = undefined
}

function mustThrow(message, fn) {
  return function() {
    let didThrow = false
    try {
      fn()
    } catch(e) {
      const isExpectedMessage = typeof message === 'string' ?
        e.message === message :
        message.test(e.message)

      if (!isExpectedMessage) {
        _failed(`Expected message to be "${message}", got "${e.message}"`)
        process.exit(1)
      }
      didThrow = true
    }
    if (!didThrow) {
      _failed(`Expected to throw "${message}"`)
      process.exit(1)
    }
  }
}

function skip() {
  process.exit(222)
}


// Helpers

function _getDescription() {
  let result = ''

  if (currentTest)
    result += currentTest

  if (currentSubtest)
    result += ' ' + currentSubtest

  return result
}

function _log(...args) {
  let description = _getDescription()
  if (description)
    console.log(`${description}` + (args.length > 0 ? ':' : ''), ...args)
  else
    console.log(...args)
}

function _error(...args) {
  let description = _getDescription()
  if (description)
    console.error(`${description}` + (args.length > 0 ? ':' : ''), ...args)
  else
    console.error(...args)
}

function _failed(...args) {
  let description = _getDescription()
  if (description)
    console.error(`${chalk.red.bold('Failed:')} ${chalk.bold(description)}`
      + (args.length > 0 ? ':' : ''), ...args)
  else
    console.error(chalk.red.bold('Failed:'), ...args)

  const line = new Error().stack.split('\n').slice(1).find(l => !l.includes('__common__'))
  console.log(line)

}

function _success(...args) {
  let description = _getDescription()
  if (description)
    console.log(`${chalk.green.bold('Success:')} ${chalk.bold(description)}`
     + (args.length > 0 ? ':' : ''), ...args)
  else
    console.log(chalk.green.bold('Success:'), ...args)
}

