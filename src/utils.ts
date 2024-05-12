import type { TTargetSegment } from './types.js'

const _hasOwn = ('hasOwn' in Object && typeof Object.hasOwn === 'function')
  ? Object.hasOwn
  : (obj: any, key: string | number | symbol) => Object.prototype.hasOwnProperty.call(obj, key)

const _allSingleSlash = /[\\/]{1}/g
const _startSlash = /^[\\/]/
const _endSlash = /[\\/]$/
const _startAndEndSpacesOrSlashes = /(^[\s\\/]+)|([\s\\/]+$)/g
const _allSpacesOrSlashes = /[\s\\/]*[\\/]+[\s\\/]*/g
const _startDot = /^\./
const _startAndEndBraces = /^\{.+\}$/
const _startOrEndBraces = /(^\{)|(\}$)/g
const _startOrEndSquareBraces = /(^\[)|(\]$)/g
const _allColon = /:/g
const _allComma = /\s*,\s*/g
const _numberAndDash = /^[0-9]+-[0-9]+$/
const _dash = /-/
const _numberInt = /^[0-9]+$/

const re = {
  get allSingleSlash () {
    _allSingleSlash.lastIndex = 0
    return _allSingleSlash
  },
  get startSlash () {
    _startSlash.lastIndex = 0
    return _startSlash
  },
  get endSlash () {
    _endSlash.lastIndex = 0
    return _endSlash
  },
  get startAndEndSpacesOrSlashes () {
    _startAndEndSpacesOrSlashes.lastIndex = 0
    return _startAndEndSpacesOrSlashes
  },
  get allSpacesOrSlashes () {
    _allSpacesOrSlashes.lastIndex = 0
    return _allSpacesOrSlashes
  },
  get startDot () {
    _startDot.lastIndex = 0
    return _startDot
  },
  get startAndEndBraces () {
    _startAndEndBraces.lastIndex = 0
    return _startAndEndBraces
  },
  get startOrEndBraces () {
    _startOrEndBraces.lastIndex = 0
    return _startOrEndBraces
  },
  get startOrEndSquareBraces () {
    _startOrEndSquareBraces.lastIndex = 0
    return _startOrEndSquareBraces
  },
  get allColon () {
    _allColon.lastIndex = 0
    return _allColon
  },
  get allComma () {
    _allComma.lastIndex = 0
    return _allComma
  },
  get numberAndDash () {
    _numberAndDash.lastIndex = 0
    return _numberAndDash
  },
  get dash () {
    _dash.lastIndex = 0
    return _dash
  },
  get numberInt () {
    _numberInt.lastIndex = 0
    return _numberInt
  }
} as const

/**
 * Является ли значение `value` объектом.
 */
function isObject<T> (value: T): value is (object & T) {
  return value !== null && typeof value === 'object'
}

/**
 * Наличие собственного `enumerable` свойства объекта.
 *
 * @param obj Целевой объект.
 * @param key Искомое имя свойства.
 * @returns
 */
function hasOwn<T extends object, K extends string | number | symbol> (obj: T, key: K):
  obj is (T & { [_ in K]: K extends keyof T ? T[K] : never }) {
  return _hasOwn(obj, key)
}

/**
 * Пытается извлечь сообщение `Error.message`.
 * Эта функция не проверяет тип `Error`, а лишь наличие свойства `message:string`, если аргумент `e` является объектом.
 */
function messageFromError (e: any, defaultMsg: undefined | null | string = 'Не удалось извлечь сообщение об ошибке.'): string | null {
  return typeof e === 'string'
    ? e
    : (isObject(e) && ('message' in e) && e.message && (typeof e.message === 'string'))
      ? e.message
      : (defaultMsg ?? null)
}

/**
 * Есть ли у строки ведущий слеш.
 *
 * @example
 * testStartSlash('/foo')
 * // => true
 */
function testStartSlash (str: string): boolean {
  return re.startSlash.test(str.trimStart())
}

/**
 * Есть ли у строки завершающий слеш.
 *
 * @example
 * testEndSlash('foo/')
 * // => true
 */
function testEndSlash (str: string): boolean {
  return re.endSlash.test(str.trimEnd())
}

/**
 * Заменяет все слеши на правые.
 *
 * @example
 * forwardSlashes('/foo\\bar\\')
 * // => '/foo//bar//'
 */
function forwardSlashes (str: string): string {
  return str.replace(re.allSingleSlash, '/')
}

/**
 * Удаляет первый и последний прямой/обратный слеш и пробельные символы
 * Эта функция не заменяет остальные слеши `\` на `/`.
 *
 * @example
 * trimSlashes('/foo\\bar\\ ')
 * // => 'foo\\bar'
 */
function trimSlashes (str: string): string {
  return str.replace(re.startAndEndSpacesOrSlashes, '')
}

/**
 * Разбивает строку по прямым/обратным слешам и пробельным символам одновременно удаляя первый и последний.
 *
 * @example
 * splitSlashes('/ foo bar \\box ')
 * // => ['foo bar', 'box']
 */
function splitSlashes (str: string): string[] {
  const cleaned = trimSlashes(str)
  return cleaned.length === 0 ? [] : cleaned.split(re.allSpacesOrSlashes)
}

/**
 * Есть ли у строки ведущая точка.
 *
 * @example
 * testStartDot('.ext')
 * // => true
 */
function testStartDot (str: string): boolean {
  return re.startDot.test(str)
}

/**
 * Удаление ведущей точки.
 *
 * @example
 * removeStartDot('.ext')
 * // => 'ext'
 */
function removeStartDot (str: string): string {
  return str.replace(re.startDot, '')
}

/**
 * Пытается преобразовать строку в неотрицательный Int.
 *
 * @example
 * tryParseNonnegativeInt('00123')
 * // => 123
 */
function tryParseNonnegativeInt (str: string): null | number {
  return re.numberInt.test(str) ? Number.parseInt(str, 10) : null
}

/**
 * Проверяет, является ли строка пути переменной, и разбирает.
 *
 * @example
 * tryParseVars('{value:int:[0-100,1000]}')
 * // => {name:'value', type:'int', values:[[0,100], 1000]}
 */
function tryParseVars (str: string): null | TTargetSegment {
  if (re.startAndEndBraces.test(str)) {
    str = str.replace(re.startOrEndBraces, '')
    const splitted = str.split(re.allColon).map((v) => v.trim()).filter((v) => v.length > 0)
    if (splitted.length < 2 || splitted.length > 3 || (splitted[1] !== 'str' && splitted[1] !== 'int')) {
      return null
    }
    let values = splitted.length === 3
      ? splitted[2].replace(re.startOrEndSquareBraces, '').split(re.allComma).map((v) => v.trim()).filter((v) => v.length > 0)
      : null
    if (values && splitted[1] === 'int') {
      values = values.map((v) => re.numberAndDash.test(v) ? v.split(re.dash, 2).map((x) => Number.parseInt(x)) : Number.parseInt(v)) as any
    }
    return { name: splitted[0], type: splitted[1] as any, values }
  }
  return null
}

/**
 * Записывает/перезаписывает свойства объекта `target` свойствами `other`.
 * Значения `undefined` и/или ключи `skip` игнорируются. Значения `null` игнорируются, если ключи явно не перечислены в массиве `keyNull`.
 *
 * @returns Возвращает аргумент `target`.
 */
function mergeRecord<T extends Record<string, any>, X extends Record<string, any>> (target: T, other: X, skip: readonly (keyof X)[], keyNull: readonly (keyof X)[]): T & X {
  for (const [key, value] of Object.entries(other)) {
    if (skip.includes(key) || (typeof value === 'undefined') || (value === null && !keyNull.includes(key))) {
      continue
    }
    // @ts-ignore
    target[key] = other[key]
  }
  return target as any
}

/**
 * Записывает/перезаписывает свойства объекта `target` свойствами `rawHeaders`, приводя все ключи к `toLowerCase()`.
 *
 * @returns Возвращает аргумент `target`.
 */
function mergeHeaders (target: Record<string, string>, ...rawHeaders: Record<string, string>[]): Record<string, string> {
  for (const item of rawHeaders) {
    for (const [key, value] of Object.entries(item)) {
      target[key.toLowerCase()] = value
    }
  }
  return target
}

/**
 * Асинхронная пауза на основе `setTimeout`.
 *
 * @param ms
 * @returns
 */
function asyncPause (ms = 0): Promise<void> {
  return new Promise((s) => setTimeout(s, ms))
}

export {
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
  mergeHeaders,
  asyncPause
}
