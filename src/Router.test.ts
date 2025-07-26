import { test, expect } from 'vitest'
import {
  type Route,
  Router
} from './Router.js'

const handler = (_req: any, _res: any) => { /**/ }

test('Router', () => {
  const router = new Router(false)

  router.register('/foo/bar', handler, {} as any)
  router.register('/one', handler, {} as any)
  router.register('/two/', handler, {} as any)
  router.register('/one', handler, {} as any)
  router.register('/three', handler, {} as any)
  router.register('/bar/{value:int}/box', handler, {} as any)

  const routes = router._internalRoutes.map(({ path }: Route) => path.rawPath)

  expect(routes).toStrictEqual([
    '/bar/{value:int}/box',
    '/foo/bar',
    '/two/', // <= Перед three, потому-что имеет конечный слеш
    '/three',
    '/one',
    '/one' // Повтор маршрута не вызывает ошибки, но и не имеет эффекта.
  ])
})


test('Router Error', () => {
  const router = new Router(false)

  // Маршрут с более коротким путем не может ссылаться на более длинный, который роутер уже прошол - то есть в обратную сторону.
  router.register('/foo', handler, { next: 'bar', name: 'foo' } as any)
  expect(() => router.register('/bar/box', handler, { name: 'bar' } as any)).toThrow(/Route.next:"bar" не может ссылаться на Route.name:"bar"/)

  // Повторы имен запрещены
  expect(() => router.register('/fox', handler, { name: 'foo' } as any)).toThrow(/Имена Route.name:"foo" должны быть уникальными/)
})
