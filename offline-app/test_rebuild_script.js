'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getVersionInfo, setupEnvironment, computeSha256 } = require('../scripts/rebuild_release.js');

test('getVersionInfo calculates minor version increments deterministically', () => {
  const vInfo = getVersionInfo();
  assert.ok(vInfo.currentVersion, 'Must detect current version');
  assert.ok(vInfo.currentCode >= 1, 'Must detect current versionCode');
  assert.equal(vInfo.nextCode, vInfo.currentCode + 1, 'nextCode must be currentCode + 1');

  // Verify minor increment format
  const parts = vInfo.currentVersion.split('.').map(Number);
  const expectedNext = `${parts[0]}.${parts[1] + 1}.0`;
  assert.equal(vInfo.nextVersion, expectedNext, `Auto-increment must be ${expectedNext}`);
});

test('getVersionInfo respects explicit custom version arguments', () => {
  const vExplicit = getVersionInfo('2.0.0');
  assert.equal(vExplicit.nextVersion, '2.0.0');

  const vWithV = getVersionInfo('v1.5.0');
  assert.equal(vWithV.nextVersion, '1.5.0');
});

test('setupEnvironment verifies Android SDK and Java 21 paths', () => {
  const env = setupEnvironment();
  assert.ok(env.ANDROID_HOME, 'ANDROID_HOME must be defined');
  assert.ok(fs.existsSync(env.ANDROID_HOME), 'ANDROID_HOME path must exist');
  assert.ok(env.JAVA_HOME, 'JAVA_HOME must be defined');
  assert.ok(fs.existsSync(env.JAVA_HOME), 'JAVA_HOME path must exist');
  assert.ok(env.PATH.includes(env.JAVA_HOME), 'PATH must contain JAVA_HOME/bin');
});

test('computeSha256 generates valid 64-character hex digest', () => {
  const pkgPath = path.join(__dirname, 'package.json');
  const checksum = computeSha256(pkgPath);
  assert.equal(typeof checksum, 'string');
  assert.equal(checksum.length, 64, 'SHA-256 must be 64 hex characters');
  assert.match(checksum, /^[a-f0-9]{64}$/, 'Must contain only lowercase hex digits');
});
