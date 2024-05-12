import { exec } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { SimpleJsonResponse } from './SimpleJsonResponse.js'
import { messageFromError, forwardSlashes } from './utils.js'

// TODO Функционал открытия файла в последнем использованном каталоге не реализована.
function openDirectoryDialog (): Promise<SimpleJsonResponse<string>> {
  return new Promise((res) => {
    exec('PowerShell -Command "$folder = (New-Object -ComObject Shell.Application).BrowseForFolder(0, \'Select Folder\', 0); if ($folder) { $folder.Self.Path }"', (error, stdout, _stderr) => {
      if (error) {
        console.error('Exec error:', error)
        res(SimpleJsonResponse.error(`Exec error: ${messageFromError(error)}`))
      }
      else if (stdout) {
        try {
          const path = forwardSlashes(stdout.trim())
          if (lstatSync(path).isDirectory()) {
            console.log('Selected directory path:', path)
            res(SimpleJsonResponse.result(path))
            return
          }
          else {
            throw new Error(`Путь "${path}" не является директорией.`)
          }
        } catch (e) {
          console.error('Ошибка выбора каталога:', e)
          SimpleJsonResponse.error(`Ошибка выбора каталога: ${messageFromError(e)}`)
        }
      }
      else {
        console.log('Выбор каталога отменен.')
        res(SimpleJsonResponse.error('Выбор каталога отменен.'))
      }
    })
  })
}

export {
  openDirectoryDialog
}
