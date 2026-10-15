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

  // Copy figures.js
  const figuresJs = path.join(REPO_ROOT, 'site', 'figures.js');
  if (fs.existsSync(figuresJs)) {
    fs.copyFileSync(figuresJs, path.join(DIST_DIR, 'figures.js'));
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
  <link rel="stylesheet" href="certifications.css">
  <style>
    :root {
      --bg: #0d1117;
      --bg-surface: #161b22;
      --bg-card: #21262d;
      --bg-card-hover: #292e36;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --border: #30363d;
      --success: #3fb950;
      --danger: #f85149;
      --sidebar-width: 340px;
      --reader-font-size: 1.05rem;
      --reader-line-height: 1.75;
    }
    [data-theme="light"] {
      --bg: #ffffff;
      --bg-surface: #f6f8fa;
      --bg-card: #f0f2f5;
      --bg-card-hover: #e6e8eb;
      --text: #24292f;
      --text-muted: #57606a;
      --accent: #0969da;
      --border: #d0d7de;
      --success: #1a7f37;
      --danger: #cf222e;
    }
    [data-theme="sepia"] {
      --bg: #fbf0d9;
      --bg-surface: #f4e3c1;
      --bg-card: #ecdcbb;
      --bg-card-hover: #e4d3b0;
      --text: #433422;
      --text-muted: #705e46;
      --accent: #9e4a1a;
      --border: #dac4a5;
      --success: #2d7a47;
      --danger: #b33927;
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
    .article-wrap pre {
      background: var(--bg-card);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      border: 1px solid var(--border);
      position: relative;
    }
    .article-wrap code {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-card);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .article-wrap blockquote {
      border-left: 4px solid var(--accent);
      margin: 20px 0;
      padding: 8px 18px;
      background: var(--bg-surface);
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }

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

    /* Interactive Quiz Card */
    .quiz-card {
      margin-top: 50px;
      padding: 28px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .quiz-title { font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; color: var(--accent); margin-bottom: 20px; font-weight: bold; }
    .quiz-q { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .quiz-q p { font-weight: bold; margin-bottom: 12px; }
    .quiz-options { display: flex; flex-direction: column; gap: 8px; }
    .quiz-option {
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.15s;
    }
    .quiz-option:hover { border-color: var(--accent); background: var(--bg-card-hover); }
    .quiz-option.selected { border-color: var(--accent); background: rgba(88, 166, 255, 0.12); }
    .quiz-option.correct { border-color: var(--success) !important; background: rgba(63, 185, 80, 0.18) !important; }
    .quiz-option.incorrect { border-color: var(--danger) !important; background: rgba(248, 81, 73, 0.18) !important; }
    .quiz-explain { margin-top: 10px; font-size: 0.9rem; color: var(--text-muted); display: none; line-height: 1.5; padding: 10px; background: var(--bg-card); border-radius: 6px; }
    .quiz-submit-btn {
      margin-top: 16px;
      padding: 12px 24px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem;
      transition: opacity 0.15s;
    }
    .quiz-submit-btn:hover { opacity: 0.9; }

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
      </div>
      <ul class="phase-list" id="phaseList"></ul>
    </aside>

    <main class="content-area" id="contentArea">
      <div class="breadcrumbs-bar" id="breadcrumbsBar">Phase · Lesson</div>
      <div class="article-wrap" id="articleWrap">
        <h1>Loading Curriculum...</h1>
      </div>
    </main>
  </div>

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

      renderSidebar(curriculum.phases);
      updateProgress();

      const initialId = localStorage.getItem('last_lesson') || (allLessonsInOrder[0] && allLessonsInOrder[0].id);
      if (initialId) loadLesson(initialId);
    })
    .catch(err => {
      articleWrap.innerHTML = '<h1>Error Loading Curriculum</h1><p>' + err.message + '</p>';
    });

  function renderSidebar(phases, filterText = '') {
    phaseList.innerHTML = '';
    const query = filterText.toLowerCase().trim();

    phases.forEach(phase => {
      const filteredLessons = phase.lessons.filter(l => 
        !query || l.title.toLowerCase().includes(query) || l.hook.toLowerCase().includes(query)
      );

      if (query && filteredLessons.length === 0) return;

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

      filteredLessons.forEach(lesson => {
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

  // Search input handler
  searchInput.addEventListener('input', (e) => {
    if (curriculum) renderSidebar(curriculum.phases, e.target.value);
  });

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

    // Setup interactive hooks
    setupQuizListeners(lesson.quiz, lesson.id);
    setupNavButtonListeners(prevLesson, nextLesson);
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
    let html = \`<div class="quiz-card" id="quizContainer">
      <div class="quiz-title">Interactive Quiz (\${quiz.questions.length} Questions)</div>\`;

    quiz.questions.forEach((q, idx) => {
      html += \`<div class="quiz-q" data-q="\${idx}">
        <p>\${idx + 1}. \${q.question}</p>
        <div class="quiz-options">\`;
      q.options.forEach((opt, optIdx) => {
        html += \`<div class="quiz-option" data-opt="\${optIdx}">\${opt}</div>\`;
      });
      html += \`</div>
        <div class="quiz-explain" id="explain-\${idx}">\${q.explanation || ''}</div>
      </div>\`;
    });

    html += \`<button class="quiz-submit-btn" id="quizSubmit">\${isCompleted ? 'Quiz Completed (Retake)' : 'Submit Quiz Answers'}</button></div>\`;
    return html;
  }

  function setupQuizListeners(quiz, lessonId) {
    const container = document.getElementById('quizContainer');
    if (!container || !quiz) return;

    const selectedAnswers = {};

    container.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qDiv = e.target.closest('.quiz-q');
        const qIdx = qDiv.getAttribute('data-q');
        const optIdx = parseInt(e.target.getAttribute('data-opt'), 10);
        qDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAnswers[qIdx] = optIdx;
      });
    });

    const submitBtn = document.getElementById('quizSubmit');
    submitBtn.addEventListener('click', () => {
      let score = 0;
      quiz.questions.forEach((q, idx) => {
        const selected = selectedAnswers[idx];
        const qDiv = container.querySelector(\`[data-q="\${idx}"]\`);
        const explain = document.getElementById(\`explain-\${idx}\`);
        if (explain) explain.style.display = 'block';

        qDiv.querySelectorAll('.quiz-option').forEach((optBtn, optIdx) => {
          if (optIdx === q.correct) {
            optBtn.classList.add('correct');
          } else if (optIdx === selected) {
            optBtn.classList.add('incorrect');
          }
        });

        if (selected === q.correct) score++;
      });

      // Mark lesson as completed
      completedLessons.add(lessonId);
      localStorage.setItem('completed_lessons', JSON.stringify(Array.from(completedLessons)));
      if (curriculum) renderSidebar(curriculum.phases);
      updateProgress();

      submitBtn.textContent = \`Score: \${score} / \${quiz.questions.length} (Saved!)\`;
    });
  }
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
