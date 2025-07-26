import { fileURLToPath } from 'node:url'
import { test, expect } from 'vitest'
import {
  sliceTextFile
} from './fs.js'

const text = `
1 foo
2 bar
3 box
`

test('sliceTextFile', async () => {
  const buff = await sliceTextFile(fileURLToPath(import.meta.url), 8, 10, '\n')
  expect(buff.toString('utf-8')).toBe(text.trim())
})
