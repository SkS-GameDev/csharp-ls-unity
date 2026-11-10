# csharp-ls-unity

[English version](README.md)

Небольшой stdio-прокси вокруг `csharp-ls`, который включает Unity-анализаторы.

`csharp-ls` читает `csharp.analyzersEnabled` из `workspace/didChangeConfiguration` и
`workspace/configuration`. OpenCode не отправляет ни то, ни другое, поэтому анализаторы
остаются выключенными даже при установленном `Microsoft.Unity.Analyzers`. Прокси:

- запускает `csharp-ls` и прозрачно пересылает LSP-поток;
- сразу после `initialized` отправляет `workspace/didChangeConfiguration` с
  `{ "csharp": { "analyzersEnabled": true } }`;
- сам отвечает на `workspace/configuration` для секции `csharp`;
- остальные запросы сервера пересылает клиенту.

## Установка

```sh
npm install -g csharp-ls-unity
```

`csharp-ls` должен быть в `PATH`. Бинарник переопределяется через `CSHARP_LS_BIN`,
внедряемые настройки — через `CSHARP_LS_SETTINGS` (JSON).

Из исходников: `npm link` в репозитории.

## OpenCode

```jsonc
"lsp": {
  "csharp": {
    "command": ["csharp-ls-unity"],
    "extensions": [".cs", ".csx"]
  }
}
```

## Тесты

```sh
npm test
```

Тест запускает прокси против `test/fixtures/fake-csharp-ls.mjs` и проверяет
внедрённую конфигурацию, ответ на `workspace/configuration` и пересылку сообщений.
