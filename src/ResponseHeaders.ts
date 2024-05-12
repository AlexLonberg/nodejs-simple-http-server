class ResponseHeadersContentType {
  private readonly _headers: { _internalSet: (name: string, value: string) => any }

  constructor(headers: { _internalSet: (name: string, value: string) => any }) {
    this._headers = headers
  }

  /** `'content-type', 'text/plain; charset="utf-8"'` */
  text (): void {
    this._headers._internalSet('content-type', 'text/plain; charset="utf-8"')
  }
  /** `'content-type', 'text/html; charset="utf-8"'` */
  html (): void {
    this._headers._internalSet('content-type', 'text/html; charset="utf-8"')
  }
  /** `'content-type', 'text/css; charset="utf-8"'` */
  css (): void {
    this._headers._internalSet('content-type', 'text/css; charset="utf-8"')
  }
  /** `'content-type', 'text/javascript; charset="utf-8"'` */
  javascript (): void {
    this._headers._internalSet('content-type', 'text/javascript; charset="utf-8"')
  }
  /** `'content-type', 'application/json; charset="utf-8"'` */
  json (): void {
    this._headers._internalSet('content-type', 'application/json; charset="utf-8"')
  }
  /** `'content-type', 'application/octet-stream'` */
  bin (): void {
    this._headers._internalSet('content-type', 'application/octet-stream')
  }
}

class ResponseHeaders {
  protected _readonly = false
  protected readonly _map = new Map<string, string>
  protected readonly _defaultHeaders: Record<string, string>
  protected readonly _contentType: ResponseHeadersContentType

  constructor(headers: Record<string, string>) {
    this._defaultHeaders = { ...headers }
    this._contentType = new ResponseHeadersContentType(this)
    this.setAll(headers)
  }

  /**
   * Фиксирует заголовки для предотвращения изменений.
   */
  _internalSetReadonly (): void {
    this._readonly = true
  }

  _internalSet (name: string, value: string): void {
    if (!this._readonly) {
      this._map.set(name.toLowerCase(), value)
    }
  }

  get isReadonly (): boolean {
    return this._readonly
  }

  /**
   * Ссылка на объект с предопределенными функциями установки заголовков по умолчанию для основных типов контента.
   */
  get type (): ResponseHeadersContentType {
    return this._contentType
  }

  /**
   * Наличие установленного заголовка с именем `name`.
   */
  has (name: string): boolean {
    return this._map.has(name.toLowerCase())
  }

  /**
   * Установить или переустановить заголовок с именем `name`.
   *
   * @param name Имя заголовка.
   * @param value Значение.
   */
  set (name: string, value: string): void {
    this._internalSet(name, value)
  }

  /**
   * Установит заголовок только в случае его отсутствия.
   */
  setIfNot (name: string, value: string): void {
    name = name.toLowerCase()
    if (!this._map.has(name)) {
      this._internalSet(name, value)
    }
  }

  /**
   * Варирант установки заголовков с передачей объекта.
   * Эта функция вызывает `set(name, value)` для каждого свойства.
   */
  setAll (headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      this._internalSet(key, value)
    }
  }

  /**
   * Возвратит значение заголовка `name`, если он установлен.
   */
  get (name: string): string | null {
    return this._map.get(name.toLowerCase()) ?? null
  }

  /**
   * Удалить заголовок с именем `name`.
   */
  delete (name: string): void {
    if (!this._readonly) {
      this._map.delete(name.toLowerCase())
    }
  }

  /**
   * Установить заголовок `{'cache-control': 'no-store, no-cache, max-age=0'}`.
   */
  noCache (): void {
    this._internalSet('cache-control', 'no-store, no-cache, max-age=0')
  }

  /**
   * Установить заголовок `{'content-length': 123}`.
   *
   * @param length
   * @param ifNot Не устанавливать заголовок, если он уже установлен независимо от значения.
   */
  contentLength (length: number, ifNot: boolean): void {
    if (ifNot && this._map.has('content-length')) {
      return
    }
    this._internalSet('content-length', length.toString())
  }

  /**
   * Установить заголовок `{'content-type': *}`.
   *
   * @param value
   * @param ifNot Не устанавливать заголовок, если он уже установлен независимо от значения.
   */
  contentType (value: string, ifNot: boolean): void {
    if (ifNot && this._map.has('content-type')) {
      return
    }
    this._internalSet('content-type', value)
  }

  /**
   * Сбросить заголовки к праметрам по умолчанию.
   */
  reset (): void {
    if (!this._readonly) {
      this._map.clear()
      this.setAll(this._defaultHeaders)
    }
  }

  /**
   * Очистить все заголовки, в том числе по умолчанию.
   */
  clear (): void {
    if (!this._readonly) {
      this._map.clear()
    }
  }

  entries (): IterableIterator<readonly [string, string]> {
    return this._map.entries()
  }
}

export {
  ResponseHeadersContentType,
  ResponseHeaders
}
