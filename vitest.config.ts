/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Конфигурация для тестирования в NodeJS
// Пример комментария для игнорирования @vitest/coverage-v8 https://vitest.dev/guide/coverage.html#ignoring-code
//   /* v8 ignore next 3 */
// правда в редакторе я не вижу эффекта.
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts'
    ],
    // https://vitest.dev/guide/coverage.html
    coverage: {
      enabled: true,
      // Без этой опции использует корень проекта.
      include: ['src/**/*.ts'],
      provider: 'v8',
      reportsDirectory: '.temp/coverage'
    }
  }
})
