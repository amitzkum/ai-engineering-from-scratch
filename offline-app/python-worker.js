'use strict';

/**
 * Offline Python Web Worker
 * Runs Pyodide v0.26.4 with pre-bundled NumPy, SciPy, and Scikit-Learn
 * in a dedicated background worker thread with 0 external network dependencies.
 *
 * Attribution:
 * - App Architecture & Python Worker: Amit Kumar
 * - Curriculum & Algorithms: AI Engineering from Scratch Contributors
 */

let pyodideInstance = null;
let isInitializing = false;
let initPromise = null;

const SANDBOX_POLICY = `
import sys
import io

class OfflinePolicyError(PermissionError):
    pass

class BlockedPip:
    @staticmethod
    def install(*args, **kwargs):
        raise OfflinePolicyError(
            "Offline Sandbox Policy: 'pip install' is disabled in offline mode. "
            "Only pre-bundled packages (numpy, scipy, scikit-learn, and Python standard library) are allowed."
        )
    def __getattr__(self, name):
        raise OfflinePolicyError(
            "Offline Sandbox Policy: 'pip install' is disabled in offline mode. "
            "Only pre-bundled packages (numpy, scipy, scikit-learn, and Python standard library) are allowed."
        )

sys.modules['pip'] = BlockedPip()
sys.modules['micropip'] = BlockedPip()
`;

async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    isInitializing = true;
    try {
      if (typeof importScripts === 'function') {
        importScripts('pyodide/pyodide.js');
      }

      if (typeof loadPyodide !== 'function') {
        throw new Error('Pyodide failed to load from local assets (pyodide/pyodide.js).');
      }

      self.postMessage({ type: 'status', message: 'Initializing Python 3.12 engine...' });
      const pyodide = await loadPyodide({
        indexURL: 'pyodide/'
      });

      self.postMessage({ type: 'status', message: 'Loading pre-bundled NumPy, SciPy & Scikit-Learn...' });
      await pyodide.loadPackage(['numpy', 'scipy', 'scikit-learn']);

      // Enforce zero-network offline sandbox policy
      pyodide.runPython(SANDBOX_POLICY);

      pyodideInstance = pyodide;
      isInitializing = false;
      self.postMessage({ type: 'ready' });
      return pyodide;
    } catch (err) {
      isInitializing = false;
      initPromise = null;
      self.postMessage({ type: 'init_error', error: err.message || String(err) });
      throw err;
    }
  })();

  return initPromise;
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'init') {
      try {
        await getPyodide();
      } catch (err) {
        // Error already posted
      }
      return;
    }

    if (data.type === 'run') {
      const code = data.code || '';
      const runId = data.id || 'default';
      const startTime = Date.now();

      try {
        const pyodide = await getPyodide();

        // Prepare execution wrapper with captured stdout/stderr
        const wrappedCode = `
import sys
import io

__output_buffer = io.StringIO()
__old_stdout = sys.stdout
__old_stderr = sys.stderr
sys.stdout = __output_buffer
sys.stderr = __output_buffer

try:
${code.split('\n').map(l => '    ' + l).join('\n')}
finally:
    sys.stdout = __old_stdout
    sys.stderr = __old_stderr
    __captured_output = __output_buffer.getvalue()
`;

        pyodide.runPython(wrappedCode);
        const rawOutput = pyodide.globals.get('__captured_output') || '';
        const durationMs = Date.now() - startTime;

        const lines = rawOutput.split('\n');
        // If last line is empty due to trailing newline, remove it
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }

        const logs = lines.map(line => ({
          type: line.toLowerCase().includes('error') ? 'warn' : 'info',
          text: line
        }));

        self.postMessage({
          type: 'result',
          id: runId,
          logs,
          error: null,
          durationMs
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        let errMsg = err.message || String(err);

        // Extract clean traceback if present
        const logs = [];
        if (errMsg.includes('Traceback')) {
          logs.push({ type: 'error', text: errMsg });
        } else {
          logs.push({ type: 'error', text: `Python Error: ${errMsg}` });
        }

        self.postMessage({
          type: 'result',
          id: runId,
          logs,
          error: errMsg,
          durationMs
        });
      }
    }
  });
}
