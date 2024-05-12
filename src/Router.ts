import type { TAllowedMethod } from './types.js'
import { type Request } from './Request.js'
import { type Response } from './Response.js'
import { type TReadonlyRouteOptions } from './options.js'
import { TargetPath } from './paths.js'
import { hasOwn } from './utils.js'

class Route {
  _internalIndex = -1
  protected readonly _path: TargetPath
  protected readonly _options: TReadonlyRouteOptions
  readonly handler: ((request: Request, response: Response) => (void | Promise<void>))

  constructor(path: TargetPath, handler: ((request: Request, response: Response) => (void | Promise<void>)), options: TReadonlyRouteOptions) {
    this._path = path
    this._options = options
    this.handler = handler
  }

  /**
   * Возвращает `true`, если маршрут имеет заголовок `{'content-type': 'application/json*'}`.
   */
  get contentJson (): boolean {
    return (hasOwn(this._options.headers, 'content-type') && /^application\/json/i.test(this._options.headers['content-type']))
  }
  get index (): number {
    return this._internalIndex
  }
  get length (): number {
    return this._path.length
  }
  get path (): TargetPath {
    return this._path
  }
  get endSlash (): boolean {
    return this._path.endSlash
  }
  get options (): TReadonlyRouteOptions {
    return this._options
  }
  get method (): null | TAllowedMethod {
    return this._options.method
  }
  get name (): null | string {
    return this._options.name
  }
  get next (): boolean | string {
    return this._options.next
  }
}

class Router {
  readonly _internalRoutes: Route[] = []
  protected readonly _lower: boolean

  constructor(lower: boolean) {
    this._lower = lower
  }

  register (rawPath: string, handler: ((request: Request, response: Response) => (void | Promise<void>)), options: TReadonlyRouteOptions): void {
    const route = new Route(new TargetPath(rawPath, this._lower), handler, options)
    let i = this._internalRoutes.length - 1
    for (; i >= 0; --i) {
      const item = this._internalRoutes[i]
      if (route.name && route.name === item.name) {
        throw new Error(`Имена Route.name:"${route.name}" должны быть уникальными.`)
      }
      if ((route.length > item.length) ||
        (route.length === item.length && (!item.endSlash || route.endSlash))) {
        if (typeof item.next === 'string' && item.next === route.name) {
          throw new Error(`Route.next:"${item.next}" не может ссылаться на Route.name:"${route.name}".`)
        }
        continue
      }
      break
    }
    i++
    this._internalRoutes.splice(i, 0, route)
    i--
    for (; i >= 0; --i) {
      const item = this._internalRoutes[i]
      if (route.name && route.name === item.name) {
        throw new Error(`Имена Route.name:"${route.name}" должны быть уникальными.`)
      }
    }
    i = 0
    for (; i < this._internalRoutes.length; ++i) {
      this._internalRoutes[i]._internalIndex = i
    }
  }

  findRoute (request: Request, index: number, next: null | string): Route | null {
    for (let i = index; i < this._internalRoutes.length; ++i) {
      const route = this._internalRoutes[i]
      if ((route.method !== null && route.method !== request.method) || (next !== null && route.name !== next)) {
        continue
      }
      const segments = route.path.startWith(request.requestPath)
      if (segments) {
        request.requestPath._internalRoutePathLength(route.path.length)
        request._internalVars = Object.fromEntries(segments.filter(({ type }) => type !== 'path').map((v) => [v.name, v]))
        return route
      }
    }
    return null
  }
}

export {
  Route,
  Router
}
