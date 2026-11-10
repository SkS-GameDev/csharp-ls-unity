# csharp-ls-unity

[Русская версия](README.ru.md)

A small stdio proxy around `csharp-ls` that enables the Unity analyzers.

`csharp-ls` reads `csharp.analyzersEnabled` from `workspace/didChangeConfiguration` and
`workspace/configuration`. OpenCode sends neither, so the analyzers stay disabled even
when `Microsoft.Unity.Analyzers` is installed. The proxy:

- starts `csharp-ls` and transparently forwards the LSP stream;
- right after `initialized` sends `workspace/didChangeConfiguration` with
  `{ "csharp": { "analyzersEnabled": true } }`;
- answers `workspace/configuration` itself for the `csharp` section;
- forwards the server's remaining requests to the client.

## Installation

```sh
npm install -g csharp-ls-unity
```

`csharp-ls` must be in `PATH`. The binary is overridden via `CSHARP_LS_BIN`,
the injected settings — via `CSHARP_LS_SETTINGS` (JSON).

From source: `npm link` in the repository.

## OpenCode

```jsonc
"lsp": {
  "csharp": {
    "command": ["csharp-ls-unity"],
    "extensions": [".cs", ".csx"]
  }
}
```

## Tests

```sh
npm test
```

The test runs the proxy against `test/fixtures/fake-csharp-ls.mjs` and checks the
injected configuration, the reply to `workspace/configuration`, and message forwarding.
