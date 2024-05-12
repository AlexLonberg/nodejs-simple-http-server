// DOC https://ru.wikipedia.org/wiki/Список_кодов_состояния_HTTP

const _statusCodes = [
  [200, 'Ok'],
  [204, 'No Content'],
  [400, 'Bad Request'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [520, 'Unknown Error']
] as const
type TStatusCodesEntries = typeof _statusCodes
type TStatusCodes = TStatusCodesEntries[number]
type TStatusCode = TStatusCodes[0]
type TStatusText = TStatusCodes[1]

class StatusCodes extends Map<TStatusCode, TStatusText> {
  constructor() {
    super(_statusCodes)
  }

  getOrDefault<T extends string> (code: number, defaultMessage?: undefined | null | T): TStatusText | T | 'Unknown' | 'Request Error' | 'Server Error' {
    return this.get(code as any) ?? defaultMessage ?? (code < 400 ? 'Unknown' : (code < 500 ? 'Request Error' : 'Server Error'))
  }
}

const statusCodes = new StatusCodes()

export {
  statusCodes
}
