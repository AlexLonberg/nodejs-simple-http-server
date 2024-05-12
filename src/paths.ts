import type { TSegment, TTargetSegment, TRequestSegment } from './types.js'
import {
  testStartSlash,
  testEndSlash,
  splitSlashes,
  tryParseNonnegativeInt,
  tryParseVars
} from './utils.js'

function testRange (value: number, range: readonly (readonly [number, number] | number)[]): boolean {
  for (const item of range) {
    if (typeof item === 'number') {
      if (value === item) {
        return true
      }
    }
    else {
      if (item[0] <= value && value <= item[1]) {
        return true
      }
    }
  }
  return false
}

function testStr (value: string, values: readonly string[]): boolean {
  for (const item of values) {
    if (value === item) {
      return true
    }
  }
  return false
}

abstract class PathBase {
  protected readonly _path: string
  protected readonly _startSlash: boolean
  protected readonly _endSlash: boolean
  protected readonly _splitted: readonly string[]

  constructor(rawPath: string, decode: boolean, lower: boolean) {
    this._path = rawPath.trim()
    this._startSlash = testStartSlash(this._path)
    this._endSlash = testEndSlash(this._path)
    this._splitted = splitSlashes(this._path).map((v) => {
      if (decode) {
        v = decodeURIComponent(v)
      }
      if (lower) {
        v = v.toLowerCase()
      }
      return v
    })
  }

  get rawPath (): string {
    return this._path
  }
  get startSlash (): boolean {
    return this._startSlash
  }
  get endSlash (): boolean {
    return this._endSlash
  }
  get length (): number {
    return this._splitted.length
  }
}

/**
 * Запрошенный путь.
 */
class RequestPath extends PathBase {
  readonly _internalSegments: readonly TRequestSegment[] = []
  private _relativePath = ''

  constructor(rawPath: string, lower: boolean) {
    super(rawPath, true, lower)
    for (let i = 0; i < this._splitted.length; ++i) {
      const value = this._splitted[i]
      const asNumber = tryParseNonnegativeInt(value)
      // @ts-ignore
      this._internalSegments[i] = { value, asNumber, maybeNumber: asNumber !== null }
    }
  }

  _internalRoutePathLength (length: number): void {
    this._relativePath = this._splitted.slice(length).join('/')
  }

  /**
   * Массив декодированных сегментов пути.
   *
   * Warning: Не изменяйте полученный массив, последний не копируется и передается ссылкой на внутреннее свойство.
   */
  get segments (): readonly string[] {
    return this._splitted
  }

  /**
   * Путь без начальных сегментов маршрута. Это свойство не имеет начального и конечного слешей, даже если они есть в пути.
   *
   * Например: `route:'/static'` + `path:'/static/js/app.js'` => `js/app.js`
   */
  get relativePath (): string {
    return this._relativePath
  }
}

/**
 * Целевой путь.
 */
class TargetPath extends PathBase {
  protected readonly _segments: readonly TTargetSegment[] = []

  constructor(rawPath: string, lower: boolean) {
    super(rawPath, false, false)
    for (const item of this._splitted) {
      const s = tryParseVars(item) ?? { name: (lower ? item.toLowerCase() : item), type: 'path', values: null }
      if (s.type === 'str' && s.values && lower) {
        for (let i = 0; i < s.values.length; ++i) {
          s.values[i] = s.values[i].toLowerCase()
        }
      }
      // @ts-ignore
      this._segments.push(s)
    }
  }

  startWith (path: RequestPath): null | (readonly TSegment[]) {
    if (this.length > path.length || (this.length === path.length && this.endSlash && !path.endSlash)) {
      return null
    }

    const result: TSegment[] = []

    for (let i = 0; i < this._segments.length; ++i) {
      const self = this._segments[i]
      const other = path._internalSegments[i]
      if (self.type === 'int') {
        if (!other.maybeNumber || (self.values && !testRange(other.asNumber, self.values))) {
          return null
        }
        result[i] = { type: 'int', value: other.asNumber, name: self.name }
      }
      else if (self.type === 'str') {
        if (self.values && !testStr(other.value, self.values)) {
          return null
        }
        result[i] = { type: 'str', value: other.value, name: self.name }
      }
      else {
        if (self.name !== other.value) {
          return null
        }
        result[i] = { type: 'path', value: other.value, name: null }
      }
    }

    return result
  }
}

export {
  RequestPath,
  TargetPath
}
