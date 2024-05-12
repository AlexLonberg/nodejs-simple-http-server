type TAllowedMethod = 'GET' | 'POST'
type THttpMethod = TAllowedMethod | 'HEAD' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH'

type TSimpleJsonResponse<T> = { ok: true, data: T, error: null } | { ok: false, data: null, error: string }

type TVars = Readonly<Record<string, { readonly type: 'str', readonly value: string } | { readonly type: 'int', readonly value: number }>>
type TSegment = { readonly type: 'int', readonly value: number, readonly name: string } | { readonly type: 'str', readonly value: string, readonly name: string } | { readonly type: 'path', readonly value: string, readonly name: null }
type TTargetSegment = { readonly name: string } & ({ readonly type: 'path', readonly values: null } | { readonly type: 'str', readonly values: null | string[] } | { readonly type: 'int', readonly values: null | (readonly [number, number] | number)[] })
type TRequestSegment = { readonly value: string } & ({ readonly maybeNumber: false, readonly asNumber: null } | { readonly maybeNumber: true, readonly asNumber: number })

type UMutable<T extends object> = { -readonly [K in keyof T]: T[K] }

export type {
  TAllowedMethod,
  THttpMethod,
  TSimpleJsonResponse,
  TVars,
  TSegment,
  TTargetSegment,
  TRequestSegment,
  UMutable
}
