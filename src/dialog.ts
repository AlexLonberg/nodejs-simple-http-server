import { exec } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { messageFromError, forwardSlashes_ } from './utils.js'

/**
 * Открывает диалоговое окно для выбора каталога.
 */
function openDirectoryDialog (): Promise<{ ok: boolean, value?: null | string, error?: null | string }> {
  // Команда PowerShell(вместо pwsh.exe) откроет старый интерфейс в маленьком окошечке.
  const command = 'pwsh.exe -Command "Add-Type -AssemblyName System.Windows.Forms; $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog; if ($folderBrowser.ShowDialog() -eq \'OK\') { $folderBrowser.SelectedPath }"'
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Если пользователь отменил диалог, код ошибки часто не 0, но stdout и stderr пустые.
        // Это не настоящая ошибка.
        if (error.code !== 0 && !stdout && !stderr) {
          console.log('Выбор каталога отменен.')
          resolve({ ok: false, error: 'Выбор каталога отменен.' })
          return
        }
        console.error('Exec error:', error)
        resolve({ ok: false, error: `Exec error: ${messageFromError(error)}` })
        return
      }

      const path = stdout.trim()
      if (path) {
        try {
          const normalizedPath = forwardSlashes_(path)
          if (lstatSync(normalizedPath).isDirectory()) {
            console.log('Selected directory path:', normalizedPath)
            resolve({ ok: true, value: normalizedPath })
          } else {
            throw new Error(`Путь "${normalizedPath}" не является директорией.`)
          }
        } catch (e) {
          console.error('Ошибка проверки каталога:', e)
          resolve({ ok: false, error: `Ошибка проверки каталога: ${messageFromError(e)}` })
        }
      } else {
        console.log('Выбор каталога отменен.')
        resolve({ ok: false, error: 'Выбор каталога отменен.' })
      }
    })
  })
}

/**
 * Открывает диалоговое окно для выбора файла.
 *
 * @param option Пример: `{title: 'Select a File', filter: 'Text Files (*.txt)|*.txt|All Files (*.*)|*.*'}
 */
function openFileDialog (option?: undefined | null | { title?: string, filter?: string }): Promise<{ ok: boolean, value?: null | string, error?: null | string }> {
  const title = option?.title ?? 'Select a File'
  const filter = option?.filter ?? 'All files (*.*)|*.*'
  const command = `pwsh.exe -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Title = '${title}'; $dialog.Filter = '${filter}'; if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName }"`
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Если пользователь отменил диалог, код ошибки часто не 0, но stdout и stderr пустые.
        // Это не настоящая ошибка.
        if (error.code !== 0 && !stdout && !stderr) {
          console.log('Выбор файла отменен.')
          resolve({ ok: false, error: 'Выбор файла отменен.' })
          return
        }
        console.error('Exec error:', error)
        resolve({ ok: false, error: `Exec error: ${messageFromError(error)}` })
        return
      }

      const path = stdout.trim()
      if (path) {
        try {
          const normalizedPath = forwardSlashes_(path)
          if (lstatSync(normalizedPath).isFile()) {
            console.log('Selected directory path:', normalizedPath)
            resolve({ ok: true, value: normalizedPath })
          } else {
            throw new Error(`Путь "${normalizedPath}" не является файлом.`)
          }
        } catch (e) {
          console.error('Ошибка проверки файла:', e)
          resolve({ ok: false, error: `Ошибка проверки файла: ${messageFromError(e)}` })
        }
      } else {
        console.log('Выбор файла отменен.')
        resolve({ ok: false, error: 'Выбор файла отменен.' })
      }
    })
  })
}

export {
  openDirectoryDialog,
  openFileDialog
}

// NOTE Этот диалог так же работает(в другом окне) и оставлен для примера.
// function _openDirectoryDialog (): Promise<{ ok: boolean, value?: null | string, error?: null | string }> {
//   return new Promise((res) => {
//     exec('PowerShell -Command "$folder = (New-Object -ComObject Shell.Application).BrowseForFolder(0, \'Select Folder\', 0); if ($folder) { $folder.Self.Path }"', (error, stdout, _stderr) => {
//       if (error) {
//         console.error('Exec error:', error)
//         res({ ok: false, error: `Exec error: ${messageFromError(error)}` })
//       }
//       else if (stdout) {
//         try {
//           const path = forwardSlashes_(stdout.trim())
//           if (lstatSync(path).isDirectory()) {
//             console.log('Selected directory path:', path)
//             res({ ok: true, value: path })
//           }
//           else {
//             throw new Error(`Путь "${path}" не является директорией.`)
//           }
//         } catch (e) {
//           console.error('Ошибка выбора каталога:', e)
//           res({ ok: false, error: `Ошибка выбора каталога: ${messageFromError(e)}` })
//         }
//       }
//       else {
//         console.log('Выбор каталога отменен.')
//         res({ ok: false, error: 'Выбор каталога отменен.' })
//       }
//     })
//   })
// }
