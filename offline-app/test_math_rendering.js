'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const OFFLINE_APP_DIR = path.resolve(__dirname);
const DIST_DIR = path.join(OFFLINE_APP_DIR, 'dist');
const DATA_DIR = path.join(DIST_DIR, 'data');
const LESSONS_DIR = path.join(DATA_DIR, 'lessons');
const FONTS_DIR = path.join(DIST_DIR, 'fonts');
const { renderMathInHtml } = require('../scripts/build-offline-bundle');

test('offline KaTeX assets and fonts are packaged with zero external network dependencies', () => {
  const katexJsPath = path.join(DIST_DIR, 'katex.min.js');
  const katexCssPath = path.join(DIST_DIR, 'katex.min.css');
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');

  assert.ok(fs.existsSync(katexJsPath), 'dist/katex.min.js must exist');
  assert.ok(fs.statSync(katexJsPath).size > 100000, 'katex.min.js must be non-empty and bundled');

  assert.ok(fs.existsSync(katexCssPath), 'dist/katex.min.css must exist');
  assert.ok(fs.statSync(katexCssPath).size > 10000, 'katex.min.css must be non-empty and bundled');

  // Verify index.html loads local KaTeX assets
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.ok(indexHtml.includes('href="katex.min.css"'), 'index.html must link to local katex.min.css');
  assert.ok(indexHtml.includes('src="katex.min.js"'), 'index.html must include local katex.min.js script');

  // Verify zero external network references in katex.min.css (Gate 4 compliance)
  const katexCss = fs.readFileSync(katexCssPath, 'utf8');
  assert.doesNotMatch(katexCss, /https?:\/\//, 'katex.min.css must contain zero external URLs');

  // Verify local KaTeX woff2 fonts
  assert.ok(fs.existsSync(FONTS_DIR), 'fonts directory must exist');
  const fontFiles = fs.readdirSync(FONTS_DIR);
  const katexFonts = fontFiles.filter(f => f.startsWith('KaTeX_') && f.endsWith('.woff2'));
  assert.ok(katexFonts.length >= 15, `Must have bundled at least 15 KaTeX woff2 font files, found: ${katexFonts.length}`);
});

test('scans all 542 pre-rendered lesson pages and confirms every single math formula is rendered', () => {
  assert.ok(fs.existsSync(LESSONS_DIR), 'dist/data/lessons must exist');

  let totalLessonsInspected = 0;
  let totalInlineRendered = 0;
  let totalDisplayRendered = 0;
  let unrenderedInlineCount = 0;
  let unrenderedDisplayCount = 0;
  const lessonsWithUnrendered = [];

  const phaseDirs = fs.readdirSync(LESSONS_DIR).sort();

  for (const phaseDir of phaseDirs) {
    const phasePath = path.join(LESSONS_DIR, phaseDir);
    if (!fs.statSync(phasePath).isDirectory()) continue;

    const lessonFiles = fs.readdirSync(phasePath).filter(f => f.endsWith('.json')).sort();

    for (const lessonFile of lessonFiles) {
      totalLessonsInspected++;
      const filePath = path.join(phasePath, lessonFile);
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const html = payload.html || '';

      // Check for unrendered math spans or divs (lacking data-math-rendered="true")
      const unrenderedInline = html.match(/<span class="math-inline" data-math="inline">(?![\s\S]*?data-math-rendered)/g);
      const unrenderedDisplay = html.match(/<div class="math-display" data-math="display">(?![\s\S]*?data-math-rendered)/g);

      // More strict check: find any math tag without data-math-rendered="true" attribute on the opening tag
      const rawInlineTags = html.match(/<span class="math-inline"[^>]*>/g) || [];
      const rawDisplayTags = html.match(/<div class="math-display"[^>]*>/g) || [];

      for (const tag of rawInlineTags) {
        if (!tag.includes('data-math-rendered="true"')) {
          unrenderedInlineCount++;
          lessonsWithUnrendered.push({ file: `${phaseDir}/${lessonFile}`, tag });
        }
      }

      for (const tag of rawDisplayTags) {
        if (!tag.includes('data-math-rendered="true"')) {
          unrenderedDisplayCount++;
          lessonsWithUnrendered.push({ file: `${phaseDir}/${lessonFile}`, tag });
        }
      }

      // Count rendered math formulas
      const renderedInlineMatches = html.match(/<span class="math-inline" data-math="inline" data-math-rendered="true"[^>]*>([\s\S]*?)<\/span>/g) || [];
      const renderedDisplayMatches = html.match(/<div class="math-display" data-math="display" data-math-rendered="true"[^>]*>([\s\S]*?)<\/div>/g) || [];

      totalInlineRendered += renderedInlineMatches.length;
      totalDisplayRendered += renderedDisplayMatches.length;

      // Verify each rendered element actually contains KaTeX HTML or MathML
      for (const rendered of renderedInlineMatches) {
        assert.ok(
          rendered.includes('class="katex"') || rendered.includes('<math'),
          `Rendered inline math must contain KaTeX markup in ${phaseDir}/${lessonFile}`
        );
      }

      for (const rendered of renderedDisplayMatches) {
        assert.ok(
          rendered.includes('class="katex"') || rendered.includes('<math'),
          `Rendered display math must contain KaTeX markup in ${phaseDir}/${lessonFile}`
        );
      }
    }
  }

  assert.equal(totalLessonsInspected, 542, 'Must have inspected all 542 pre-rendered lesson pages');
  assert.equal(unrenderedInlineCount, 0, `Found ${unrenderedInlineCount} unrendered inline math formulas: ${JSON.stringify(lessonsWithUnrendered.slice(0, 5))}`);
  assert.equal(unrenderedDisplayCount, 0, `Found ${unrenderedDisplayCount} unrendered display math formulas`);
  assert.equal(totalInlineRendered, 3006, 'Must have rendered all 3,006 curriculum inline math formulas');
  assert.equal(totalDisplayRendered, 413, 'Must have rendered all 413 curriculum display math formulas');
  assert.equal(totalInlineRendered + totalDisplayRendered, 3419, 'Must have rendered exactly 3,419 total math formulas across curriculum');
});

test('scans entire curriculum text for raw unrendered math delimiters outside code blocks', () => {
  const phaseDirs = fs.readdirSync(LESSONS_DIR).sort();
  const strayMathOccurrences = [];

  for (const phaseDir of phaseDirs) {
    const phasePath = path.join(LESSONS_DIR, phaseDir);
    if (!fs.statSync(phasePath).isDirectory()) continue;

    const lessonFiles = fs.readdirSync(phasePath).filter(f => f.endsWith('.json')).sort();

    for (const lessonFile of lessonFiles) {
      const filePath = path.join(phasePath, lessonFile);
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let text = payload.html || '';

      // Strip pre-formatted code blocks
      text = text.replace(/<pre[\s\S]*?<\/pre>/g, ' ');
      // Strip inline code spans
      text = text.replace(/<code[\s\S]*?<\/code>/g, ' ');
      // Strip fully rendered math containers
      text = text.replace(/<div class="math-display"[^>]*>[\s\S]*?<\/div>/g, ' ');
      text = text.replace(/<span class="math-inline"[^>]*>[\s\S]*?<\/span>/g, ' ');

      // Verify no unrendered display math fences remain in plain text
      if (text.includes('$$')) {
        strayMathOccurrences.push({ file: `${phaseDir}/${lessonFile}`, pattern: '$$' });
      }
    }
  }

  assert.equal(strayMathOccurrences.length, 0, `No unrendered math delimiters must remain: ${JSON.stringify(strayMathOccurrences)}`);
});

test('verifies inline math within table cells and bullet lists are rendered', () => {
  // Phase 01 Lesson 01 contains table math and list math
  const lessonPath = path.join(LESSONS_DIR, '01-math-foundations', '01-linear-algebra-intuition.json');
  assert.ok(fs.existsSync(lessonPath), '01-linear-algebra-intuition.json must exist');

  const payload = JSON.parse(fs.readFileSync(lessonPath, 'utf8'));
  const html = payload.html;

  // Verify table cells with math are rendered
  const tableWithMath = html.match(/<td[^>]*>[\s\S]*?<span class="math-inline" data-math="inline" data-math-rendered="true"[\s\S]*?<\/td>/g);
  assert.ok(tableWithMath && tableWithMath.length > 0, 'Table cells containing math must be rendered with data-math-rendered="true"');

  // Verify list items with math are rendered
  const listWithMath = html.match(/<li[^>]*>[\s\S]*?<span class="math-inline" data-math="inline" data-math-rendered="true"[\s\S]*?<\/li>/g);
  assert.ok(listWithMath && listWithMath.length > 0, 'List items containing math must be rendered with data-math-rendered="true"');
});

test('verifies client-side dynamic KaTeX rendering in app.js and syntax integrity', () => {
  const appJsPath = path.join(DIST_DIR, 'app.js');
  assert.ok(fs.existsSync(appJsPath), 'dist/app.js must exist');

  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // Verify client-side dynamic math render fallback is wired
  assert.ok(appJs.includes('window.katex'), 'app.js must check window.katex for runtime math rendering');
  assert.ok(appJs.includes('data-math-rendered'), 'app.js must mark rendered elements with data-math-rendered attribute');

  // Verify zero VM syntax errors
  assert.doesNotThrow(() => {
    new vm.Script(appJs, { filename: 'app.js' });
  }, 'app.js with KaTeX hooks must parse with zero syntax errors');
});

test('verifies renderMathInHtml unit helper directly', () => {
  const katex = require(path.join(DIST_DIR, 'katex.min.js'));
  assert.ok(katex && katex.renderToString, 'KaTeX must be loaded');

  const sampleHtml = `
    <p>Inline formula: <span class="math-inline" data-math="inline">\\sqrt{a^2 + b^2} = c</span> in prose.</p>
    <div class="math-display" data-math="display">\\sum_{i=1}^n x_i = \\mu</div>
  `;

  const rendered = renderMathInHtml(sampleHtml, katex);

  assert.ok(rendered.includes('class="math-inline" data-math="inline" data-math-rendered="true"'), 'Inline math must be marked rendered');
  assert.ok(rendered.includes('class="math-display" data-math="display" data-math-rendered="true"'), 'Display math must be marked rendered');
  assert.ok(rendered.includes('class="katex"'), 'Rendered output must contain KaTeX classes');
  assert.ok(rendered.includes('data-tex="\\sqrt{a^2 + b^2} = c"'), 'Original TeX must be preserved in data-tex attribute');
});
