'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toggleBookmark,
  isBookmarked,
  saveNote,
  deleteNote,
  getNote,
  parseTimeMinutes,
  computeStudyStats,
  exportUserData,
  importUserData,
} = require('./study-controller');

test('toggleBookmark and isBookmarked correctly add, toggle, and query bookmarks', () => {
  let bookmarks = [];
  const lesson1 = { id: '01-math/01-linear-algebra', title: 'Linear Algebra', phaseId: '01-math' };
  const lesson2 = { id: '02-python/01-classes', title: 'Python Classes', phaseId: '02-python' };

  // Add lesson1
  bookmarks = toggleBookmark(bookmarks, lesson1, 1000);
  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0].id, lesson1.id);
  assert.equal(bookmarks[0].title, 'Linear Algebra');
  assert.equal(isBookmarked(bookmarks, lesson1.id), true);
  assert.equal(isBookmarked(bookmarks, lesson2.id), false);

  // Add lesson2
  bookmarks = toggleBookmark(bookmarks, lesson2, 2000);
  assert.equal(bookmarks.length, 2);
  assert.equal(bookmarks[0].id, lesson2.id); // Newer first
  assert.equal(bookmarks[1].id, lesson1.id);

  // Toggle lesson1 off
  bookmarks = toggleBookmark(bookmarks, lesson1);
  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0].id, lesson2.id);
  assert.equal(isBookmarked(bookmarks, lesson1.id), false);
  assert.equal(isBookmarked(bookmarks, lesson2.id), true);
});

test('saveNote, getNote, and deleteNote handle note CRUD operations and clean up empty text', () => {
  let notes = {};
  const lesson = { id: '01-math/02-calculus', title: 'Calculus', phaseId: '01-math' };

  // Initial lookup is null
  assert.equal(getNote(notes, lesson.id), null);

  // Save new note
  notes = saveNote(notes, lesson, 'Remember the chain rule: d/dx f(g(x)) = f\'(g(x)) * g\'(x)', 5000);
  assert.ok(getNote(notes, lesson.id));
  assert.equal(getNote(notes, lesson.id).text, 'Remember the chain rule: d/dx f(g(x)) = f\'(g(x)) * g\'(x)');
  assert.equal(getNote(notes, lesson.id).updatedAt, 5000);

  // Update existing note
  notes = saveNote(notes, lesson, 'Updated calculus notes', 6000);
  assert.equal(getNote(notes, lesson.id).text, 'Updated calculus notes');
  assert.equal(getNote(notes, lesson.id).updatedAt, 6000);

  // Saving empty or whitespace string deletes note
  notes = saveNote(notes, lesson, '   \n  ');
  assert.equal(getNote(notes, lesson.id), null);

  // Re-save and deleteNote explicitly
  notes = saveNote(notes, lesson, 'Valid note');
  assert.ok(getNote(notes, lesson.id));
  notes = deleteNote(notes, lesson.id);
  assert.equal(getNote(notes, lesson.id), null);
});

test('parseTimeMinutes converts various human time strings into numeric minutes', () => {
  assert.equal(parseTimeMinutes('~30m'), 30);
  assert.equal(parseTimeMinutes('~45m'), 45);
  assert.equal(parseTimeMinutes('~1h'), 60);
  assert.equal(parseTimeMinutes('~1h30m'), 90);
  assert.equal(parseTimeMinutes('~2h'), 120);
  assert.equal(parseTimeMinutes(''), 30);
  assert.equal(parseTimeMinutes(null), 30);
});

test('computeStudyStats accurately computes totals, percentages, remaining study hours, and quiz averages', () => {
  const dummyCurriculum = {
    phases: [
      {
        id: '01-math',
        number: 1,
        title: 'Mathematics',
        lessons: [
          { id: '01-math/l1', title: 'L1', time: '~30m' },
          { id: '01-math/l2', title: 'L2', time: '~30m' },
        ],
      },
      {
        id: '02-python',
        number: 2,
        title: 'Python',
        lessons: [
          { id: '02-python/l1', title: 'P1', time: '~60m' },
          { id: '02-python/l2', title: 'P2', time: '~60m' },
        ],
      },
    ],
  };

  // 1. Initial zero completion state
  const stats0 = computeStudyStats(dummyCurriculum, [], [], {}, {});
  assert.equal(stats0.totalLessons, 4);
  assert.equal(stats0.completedCount, 0);
  assert.equal(stats0.overallPercentage, 0);
  assert.equal(stats0.totalHours, 3.0); // 30 + 30 + 60 + 60 = 180 mins = 3.0 hrs
  assert.equal(stats0.remainingHours, 3.0);
  assert.equal(stats0.phaseStats.length, 2);
  assert.equal(stats0.phaseStats[0].completed, 0);
  assert.equal(stats0.phaseStats[0].percentage, 0);

  // 2. Partial completion (1 math lesson + 1 python lesson)
  const completed = ['01-math/l1', '02-python/l1'];
  const bookmarks = [{ id: '01-math/l1' }, { id: '02-python/l2' }];
  const notes = { '01-math/l1': { text: 'Note 1' } };
  const quizScores = {
    '01-math/l1': { percentage: 100 },
    '02-python/l1': { percentage: 80 },
  };

  const stats1 = computeStudyStats(dummyCurriculum, completed, bookmarks, notes, quizScores);
  assert.equal(stats1.totalLessons, 4);
  assert.equal(stats1.completedCount, 2);
  assert.equal(stats1.overallPercentage, 50);
  // Remaining: math l2 (30m) + python l2 (60m) = 90 mins = 1.5 hrs
  assert.equal(stats1.remainingMinutes, 90);
  assert.equal(stats1.remainingHours, 1.5);

  assert.equal(stats1.bookmarkCount, 2);
  assert.equal(stats1.noteCount, 1);
  assert.equal(stats1.quizzesTaken, 2);
  assert.equal(stats1.avgQuizScore, 90); // (100 + 80) / 2

  // Phase breakdowns
  assert.equal(stats1.phaseStats[0].completed, 1);
  assert.equal(stats1.phaseStats[0].total, 2);
  assert.equal(stats1.phaseStats[0].percentage, 50);

  assert.equal(stats1.phaseStats[1].completed, 1);
  assert.equal(stats1.phaseStats[1].total, 2);
  assert.equal(stats1.phaseStats[1].percentage, 50);
});

test('exportUserData and importUserData handle JSON data serialization and validation cleanly', () => {
  const userData = {
    completedLessons: ['01-math/01', '01-math/02'],
    bookmarks: [{ id: '01-math/01', title: 'L1', phaseId: '01-math', bookmarkedAt: 12345 }],
    notes: { '01-math/01': { lessonId: '01-math/01', text: 'Important', updatedAt: 12345 } },
    quizScores: { '01-math/01': { score: 6, total: 6, percentage: 100 } },
  };

  const exported = exportUserData(userData);
  assert.ok(typeof exported === 'string');

  const importResult = importUserData(exported);
  assert.equal(importResult.success, true);
  assert.deepEqual(importResult.data.completedLessons, userData.completedLessons);
  assert.deepEqual(importResult.data.bookmarks, userData.bookmarks);
  assert.deepEqual(importResult.data.notes, userData.notes);
  assert.deepEqual(importResult.data.quizScores, userData.quizScores);

  // Corrupted / malformed imports
  assert.equal(importUserData('not valid json {').success, false);
  assert.equal(importUserData('').success, false);
  assert.equal(importUserData(null).success, false);
});
