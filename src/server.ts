import { type AddressInfo } from 'node:net'
import {
  type IncomingMessage,
  type ServerResponse,
  type Server as NodeServer,
  createServer as createNodeServer
} from 'node:http'
import type { TRequestHandler } from './types.js'
import { Mime } from './mime.js'
import {
  type TReadonlyOptions,
  type TOptions,
  type TReadonlyRouteOptions,
  type TRouteOptions,
  parseOptions_,
  parseRouteOptions_
} from './options.js'
import { type Route, Router } from './Router.js'
import { Request } from './Request.js'
import { Response } from './Response.js'
import { FsStatic } from './fs.js'
import { messageFromError } from './utils.js'

// DOC Node http.Server https://nodejs.org/api/http.html

class SimpleHttpServer {
  protected readonly _mime = new Mime()
  protected readonly _options: TReadonlyOptions
  protected readonly _server: NodeServer
  protected _port = 0
  protected _closed: boolean | Promise<void> = false
  readonly _internalRouter: Router

  private readonly _requestListener = async (req: IncomingMessage, res: ServerResponse) => {
    const request = new Request(req, this._options.lower, this._options.hostname, this._port)
    let route: Route | null = null
    let index = 0
    let next: null | string = null
    let userValue: any = null
    // Последовательно проходимся по маршрутам начиная с самого длинного
    while ((route = this._internalRouter.findRoute(request, index, next))) {
      const response = new Response(res, route.options)
      response.value = userValue
      try {
        await route.handler(request, response)
      } catch (e) {
        // Если падаем то сразу обрабатываем ошибку
        this._errorHandler(response, route.options, e, request.acceptJson || route.contentJson)
        return
      }
      // Если что-то отправили - выходим
      if (response._internalSent) {
        response._internalEnd()
        return
      }
      // ... нет маршрута, так же вызываем ошибку
      if (!route.options.next) {
        break
      }
      // ... иначе двигаемся со следующего индекса
      index = route.index + 1
      next = route.options.next === true ? null : route.options.next
      userValue = response.value
    }
    this._errorRoute(request, res)
  }

  constructor(options: TReadonlyOptions) {
    this._options = options
    this._internalRouter = new Router(options.lower)
    this._server = createNodeServer(this._requestListener)
  }

  get mime (): Mime {
    return this._mime
  }

  get port (): number {
    return this._port
  }

  get server (): NodeServer {
    return this._server
  }

  get closed (): boolean {
    return !!this._closed
  }

  private _errorHandler (response: Response, routeOptions: TReadonlyRouteOptions, e: any, acceptJson: boolean): void {
    const error = messageFromError(e) ?? routeOptions.failureText
    response.code = routeOptions.failureCode
    if (acceptJson) {
      response.bodyJson({ error })
    } else {
      response.bodyEnd(error)
    }
  }

  private _errorRoute (request: Request, res: ServerResponse): void {
    // Фиктивные параметры маршрута
    const routeOptions: TReadonlyRouteOptions = {
      method: request.method as any,
      name: null,
      next: false,
      headers: { ...this._options.headers },
      failureCode: this._options.failureCode,
      failureText: this._options.failureText
    }
    const response = new Response(res, routeOptions)
    response.code = routeOptions.failureCode
    if (request.acceptJson || response.contentJson) {
      response.bodyJson({ error: routeOptions.failureText })
    } else {
      response.bodyEnd(routeOptions.failureText)
    }
  }

  protected _registerRoute (stringRoute: string, handler: TRequestHandler, ...options: TRouteOptions[]): void {
    const { headers, failureCode, failureText, next } = this._options
    const opts = parseRouteOptions_({ headers, failureCode: { code: failureCode, text: failureText }, next }, ...options)
    this._internalRouter.register(stringRoute, handler, opts)
  }

  static (stringRoute: string, dir: string, options?: undefined | null | TRouteOptions): void {
    const useIndex = stringRoute === '/'
    const fs = new FsStatic(dir, this._mime, useIndex, (useIndex && this._options.favicon))
    this._registerRoute(stringRoute, fs.handler, options ?? {})
  }

  handle (stringRoute: string, handler: TRequestHandler, options?: undefined | null | TRouteOptions): void {
    this._registerRoute(stringRoute, handler, options ?? {})
  }

  get (stringRoute: string, handler: TRequestHandler, options?: undefined | null | TRouteOptions): void {
    this._registerRoute(stringRoute, handler, options ?? {}, { method: 'GET' })
  }

  getJson (stringRoute: string, handler: TRequestHandler, options?: undefined | null | TRouteOptions): void {
    this._registerRoute(stringRoute, handler, options ?? {}, { method: 'GET', headers: { 'content-type': this._mime.mimeOf('.json')! } })
  }

  post (stringRoute: string, handler: TRequestHandler, options?: undefined | null | TRouteOptions): void {
    this._registerRoute(stringRoute, handler, options ?? {}, { method: 'POST' })
  }

  postJson (stringRoute: string, handler: TRequestHandler, options?: undefined | null | TRouteOptions): void {
    this._registerRoute(stringRoute, handler, options ?? {}, { method: 'POST', headers: { 'content-type': this._mime.mimeOf('.json')! } })
  }

  listen (): Promise<{ hostname: string, port: number }> {
    return new Promise((ok, _fail) => {
      this._server.listen({ port: this._options.port || undefined, host: this._options.hostname }, () => {
        // AddressInfo = { address: "::1",  family: "IPv6", port: 1234 }
        const { address, port } = this._server.address() as AddressInfo
        this._port = port
        console.log(`Server is running on http://${address}:${port}`)
        ok({ hostname: address, port })
      })
    })
  }

  close (): void | Promise<void> {
    if (!this._closed) {
      let resolve: (() => void)
      this._closed = new Promise((_resolve) => {
        resolve = _resolve
      })
      this._server.close(() => {
        this._closed = true
        resolve?.()
      })
      return this._closed
    }
    if (this._closed !== true) {
      return this._closed
    }
  }
}

function createServiceHandler (ss: SimpleHttpServer): TRequestHandler {
  return ((req: Request, res: Response): void | Promise<void> => {
    const command = req.vars?.command?.value as string
    if (command === 'routelist') {
      const list: any[] = []
      for (const route of ss._internalRouter._internalRoutes) {
        list.push({ method: route.method ?? 'null', name: route.name ?? 'null', next: route.next ?? 'null', path: route.path.rawPath })
      }
      res.bodyJson(list)
    }
  })
}

/**
 * Возвращает экземпляр `SimpleHttpServer`.
 *
 * @param options Необязательный объект опций или номер порта.
 * @param serviceRoute Необязательный служебный маршрут.
 */
function createServer (options?: undefined | null | number | TOptions, serviceRoute?: undefined | null | string) {
  const server = new SimpleHttpServer(parseOptions_(options))
  if (serviceRoute) {
    server.postJson(`/${serviceRoute}/{command:str:[routelist]}`, createServiceHandler(server), { noCache: true, next: false })
  }
  return server
}

export {
  SimpleHttpServer,
  createServer
}
