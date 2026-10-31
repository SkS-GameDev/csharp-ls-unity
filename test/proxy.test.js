import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proxy = path.join(here, '..', 'bin', 'csharp-ls-unity.js');
const fake = path.join(here, 'fixtures', 'fake-csharp-ls.mjs');

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

describe('csharp-ls-unity proxy', () => {
  it('injects analyzer settings and answers workspace/configuration', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'csharp-ls-unity-'));
    const log = path.join(dir, 'messages.jsonl');
    const child = spawn(process.execPath, [proxy], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CSHARP_LS_BIN: fake, FAKE_LOG: log },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stdin.write(
      frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: process.pid, rootUri: null, capabilities: {} } })
    );
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'initialized', params: {} }));

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !output.includes('settings-received')) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(output, /"id":1,"result":\{"capabilities":\{"hoverProvider":true\}\}/);
    assert.ok(existsSync(log), 'fake server should log messages');

    const messages = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const change = messages.find((message) => message.method === 'workspace/didChangeConfiguration');
    assert.equal(change?.params?.settings?.csharp?.analyzersEnabled, true);
    const configuration = messages.find((message) => message.id === 100 && message.result);
    assert.equal(configuration?.result?.[0]?.analyzersEnabled, true);

    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'shutdown', params: null }));
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'exit', params: null }));
    if (child.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
    child.kill('SIGKILL');
  });
});
