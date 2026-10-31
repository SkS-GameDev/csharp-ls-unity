#!/usr/bin/env node

import { spawn } from 'node:child_process';

const settings = process.env.CSHARP_LS_SETTINGS
  ? JSON.parse(process.env.CSHARP_LS_SETTINGS)
  : { csharp: { analyzersEnabled: true } };

const child = spawn(process.env.CSHARP_LS_BIN ?? 'csharp-ls', [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});
child.stderr.pipe(process.stderr);
child.on('error', (error) => {
  process.stderr.write(`csharp-ls-unity: failed to start ${process.env.CSHARP_LS_BIN ?? 'csharp-ls'}: ${error.message}\n`);
  process.exit(1);
});

let childClosed = false;
child.on('exit', (code, signal) => {
  childClosed = true;
  process.exit(code ?? (signal ? 1 : 0));
});

function write(stream, message) {
  if (stream.destroyed || stream.writableEnded) return;
  const body = JSON.stringify(message);
  stream.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function toChild(message) {
  write(child.stdin, message);
}

function toClient(message) {
  write(process.stdout, message);
}

function frame(stream, onMessage) {
  let buffer = Buffer.alloc(0);
  stream.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString();
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1]);
      if (!Number.isFinite(length)) {
        buffer = Buffer.alloc(0);
        return;
      }
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.subarray(start, start + length).toString();
      buffer = buffer.subarray(start + length);
      try {
        onMessage(JSON.parse(body));
      } catch (error) {
        process.stderr.write(`csharp-ls-unity: invalid message: ${error.message}\n`);
      }
    }
  });
}

frame(process.stdin, (message) => {
  if (message.method === 'initialized') {
    toChild(message);
    toChild({
      jsonrpc: '2.0',
      method: 'workspace/didChangeConfiguration',
      params: { settings },
    });
    return;
  }
  if (message.method === 'exit') {
    toChild(message);
    if (!childClosed) child.stdin.end();
    setTimeout(() => process.exit(0), 200);
    return;
  }
  toChild(message);
});

frame(child.stdout, (message) => {
  if (message.id !== undefined && message.method) {
    if (message.method === 'workspace/configuration') {
      const items = message.params?.items ?? [];
      toChild({
        jsonrpc: '2.0',
        id: message.id,
        result: items.map((item) => (item.section === 'csharp' ? settings.csharp : null)),
      });
      return;
    }
    toClient(message);
    return;
  }
  toClient(message);
});

process.stdin.on('end', () => {
  if (!childClosed) child.stdin.end();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!childClosed) child.kill(signal);
    process.exit(0);
  });
}
