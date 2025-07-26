import { type ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { type TReadonlyRouteOptions, getOrDefaultStatusText_ } from './options.js'
import { ResponseHeaders } from './ResponseHeaders.js'

class Response {
  /**
   * Пользовательская переменная.
   */
  value: any = null
  /**
   * + 0001 - отправлены заголовки
   * + 0010 - отправлена часть сообщения методом body или завершено
   * + 0100 - вызвана bodyEnd, после которой невозможно добавить данные, но сообщение, возможно, еще отправляется
   * + 1000 - завершено
   */
  _internalSent = 0b0000
  _internalQueue = Promise.resolve()
  protected _code = 200
  readonly _serverResponse: ServerResponse
  protected readonly _routeOptions: TReadonlyRouteOptions
  protected readonly _headers: ResponseHeaders

  constructor(res: ServerResponse, routeOptions: TReadonlyRouteOptions) {
    this._serverResponse = res
    this._routeOptions = routeOptions
    this._headers = new ResponseHeaders(routeOptions.headers)
  }

  get contentJson (): boolean {
    return /^application\/json/i.test(this._headers.get('content-type') ?? '')
  }

  sendHeaders (): void {
    if (this._internalSent & 0b0001) {
      console.warn('Заголовки были отправлены ранее.')
      return
    }
    this._internalSent |= 0b0001
    this._headers._internalSetReadonly()
    this._serverResponse.statusCode = this._code
    for (const [k, v] of this._headers.entries()) {
      this._serverResponse.setHeader(k, v)
    }
    this._serverResponse.flushHeaders()
  }

  protected async appendBody (value: Buffer): Promise<void> {
    if (this._internalSent & 0b0100) {
      console.warn('Нет возможности добавить данные к сообщению.')
      return
    }
    this._internalSent |= 0b0010
    const previous = this._internalQueue
    let finalize!: (() => any)
    this._internalQueue = new Promise((resolve) => finalize = resolve)
    await previous
    this._serverResponse.write(value, (e) => {
      if (e) {
        console.error(e)
      }
      finalize()
    })
    return this._internalQueue
  }

  async _internalEnd (): Promise<void> {
    if (this._internalSent & 0b0100) {
      return this._internalQueue
    }
    this._internalSent |= 0b0100
    const previous = this._internalQueue
    let finalize!: (() => any)
    this._internalQueue = new Promise((resolve) => finalize = resolve)
    await previous
    this._serverResponse.end(() => {
      this._internalSent |= 0b1000
      finalize()
    })
    return this._internalQueue
  }

  /**
   * Заголовки ответа.
   */
  get headers (): ResponseHeaders {
    return this._headers
  }

  get code (): number {
    return this._code
  }

  /**
   * Изменяет успешный код ответа для текущего обработчика. По умолчанию `200`. Это значение нельзя изменить, если
   * заголовки уже были отправлены.
   */
  set code (code: number) {
    if (!(this._internalSent & 0b0001)) {
      this._code = code
    }
  }

  /**
   * Добавляет данные к ответу.
   *
   * Этот метод инициирует отправку заголовков. Изменить или добавить заголовки и статус ответа, после вызова одного из
   * методов `body*()`, в дальнейшем невозможно.
   *
   * @param value Данные.
   */
  body (value: string | Buffer): Promise<void> {
    if (!(this._internalSent & 0b0001)) {
      this.sendHeaders()
    }
    if (typeof value === 'string') {
      value = Buffer.from(value, 'utf-8')
    }
    return this.appendBody(value)
  }

  /**
   * Отправляет заголовки, данные `JSON.stringify(value)` и завершает запрос. Если заголовок `content-type` не
   * установлен, по умолчанию устанавливается `application/json`.
   */
  bodyJson (value: object): void | Promise<void> {
    if (this._internalSent & 0b0010) {
      return
    }
    const text = JSON.stringify(value)
    const buff = Buffer.from(text, 'utf-8')
    this._headers.contentType('application/json; charset="utf-8"', true)
    this._headers.contentLength(buff.byteLength, true)
    this.sendHeaders()
    this.appendBody(buff)
    return this._internalEnd()
  }

  /**
   * Явно завершает запрос. После вызова этого метода повторное добавление данных невозможно.
   */
  bodyEnd (value?: undefined | null | string | Buffer): Promise<void> {
    if (this._internalSent & 0b0100) {
      return this._internalQueue
    }
    const notHeadersSent = !(this._internalSent & 0b0001)
    if (value) {
      if (typeof value === 'string') {
        value = Buffer.from(value, 'utf-8')
      }
      if (notHeadersSent) {
        this._headers.contentLength(value.byteLength, true)
        this.sendHeaders()
      }
      this.appendBody(value)
    }
    else if (notHeadersSent) {
      this._headers.contentLength(0, true)
      this.sendHeaders()
    }
    return this._internalEnd()
  }

  bodyFail (code: number, text?: undefined | null | string): void | Promise<void> {
    this._internalSent = 0b1111
    if (this._serverResponse.headersSent) {
      this._serverResponse.destroy()
    }
    else {
      let fail!: (() => any)
      const promise = new Promise<void>((resolve) => fail = resolve)
      const message = text ?? getOrDefaultStatusText_(code, 'Internal Server Error')
      this._code = code
      this._serverResponse.writeHead(code, { 'content-type': 'text/plain; charset="utf-8"', 'content-length': Buffer.byteLength(message, 'utf-8') })
      this._serverResponse.end(message, fail)
      return promise
    }
  }
}

export {
  Response
}
