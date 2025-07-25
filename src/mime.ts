import { testStartDot, removeStartDot } from './utils.js'

// .md https://www.rfc-editor.org/rfc/rfc7763

const extTypeMap = {
  txt: 'text',
  md: 'text',
  html: 'text',
  js: 'text',
  css: 'text',
  json: 'application',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  bmp: 'image',
  gif: 'image',
  ico: 'image',
  svg: 'image'
}

const extSubtypeMap = {
  txt: 'plain',
  md: 'markdown',
  html: 'html',
  js: 'javascript',
  css: 'css',
  json: 'json',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  bmp: 'bmp',
  gif: 'gif',
  ico: 'x-icon',
  svg: 'svg+xml'
}

const extParamMap = {
  txt: 'charset="utf-8"',
  md: 'charset="utf-8"',
  html: 'charset="utf-8"',
  js: 'charset="utf-8"',
  css: 'charset="utf-8"',
  json: 'charset="utf-8"',
  jpg: null,
  jpeg: null,
  png: null,
  webp: null,
  bmp: null,
  gif: null,
  ico: null,
  svg: 'charset="utf-8"'
}

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
    if (testStartDot(extension)) {
      this._ext = extension
      this._extWithoutDot = removeStartDot(extension)
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
    for (const key of Object.keys(extTypeMap) as (keyof typeof extTypeMap)[]) {
      this.register(key, extTypeMap[key], extSubtypeMap[key], extParamMap[key])
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
