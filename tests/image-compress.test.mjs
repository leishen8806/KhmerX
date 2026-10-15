import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

function loadModule() {
  const source = readFileSync(new URL('../lib/image-compress.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const exports = {};
  vm.runInNewContext(js, {exports, console, Math});
  return exports;
}

test('image limits distinguish PDF from image', () => {
  const helper = loadModule();
  assert.equal(helper.fileLimitBytes(new Blob(['x'], {type: 'image/jpeg'})), 5 * 1024 * 1024);
  assert.equal(helper.fileLimitBytes(new Blob(['x'], {type: 'application/pdf'})), 10 * 1024 * 1024);
  assert.equal(helper.fileLimitLabel(new Blob(['x'], {type: 'application/pdf'})), '10 MB');
});

test('fitWithinBounds keeps small images and scales the long edge', () => {
  const helper = loadModule();
  const small = helper.fitWithinBounds(800, 600);
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);
  const scaled = helper.fitWithinBounds(4000, 2000);
  assert.equal(scaled.width, 1600);
  assert.equal(scaled.height, 800);
});

test('retry-after is capped at five seconds and fallback is bounded', () => {
  const helper = loadModule();
  assert.equal(helper.retryAfterMs({retryAfterSeconds: 20}, 0), 5000);
  const fallback = helper.retryAfterMs({}, 2);
  assert.ok(fallback >= 2000 && fallback <= 2250);
});
