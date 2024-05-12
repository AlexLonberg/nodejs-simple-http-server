import {
  isObject,
  hasOwn,
  messageFromError,
  testStartSlash,
  testEndSlash,
  forwardSlashes,
  trimSlashes,
  splitSlashes,
  testStartDot,
  removeStartDot,
  tryParseNonnegativeInt,
  tryParseVars,
  mergeRecord,
  mergeHeaders
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

test('testStartSlash', () => {
  expect(testStartSlash('/foo')).toBe(true)
  expect(testStartSlash(' /foo')).toBe(true)
  expect(testStartSlash('foo')).toBe(false)
})

test('testEndSlash', () => {
  expect(testEndSlash('foo/')).toBe(true)
  expect(testEndSlash('foo/ ')).toBe(true)
  expect(testEndSlash('foo')).toBe(false)
})

test('forwardSlashes', () => {
  expect(forwardSlashes('/foo\\\\bar\\\\')).toBe('/foo//bar//')
})

test('trimSlashes', () => {
  expect(trimSlashes('/foo\\bar\\ ')).toBe('foo\\bar')
})

test('splitSlashes', () => {
  expect(splitSlashes('/ foo bar \\box ')).toStrictEqual(['foo bar', 'box'])
})

test('testStartDot', () => {
  expect(testStartDot('.ext')).toBe(true)
  expect(testStartDot(' .ext')).toBe(false)
  expect(testStartDot('ext')).toBe(false)
})

test('removeStartDot', () => {
  expect(removeStartDot('.ext')).toBe('ext')
  expect(removeStartDot('ext')).toBe('ext')
})

test('tryParseNonnegativeInt', () => {
  expect(tryParseNonnegativeInt('00123')).toBe(123)
  expect(tryParseNonnegativeInt('-1')).toBe(null)
})

test('tryParseVars', () => {
  expect(tryParseVars('x')).toBe(null)
  expect(tryParseVars('{some:str}')).toStrictEqual({ name: 'some', type: 'str', values: null })
  expect(tryParseVars('{operation:str:add}')).toStrictEqual({ name: 'operation', type: 'str', values: ['add'] })
  expect(tryParseVars('{value:int:[0-100,1000]}')).toStrictEqual({ name: 'value', type: 'int', values: [[0, 100], 1000] })
})

test('mergeRecord', () => {
  expect(mergeRecord({}, { foo: 1, bar: undefined, box: null }, [], [])).toStrictEqual({ foo: 1 })
  expect(mergeRecord({ box: 2 }, { foo: 1, bar: undefined, box: null }, [], ['box'])).toStrictEqual({ foo: 1, box: null })
})

test('mergeHeaders', () => {
  expect(mergeHeaders({ foo: 'a' }, { bar: 'b' }, { FOO: 'c', BOX: 'd' })).toStrictEqual({ foo: 'c', bar: 'b', box: 'd' })
})
