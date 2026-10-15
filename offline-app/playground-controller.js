'use strict';

/**
 * Offline Code Playground Controller
 * Provides interactive sandbox execution, curriculum algorithm presets,
 * and scratchpad persistence for AI Engineering from Scratch.
 *
 * Attribution:
 * - App Packaging & Architecture: Amit Kumar
 * - Curriculum Algorithms & Source: AI Engineering from Scratch Contributors
 */

const CURRICULUM_PRESETS = [
  {
    id: 'attention-mechanism',
    title: 'Self-Attention from Raw Math (Phase 04)',
    language: 'javascript',
    description: 'Computes scaled dot-product attention softmax(QK^T / sqrt(d_k)) * V from scratch.',
    code: `// Scaled Dot-Product Attention from Raw Math
// Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V

function matrixMultiply(A, B) {
  const rowsA = A.length, colsA = A[0].length;
  const rowsB = B.length, colsB = B[0].length;
  if (colsA !== rowsB) throw new Error(\`Shape mismatch: \${colsA} != \${rowsB}\`);

  const result = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function transpose(A) {
  const rows = A.length, cols = A[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

function softmax2D(matrix) {
  return matrix.map(row => {
    const maxVal = Math.max(...row);
    const expRow = row.map(v => Math.exp(v - maxVal));
    const sumExp = expRow.reduce((a, b) => a + b, 0);
    return expRow.map(v => v / sumExp);
  });
}

// 1. Define Query, Key, Value vectors for 3 tokens with embedding dimension d_k = 4
const Q = [
  [0.5, 0.2, 0.8, 0.1], // Token 0: "The"
  [0.1, 0.9, 0.3, 0.7], // Token 1: "neural"
  [0.8, 0.4, 0.6, 0.9]  // Token 2: "network"
];

const K = [
  [0.6, 0.1, 0.7, 0.2],
  [0.2, 0.8, 0.4, 0.6],
  [0.7, 0.3, 0.5, 0.8]
];

const V = [
  [1.0, 0.0],
  [0.0, 1.0],
  [1.0, 1.0]
];

const d_k = 4;
const scale = Math.sqrt(d_k);

console.log("=== Scaled Dot-Product Attention ===");
console.log("Token Count:", Q.length, "Embedding Dim (d_k):", d_k);

// 2. Compute Q * K^T
const KT = transpose(K);
const rawScores = matrixMultiply(Q, KT);

// 3. Scale by sqrt(d_k)
const scaledScores = rawScores.map(row => row.map(val => val / scale));

// 4. Compute attention weights via Softmax
const attentionWeights = softmax2D(scaledScores);
console.log("\\nAttention Weights Matrix (Softmax):");
attentionWeights.forEach((row, i) => {
  console.log(\` Token \${i} attention:\`, row.map(w => w.toFixed(4)).join("  "));
});

// 5. Multiply weights by Values (V)
const contextOutput = matrixMultiply(attentionWeights, V);
console.log("\\nContext Output (Attention * V):");
contextOutput.forEach((row, i) => {
  console.log(\` Token \${i} output:\`, row.map(v => v.toFixed(4)).join("  "));
});
`
  },
  {
    id: 'linear-regression',
    title: 'Gradient Descent from Scratch (Phase 01)',
    language: 'javascript',
    description: 'Implements mean squared error and gradient descent optimization for linear regression.',
    code: `// Gradient Descent Linear Regression from Scratch
// Model: y = w * x + b
// Loss: MSE = (1/N) * sum((y_pred - y)^2)

const X = [1, 2, 3, 4, 5, 6, 7, 8];
const Y = [2.2, 3.9, 6.1, 8.0, 9.9, 12.1, 14.0, 15.8]; // Target roughly y = 2x + 0.1

let w = 0.0;
let b = 0.0;
const lr = 0.01;
const epochs = 200;
const N = X.length;

console.log("Initial weights: w =", w, "b =", b);
console.log("Training samples (N):", N);

for (let epoch = 1; epoch <= epochs; epoch++) {
  let loss = 0;
  let dw = 0;
  let db = 0;

  for (let i = 0; i < N; i++) {
    const yPred = w * X[i] + b;
    const error = yPred - Y[i];
    loss += error * error;
    dw += (2 / N) * error * X[i];
    db += (2 / N) * error;
  }

  loss /= N;
  w -= lr * dw;
  b -= lr * db;

  if (epoch % 50 === 0 || epoch === epochs) {
    console.log(\`Epoch \${epoch.toString().padStart(3, ' ')}: Loss = \${loss.toFixed(6)} | w = \${w.toFixed(4)}, b = \${b.toFixed(4)}\`);
  }
}

console.log("\\n=== Predictions ===");
[9, 10].forEach(testVal => {
  const pred = w * testVal + b;
  console.log(\`For x = \${testVal} -> Predicted y = \${pred.toFixed(2)}\`);
});
`
  },
  {
    id: 'cosine-similarity',
    title: 'Vector Embedding Cosine Similarity (Phase 03)',
    language: 'javascript',
    description: 'Calculates cosine similarity dot(A, B) / (|A| * |B|) between concept embeddings.',
    code: `// Vector Embedding Cosine Similarity
// Similarity(A, B) = dot(A, B) / (||A|| * ||B||)

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a, b) {
  const dot = dotProduct(a, b);
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Simulated dense embeddings for concept terms
const embeddings = {
  "deep_learning":    [0.85, 0.72, 0.12, 0.90, 0.34],
  "neural_network":   [0.82, 0.75, 0.10, 0.88, 0.31],
  "gradient_descent": [0.70, 0.40, 0.25, 0.65, 0.80],
  "apple_fruit":      [0.05, 0.10, 0.92, 0.08, 0.15],
  "banana_fruit":     [0.08, 0.12, 0.89, 0.05, 0.18]
};

console.log("=== Embedding Cosine Similarity Matrix ===");

const terms = Object.keys(embeddings);
for (let i = 0; i < terms.length; i++) {
  for (let j = i + 1; j < terms.length; j++) {
    const t1 = terms[i];
    const t2 = terms[j];
    const sim = cosineSimilarity(embeddings[t1], embeddings[t2]);
    console.log(\`Similarity("\${t1}", "\${t2}") = \${sim.toFixed(4)}\`);
  }
}
`
  },
  {
    id: 'bpe-tokenizer',
    title: 'Subword BPE Merge Step from Scratch (Phase 03)',
    language: 'javascript',
    description: 'Implements Byte-Pair Encoding pair frequency counting and rule-based merging.',
    code: `// Byte Pair Encoding (BPE) from Scratch
// Counts symbol bigram frequencies and merges the most frequent pair

function getStats(vocab) {
  const pairs = {};
  for (const [word, freq] of Object.entries(vocab)) {
    const symbols = word.split(' ');
    for (let i = 0; i < symbols.length - 1; i++) {
      const pair = \`\${symbols[i]} \${symbols[i + 1]}\`;
      pairs[pair] = (pairs[pair] || 0) + freq;
    }
  }
  return pairs;
}

function mergeVocab(pair, vocab) {
  const newVocab = {};
  const bigram = pair.split(' ');
  const regex = new RegExp(\`\\\\b\${bigram[0]} \${bigram[1]}\\\\b\`, 'g');
  const replacement = bigram.join('');

  for (const [word, freq] of Object.entries(vocab)) {
    const newWord = word.replace(regex, replacement);
    newVocab[newWord] = freq;
  }
  return newVocab;
}

// Initial corpus with space-separated character symbols and end-of-word marker </w>
let vocab = {
  "l o w </w>": 5,
  "l o w e r </w>": 2,
  "n e w e s t </w>": 6,
  "w i d e s t </w>": 3
};

const numMerges = 5;
console.log("Initial Corpus Vocabulary:");
console.log(JSON.stringify(vocab, null, 2));

for (let step = 1; step <= numMerges; step++) {
  const pairs = getStats(vocab);
  const bestPair = Object.keys(pairs).reduce((a, b) => pairs[a] > pairs[b] ? a : b);
  console.log(\`\\nMerge #\${step}: Most frequent pair -> "\${bestPair}" (count: \${pairs[bestPair]})\`);
  vocab = mergeVocab(bestPair, vocab);
}

console.log("\\nVocabulary after 5 BPE Merges:");
console.log(JSON.stringify(vocab, null, 2));
`
  },
  {
    id: 'react-agent-loop',
    title: 'ReAct Agent Loop Simulator (Phase 13)',
    language: 'javascript',
    description: 'Simulates a Thought -> Action -> Observation loop with mocked tools.',
    code: `// ReAct (Reasoning + Acting) Agent Loop Simulator
// Thought -> Action -> Observation -> Final Answer

const TOOLS = {
  search_kb(query) {
    const kb = {
      "transformer author": "The Transformer was introduced by Vaswani et al. in 2017 in 'Attention Is All You Need'.",
      "residual connections": "Residual connections prevent vanishing gradients in deep models by adding skip connections.",
      "temperature sampling": "Temperature scales logit distribution before softmax: low T is deterministic, high T is diverse."
    };
    for (const [k, v] of Object.entries(kb)) {
      if (query.toLowerCase().includes(k)) return v;
    }
    return "No direct entry found. Try a broader keyword.";
  },
  calculator(expr) {
    try {
      return Function('"use strict";return (' + expr + ')')();
    } catch {
      return "Math evaluation error";
    }
  }
};

class ReActAgent {
  constructor(maxSteps = 4) {
    this.maxSteps = maxSteps;
    this.memory = [];
  }

  logStep(type, text) {
    console.log(\`[\${type.toUpperCase()}] \${text}\`);
    this.memory.push({ type, text });
  }

  solve(question) {
    console.log("Goal Question:", question);
    this.logStep("thought", "I need to look up who introduced the Transformer and when it was published.");

    // Step 1: Tool Call
    const query = "transformer author";
    this.logStep("action", \`search_kb("\${query}")\`);
    const obs1 = TOOLS.search_kb(query);
    this.logStep("observation", obs1);

    // Step 2: Reasoning over observation
    this.logStep("thought", "The observation shows Vaswani et al. introduced it in 2017. How many years ago was that relative to 2026?");
    this.logStep("action", 'calculator("2026 - 2017")');
    const obs2 = TOOLS.calculator("2026 - 2017");
    this.logStep("observation", \`\${obs2} years\`);

    // Final Answer
    const answer = \`The Transformer architecture was introduced by Vaswani et al. in 2017 (approximately \${obs2} years ago in 'Attention Is All You Need').\`;
    this.logStep("final_answer", answer);
    return answer;
  }
}

const agent = new ReActAgent();
agent.solve("Who introduced the Transformer architecture and how long ago was that?");
`
  }
];

/**
 * Execute user code in a safe client-side environment capturing console output
 * @param {string} code 
 * @param {string} language 
 * @returns {{ logs: Array<{type: string, text: string}>, error: string|null, durationMs: number }}
 */
function executeSandboxCode(code, language = 'javascript') {
  const startTime = Date.now();
  const logs = [];
  let error = null;

  if (language !== 'javascript') {
    return {
      logs: [
        { type: 'warn', text: `Note: ${language} execution runs in algorithmic JavaScript sandbox mode.` },
      ],
      error: `Offline native ${language} runtime not available. Use JavaScript for client-side evaluation.`,
      durationMs: 0,
    };
  }

  // Intercept console calls
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const captureArg = (arg) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  try {
    console.log = (...args) => {
      logs.push({ type: 'log', text: args.map(captureArg).join(' ') });
    };
    console.warn = (...args) => {
      logs.push({ type: 'warn', text: args.map(captureArg).join(' ') });
    };
    console.error = (...args) => {
      logs.push({ type: 'error', text: args.map(captureArg).join(' ') });
    };

    // Execute via Function constructor in strict mode with restricted globals
    const runner = new Function(
      'console',
      'setTimeout',
      'setInterval',
      `"use strict";\n${code}`
    );

    // Call runner with custom console and disabled timers
    runner(
      { log: console.log, warn: console.warn, error: console.error },
      undefined,
      undefined
    );
  } catch (err) {
    error = err.message || String(err);
    logs.push({ type: 'error', text: `Runtime Error: ${error}` });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  const durationMs = Date.now() - startTime;
  return { logs, error, durationMs };
}

/**
 * Save user scratchpad to localStorage
 * @param {string} code 
 * @param {string} snippetId 
 */
function saveScratchpad(code, snippetId = 'custom') {
  try {
    const key = `playground_scratch_${snippetId}`;
    localStorage.setItem(key, code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load user scratchpad from localStorage
 * @param {string} snippetId 
 * @returns {string|null}
 */
function loadScratchpad(snippetId = 'custom') {
  try {
    const key = `playground_scratch_${snippetId}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Format console logs into clean terminal output HTML
 * @param {Array<{type: string, text: string}>} logs 
 * @param {string|null} error 
 * @param {number} durationMs 
 * @returns {string}
 */
function formatTerminalHtml(logs, error, durationMs) {
  let html = `<div class="terminal-meta">
    <span class="meta-status ${error ? 'status-err' : 'status-ok'}">
      ${error ? '❌ EXECUTION FAILED' : '✔ EXECUTION SUCCESS'}
    </span>
    <span class="meta-time">⏱ ${durationMs}ms</span>
    <span class="meta-count">${logs.length} lines logged</span>
  </div>
  <div class="terminal-logs">`;

  if (logs.length === 0 && !error) {
    html += `<div class="log-line log-empty">(Code finished execution with no console output)</div>`;
  } else {
    logs.forEach(log => {
      const typeClass = log.type === 'error' ? 'log-err' : (log.type === 'warn' ? 'log-warn' : 'log-info');
      // Escape HTML
      const escaped = log.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html += `<div class="log-line ${typeClass}">${escaped}</div>`;
    });
  }

  html += `</div>`;
  return html;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CURRICULUM_PRESETS,
    executeSandboxCode,
    saveScratchpad,
    loadScratchpad,
    formatTerminalHtml,
  };
}
