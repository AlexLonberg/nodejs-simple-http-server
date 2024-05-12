import type { TAllowedMethod, UMutable } from './types.js'
import { hasOwn, isObject, mergeRecord, mergeHeaders } from './utils.js'
import { statusCodes } from './statusCodes.js'

const defaultFailureCode = 404

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
  failureCode: defaultFailureCode as (number | { code: number, text: string }),
  /**
   * Следует ли передать запрос следующему обработчику, если текущий не вызвал один из методов ответа и не инициировал
   * ошибку. Эта опция так же доступна в параметре маршрута. По умолчанию `false` - в случае отсутствия ответа запрос
   * завершится ошибкой с соответствующим кодом.
   */
  next: false as (boolean | string)
} as const
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
   * Смотри описание в `TOptions`.
   */
  noCache: false as boolean,
  /**
   * Дополнительные или переопределяющие заголовки маршрута.
   */
  headers: {} as Record<string, string>,
  /**
   * Смотри описание к `TOptions`.
   */
  failureCode: defaultFailureCode as (number | { code: number, text: string }),
  /**
   * Необязательное уникальное имя маршрута. Повторяющиеся имена вызовут ошибку при попытке запустить сервер.
   * Это имя может применяться совместно с параметром `next`.
   */
  name: null as (null | string),
  /**
   * Этот параметр переопределяет глобальный `TOptions.next` и позволяет указать конкретное имя маршрута установленное
   * параметром `name`. Значение `true` передаст обработку следующему маршруту. Явно установленно имя, передает
   * обработку соответствующему обработчику. `false` запрещает передачу обработки и завершает запрос ошибкой.
   */
  next: false as (boolean | string)
} as const
type TRouteOptions = { -readonly [K in keyof (typeof routeOptions)]?: undefined | null | (typeof routeOptions)[K] }
type TReadonlyRouteOptions = Omit<typeof routeOptions, 'noCache' | 'failureCode'> & { readonly failureCode: number, readonly failureText: string }

const ignoreKeys = ['noCache', 'headers', 'failureCode'] as const
const resettableKeys = ['method', 'name'] as const

function parseFailureCode (code?: undefined | null | number | { code: number, text: string }): { failureCode: number, failureText: string } {
  if (isObject(code)) {
    return { failureCode: code.code, failureText: code.text }
  }
  if (Number.isSafeInteger(code) && (code!) > 0) {
    return { failureCode: code!, failureText: statusCodes.getOrDefault(code!) }
  }
  return { failureCode: defaultFailureCode, failureText: statusCodes.getOrDefault(defaultFailureCode) }
}

function parseOptions (opts?: undefined | null | number | Readonly<TOptions>): TReadonlyOptions {
  if (!opts) {
    opts = {}
  }
  else if (isObject(opts)) {
    opts = { ...opts }
  }
  else {
    opts = (Number.isSafeInteger(opts) && (opts as number) > 0) ? { port: opts as number } : {}
  }
  const headers = mergeHeaders({}, options.headers, opts.headers ?? {})
  if (!hasOwn(headers, 'cache-control') && ((hasOwn(opts, 'noCache') && opts.noCache) || options.noCache)) {
    headers['cache-control'] = 'no-store, no-cache, max-age=0'
  }
  const failureCode = parseFailureCode(hasOwn(opts, 'failureCode') ? opts.failureCode : options.failureCode)
  return mergeRecord({ ...mergeRecord({}, options, ignoreKeys, []), ...failureCode, headers }, opts, ignoreKeys, [])
}

function parseRouteOptions (...opts: readonly Readonly<TRouteOptions>[]): TReadonlyRouteOptions {
  let noCache = routeOptions.noCache
  const headers = mergeHeaders({}, routeOptions.headers)
  let failureCode = parseFailureCode(routeOptions.failureCode)
  const op: UMutable<TReadonlyRouteOptions> = mergeRecord({} as ReturnType<typeof parseFailureCode>, routeOptions, ignoreKeys, resettableKeys)
  for (const item of opts) {
    if (hasOwn(item, 'noCache') && typeof item.noCache === 'boolean') {
      noCache = item.noCache
    }
    if (hasOwn(item, 'headers') && isObject(item.headers)) {
      mergeHeaders(headers, item.headers)
    }
    if (hasOwn(item, 'failureCode') && typeof item.failureCode !== 'undefined' && item.failureCode !== null) {
      failureCode = parseFailureCode(item.failureCode)
    }
    mergeRecord(op, item, ignoreKeys, resettableKeys)
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
  type TOptions,
  type TReadonlyOptions,
  type TRouteOptions,
  type TReadonlyRouteOptions,
  parseOptions,
  parseRouteOptions
}
