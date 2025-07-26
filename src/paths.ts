import type { TSegment, TTargetSegment } from './types.js'
import {
  testStartSlash_,
  testEndSlash_,
  splitSlashes_,
  tryParseNonnegativeInt_,
  tryParseVars_
} from './utils.js'

/**
 * Сегмент пути запроса. Часть пути запроса.
 */
type _TRequestSegment =
  { readonly value: string } &
  (
    { readonly maybeNumber: false, readonly asNumber: null } |
    { readonly maybeNumber: true, readonly asNumber: number }
  )

function _testRange (value: number, range: readonly (readonly [number, number] | number)[]): boolean {
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

abstract class PathBase {
  protected readonly _path: string
  protected readonly _startSlash: boolean
  protected readonly _endSlash: boolean
  protected readonly _splitted: readonly string[]

  /**
   * @param rawPath Строка пути
   * @param decode  Если это запрос, то декодируем
   * @param lower   Нужно ли привести сегменты пути к `toLowerCase()`.
   */
  constructor(rawPath: string, decode: boolean, lower: boolean) {
    this._path = rawPath.trim()
    this._startSlash = testStartSlash_(this._path)
    this._endSlash = testEndSlash_(this._path)
    this._splitted = splitSlashes_(this._path).map((v) => {
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
 * Путь запроса.
 */
class RequestPath extends PathBase {
  readonly _internalSegments: readonly _TRequestSegment[] = []
  private _relativePath = ''

  constructor(rawPath: string, lower: boolean) {
    super(rawPath, true, lower)
    // Сразу определим могут ли здесь быть переменные для uint
    for (let i = 0; i < this._splitted.length; ++i) {
      const value = this._splitted[i]!
      const asNumber = tryParseNonnegativeInt_(value)
      // @ts-expect-error
      this._internalSegments[i] = { value, asNumber, maybeNumber: asNumber !== null }
    }
  }

  /**
   * Внутренний метод используемый маршрутизатором, для отделения относительного пути совпадающего маршрута.
   * Смотри свойство {@link relativePath}.
   *
   * @param length Количество сегментов маршрута.
   */
  _internalRoutePathLength (length: number): void {
    this._relativePath = this._splitted.slice(length).join('/')
  }

  /**
   * Массив сегментов пути.
   *
   * Warning: Не изменяйте полученный массив, последний не копируется и передается ссылкой на внутреннее свойство.
   */
  get segments (): readonly string[] {
    return this._splitted
  }

  /**
   * Путь без начальных сегментов маршрута. Это свойство не имеет начального и конечного слешей, даже если они есть в пути.
   *
   * Пример: `route:'/static'` + `path:'/static/js/app.js'` => `js/app.js`
   */
  get relativePath (): string {
    return this._relativePath
  }
}

/**
 * Целевой путь маршрута.
 */
class TargetPath extends PathBase {
  protected readonly _segments: readonly TTargetSegment[] = []

  constructor(rawPath: string, lower: boolean) {
    super(rawPath, false, false)
    // Получаем сегменты и возможные варианты переменных в путях
    for (const item of this._splitted) {
      const s = tryParseVars_(item) ?? { name: (lower ? item.toLowerCase() : item), type: 'path', values: null }
      if (s.type === 'str' && s.values && lower) {
        for (let i = 0; i < s.values.length; ++i) {
          s.values[i] = s.values[i]!.toLowerCase()
        }
      }
      // @ts-expect-error
      this._segments.push(s)
    }
  }

  /**
   * Тестирует путь запроса на соответствие маршруту и, в случае успеха, возвращает сегменты пути запроса.
   *
   * @param path
   */
  startWith (path: RequestPath): null | (readonly TSegment[]) {
    if (this.length > path.length || (this.length === path.length && this.endSlash && !path.endSlash)) {
      return null
    }

    const result: TSegment[] = []

    for (let i = 0; i < this._segments.length; ++i) {
      const self = this._segments[i]!
      const other = path._internalSegments[i]!
      // Если у маршрута установлен int и сегмент похож на число
      if (self.type === 'int') {
        if (!other.maybeNumber || (self.values && !_testRange(other.asNumber, self.values))) {
          return null
        }
        result[i] = { type: 'int', value: other.asNumber, name: self.name }
      }
      // ... Если у маршрута установлена строка и она подходит
      else if (self.type === 'str') {
        if (self.values && !self.values.includes(other.value)) {
          return null
        }
        result[i] = { type: 'str', value: other.value, name: self.name }
      }
      // ... иначе это просто путь который должен подойти
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
