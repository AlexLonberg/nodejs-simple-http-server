import type { TAllowedMethod } from './types.js'
import {
  type TOptions,
  type TRouteOptions,
  type TReadonlyOptions,
  type TReadonlyRouteOptions,
  parseOptions,
  parseRouteOptions
} from './options.js'

const options: TReadonlyOptions = {
  port: 0 as number,
  hostname: 'localhost' as string,
  favicon: false as boolean,
  lower: false as boolean,
  // noCache: false as boolean - Этот параметр переводится в заголовок 'cache-control'
  headers: {} as Record<string, string>,
  failureCode: 404 as number, // Преобразуется к failureCode + failureText
  failureText: 'Not Found',
  next: false as (boolean | string)
} as const

const routeOptions: TReadonlyRouteOptions = {
  method: null as (null | TAllowedMethod),
  headers: {} as Record<string, string>,
  failureCode: 404 as number,
  failureText: 'Not Found',
  name: null as (null | string),
  next: false as (boolean | string)
} as const

function copyOptions (): TReadonlyOptions {
  const opts = { ...options }
  opts.headers = { ...options.headers }
  return opts
}

function copyRouteOptions (): TReadonlyRouteOptions {
  const opts = { ...routeOptions }
  opts.headers = { ...routeOptions.headers }
  return opts
}

test('parseOptions', () => {
  expect(parseOptions()).toStrictEqual(copyOptions())
  expect(parseOptions({ noCache: true })).toStrictEqual({ ...copyOptions(), headers: { 'cache-control': 'no-store, no-cache, max-age=0' } })
  const customOptions: TOptions = { hostname: '127.0.0.1', port: 7860, failureCode: { code: 123, text: 'some' } }
  expect(parseOptions(customOptions)).toStrictEqual({ ...copyOptions(), hostname: '127.0.0.1', port: 7860, failureCode: 123, failureText: 'some' })
})

test('parseRouteOptions', () => {
  expect(parseRouteOptions()).toStrictEqual(copyRouteOptions())
  const customOptions1: TRouteOptions = { noCache: true, next: true }
  const customOptions2: TRouteOptions = { failureCode: { code: 123, text: 'some' }, next: 'foo' }
  expect(parseRouteOptions(customOptions1, customOptions2)).toStrictEqual({ ...copyRouteOptions(), headers: { 'cache-control': 'no-store, no-cache, max-age=0' }, failureCode: 123, failureText: 'some', next: 'foo' })
})
