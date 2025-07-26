
import { STATUS_CODES } from 'node:http'
import type { TAllowedMethod, UMutable } from './types.js'
import { hasOwn, isObject } from './utils.js'

// DOC https://ru.wikipedia.org/wiki/Список_кодов_состояния_HTTP
function getOrDefaultStatusText_ (code: number, text?: undefined | null | string): string {
  return STATUS_CODES[code] ?? text ?? 'Unknown'
}

/**
 * Записывает/перезаписывает свойства объекта `target` свойствами `other`.
 * Значения `undefined` и/или ключи `skip` игнорируются. Значения `null` игнорируются, если ключи явно не перечислены в массиве `keyNull`.
 *
 * @returns Возвращает аргумент `target`.
 */
function _mergeRecord<T extends Record<string, any>, X extends Record<string, any>> (target: T, other: X, skip: readonly (keyof X)[], keyNull: readonly (keyof X)[]): T & X {
  for (const [key, value] of Object.entries(other)) {
    if (skip.includes(key) || (typeof value === 'undefined') || (value === null && !keyNull.includes(key))) {
      continue
    }
    // @ts-expect-error
    target[key] = other[key]
  }
  return target as (T & X)
}

/**
 * Записывает/перезаписывает свойства объекта `target` свойствами `rawHeaders`, приводя все ключи к `toLowerCase()`.
 *
 * @returns Возвращает аргумент `target`.
 */
function _mergeHeaders (target: Record<string, string>, ...rawHeaders: Record<string, string>[]): Record<string, string> {
  for (const item of rawHeaders) {
    for (const [key, value] of Object.entries(item)) {
      target[key.toLowerCase()] = value
    }
  }
  return target
}

const _DEFAULT_FAILURE_CODE = 404

/**
 * Глобальные опции.
 */
const options = {
  /**
   * Номер порта или `null`.
   */
  port: 0 as number,
  /**
   * Имя хоста, например `127.0.0.1` или `localhost`(по умолчанию).
   */
  hostname: 'localhost' as string,
  /**
   * Использовать иконку по умолчанию на запрос `/favicon.ico`, которую так любит браузер.
   */
  favicon: false as boolean,
  /**
   * Явно приводить все пути к `toLowerCase()`.
   * Без этой опции пути сравниваются как есть `'/Path/To' !== 'path/to'`.
   * Эта опция не влияет на параметры запроса `?Foo=bAR`.
   */
  lower: false as boolean,
  /**
   * Установить для всех ответов заголовок `{'cache-control': 'no-store, no-cache, max-age=0'}`.
   * Этот параметр для краткости и лишь добавляет заголовок в параметр ниже `headers`. Значение `false` не удалит
   * заголовок из `headers` если он определен явно.
   */
  noCache: false as boolean,
  /**
   * Заголовки по умолчанию для всех ответов. Обработчики статических маршрутов могут переопределить заголовок
   * `content-type`. Для каждого маршрута так же есть параметр `headers`, которым можно переопределить глобальные
   * заголовки. Все заголовки явно приводятся к `toLowerCase()`.
   */
  headers: {} as Record<string, string>,
  /**
   * Код или объект `{code: number, text: string}` для завершения запроса в случае ошибки обработчика или явного вызова
   * завершения запроса с ошибкой. Ответ с ошибкой по умолчанию не может быть отправлен, если сервер уже отправил
   * заголовки. По умолчанию для всех ошибок установлен `{code: 404, text: 'Not Found'}`. Этот параметр можно
   * переопределить для каждого отдельного маршрута.
   */
  failureCode: _DEFAULT_FAILURE_CODE as (number | { code: number, text: string }),
  /**
   * Следует ли передать запрос обработчику следующего подходящего маршрута, если текущий не вызвал один из методов
   * ответа и не инициировал ошибку. Эта опция так же доступна в параметре маршрута. По умолчанию `false` - в случае
   * отсутствия ответа запрос завершится ошибкой с соответствующим кодом.
   */
  next: false as (boolean | string)
} as const
/**
 * Глобальные опции.
 */
type TOptions = { -readonly [K in keyof (typeof options)]?: undefined | null | (typeof options)[K] }
type TReadonlyOptions = Omit<typeof options, 'noCache' | 'failureCode'> & { readonly failureCode: number, readonly failureText: string }

/**
 * Опции обработки маршрутов. Эти опции переопределяют глобальные `TOptions`.
 */
const routeOptions = {
  /**
   * Допустимый метод запроса. `null` позволяет любые запросы.
   */
  method: null as (null | TAllowedMethod),
  /**
   * Установить для ответов заголовок `{'cache-control': 'no-store, no-cache, max-age=0'}`.
   * Смотри описание в {@link TOptions.noCache}.
   */
  noCache: false as boolean,
  /**
   * Дополнительные или переопределяющие заголовки маршрута.
   */
  headers: {} as Record<string, string>,
  /**
   * Смотри описание к {@link TOptions.failureCode}.
   */
  failureCode: _DEFAULT_FAILURE_CODE as (number | { code: number, text: string }),
  /**
   * Необязательное уникальное имя маршрута. Повторяющиеся имена вызовут ошибку при попытке запустить сервер.
   * Это имя может применяться совместно с параметром `next`.
   */
  name: null as (null | string),
  /**
   * Этот параметр переопределяет глобальный {@link TOptions.next} и позволяет указать конкретное имя маршрута
   * установленное параметром `name`. Значение `true` передаст обработку следующему маршруту. Явно установленно имя,
   * передает обработку соответствующему обработчику. `false` запрещает передачу обработки и завершает запрос ошибкой.
   */
  next: false as (boolean | string)
} as const
/**
 * Опции обработки маршрутов. Эти опции переопределяют глобальные `TOptions`.
 */
type TRouteOptions = { -readonly [K in keyof (typeof routeOptions)]?: undefined | null | (typeof routeOptions)[K] }
type TReadonlyRouteOptions = Omit<typeof routeOptions, 'noCache' | 'failureCode'> & { readonly failureCode: number, readonly failureText: string }

const _ignoreKeys = ['noCache', 'headers', 'failureCode'] as const
const _resettableKeys = ['method', 'name'] as const

function _normalizeFailureCode (code?: undefined | null | number | { code: number, text: string }): { failureCode: number, failureText: string } {
  if (isObject(code)) {
    return { failureCode: code.code, failureText: code.text }
  }
  if (Number.isSafeInteger(code) && (code!) > 0) {
    return { failureCode: code!, failureText: getOrDefaultStatusText_(code!) }
  }
  return { failureCode: _DEFAULT_FAILURE_CODE, failureText: getOrDefaultStatusText_(_DEFAULT_FAILURE_CODE) }
}

function parseOptions_ (opts?: undefined | null | number | Readonly<TOptions>): TReadonlyOptions {
  if (!opts) {
    opts = {}
  }
  else if (isObject(opts)) {
    opts = { ...opts }
  }
  else {
    opts = (Number.isSafeInteger(opts) && (opts as number) > 0) ? { port: opts as number } : {}
  }
  // Заголовки копируем
  const headers = _mergeHeaders({}, options.headers, opts.headers ?? {})
  if (!hasOwn(headers, 'cache-control') && ((hasOwn(opts, 'noCache') && opts.noCache) || options.noCache)) {
    headers['cache-control'] = 'no-store, no-cache, max-age=0'
  }
  // Нормализуем и копируем failureCode
  const failureCode = _normalizeFailureCode(hasOwn(opts, 'failureCode') ? opts.failureCode : options.failureCode)
  return _mergeRecord({ ..._mergeRecord({}, options, _ignoreKeys, []), ...failureCode, headers }, opts, _ignoreKeys, [])
}

function parseRouteOptions_ (...opts: readonly Readonly<TRouteOptions>[]): TReadonlyRouteOptions {
  let noCache = routeOptions.noCache
  const headers = _mergeHeaders({}, routeOptions.headers)
  let failureCode = _normalizeFailureCode(routeOptions.failureCode)
  const op: UMutable<TReadonlyRouteOptions> = _mergeRecord({} as ReturnType<typeof _normalizeFailureCode>, routeOptions, _ignoreKeys, _resettableKeys)
  for (const item of opts) {
    if (hasOwn(item, 'noCache') && typeof item.noCache === 'boolean') {
      noCache = item.noCache
    }
    if (hasOwn(item, 'headers') && isObject(item.headers)) {
      _mergeHeaders(headers, item.headers)
    }
    if (hasOwn(item, 'failureCode') && typeof item.failureCode !== 'undefined' && item.failureCode !== null) {
      failureCode = _normalizeFailureCode(item.failureCode)
    }
    _mergeRecord(op, item, _ignoreKeys, _resettableKeys)
  }
  if (!hasOwn(headers, 'cache-control') && noCache) {
    headers['cache-control'] = 'no-store, no-cache, max-age=0'
  }
  op.headers = headers
  op.failureCode = failureCode.failureCode
  op.failureText = failureCode.failureText
  return op as TReadonlyRouteOptions
}

export {
  getOrDefaultStatusText_,
  type TOptions,
  type TReadonlyOptions,
  type TRouteOptions,
  type TReadonlyRouteOptions,
  parseOptions_,
  parseRouteOptions_
}
