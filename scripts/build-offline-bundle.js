#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseMd } = require('../site/lesson-markdown');

const REPO_ROOT = path.resolve(__dirname, '..');
const PHASES_DIR = path.join(REPO_ROOT, 'phases');
const DIST_DIR = path.join(REPO_ROOT, 'offline-app', 'dist');
const DATA_DIR = path.join(DIST_DIR, 'data');
const LESSONS_DIR = path.join(DATA_DIR, 'lessons');
const FONTS_DIR = path.join(DIST_DIR, 'fonts');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

// Helper to ensure directories exist
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Download a remote file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Extract metadata from markdown content
function extractMetadata(md) {
  const lines = md.split(/\r?\n/);
  let title = 'Untitled Lesson';
  let hook = '';
  let type = 'Learn';
  let languages = 'Python';
  let prerequisites = 'None';
  let time = '~30m';
  const objectives = [];

  let inObjectives = false;

  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ') && title === 'Untitled Lesson') {
      title = line.slice(2).trim();
    } else if (line.startsWith('> ') && !hook) {
      hook = line.slice(2).trim();
    } else if (line.includes('**Type:**')) {
      const match = line.match(/\*\*Type:\*\*\s*([^•*|\n]+)/);
      if (match) type = match[1].trim();
    } else if (line.includes('**Languages:**')) {
      const match = line.match(/\*\*Languages:\*\*\s*([^•*|\n]+)/);
      if (match) languages = match[1].trim();
    } else if (line.includes('**Prerequisites:**')) {
      const match = line.match(/\*\*Prerequisites:\*\*\s*([^•*|\n]+)/);
      if (match) prerequisites = match[1].trim();
    } else if (line.includes('**Time:**')) {
      const match = line.match(/\*\*Time:\*\*\s*([^•*|\n]+)/);
      if (match) time = match[1].trim();
    }

    if (line.startsWith('## Learning Objectives')) {
      inObjectives = true;
      continue;
    }
    if (inObjectives) {
      if (line.startsWith('- ')) {
        objectives.push(line.slice(2).trim());
      } else if (line.startsWith('## ') || line.startsWith('---')) {
        inObjectives = false;
      }
    }
  }

  return { title, hook, type, languages, prerequisites, time, objectives };
}

async function bundleFonts() {
  console.log('📦 Bundling offline fonts (Source Serif 4, JetBrains Mono, VT323)...');
  ensureDir(FONTS_DIR);

  const fonts = [
    {
      name: 'jetbrains-mono-400.woff2',
      url: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwhsk.woff2',
      family: 'JetBrains Mono',
      weight: '400',
      style: 'normal',
    },
    {
      name: 'jetbrains-mono-700.woff2',
      url: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwhsk.woff2',
      family: 'JetBrains Mono',
      weight: '700',
      style: 'normal',
    },
    {
      name: 'source-serif-4-normal.woff2',
      url: 'https://fonts.gstatic.com/s/sourceserif4/v15/vEFI2_tTDB4M7-auWDN0ahZJW1gV8tenXg.woff2',
      family: 'Source Serif 4',
      weight: '400 700',
      style: 'normal',
    },
    {
      name: 'source-serif-4-italic.woff2',
      url: 'https://fonts.gstatic.com/s/sourceserif4/v15/vEFK2_tTDB4M7-auWDN0ahZJW1gewtu_Wo7H.woff2',
      family: 'Source Serif 4',
      weight: '400 700',
      style: 'italic',
    },
    {
      name: 'vt323-400.woff2',
      url: 'https://fonts.gstatic.com/s/vt323/v18/pxiKyp0ihIEF2isRFJXGdg.woff2',
      family: 'VT323',
      weight: '400',
      style: 'normal',
    },
  ];

  let fontCss = '/* Offline Local Fonts */\n';
  for (const font of fonts) {
    const dest = path.join(FONTS_DIR, font.name);
    try {
      await downloadFile(font.url, dest);
      fontCss += `@font-face {
  font-family: '${font.family}';
  font-style: ${font.style};
  font-weight: ${font.weight};
  font-display: swap;
  src: url('fonts/${font.name}') format('woff2');
}\n`;
    } catch (err) {
      console.warn(`Could not download ${font.name}, will use system font fallback:`, err.message);
    }
  }

  fs.writeFileSync(path.join(DIST_DIR, 'fonts.css'), fontCss, 'utf8');
  console.log('   wrote dist/fonts.css');
}

async function bundleMermaid() {
  console.log('📊 Bundling offline Mermaid diagram renderer...');
  const dest = path.join(DIST_DIR, 'mermaid.min.js');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) {
    return;
  }
  const tmpPath = '/tmp/mermaid.min.js';
  if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000000) {
    fs.copyFileSync(tmpPath, dest);
    console.log('   bundled dist/mermaid.min.js from cache');
    return;
  }
  try {
    await downloadFile('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js', dest);
    console.log('   downloaded dist/mermaid.min.js');
  } catch (err) {
    console.warn('Could not bundle mermaid.min.js:', err.message);
  }
}

function copyStaticAssets() {
  console.log('🎨 Copying CSS and SVG diagram assets...');
  ensureDir(ASSETS_DIR);
  
  // Copy site styles
  const styles = ['style.css', 'certifications.css'];
  for (const s of styles) {
    const src = path.join(REPO_ROOT, 'site', s);
    if (fs.existsSync(src)) {
      let content = fs.readFileSync(src, 'utf8');
      // Remove Google fonts import if any
      content = content.replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g, '');
      fs.writeFileSync(path.join(DIST_DIR, s), content, 'utf8');
    }
  }

  // Extract lesson CSS from site/lesson.html
  const lessonHtmlPath = path.join(REPO_ROOT, 'site', 'lesson.html');
  if (fs.existsSync(lessonHtmlPath)) {
    const lessonHtml = fs.readFileSync(lessonHtmlPath, 'utf8');
    const match = lessonHtml.match(/<style>([\s\S]*?)<\/style>/);
    if (match) {
      let lessonCss = match[1];
      lessonCss = lessonCss.replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g, '');
      fs.writeFileSync(path.join(DIST_DIR, 'lesson.css'), lessonCss, 'utf8');
      console.log('   wrote dist/lesson.css');
    }
  }

  // Copy site/assets/figures
  const figuresSrc = path.join(REPO_ROOT, 'site', 'assets', 'figures');
  const figuresDest = path.join(ASSETS_DIR, 'figures');
  ensureDir(figuresDest);
  if (fs.existsSync(figuresSrc)) {
    for (const f of fs.readdirSync(figuresSrc)) {
      if (f.endsWith('.svg') || f.endsWith('.png')) {
        fs.copyFileSync(path.join(figuresSrc, f), path.join(figuresDest, f));
      }
    }
  }

  // Copy all interactive figure scripts from site/
  const siteDir = path.join(REPO_ROOT, 'site');
  if (fs.existsSync(siteDir)) {
    for (const f of fs.readdirSync(siteDir)) {
      if ((f.startsWith('figures') && f.endsWith('.js')) || f === 'lesson-figures.js' || f === 'figure-manifest.js') {
        fs.copyFileSync(path.join(siteDir, f), path.join(DIST_DIR, f));
      }
    }
  }

  // Copy search-engine.js
  const searchEngineJs = path.join(REPO_ROOT, 'offline-app', 'search-engine.js');
  if (fs.existsSync(searchEngineJs)) {
    fs.copyFileSync(searchEngineJs, path.join(DIST_DIR, 'search-engine.js'));
  }

  // Copy viewer-controller.js
  const viewerControllerJs = path.join(REPO_ROOT, 'offline-app', 'viewer-controller.js');
  if (fs.existsSync(viewerControllerJs)) {
    fs.copyFileSync(viewerControllerJs, path.join(DIST_DIR, 'viewer-controller.js'));
  }
}

async function buildCurriculum() {
  console.log('📚 Pre-rendering 542 lessons and quizzes...');
  ensureDir(DATA_DIR);
  ensureDir(LESSONS_DIR);

  const phaseDirs = fs.readdirSync(PHASES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{2}-/.test(d.name))
    .map(d => d.name)
    .sort();

  const curriculum = {
    phases: [],
    totalLessons: 0,
    generatedAt: new Date().toISOString(),
  };

  let processedCount = 0;

  for (const phaseDir of phaseDirs) {
    const phasePath = path.join(PHASES_DIR, phaseDir);
    const phaseNumber = parseInt(phaseDir.slice(0, 2), 10);
    const phaseSlug = phaseDir.replace(/^\d{2}-/, '');
    
    // Read phase title
    let phaseTitle = phaseDir.replace(/^\d{2}-/, '').replace(/-/g, ' ');
    phaseTitle = phaseTitle.charAt(0).toUpperCase() + phaseTitle.slice(1);
    const phaseReadme = path.join(phasePath, 'README.md');
    if (fs.existsSync(phaseReadme)) {
      const readmeFirstLine = fs.readFileSync(phaseReadme, 'utf8').split('\n')[0] || '';
      if (readmeFirstLine.startsWith('# ')) {
        phaseTitle = readmeFirstLine.slice(2).trim();
      }
    }

    const lessonDirs = fs.readdirSync(phasePath, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{2}-/.test(d.name))
      .map(d => d.name)
      .sort();

    const phaseObj = {
      id: phaseDir,
      number: phaseNumber,
      slug: phaseSlug,
      title: phaseTitle,
      lessons: [],
    };

    const phaseLessonsDir = path.join(LESSONS_DIR, phaseDir);
    ensureDir(phaseLessonsDir);

    for (const lessonDir of lessonDirs) {
      const lessonPath = path.join(phasePath, lessonDir);
      const enMdPath = path.join(lessonPath, 'docs', 'en.md');
      const quizJsonPath = path.join(lessonPath, 'quiz.json');

      if (!fs.existsSync(enMdPath)) continue;

      const mdContent = fs.readFileSync(enMdPath, 'utf8');
      const metadata = extractMetadata(mdContent);
      const htmlContent = parseMd(mdContent);

      let quizData = null;
      if (fs.existsSync(quizJsonPath)) {
        try {
          const rawQuiz = JSON.parse(fs.readFileSync(quizJsonPath, 'utf8'));
          if (Array.isArray(rawQuiz)) {
            quizData = { questions: rawQuiz };
          } else if (rawQuiz && Array.isArray(rawQuiz.questions)) {
            quizData = rawQuiz;
          }
        } catch (_) {}
      }

      const lessonSummary = {
        id: `${phaseDir}/${lessonDir}`,
        phaseId: phaseDir,
        lessonDir: lessonDir,
        title: metadata.title,
        hook: metadata.hook,
        type: metadata.type,
        languages: metadata.languages,
        prerequisites: metadata.prerequisites,
        time: metadata.time,
        objectives: metadata.objectives,
        hasQuiz: !!(quizData && quizData.questions && quizData.questions.length),
      };

      phaseObj.lessons.push(lessonSummary);
      curriculum.totalLessons++;
      processedCount++;

      // Save individual lesson full pre-rendered payload
      const lessonPayload = {
        ...lessonSummary,
        html: htmlContent,
        quiz: quizData,
      };

      const lessonFile = path.join(phaseLessonsDir, `${lessonDir}.json`);
      fs.writeFileSync(lessonFile, JSON.stringify(lessonPayload), 'utf8');
    }

    curriculum.phases.push(phaseObj);
  }

  // Save the master curriculum manifest
  fs.writeFileSync(path.join(DATA_DIR, 'curriculum.json'), JSON.stringify(curriculum), 'utf8');
  console.log(`✅ Pre-rendered ${processedCount} lessons across ${curriculum.phases.length} phases.`);
  return curriculum;
}

function generateOfflineShell() {
  console.log('📱 Generating adaptive tablet/phone offline shell (index.html & app.js)...');
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>AI Engineering from Scratch</title>
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="lesson.css">
  <link rel="stylesheet" href="certifications.css">
  <style>
    :root {
      --bg: #0d1117;
      --bg-surface: #161b22;
      --bg-card: #21262d;
      --bg-card-hover: #292e36;
      --code-bg: #161b22;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --border: #30363d;
      --success: #3fb950;
      --danger: #f85149;
      --warn: #d29922;

      /* Compatible variables for figures and site components */
      --ink: #c9d1d9;
      --ink-soft: #8b949e;
      --ink-mute: #6e7681;
      --blueprint: #58a6ff;
      --blueprint-tint: rgba(88, 166, 255, 0.1);
      --blueprint-tint-strong: rgba(88, 166, 255, 0.2);
      --rule-soft: #30363d;
      --font-mono: 'JetBrains Mono', monospace;
      --font-body: 'Source Serif 4', Georgia, serif;
      --sidebar-width: 340px;
      --reader-font-size: 1.05rem;
      --reader-line-height: 1.75;
    }
    [data-theme="amoled"] {
      --bg: #000000;
      --bg-surface: #0a0a0a;
      --bg-card: #121212;
      --bg-card-hover: #1a1a1a;
      --code-bg: #0a0a0a;
      --text: #f0f6fc;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --border: #222222;
      --success: #3fb950;
      --danger: #f85149;
      --warn: #d29922;

      --ink: #f0f6fc;
      --ink-soft: #9da7b3;
      --ink-mute: #6e7681;
      --blueprint: #58a6ff;
      --blueprint-tint: rgba(88, 166, 255, 0.12);
      --blueprint-tint-strong: rgba(88, 166, 255, 0.25);
      --rule-soft: #222222;
    }
    [data-theme="light"] {
      --bg: #ffffff;
      --bg-surface: #f6f8fa;
      --bg-card: #f0f2f5;
      --bg-card-hover: #e6e8eb;
      --code-bg: #f4f6f8;
      --text: #24292f;
      --text-muted: #57606a;
      --accent: #0969da;
      --border: #d0d7de;
      --success: #1a7f37;
      --danger: #cf222e;
      --warn: #9a6700;

      --ink: #1a1a1a;
      --ink-soft: #555555;
      --ink-mute: #777777;
      --blueprint: #0969da;
      --blueprint-tint: rgba(9, 105, 218, 0.08);
      --blueprint-tint-strong: rgba(9, 105, 218, 0.16);
      --rule-soft: #d0d7de;
    }
    [data-theme="sepia"] {
      --bg: #fbf0d9;
      --bg-surface: #f4e3c1;
      --bg-card: #ecdcbb;
      --bg-card-hover: #e4d3b0;
      --code-bg: #f2e1bd;
      --text: #433422;
      --text-muted: #705e46;
      --accent: #9e4a1a;
      --border: #dac4a5;
      --success: #2d7a47;
      --danger: #b33927;
      --warn: #a36209;

      --ink: #382b1b;
      --ink-soft: #63503b;
      --ink-mute: #826e57;
      --blueprint: #9e4a1a;
      --blueprint-tint: rgba(158, 74, 26, 0.1);
      --blueprint-tint-strong: rgba(158, 74, 26, 0.2);
      --rule-soft: #dac4a5;
    }

    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Source Serif 4', Georgia, serif;
      background: var(--bg);
      color: var(--text);
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top App Header */
    header.app-header {
      height: 56px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 100;
      flex-shrink: 0;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-title { font-family: 'VT323', monospace; font-size: 1.5rem; color: var(--accent); font-weight: bold; letter-spacing: 0.5px; }
    .sidebar-toggle-btn {
      background: var(--bg-card); border: 1px solid var(--border); color: var(--text); font-size: 1.1rem; cursor: pointer; padding: 6px 10px; border-radius: 6px;
    }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .font-btn {
      background: var(--bg-card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; cursor: pointer; font-weight: bold;
    }
    .theme-select {
      background: var(--bg-card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; cursor: pointer;
    }

    /* Overall Layout: Dual Pane on Tablet */
    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    /* Sidebar (Master Pane) */
    aside.sidebar {
      width: var(--sidebar-width);
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow-y: auto;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease;
      z-index: 50;
    }
    aside.sidebar.collapsed {
      display: none;
    }
    .progress-banner {
      padding: 12px 14px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      font-size: 0.82rem;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--success);
      width: 0%;
      transition: width 0.3s ease;
    }
    .search-box {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg-surface);
      z-index: 10;
    }
    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    .filter-chips {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 0 4px;
      scrollbar-width: none;
    }
    .filter-chips::-webkit-scrollbar { display: none; }
    .filter-chip {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 12px;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-chip:hover { border-color: var(--accent); color: var(--text); }
    .filter-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: bold; }
    .filter-subbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .lang-select {
      background: var(--bg-card);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .match-count-badge { color: var(--text-muted); font-size: 0.75rem; }
    mark { background: rgba(255, 215, 0, 0.35); color: inherit; padding: 1px 3px; border-radius: 2px; }
    .search-result-item {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.15s;
    }
    .search-result-item:hover, .search-result-item.active { background: var(--bg-card); }
    .search-result-title { font-size: 0.92rem; font-weight: 600; color: var(--text); }
    .search-result-hook { font-size: 0.8rem; color: var(--text-muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .search-result-tags { display: flex; gap: 6px; margin-top: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: var(--accent); }
    .phase-list { list-style: none; padding: 0; margin: 0; }
    .phase-item { border-bottom: 1px solid var(--border); }
    .phase-header {
      padding: 11px 14px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      background: var(--bg-surface);
      color: var(--accent);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .phase-header:hover { background: var(--bg-card); }
    .phase-chevron { transition: transform 0.2s ease; display: inline-block; }
    .phase-item.collapsed .phase-chevron { transform: rotate(-90deg); }
    .phase-item.collapsed .lesson-sublist { display: none; }
    .lesson-item {
      padding: 9px 14px 9px 26px;
      font-size: 0.88rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.1s, color 0.1s;
    }
    .lesson-item:hover, .lesson-item.active {
      background: var(--bg-card);
      border-left-color: var(--accent);
      color: var(--accent);
    }
    .lesson-item .check { font-size: 0.85rem; color: var(--success); font-weight: bold; display: none; }
    .lesson-item.completed .check { display: inline; }

    /* Reading Detail Pane */
    main.content-area {
      flex: 1;
      overflow-y: auto;
      scroll-behavior: smooth;
      display: flex;
      flex-direction: column;
    }
    .breadcrumbs-bar {
      padding: 10px 32px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .article-wrap {
      max-width: 880px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 32px 48px;
      line-height: var(--reader-line-height);
      font-size: var(--reader-font-size);
      flex: 1;
    }
    .article-wrap h1 { font-size: 2.2rem; margin-top: 0; line-height: 1.25; }
    .article-wrap h2 { font-size: 1.5rem; margin-top: 36px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .article-wrap h3 { font-size: 1.2rem; margin-top: 24px; }
    .article-wrap p { margin: 16px 0; }
    .article-wrap blockquote {
      border-left: 4px solid var(--accent);
      margin: 20px 0;
      padding: 8px 18px;
      background: var(--bg-surface);
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }

    /* Code Blocks */
    .article-wrap pre {
      position: relative;
      margin: 24px 0;
      padding-top: 42px;
      padding-bottom: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--code-bg);
      border-radius: 8px;
    }
    .article-wrap pre code {
      display: block;
      background: transparent;
      color: var(--ink);
      padding: 16px 20px;
      font-size: 0.88rem;
      line-height: 1.6;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      border: none;
    }
    .code-lang {
      position: absolute;
      top: 0;
      left: 0;
      max-width: calc(100% - 88px);
      height: 38px;
      display: inline-flex;
      align-items: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      padding: 0 14px;
      background: var(--blueprint);
      color: #ffffff;
      border-bottom-right-radius: 6px;
      z-index: 2;
    }
    .code-copy {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 76px;
      height: 38px;
      background: var(--bg-surface);
      border: none;
      border-left: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      border-bottom-left-radius: 6px;
      padding: 0 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      font-weight: bold;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      cursor: pointer;
      z-index: 2;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .code-copy:hover {
      color: var(--blueprint);
      background: var(--bg-card);
    }
    .code-copy.copied {
      color: var(--success);
    }

    /* Syntax Highlighting */
    .syn-keyword { color: var(--blueprint); font-weight: 600; }
    .syn-string { color: #a5d6ff; }
    [data-theme="light"] .syn-string { color: #0a3069; }
    [data-theme="sepia"] .syn-string { color: #2e6030; }
    .syn-number { color: #79c0ff; }
    [data-theme="light"] .syn-number { color: #0550ae; }
    [data-theme="sepia"] .syn-number { color: #b33927; }
    .syn-comment { color: var(--text-muted); font-style: italic; }
    .syn-function { color: #d2a8ff; font-weight: 500; }
    [data-theme="light"] .syn-function { color: #8250df; }
    [data-theme="sepia"] .syn-function { color: #8a3b14; }
    .syn-operator { color: var(--text-muted); }

    /* Mermaid & Diagram Containers */
    .mermaid-container {
      margin: 28px 0;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      border-radius: 8px;
      overflow: hidden;
    }
    .mermaid-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }
    .mermaid-btn {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      padding: 3px 8px;
      cursor: pointer;
    }
    .mermaid-btn:hover { color: var(--blueprint); border-color: var(--blueprint); }
    .mermaid-render {
      padding: 20px;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .mermaid-render svg {
      max-width: 100%;
      height: auto;
      cursor: zoom-in;
    }
    .mermaid-source { display: none; }

    /* Interactive Lesson Figures */
    .lesson-figure {
      margin: 28px 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-surface);
      overflow: hidden;
    }
    .lesson-figure svg {
      cursor: zoom-in;
    }
    .lesson-figure.lf-animated {
      border: 1px solid var(--border);
      background: var(--bg-surface);
      margin: 28px 0;
      padding: 14px;
      border-radius: 8px;
    }

    /* SVG Zoom Modal */
    .figure-modal-backdrop {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.88);
      z-index: 200;
      flex-direction: column;
    }
    .figure-modal-backdrop.open { display: flex; }
    .figure-modal-toolbar {
      height: 52px;
      padding: 0 16px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .figure-modal-title { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: var(--accent); font-weight: bold; }
    .figure-modal-btns { display: flex; gap: 8px; }
    .figure-tool-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
    }
    .figure-tool-btn.close { color: var(--danger); font-weight: bold; }
    .figure-viewport {
      flex: 1;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .figure-container {
      transition: transform 0.05s ease-out;
      transform-origin: center center;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figure-container svg, .figure-container img {
      max-width: 100%;
      max-height: 100%;
    }

    /* Interactive Quiz Container */
    .quiz-container {
      border: 1px solid var(--blueprint);
      border-radius: 10px;
      padding: 24px;
      margin: 44px 0 20px;
      background: var(--bg-surface);
    }
    .quiz-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blueprint);
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .quiz-question {
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: 1px dashed var(--border);
    }
    .quiz-question:last-of-type {
      border-bottom: none;
      margin-bottom: 16px;
      padding-bottom: 0;
    }
    .quiz-question-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .quiz-stage-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: bold;
      color: #fff;
    }
    .quiz-question-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .quiz-question-text {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 14px;
      line-height: 1.5;
    }
    .quiz-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .quiz-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      text-align: left;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 0.96rem;
      transition: all 0.15s ease;
      width: 100%;
      appearance: none;
    }
    .quiz-option:hover {
      border-color: var(--blueprint);
      background: var(--bg-card-hover);
    }
    .quiz-option.selected {
      border-color: var(--blueprint);
      background: rgba(88, 166, 255, 0.14);
    }
    .quiz-option .opt-letter {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: bold;
      color: var(--text-muted);
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .quiz-option.selected .opt-letter {
      background: var(--blueprint);
      border-color: var(--blueprint);
      color: #ffffff;
    }
    .quiz-option.correct {
      border-color: var(--success) !important;
      background: rgba(63, 185, 80, 0.16) !important;
      color: var(--success) !important;
    }
    .quiz-option.correct .opt-letter {
      background: var(--success) !important;
      border-color: var(--success) !important;
      color: #ffffff !important;
    }
    .quiz-option.incorrect {
      border-color: var(--danger) !important;
      background: rgba(248, 81, 73, 0.16) !important;
      color: var(--danger) !important;
    }
    .quiz-option.incorrect .opt-letter {
      background: var(--danger) !important;
      border-color: var(--danger) !important;
      color: #ffffff !important;
    }
    .quiz-explanation {
      margin-top: 12px;
      padding: 12px 16px;
      border-left: 3px solid var(--blueprint);
      background: var(--bg-card);
      border-radius: 0 6px 6px 0;
      display: none;
    }
    .quiz-explanation.visible { display: block; }
    .quiz-explanation-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      color: var(--blueprint);
      font-weight: bold;
      margin-bottom: 4px;
    }
    .quiz-explanation-body {
      font-size: 0.92rem;
      line-height: 1.55;
      color: var(--text-muted);
    }
    .quiz-result-banner {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      font-weight: bold;
      text-align: center;
      border: 1px solid var(--border);
    }
    .quiz-result-banner.passed {
      background: rgba(63, 185, 80, 0.15);
      border-color: var(--success);
      color: var(--success);
    }
    .quiz-result-banner.failed {
      background: rgba(248, 81, 73, 0.15);
      border-color: var(--danger);
      color: var(--danger);
    }
    .quiz-submit-btn {
      margin-top: 16px;
      padding: 12px 24px;
      background: var(--blueprint);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      transition: opacity 0.15s;
    }
    .quiz-submit-btn:hover { opacity: 0.9; }

    /* Lesson Navigation Footer */
    .lesson-nav-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .nav-btn {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 18px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      cursor: pointer;
      flex: 1;
      max-width: 360px;
      transition: all 0.15s ease;
    }
    .nav-btn:hover { border-color: var(--accent); background: var(--bg-card); }
    .nav-btn-label { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--accent); text-transform: uppercase; }
    .nav-btn-title { font-size: 0.95rem; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nav-btn.next { text-align: right; margin-left: auto; }

    /* Mobile Backdrop & Layout (< 768px) */
    .drawer-backdrop {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 45;
    }
    @media (max-width: 768px) {
      aside.sidebar {
        position: absolute;
        top: 0; left: 0; bottom: 0;
        z-index: 50;
        transform: translateX(-100%);
        box-shadow: 4px 0 20px rgba(0,0,0,0.5);
      }
      aside.sidebar.open { transform: translateX(0); }
      .drawer-backdrop.open { display: block; }
      .breadcrumbs-bar { padding: 8px 16px; font-size: 0.75rem; }
      .article-wrap { padding: 20px 16px; }
      .lesson-nav-footer { flex-direction: column; }
      .nav-btn { max-width: 100%; }
    }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-left">
      <button class="sidebar-toggle-btn" id="sidebarToggle" aria-label="Toggle Sidebar">☰</button>
      <div class="header-title">AI / FROM SCRATCH</div>
    </div>
    <div class="header-actions">
      <button class="font-btn" id="fontDecBtn" title="Decrease font size">A-</button>
      <button class="font-btn" id="fontIncBtn" title="Increase font size">A+</button>
      <select class="theme-select" id="themeSelect">
        <option value="dark">Dark Theme</option>
        <option value="amoled">AMOLED Night</option>
        <option value="light">Light Theme</option>
        <option value="sepia">Sepia Theme</option>
      </select>
    </div>
  </header>

  <div class="main-container">
    <div class="drawer-backdrop" id="drawerBackdrop"></div>

    <aside class="sidebar" id="sidebar">
      <div class="progress-banner">
        <div style="display: flex; justify-content: space-between;">
          <span>Progress</span>
          <span id="progressText">0 / 542</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progressBarFill"></div>
        </div>
      </div>
      <div class="search-box">
        <input type="text" class="search-input" id="searchInput" placeholder="Search 542 lessons...">
        <div class="filter-chips" id="filterChips">
          <button class="filter-chip active" data-category="all">All</button>
          <button class="filter-chip" data-category="Foundations & ML">Foundations</button>
          <button class="filter-chip" data-category="Deep Learning & Vision">Deep Learning</button>
          <button class="filter-chip" data-category="NLP & Transformers">NLP</button>
          <button class="filter-chip" data-category="LLMs & GenAI">LLMs</button>
          <button class="filter-chip" data-category="Agents & Protocols">Agents</button>
          <button class="filter-chip" data-category="Production & Capstones">Production</button>
        </div>
        <div class="filter-subbar">
          <select class="lang-select" id="langSelect">
            <option value="all">All Languages</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="rust">Rust</option>
            <option value="julia">Julia</option>
          </select>
          <span class="match-count-badge" id="matchCountBadge">542 Lessons</span>
        </div>
      </div>
      <ul class="phase-list" id="phaseList"></ul>
    </aside>

    <main class="content-area" id="contentArea">
      <div class="breadcrumbs-bar" id="breadcrumbsBar">Phase · Lesson</div>
      <div class="lesson-article article-wrap" id="articleWrap">
        <h1>Loading Curriculum...</h1>
      </div>
    </main>
  </div>

  <!-- Figure Zoom / Pan Modal -->
  <div class="figure-modal-backdrop" id="figureModal">
    <div class="figure-modal-toolbar">
      <div class="figure-modal-title">DIAGRAM VIEWER</div>
      <div class="figure-modal-btns">
        <button class="figure-tool-btn" id="zoomOutBtn" title="Zoom Out">-</button>
        <button class="figure-tool-btn" id="zoomResetBtn" title="Reset Zoom">100%</button>
        <button class="figure-tool-btn" id="zoomInBtn" title="Zoom In">+</button>
        <button class="figure-tool-btn close" id="closeFigureBtn" title="Close">✕</button>
      </div>
    </div>
    <div class="figure-viewport" id="figureViewport">
      <div class="figure-container" id="figureContainer"></div>
    </div>
  </div>

  <script>
    window.AIFS_FIGURE_PROVIDER_VERSIONS = {};
  </script>
  <script src="figure-manifest.js"></script>
  <script src="figures.js"></script>
  <script src="lesson-figures.js"></script>
  <script src="mermaid.min.js"></script>
  <script src="viewer-controller.js"></script>
  <script src="search-engine.js"></script>
  <script src="app.js"></script>
</body>
</html>`;

  const jsContent = `'use strict';

(function () {
  let curriculum = null;
  let allLessonsInOrder = [];
  let lessonIndexMap = new Map();
  let activeLessonId = null;
  const completedLessons = new Set(JSON.parse(localStorage.getItem('completed_lessons') || '[]'));

  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const phaseList = document.getElementById('phaseList');
  const searchInput = document.getElementById('searchInput');
  const articleWrap = document.getElementById('articleWrap');
  const breadcrumbsBar = document.getElementById('breadcrumbsBar');
  const themeSelect = document.getElementById('themeSelect');
  const fontDecBtn = document.getElementById('fontDecBtn');
  const fontIncBtn = document.getElementById('fontIncBtn');
  const progressText = document.getElementById('progressText');
  const progressBarFill = document.getElementById('progressBarFill');

  // Font sizing
  let currentFontSize = parseFloat(localStorage.getItem('app_font_size') || '1.05');
  function applyFontSize(size) {
    currentFontSize = Math.min(Math.max(size, 0.85), 1.5);
    document.documentElement.style.setProperty('--reader-font-size', currentFontSize + 'rem');
    localStorage.setItem('app_font_size', currentFontSize.toString());
  }
  applyFontSize(currentFontSize);
  fontDecBtn.addEventListener('click', () => applyFontSize(currentFontSize - 0.1));
  fontIncBtn.addEventListener('click', () => applyFontSize(currentFontSize + 0.1));

  // Theme setup
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    localStorage.setItem('app_theme', e.target.value);
  });

  // Responsive Sidebar Drawer toggle
  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      drawerBackdrop.classList.toggle('open', sidebar.classList.contains('open'));
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }
  sidebarToggle.addEventListener('click', toggleSidebar);
  drawerBackdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    drawerBackdrop.classList.remove('open');
  });

  // Progress update
  function updateProgress() {
    const total = allLessonsInOrder.length || 542;
    const completed = completedLessons.size;
    progressText.textContent = \`\${completed} / \${total} (\${Math.round((completed / total) * 100)}%)\`;
    progressBarFill.style.width = \`\${(completed / total) * 100}%\`;
  }

  // Fetch curriculum
  fetch('data/curriculum.json')
    .then(res => res.json())
    .then(data => {
      curriculum = data;
      // Index all lessons for sequential Prev/Next navigation
      allLessonsInOrder = [];
      curriculum.phases.forEach(phase => {
        phase.lessons.forEach(lesson => {
          allLessonsInOrder.push(lesson);
          lessonIndexMap.set(lesson.id, allLessonsInOrder.length - 1);
        });
      });

      searchIndex = buildSearchIndex(curriculum);
      renderSidebar(curriculum.phases);
      updateProgress();

      const initialId = localStorage.getItem('last_lesson') || (allLessonsInOrder[0] && allLessonsInOrder[0].id);
      if (initialId) loadLesson(initialId);
    })
    .catch(err => {
      articleWrap.innerHTML = '<h1>Error Loading Curriculum</h1><p>' + err.message + '</p>';
    });

  let searchIndex = [];
  let currentFilters = { category: 'all', language: 'all' };
  const filterChips = document.getElementById('filterChips');
  const langSelect = document.getElementById('langSelect');
  const matchCountBadge = document.getElementById('matchCountBadge');

  if (filterChips) {
    filterChips.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterChips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilters.category = e.target.getAttribute('data-category');
        applySearchAndFilter();
      });
    });
  }

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      currentFilters.language = e.target.value;
      applySearchAndFilter();
    });
  }

  searchInput.addEventListener('input', () => {
    applySearchAndFilter();
  });

  function applySearchAndFilter() {
    const query = searchInput.value.trim();
    if (!query && currentFilters.category === 'all' && currentFilters.language === 'all') {
      renderSidebar(curriculum.phases);
      if (matchCountBadge) matchCountBadge.textContent = \`\${allLessonsInOrder.length} Lessons\`;
      return;
    }

    const matches = search(searchIndex, query, currentFilters);
    if (matchCountBadge) matchCountBadge.textContent = \`\${matches.length} Found\`;
    renderSearchResults(matches, query);
  }

  function renderSearchResults(results, query) {
    phaseList.innerHTML = '';
    if (results.length === 0) {
      phaseList.innerHTML = '<li style="padding:28px 16px;text-align:center;color:var(--text-muted);font-family:JetBrains Mono, monospace;font-size:0.85rem;">No lessons found matching filters</li>';
      return;
    }

    results.forEach(item => {
      const li = document.createElement('li');
      li.className = 'search-result-item' + (activeLessonId === item.id ? ' active' : '');
      const highlightedTitle = highlightMatches(item.title, query);
      const highlightedHook = highlightMatches(item.hook, query);

      li.innerHTML = \`
        <div class="search-result-title">\${highlightedTitle}</div>
        <div class="search-result-tags">
          <span>\${item.category}</span> · <span>\${item.type}</span> · <span>\${item.languages}</span>
        </div>
        \${highlightedHook ? \`<div class="search-result-hook">\${highlightedHook}</div>\` : ''}
      \`;

      li.addEventListener('click', () => {
        loadLesson(item.id);
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          drawerBackdrop.classList.remove('open');
        }
      });
      phaseList.appendChild(li);
    });
  }

  function renderSidebar(phases) {
    phaseList.innerHTML = '';

    phases.forEach(phase => {
      const phaseCompletedCount = phase.lessons.filter(l => completedLessons.has(l.id)).length;
      const li = document.createElement('li');
      li.className = 'phase-item';

      const header = document.createElement('div');
      header.className = 'phase-header';
      header.innerHTML = \`<span>\${phase.title} <small style="color:var(--text-muted)">(\${phaseCompletedCount}/\${phase.lessons.length})</small></span>
        <span class="phase-chevron">▾</span>\`;
      header.addEventListener('click', () => {
        li.classList.toggle('collapsed');
      });
      li.appendChild(header);

      const ul = document.createElement('ul');
      ul.className = 'lesson-sublist';
      ul.style.listStyle = 'none';
      ul.style.padding = '0';
      ul.style.margin = '0';

      phase.lessons.forEach(lesson => {
        const item = document.createElement('li');
        item.className = 'lesson-item' + 
          (activeLessonId === lesson.id ? ' active' : '') + 
          (completedLessons.has(lesson.id) ? ' completed' : '');
        item.innerHTML = \`<span>\${lesson.title}</span><span class="check">✓</span>\`;
        item.addEventListener('click', () => {
          loadLesson(lesson.id);
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            drawerBackdrop.classList.remove('open');
          }
        });
        ul.appendChild(item);
      });

      li.appendChild(ul);
      phaseList.appendChild(li);
    });
  }

  function loadLesson(lessonId) {
    activeLessonId = lessonId;
    localStorage.setItem('last_lesson', lessonId);

    // Update active highlight in sidebar
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));

    articleWrap.innerHTML = '<p>Loading lesson...</p>';
    fetch(\`data/lessons/\${lessonId}.json\`)
      .then(res => res.json())
      .then(lesson => {
        renderLesson(lesson);
      })
      .catch(err => {
        articleWrap.innerHTML = '<h1>Lesson Not Found</h1><p>' + err.message + '</p>';
      });
  }

  function renderLesson(lesson) {
    const currentIndex = lessonIndexMap.get(lesson.id) || 0;
    const prevLesson = currentIndex > 0 ? allLessonsInOrder[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessonsInOrder.length - 1 ? allLessonsInOrder[currentIndex + 1] : null;

    // Breadcrumbs
    breadcrumbsBar.textContent = \`\${lesson.phaseId} · \${lesson.title}\`;

    let content = '<div class="lesson-header">';
    content += \`<div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--accent); margin-bottom: 8px;">\${lesson.phaseId} · \${lesson.time} · \${lesson.type} · \${lesson.languages}</div>\`;
    content += \`<h1>\${lesson.title}</h1>\`;
    if (lesson.hook) {
      content += \`<blockquote>\${lesson.hook}</blockquote>\`;
    }
    content += '</div>';

    // Body HTML
    content += lesson.html;

    // Render Quiz if present
    if (lesson.quiz && lesson.quiz.questions && lesson.quiz.questions.length) {
      content += renderQuiz(lesson.quiz, lesson.id);
    }

    // Previous / Next Lesson Navigation Footer
    content += '<div class="lesson-nav-footer">';
    if (prevLesson) {
      content += \`<div class="nav-btn prev" id="prevLessonBtn">
        <span class="nav-btn-label">← Previous Lesson</span>
        <span class="nav-btn-title">\${prevLesson.title}</span>
      </div>\`;
    } else {
      content += '<div></div>';
    }
    if (nextLesson) {
      content += \`<div class="nav-btn next" id="nextLessonBtn">
        <span class="nav-btn-label">Next Lesson →</span>
        <span class="nav-btn-title">\${nextLesson.title}</span>
      </div>\`;
    }
    content += '</div>';

    articleWrap.innerHTML = content;
    document.getElementById('contentArea').scrollTop = 0;

    // Wire up built-in code block copy buttons
    articleWrap.querySelectorAll('.code-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code') || (btn.closest('pre') ? btn.closest('pre').querySelector('code').innerText : '');
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      });
    });

    // Render Mermaid diagrams offline
    if (window.mermaid) {
      const curTheme = document.documentElement.getAttribute('data-theme');
      const mermaidTheme = curTheme === 'light' ? 'default' : (curTheme === 'sepia' ? 'neutral' : 'dark');
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: 'loose'
        });
      } catch (_) {}

      articleWrap.querySelectorAll('.mermaid-block').forEach((block, bIdx) => {
        const sourcePre = block.querySelector('pre.mermaid-source');
        const renderDiv = block.querySelector('.mermaid-render');
        if (sourcePre && renderDiv) {
          const graphDef = sourcePre.textContent.trim();
          const graphId = 'mermaid-svg-' + Date.now() + '-' + bIdx;
          window.mermaid.render(graphId, graphDef).then(res => {
            renderDiv.innerHTML = res.svg;
            sourcePre.style.display = 'none';
            const expandBtn = block.querySelector('.mermaid-expand');
            if (expandBtn) {
              expandBtn.addEventListener('click', () => {
                const svg = renderDiv.querySelector('svg');
                if (svg) openFigureModal(svg);
              });
            }
            wireFigureZoomModal();
          }).catch(err => {
            console.warn('Mermaid render error:', err);
            sourcePre.style.display = 'block';
          });
        }
      });
    } else {
      articleWrap.querySelectorAll('pre.mermaid-source').forEach(p => p.style.display = 'block');
    }

    // Mount interactive lesson figures
    if (window.AIFS_loadFigureProviders) {
      window.AIFS_loadFigureProviders(articleWrap).then(() => {
        if (window.mountLessonFigures) window.mountLessonFigures(articleWrap);
        wireFigureZoomModal();
      }).catch(() => {
        if (window.mountLessonFigures) window.mountLessonFigures(articleWrap);
        wireFigureZoomModal();
      });
    } else if (window.mountLessonFigures) {
      window.mountLessonFigures(articleWrap);
      wireFigureZoomModal();
    } else {
      wireFigureZoomModal();
    }

    // Setup interactive hooks
    setupQuizListeners(lesson.quiz, lesson.id);
    setupNavButtonListeners(prevLesson, nextLesson);
  }

  function wireFigureZoomModal() {
    articleWrap.querySelectorAll('.mermaid-render svg, .lesson-figure svg, figure svg, .figure-frame svg').forEach(svg => {
      if (svg.getAttribute('data-zoom-wired')) return;
      svg.setAttribute('data-zoom-wired', '1');
      svg.style.cursor = 'zoom-in';
      svg.setAttribute('title', 'Click to enlarge diagram');
      svg.addEventListener('click', (e) => {
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) return;
        e.stopPropagation();
        openFigureModal(svg);
      });
    });
  }

  // Diagram Zoom & Pan Modal
  const figureModal = document.getElementById('figureModal');
  const figureContainer = document.getElementById('figureContainer');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const closeFigureBtn = document.getElementById('closeFigureBtn');

  let currentZoomState = { scale: 1.0, x: 0, y: 0 };

  function updateFigureTransform() {
    if (figureContainer) {
      figureContainer.style.transform = \`matrix(\${currentZoomState.scale}, 0, 0, \${currentZoomState.scale}, \${currentZoomState.x}, \${currentZoomState.y})\`;
      if (zoomResetBtn) zoomResetBtn.textContent = \`\${Math.round(currentZoomState.scale * 100)}%\`;
    }
  }

  function openFigureModal(sourceEl) {
    if (!figureModal || !figureContainer) return;
    figureContainer.innerHTML = sourceEl.outerHTML;
    currentZoomState = { scale: 1.0, x: 0, y: 0 };
    updateFigureTransform();
    figureModal.classList.add('open');
  }

  function closeFigureModal() {
    if (!figureModal) return;
    figureModal.classList.remove('open');
    if (figureContainer) figureContainer.innerHTML = '';
  }

  if (closeFigureBtn) closeFigureBtn.addEventListener('click', closeFigureModal);
  if (figureModal) {
    figureModal.addEventListener('click', (e) => {
      if (e.target === figureModal || e.target.id === 'figureViewport') {
        closeFigureModal();
      }
    });
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (typeof calculateZoomTransform === 'function') {
        currentZoomState = calculateZoomTransform(currentZoomState, { type: 'zoomIn' });
      } else {
        currentZoomState.scale = Math.min(currentZoomState.scale * 1.25, 4.0);
      }
      updateFigureTransform();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (typeof calculateZoomTransform === 'function') {
        currentZoomState = calculateZoomTransform(currentZoomState, { type: 'zoomOut' });
      } else {
        currentZoomState.scale = Math.max(currentZoomState.scale / 1.25, 0.5);
      }
      updateFigureTransform();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      if (typeof calculateZoomTransform === 'function') {
        currentZoomState = calculateZoomTransform(currentZoomState, { type: 'reset' });
      } else {
        currentZoomState = { scale: 1.0, x: 0, y: 0 };
      }
      updateFigureTransform();
    });
  }

  function setupNavButtonListeners(prevLesson, nextLesson) {
    const prevBtn = document.getElementById('prevLessonBtn');
    if (prevBtn && prevLesson) {
      prevBtn.addEventListener('click', () => loadLesson(prevLesson.id));
    }
    const nextBtn = document.getElementById('nextLessonBtn');
    if (nextBtn && nextLesson) {
      nextBtn.addEventListener('click', () => loadLesson(nextLesson.id));
    }
  }

  function renderQuiz(quiz, lessonId) {
    const isCompleted = completedLessons.has(lessonId);
    let html = \`<div class="quiz-container" id="quizContainer">
      <div class="quiz-title">
        <span>INTERACTIVE KNOWLEDGE CHECK</span>
        <span>(\${quiz.questions.length} QUESTIONS)</span>
      </div>\`;

    quiz.questions.forEach((q, idx) => {
      const stageInfo = typeof formatQuizStage === 'function' 
        ? formatQuizStage(q.stage) 
        : { label: (q.stage || 'check').toUpperCase(), color: '#58a6ff' };

      html += \`<div class="quiz-question" data-q="\${idx}">
        <div class="quiz-question-header">
          <span class="quiz-stage-badge" style="background:\${stageInfo.color}">\${stageInfo.label}</span>
          <span class="quiz-question-num">QUESTION \${idx + 1} OF \${quiz.questions.length}</span>
        </div>
        <div class="quiz-question-text">\${q.question}</div>
        <div class="quiz-options">\`;
      q.options.forEach((opt, optIdx) => {
        const letter = ['A', 'B', 'C', 'D', 'E'][optIdx] || (optIdx + 1);
        html += \`<button type="button" class="quiz-option" data-opt="\${optIdx}">
          <span class="opt-letter">\${letter}</span>
          <span class="quiz-option-text">\${opt}</span>
        </button>\`;
      });
      html += \`</div>
        <div class="quiz-explanation" id="explain-\${idx}">
          <div class="quiz-explanation-title">EXPLANATION</div>
          <div class="quiz-explanation-body">\${q.explanation || ''}</div>
        </div>
      </div>\`;
    });

    html += \`<div id="quizResultBanner" style="display:none;" class="quiz-result-banner"></div>\`;
    html += \`<button class="quiz-submit-btn" id="quizSubmit">\${isCompleted ? 'Quiz Completed (Retake)' : 'Grade & Submit Answers'}</button></div>\`;
    return html;
  }

  function setupQuizListeners(quiz, lessonId) {
    const container = document.getElementById('quizContainer');
    if (!container || !quiz) return;

    const selectedAnswers = {};

    container.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const optBtn = e.target.closest('.quiz-option');
        if (!optBtn) return;
        const qDiv = optBtn.closest('.quiz-question');
        if (!qDiv) return;
        const qIdx = qDiv.getAttribute('data-q');
        const optIdx = parseInt(optBtn.getAttribute('data-opt'), 10);

        qDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
        optBtn.classList.add('selected');
        selectedAnswers[qIdx] = optIdx;
      });
    });

    const submitBtn = document.getElementById('quizSubmit');
    submitBtn.addEventListener('click', () => {
      const grading = typeof gradeQuiz === 'function'
        ? gradeQuiz(quiz.questions, selectedAnswers)
        : { score: 0, total: quiz.questions.length, percentage: 0, passed: false };

      quiz.questions.forEach((q, idx) => {
        const selected = selectedAnswers[idx];
        const qDiv = container.querySelector(\`[data-q="\${idx}"]\`);
        if (!qDiv) return;
        const explain = document.getElementById(\`explain-\${idx}\`);
        if (explain) explain.classList.add('visible');

        qDiv.querySelectorAll('.quiz-option').forEach((optBtn) => {
          const optIdx = parseInt(optBtn.getAttribute('data-opt'), 10);
          optBtn.classList.remove('correct', 'incorrect');
          if (optIdx === q.correct) {
            optBtn.classList.add('correct');
          } else if (optIdx === selected) {
            optBtn.classList.add('incorrect');
          }
        });
      });

      const banner = document.getElementById('quizResultBanner');
      if (banner) {
        banner.style.display = 'block';
        banner.className = 'quiz-result-banner ' + (grading.passed ? 'passed' : 'failed');
        banner.textContent = \`Score: \${grading.score} / \${grading.total} (\${grading.percentage}%) — \` +
          (grading.passed ? 'Passed! Excellent work.' : 'Keep reviewing the material and try again.');
      }

      if (grading.passed) {
        completedLessons.add(lessonId);
        localStorage.setItem('completed_lessons', JSON.stringify(Array.from(completedLessons)));
        if (curriculum) renderSidebar(curriculum.phases);
        updateProgress();
      }

      submitBtn.textContent = 'Retake Quiz';
    });
})();
`;

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlContent, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'app.js'), jsContent, 'utf8');
  console.log('   wrote dist/index.html & dist/app.js');
}

async function main() {
  console.log('🚀 Starting Offline Bundle Pre-rendering...');
  ensureDir(DIST_DIR);
  await bundleFonts();
  await bundleMermaid();
  copyStaticAssets();
  const curriculum = await buildCurriculum();
  generateOfflineShell();
  console.log(`🎉 Offline bundle ready at: ${DIST_DIR}`);
  console.log(`   Total phases: ${curriculum.phases.length}, Total lessons: ${curriculum.totalLessons}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal build error:', err);
    process.exit(1);
  });
}

module.exports = { main, extractMetadata, buildCurriculum };

