
# Simple HTTP Server | NodeJS

Очень простой HTTP-сервер-маршрутизатор без зависимостей на NodeJS-22:

* Никаких `middleware` - только `GET/POST` с текстовым или JSON содержимым.
* Ограниченный набор MIME-типов для основных типов файлов - html/css/js/image.

Маршрутизатор может использоваться для примеров при разработке интерфейсов `VueJS/React` или простых приложений с обслуживанием статических файлов.

## Example

Предварительно [собираем](#build) и добавляем зависимость.

```js
import { createServer } from 'nodejs-simple-http-server'
const server = createServer({ port: 7868, noCache: true, favicon: true })

// Путь '/' будет автоматически преобразован к '<STATIC-PATH>/index.html'.
server.static('/', 'your/path/static/files')
server.get('/api/{msg:str}', (req, res) => {
  res.bodyJson({ message: req.vars.msg.value })
})

void async function () {
  await server.listen()
}()
```

Маршруты могут иметь переменные `string|uint` и следуют простой логике сортировки - от самого длиного до самого короткого пути и/или в порядке обратной регистрации. Такая последовательность регистрации:

```js
server.handle('/foo/bar', ...) // GET/POST
server.get('/one', ...)
server.get('/two', ...)
server.post('/bar/{value:int}/box', ...)
```

... приведет к сортировке:

    1. '/bar/{value:int}/box'
    2. '/foo/bar'
    3. '/two'
    4. '/one'

Расширенный пример с описанием в файле [demo/server.ts](demo/server.ts).
Для запуска должен быть установлен `"ts-node": "^10.9.2"`.

* Выполняем сборку `npm run dist` или `dist_watch`.
* Запускаем сервер(файл `demo/server.ts`) кнопкой в разделе `VSCode | Run and Debug (Launch TS File)` или `F5`.
* Открываем страницу `http://localhost:7868/`.

Использование с **WebSocketServer** [github.com/websockets/ws](https://github.com/websockets/ws)

```ts
import { createServer } from 'nodejs-simple-http-server'
import { type RawData, WebSocketServer } from 'ws'

const server = createServer({ noCache: true }) // Автоматически выбирается свободный порт
const { hostname, port } = await server.listen()

// Передаем ссылку на Node Server
const wss = new WebSocketServer({ server: server.server, path: '/ws' })
wss.on('connection', function connection (ws) {
  ws.on('error', console.error.bind(console))
  ws.on('message', function message (data: RawData, isBinary: boolean) {
    ws.send(data.toString())
  })
})
```

## Build

Выполняем команду:

    npm run dist

После сборки каталог `dist` можно использовать как пакет в TS/JS-проекте, вызываем в корне целевого проекта что-то вроде:

    npm i -D C:/.../nodejs-simple-http-server/dist

... в `package.json` будет добавлена запись:

```json
"devDependencies": {
  "nodejs-simple-http-server": "file:../../nodejs-simple-http-server/dist"
}
```
