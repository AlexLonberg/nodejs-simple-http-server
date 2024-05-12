import type { TSimpleJsonResponse } from './types.js'
import { messageFromError } from './utils.js'

class SimpleJsonResponse<T = unknown> {
  ok = false
  data: null | T = null
  error: null | string = null

  toObject (): TSimpleJsonResponse<T> {
    return { ok: this.ok, data: this.data, error: this.error } as any
  }

  toJsonString (): string {
    return JSON.stringify(this.toObject())
  }

  static result<T = unknown> (value: T): SimpleJsonResponse<T> {
    const res = new SimpleJsonResponse<T>()
    res.ok = true
    res.data = value
    return res
  }

  static error<T = unknown> (message: string | Error | unknown): SimpleJsonResponse<T> {
    const res = new SimpleJsonResponse<T>()
    res.error = messageFromError(message) as unknown as string
    return res
  }
}

export {
  type TSimpleJsonResponse,
  SimpleJsonResponse
}
