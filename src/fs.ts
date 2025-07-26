import { type FileHandle, open } from 'node:fs/promises'
import { type ReadStream, createReadStream } from 'node:fs'
import { type Interface, createInterface } from 'node:readline'
import { join, extname, relative, isAbsolute } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { EOL } from 'node:os'
import { type Mime } from './mime.js'
import { type Request } from './Request.js'
import { type Response } from './Response.js'
import { asyncPause } from './utils.js'
import { base64Favicon } from './favicon.js'

function _getMime (path: string, mime: Mime): string | null {
  const ext = extname(path).toLowerCase()
  return ext.length > 1 ? mime.mimeOf(ext) : null
}

async function _sendFavicon (response: Response): Promise<void> {
  const buff = Buffer.from(base64Favicon, 'base64')
  response.headers.contentType('image/x-icon', false)
  response.headers.contentLength(buff.byteLength, false)
  return response.bodyEnd(buff)
}

/**
 * Читает и отправляет файл в пути `path`.
 *
 * @param path Абсолютный путь к файлу.
 * @param response
 * @param mime Заголовок `'content-type'` получит значение `mime:string` или попытается найти тип из `Mime`.
 */
async function sendFile (path: string, response: Response, mime: Mime | string): Promise<void> {
  let fh: FileHandle
  try {
    fh = await open(path, 'r')
    const stats = await fh.stat()
    if (!stats.isFile()) {
      throw new Error(`File "${path}" Not Found.`)
    }
    const mimeType = typeof mime === 'string' ? mime : _getMime(path, mime)
    if (mimeType) {
      response.headers.contentType(mimeType, false)
    }
    response.headers.contentLength(stats.size, false)
    response.sendHeaders()
    // Не будем усложнять Response - в статическом контексте его никто не использует и изменять поля напрямую безопасно
    response._internalSent |= 0b0010
    await response._internalQueue
    if (stats.size > 0) {
      await pipeline(fh.createReadStream(), response._serverResponse)
    }
  } catch (e) {
    console.error(e)
    throw e
  }
  finally {
    // @ts-expect-error
    fh?.close().catch(console.error)
  }
}

/**
 * То же что и `sendFile(...)`, но с симуляцией медленного чтения по времени `time`.
 */
async function sendFileSlow (path: string, response: Response, mime: Mime | string, time: number): Promise<void> {
  let fh: FileHandle
  try {
    fh = await open(path, 'r')
    const stats = await fh.stat()
    if (!stats.isFile()) {
      throw new Error(`File "${path}" Not Found.`)
    }
    const mimeType = typeof mime === 'string' ? mime : _getMime(path, mime)
    if (mimeType) {
      response.headers.contentType(mimeType, false)
    }
    response.headers.contentLength(stats.size, false)
    response.sendHeaders()
    response._internalSent |= 0b0010
    await response._internalQueue
    if (stats.size > 0) {
      const chunkSize = Math.ceil(stats.size / ((time || 1) * 50))
      const buff = Buffer.alloc(chunkSize)
      let bytesRead = 0
      while (bytesRead < stats.size) {
        const bytes = (await fh.read(buff, 0, chunkSize)).bytesRead
        if (bytes === 0) {
          break
        }
        bytesRead += bytes
        await new Promise<void>((ok, err) => {
          response._serverResponse.write(bytes < chunkSize ? buff.subarray(0, bytes) : buff, (e) => {
            if (e) {
              err(e)
            }
            else {
              ok()
            }
          })
        })
        await asyncPause(50)
      }
    }
  } catch (e) {
    console.error(e)
    throw e
  }
  finally {
    // @ts-expect-error
    fh?.close().catch(console.error)
  }
}

/**
 * Читает файл в Response используя заголовок Range
 */
async function sendStreamableFile (path: string, request: Request, response: Response, mime: Mime | string): Promise<void> {
  let fh: FileHandle
  try {
    fh = await open(path, 'r')
    const stats = await fh.stat()
    if (!stats.isFile()) {
      throw new Error(`File "${path}" Not Found.`)
    }

    const rangeHeader = request.incomingMessage.headers.range
    // Определяем Content-Type
    const mimeType = typeof mime === 'string' ? mime : _getMime(path, mime)
    if (mimeType) {
      response.headers.contentType(mimeType, false)
    }

    // Если есть заголовок Range, отдаем часть файла
    if (rangeHeader) {
      // Парсим 'bytes=12345-'
      const match = /bytes=(\d+)-(\d*)?/.exec(rangeHeader)
      if (!match) {
        // Если формат Range некорректен, отдаем ошибку.
        return Promise.resolve(response.bodyFail(416, 'Range Not Satisfiable'))
      }

      const start = Number.parseInt(match[1]!, 10)
      // Клиент может указать и конечный байт
      const end = match[2] ? Number.parseInt(match[2], 10) : stats.size - 1

      if (start >= stats.size || end >= stats.size) {
        response.headers.set('Content-Range', `bytes */${stats.size}`)
        return Promise.resolve(response.bodyFail(416, 'Range Not Satisfiable'))
      }

      const contentLength = (end - start) + 1
      // Устанавливаем статус и необходимые заголовки для частичного контента
      response.code = 206 // Partial Content
      response.headers.set('content-range', `bytes ${start}-${end}/${stats.size}`)
      response.headers.set('content-length', contentLength.toString())
      response.headers.set('accept-ranges', 'bytes') // Сообщаем, что поддерживаем range-запросы
      response.sendHeaders()
      // Создаем поток для чтения только нужной части файла
      await pipeline(fh.createReadStream({ autoClose: false, start, end }), response._serverResponse)
    } else {
      // Если заголовка Range нет, отдаем файл целиком
      response.code = 200 // OK
      response.headers.set('content-length', stats.size.toString())
      // Сообщаем, что поддерживаем range-запросы, чтобы браузер мог их делать в будущем
      response.headers.set('accept-ranges', 'bytes')
      response.sendHeaders()
      await pipeline(fh.createReadStream(), response._serverResponse)
    }
  } catch (_e) {
    // Не бросаем ошибок. Иначе при перемещении ползунка они будут всегда
    response._serverResponse.destroy()
  }
  finally {
    // @ts-expect-error
    fh?.close().catch(console.error)
  }
}

/**
 * Читает несколько строк тестового файла и возвращает фрагмент файла в `Buffer`.
 *
 * @param path Абсолютный путь к файлу.
 * @param startLine Строка с которой следует начать чтение включительно.
 * @param endLine Конечная строка включительно.
 * @param delimiter Разделитель строк для записи в `Buffer` между прочитанными строками, например: `'\n'`.
 *                  По умолчанию будет использован разделитель платформы `os.EOL`.
 */
async function sliceTextFile (path: string, startLine: number, endLine: number, delimiter?: undefined | null | string): Promise<Buffer> {
  const chunks: Buffer[] = []
  delimiter ??= EOL
  // https://nodejs.org/api/readline.html#example-read-file-stream-line-by-line
  let fileStream: ReadStream | undefined = undefined
  let rl: Interface | undefined = undefined

  try {
    fileStream = createReadStream(path)
    rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })
    let currLine = 0
    for await (const line of rl) {
      if (++currLine < startLine) {
        continue
      }
      chunks.push(Buffer.from(line, 'utf-8'))
      if (currLine >= endLine) {
        break
      }
      chunks.push(Buffer.from(delimiter, 'utf-8'))
    }
  }
  finally {
    rl?.close()
    fileStream?.close()
  }

  return Buffer.concat(chunks)
}

class FsStatic {
  protected readonly _rootDir: string
  protected readonly _mime: Mime

  handler = (request: Request, response: Response): Promise<void> => {
    return this._sendFile(join(this._rootDir, request.requestPath.relativePath), response)
  }

  private readonly _handlerIndex = (request: Request, response: Response): Promise<void> => {
    return this._sendFile(join(this._rootDir, request.url.pathname === '/' ? 'index.html' : request.requestPath.relativePath), response)
  }

  private readonly _handlerIndexAndFavicon = (request: Request, response: Response): Promise<void> => {
    return (request.url.pathname === '/favicon.ico')
      ? _sendFavicon(response)
      : this._sendFile(join(this._rootDir, request.url.pathname === '/' ? 'index.html' : request.requestPath.relativePath), response)
  }

  /**
   * @param rootDir Корневой каталог статических файлов.
   * @param mime
   * @param useIndex Может быть установлен в `true`, если маршрут предполагает `/` и путь `rootDir` имеет файл `index.html`.
   * @param useFavicon Как и `useIndex`, но для `/favicon.ico`.
   */
  constructor(rootDir: string, mime: Mime, useIndex: boolean, useFavicon: boolean) {
    this._rootDir = rootDir
    this._mime = mime
    if (useFavicon) {
      this.handler = this._handlerIndexAndFavicon
    }
    else if (useIndex) {
      this.handler = this._handlerIndex
    }
  }

  private _sendFile (path: string, response: Response): Promise<void> {
    const rel = relative(this._rootDir, path)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return Promise.resolve(response.bodyFail(403))
    }
    else {
      return sendFile(path, response, this._mime)
    }
  }
}

export {
  sendFile,
  sendFileSlow,
  sliceTextFile,
  sendStreamableFile,
  FsStatic
}
