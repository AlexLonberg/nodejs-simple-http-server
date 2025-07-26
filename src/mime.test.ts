import { test, expect } from 'vitest'
import {
  type ExtMime,
  Mime
} from './mime.js'

test('Mime', () => {
  const mime = new Mime()
  expect(mime.typeOf('.js')).toBe('text')
  expect(mime.subtypeOf('.js')).toBe('javascript')
  expect(mime.parametersOf('.js')).toBe('charset="utf-8"')
  expect(mime.mimeOf('.js')).toBe('text/javascript; charset="utf-8"')

  const x: ExtMime | null = mime.extMime('.svg')
  expect(x).toBeTruthy()
  expect(x!.toString()).toBe('image/svg+xml; charset="utf-8"')

  expect(mime.mimeOf('.xyz')).toBe(null)
  mime.register('.xyz', 'text', 'x_subtype', 'charset="utf-8"')
  expect(mime.mimeOf('.xyz')).toBe('text/x_subtype; charset="utf-8"')
})
