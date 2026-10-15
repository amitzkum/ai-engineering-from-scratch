'use strict';

/**
 * Stage labels and formatting for the 6-question quiz flow.
 */
function formatQuizStage(stage) {
  switch (stage) {
    case 'pre':
      return { label: 'PRE-CHECK', color: '#58a6ff' };
    case 'check':
      return { label: 'CONCEPT CHECK', color: '#bc8cff' };
    case 'post':
      return { label: 'POST-CHECK', color: '#3fb950' };
    default:
      return { label: 'QUESTION', color: '#8b949e' };
  }
}

/**
 * Grade quiz submission with passing threshold.
 */
function gradeQuiz(questions, selectedAnswers, passThreshold = 0.65) {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { score: 0, total: 0, percentage: 0, passed: false, details: [] };
  }

  let correctCount = 0;
  const details = questions.map((q, idx) => {
    const selected = selectedAnswers[idx];
    const isCorrect = selected === q.correct;
    if (isCorrect) correctCount++;

    return {
      index: idx,
      stage: q.stage || 'check',
      selected,
      correct: q.correct,
      isCorrect,
      explanation: q.explanation || '',
    };
  });

  const percentage = Math.round((correctCount / questions.length) * 100);
  const passed = percentage >= Math.round(passThreshold * 100);

  return {
    score: correctCount,
    total: questions.length,
    percentage,
    passed,
    details,
  };
}

/**
 * Pan and Zoom transformation calculations for SVG diagrams.
 */
function calculateZoomTransform(current, action, minScale = 0.5, maxScale = 4.0) {
  let { scale = 1.0, x = 0, y = 0 } = current || {};

  switch (action.type) {
    case 'zoomIn':
      scale = Math.min(scale * 1.25, maxScale);
      break;
    case 'zoomOut':
      scale = Math.max(scale / 1.25, minScale);
      break;
    case 'reset':
      scale = 1.0;
      x = 0;
      y = 0;
      break;
    case 'pan':
      x += action.dx || 0;
      y += action.dy || 0;
      break;
    case 'pinch':
      scale = Math.min(Math.max((action.scale || 1.0), minScale), maxScale);
      break;
  }

  return {
    scale: Number(scale.toFixed(3)),
    x: Math.round(x),
    y: Math.round(y),
    transformStyle: `matrix(${scale.toFixed(3)}, 0, 0, ${scale.toFixed(3)}, ${Math.round(x)}, ${Math.round(y)})`,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatQuizStage,
    gradeQuiz,
    calculateZoomTransform,
  };
}
