'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { SQLiteDatabase } = require('./sqlite-db');

// Mock in-memory storage for test isolation
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

test('SQLiteDatabase initializes schema tables and metadata cleanly', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  assert.ok(db.tables.chapter_completions instanceof Map);
  assert.ok(db.tables.page_notes instanceof Map);
  assert.ok(db.tables.schema_meta instanceof Map);

  const metaVersion = db.query("SELECT value FROM schema_meta WHERE key = 'version'");
  assert.strictEqual(metaVersion.length, 1);
  assert.strictEqual(metaVersion[0].value, '1.3.0');
});

test('markChapterComplete, isChapterCompleted, and getChapterCompletion track completion in SQLite', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  assert.strictEqual(db.isChapterCompleted('01-neural-network'), false);

  const saved = db.markChapterComplete(
    '01-neural-network',
    '01-foundations',
    'Build a Neural Network from Scratch',
    1700000000000
  );

  assert.ok(saved);
  assert.strictEqual(saved.lesson_id, '01-neural-network');
  assert.strictEqual(saved.phase_id, '01-foundations');
  assert.strictEqual(saved.title, 'Build a Neural Network from Scratch');
  assert.strictEqual(saved.completed_at, 1700000000000);

  assert.strictEqual(db.isChapterCompleted('01-neural-network'), true);
  assert.strictEqual(db.getCompletedCount(), 1);

  // Persistence check: new instance reading from same storage
  const db2 = new SQLiteDatabase({ storage });
  assert.strictEqual(db2.isChapterCompleted('01-neural-network'), true);
  const reloaded = db2.getChapterCompletion('01-neural-network');
  assert.strictEqual(reloaded.title, 'Build a Neural Network from Scratch');
});

test('toggleChapterCompletion toggles completion state back and forth', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  const state1 = db.toggleChapterCompletion('02-attention', '02-transformers', 'Attention Mechanism');
  assert.strictEqual(state1, true);
  assert.strictEqual(db.isChapterCompleted('02-attention'), true);

  const state2 = db.toggleChapterCompletion('02-attention', '02-transformers', 'Attention Mechanism');
  assert.strictEqual(state2, false);
  assert.strictEqual(db.isChapterCompleted('02-attention'), false);
  assert.strictEqual(db.getCompletedCount(), 0);
});

test('savePageNote, getPageNote, and deletePageNote manage per-page notes in SQLite', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  assert.strictEqual(db.getPageNote('03-bpe'), null);

  const note = db.savePageNote(
    '03-bpe',
    '01-tokenizers',
    'Byte-Pair Encoding Tokenizer',
    'BPE merges the most frequent pair of adjacent bytes iteratively.',
    1710000000000
  );

  assert.ok(note);
  assert.strictEqual(note.lesson_id, '03-bpe');
  assert.strictEqual(note.note_text, 'BPE merges the most frequent pair of adjacent bytes iteratively.');
  assert.strictEqual(db.getNotesCount(), 1);

  // Update note
  db.savePageNote(
    '03-bpe',
    '01-tokenizers',
    'Byte-Pair Encoding Tokenizer',
    'Updated: Vocabulary size is a hyperparameter determined by number of merges.'
  );
  const updated = db.getPageNote('03-bpe');
  assert.strictEqual(updated.note_text, 'Updated: Vocabulary size is a hyperparameter determined by number of merges.');

  // Saving blank note removes it
  db.savePageNote('03-bpe', '01-tokenizers', 'Byte-Pair Encoding Tokenizer', '   \n  ');
  assert.strictEqual(db.getPageNote('03-bpe'), null);
  assert.strictEqual(db.getNotesCount(), 0);
});

test('getAllCompletedChapters and getAllPageNotes return sorted lists', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  db.markChapterComplete('l1', 'p1', 'Lesson 1', 100);
  db.markChapterComplete('l2', 'p1', 'Lesson 2', 200);
  db.markChapterComplete('l3', 'p1', 'Lesson 3', 300);

  const completed = db.getAllCompletedChapters();
  assert.strictEqual(completed.length, 3);
  assert.strictEqual(completed[0].lesson_id, 'l3');
  assert.strictEqual(completed[2].lesson_id, 'l1');

  db.savePageNote('l1', 'p1', 'Lesson 1', 'Note 1', 1000);
  db.savePageNote('l2', 'p1', 'Lesson 2', 'Note 2', 2000);

  const notes = db.getAllPageNotes();
  assert.strictEqual(notes.length, 2);
  assert.strictEqual(notes[0].lesson_id, 'l2');
  assert.strictEqual(notes[1].lesson_id, 'l1');
});

test('exportSqlDump outputs standard SQLite statements verified with native node:sqlite DatabaseSync', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  db.markChapterComplete('l1', 'p1', 'Backprop from Scratch', 1705000000000);
  db.savePageNote('l1', 'p1', 'Backprop from Scratch', 'Chain rule: dL/dw = dL/dy * dy/dw', 1705000005000);

  const dump = db.exportSqlDump();
  assert.ok(dump.includes('CREATE TABLE IF NOT EXISTS chapter_completions'));
  assert.ok(dump.includes('CREATE TABLE IF NOT EXISTS page_notes'));
  assert.ok(dump.includes('INSERT OR REPLACE INTO chapter_completions'));
  assert.ok(dump.includes('INSERT OR REPLACE INTO page_notes'));

  // Native SQLite validation using Node 22+ built-in node:sqlite
  try {
    const { DatabaseSync } = require('node:sqlite');
    const nativeDb = new DatabaseSync(':memory:');
    nativeDb.exec(dump);

    const rows = nativeDb.prepare('SELECT * FROM chapter_completions').all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].lesson_id, 'l1');
    assert.strictEqual(rows[0].title, 'Backprop from Scratch');

    const noteRows = nativeDb.prepare('SELECT * FROM page_notes').all();
    assert.strictEqual(noteRows.length, 1);
    assert.strictEqual(noteRows[0].lesson_id, 'l1');
    assert.ok(noteRows[0].note_text.includes('Chain rule'));

    nativeDb.close();
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
});

test('SQLiteDatabase query properly escapes quotes and special characters in parameters', () => {
  const storage = createMockStorage();
  const db = new SQLiteDatabase({ storage });

  db.savePageNote(
    '01-special',
    '01-math',
    "O'Reilly's Math & \"Calculus\"",
    "Euler's formula: e^(i*pi) + 1 = 0; Quotes: \"hello\", 'world'."
  );

  const note = db.getPageNote('01-special');
  assert.ok(note);
  assert.strictEqual(note.title, "O'Reilly's Math & \"Calculus\"");
  assert.strictEqual(note.note_text, "Euler's formula: e^(i*pi) + 1 = 0; Quotes: \"hello\", 'world'.");

  const queryRes = db.query("SELECT * FROM page_notes WHERE lesson_id = ?", ['01-special']);
  assert.strictEqual(queryRes.length, 1);
  assert.strictEqual(queryRes[0].title, "O'Reilly's Math & \"Calculus\"");
});

test('dist bundle includes sqlite-db.js and in-article completion & notes UI elements', () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const appJsPath = path.join(__dirname, 'dist', 'app.js');
  const sqliteDbDistPath = path.join(__dirname, 'dist', 'sqlite-db.js');

  assert.ok(fs.existsSync(sqliteDbDistPath), 'dist/sqlite-db.js must be bundled in dist');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.ok(indexHtml.includes('<script src="sqlite-db.js"></script>'), 'dist/index.html must include sqlite-db.js script tag');
  assert.ok(indexHtml.includes('.chapter-complete-card'), 'dist/index.html must contain chapter-complete-card styling');
  assert.ok(indexHtml.includes('.page-notes-card'), 'dist/index.html must contain page-notes-card styling');

  const appJs = fs.readFileSync(appJsPath, 'utf8');
  assert.ok(appJs.includes('markCompleteBtn'), 'dist/app.js must wire up markCompleteBtn');
  assert.ok(appJs.includes('pageNotesTextarea'), 'dist/app.js must wire up pageNotesTextarea');

  const sqliteDbContent = fs.readFileSync(sqliteDbDistPath, 'utf8');
  assert.ok(sqliteDbContent.includes('chapter_completions'), 'dist/sqlite-db.js must define chapter_completions');
});

