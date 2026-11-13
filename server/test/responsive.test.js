import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const ts = require('typescript');
test('zero SSR dimensions cannot collapse auth controls and later viewport sizes are not cached', () => {
  let dimensions = { width: 0, height: 0 };
  const source = ts.transpileModule(readFileSync(new URL('../../client/src/utils/responsive.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: name => { assert.equal(name, 'react-native'); return { Dimensions: { get: () => dimensions } }; } };
  vm.runInNewContext(source, context);
  assert.equal(context.exports.verticalScale(54), 54);
  assert.equal(context.exports.scale(24), 24);
  dimensions = { width: 750, height: 1624 };
  assert.equal(context.exports.verticalScale(54), 108);
  assert.equal(context.exports.scale(24), 48);
  dimensions = { width: NaN, height: undefined };
  assert.equal(context.exports.verticalScale(54), 54);
});
