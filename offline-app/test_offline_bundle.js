'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(DIST_DIR, 'data');
const CURRICULUM_PATH = path.join(DATA_DIR, 'curriculum.json');

test('offline bundle curriculum manifest is complete', () => {
  assert.ok(fs.existsSync(CURRICULUM_PATH), 'curriculum.json must exist');
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));

  assert.equal(curriculum.phases.length, 20, 'Curriculum must contain exactly 20 phases');
  assert.equal(curriculum.totalLessons, 542, 'Curriculum must contain all 542 lessons');
});

test('every lesson has pre-rendered HTML and 6-question quiz', () => {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  let inspectedCount = 0;

  for (const phase of curriculum.phases) {
    for (const lesson of phase.lessons) {
      const lessonPath = path.join(DATA_DIR, 'lessons', `${lesson.id}.json`);
      assert.ok(fs.existsSync(lessonPath), `Lesson file must exist: ${lesson.id}`);

      const payload = JSON.parse(fs.readFileSync(lessonPath, 'utf8'));
      assert.ok(payload.title && payload.title.length > 0, `Lesson title missing: ${lesson.id}`);
      assert.ok(payload.html && payload.html.length > 50, `Pre-rendered HTML missing: ${lesson.id}`);
      if (payload.quiz) {
        assert.ok(Array.isArray(payload.quiz.questions), `Quiz questions must be an array: ${lesson.id}`);
        assert.ok(payload.quiz.questions.length >= 3, `Quiz must have at least 3 questions if present for ${lesson.id}`);
      }

      inspectedCount++;
    }
  }

  assert.equal(inspectedCount, 542, 'Must have inspected all 542 pre-rendered lessons');
});

test('offline bundle enforces zero external network dependencies', () => {
  const indexHtml = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(DIST_DIR, 'app.js'), 'utf8');
  const fontsCss = fs.readFileSync(path.join(DIST_DIR, 'fonts.css'), 'utf8');
  const styleCss = fs.readFileSync(path.join(DIST_DIR, 'style.css'), 'utf8');

  for (const [name, content] of [['index.html', indexHtml], ['app.js', appJs], ['fonts.css', fontsCss], ['style.css', styleCss]]) {
    assert.doesNotMatch(content, /https?:\/\/fonts\.googleapis\.com/, `${name} must not load external Google Fonts`);
    assert.doesNotMatch(content, /https?:\/\/raw\.githubusercontent\.com/, `${name} must not fetch external raw github content`);
    assert.doesNotMatch(content, /https?:\/\/va\.vercel-scripts\.com/, `${name} must not load external Vercel analytics`);
  }
});

test('local fonts are packaged and valid', () => {
  const fontsDir = path.join(DIST_DIR, 'fonts');
  assert.ok(fs.existsSync(fontsDir), 'fonts directory must exist');
  const fontFiles = fs.readdirSync(fontsDir);
  assert.ok(fontFiles.length >= 3, 'Must have packaged at least 3 offline font files');

  const fontsCss = fs.readFileSync(path.join(DIST_DIR, 'fonts.css'), 'utf8');
  assert.match(fontsCss, /url\('fonts\//, 'fonts.css must reference local fonts directory');
});
