import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneConfig} from '../deploy/standalone/runtime-config.mjs';

test('standalone defaults preserve the main deployment paths, port, and listener', () => {
  assert.deepEqual(standaloneConfig({}), {
    root: '',
    appRoot: '/app',
    dataRoot: '/data',
    port: 4300,
    host: '0.0.0.0',
  });
});

test('local acceptance can opt into an isolated root, port, and loopback listener', () => {
  assert.deepEqual(standaloneConfig({
    PAYEASE_STANDALONE_ROOT: '/private/tmp/acceptance',
    PAYEASE_STANDALONE_PORT: '4331',
    PAYEASE_STANDALONE_HOST: '127.0.0.1',
  }), {
    root: '/private/tmp/acceptance',
    appRoot: '/private/tmp/acceptance/app',
    dataRoot: '/private/tmp/acceptance/data',
    port: 4331,
    host: '127.0.0.1',
  });
});
