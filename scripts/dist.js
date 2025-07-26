import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readdirSync, unlinkSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const keys = [
  'name',
  'version',
  'description',
  'keywords',
  'engines',
  'author',
  'repository',
  'homepage',
  'license',
  'type',
  'main',
  'types',
  'exports'
]

mkdirSync(dist, { recursive: true })

const files = readdirSync(dist, { encoding: 'utf-8' })
for (const name of files) {
  unlinkSync(join(dist, name))
}

copyFileSync(join(root, 'LICENSE.md'), join(dist, 'LICENSE.md'))
copyFileSync(join(root, 'README.md'), join(dist, 'README.md'))

const packageSrc = JSON.parse(readFileSync(join(root, 'package.json'), { encoding: 'utf-8' }))
const packageDist = {}
for (const [k, v] of Object.entries(packageSrc)) {
  if (keys.includes(k)) {
    packageDist[k] = v
  }
}
packageDist.main = './index.js'
packageDist.types = './index.d.ts'
packageDist.exports['.'] = {
  import: './index.js',
  types: './index.d.ts'
}

writeFileSync(join(dist, 'package.json'), JSON.stringify(packageDist, null, 2), { encoding: 'utf-8' })
