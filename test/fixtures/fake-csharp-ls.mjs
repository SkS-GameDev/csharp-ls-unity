#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const log = process.env.FAKE_LOG;
let buffer = Buffer.alloc(0);

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function logMessage(message) {
  if (log) appendFileSync(log, JSON.stringify(message) + '\n');
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const message = JSON.parse(buffer.subarray(start, start + length).toString());
    buffer = buffer.subarray(start + length);
    logMessage(message);
    handle(message);
  }
});

function handle(message) {
  if (message.method === 'initialize') {
    send({ jsonrpc: '2.0', id: message.id, result: { capabilities: { hoverProvider: true } } });
    return;
  }
  if (message.method === 'initialized') {
    send({ jsonrpc: '2.0', id: 100, method: 'workspace/configuration', params: { items: [{ section: 'csharp' }] } });
    return;
  }
  if (message.method === 'workspace/didChangeConfiguration') {
    send({ jsonrpc: '2.0', method: 'window/logMessage', params: { type: 3, message: 'settings-received' } });
    return;
  }
  if (message.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: message.id, result: null });
    return;
  }
  if (message.method === 'exit') {
    process.exit(0);
  }
  if (message.id !== undefined && message.method === undefined) {
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: '2.0', id: message.id, result: null });
  }
}
