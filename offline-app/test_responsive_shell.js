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

test('dist/app.js and dist/index.html are syntactically valid and contain all required UI elements', () => {
  const vm = require('node:vm');
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const appJsPath = path.join(__dirname, 'dist', 'app.js');

  assert.ok(fs.existsSync(indexHtmlPath), 'dist/index.html must exist');
  assert.ok(fs.existsSync(appJsPath), 'dist/app.js must exist');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // Verify syntax of app.js with VM script parsing
  assert.doesNotThrow(() => {
    new vm.Script(appJs, { filename: 'app.js' });
  }, 'dist/app.js must parse with zero syntax errors');

  // Verify critical DOM IDs required by app.js
  const requiredIds = [
    'sidebarToggle',
    'sidebar',
    'drawerBackdrop',
    'phaseList',
    'searchInput',
    'articleWrap',
    'breadcrumbsBar',
    'themeSelect',
    'viewLessonsBtn',
    'viewDashboardBtn',
    'viewLibraryBtn',
    'lessonView',
    'studyDashboardView',
    'libraryView',
    'bookReaderView',
    'bookmarkBtn',
    'noteToggleBtn',
    'lessonNotePanel',
    'noteTextarea',
    'dashboardMetricsGrid',
    'phaseProgressGrid',
    'libraryGrid',
    'aboutBtn',
    'aboutModal',
    'closeAboutBtn',
    'sidebarFooter',
    'viewPlaygroundBtn',
    'playgroundView',
    'playgroundCode',
    'snippetSelect',
    'runCodeBtn',
    'playgroundOutput',
    'viewPythonPlaygroundBtn',
    'pythonPlaygroundView',
    'pythonCode',
    'pythonSnippetSelect',
    'runPythonBtn',
    'resetPythonBtn',
    'copyPythonBtn',
    'clearPythonOutputBtn',
    'pythonOutput',
    'pythonSaveStatus',
    'pythonTerminalBadge',
    'pythonEditorTitle',
  ];

  for (const id of requiredIds) {
    assert.ok(
      indexHtml.includes(`id="${id}"`),
      `dist/index.html missing required element id="${id}"`
    );
  }

  // Verify attribution content in index.html
  assert.ok(indexHtml.includes('Amit Kumar'), 'index.html must include author attribution to Amit Kumar');
  assert.ok(indexHtml.includes('AI Engineering from Scratch'), 'index.html must include curriculum source attribution');
  assert.ok(indexHtml.includes('v1.5.4'), 'index.html must display version 1.5.0');
});

test('safe-area insets support for phone screens avoids system bar and notch overlap', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify CSS safe-area insets in header
  assert.ok(
    indexHtml.includes('padding-top: max(0px, env(safe-area-inset-top'),
    'Header must include safe-area-inset-top padding'
  );
  assert.ok(
    indexHtml.includes('calc(56px + max(0px, env(safe-area-inset-top'),
    'Header height must dynamically account for safe-area-inset-top'
  );

  // Verify CSS safe-area insets in sidebar footer and bottom navigation
  assert.ok(
    indexHtml.includes('padding-bottom: max(12px, calc(12px + env(safe-area-inset-bottom'),
    'Sidebar footer must account for bottom safe area'
  );
  assert.ok(
    indexHtml.includes('max(48px, calc(48px + env(safe-area-inset-bottom') ||
    indexHtml.includes('padding-bottom: max(20px, calc(20px + env(safe-area-inset-bottom'),
    'Article wrap must account for bottom safe area'
  );
  assert.ok(
    indexHtml.includes('--safe-area-inset-top'),
    'Must include fallback variable --safe-area-inset-top'
  );
  assert.ok(
    indexHtml.includes('--safe-area-inset-bottom'),
    'Must include fallback variable --safe-area-inset-bottom'
  );
});

test('chapter completion card and mark chapter complete button avoid horizontal scroll on mobile', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify responsive column layout and wrapping on mobile screens
  assert.ok(
    indexHtml.includes('.chapter-complete-card { flex-direction: column; align-items: stretch;'),
    'Mobile media query must stack chapter-complete-card vertically'
  );
  assert.ok(
    indexHtml.includes('.chapter-complete-btn { width: 100%; justify-content: center; white-space: normal;'),
    'Mobile media query must stretch button full-width with normal white-space to prevent overflow'
  );
  assert.ok(
    indexHtml.includes('box-sizing: border-box;'),
    'Base styles must apply box-sizing: border-box to layout containers'
  );
  assert.ok(
    indexHtml.includes('max-width: 100%;'),
    'Base styles must constrain button and cards to max-width: 100%'
  );
});

test('math formulas and reading detail pane prevent horizontal scrolling on mobile', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify reading pane overflow-x is hidden and bounded
  assert.ok(
    indexHtml.includes('main.content-area {') &&
    indexHtml.includes('overflow-x: hidden;') &&
    indexHtml.includes('min-width: 0;'),
    'main.content-area must contain overflow-x and have min-width: 0'
  );

  // Verify math-display has overflow-x auto and max-width 100%
  assert.ok(
    indexHtml.includes('.math-display {') &&
    indexHtml.includes('overflow-x: auto;') &&
    indexHtml.includes('-webkit-overflow-scrolling: touch;'),
    'math-display must scroll horizontally inside its container'
  );

  // Verify katex-display has max-width: 100%
  assert.ok(
    indexHtml.includes('.math-display .katex-display') ||
    indexHtml.includes('.lesson-article .katex-display'),
    'katex-display must have responsive overflow containment'
  );
});

test('top header view-switcher navigation is horizontally scrollable on mobile screens', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify view-switcher has overflow-x auto, touch-action pan-x, and flex container
  assert.ok(
    indexHtml.includes('.view-switcher {') &&
    indexHtml.includes('overflow-x: auto;') &&
    indexHtml.includes('touch-action: pan-x;'),
    'view-switcher must support horizontal swipe and touch scrolling'
  );

  // Verify view-btn does not wrap or compress
  assert.ok(
    indexHtml.includes('flex-shrink: 0;') &&
    indexHtml.includes('white-space: nowrap;'),
    'view buttons must preserve width with flex-shrink: 0 and white-space: nowrap'
  );

  // Verify header-left flex containment
  assert.ok(
    indexHtml.includes('.header-left {') &&
    indexHtml.includes('min-width: 0;') &&
    indexHtml.includes('flex: 1;'),
    'header-left must have min-width: 0 and flex: 1 to allow view-switcher scrolling'
  );
});

test('python playground compact select button with horizontal marquee prevents vertical stretching and horizontal overflow', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify custom-select-box and marquee viewport in base CSS
  assert.ok(
    indexHtml.includes('.custom-select-box {') &&
    indexHtml.includes('height: 34px;') &&
    indexHtml.includes('overflow: hidden;'),
    'custom-select-box must constrain height to 34px and clip overflow'
  );

  // Verify marquee scrolling animation
  assert.ok(
    indexHtml.includes('@keyframes selectMarqueeScroll') &&
    indexHtml.includes('transform: translateX(-50%);'),
    'selectMarqueeScroll keyframes must provide seamless horizontal loop'
  );

  // Verify mobile media query row layout and compact 34px height
  assert.ok(
    indexHtml.includes('.preset-selector-wrap { width: 100%; max-width: 100%; display: flex; flex-direction: row; align-items: center; gap: 8px; }'),
    'Mobile media query must format preset-selector-wrap as single row'
  );
  assert.ok(
    indexHtml.includes('.custom-select-box { height: 34px; min-height: 34px; max-height: 34px; padding: 0 8px; flex: 1; }'),
    'Mobile media query must maintain compact 34px height for custom-select-box'
  );

  // Verify playground-actions 2-column grid on mobile
  assert.ok(
    indexHtml.includes('.playground-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr;'),
    'Mobile media query must format playground-actions as responsive grid'
  );

  // Verify marquee elements in DOM markup
  assert.ok(
    indexHtml.includes('id="snippetTitleMarquee"') &&
    indexHtml.includes('id="pythonSnippetTitleMarquee"'),
    'DOM must include marquee text elements for JS and Python playground selectors'
  );
});

test('native Android downloader bridge and local book download integration', () => {
  const appJsPath = path.join(__dirname, 'dist', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // Verify downloadBookLocally function exists
  assert.ok(
    appJs.includes('async function downloadBookLocally(fileUrl, fileName, mimeType)'),
    'app.js must define downloadBookLocally handler'
  );

  // Verify AndroidDownloader bridge invocation
  assert.ok(
    appJs.includes('window.AndroidDownloader.downloadBlob(fileName,'),
    'downloadBookLocally must pass base64 blob to AndroidDownloader.downloadBlob'
  );

  // Verify fallback to Blob URL download
  assert.ok(
    appJs.includes('URL.createObjectURL(blob)'),
    'downloadBookLocally must fall back to Blob URL download for desktop / web'
  );

  // Verify reader export buttons wired
  assert.ok(
    appJs.includes('readerExportEpubBtn.addEventListener') &&
    appJs.includes('readerExportPdfBtn.addEventListener'),
    'Reader toolbar must wire EPUB and PDF download buttons'
  );
});


