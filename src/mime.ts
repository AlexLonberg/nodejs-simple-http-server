import { testStartDot_, removeStartDot_ } from './utils.js'

// .md https://www.rfc-editor.org/rfc/rfc7763

const _extMap = {
  txt: { type: 'text', sub: 'plain', param: 'charset="utf-8"' },
  md: { type: 'text', sub: 'markdown', param: 'charset="utf-8"' },
  html: { type: 'text', sub: 'html', param: 'charset="utf-8"' },
  js: { type: 'text', sub: 'javascript', param: 'charset="utf-8"' },
  css: { type: 'text', sub: 'css', param: 'charset="utf-8"' },
  json: { type: 'application', sub: 'json', param: 'charset="utf-8"' },
  jpg: { type: 'image', sub: 'jpeg', param: null },
  jpeg: { type: 'image', sub: 'jpeg', param: null },
  png: { type: 'image', sub: 'png', param: null },
  webp: { type: 'image', sub: 'webp', param: null },
  bmp: { type: 'image', sub: 'bmp', param: null },
  gif: { type: 'image', sub: 'gif', param: null },
  ico: { type: 'image', sub: 'x-icon', param: null },
  svg: { type: 'image', sub: 'svg+xml', param: 'charset="utf-8"' },
  mp4: { type: 'video', sub: 'mp4', param: null },
  '3gp': { type: 'video', sub: '3gpp', param: null },
  m4v: { type: 'video', sub: 'mp4', param: null },
  webm: { type: 'video', sub: 'webm', param: null }
} as const

class ExtMime {
  protected _ext: string
  protected _extWithoutDot: string
  protected _type: string
  protected _subtype: string
  protected _parameters: null | string

  private _asStr: null | string = null
  toString: (() => string)

  constructor(ext: string, type: string, subtype: string, parameters?: undefined | null | string) {
    const extension = ext.trim().toLowerCase()
    if (testStartDot_(extension)) {
      this._ext = extension
      this._extWithoutDot = removeStartDot_(extension)
    }
    else {
      this._ext = `.${extension}`
      this._extWithoutDot = extension
    }
    this._type = type
    this._subtype = subtype
    this._parameters = parameters ?? null
    this.toString = this._toStringJoin
  }

  get ext (): string {
    return this._ext
  }
  get extWithoutDot (): string {
    return this._extWithoutDot
  }
  get type (): string {
    return this._type
  }
  get subtype (): string {
    return this._subtype
  }
  get parameters (): null | string {
    return this._parameters
  }

  private _toStringJoin (): string {
    const params = this._parameters ? `; ${this._parameters}` : ''
    this._asStr = `${this._type}/${this._subtype}${params}`
    this.toString = this._toString
    return this._asStr
  }

  private _toString (): string {
    return this._asStr!
  }
}

class Mime {
  protected _extMap = new Map<string, ExtMime>()

  constructor() {
    for (const key of Object.keys(_extMap) as (keyof typeof _extMap)[]) {
      this.register(key, _extMap[key].type, _extMap[key].sub, _extMap[key].param)
    }
  }

  register (ext: string, type: string, subtype: string, parameters?: undefined | null | string): void {
    const e = new ExtMime(ext, type, subtype, parameters)
    this._extMap.set(e.ext, e)
  }

  /**
   * Возвращает класс с типом MIME подходящий расширению `ext`.
   *
   * @param ext Расширение с точкой.
   */
  extMime (ext: string): ExtMime | null {
    return this._extMap.get(ext) ?? null
  }

  /**
   * Возвращает строку с типом MIME подходящий расширению `ext`.
   *
   * @param ext Расширение с точкой.
   */
  mimeOf (ext: string): string | null {
    return this._extMap.get(ext)?.toString() ?? null
  }

  typeOf (ext: string): string | null {
    return this._extMap.get(ext)?.type ?? null
  }

  subtypeOf (ext: string): string | null {
    return this._extMap.get(ext)?.subtype ?? null
  }

  parametersOf (ext: string): string | null {
    return this._extMap.get(ext)?.parameters ?? null
  }
}

export {
  ExtMime,
  Mime
}
