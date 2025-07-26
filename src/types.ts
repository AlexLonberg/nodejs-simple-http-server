import type { Request } from './Request.js'
import type { Response } from './Response.js'

/**
 * Допустимые методы запроса.
 */
type TAllowedMethod = 'GET' | 'POST'

/**
 * Все методы HTTP-запроса.
 */
type THttpMethod = TAllowedMethod | 'HEAD' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH'

/**
 * Объект с переменными пути. Пример: `'foo/{id:int}'` + `'foo/123'` = `{id: {type:'int', value: 123}}`
 */
type TVars = Readonly<Record<string, { readonly type: 'str', readonly value: string } | { readonly type: 'int', readonly value: number }>>

/**
 * Сегменты пути запроса.
 */
type TSegment =
  { readonly type: 'int', readonly value: number, readonly name: string } |
  { readonly type: 'str', readonly value: string, readonly name: string } |
  { readonly type: 'path', readonly value: string, readonly name: null }

/**
 * Сегмент целевого пути маршрута. Часть пути определенная пользователем.
 */
type TTargetSegment =
  { readonly name: string } &
  (
    { readonly type: 'path', readonly values: null } |
    { readonly type: 'str', readonly values: null | string[] } |
    { readonly type: 'int', readonly values: null | (readonly [number, number] | number)[] }
  )

type UMutable<T extends object> = { -readonly [K in keyof T]: T[K] }

/**
 * Пользовательский обработчик запроса.
 */
type TRequestHandler = ((request: Request, response: Response) => (void | Promise<void>))

export type {
  TAllowedMethod,
  THttpMethod,
  TVars,
  TSegment,
  TTargetSegment,
  UMutable,
  TRequestHandler
}
