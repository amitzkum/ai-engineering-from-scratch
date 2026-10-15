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
