import { test, expect } from 'vitest'
import {
  isObject,
  hasOwn,
  messageFromError,
  testStartSlash_,
  testEndSlash_,
  forwardSlashes_,
  trimSlashes_,
  splitSlashes_,
  testStartDot_,
  removeStartDot_,
  tryParseNonnegativeInt_,
  tryParseVars_
} from './utils.js'

test('isObject', () => {
  expect(isObject({})).toBe(true)
})

test('hasOwn', () => {
  expect(hasOwn({ foo: 1 }, 'foo')).toBe(true)
  expect(hasOwn({}, 'foo')).toBe(false)
})

test('messageFromError', () => {
  expect(messageFromError(new Error('qwerty'))).toBe('qwerty')
})

test('testStartSlash_', () => {
  expect(testStartSlash_('/foo')).toBe(true)
  expect(testStartSlash_(' /foo')).toBe(true)
  expect(testStartSlash_('foo')).toBe(false)
})

test('testEndSlash_', () => {
  expect(testEndSlash_('foo/')).toBe(true)
  expect(testEndSlash_('foo/ ')).toBe(true)
  expect(testEndSlash_('foo')).toBe(false)
})

test('forwardSlashes_', () => {
  expect(forwardSlashes_('/foo\\\\bar\\\\')).toBe('/foo//bar//')
})

test('trimSlashes_', () => {
  expect(trimSlashes_('/foo\\bar\\ ')).toBe('foo\\bar')
})

test('splitSlashes_', () => {
  expect(splitSlashes_('/ foo bar \\box ')).toStrictEqual(['foo bar', 'box'])
})

test('testStartDot_', () => {
  expect(testStartDot_('.ext')).toBe(true)
  expect(testStartDot_(' .ext')).toBe(false)
  expect(testStartDot_('ext')).toBe(false)
})

test('removeStartDot_', () => {
  expect(removeStartDot_('.ext')).toBe('ext')
  expect(removeStartDot_('ext')).toBe('ext')
})

test('tryParseNonnegativeInt_', () => {
  expect(tryParseNonnegativeInt_('00123')).toBe(123)
  expect(tryParseNonnegativeInt_('-1')).toBe(null)
})

test('tryParseVars_', () => {
  expect(tryParseVars_('x')).toBe(null)
  expect(tryParseVars_('{some:str}')).toStrictEqual({ name: 'some', type: 'str', values: null })
  expect(tryParseVars_('{operation:str:add}')).toStrictEqual({ name: 'operation', type: 'str', values: ['add'] })
  expect(tryParseVars_('{value:int:[0-100,1000]}')).toStrictEqual({ name: 'value', type: 'int', values: [[0, 100], 1000] })
})
