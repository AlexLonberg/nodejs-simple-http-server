# Dev

Иконка [favicon.ico](favicon.ico) использовалась для получения `base64` файла [src/favicon.ts](../src/favicon.ts).

## Dependencies

    npm i -D typescript@latest
    // Инициализировать базовый tsconfig.json
    npx tsc --init

    // jest
    npm i -D ts-node@latest
    npm i -D jest ts-jest @types/jest
    // Инициализировать базовый jest.config.ts
    npx jest --init

    // eslint @^9.0.0
    npm i -D eslint@latest @eslint/js @stylistic/eslint-plugin
    // На момент установки версия typescript-eslint@7.6.0 конфликтовала с eslint@9.0.0
    // но вроде работает
    npm i -D typescript-eslint --legacy-peer-deps
    // Лучше не запускать эту команду 
    //   npx eslint --init
    // ... и настроить самостоятельно
