import {
  type Route,
  Router
} from './Router.js'

test('Router', () => {
  const handler = (_req: any, _res: any) => { /**/ }
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
