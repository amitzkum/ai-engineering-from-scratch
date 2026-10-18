'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateVolumeManifest,
  formatVolumeStats,
  filterVolumes,
  getVolumeDownloadUrl,
  getVolumePdfUrl,
  getVolumeReaderUrl,
  renderVolumeCardHtml,
} = require('./library-controller');

const BOOKS_DIR = path.join(__dirname, 'dist', 'books');
const LIBRARY_JSON_PATH = path.join(BOOKS_DIR, 'library.json');

test('validateVolumeManifest validates manifest structure and catches missing fields', () => {
  const invalidManifest1 = 'not-an-array';
  assert.equal(validateVolumeManifest(invalidManifest1).valid, false);

  const invalidManifest2 = [
    { id: 'vol-1' }, // missing number, title, files, counts
  ];
  const res2 = validateVolumeManifest(invalidManifest2);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.length > 0);

  const validManifest = [
    { id: 'v1', number: 1, roman: 'I', title: 'T1', epubFile: 'v1.epub', htmlFile: 'v1.html', chapterCount: 56, wordCount: 150000 },
    { id: 'v2', number: 2, roman: 'II', title: 'T2', epubFile: 'v2.epub', htmlFile: 'v2.html', chapterCount: 58, wordCount: 120000 },
    { id: 'v3', number: 3, roman: 'III', title: 'T3', epubFile: 'v3.epub', htmlFile: 'v3.html', chapterCount: 45, wordCount: 70000 },
    { id: 'v4', number: 4, roman: 'IV', title: 'T4', epubFile: 'v4.epub', htmlFile: 'v4.html', chapterCount: 68, wordCount: 180000 },
    { id: 'v5', number: 5, roman: 'V', title: 'T5', epubFile: 'v5.epub', htmlFile: 'v5.html', chapterCount: 171, wordCount: 330000 },
    { id: 'v6', number: 6, roman: 'VI', title: 'T6', epubFile: 'v6.epub', htmlFile: 'v6.html', chapterCount: 144, wordCount: 190000 },
  ];
  const resValid = validateVolumeManifest(validManifest);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});

test('formatVolumeStats formats chapter, word, and size labels accurately', () => {
  const stats1 = formatVolumeStats({ chapterCount: 1, wordCount: 850, epubSizeKb: 450 });
  assert.equal(stats1.chapterLabel, '1 Chapter');
  assert.equal(stats1.wordLabel, '850 Words');
  assert.equal(stats1.sizeLabel, '450 KB');

  const stats2 = formatVolumeStats({ chapterCount: 56, wordCount: 159427, epubSizeKb: 1536 });
  assert.equal(stats2.chapterLabel, '56 Chapters');
  assert.equal(stats2.wordLabel, '159k Words');
  assert.equal(stats2.sizeLabel, '1.5 MB');

  const emptyStats = formatVolumeStats(null);
  assert.equal(emptyStats.chapterLabel, '0 Chapters');
});

test('filterVolumes accurately matches title, subtitle, Roman numeral, and phases', () => {
  const sampleVolumes = [
    { id: 'v1', number: 1, roman: 'I', title: 'Foundations', subtitle: 'Math & ML', phases: ['01-math', '02-python'] },
    { id: 'v2', number: 2, roman: 'II', title: 'Deep Learning', subtitle: 'Neural Networks', phases: ['03-nn', '04-cnn'] },
    { id: 'v5', number: 5, roman: 'V', title: 'Agents', subtitle: 'Autonomous Systems', phases: ['10-agent-loop'] },
  ];

  // Empty query returns all
  assert.equal(filterVolumes(sampleVolumes, '').length, 3);
  assert.equal(filterVolumes(sampleVolumes, '   ').length, 3);

  // Title search
  const foundTitle = filterVolumes(sampleVolumes, 'Deep');
  assert.equal(foundTitle.length, 1);
  assert.equal(foundTitle[0].number, 2);

  // Roman numeral search
  const foundRoman = filterVolumes(sampleVolumes, 'V');
  assert.equal(foundRoman.length, 1);
  assert.equal(foundRoman[0].number, 5);

  // Phase search
  const foundPhase = filterVolumes(sampleVolumes, 'agent-loop');
  assert.equal(foundPhase.length, 1);
  assert.equal(foundPhase[0].number, 5);
});

test('getVolumeDownloadUrl, getVolumePdfUrl, and getVolumeReaderUrl return correct relative asset paths', () => {
  const vol = { epubFile: 'volume-1-foundations.epub', htmlFile: 'volume-1-foundations.html', pdfFile: 'volume-1-foundations.pdf' };
  assert.equal(getVolumeDownloadUrl(vol), 'books/volume-1-foundations.epub');
  assert.equal(getVolumePdfUrl(vol), 'books/volume-1-foundations.pdf');
  assert.equal(getVolumeReaderUrl(vol), 'books/volume-1-foundations.html');

  assert.equal(getVolumeDownloadUrl(null), '#');
  assert.equal(getVolumePdfUrl(null), '#');
  assert.equal(getVolumeReaderUrl(null), '#');
});

test('renderVolumeCardHtml renders valid card markup with action buttons and data attributes', () => {
  const vol = {
    id: 'volume-1-foundations',
    number: 1,
    roman: 'I',
    title: 'Foundations',
    subtitle: 'From Mathematics to Machine Learning',
    phases: ['01-mathematics', '02-python-deep-dive'],
    chapterCount: 56,
    wordCount: 159427,
    epubFile: 'volume-1-foundations.epub',
    epubSizeKb: 435.1,
    htmlFile: 'volume-1-foundations.html',
    pdfFile: 'volume-1-foundations.pdf',
    pdfSizeKb: 7463.7,
  };

  const html = renderVolumeCardHtml(vol);
  assert.ok(html.includes('VOLUME I'));
  assert.ok(html.includes('Foundations'));
  assert.ok(html.includes('56 Chapters'));
  assert.ok(html.includes('159k Words'));
  assert.ok(html.includes('href="books/volume-1-foundations.epub"'));
  assert.ok(html.includes('data-url="books/volume-1-foundations.html"'));
  assert.ok(html.includes('download="volume-1-foundations.epub"'));
  assert.ok(html.includes('download="volume-1-foundations.pdf"'));
  assert.ok(html.includes('href="books/volume-1-foundations.pdf"'));
  assert.ok(html.includes('class="lib-action-btn primary read-vol-btn"'));
});

test('Pre-generated library.json exists and contains 6 curriculum volumes with 542 total chapters', () => {
  assert.ok(fs.existsSync(LIBRARY_JSON_PATH), 'library.json must exist in dist/books/');
  const manifest = JSON.parse(fs.readFileSync(LIBRARY_JSON_PATH, 'utf8'));

  const validation = validateVolumeManifest(manifest);
  assert.equal(validation.valid, true, `Manifest validation failed: ${validation.errors.join(', ')}`);
  assert.equal(manifest.length, 6);

  const totalChapters = manifest.reduce((acc, v) => acc + v.chapterCount, 0);
  assert.equal(totalChapters, 542, `Expected 542 total chapters across 6 volumes, got ${totalChapters}`);

  const totalWords = manifest.reduce((acc, v) => acc + v.wordCount, 0);
  assert.ok(totalWords > 500000, `Expected over 500k words, got ${totalWords}`);
});

test('Pre-generated EPUB files exist and conform to EPUB 3 zip requirements', () => {
  const manifest = JSON.parse(fs.readFileSync(LIBRARY_JSON_PATH, 'utf8'));

  for (const vol of manifest) {
    const epubPath = path.join(BOOKS_DIR, vol.epubFile);
    assert.ok(fs.existsSync(epubPath), `EPUB file ${vol.epubFile} must exist`);
    assert.ok(fs.statSync(epubPath).size > 100000, `EPUB file ${vol.epubFile} should be > 100KB`);

    // Verify ZIP magic bytes (PK\x03\x04)
    const fd = fs.openSync(epubPath, 'r');
    const headerBuf = Buffer.alloc(30);
    fs.readSync(fd, headerBuf, 0, 30, 0);
    fs.closeSync(fd);

    assert.equal(headerBuf[0], 0x50, 'EPUB must start with PK zip header');
    assert.equal(headerBuf[1], 0x4b, 'EPUB must start with PK zip header');
    assert.equal(headerBuf[2], 0x03, 'EPUB must start with PK zip header');
    assert.equal(headerBuf[3], 0x04, 'EPUB must start with PK zip header');

    // Filename length at offset 26
    const fileNameLen = headerBuf.readUInt16LE(26);
    assert.equal(fileNameLen, 8, 'First file in EPUB zip must be "mimetype" (8 bytes)');

    // Read filename
    const nameBuf = Buffer.alloc(8);
    const fd2 = fs.openSync(epubPath, 'r');
    fs.readSync(fd2, nameBuf, 0, 8, 30);
    fs.closeSync(fd2);
    assert.equal(nameBuf.toString('utf8'), 'mimetype');
  }
});

test('Pre-generated standalone HTML readers exist and contain full volume contents and anchors', () => {
  const manifest = JSON.parse(fs.readFileSync(LIBRARY_JSON_PATH, 'utf8'));

  for (const vol of manifest) {
    const htmlPath = path.join(BOOKS_DIR, vol.htmlFile);
    assert.ok(fs.existsSync(htmlPath), `HTML file ${vol.htmlFile} must exist`);
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(content.includes('<!DOCTYPE html>'));
    assert.ok(content.includes(`Volume ${vol.roman}: ${vol.title}`));
    assert.ok(content.includes('<nav class="reader-nav">'));
    assert.ok(content.includes('<main>'));

    // Count chapter occurrences
    const chapterMatches = content.match(/<article class="reader-chapter"/g);
    assert.ok(chapterMatches, `No chapters found in ${vol.htmlFile}`);
    assert.equal(chapterMatches.length, vol.chapterCount, `Mismatch in chapter count for volume ${vol.number}`);

    // Verify tables are rendered with table-wrap and table elements
    assert.ok(content.includes('<div class="table-wrap">'), `Volume ${vol.number} must contain table-wrap containers`);
    assert.ok(content.includes('<table>'), `Volume ${vol.number} must contain table elements`);

    // Verify math formulas are pre-rendered into KaTeX HTML
    assert.ok(content.includes('class="katex"'), `Volume ${vol.number} must contain pre-rendered KaTeX math`);

    // Verify diagrams have container markup
    assert.ok(content.includes('class="mermaid-container"'), `Volume ${vol.number} must contain mermaid diagram containers`);

    // Verify horizontal overflow containment CSS
    assert.ok(content.includes('overflow-x: hidden;'), `Volume ${vol.number} must contain overflow-x hidden containment`);
    assert.ok(content.includes('.table-wrap {'), `Volume ${vol.number} must contain .table-wrap styling`);
  }
});

test('Standalone book reader pane in app bundle contains responsive toolbar and overflow-x containment', () => {
  const indexHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify book-reader-view has overflow-x hidden and box-sizing
  assert.ok(
    indexHtml.includes('.book-reader-view {') &&
    indexHtml.includes('overflow-x: hidden;') &&
    indexHtml.includes('box-sizing: border-box;'),
    'book-reader-view must have overflow-x: hidden and box-sizing: border-box'
  );

  // Verify reader-toolbar has gap and max-width containment
  assert.ok(
    indexHtml.includes('.reader-toolbar {') &&
    indexHtml.includes('box-sizing: border-box;') &&
    indexHtml.includes('overflow-x: hidden;'),
    'reader-toolbar must contain overflow and have box-sizing'
  );

  // Verify mobile responsive styles for reader-toolbar
  assert.ok(
    indexHtml.includes('.reader-toolbar { padding: 6px 10px; gap: 6px; }'),
    'Mobile media query must format reader-toolbar compactly'
  );
  assert.ok(
    indexHtml.includes('.reader-vol-title { width: 100%; order: -1;'),
    'Mobile media query must place reader-vol-title full-width above buttons'
  );
});
