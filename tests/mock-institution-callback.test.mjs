import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function runCallback(args) {
  const received = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => { received.push(JSON.parse(body)); response.writeHead(200); response.end('{}'); });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const child = spawn(process.execPath, ['scripts/mock-institution/server.mjs', 'callback', '--target', `http://127.0.0.1:${address.port}/callback`, '--partner-id', 'partner-test', '--secret', 'test-secret', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  const [result] = await once(child, 'close');
  await new Promise(resolve => server.close(resolve));
  assert.equal(result, 0);
  assert.equal(received.length, 1);
  return received[0];
}

test('callback defaults to public applicationId without internal loanId', async () => {
  const body = await runCallback(['--application-id', 'O123PUBLIC']);
  assert.equal(body.applicationId, 'O123PUBLIC');
  assert.equal(Object.hasOwn(body, 'loanId'), false);
});

test('callback includes loanId only when explicitly requested', async () => {
  const body = await runCallback(['--application-id', 'O123PUBLIC', '--loan-id', 'internal-loan-id']);
  assert.equal(body.applicationId, 'O123PUBLIC');
  assert.equal(body.loanId, 'internal-loan-id');
});
