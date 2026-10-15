'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatQuizStage, gradeQuiz, calculateZoomTransform } = require('./viewer-controller');

test('formatQuizStage formats all curriculum question stages correctly', () => {
  const pre = formatQuizStage('pre');
  assert.equal(pre.label, 'PRE-CHECK');
  assert.equal(pre.color, '#58a6ff');

  const check = formatQuizStage('check');
  assert.equal(check.label, 'CONCEPT CHECK');
  assert.equal(check.color, '#bc8cff');

  const post = formatQuizStage('post');
  assert.equal(post.label, 'POST-CHECK');
  assert.equal(post.color, '#3fb950');

  const fallback = formatQuizStage('unknown');
  assert.equal(fallback.label, 'QUESTION');
});

test('gradeQuiz accurately grades and calculates passing threshold', () => {
  const sampleQuestions = [
    { stage: 'pre', question: 'Q1', options: ['A', 'B'], correct: 1, explanation: 'Exp 1' },
    { stage: 'check', question: 'Q2', options: ['A', 'B'], correct: 0, explanation: 'Exp 2' },
    { stage: 'check', question: 'Q3', options: ['A', 'B'], correct: 1, explanation: 'Exp 3' },
    { stage: 'check', question: 'Q4', options: ['A', 'B'], correct: 0, explanation: 'Exp 4' },
    { stage: 'post', question: 'Q5', options: ['A', 'B'], correct: 0, explanation: 'Exp 5' },
    { stage: 'post', question: 'Q6', options: ['A', 'B'], correct: 1, explanation: 'Exp 6' },
  ];

  // Perfect score
  const perfect = gradeQuiz(sampleQuestions, { 0: 1, 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 });
  assert.equal(perfect.score, 6);
  assert.equal(perfect.total, 6);
  assert.equal(perfect.percentage, 100);
  assert.equal(perfect.passed, true);
  assert.equal(perfect.details.length, 6);
  assert.equal(perfect.details[0].isCorrect, true);

  // Passing score (4/6 = 67% >= 65%)
  const passing = gradeQuiz(sampleQuestions, { 0: 1, 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 });
  assert.equal(passing.score, 4);
  assert.equal(passing.percentage, 67);
  assert.equal(passing.passed, true);

  // Failing score (2/6 = 33% < 65%)
  const failing = gradeQuiz(sampleQuestions, { 0: 1, 1: 0, 2: 0, 3: 1, 4: 1, 5: 0 });
  assert.equal(failing.score, 2);
  assert.equal(failing.percentage, 33);
  assert.equal(failing.passed, false);
});

test('calculateZoomTransform handles zoomIn, zoomOut, pan, and reset within bounds', () => {
  let state = { scale: 1.0, x: 0, y: 0 };

  // Zoom In
  state = calculateZoomTransform(state, { type: 'zoomIn' });
  assert.equal(state.scale, 1.25);
  assert.match(state.transformStyle, /matrix\(1\.25/);

  // Zoom In multiple times (checks max bound 4.0)
  for (let i = 0; i < 10; i++) {
    state = calculateZoomTransform(state, { type: 'zoomIn' }, 0.5, 4.0);
  }
  assert.equal(state.scale, 4.0, 'Scale must not exceed maxScale 4.0');

  // Pan
  state = calculateZoomTransform(state, { type: 'pan', dx: 50, dy: -30 });
  assert.equal(state.x, 50);
  assert.equal(state.y, -30);

  // Zoom Out multiple times (checks min bound 0.5)
  for (let i = 0; i < 15; i++) {
    state = calculateZoomTransform(state, { type: 'zoomOut' }, 0.5, 4.0);
  }
  assert.equal(state.scale, 0.5, 'Scale must not drop below minScale 0.5');

  // Reset
  state = calculateZoomTransform(state, { type: 'reset' });
  assert.equal(state.scale, 1.0);
  assert.equal(state.x, 0);
  assert.equal(state.y, 0);
  assert.equal(state.transformStyle, 'matrix(1.000, 0, 0, 1.000, 0, 0)');
});

test('offline diagram assets and syntax highlighting stylesheets are bundled locally', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const distDir = path.join(__dirname, 'dist');

  // Verify mermaid.min.js
  const mermaidPath = path.join(distDir, 'mermaid.min.js');
  assert.ok(fs.existsSync(mermaidPath), 'mermaid.min.js must exist locally');
  assert.ok(fs.statSync(mermaidPath).size > 1000000, 'mermaid.min.js must be a full offline bundle (>1MB)');

  // Verify lesson.css
  const lessonCssPath = path.join(distDir, 'lesson.css');
  assert.ok(fs.existsSync(lessonCssPath), 'lesson.css must exist');
  const lessonCss = fs.readFileSync(lessonCssPath, 'utf8');
  assert.doesNotMatch(lessonCss, /fonts\.googleapis\.com/, 'lesson.css must not have external Google font imports');
  assert.match(lessonCss, /\.syn-keyword/, 'lesson.css must define syntax highlighting rules');

  // Verify figure-manifest.js and lesson-figures.js
  assert.ok(fs.existsSync(path.join(distDir, 'figure-manifest.js')), 'figure-manifest.js must exist');
  assert.ok(fs.existsSync(path.join(distDir, 'lesson-figures.js')), 'lesson-figures.js must exist');
});

test('quiz option button target resolution handles inner letter badges and text spans', () => {
  // Mock DOM event target hierarchy
  function resolveQuizOptionClick(target) {
    const optBtn = target.closest('.quiz-option');
    if (!optBtn) return null;
    const qDiv = optBtn.closest('.quiz-question');
    if (!qDiv) return null;
    return {
      qIdx: parseInt(qDiv.dataset.q, 10),
      optIdx: parseInt(optBtn.dataset.opt, 10),
    };
  }

  const qDivMock = {
    dataset: { q: '2' },
    closest: (sel) => (sel === '.quiz-question' ? qDivMock : null),
  };
  const optBtnMock = {
    dataset: { opt: '1' },
    closest: (sel) => (sel === '.quiz-option' ? optBtnMock : (sel === '.quiz-question' ? qDivMock : null)),
  };
  const innerLetterSpan = {
    closest: (sel) => optBtnMock.closest(sel),
  };

  // Direct click on option button
  const direct = resolveQuizOptionClick(optBtnMock);
  assert.deepEqual(direct, { qIdx: 2, optIdx: 1 });

  // Nested click on inner <span class="opt-letter">
  const nested = resolveQuizOptionClick(innerLetterSpan);
  assert.deepEqual(nested, { qIdx: 2, optIdx: 1 });
});

