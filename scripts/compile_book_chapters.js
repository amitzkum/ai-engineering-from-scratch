#!/usr/bin/env node
'use strict';

/**
 * compile_book_chapters.js
 *
 * Pre-renders book chapters using site/lesson-markdown.js and KaTeX math pre-rendering.
 * Produces rich, fully styled HTML chapters with tables, KaTeX math formulas,
 * and diagram containers.
 *
 * Attribution:
 * - App Architecture & Packaging: Amit Kumar
 * - Curriculum Source: AI Engineering from Scratch Contributors
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseMd } = require('../site/lesson-markdown');

const ROOT = path.resolve(__dirname, '..');
const PHASES_DIR = path.join(ROOT, 'phases');
const VOLUMES_JSON = path.join(ROOT, 'book', 'volumes.json');
const DIST_DIR = path.join(ROOT, 'offline-app', 'dist');

let katex = null;
const katexPath = path.join(DIST_DIR, 'katex.min.js');
if (fs.existsSync(katexPath)) {
  try {
    katex = require(katexPath);
  } catch (_) {}
}

function unescapeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function renderMathInHtml(html, katexInstance) {
  if (!katexInstance) return html;
  html = html.replace(/<div class="math-display" data-math="display">([\s\S]*?)<\/div>/g, (match, rawTex) => {
    const tex = unescapeHtml(rawTex.trim());
    try {
      const rendered = katexInstance.renderToString(tex, { displayMode: true, throwOnError: false, strict: 'ignore' });
      return `<div class="math-display">${rendered}</div>`;
    } catch (_) { return match; }
  });
  html = html.replace(/<span class="math-inline" data-math="inline">([\s\S]*?)<\/span>/g, (match, rawTex) => {
    const tex = unescapeHtml(rawTex.trim());
    try {
      const rendered = katexInstance.renderToString(tex, { displayMode: false, throwOnError: false, strict: 'ignore' });
      return `<span class="math-inline">${rendered}</span>`;
    } catch (_) { return match; }
  });
  return html;
}

function compileVolumeChapters(volNum) {
  const volumesData = JSON.parse(fs.readFileSync(VOLUMES_JSON, 'utf8'));
  const volumeCfg = volumesData.volumes.find(v => v.number === volNum);
  if (!volumeCfg) {
    throw new Error(`Volume ${volNum} not found in volumes.json`);
  }

  const chapters = [];
  let totalWords = 0;

  for (const phaseDir of volumeCfg.phases) {
    const phasePath = path.join(PHASES_DIR, phaseDir);
    if (!fs.existsSync(phasePath)) continue;

    const lessonDirs = fs.readdirSync(phasePath, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{2}-/.test(d.name))
      .map(d => d.name)
      .sort();

    for (const lDir of lessonDirs) {
      const docPath = path.join(phasePath, lDir, 'docs', 'en.md');
      if (!fs.existsSync(docPath)) continue;

      const mdContent = fs.readFileSync(docPath, 'utf8');
      const words = mdContent.split(/\s+/).filter(Boolean).length;
      totalWords += words;

      // Extract title
      let title = lDir;
      for (const line of mdContent.split(/\r?\n/)) {
        if (line.startsWith('# ')) {
          title = line.slice(2).trim();
          break;
        }
      }

      const rawHtml = parseMd(mdContent);
      const renderedHtml = renderMathInHtml(rawHtml, katex);

      const chapterId = `chap-${String(chapters.length + 1).padStart(3, '0')}`;
      chapters.push({
        id: chapterId,
        file: `${chapterId}.xhtml`,
        title,
        phase: phaseDir,
        slug: lDir,
        words,
        html: renderedHtml,
      });
    }
  }

  return {
    number: volNum,
    slug: volumeCfg.slug,
    title: volumeCfg.title,
    subtitle: volumeCfg.subtitle || '',
    phases: volumeCfg.phases,
    chapterCount: chapters.length,
    wordCount: totalWords,
    chapters,
  };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'all') {
    const volumesData = JSON.parse(fs.readFileSync(VOLUMES_JSON, 'utf8'));
    const result = volumesData.volumes.map(v => compileVolumeChapters(v.number));
    process.stdout.write(JSON.stringify(result));
  } else {
    const volNum = parseInt(arg, 10) || 1;
    const result = compileVolumeChapters(volNum);
    process.stdout.write(JSON.stringify(result));
  }
}

module.exports = { compileVolumeChapters };
