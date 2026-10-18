'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const {
  PYTHON_ML_PRESETS,
  buildSandboxPolicyPython,
  formatPythonTerminalHtml,
  savePythonScratchpad,
  loadPythonScratchpad,
} = require('./python-playground-controller.js');

test('PYTHON_ML_PRESETS contains all 11 foundational Andrew Ng Machine Learning models', () => {
  assert.ok(Array.isArray(PYTHON_ML_PRESETS), 'PYTHON_ML_PRESETS must be an array');
  assert.equal(PYTHON_ML_PRESETS.length, 11, 'Must include exactly 11 Andrew Ng ML model presets');

  const expectedIds = [
    'linear-regression',
    'logistic-regression',
    'regularized-regression',
    'softmax-regression',
    'neural-network-mlp',
    'support-vector-machine',
    'decision-tree',
    'kmeans-clustering',
    'principal-component-analysis',
    'anomaly-detection',
    'collaborative-filtering'
  ];

  const actualIds = PYTHON_ML_PRESETS.map(p => p.id);
  assert.deepEqual(actualIds, expectedIds, 'Preset IDs must match expected 11 models');
});

test('Every Andrew Ng ML preset has configurable training rounds and metadata', () => {
  PYTHON_ML_PRESETS.forEach(preset => {
    assert.ok(preset.id, `Preset missing id`);
    assert.ok(preset.title, `Preset ${preset.id} missing title`);
    assert.ok(preset.description, `Preset ${preset.id} missing description`);
    assert.ok(preset.category, `Preset ${preset.id} missing category`);
    assert.equal(preset.configurableTraining, true, `Preset ${preset.id} must have configurableTraining=true`);
    assert.ok(typeof preset.defaultRounds === 'number' && preset.defaultRounds > 0, `Preset ${preset.id} must have defaultRounds > 0`);

    // Verify code presence and configurable training round comment
    assert.ok(preset.code.length > 200, `Preset ${preset.id} code is too short`);
    const hasConfig = preset.code.includes('ROUNDS_OF_TRAINING') ||
                      preset.code.includes('MAX_DEPTH') ||
                      preset.code.includes('N_COMPONENTS') ||
                      preset.code.includes('EPSILON_THRESHOLD');
    assert.ok(hasConfig, `Preset ${preset.id} must define a top-level configurable parameter`);
  });
});

test('Every Andrew Ng ML preset implements raw math in NumPy and production in Scikit-Learn', () => {
  PYTHON_ML_PRESETS.forEach(preset => {
    // Check NumPy from scratch
    assert.ok(preset.code.includes('import numpy as np'), `Preset ${preset.id} must import numpy`);
    assert.ok(preset.code.includes('[Part A'), `Preset ${preset.id} must have [Part A - Raw NumPy implementation]`);

    // Check Scikit-Learn comparison
    assert.ok(preset.code.includes('sklearn') || preset.code.includes('scikit-learn'), `Preset ${preset.id} must include sklearn comparison`);
    assert.ok(preset.code.includes('[Part B'), `Preset ${preset.id} must have [Part B - Scikit-Learn comparison]`);
  });
});

test('Offline sandbox policy strictly blocks pip and micropip', () => {
  const policyCode = buildSandboxPolicyPython();
  assert.ok(policyCode.includes('BlockedPip'), 'Sandbox policy must define BlockedPip');
  assert.ok(policyCode.includes("sys.modules['pip']"), "Policy must intercept sys.modules['pip']");
  assert.ok(policyCode.includes("sys.modules['micropip']"), "Policy must intercept sys.modules['micropip']");
  assert.ok(policyCode.includes('Offline Sandbox Policy'), 'Policy must return descriptive offline policy error');
});

test('savePythonScratchpad and loadPythonScratchpad persist and retrieve code', () => {
  // Mock localStorage in Node environment
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
  };

  const testCode = '# My custom model\nimport numpy as np\nprint("Test")\n';
  const saved = savePythonScratchpad(testCode, 'test-preset');
  assert.equal(saved, true);

  const loaded = loadPythonScratchpad('test-preset');
  assert.equal(loaded, testCode);

  assert.equal(loadPythonScratchpad('non-existent'), null);
});

test('formatPythonTerminalHtml formats success and error terminal views cleanly', () => {
  const successHtml = formatPythonTerminalHtml(
    [{ type: 'info', text: 'NumPy Linear Regression finished.' }],
    null,
    45
  );
  assert.ok(successHtml.includes('✔ EXECUTION SUCCESS'), 'Must show execution success banner');
  assert.ok(successHtml.includes('⏱ 45ms'), 'Must show duration');
  assert.ok(successHtml.includes('NumPy Linear Regression finished.'), 'Must contain log line');

  const errorHtml = formatPythonTerminalHtml(
    [{ type: 'error', text: 'Traceback: ZeroDivisionError' }],
    'ZeroDivisionError',
    12
  );
  assert.ok(errorHtml.includes('❌ EXECUTION FAILED'), 'Must show failure banner');
  assert.ok(errorHtml.includes('ZeroDivisionError'), 'Must contain error text');
});

test('Offline Pyodide runtime bundles core assets, NumPy, SciPy, and Scikit-Learn wheels locally', () => {
  const pyodideDistDir = path.join(__dirname, 'dist', 'pyodide');
  assert.ok(fs.existsSync(pyodideDistDir), 'dist/pyodide/ directory must exist');

  const requiredFiles = [
    'pyodide.js',
    'pyodide.asm.js',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
    'openblas-0.3.26.zip',
    'numpy-1.26.4-cp312-cp312-pyodide_2024_0_wasm32.whl',
    'scipy-1.12.0-cp312-cp312-pyodide_2024_0_wasm32.whl',
    'joblib-1.4.0-py3-none-any.whl',
    'threadpoolctl-3.4.0-py3-none-any.whl',
    'scikit_learn-1.4.2-cp312-cp312-pyodide_2024_0_wasm32.whl'
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(pyodideDistDir, file);
    assert.ok(fs.existsSync(fullPath), `dist/pyodide/${file} must exist`);
    assert.ok(fs.statSync(fullPath).size > 1000, `dist/pyodide/${file} must not be empty`);
  });
});

test('Verifies python-worker.js and python-playground-controller.js parse with zero syntax errors', () => {
  const workerPath = path.join(__dirname, 'python-worker.js');
  const controllerPath = path.join(__dirname, 'python-playground-controller.js');

  const workerCode = fs.readFileSync(workerPath, 'utf8');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');

  assert.doesNotThrow(() => {
    new vm.Script(workerCode, { filename: 'python-worker.js' });
  }, 'python-worker.js must parse with zero syntax errors');

  assert.doesNotThrow(() => {
    new vm.Script(controllerCode, { filename: 'python-playground-controller.js' });
  }, 'python-playground-controller.js must parse with zero syntax errors');
});
