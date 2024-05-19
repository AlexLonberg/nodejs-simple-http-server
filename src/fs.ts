import { type FileHandle, open } from 'node:fs/promises'
import { type ReadStream, createReadStream } from 'node:fs'
import { type Interface, createInterface } from 'node:readline'
import { join, extname } from 'node:path'
import { pipeline } from 'node:stream'
import { EOL } from 'node:os'
import { type Mime } from './mime.js'
import { type Request } from './Request.js'
import { type Response } from './Response.js'
import { asyncPause } from './utils.js'
import { base64Favicon } from './favicon.js'

function getMime (path: string, mime: Mime): string | null {
  const ext = extname(path).toLowerCase()
  return ext.length > 1 ? mime.mimeOf(ext) : null
}

async function sendFavicon (response: Response): Promise<void> {
  const buff = Buffer.from(base64Favicon, 'base64')
  response.headers.contentType('image/x-icon', false)
  response.headers.contentLength(buff.byteLength, false)
  response.sendHeaders()
  response._internalSent |= 0b0110
  try {
    await new Promise<void>((ok) => {
      response._serverResponse.end(buff, () => {
        response._internalSent |= 0b1000
        ok()
      })
    })
  } catch (e) {
    console.error(e)
  }
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
    const mimeType = typeof mime === 'string' ? mime : getMime(path, mime)
    if (mimeType) {
      response.headers.contentType(mimeType, false)
    }
    response.headers.contentLength(stats.size, false)
    response.sendHeaders()
    response._internalSent |= 0b0010
    if (stats.size > 0) {
      await new Promise<void>((ok, err) => {
        pipeline(fh.createReadStream(), response._serverResponse, (e) => {
          if (e) {
            err(e)
          }
          else {
            ok()
          }
        })
      })
    }
    await response._internalEnd()
  } catch (e) {
    console.error(e)
  }
  finally {
    // @ts-ignore
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
    const m = typeof mime === 'string' ? mime : getMime(path, mime)
    if (m) {
      response.headers.contentType(m, false)
    }
    response.headers.contentLength(stats.size, false)
    response.sendHeaders()
    response._internalSent |= 0b0010
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
    await response._internalEnd()
  } catch (e) {
    console.error(e)
  }
  finally {
    // @ts-ignore
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
  if (!delimiter) {
    delimiter = EOL
  }
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
      ? sendFavicon(response)
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
    return sendFile(path, response, this._mime)
  }
}

export {
  FsStatic,
  sendFile,
  sendFileSlow,
  sliceTextFile
}
