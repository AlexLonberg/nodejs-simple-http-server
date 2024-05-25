import { cwd } from 'node:process'
import { join, extname } from 'node:path'
import { readdir } from 'node:fs/promises'
import { equal } from 'node:assert'
import {
  type TOptions,
  type TRouteOptions,
  type Request,
  type Response,
  createServer,
  openDirectoryDialog,
  sendFile,
  sendFileSlow
} from '../dist/index.js' // 'nodejs-simple-http-server'

const root = join(cwd(), 'demo')

// Необязательный объект опций. Каждое из свойств так же необязательно и имеет значение по умолчанию.
const options: TOptions = {
  // port и hostname передаются серверу как есть.
  // Если порт не установлен, узнать его можно после вызова SimpleHttpServer.listen().
  port: 7868,
  hostname: 'localhost',
  // Использовать иконку по умолчанию на запрос '/favicon.ico', которую так любит браузер.
  favicon: true,
  // Явно приводить все пути к toLowerCase(). Без этой опции пути сравниваются как есть '/Path/To' !== 'path/to'.
  lower: true,
  // Это установит для всех запросов соответствующий заголовок.
  noCache: true,
  // Заголовки по умолчанию для всех маршрутов.
  headers: { 'X-Server': 'Simple Http Server' },
  // Код и текст ответа для неразрешенного запроса.
  // Обработчики маршрутов позволяют явно установить любой код, как для успешного, так и для неразрешенного запроса.
  failureCode: { code: 404, text: 'Not Found' }, // | 404
  // Этот параметр управляет передачей обработки запроса следующему маршруту. По умолчанию, если обработчик не вернул
  // ответ, запрос будет завершен с ошибкой.
  next: false
}

// Второй параметр `serviceRoute` используется для целей тестирования и необязателен как и `options`.
const server = createServer(options, '__internal__')

// SimpleHttpServer использует ограниченный набор предопределенных MIME-типов, который всегда можно расширить или
// заменить. Это пример будет возвращать для расширения `.ts` => 'text/plain; charset="utf-8"'
server.mime.register('.ts', 'text', 'plain', 'charset="utf-8"')

// Пути не подошедшие ни к одному маршруту могут обслуживаться как статические файлы, и только в том случае, если
// установлен один из маршрутов с помощью SimpleHttpServer.static(...). Маршруты обрабатываются от самого длинного пути
// к корню. Если количество сегментов маршрутов равны, обработчик выбирается в порядке определения и зависит от
// завершающего слеша. Маршрут - '/foo/bar' будет обработан после '/foo/bar/'.
server.static('/', root, { name: 'root' })
// Статических маршрутов может быть неограниченное количество. По умолчанию, если обработчик не вызвал метод ответа
// body*(...), запрос завершится ошибкой. Параметр `next:true|string` позволяет передать обработку следующему
// обработчику или явно определить именованный маршрут. Необработанный запрос будет передан вышеопределенному маршруту
// `{name: 'root'}`. Имена маршрутов не могут быть установлены в цепочке выше - так как пути в вышестоящей цепочке уже
// обработаны.
server.static('/src', join(cwd(), 'src'), { next: 'root' })

// Обработчик запроса GET. Для этого маршрута разрешен только GET-метод запроса.
server.get('/hello', (_reg: Request, res: Response) => {
  // Типы контента(заголовок 'content-type') можно установить предопределенными методами css/html/...()
  res.headers.type.bin()
  // ... это переустановит заголовок выше
  res.headers.type.text()
  // ... или явно установить в headers
  res.headers.set('X-My-Header', 'some text')
  // ... или в виде объекта. Имена заголовков явно приводятся в нижний регистр 'x-other'.
  res.headers.setAll({ 'X-Other': 'other text' })
  // Некоторые заголовки могут быть доступны сокращенными методами.
  res.headers.noCache()
  // Заголовки и код статуса должны быть установлены до первого использования body*() и будут отправлены после вызова
  // одного из методов body/bodyFail/bodyJson/bodyJsonFail/bodyEnd().
  // Заголовки и код статуса перезаписывают значения по умолчанию для текущего маршрута.
  res.code = 200
  // Первый вызов body() запретит дальнейшее использование bodyFail/bodyJson/bodyJsonFail().
  res.body('Hello')
  // Ответ считается завершенным:
  //   + либо после вызова bodyFail/bodyJson/bodyJsonFail()
  //   + либо после вызова bodyEnd(...)
  //   + либо, если был вызван body(), после завершения выполнения текущей функции, которая может возвращать Promise,
  //     В этом случае bodyEnd() вызывается автоматически.
  // Метод body() отправляет данные немедленно, но не завершает запрос, что позволяет добавить данные.
  res.body(' World')
  // Вызов bodyEnd('data') с данными, без предварительного вызова body(...), установит заголовок 'content-length'.
  // В случае с несколькими вызовами body(...), заголовок 'content-length' не устанавливается.
  res.bodyEnd(/* string | Buffer | null */)
  // Вызов body(...) после bodyEnd() не вызовет ошибку и будет проигнорирован.
  res.body('Some text')
})

// Этот обработчик GET ничем не отличается от get(), но автоматически устанавливает заголовок 'application/json', и, в
// случае ошибки обработчика, отправит ожидаемый SimpleJsonResponse объект с ошибкой на любой запрос.
server.getJson('/calculator/{operation:str:[add,subtract,multiply,divide]}/{value1:int:[0-100,1000]}/{value2:int}', (req: Request, res: Response) => {
  // Переменные {var} пути доступны через Request.vars. Допускаются только целые int >= 0 или str.
  // После второго двоеточия(необязательно) можно установить ограничения в массиве через запятую и без кавычек.
  //
  // Строки ограничиваются константами, зарезервированные символы внутри массива не допускаются `<SPACE>:\/,[]{}`.
  // Числа ограничиваются точным значением или диапазоном.
  //
  // Если маршрут совпал - переменные точно будут доступны, неподходящее значение полностью игнорирует маршрут.
  // Переменная доступна по имени как объект {type:'str'|'int', value:string|number}
  equal(req.vars.operation.type, 'str')
  const { operation: { value: op }, value1: { value: v1 }, value2: { value: v2 } } = req.vars as unknown as { operation: { value: string }, value1: { value: number }, value2: { value: number } }
  const result =
    op === 'add'
      ? v1 + v2
      : op === 'subtract'
        ? v1 - v2
        : op === 'multiply'
          ? v1 * v2
          : v2 === 0
            ? (() => { throw new Error('Деление на ноль недопустимо.') })()
            : v1 / v2
  // Ошибки обработчика отлавливаются и, в случае если заголовки и данные еще не отправлены, возвращают подходящий ответ.
  // На запрос '/calculator/divide/5/0' ответ будет иметь вид {ok: false, data: null, error: 'Деление на ноль недопустимо.'},
  // в том числе, клиент получит код ответа 200, установленный для этого маршрута в случае ошибки.
  res.bodySimpleJson(result)
}, { failureCode: 200 })

// Запросы post/postJson() работают по той же логике, что и get*(), но устанавливают ограничение для методов POST.
// Все методы имеют третий необязательный параметр TRouteOptions, перезаписывающие параметры по умолчанию TOptions для
// текущего маршрута.
const routeOptions: TRouteOptions = { name: 'example_post_name', headers: { 'x-sample-header': 'sample-value' } }
server.post('/api/example_post', (req: Request, res: Response) => {
  res.headers.set('x-example-post-json', 'hello')
  // Ответ вызванный методом bodyJson() автоматически добавит заголовок 'application/json'.
  if (req.acceptJson || res.contentJson) {
    res.bodyJson({ message: (res.value ?? 'Ok') })
  }
  else {
    res.headers.type.text()
    res.body(res.value ?? 'Ok')
  }
}, routeOptions)

server.postJson('/api/example_post', async (req: Request, res: Response) => {
  await Promise.resolve(null)
  // Этот обработчик ничего не делает и просто перенаправляет запрос к именованному маршруту 'example_post_name'.
  // Оба маршрута находятся на одном уровне, поэтому такая операция допустима. В случае, если у первого маршрута
  // 'example_post' был бы последний слеш '/api/example_post/', добавление этого обработчика завершилось бы ошибкой.
  //
  // Маршруты сортируются по количеству сегментов пути, завершающему слешу и порядку определения.
  // Этот обработчик определен после 'example_post' и будет обработан первым.
  // Передать запрос в обратную сторону, от первого 'example_post' к этому обработчику - нельзя.
  //
  // Заголовки установленные в этом обработчике полностью игнорируются и будут сброшены.
  res.headers.set('x-example-post-some', 'hello')
  // ... но можно установить любые данные в пользовательскую переменную и получить к ней доступ как в примере выше
  res.value = req.contentType === 'json' ? (await req.readJson<{ data: string }>()).data : (await req.readText())
}, { next: 'example_post_name' })

// Пример файлового диалога OS для выбора каталога.
server.getJson('/api/select_dir', async (_req: Request, res: Response) => {
  const result = await openDirectoryDialog()
  res.bodyJson(result)
})

// Пример выбора каталога и чтения списка файлов изображений.
server.getJson('/api/read_dir', async (_req: Request, res: Response) => {
  const result = await openDirectoryDialog()
  if (result.ok) {
    const dir = result.data!
    const files: string[] = []
    const dirent = await readdir(dir, { encoding: 'utf-8', withFileTypes: true, recursive: false })
    for await (const item of dirent) {
      const ext = extname(item.name).toLowerCase()
      if (item.isFile() && server.mime.typeOf(ext) === 'image') {
        files.push(item.name)
      }
    }
    result.data = { dir, files } as any
  }
  res.bodyJson(result)
})

// Пример чтения файла. Сегменты автоматически декодируются(decodeURIComponent) и могут содержать специальные символы,
// в данном примере переменная req.vars.path получит абсолютный путь к файлу "C:/your/path/file.extension".
server.get('/api/get_file/{path:str}', (req: Request, res: Response) => {
  // Не забываем - мы должны возвратить (void | Promise<void>)
  return sendFile(req.vars.path.value as string, res, server.mime)
})

// Пример с симуляцией медленного чтения файла.
server.get('/api/get_file/{time:int}/{path:str}', (req: Request, res: Response) => {
  return sendFileSlow(req.vars.path.value as string, res, server.mime, req.vars.time.value as number)
})

void async function () {
  await server.listen() // => { hostname, port }
}()
