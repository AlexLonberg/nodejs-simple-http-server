import { type ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { type TReadonlyRouteOptions } from './options.js'
import { SimpleJsonResponse } from './SimpleJsonResponse.js'
import { ResponseHeaders } from './ResponseHeaders.js'
import { statusCodes } from './statusCodes.js'

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
  private readonly _queue: Promise<void>[] = []
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
    let ok: (() => void)
    const p = new Promise<void>((resolve) => ok = resolve)
    const beforeIndex = this._queue.push(p) - 2
    if (beforeIndex >= 0) {
      await this._queue[beforeIndex]
    }
    this._serverResponse.write(value, (e) => {
      if (e) {
        console.error(e)
      }
      this._queue.shift()
      ok()
    })
    return p
  }

  async _internalEnd (): Promise<void> {
    const beforeIndex = this._queue.length - 1
    if (this._internalSent & 0b0100) {
      if (beforeIndex >= 0) {
        return this._queue[beforeIndex]
      }
      return
    }
    this._internalSent |= 0b0100
    let ok: (() => void)
    const p = new Promise<void>((resolve) => ok = resolve)
    this._queue.push(p)
    if (beforeIndex >= 0) {
      await this._queue[beforeIndex]
    }
    this._serverResponse.end(() => {
      this._internalSent |= 0b1000
      this._queue.splice(0)
      ok()
    })
    return p
  }

  protected sendJson (value: object): void | Promise<void> {
    if (this._internalSent & 0b0001) {
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
    return this.sendJson(value instanceof SimpleJsonResponse ? value.toObject() : value)
  }

  /**
   * Отправляет заголовки, заворачивает `value` в `SimpleJsonResponse` и завершает запрос.
   *
   * @param value Любое значение.
   */
  bodySimpleJson (value: any): void | Promise<void> {
    return this.sendJson(SimpleJsonResponse.result(value).toObject())
  }

  /**
   * Завершает запрос ошибкой. Если заголовок `content-type` не установлен, по умолчанию устанавливается в `text/plain`.
   *
   * @param code Заменить статус по умолчанию для этого обработчика.
   * @param text Заменить текст статуса по умолчанию для этого обработчика.
   */
  bodyFail (code?: undefined | null | number, text?: undefined | null | string): void | Promise<void> {
    if (this._internalSent & 0b0001) {
      return
    }
    if (code) {
      this._code = code
    }
    else {
      code = this._code
    }
    this._headers.setIfNot('content-type', 'text/plain; charset="utf-8"')
    return this.bodyEnd(text ?? statusCodes.getOrDefault(code))
  }

  /**
   * Завершает запрос ошибкой и отправляет ответ в виде `SimpleJsonResponse`. Для запроса из приложения ожидающего JSON
   * может подойти `code:200`, а ошибка определяется по содержимому.
   *
   * @param code
   * @param text
   */
  bodyJsonFail (code?: undefined | null | number, text?: undefined | null | string): void | Promise<void> {
    if (code) {
      this._code = code
    }
    else {
      code = this._code
    }
    return this.sendJson(SimpleJsonResponse.error(text ?? statusCodes.getOrDefault(code)).toObject())
  }

  /**
   * Явно завершает запрос. После вызова этого метода повторное добавление данных невозможно.
   */
  bodyEnd (value?: undefined | null | string | Buffer): void | Promise<void> {
    if (this._internalSent & 0b0100) {
      if (this._queue.length > 0) {
        return this._queue[this._queue.length - 1]
      }
      return
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
}

export {
  Response
}
