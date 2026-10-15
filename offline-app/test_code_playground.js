'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CURRICULUM_PRESETS,
  executeSandboxCode,
  saveScratchpad,
  loadScratchpad,
  formatTerminalHtml,
} = require('./playground-controller.js');

test('CURRICULUM_PRESETS contains foundational AI engineering algorithms', () => {
  assert.ok(Array.isArray(CURRICULUM_PRESETS), 'Presets must be an array');
  assert.ok(CURRICULUM_PRESETS.length >= 5, 'Must contain at least 5 presets');

  const ids = CURRICULUM_PRESETS.map(p => p.id);
  assert.ok(ids.includes('attention-mechanism'), 'Must include attention mechanism preset');
  assert.ok(ids.includes('linear-regression'), 'Must include linear regression preset');
  assert.ok(ids.includes('cosine-similarity'), 'Must include cosine similarity preset');
  assert.ok(ids.includes('bpe-tokenizer'), 'Must include BPE tokenizer preset');
  assert.ok(ids.includes('react-agent-loop'), 'Must include ReAct agent loop preset');

  CURRICULUM_PRESETS.forEach(preset => {
    assert.ok(preset.title, 'Preset must have title');
    assert.ok(preset.code && preset.code.length > 50, 'Preset must have non-empty code');
    assert.equal(preset.language, 'javascript');
  });
});

test('executeSandboxCode runs JavaScript algorithms and captures console output', () => {
  const code = `
    const a = 10;
    const b = 20;
    console.log("Sum:", a + b);
    console.warn("Test warning");
  `;

  const result = executeSandboxCode(code, 'javascript');
  assert.equal(result.error, null, 'Must have zero error');
  assert.ok(result.durationMs >= 0, 'Must record execution time');
  assert.equal(result.logs.length, 2, 'Must capture 2 log lines');
  assert.equal(result.logs[0].type, 'log');
  assert.equal(result.logs[0].text, 'Sum: 30');
  assert.equal(result.logs[1].type, 'warn');
  assert.equal(result.logs[1].text, 'Test warning');
});

test('executeSandboxCode safely traps runtime exceptions and syntax errors', () => {
  const code = `
    console.log("Before error");
    const obj = null;
    obj.foo();
  `;

  const result = executeSandboxCode(code, 'javascript');
  assert.ok(result.error, 'Must capture runtime error');
  assert.match(result.error, /null|property/i, 'Error message must reflect TypeError');
  assert.ok(result.logs.length >= 2, 'Logs must include pre-error log and error message');
  assert.equal(result.logs[result.logs.length - 1].type, 'error');
});

test('executeSandboxCode executes curriculum preset algorithms successfully', () => {
  CURRICULUM_PRESETS.forEach(preset => {
    const result = executeSandboxCode(preset.code, 'javascript');
    assert.equal(
      result.error,
      null,
      `Preset ${preset.id} must execute with zero errors, got: ${result.error}`
    );
    assert.ok(result.logs.length > 0, `Preset ${preset.id} must produce stdout output`);
  });
});

test('saveScratchpad and loadScratchpad persist and retrieve code', () => {
  // Mock localStorage for Node test environment
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
  };

  const testCode = 'console.log("Hello from scratchpad test");';
  const saved = saveScratchpad(testCode, 'test-preset');
  assert.equal(saved, true);

  const loaded = loadScratchpad('test-preset');
  assert.equal(loaded, testCode);

  const missing = loadScratchpad('non-existent');
  assert.equal(missing, null);
});

test('formatTerminalHtml formats success and error terminal views cleanly', () => {
  const logs = [
    { type: 'log', text: 'Attention Score: 0.95' },
    { type: 'error', text: 'Dimension mismatch: 4 != 8' },
  ];

  const htmlSuccess = formatTerminalHtml(logs.slice(0, 1), null, 12);
  assert.ok(htmlSuccess.includes('EXECUTION SUCCESS'));
  assert.ok(htmlSuccess.includes('12ms'));
  assert.ok(htmlSuccess.includes('Attention Score: 0.95'));

  const htmlError = formatTerminalHtml(logs, 'Dimension mismatch', 4);
  assert.ok(htmlError.includes('EXECUTION FAILED'));
  assert.ok(htmlError.includes('log-err'));
  assert.ok(htmlError.includes('Dimension mismatch: 4 != 8'));
});
