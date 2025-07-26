import { test, expect } from 'vitest'
import {
  RequestPath,
  TargetPath
} from './paths.js'

test('RequestPath', () => {
  const path = new RequestPath('/static/js/app.js', true)
  path._internalRoutePathLength(1)
  expect(path.relativePath).toBe('js/app.js')
})

test('TargetPath', () => {
  const route = new TargetPath('/path/{id:int}', true)

  expect(route.startWith(new RequestPath('/path/to', true))).toBeFalsy()
  expect(route.startWith(new RequestPath('/path', true))).toBeFalsy()
  expect(route.startWith(new RequestPath('/path/-123', true))).toBeFalsy()

  expect(route.startWith(new RequestPath('/path/0123/to', true))).toBeTruthy()

  const path = new RequestPath('/path/0123', true)
  expect(path.startSlash).toBe(true)
  expect(path.endSlash).toBe(false)
  expect(route.startWith(path)).toStrictEqual([
    { type: 'path', value: 'path', name: null },
    { type: 'int', value: 123, name: 'id' }
  ])
})
