'use strict';

/**
 * Storage keys used by the study controller.
 */
const STORAGE_KEYS = {
  COMPLETED: 'completed_lessons',
  BOOKMARKS: 'user_bookmarks',
  NOTES: 'user_notes',
  QUIZ_SCORES: 'quiz_scores',
};

/**
 * Bookmark Management
 */
function toggleBookmark(bookmarks, lesson, timestamp = Date.now()) {
  const list = Array.isArray(bookmarks) ? [...bookmarks] : [];
  if (!lesson || !lesson.id) return list;

  const existingIdx = list.findIndex(b => b.id === lesson.id);
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
  } else {
    list.unshift({
      id: lesson.id,
      title: lesson.title || 'Untitled Lesson',
      phaseId: lesson.phaseId || '',
      bookmarkedAt: timestamp,
    });
  }
  return list;
}

function isBookmarked(bookmarks, lessonId) {
  if (!Array.isArray(bookmarks) || !lessonId) return false;
  return bookmarks.some(b => b.id === lessonId);
}

/**
 * Notes Management
 */
function saveNote(notesMap, lesson, text, timestamp = Date.now()) {
  const map = { ...(notesMap || {}) };
  if (!lesson || !lesson.id) return map;

  const trimmed = (text || '').trim();
  if (!trimmed) {
    delete map[lesson.id];
  } else {
    map[lesson.id] = {
      lessonId: lesson.id,
      lessonTitle: lesson.title || 'Untitled Lesson',
      phaseId: lesson.phaseId || '',
      text: trimmed,
      updatedAt: timestamp,
    };
  }
  return map;
}

function deleteNote(notesMap, lessonId) {
  const map = { ...(notesMap || {}) };
  if (lessonId && map[lessonId]) {
    delete map[lessonId];
  }
  return map;
}

function getNote(notesMap, lessonId) {
  if (!notesMap || !lessonId || !notesMap[lessonId]) return null;
  return notesMap[lessonId];
}

/**
 * Parse time string like "~30m", "~45m", "~1h" into minutes.
 */
function parseTimeMinutes(timeStr) {
  if (!timeStr) return 30; // default 30 mins
  const clean = String(timeStr).replace(/[~m\s]/g, '');
  if (clean.includes('h')) {
    const parts = clean.split('h');
    const hours = parseFloat(parts[0]) || 1;
    const mins = parseFloat(parts[1]) || 0;
    return Math.round(hours * 60 + mins);
  }
  const val = parseInt(clean, 10);
  return Number.isNaN(val) || val <= 0 ? 30 : val;
}

/**
 * Compute aggregate statistics for the Study Dashboard.
 */
function computeStudyStats(curriculum, completedLessonIds = [], bookmarks = [], notesMap = {}, quizScores = {}) {
  const completedSet = new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  const phases = (curriculum && Array.isArray(curriculum.phases)) ? curriculum.phases : [];

  let totalLessons = 0;
  let completedCount = 0;
  let remainingMinutes = 0;
  let totalMinutes = 0;

  const phaseStats = phases.map(phase => {
    const lessons = Array.isArray(phase.lessons) ? phase.lessons : [];
    const pTotal = lessons.length;
    let pCompleted = 0;
    let pRemainingMins = 0;

    lessons.forEach(l => {
      totalLessons++;
      const mins = parseTimeMinutes(l.time);
      totalMinutes += mins;

      if (completedSet.has(l.id)) {
        completedCount++;
        pCompleted++;
      } else {
        remainingMinutes += mins;
        pRemainingMins += mins;
      }
    });

    const pPercentage = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
    return {
      id: phase.id,
      number: phase.number,
      title: phase.title,
      total: pTotal,
      completed: pCompleted,
      percentage: pPercentage,
      remainingMinutes: pRemainingMins,
    };
  });

  const overallPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const remainingHours = Math.round((remainingMinutes / 60) * 10) / 10;
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // Quiz analytics
  const scores = Object.values(quizScores || {});
  let avgQuizScore = 0;
  if (scores.length > 0) {
    const totalScore = scores.reduce((acc, s) => acc + (typeof s.percentage === 'number' ? s.percentage : 0), 0);
    avgQuizScore = Math.round(totalScore / scores.length);
  }

  const bookmarkCount = Array.isArray(bookmarks) ? bookmarks.length : 0;
  const noteCount = notesMap ? Object.keys(notesMap).length : 0;

  return {
    totalLessons,
    completedCount,
    overallPercentage,
    remainingMinutes,
    remainingHours,
    totalHours,
    phaseStats,
    bookmarkCount,
    noteCount,
    quizzesTaken: scores.length,
    avgQuizScore,
  };
}

/**
 * Export and Import User Data
 */
function exportUserData(data) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    completedLessons: Array.isArray(data.completedLessons) ? data.completedLessons : [],
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
    notes: data.notes && typeof data.notes === 'object' ? data.notes : {},
    quizScores: data.quizScores && typeof data.quizScores === 'object' ? data.quizScores : {},
  };
  return JSON.stringify(payload, null, 2);
}

function importUserData(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Invalid payload: string expected' };
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Malformed JSON object' };
    }

    const completedLessons = Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [];
    const bookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [];
    const notes = parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {};
    const quizScores = parsed.quizScores && typeof parsed.quizScores === 'object' ? parsed.quizScores : {};

    return {
      success: true,
      data: {
        completedLessons,
        bookmarks,
        notes,
        quizScores,
        importedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { success: false, error: 'JSON parse error: ' + err.message };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    toggleBookmark,
    isBookmarked,
    saveNote,
    deleteNote,
    getNote,
    parseTimeMinutes,
    computeStudyStats,
    exportUserData,
    importUserData,
  };
}
