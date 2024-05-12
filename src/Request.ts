import { type IncomingMessage } from 'node:http'
import type { THttpMethod, TVars } from './types.js'
import { RequestPath } from './paths.js'

class Request {
  protected readonly _incomingMessage: IncomingMessage
  protected readonly _url: URL
  protected _requestPath: RequestPath
  protected _body: Buffer | null = null
  protected _bodyText: string | null = null
  protected _bodyJson: any = null
  protected _bodyError: any = null
  _internalVars: TVars = {}

  constructor(incomingMessage: IncomingMessage, lower: boolean, hostname: string, port: null | number) {
    this._incomingMessage = incomingMessage
    this._url = new URL(incomingMessage.url && incomingMessage.url.length > 0 ? incomingMessage.url : '/', `http://${hostname}${port ? (':' + port.toString()) : ''}/`)
    this._requestPath = new RequestPath(this._url.pathname, lower)
  }

  /**
   * Ссылка на [http.IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage).
   */
  get incomingMessage (): IncomingMessage {
    return this._incomingMessage
  }

  /**
   * Метод запроса https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods.
   */
  get method (): THttpMethod {
    return this._incomingMessage.method as any
  }

  /**
   * Строка запроса преобразуется к [URL](https://nodejs.org/api/url.html) как `new URL(IncomingMessage.url, 'http://<HOSTNAME>:<PORT>/')`.
   * Это свойство содержит экземпляр `URL` и может использоваться для получения параметров.
   * Пути не декодируются и могут иметь специальные символы (например `%20`), для получения декодированного пути маршрута используйте `requestPath`.
   */
  get url (): URL {
    return this._url
  }

  get requestPath (): RequestPath {
    return this._requestPath
  }

  /**
   * Возвращает `true`, если в запросе присутствует заголовок `{'accept': '*json*' }`.
   */
  get acceptJson (): boolean {
    const value = ('accept' in this._incomingMessage.headers) ? this._incomingMessage.headers.accept : null
    return value ? /json/i.test(value) : false
  }

  /**
   * Возвращает `json`, если в запросе присутствует заголовок `{'content-type': 'application/json*' }`, иначе `text`.
   */
  get contentType (): 'text' | 'json' {
    const value = ('content-type' in this._incomingMessage.headers) ? this._incomingMessage.headers['content-type'] : null
    return value && /^application\/json/i.test(value) ? 'json' : 'text'
  }

  /**
   * Переменные строки запроса (не путать с параметрами после `?`).
   *
   * Пример: `route:'/path/{foo:int}' & url:'/path/123/some' => vars.foo.value === 123`.
   */
  get vars (): TVars {
    return this._internalVars
  }

  /**
   * Возвращает тело запроса POST как Buffer.
   */
  async readBody (): Promise<Buffer> {
    if (this.method !== 'POST') {
      throw new Error('Запрос должен быть POST.')
    }
    if (this._bodyError) {
      throw this._bodyError
    }
    if (this._body) {
      return this._body
    }
    if (this._incomingMessage.readableEnded) {
      this._body = Buffer.alloc(0)
      return this._body
    }

    const inMsg = this._incomingMessage
    const chunks: Buffer[] = []
    return new Promise<Buffer>((ok, err) => {
      const onData = (chunk: any) => {
        chunks.push(chunk)
      }
      const onEnd = () => {
        inMsg.off('data', onData)
        inMsg.off('error', onErr)
        this._body = Buffer.concat(chunks)
        ok(this._body)
      }
      const onErr = (e: any) => {
        inMsg.off('data', onData)
        inMsg.off('end', onEnd)
        this._bodyError = e
        err(e)
      }
      inMsg.on('data', onData)
      inMsg.once('end', onEnd)
      inMsg.once('error', onErr)
    })
  }

  /**
   * Возвращает тело запроса POST как строку.
   */
  async readText (): Promise<string> {
    if (this._bodyText) {
      return this._bodyText
    }
    const buff = await this.readBody()
    this._bodyText = buff.toString('utf8')
    return this._bodyText
  }

  /**
   * Возвращает тело запроса POST как Json-объект. Запрос должен иметь заголовок `{"content-type": "application/json"}`.
   */
  async readJson<T extends object> (): Promise<T> {
    if (this._bodyJson) {
      return this._bodyJson
    }
    if (this.contentType !== 'json') {
      throw new Error('Запрос должен иметь заголовок {"content-type": "application/json"}')
    }
    const text = await this.readText()
    this._bodyJson = JSON.parse(text)
    return this._bodyJson
  }
}

export {
  Request
}
