'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CURRICULUM_PATH = path.join(__dirname, 'dist', 'data', 'curriculum.json');

// Responsive Shell Logic Model for Unit Testing
function createShellModel(curriculum) {
  const allLessons = [];
  const indexMap = new Map();

  curriculum.phases.forEach(phase => {
    phase.lessons.forEach(lesson => {
      allLessons.push(lesson);
      indexMap.set(lesson.id, allLessons.length - 1);
    });
  });

  return {
    allLessons,
    isTablet(width) {
      return width >= 768;
    },
    isPhone(width) {
      return width < 768;
    },
    clampFontSize(size) {
      return Math.min(Math.max(size, 0.85), 1.5);
    },
    calcProgress(completedSet) {
      const total = allLessons.length;
      const count = completedSet.size;
      return {
        completed: count,
        total,
        percentage: Math.round((count / total) * 100),
      };
    },
    getNav(lessonId) {
      const idx = indexMap.get(lessonId);
      if (idx === undefined) return { prev: null, next: null };
      return {
        prev: idx > 0 ? allLessons[idx - 1] : null,
        next: idx < allLessons.length - 1 ? allLessons[idx + 1] : null,
      };
    },
  };
}

test('tablet and phone responsive layout classification', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const shell = createShellModel(curriculum);

  // Tablet screen widths
  assert.equal(shell.isTablet(768), true, '768px (iPad Mini / Portrait Tablet) is tablet');
  assert.equal(shell.isTablet(1024), true, '1024px (Standard Tablet) is tablet');
  assert.equal(shell.isTablet(1280), true, '1280px (Large Tablet Landscape) is tablet');
  assert.equal(shell.isPhone(768), false);

  // Phone screen widths
  assert.equal(shell.isPhone(360), true, '360px is mobile phone');
  assert.equal(shell.isPhone(412), true, '412px (Pixel / Galaxy) is mobile phone');
  assert.equal(shell.isPhone(600), true, '600px is mobile phone');
  assert.equal(shell.isTablet(412), false);
});

test('sequential lesson navigation across phase boundaries', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const shell = createShellModel(curriculum);

  // First lesson has no prev
  const first = shell.allLessons[0];
  const navFirst = shell.getNav(first.id);
  assert.equal(navFirst.prev, null, 'First lesson must have no prev');
  assert.ok(navFirst.next, 'First lesson must have next');

  // Last lesson of Phase 00 should point to first lesson of Phase 01
  const phase0 = curriculum.phases[0];
  const lastPhase0Lesson = phase0.lessons[phase0.lessons.length - 1];
  const navPhaseBoundary = shell.getNav(lastPhase0Lesson.id);

  assert.ok(navPhaseBoundary.next, 'Boundary lesson must have next');
  assert.ok(
    navPhaseBoundary.next.id.startsWith('01-'),
    `Crossing phase boundary must lead to Phase 01: got ${navPhaseBoundary.next.id}`
  );

  // Last lesson has no next
  const last = shell.allLessons[shell.allLessons.length - 1];
  const navLast = shell.getNav(last.id);
  assert.ok(navLast.prev, 'Last lesson must have prev');
  assert.equal(navLast.next, null, 'Last lesson must have no next');
});

test('reader font size clamping maintains accessibility bounds', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const shell = createShellModel(curriculum);

  assert.equal(shell.clampFontSize(0.5), 0.85, 'Must clamp low font size to 0.85rem');
  assert.equal(shell.clampFontSize(2.5), 1.5, 'Must clamp high font size to 1.5rem');
  assert.equal(shell.clampFontSize(1.15), 1.15, 'Valid font size remains intact');
});

test('curriculum progress tracking accurately computes percentages', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const shell = createShellModel(curriculum);

  const completed = new Set();
  assert.deepEqual(shell.calcProgress(completed), { completed: 0, total: 542, percentage: 0 });

  completed.add(shell.allLessons[0].id);
  completed.add(shell.allLessons[1].id);
  assert.equal(shell.calcProgress(completed).completed, 2);

  // Complete half
  for (let i = 0; i < 271; i++) {
    completed.add(shell.allLessons[i].id);
  }
  assert.equal(shell.calcProgress(completed).percentage, 50);
});
