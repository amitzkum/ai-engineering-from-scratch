#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { parseMd } = require('../site/lesson-markdown');

const REPO_ROOT = path.resolve(__dirname, '..');
const PHASES_DIR = path.join(REPO_ROOT, 'phases');
const DIST_DIR = path.join(REPO_ROOT, 'offline-app', 'dist');
const DATA_DIR = path.join(DIST_DIR, 'data');
const LESSONS_DIR = path.join(DATA_DIR, 'lessons');
const FONTS_DIR = path.join(DIST_DIR, 'fonts');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const VENDOR_KATEX_DIR = path.join(REPO_ROOT, 'offline-app', 'vendor', 'katex');

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

async function bundleKaTeX() {
  console.log('📐 Bundling offline KaTeX math formula renderer & fonts...');
  ensureDir(DIST_DIR);
  ensureDir(FONTS_DIR);

  const destJs = path.join(DIST_DIR, 'katex.min.js');
  const destCss = path.join(DIST_DIR, 'katex.min.css');

  // Copy from local vendor directory if available (deterministic offline operation)
  if (fs.existsSync(VENDOR_KATEX_DIR)) {
    const srcJs = path.join(VENDOR_KATEX_DIR, 'katex.min.js');
    const srcCss = path.join(VENDOR_KATEX_DIR, 'katex.min.css');
    const srcFonts = path.join(VENDOR_KATEX_DIR, 'fonts');

    if (fs.existsSync(srcJs)) {
      fs.copyFileSync(srcJs, destJs);
    }
    if (fs.existsSync(srcCss)) {
      fs.copyFileSync(srcCss, destCss);
    }
    if (fs.existsSync(srcFonts)) {
      for (const font of fs.readdirSync(srcFonts)) {
        if (font.endsWith('.woff2')) {
          fs.copyFileSync(path.join(srcFonts, font), path.join(FONTS_DIR, font));
        }
      }
    }
  }

  // Fallback to cache or download if missing
  if (!fs.existsSync(destJs) || fs.statSync(destJs).size < 100000) {
    const tmpCache = '/tmp/katex.min.js';
    if (fs.existsSync(tmpCache) && fs.statSync(tmpCache).size > 100000) {
      fs.copyFileSync(tmpCache, destJs);
    } else {
      try {
        await downloadFile('https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.js', destJs);
        try { fs.copyFileSync(destJs, tmpCache); } catch (_) {}
      } catch (err) {
        console.warn('Could not bundle katex.min.js:', err.message);
      }
    }
  }

  const fontFaceMatches = fs.existsSync(destCss) ? (fs.readFileSync(destCss, 'utf8').match(/@font-face/g) || []).length : 0;
  if (!fs.existsSync(destCss) || fs.statSync(destCss).size < 10000 || fontFaceMatches < 15) {
    const tmpCacheCss = '/tmp/katex.min.css';
    if (fs.existsSync(tmpCacheCss) && fs.statSync(tmpCacheCss).size > 10000 && (fs.readFileSync(tmpCacheCss, 'utf8').match(/@font-face/g) || []).length >= 15) {
      fs.copyFileSync(tmpCacheCss, destCss);
    } else {
      try {
        const tmpCss = path.join(DIST_DIR, 'katex.raw.css');
        await downloadFile('https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css', tmpCss);
        let css = fs.readFileSync(tmpCss, 'utf8');
        css = css.replace(/,url\(fonts\/[^)]+\.woff\)\s*format\(['"]woff['"]\)/g, '');
        css = css.replace(/,url\(fonts\/[^)]+\.ttf\)\s*format\(['"]truetype['"]\)/g, '');
        fs.writeFileSync(destCss, css, 'utf8');
        try { fs.copyFileSync(destCss, tmpCacheCss); } catch (_) {}
        try { fs.unlinkSync(tmpCss); } catch (_) {}
      } catch (err) {
        console.warn('Could not bundle katex.min.css:', err.message);
      }
    }
  }

  // Ensure KaTeX woff2 fonts are bundled locally
  const katexFonts = [
    'KaTeX_AMS-Regular.woff2',
    'KaTeX_Caligraphic-Bold.woff2',
    'KaTeX_Caligraphic-Regular.woff2',
    'KaTeX_Fraktur-Bold.woff2',
    'KaTeX_Fraktur-Regular.woff2',
    'KaTeX_Main-Bold.woff2',
    'KaTeX_Main-BoldItalic.woff2',
    'KaTeX_Main-Italic.woff2',
    'KaTeX_Main-Regular.woff2',
    'KaTeX_Math-BoldItalic.woff2',
    'KaTeX_Math-Italic.woff2',
    'KaTeX_SansSerif-Bold.woff2',
    'KaTeX_SansSerif-Italic.woff2',
    'KaTeX_SansSerif-Regular.woff2',
    'KaTeX_Script-Regular.woff2',
    'KaTeX_Size1-Regular.woff2',
    'KaTeX_Size2-Regular.woff2',
    'KaTeX_Size3-Regular.woff2',
    'KaTeX_Size4-Regular.woff2',
    'KaTeX_Typewriter-Regular.woff2'
  ];

  for (const font of katexFonts) {
    const dest = path.join(FONTS_DIR, font);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      const tmpFont = path.join('/tmp', font);
      if (fs.existsSync(tmpFont) && fs.statSync(tmpFont).size > 0) {
        fs.copyFileSync(tmpFont, dest);
      } else {
        try {
          await downloadFile(`https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/fonts/${font}`, dest);
          try { fs.copyFileSync(dest, tmpFont); } catch (_) {}
        } catch (_) {}
      }
    }
  }

  console.log('   bundled KaTeX offline assets & fonts');
}

async function bundlePyodide() {
  console.log('🐍 Bundling offline Python 3.12, NumPy, SciPy & Scikit-Learn runtime...');
  const pyodideAssetsDir = path.join(REPO_ROOT, 'offline-app', 'pyodide-assets');
  const distPyodideDir = path.join(DIST_DIR, 'pyodide');
  ensureDir(pyodideAssetsDir);
  ensureDir(distPyodideDir);

  const files = [
    'pyodide.js',
    'pyodide.asm.js',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
    'openblas-0.3.26.zip',
    'numpy-1.26.4-cp312-cp312-pyodide_2024_0_wasm32.whl',
    'scipy-1.12.0-cp312-cp312-pyodide_2024_0_wasm32.whl',
    'joblib-1.4.0-py3-none-any.whl',
    'threadpoolctl-3.4.0-py3-none-any.whl',
    'scikit_learn-1.4.2-cp312-cp312-pyodide_2024_0_wasm32.whl'
  ];

  const base = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

  for (const f of files) {
    const assetPath = path.join(pyodideAssetsDir, f);
    const distPath = path.join(distPyodideDir, f);

    // If missing from local assets, download to pyodideAssetsDir
    if (!fs.existsSync(assetPath) || fs.statSync(assetPath).size === 0) {
      try {
        console.log(`   downloading ${f}...`);
        await downloadFile(base + f, assetPath);
      } catch (err) {
        console.warn(`Could not download ${f}:`, err.message);
      }
    }

    // Ensure copied to dist
    if (fs.existsSync(assetPath) && (!fs.existsSync(distPath) || fs.statSync(distPath).size === 0)) {
      fs.copyFileSync(assetPath, distPath);
    }
  }

  console.log('   bundled offline Python & ML packages');
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

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMathInHtml(html, katex) {
  if (!katex) return html;

  // 1. Render display math blocks
  html = html.replace(/<div class="math-display" data-math="display">([\s\S]*?)<\/div>/g, (match, rawTex) => {
    const tex = unescapeHtml(rawTex.trim());
    try {
      const rendered = katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        strict: 'ignore'
      });
      return `<div class="math-display" data-math="display" data-math-rendered="true" data-tex="${escapeAttr(tex)}">${rendered}</div>`;
    } catch (err) {
      console.warn('KaTeX display render error:', err.message);
      return `<div class="math-display" data-math="display" data-math-rendered="true" data-tex="${escapeAttr(tex)}">${rawTex}</div>`;
    }
  });

  // 2. Render inline math spans
  html = html.replace(/<span class="math-inline" data-math="inline">(.*?)<\/span>/g, (match, rawTex) => {
    const tex = unescapeHtml(rawTex.trim());
    try {
      const rendered = katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
        strict: 'ignore'
      });
      return `<span class="math-inline" data-math="inline" data-math-rendered="true" data-tex="${escapeAttr(tex)}">${rendered}</span>`;
    } catch (err) {
      console.warn('KaTeX inline render error:', err.message);
      return `<span class="math-inline" data-math="inline" data-math-rendered="true" data-tex="${escapeAttr(tex)}">${rawTex}</span>`;
    }
  });

  return html;
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

  // Copy library-controller.js
  const libraryControllerJs = path.join(REPO_ROOT, 'offline-app', 'library-controller.js');
  if (fs.existsSync(libraryControllerJs)) {
    fs.copyFileSync(libraryControllerJs, path.join(DIST_DIR, 'library-controller.js'));
    console.log('   copied dist/library-controller.js');
  }

  // Copy study-controller.js
  const studyControllerJs = path.join(REPO_ROOT, 'offline-app', 'study-controller.js');
  if (fs.existsSync(studyControllerJs)) {
    fs.copyFileSync(studyControllerJs, path.join(DIST_DIR, 'study-controller.js'));
    console.log('   copied dist/study-controller.js');
  }

  // Copy playground-controller.js
  const playgroundControllerJs = path.join(REPO_ROOT, 'offline-app', 'playground-controller.js');
  if (fs.existsSync(playgroundControllerJs)) {
    fs.copyFileSync(playgroundControllerJs, path.join(DIST_DIR, 'playground-controller.js'));
    console.log('   copied dist/playground-controller.js');
  }

  // Copy sqlite-db.js
  const sqliteDbJs = path.join(REPO_ROOT, 'offline-app', 'sqlite-db.js');
  if (fs.existsSync(sqliteDbJs)) {
    fs.copyFileSync(sqliteDbJs, path.join(DIST_DIR, 'sqlite-db.js'));
    console.log('   copied dist/sqlite-db.js');
  }

  // Copy python-playground-controller.js
  const pyControllerJs = path.join(REPO_ROOT, 'offline-app', 'python-playground-controller.js');
  if (fs.existsSync(pyControllerJs)) {
    fs.copyFileSync(pyControllerJs, path.join(DIST_DIR, 'python-playground-controller.js'));
    console.log('   copied dist/python-playground-controller.js');
  }

  // Copy python-worker.js
  const pyWorkerJs = path.join(REPO_ROOT, 'offline-app', 'python-worker.js');
  if (fs.existsSync(pyWorkerJs)) {
    fs.copyFileSync(pyWorkerJs, path.join(DIST_DIR, 'python-worker.js'));
    console.log('   copied dist/python-worker.js');
  }

  // Copy offline Pyodide assets
  const pyodideAssetsDir = path.join(REPO_ROOT, 'offline-app', 'pyodide-assets');
  const distPyodideDir = path.join(DIST_DIR, 'pyodide');
  if (fs.existsSync(pyodideAssetsDir)) {
    ensureDir(distPyodideDir);
    fs.cpSync(pyodideAssetsDir, distPyodideDir, { recursive: true });
    console.log('   copied dist/pyodide/ assets');
  }
}



async function buildCurriculum() {
  console.log('📚 Pre-rendering 542 lessons and quizzes with math rendering...');
  ensureDir(DATA_DIR);
  ensureDir(LESSONS_DIR);

  let katex = null;
  const katexPath = path.join(DIST_DIR, 'katex.min.js');
  const vendorKatexPath = path.join(VENDOR_KATEX_DIR, 'katex.min.js');
  if (fs.existsSync(katexPath)) {
    try {
      katex = require(katexPath);
      console.log('   ✓ Loaded KaTeX', katex.version, 'for offline formula pre-rendering');
    } catch (_) {}
  } else if (fs.existsSync(vendorKatexPath)) {
    try {
      katex = require(vendorKatexPath);
      console.log('   ✓ Loaded KaTeX', katex.version, 'from vendor for offline formula pre-rendering');
    } catch (_) {}
  }

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
      let htmlContent = parseMd(mdContent);
      if (katex) {
        htmlContent = renderMathInHtml(htmlContent, katex);
      }

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
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'offline-app', 'package.json'), 'utf8')).version || '1.5.0';
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>AI Engineering from Scratch</title>
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="lesson.css">
  <link rel="stylesheet" href="katex.min.css">
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

    /* Top App Header with Safe-Area Inset Support */
    header.app-header {
      padding-top: max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px));
      padding-left: max(16px, env(safe-area-inset-left, 0px), var(--safe-area-inset-left, 0px));
      padding-right: max(16px, env(safe-area-inset-right, 0px), var(--safe-area-inset-right, 0px));
      padding-bottom: 0;
      height: calc(56px + max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)));
      box-sizing: border-box;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      padding-bottom: max(0px, env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px));
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
      padding: 32px 32px max(48px, calc(48px + env(safe-area-inset-bottom, 0px)), calc(48px + var(--safe-area-inset-bottom, 0px)));
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

    /* Sidebar Footer Attribution */
    .sidebar-footer {
      margin-top: auto;
      padding: 12px 14px;
      padding-bottom: max(12px, calc(12px + env(safe-area-inset-bottom, 0px)), calc(12px + var(--safe-area-inset-bottom, 0px)));
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
      line-height: 1.4;
      flex-shrink: 0;
    }
    .sidebar-release-tag {
      display: inline-block;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 4px;
      font-size: 0.68rem;
      letter-spacing: 0.5px;
    }
    .sidebar-author {
      color: var(--text);
      margin-top: 2px;
    }
    .sidebar-author strong {
      color: var(--accent);
    }
    .sidebar-source {
      color: var(--text-muted);
      font-size: 0.68rem;
      margin-top: 2px;
    }

    /* About & Attribution Modal */
    .about-modal-backdrop {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      z-index: 210;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .about-modal-backdrop.open { display: flex; }
    .about-modal-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 100%;
      max-width: 620px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
    }
    .about-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .about-title-wrap { display: flex; flex-direction: column; gap: 4px; }
    .about-title {
      margin: 0;
      font-size: 1.25rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent);
    }
    .about-badge {
      display: inline-block;
      align-self: flex-start;
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(63, 185, 80, 0.15);
      color: var(--success);
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid rgba(63, 185, 80, 0.3);
    }
    .about-modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 0.92rem;
      line-height: 1.6;
    }
    .about-section-heading {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .about-section-lead {
      font-size: 0.95rem;
      color: var(--text);
      margin: 0 0 6px 0;
    }
    .about-section-lead strong {
      color: var(--accent);
    }
    .about-text {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.88rem;
    }
    .about-divider {
      height: 1px;
      background: var(--border);
      border: none;
      margin: 0;
    }
    .about-mono {
      font-family: 'JetBrains Mono', monospace;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.82rem;
    }
    .about-modal-footer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--bg-card);
      padding: 12px;
      border-radius: 8px;
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

    /* Chapter Completion Card (SQLite-backed) */
    .chapter-complete-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-top: 50px;
      padding: 22px 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      transition: all 0.2s ease;
      box-sizing: border-box;
      max-width: 100%;
    }
    .chapter-complete-card.is-completed {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.05);
    }
    .complete-card-info {
      flex: 1;
      min-width: 0;
    }
    .complete-card-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .chapter-complete-card.is-completed .complete-card-badge {
      color: #10b981;
    }
    .complete-card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 4px;
      word-break: break-word;
    }
    .complete-card-status-text {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.4;
      word-break: break-word;
    }
    .complete-card-timestamp {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      color: #10b981;
      margin-top: 4px;
      word-break: break-word;
    }
    .chapter-complete-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      background: var(--bg-card);
      border: 2px solid var(--accent);
      color: var(--ink);
      transition: all 0.2s ease;
      white-space: nowrap;
      box-sizing: border-box;
      max-width: 100%;
      flex-shrink: 0;
    }
    .chapter-complete-btn:hover {
      background: var(--accent);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .chapter-complete-btn.completed {
      background: #10b981;
      border-color: #10b981;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    }
    .chapter-complete-btn.completed:hover {
      background: #059669;
      border-color: #059669;
    }

    /* Per-Page SQLite Notes Section */
    .page-notes-card {
      margin-top: 24px;
      padding: 20px 22px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .page-notes-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .page-notes-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink);
    }
    .page-notes-db-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 7px;
      background: rgba(88, 166, 255, 0.12);
      color: var(--accent);
      border-radius: 4px;
    }
    .page-notes-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.76rem;
      color: var(--text-muted);
    }
    .page-notes-textarea {
      width: 100%;
      min-height: 110px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-card);
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem;
      line-height: 1.5;
      resize: vertical;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .page-notes-textarea:focus {
      border-color: var(--accent);
    }
    .page-notes-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.74rem;
      color: var(--text-muted);
    }

    /* Lesson Navigation Footer */
    .lesson-nav-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 60px;
      padding-top: 24px;
      padding-bottom: max(24px, calc(24px + env(safe-area-inset-bottom, 0px)), calc(24px + var(--safe-area-inset-bottom, 0px)));
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

    /* Header View Switcher */
    .view-switcher {
      display: inline-flex;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 2px;
      gap: 2px;
    }
    .view-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .view-btn:hover { color: var(--ink); }
    .view-btn.active {
      background: var(--blueprint);
      color: #ffffff;
    }

    /* Library Screen Styling */
    .library-header {
      padding: 32px 32px 20px;
      max-width: 1040px;
      margin: 0 auto;
    }
    .library-header-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--blueprint);
      margin-bottom: 8px;
    }
    .library-title {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 2.1rem;
      margin: 0 0 10px 0;
      color: var(--ink);
    }
    .library-desc {
      font-size: 1.02rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 20px;
      max-width: 800px;
    }
    .library-search-bar {
      max-width: 480px;
      margin-bottom: 8px;
    }
    .library-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 24px;
      padding: 0 32px 48px;
      max-width: 1040px;
      margin: 0 auto;
    }
    .library-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .library-card:hover {
      border-color: var(--blueprint);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .card-cover-bar {
      background: var(--bg-card);
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .card-vol-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--blueprint);
    }
    .card-size-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
      background: var(--bg-surface);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .card-body {
      padding: 20px 18px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-title {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 1.35rem;
      margin: 0 0 6px 0;
      color: var(--ink);
    }
    .card-subtitle {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin: 0 0 16px 0;
      line-height: 1.45;
    }
    .card-meta {
      display: flex;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      color: var(--ink-soft);
      margin-bottom: 12px;
    }
    .card-phases {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--ink-mute);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px dashed var(--border);
    }
    .card-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
    }
    .lib-action-btn {
      flex: 1;
      padding: 8px 10px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      color: var(--ink);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .lib-action-btn:hover {
      border-color: var(--blueprint);
      color: var(--blueprint);
    }
    .lib-action-btn.primary {
      background: var(--blueprint);
      border-color: var(--blueprint);
      color: #ffffff;
      flex: 1.4;
    }

    /* Standalone Book Reader Pane */
    .book-reader-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }
    .reader-toolbar {
      padding: 10px 20px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .reader-tool-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--ink);
      padding: 6px 14px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .reader-tool-btn:hover {
      border-color: var(--blueprint);
      color: var(--blueprint);
    }
    .reader-tool-btn.primary {
      background: var(--blueprint);
      color: #ffffff;
      border-color: var(--blueprint);
    }
    .reader-vol-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--blueprint);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reader-tool-actions {
      display: flex;
      gap: 8px;
    }
    .book-reader-container {
      flex: 1;
      height: calc(100vh - 114px);
      width: 100%;
      background: #fafaf5;
    }
    .book-reader-frame {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    /* Lesson Top Bar & User Tools */
    .lesson-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 0 16px;
    }
    .lesson-top-bar .breadcrumbs-bar {
      border-bottom: none;
      padding: 10px 0;
    }
    .lesson-user-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lesson-tool-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 6px;
      padding: 4px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .lesson-tool-btn:hover {
      color: var(--blueprint);
      border-color: var(--blueprint);
    }
    .lesson-tool-btn.active {
      background: rgba(88, 166, 255, 0.15);
      border-color: var(--blueprint);
      color: var(--blueprint);
    }
    .lesson-note-panel {
      margin: 16px 32px 0;
      background: var(--bg-card);
      border: 1px solid var(--blueprint);
      border-radius: 8px;
      padding: 14px 18px;
    }
    .note-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .note-panel-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.12em;
      color: var(--blueprint);
    }
    .note-save-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
    }
    .note-textarea {
      width: 100%;
      min-height: 80px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 0.95rem;
      padding: 10px 12px;
      resize: vertical;
      box-sizing: border-box;
      outline: none;
    }
    .note-textarea:focus {
      border-color: var(--blueprint);
    }

    /* Dashboard Header & Metrics */
    .dashboard-header {
      padding: 32px 32px 20px;
      max-width: 1040px;
      margin: 0 auto;
    }
    .dashboard-header-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--blueprint);
      margin-bottom: 8px;
    }
    .dashboard-title {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 2.1rem;
      margin: 0 0 10px 0;
      color: var(--ink);
    }
    .dashboard-desc {
      font-size: 1.02rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 20px;
      max-width: 800px;
    }
    .dashboard-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      padding: 0 32px 28px;
      max-width: 1040px;
      margin: 0 auto;
    }
    .metric-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
    }
    .metric-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .metric-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--blueprint);
      margin-bottom: 4px;
    }
    .metric-sub {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    /* Dashboard Tabs */
    .dashboard-tabs {
      display: flex;
      gap: 8px;
      padding: 0 32px;
      max-width: 1040px;
      margin: 0 auto 20px;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .dash-tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 10px 16px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .dash-tab-btn:hover {
      color: var(--ink);
    }
    .dash-tab-btn.active {
      color: var(--blueprint);
      border-bottom-color: var(--blueprint);
    }
    .dashboard-tab-content {
      padding: 0 32px 48px;
      max-width: 1040px;
      margin: 0 auto;
    }

    /* Phase Progress Grid */
    .phase-progress-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 16px;
    }
    .phase-prog-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .phase-prog-card:hover {
      border-color: var(--blueprint);
      transform: translateY(-2px);
    }
    .phase-prog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .phase-prog-title {
      font-size: 0.95rem;
      font-weight: bold;
      color: var(--ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .phase-prog-pct {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--blueprint);
      font-weight: bold;
    }
    .phase-prog-bar-bg {
      height: 6px;
      background: var(--bg-card);
      border-radius: 3px;
      overflow: hidden;
      margin: 8px 0;
    }
    .phase-prog-bar-fill {
      height: 100%;
      background: var(--blueprint);
      border-radius: 3px;
    }
    .phase-prog-meta {
      display: flex;
      justify-content: space-between;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* Bookmarks & Notes List */
    .saved-items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .saved-item-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .saved-item-main {
      flex: 1;
    }
    .saved-item-title {
      font-size: 1.05rem;
      font-weight: bold;
      color: var(--ink);
      margin-bottom: 4px;
      cursor: pointer;
    }
    .saved-item-title:hover {
      color: var(--blueprint);
    }
    .saved-item-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .saved-item-text {
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--ink-soft);
      margin-top: 8px;
      white-space: pre-wrap;
      background: var(--bg-card);
      padding: 10px 14px;
      border-radius: 6px;
      border-left: 3px solid var(--blueprint);
    }
    .saved-item-actions {
      display: flex;
      gap: 8px;
    }
    .saved-item-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--ink);
      padding: 6px 12px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.76rem;
      cursor: pointer;
    }
    .saved-item-btn:hover {
      border-color: var(--blueprint);
      color: var(--blueprint);
    }
    .saved-item-btn.danger {
      color: var(--danger);
    }
    .saved-item-btn.danger:hover {
      border-color: var(--danger);
      background: rgba(248, 81, 73, 0.1);
    }

    /* Backup Card */
    .backup-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 24px;
      max-width: 600px;
    }
    .backup-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .dash-action-btn {
      padding: 10px 18px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--ink);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .dash-action-btn.primary {
      background: var(--blueprint);
      color: #ffffff;
      border-color: var(--blueprint);
    }
    .backup-feedback {
      margin-top: 16px;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      background: rgba(63, 185, 80, 0.15);
      border: 1px solid var(--success);
      color: var(--success);
    }
    .backup-feedback.error {
      background: rgba(248, 81, 73, 0.15);
      border-color: var(--danger);
      color: var(--danger);
    }

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
        padding-top: max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px));
        padding-bottom: max(16px, env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px));
        padding-left: max(0px, env(safe-area-inset-left, 0px), var(--safe-area-inset-left, 0px));
        z-index: 50;
        transform: translateX(-100%);
        box-shadow: 4px 0 20px rgba(0,0,0,0.5);
      }
      aside.sidebar.open { transform: translateX(0); }
      .drawer-backdrop.open { display: block; }
      .breadcrumbs-bar { padding: 8px 16px; font-size: 0.75rem; }
      .article-wrap { padding: 20px 16px; padding-bottom: max(20px, calc(20px + env(safe-area-inset-bottom, 0px)), calc(20px + var(--safe-area-inset-bottom, 0px))); }
      .chapter-complete-card { flex-direction: column; align-items: stretch; gap: 16px; padding: 16px; margin-top: 32px; }
      .complete-card-info { width: 100%; }
      .chapter-complete-btn { width: 100%; justify-content: center; white-space: normal; text-align: center; padding: 12px 16px; font-size: 0.88rem; }
      .page-notes-card { padding: 16px; margin-top: 20px; }
      .page-notes-header { flex-direction: column; align-items: flex-start; gap: 8px; }
      .lesson-nav-footer { flex-direction: column; padding-bottom: max(24px, calc(24px + env(safe-area-inset-bottom, 0px)), calc(24px + var(--safe-area-inset-bottom, 0px))); }
      .nav-btn { max-width: 100%; }
      .header-title { display: none; }
      .library-header { padding: 20px 16px; }
      .library-grid { padding: 0 16px max(32px, calc(32px + env(safe-area-inset-bottom, 0px)), calc(32px + var(--safe-area-inset-bottom, 0px))); grid-template-columns: 1fr; }
      .dashboard-header { padding: 20px 16px; }
      .dashboard-metrics-grid { padding: 0 16px 20px; grid-template-columns: 1fr; }
      .dashboard-tabs { padding: 0 16px; }
      .dashboard-tab-content { padding: 0 16px max(32px, calc(32px + env(safe-area-inset-bottom, 0px)), calc(32px + var(--safe-area-inset-bottom, 0px))); }
      .phase-progress-grid { grid-template-columns: 1fr; }
      .lesson-note-panel { margin: 12px 16px 0; }
      .playground-header { padding: 16px; }
      .playground-body { grid-template-columns: 1fr; height: auto; padding-bottom: max(16px, calc(16px + env(safe-area-inset-bottom, 0px)), calc(16px + var(--safe-area-inset-bottom, 0px))); }
      .playground-editor-pane { min-height: 320px; border-right: none; border-bottom: 1px solid var(--border); }
      .playground-terminal-pane { min-height: 240px; }
    }

    /* In-Lesson Playground Action Button */
    .code-playground-btn {
      position: absolute;
      top: 0;
      right: 80px;
      min-width: 96px;
      height: 38px;
      padding: 0 10px;
      border: none;
      border-left: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      border-bottom-left-radius: 6px;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      z-index: 2;
    }
    .code-playground-btn:hover {
      background: var(--bg-surface);
      color: var(--success);
    }

    /* Code Playground View Styles */
    .playground-header {
      padding: 24px 28px 16px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
    }
    .playground-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--accent);
      background: rgba(88, 166, 255, 0.12);
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .playground-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.6rem;
      color: var(--ink);
      margin: 0 0 6px 0;
    }
    .playground-desc {
      margin: 0 0 16px 0;
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      max-width: 900px;
    }
    .playground-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .preset-selector-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .preset-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .playground-select {
      background: var(--bg-card);
      color: var(--ink);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .playground-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .play-action {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
    .playground-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: calc(100vh - 210px);
      min-height: 480px;
      overflow: hidden;
    }
    .playground-editor-pane {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border);
      background: var(--code-bg);
    }
    .editor-header, .terminal-header {
      padding: 10px 16px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .editor-title { color: var(--accent); }
    .editor-save-status { font-weight: normal; font-size: 0.72rem; color: var(--text-muted); }
    .editor-textarea-wrap {
      flex: 1;
      display: flex;
      position: relative;
    }
    .playground-textarea {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.6;
      padding: 16px;
      resize: none;
      outline: none;
      white-space: pre;
      tab-size: 2;
    }
    .playground-terminal-pane {
      display: flex;
      flex-direction: column;
      background: var(--bg-card);
    }
    .terminal-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
    }
    .terminal-badge.success {
      background: rgba(63, 185, 80, 0.15);
      color: var(--success);
    }
    .terminal-badge.error {
      background: rgba(248, 81, 73, 0.15);
      color: var(--danger);
    }
    .terminal-viewport {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      background: #0a0e14;
      color: #e6edf3;
    }
    .terminal-meta {
      display: flex;
      gap: 12px;
      padding-bottom: 10px;
      margin-bottom: 12px;
      border-bottom: 1px solid #21262d;
      font-size: 0.78rem;
    }
    .meta-status.status-ok { color: var(--success); font-weight: bold; }
    .meta-status.status-err { color: var(--danger); font-weight: bold; }
    .meta-time { color: var(--text-muted); }
    .meta-count { color: var(--text-muted); }
    .log-line { margin: 2px 0; word-break: break-all; white-space: pre-wrap; }
    .log-line.log-info { color: #c9d1d9; }
    .log-line.log-warn { color: var(--warn); }
    .log-line.log-err { color: var(--danger); }
    .log-line.log-empty { color: var(--text-muted); font-style: italic; }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-left">
      <button class="sidebar-toggle-btn" id="sidebarToggle" aria-label="Toggle Sidebar">☰</button>
      <div class="header-title">AI / FROM SCRATCH</div>
      <div class="view-switcher" id="viewSwitcher">
        <button class="view-btn active" id="viewLessonsBtn" data-view="lessons">📖 Lessons</button>
        <button class="view-btn" id="viewDashboardBtn" data-view="dashboard">📊 Study</button>
        <button class="view-btn" id="viewLibraryBtn" data-view="library">📚 Books</button>
        <button class="view-btn" id="viewPlaygroundBtn" data-view="playground">💻 JS Playground</button>
        <button class="view-btn" id="viewPythonPlaygroundBtn" data-view="python-playground">🐍 Python Playground</button>
      </div>
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
      <button class="font-btn" id="aboutBtn" title="About & Attribution">ℹ️</button>
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
      <div class="sidebar-footer" id="sidebarFooter">
        <div class="sidebar-attribution">
          <span class="sidebar-release-tag">v${pkgVersion} Release</span>
          <div class="sidebar-author">App: <strong>Amit Kumar</strong></div>
          <div class="sidebar-source">Curriculum: <strong>AI Engineering from Scratch</strong></div>
        </div>
      </div>
    </aside>

    <main class="content-area" id="contentArea">
      <!-- 1. Interactive Lesson View -->
      <div id="lessonView" class="view-pane" style="display: block;">
        <div class="lesson-top-bar">
          <div class="breadcrumbs-bar" id="breadcrumbsBar">Phase · Lesson</div>
          <div class="lesson-user-tools">
            <button class="lesson-tool-btn" id="bookmarkBtn" title="Toggle Bookmark">🔖 Bookmark</button>
            <button class="lesson-tool-btn" id="noteToggleBtn" title="Personal Notes">📝 Notes</button>
          </div>
        </div>
        <div class="lesson-note-panel" id="lessonNotePanel" style="display: none;">
          <div class="note-panel-header">
            <span class="note-panel-title">PERSONAL STUDY NOTE</span>
            <span class="note-save-status" id="noteSaveStatus">Saved locally</span>
          </div>
          <textarea class="note-textarea" id="noteTextarea" placeholder="Write personal reflections, formulas, or reminders for this lesson..."></textarea>
        </div>
        <div class="lesson-article article-wrap" id="articleWrap">
          <h1>Loading Curriculum...</h1>
        </div>
      </div>

      <!-- 2. Study Dashboard View -->
      <div id="studyDashboardView" class="view-pane" style="display: none;">
        <div class="dashboard-header">
          <div class="dashboard-header-badge">PERSONAL STUDY ANALYTICS & NOTES</div>
          <h1 class="dashboard-title">Study Dashboard</h1>
          <p class="dashboard-desc">Track curriculum progress across all 20 phases, review estimated study time remaining, revisit bookmarked lessons, and manage your personal notes.</p>
        </div>

        <div class="dashboard-metrics-grid" id="dashboardMetricsGrid"></div>

        <div class="dashboard-tabs">
          <button class="dash-tab-btn active" data-tab="phases">Phase Breakdown</button>
          <button class="dash-tab-btn" data-tab="bookmarks">Bookmarks (<span id="dashBookmarkCount">0</span>)</button>
          <button class="dash-tab-btn" data-tab="notes">Notes (<span id="dashNoteCount">0</span>)</button>
          <button class="dash-tab-btn" data-tab="backup">Backup & Restore</button>
        </div>

        <div class="dashboard-tab-content" id="dashTabPhases">
          <div class="phase-progress-grid" id="phaseProgressGrid"></div>
        </div>

        <div class="dashboard-tab-content" id="dashTabBookmarks" style="display: none;">
          <div class="saved-items-list" id="bookmarksList"></div>
        </div>

        <div class="dashboard-tab-content" id="dashTabNotes" style="display: none;">
          <div class="saved-items-list" id="notesList"></div>
        </div>

        <div class="dashboard-tab-content" id="dashTabBackup" style="display: none;">
          <div class="backup-card">
            <h3>Export & Import Study Data</h3>
            <p>Save your completion progress, bookmarks, personal notes, and quiz scores as a JSON backup file, or restore them onto any device.</p>
            <div class="backup-actions">
              <button class="dash-action-btn primary" id="exportDataBtn">📥 Export Study Data (.json)</button>
              <label class="dash-action-btn" style="cursor: pointer;">
                📤 Import Study Data
                <input type="file" id="importDataInput" accept=".json" style="display: none;">
              </label>
            </div>
            <div id="backupFeedback" class="backup-feedback" style="display: none;"></div>
          </div>

          <div class="backup-card" style="margin-top: 16px;">
            <h3>Official Release & Attribution</h3>
            <p><strong>App Version:</strong> ${pkgVersion} (Release Edition)</p>
            <p><strong>Offline App Architecture & Packaging:</strong> Amit Kumar</p>
            <p><strong>Curriculum & Pedagogical Source:</strong> AI Engineering from Scratch Contributors</p>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 8px;">Standalone offline edition featuring 542 lessons, 6 complete volumes, interactive quizzes, and local progress tracking.</p>
          </div>
        </div>
      </div>

      <!-- 3. Book Library View -->
      <div id="libraryView" class="view-pane" style="display: none;">
        <div class="library-header">
          <div class="library-header-badge">6 VOLUMES · 542 CHAPTERS · OFFLINE EDITIONS</div>
          <h1 class="library-title">Curriculum Book Library</h1>
          <p class="library-desc">Pre-compiled standalone volumes of the entire AI Engineering from Scratch curriculum. Read offline in-app, export full EPUB 3 archives to device storage, or generate clean print/PDF versions.</p>
          <div class="library-search-bar">
            <input type="text" class="search-input" id="librarySearchInput" placeholder="Filter book volumes by title, phase, or topic...">
          </div>
        </div>
        <div class="library-grid" id="libraryGrid"></div>
      </div>

      <!-- 4. Standalone Book Reader View -->
      <div id="bookReaderView" class="view-pane book-reader-view" style="display: none;">
        <div class="reader-toolbar">
          <button class="reader-tool-btn" id="readerBackBtn">← Back to Library</button>
          <div class="reader-vol-title" id="readerVolTitle">Volume Reader</div>
          <div class="reader-tool-actions">
            <a class="reader-tool-btn" id="readerExportEpubBtn" href="#" download title="Save EPUB to device">📥 Save EPUB</a>
            <button class="reader-tool-btn primary" id="readerPrintBtn" title="Print or save as PDF">🖨️ Print / PDF</button>
          </div>
        </div>
        <div class="book-reader-container">
          <iframe id="bookReaderFrame" class="book-reader-frame" src="about:blank" title="Book Volume Reader"></iframe>
        </div>
      </div>

      <!-- 5. Code Playground View -->
      <div id="playgroundView" class="view-pane" style="display: none;">
        <div class="playground-header">
          <div class="playground-header-info">
            <div class="playground-badge">INTERACTIVE OFFLINE SANDBOX</div>
            <h1 class="playground-title">Code Playground</h1>
            <p class="playground-desc">Experiment with foundational AI engineering algorithms, run raw math operations in JavaScript, or test code snippets directly from lessons.</p>
          </div>
          <div class="playground-toolbar">
            <div class="preset-selector-wrap">
              <label for="snippetSelect" class="preset-label">Preset Algorithm:</label>
              <select id="snippetSelect" class="playground-select">
                <option value="custom">Scratchpad (Custom)</option>
              </select>
            </div>
            <div class="playground-actions">
              <button id="runCodeBtn" class="dash-action-btn primary play-action" title="Execute Code (Ctrl+Enter)">▶ Run Code</button>
              <button id="resetCodeBtn" class="dash-action-btn play-action" title="Reset to Preset Default">↺ Reset</button>
              <button id="copyCodeBtn" class="dash-action-btn play-action" title="Copy Code">📋 Copy</button>
              <button id="clearOutputBtn" class="dash-action-btn play-action" title="Clear Console">🧹 Clear Output</button>
            </div>
          </div>
        </div>

        <div class="playground-body">
          <!-- Editor Pane -->
          <div class="playground-editor-pane">
            <div class="editor-header">
              <span class="editor-title" id="playgroundEditorTitle">SCRIPT EDITOR (JAVASCRIPT)</span>
              <div class="editor-meta">
                <span class="editor-save-status" id="playgroundSaveStatus">Saved locally</span>
              </div>
            </div>
            <div class="editor-textarea-wrap">
              <textarea id="playgroundCode" class="playground-textarea" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Write or paste your code here..."></textarea>
            </div>
          </div>

          <!-- Terminal Output Pane -->
          <div class="playground-terminal-pane">
            <div class="terminal-header">
              <span class="terminal-title">CONSOLE OUTPUT & EXECUTION LOGS</span>
              <span class="terminal-badge" id="terminalStatusBadge">IDLE</span>
            </div>
            <div id="playgroundOutput" class="terminal-viewport">
              <div class="log-line log-empty">Click "▶ Run Code" or press Ctrl+Enter to execute.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. Python ML Playground View -->
      <div id="pythonPlaygroundView" class="view-pane" style="display: none;">
        <div class="playground-header">
          <div class="playground-header-info">
            <div class="playground-badge">OFFLINE PYTHON 3.12 + NUMPY + SCIPY + SCIKIT-LEARN</div>
            <h1 class="playground-title">Python ML Playground</h1>
            <p class="playground-desc">Execute Machine Learning programs offline with pre-bundled NumPy, SciPy, and Scikit-Learn. Experiment with Andrew Ng foundational algorithms implemented from scratch and compared with production sklearn. External network and pip install are disabled.</p>
          </div>
          <div class="playground-toolbar">
            <div class="preset-selector-wrap">
              <label for="pythonSnippetSelect" class="preset-label">ML Model Preset:</label>
              <select id="pythonSnippetSelect" class="playground-select">
                <option value="custom">Scratchpad (Custom)</option>
              </select>
            </div>
            <div class="playground-actions">
              <button id="runPythonBtn" class="dash-action-btn primary play-action" title="Execute Python Code (Ctrl+Enter)">▶ Run Python</button>
              <button id="resetPythonBtn" class="dash-action-btn play-action" title="Reset to Preset Default">↺ Reset</button>
              <button id="copyPythonBtn" class="dash-action-btn play-action" title="Copy Python Code">📋 Copy</button>
              <button id="clearPythonOutputBtn" class="dash-action-btn play-action" title="Clear Console Output">🧹 Clear Output</button>
            </div>
          </div>
        </div>

        <div class="playground-body">
          <!-- Editor Pane -->
          <div class="playground-editor-pane">
            <div class="editor-header">
              <span class="editor-title" id="pythonEditorTitle">PYTHON SCRIPT EDITOR (NUMPY & SCIKIT-LEARN)</span>
              <div class="editor-meta">
                <span class="editor-save-status" id="pythonSaveStatus">Saved locally</span>
              </div>
            </div>
            <div class="editor-textarea-wrap">
              <textarea id="pythonCode" class="playground-textarea" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Write or paste your Python code here..."></textarea>
            </div>
          </div>

          <!-- Terminal Output Pane -->
          <div class="playground-terminal-pane">
            <div class="terminal-header">
              <span class="terminal-title">CONSOLE OUTPUT & EXECUTION LOGS</span>
              <span class="terminal-badge" id="pythonTerminalBadge">PYTHON 3.12</span>
            </div>
            <div id="pythonOutput" class="terminal-viewport">
              <div class="log-line log-empty">Click "▶ Run Python" or press Ctrl+Enter to execute.</div>
            </div>
          </div>
        </div>
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

  <!-- About & Attribution Modal -->
  <div class="about-modal-backdrop" id="aboutModal">
    <div class="about-modal-card">
      <div class="about-modal-header">
        <div class="about-title-wrap">
          <h2 class="about-title">AI Engineering from Scratch</h2>
          <span class="about-badge">v${pkgVersion} Official Release</span>
        </div>
        <button class="figure-tool-btn close" id="closeAboutBtn" title="Close">✕</button>
      </div>
      <div class="about-modal-body">
        <div class="about-section">
          <div class="about-section-heading">📱 App Architecture & Packaging</div>
          <p class="about-section-lead">Packaged & Engineered for Android Tablets and Mobiles by <strong>Amit Kumar</strong></p>
          <p class="about-text">Engineered as a standalone, 100% offline-first Android learning experience with pre-rendered DOM caching, local font packaging, touch-optimized dual-pane responsive layout, interactive quiz grader, 6-volume offline book library, client-side search engine, and device study backup.</p>
        </div>
        <hr class="about-divider">
        <div class="about-section">
          <div class="about-section-heading">📚 Curriculum & Pedagogical Content</div>
          <p class="about-section-lead">Curriculum Source: <strong>AI Engineering from Scratch Contributors</strong></p>
          <p class="about-text">All 542 lessons across 20 phases, original algorithm implementations, tests, and deep-dive explanations are authored and maintained by the AI Engineering from Scratch curriculum repository contributors.</p>
          <p class="about-text" style="margin-top: 6px;">Source Repository: <span class="about-mono">github.com/ai-engineering-from-scratch</span> · Open Source Curriculum</p>
        </div>
        <hr class="about-divider">
        <div class="about-modal-footer">
          <div>Build: <strong>${pkgVersion} (Signed Release APK)</strong> · Local Database: <strong>542 Lessons / 6 Volumes</strong></div>
          <div>Zero External Network Dependencies · 100% On-Device Storage</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.AIFS_FIGURE_PROVIDER_VERSIONS = {};
  </script>
  <script src="figure-manifest.js"></script>
  <script src="figures.js"></script>
  <script src="lesson-figures.js"></script>
  <script src="mermaid.min.js"></script>
  <script src="katex.min.js"></script>
  <script src="viewer-controller.js"></script>
  <script src="library-controller.js"></script>
  <script src="sqlite-db.js"></script>
  <script src="study-controller.js"></script>
  <script src="search-engine.js"></script>
  <script src="playground-controller.js"></script>
  <script src="python-playground-controller.js"></script>
  <script src="app.js"></script>
</body>
</html>`;

  const jsContent = `'use strict';

(function () {
  let curriculum = null;
  let allLessonsInOrder = [];
  let lessonIndexMap = new Map();
  let activeLessonId = null;
  // Initialize Local SQLite Database (Phase 9)
  const sqliteDb = typeof SQLiteDatabase !== 'undefined' ? new SQLiteDatabase() : null;
  const completedLessons = new Set();
  if (sqliteDb) {
    const completions = sqliteDb.getAllCompletedChapters();
    if (completions && completions.length > 0) {
      completions.forEach(c => completedLessons.add(c.lesson_id));
    } else {
      const legacy = JSON.parse(localStorage.getItem('completed_lessons') || '[]');
      legacy.forEach(id => {
        completedLessons.add(id);
        sqliteDb.markChapterComplete(id, '', id);
      });
    }
  } else {
    const legacy = JSON.parse(localStorage.getItem('completed_lessons') || '[]');
    legacy.forEach(id => completedLessons.add(id));
  }

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
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');

  // View Switcher & Screen Management
  const viewLessonsBtn = document.getElementById('viewLessonsBtn');
  const viewDashboardBtn = document.getElementById('viewDashboardBtn');
  const viewLibraryBtn = document.getElementById('viewLibraryBtn');
  const viewPlaygroundBtn = document.getElementById('viewPlaygroundBtn');
  const viewPythonPlaygroundBtn = document.getElementById('viewPythonPlaygroundBtn');
  const lessonView = document.getElementById('lessonView');
  const studyDashboardView = document.getElementById('studyDashboardView');
  const libraryView = document.getElementById('libraryView');
  const bookReaderView = document.getElementById('bookReaderView');
  const playgroundView = document.getElementById('playgroundView');
  const pythonPlaygroundView = document.getElementById('pythonPlaygroundView');
  const libraryGrid = document.getElementById('libraryGrid');
  const librarySearchInput = document.getElementById('librarySearchInput');
  const readerBackBtn = document.getElementById('readerBackBtn');
  const readerPrintBtn = document.getElementById('readerPrintBtn');
  const readerExportEpubBtn = document.getElementById('readerExportEpubBtn');
  const readerVolTitle = document.getElementById('readerVolTitle');
  const bookReaderFrame = document.getElementById('bookReaderFrame');

  // Code Playground Elements
  const playgroundCode = document.getElementById('playgroundCode');
  const snippetSelect = document.getElementById('snippetSelect');
  const runCodeBtn = document.getElementById('runCodeBtn');
  const resetCodeBtn = document.getElementById('resetCodeBtn');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const playgroundOutput = document.getElementById('playgroundOutput');
  const playgroundSaveStatus = document.getElementById('playgroundSaveStatus');
  const terminalStatusBadge = document.getElementById('terminalStatusBadge');
  const playgroundEditorTitle = document.getElementById('playgroundEditorTitle');

  // Python ML Playground Elements
  const pythonCode = document.getElementById('pythonCode');
  const pythonSnippetSelect = document.getElementById('pythonSnippetSelect');
  const runPythonBtn = document.getElementById('runPythonBtn');
  const resetPythonBtn = document.getElementById('resetPythonBtn');
  const copyPythonBtn = document.getElementById('copyPythonBtn');
  const clearPythonOutputBtn = document.getElementById('clearPythonOutputBtn');
  const pythonOutput = document.getElementById('pythonOutput');
  const pythonSaveStatus = document.getElementById('pythonSaveStatus');
  const pythonTerminalBadge = document.getElementById('pythonTerminalBadge');
  const pythonEditorTitle = document.getElementById('pythonEditorTitle');

  // Study Dashboard & Notes Elements
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const noteToggleBtn = document.getElementById('noteToggleBtn');
  const lessonNotePanel = document.getElementById('lessonNotePanel');
  const noteTextarea = document.getElementById('noteTextarea');
  const noteSaveStatus = document.getElementById('noteSaveStatus');
  const dashboardMetricsGrid = document.getElementById('dashboardMetricsGrid');
  const phaseProgressGrid = document.getElementById('phaseProgressGrid');
  const bookmarksList = document.getElementById('bookmarksList');
  const notesList = document.getElementById('notesList');
  const dashBookmarkCount = document.getElementById('dashBookmarkCount');
  const dashNoteCount = document.getElementById('dashNoteCount');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataInput = document.getElementById('importDataInput');
  const backupFeedback = document.getElementById('backupFeedback');

  // Local Study State
  let userBookmarks = JSON.parse(localStorage.getItem('user_bookmarks') || '[]');
  let userNotes = {};
  if (sqliteDb) {
    const dbNotes = sqliteDb.getAllPageNotes();
    if (dbNotes && dbNotes.length > 0) {
      dbNotes.forEach(n => {
        userNotes[n.lesson_id] = {
          lessonId: n.lesson_id,
          lessonTitle: n.title,
          phaseId: n.phase_id,
          text: n.note_text,
          updatedAt: n.updated_at,
        };
      });
    } else {
      const legacyNotes = JSON.parse(localStorage.getItem('user_notes') || '{}');
      for (const [id, n] of Object.entries(legacyNotes)) {
        userNotes[id] = n;
        sqliteDb.savePageNote(id, n.phaseId || '', n.lessonTitle || id, n.text, n.updatedAt);
      }
    }
  } else {
    userNotes = JSON.parse(localStorage.getItem('user_notes') || '{}');
  }
  let quizScores = JSON.parse(localStorage.getItem('quiz_scores') || '{}');
  let currentLoadedLesson = null;
  let libraryManifest = [];

  function switchView(viewName) {
    if (viewName === 'lessons') {
      if (lessonView) lessonView.style.display = 'block';
      if (studyDashboardView) studyDashboardView.style.display = 'none';
      if (libraryView) libraryView.style.display = 'none';
      if (bookReaderView) bookReaderView.style.display = 'none';
      if (playgroundView) playgroundView.style.display = 'none';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'none';
      if (viewLessonsBtn) viewLessonsBtn.classList.add('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.remove('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.remove('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.remove('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.remove('active');
    } else if (viewName === 'dashboard') {
      if (lessonView) lessonView.style.display = 'none';
      if (studyDashboardView) studyDashboardView.style.display = 'block';
      if (libraryView) libraryView.style.display = 'none';
      if (bookReaderView) bookReaderView.style.display = 'none';
      if (playgroundView) playgroundView.style.display = 'none';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'none';
      if (viewLessonsBtn) viewLessonsBtn.classList.remove('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.add('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.remove('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.remove('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.remove('active');
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
      renderDashboard();
    } else if (viewName === 'library') {
      if (lessonView) lessonView.style.display = 'none';
      if (studyDashboardView) studyDashboardView.style.display = 'none';
      if (libraryView) libraryView.style.display = 'block';
      if (bookReaderView) bookReaderView.style.display = 'none';
      if (playgroundView) playgroundView.style.display = 'none';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'none';
      if (viewLessonsBtn) viewLessonsBtn.classList.remove('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.remove('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.add('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.remove('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.remove('active');
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
    } else if (viewName === 'reader') {
      if (lessonView) lessonView.style.display = 'none';
      if (studyDashboardView) studyDashboardView.style.display = 'none';
      if (libraryView) libraryView.style.display = 'none';
      if (bookReaderView) bookReaderView.style.display = 'flex';
      if (playgroundView) playgroundView.style.display = 'none';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'none';
      if (viewLessonsBtn) viewLessonsBtn.classList.remove('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.remove('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.add('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.remove('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.remove('active');
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
    } else if (viewName === 'playground') {
      if (lessonView) lessonView.style.display = 'none';
      if (studyDashboardView) studyDashboardView.style.display = 'none';
      if (libraryView) libraryView.style.display = 'none';
      if (bookReaderView) bookReaderView.style.display = 'none';
      if (playgroundView) playgroundView.style.display = 'block';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'none';
      if (viewLessonsBtn) viewLessonsBtn.classList.remove('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.remove('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.remove('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.add('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.remove('active');
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
    } else if (viewName === 'python-playground') {
      if (lessonView) lessonView.style.display = 'none';
      if (studyDashboardView) studyDashboardView.style.display = 'none';
      if (libraryView) libraryView.style.display = 'none';
      if (bookReaderView) bookReaderView.style.display = 'none';
      if (playgroundView) playgroundView.style.display = 'none';
      if (pythonPlaygroundView) pythonPlaygroundView.style.display = 'block';
      if (viewLessonsBtn) viewLessonsBtn.classList.remove('active');
      if (viewDashboardBtn) viewDashboardBtn.classList.remove('active');
      if (viewLibraryBtn) viewLibraryBtn.classList.remove('active');
      if (viewPlaygroundBtn) viewPlaygroundBtn.classList.remove('active');
      if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.classList.add('active');
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
      if (typeof window.__initPythonWorker === 'function') {
        window.__initPythonWorker();
      }
    }
  }

  if (viewLessonsBtn) viewLessonsBtn.addEventListener('click', () => switchView('lessons'));
  if (viewDashboardBtn) viewDashboardBtn.addEventListener('click', () => switchView('dashboard'));
  if (viewLibraryBtn) viewLibraryBtn.addEventListener('click', () => switchView('library'));
  if (viewPlaygroundBtn) viewPlaygroundBtn.addEventListener('click', () => switchView('playground'));
  if (viewPythonPlaygroundBtn) viewPythonPlaygroundBtn.addEventListener('click', () => switchView('python-playground'));
  if (readerBackBtn) readerBackBtn.addEventListener('click', () => switchView('library'));

  // User Bookmark & Note controls
  function updateLessonUserTools(lesson) {
    if (!lesson) return;
    const isBkm = typeof isBookmarked === 'function' ? isBookmarked(userBookmarks, lesson.id) : false;
    if (bookmarkBtn) {
      bookmarkBtn.classList.toggle('active', isBkm);
      bookmarkBtn.textContent = isBkm ? '★ Bookmarked' : '🔖 Bookmark';
    }
    const note = (sqliteDb && typeof sqliteDb.getPageNote === 'function')
      ? sqliteDb.getPageNote(lesson.id)
      : (typeof getNote === 'function' ? getNote(userNotes, lesson.id) : null);
    const noteText = note ? (note.note_text || note.text || '') : '';

    if (noteToggleBtn) {
      noteToggleBtn.classList.toggle('active', !!noteText);
      noteToggleBtn.textContent = noteText ? '📝 Note (1)' : '📝 Notes';
    }
    if (noteTextarea) {
      noteTextarea.value = noteText;
    }
    if (noteSaveStatus) {
      noteSaveStatus.textContent = noteText ? 'Saved to SQLite' : '';
    }

    // Synchronize dedicated in-page notes section if present
    const pageNotesTextarea = document.getElementById('pageNotesTextarea');
    const pageNotesStatus = document.getElementById('pageNotesStatus');
    const pageNotesCharCount = document.getElementById('pageNotesCharCount');
    if (pageNotesTextarea && pageNotesTextarea.value !== noteText) {
      pageNotesTextarea.value = noteText;
    }
    if (pageNotesStatus) {
      pageNotesStatus.textContent = noteText ? 'Saved to SQLite Database (page_notes)' : 'Ready';
    }
    if (pageNotesCharCount) {
      pageNotesCharCount.textContent = noteText.length + ' characters';
    }
  }

  function updateCompletionButtonUI(lessonId, isCompleted, timestamp) {
    const card = document.getElementById('chapterCompleteCard');
    const btn = document.getElementById('markCompleteBtn');
    const statusText = document.getElementById('completeStatusText');
    const timeEl = document.getElementById('completeCardTimestamp');

    if (!btn) return;
    if (isCompleted) {
      btn.classList.add('completed');
      btn.innerHTML = '<span class="complete-icon">✓</span><span class="complete-text">Chapter Completed</span>';
      if (card) card.classList.add('is-completed');
      if (statusText) statusText.textContent = '✓ Completed and tracked in local SQLite database';
      if (timeEl) {
        const d = timestamp ? new Date(timestamp) : new Date();
        timeEl.textContent = 'Completed on ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      btn.classList.remove('completed');
      btn.innerHTML = '<span class="complete-icon">○</span><span class="complete-text">Mark Chapter as Complete</span>';
      if (card) card.classList.remove('is-completed');
      if (statusText) statusText.textContent = 'Mark this chapter as complete to record your progress in SQLite.';
      if (timeEl) timeEl.textContent = '';
    }
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', () => {
      if (!currentLoadedLesson) return;
      if (typeof toggleBookmark === 'function') {
        userBookmarks = toggleBookmark(userBookmarks, currentLoadedLesson);
        localStorage.setItem('user_bookmarks', JSON.stringify(userBookmarks));
        updateLessonUserTools(currentLoadedLesson);
        updateProgress();
      }
    });
  }

  if (noteToggleBtn) {
    noteToggleBtn.addEventListener('click', () => {
      if (lessonNotePanel) {
        const isVisible = lessonNotePanel.style.display !== 'none';
        lessonNotePanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && noteTextarea) {
          noteTextarea.focus();
        }
      }
    });
  }

  let noteSaveTimeout = null;
  if (noteTextarea) {
    noteTextarea.addEventListener('input', () => {
      const text = noteTextarea.value;
      const pageTextarea = document.getElementById('pageNotesTextarea');
      const pageStatus = document.getElementById('pageNotesStatus');
      const pageCharCount = document.getElementById('pageNotesCharCount');
      if (pageTextarea && pageTextarea.value !== text) pageTextarea.value = text;
      if (pageCharCount) pageCharCount.textContent = text.length + ' characters';
      if (noteSaveStatus) noteSaveStatus.textContent = 'Saving...';
      if (pageStatus) pageStatus.textContent = 'Saving to SQLite...';

      clearTimeout(noteSaveTimeout);
      noteSaveTimeout = setTimeout(() => {
        if (!currentLoadedLesson) return;
        if (sqliteDb) {
          sqliteDb.savePageNote(currentLoadedLesson.id, currentLoadedLesson.phaseId, currentLoadedLesson.title, text);
        }
        if (typeof saveNote === 'function') {
          userNotes = saveNote(userNotes, currentLoadedLesson, text);
          localStorage.setItem('user_notes', JSON.stringify(userNotes));
        }
        const savedLabel = text.trim() ? 'Saved to SQLite Database (page_notes)' : 'Ready';
        if (pageStatus) pageStatus.textContent = savedLabel;
        if (noteSaveStatus) noteSaveStatus.textContent = text.trim() ? 'Saved to SQLite' : '';
        updateLessonUserTools(currentLoadedLesson);
        updateProgress();
      }, 350);
    });
  }

  function renderDashboard() {
    if (!curriculum) return;
    const stats = typeof computeStudyStats === 'function'
      ? computeStudyStats(curriculum, Array.from(completedLessons), userBookmarks, userNotes, quizScores)
      : null;

    if (!stats) return;

    if (dashBookmarkCount) dashBookmarkCount.textContent = stats.bookmarkCount;
    if (dashNoteCount) dashNoteCount.textContent = stats.noteCount;

    // Render Metrics Grid
    if (dashboardMetricsGrid) {
      dashboardMetricsGrid.innerHTML = \`
        <div class="metric-card">
          <span class="metric-label">Curriculum Completion</span>
          <span class="metric-value">\${stats.overallPercentage}%</span>
          <span class="metric-sub">\${stats.completedCount} of \${stats.totalLessons} Lessons</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Study Time Remaining</span>
          <span class="metric-value">\${stats.remainingHours}h</span>
          <span class="metric-sub">Across Unfinished Lessons</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Saved Bookmarks</span>
          <span class="metric-value">\${stats.bookmarkCount}</span>
          <span class="metric-sub">Quick Reference</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Personal Notes</span>
          <span class="metric-value">\${stats.noteCount}</span>
          <span class="metric-sub">Study Reflections</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Quiz Accuracy</span>
          <span class="metric-value">\${stats.avgQuizScore}%</span>
          <span class="metric-sub">\${stats.quizzesTaken} Quizzes Completed</span>
        </div>
      \`;
    }

    // Render Phase Progress Grid
    if (phaseProgressGrid) {
      phaseProgressGrid.innerHTML = stats.phaseStats.map(ps => \`
        <div class="phase-prog-card" data-phase-id="\${ps.id}">
          <div class="phase-prog-header">
            <span class="phase-prog-title">Phase \${ps.number}: \${ps.title}</span>
            <span class="phase-prog-pct">\${ps.percentage}%</span>
          </div>
          <div class="phase-prog-bar-bg">
            <div class="phase-prog-bar-fill" style="width: \${ps.percentage}%"></div>
          </div>
          <div class="phase-prog-meta">
            <span>\${ps.completed} / \${ps.total} Lessons</span>
            <span>~\${Math.round(ps.remainingMinutes)}m left</span>
          </div>
        </div>
      \`).join('');

      phaseProgressGrid.querySelectorAll('.phase-prog-card').forEach(card => {
        card.addEventListener('click', () => {
          const phaseId = card.getAttribute('data-phase-id');
          const p = curriculum.phases.find(x => x.id === phaseId);
          if (p && p.lessons && p.lessons[0]) {
            loadLesson(p.lessons[0].id);
          }
        });
      });
    }

    // Render Bookmarks List
    if (bookmarksList) {
      if (userBookmarks.length === 0) {
        bookmarksList.innerHTML = '<p style="color:var(--text-muted);font-family:JetBrains Mono,monospace;padding:24px 0;">No bookmarked lessons yet. Click "🔖 Bookmark" on any lesson to save it here.</p>';
      } else {
        bookmarksList.innerHTML = userBookmarks.map(b => \`
          <div class="saved-item-card" data-id="\${b.id}">
            <div class="saved-item-main">
              <div class="saved-item-title jump-to-lesson" data-id="\${b.id}">\${b.title}</div>
              <div class="saved-item-meta">\${b.phaseId} · Saved on \${new Date(b.bookmarkedAt).toLocaleDateString()}</div>
            </div>
            <div class="saved-item-actions">
              <button class="saved-item-btn jump-to-lesson" data-id="\${b.id}">Open</button>
              <button class="saved-item-btn danger remove-bookmark" data-id="\${b.id}">Remove</button>
            </div>
          </div>
        \`).join('');

        bookmarksList.querySelectorAll('.jump-to-lesson').forEach(el => {
          el.addEventListener('click', () => loadLesson(el.getAttribute('data-id')));
        });

        bookmarksList.querySelectorAll('.remove-bookmark').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            userBookmarks = userBookmarks.filter(b => b.id !== id);
            localStorage.setItem('user_bookmarks', JSON.stringify(userBookmarks));
            renderDashboard();
            if (currentLoadedLesson && currentLoadedLesson.id === id) {
              updateLessonUserTools(currentLoadedLesson);
            }
          });
        });
      }
    }

    // Render Notes List
    if (notesList) {
      const notesArray = Object.values(userNotes);
      if (notesArray.length === 0) {
        notesList.innerHTML = '<p style="color:var(--text-muted);font-family:JetBrains Mono,monospace;padding:24px 0;">No study notes yet. Click "📝 Notes" on any lesson to write reflections.</p>';
      } else {
        notesList.innerHTML = notesArray.map(n => \`
          <div class="saved-item-card" data-id="\${n.lessonId}">
            <div class="saved-item-main">
              <div class="saved-item-title jump-to-lesson" data-id="\${n.lessonId}">\${n.lessonTitle}</div>
              <div class="saved-item-meta">\${n.phaseId} · Updated \${new Date(n.updatedAt).toLocaleDateString()}</div>
              <div class="saved-item-text">\${n.text}</div>
            </div>
            <div class="saved-item-actions">
              <button class="saved-item-btn jump-to-lesson" data-id="\${n.lessonId}">Open</button>
              <button class="saved-item-btn danger delete-note" data-id="\${n.lessonId}">Delete</button>
            </div>
          </div>
        \`).join('');

        notesList.querySelectorAll('.jump-to-lesson').forEach(el => {
          el.addEventListener('click', () => loadLesson(el.getAttribute('data-id')));
        });

        notesList.querySelectorAll('.delete-note').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            delete userNotes[id];
            if (sqliteDb) sqliteDb.deletePageNote(id);
            localStorage.setItem('user_notes', JSON.stringify(userNotes));
            renderDashboard();
            if (currentLoadedLesson && currentLoadedLesson.id === id) {
              updateLessonUserTools(currentLoadedLesson);
            }
          });
        });
      }
    }
  }

  // Dashboard Sub-tabs
  document.querySelectorAll('.dash-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.getAttribute('data-tab');

      document.querySelectorAll('.dashboard-tab-content').forEach(c => c.style.display = 'none');
      if (tabName === 'phases') document.getElementById('dashTabPhases').style.display = 'block';
      if (tabName === 'bookmarks') document.getElementById('dashTabBookmarks').style.display = 'block';
      if (tabName === 'notes') document.getElementById('dashTabNotes').style.display = 'block';
      if (tabName === 'backup') document.getElementById('dashTabBackup').style.display = 'block';
    });
  });

  // Export Data
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const payload = typeof exportUserData === 'function' ? exportUserData({
        completedLessons: Array.from(completedLessons),
        bookmarks: userBookmarks,
        notes: userNotes,
        quizScores: quizScores,
      }) : JSON.stringify({ completedLessons: Array.from(completedLessons) });

      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`ai-engineering-study-backup-\${new Date().toISOString().slice(0, 10)}.json\`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Import Data
  if (importDataInput) {
    importDataInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const res = typeof importUserData === 'function' ? importUserData(text) : { success: false, error: 'Unavailable' };
        if (res.success) {
          completedLessons.clear();
          (res.data.completedLessons || []).forEach(id => completedLessons.add(id));
          userBookmarks = res.data.bookmarks || [];
          userNotes = res.data.notes || {};
          quizScores = res.data.quizScores || {};

          localStorage.setItem('completed_lessons', JSON.stringify(Array.from(completedLessons)));
          localStorage.setItem('user_bookmarks', JSON.stringify(userBookmarks));
          localStorage.setItem('user_notes', JSON.stringify(userNotes));
          localStorage.setItem('quiz_scores', JSON.stringify(quizScores));

          if (sqliteDb) {
            (res.data.completedLessons || []).forEach(id => sqliteDb.markChapterComplete(id, '', id));
            for (const [id, n] of Object.entries(res.data.notes || {})) {
              sqliteDb.savePageNote(id, n.phaseId || '', n.lessonTitle || id, n.text, n.updatedAt);
            }
          }

          if (curriculum) renderSidebar(curriculum.phases);
          updateProgress();
          renderDashboard();

          if (backupFeedback) {
            backupFeedback.style.display = 'block';
            backupFeedback.className = 'backup-feedback';
            backupFeedback.textContent = 'Study data restored successfully!';
            setTimeout(() => { backupFeedback.style.display = 'none'; }, 4000);
          }
        } else {
          if (backupFeedback) {
            backupFeedback.style.display = 'block';
            backupFeedback.className = 'backup-feedback error';
            backupFeedback.textContent = 'Restore failed: ' + res.error;
          }
        }
      };
      reader.readAsText(file);
    });
  }

  // Load 6-Volume Book Library
  fetch('books/library.json')
    .then(res => res.json())
    .then(manifest => {
      libraryManifest = manifest;
      renderLibraryGrid(manifest);
    })
    .catch(err => {
      console.warn('Could not load library.json:', err);
      if (libraryGrid) {
        libraryGrid.innerHTML = '<p style="color:var(--text-muted);font-family:JetBrains Mono,monospace;padding:24px;">Could not load book library: ' + err.message + '</p>';
      }
    });

  function renderLibraryGrid(volumes) {
    if (!libraryGrid) return;
    if (!volumes || volumes.length === 0) {
      libraryGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-family: JetBrains Mono, monospace; padding: 40px;">No volumes found matching search</p>';
      return;
    }
    libraryGrid.innerHTML = volumes.map(vol => {
      return typeof renderVolumeCardHtml === 'function' ? renderVolumeCardHtml(vol) : '';
    }).join('');

    // Wire action buttons
    libraryGrid.querySelectorAll('.read-vol-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const volNum = parseInt(btn.getAttribute('data-vol'), 10);
        openBookReader(volNum, url);
      });
    });

    libraryGrid.querySelectorAll('.print-vol-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const card = btn.closest('.library-card');
        const volNum = card ? parseInt(card.getAttribute('data-volume-num'), 10) : 1;
        openBookReader(volNum, url, true);
      });
    });
  }

  function openBookReader(volNum, url, autoPrint = false) {
    const vol = libraryManifest.find(v => v.number === volNum) || { title: \`Volume \${volNum}\` };
    if (readerVolTitle) readerVolTitle.textContent = \`Volume \${vol.roman || volNum}: \${vol.title}\`;
    if (readerExportEpubBtn && vol.epubFile) {
      readerExportEpubBtn.href = \`books/\${vol.epubFile}\`;
      readerExportEpubBtn.setAttribute('download', vol.epubFile);
    }
    if (bookReaderFrame) {
      bookReaderFrame.src = url;
      if (autoPrint) {
        bookReaderFrame.onload = () => {
          try {
            bookReaderFrame.contentWindow.print();
          } catch (_) {}
        };
      } else {
        bookReaderFrame.onload = null;
      }
    }
    switchView('reader');
  }

  if (readerPrintBtn) {
    readerPrintBtn.addEventListener('click', () => {
      if (bookReaderFrame && bookReaderFrame.contentWindow) {
        try {
          bookReaderFrame.contentWindow.print();
        } catch (err) {
          console.warn('Print error:', err);
        }
      }
    });
  }

  if (librarySearchInput) {
    librarySearchInput.addEventListener('input', () => {
      const q = librarySearchInput.value.trim();
      const filtered = typeof filterVolumes === 'function' ? filterVolumes(libraryManifest, q) : libraryManifest;
      renderLibraryGrid(filtered);
    });
  }

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
    switchView('lessons');
    activeLessonId = lessonId;
    localStorage.setItem('last_lesson', lessonId);

    // Update active highlight in sidebar
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));

    articleWrap.innerHTML = '<p>Loading lesson...</p>';
    fetch(\`data/lessons/\${lessonId}.json\`)
      .then(res => res.json())
      .then(lesson => {
        currentLoadedLesson = lesson;
        updateLessonUserTools(lesson);
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

    // Phase 9: Chapter Completion & Per-Page SQLite Notes
    const isCompleted = completedLessons.has(lesson.id);
    const completionRec = sqliteDb ? sqliteDb.getChapterCompletion(lesson.id) : null;
    let completionDateStr = '';
    if (isCompleted && completionRec && completionRec.completed_at) {
      const d = new Date(completionRec.completed_at);
      completionDateStr = 'Completed on ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const noteRec = (sqliteDb && typeof sqliteDb.getPageNote === 'function')
      ? sqliteDb.getPageNote(lesson.id)
      : (typeof getNote === 'function' ? getNote(userNotes, lesson.id) : null);
    const existingNoteText = noteRec ? (noteRec.note_text || noteRec.text || '') : '';

    // Chapter Completion Card
    content += '<div class="chapter-complete-card ' + (isCompleted ? 'is-completed' : '') + '" id="chapterCompleteCard">';
    content += '  <div class="complete-card-info">';
    content += '    <div class="complete-card-badge">CHAPTER PROGRESS</div>';
    content += '    <div class="complete-card-title">' + (lesson.title || '') + '</div>';
    content += '    <div class="complete-card-status-text" id="completeStatusText">' + (isCompleted ? '✓ Completed and tracked in local SQLite database' : 'Mark this chapter as complete to record your progress in SQLite.') + '</div>';
    content += '    <div class="complete-card-timestamp" id="completeCardTimestamp">' + completionDateStr + '</div>';
    content += '  </div>';
    content += '  <button class="chapter-complete-btn ' + (isCompleted ? 'completed' : '') + '" id="markCompleteBtn" data-lesson-id="' + lesson.id + '">';
    content += '    <span class="complete-icon">' + (isCompleted ? '✓' : '○') + '</span>';
    content += '    <span class="complete-text">' + (isCompleted ? 'Chapter Completed' : 'Mark Chapter as Complete') + '</span>';
    content += '  </button>';
    content += '</div>';

    // Dedicated Per-Page SQLite Notes Section
    content += '<div class="page-notes-card" id="pageNotesCard">';
    content += '  <div class="page-notes-header">';
    content += '    <div class="page-notes-title">';
    content += '      <span class="page-notes-icon">📝</span>';
    content += '      <span>Chapter Notes</span>';
    content += '      <span class="page-notes-db-badge">🗄️ SQLite Table: page_notes</span>';
    content += '    </div>';
    content += '    <span class="page-notes-status" id="pageNotesStatus">' + (existingNoteText ? 'Saved to SQLite Database (page_notes)' : 'Ready') + '</span>';
    content += '  </div>';
    content += '  <textarea class="page-notes-textarea" id="pageNotesTextarea" placeholder="Take personal study notes for this chapter... auto-saved to local SQLite database.">' + existingNoteText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea>';
    content += '  <div class="page-notes-footer">';
    content += '    <span class="page-notes-char-count" id="pageNotesCharCount">' + existingNoteText.length + ' characters</span>';
    content += '    <span class="page-notes-hint">Synced with top-bar Notes panel</span>';
    content += '  </div>';
    content += '</div>';

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

    // Wire up built-in code block copy buttons and playground launcher
    articleWrap.querySelectorAll('pre').forEach(pre => {
      const codeEl = pre.querySelector('code');
      if (!codeEl) return;
      const copyBtn = pre.querySelector('.code-copy');
      const code = copyBtn?.getAttribute('data-code') || codeEl.innerText;

      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(code).then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = 'Copy';
              copyBtn.classList.remove('copied');
            }, 2000);
          }).catch(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          });
        });
      }

      // Add "▶ Playground" button if not already present
      if (!pre.querySelector('.code-playground-btn')) {
        const playBtn = document.createElement('button');
        playBtn.className = 'code-playground-btn';
        playBtn.textContent = '▶ Playground';
        playBtn.title = 'Open and test snippet in offline Playground';
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCodeInPlayground(code, 'custom');
        });
        pre.appendChild(playBtn);
      }
    });

    // Render KaTeX math formulas offline
    if (window.katex) {
      articleWrap.querySelectorAll('.math-inline:not([data-math-rendered]), .math-display:not([data-math-rendered])').forEach(node => {
        const isDisplay = node.classList.contains('math-display');
        const tex = node.getAttribute('data-tex') || node.textContent;
        try {
          node.innerHTML = window.katex.renderToString(tex, {
            displayMode: isDisplay,
            throwOnError: false,
            strict: 'ignore'
          });
          node.setAttribute('data-math-rendered', 'true');
        } catch (err) {
          console.warn('Client KaTeX render error:', err);
        }
      });
    }

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

    // Wire up Chapter Completion Button
    const markCompleteBtn = document.getElementById('markCompleteBtn');
    if (markCompleteBtn) {
      markCompleteBtn.addEventListener('click', () => {
        let nowCompleted = false;
        if (sqliteDb) {
          nowCompleted = sqliteDb.toggleChapterCompletion(lesson.id, lesson.phaseId, lesson.title);
        } else {
          nowCompleted = !completedLessons.has(lesson.id);
        }

        if (nowCompleted) {
          completedLessons.add(lesson.id);
        } else {
          completedLessons.delete(lesson.id);
        }
        localStorage.setItem('completed_lessons', JSON.stringify(Array.from(completedLessons)));

        const compRec = sqliteDb ? sqliteDb.getChapterCompletion(lesson.id) : null;
        updateCompletionButtonUI(lesson.id, nowCompleted, compRec ? compRec.completed_at : Date.now());
        if (curriculum) renderSidebar(curriculum.phases);
        updateProgress();
      });
    }

    // Wire up In-Page SQLite Notes Textarea
    const pageNotesTextarea = document.getElementById('pageNotesTextarea');
    const pageNotesStatus = document.getElementById('pageNotesStatus');
    const pageNotesCharCount = document.getElementById('pageNotesCharCount');

    if (pageNotesTextarea) {
      pageNotesTextarea.addEventListener('input', () => {
        const text = pageNotesTextarea.value;
        if (pageNotesStatus) pageNotesStatus.textContent = 'Saving to SQLite...';
        if (pageNotesCharCount) pageNotesCharCount.textContent = text.length + ' characters';
        if (noteTextarea && noteTextarea.value !== text) noteTextarea.value = text;
        if (noteSaveStatus) noteSaveStatus.textContent = 'Saving...';

        clearTimeout(noteSaveTimeout);
        noteSaveTimeout = setTimeout(() => {
          if (!currentLoadedLesson) return;
          if (sqliteDb) {
            sqliteDb.savePageNote(currentLoadedLesson.id, currentLoadedLesson.phaseId, currentLoadedLesson.title, text);
          }
          if (typeof saveNote === 'function') {
            userNotes = saveNote(userNotes, currentLoadedLesson, text);
            localStorage.setItem('user_notes', JSON.stringify(userNotes));
          }
          const savedLabel = text.trim() ? 'Saved to SQLite Database (page_notes)' : 'Ready';
          if (pageNotesStatus) pageNotesStatus.textContent = savedLabel;
          if (noteSaveStatus) noteSaveStatus.textContent = text.trim() ? 'Saved to SQLite' : '';
          updateLessonUserTools(currentLoadedLesson);
          updateProgress();
        }, 350);
      });
    }
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

  function openAboutModal() {
    if (aboutModal) aboutModal.classList.add('open');
  }
  function closeAboutModal() {
    if (aboutModal) aboutModal.classList.remove('open');
  }
  if (aboutBtn) aboutBtn.addEventListener('click', openAboutModal);
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
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

      if (typeof lessonId !== 'undefined') {
        quizScores[lessonId] = {
          score: grading.score,
          total: grading.total,
          percentage: grading.percentage,
          passed: grading.passed,
          takenAt: Date.now(),
        };
        localStorage.setItem('quiz_scores', JSON.stringify(quizScores));
      }

      if (grading.passed) {
        completedLessons.add(lessonId);
        if (sqliteDb) {
          sqliteDb.markChapterComplete(lessonId, currentLoadedLesson ? currentLoadedLesson.phaseId : '', currentLoadedLesson ? currentLoadedLesson.title : lessonId);
        }
        localStorage.setItem('completed_lessons', JSON.stringify(Array.from(completedLessons)));
        updateCompletionButtonUI(lessonId, true, Date.now());
        if (curriculum) renderSidebar(curriculum.phases);
        updateProgress();
      }

      submitBtn.textContent = 'Retake Quiz';
    });
  }

  // -------------------------------------------------------------
  // Code Playground Engine & Event Handlers
  // -------------------------------------------------------------
  function openCodeInPlayground(code, presetId = 'custom') {
    if (playgroundCode) {
      playgroundCode.value = code;
    }
    if (snippetSelect) {
      snippetSelect.value = presetId;
    }
    if (playgroundEditorTitle) {
      playgroundEditorTitle.textContent = presetId === 'custom' ? 'SCRIPT EDITOR (CUSTOM SNIPPET)' : ('SCRIPT EDITOR (' + presetId.toUpperCase() + ')');
    }
    if (playgroundOutput) {
      playgroundOutput.innerHTML = '<div class="log-line log-empty">Click "▶ Run Code" or press Ctrl+Enter to execute.</div>';
    }
    if (terminalStatusBadge) {
      terminalStatusBadge.textContent = 'READY';
      terminalStatusBadge.className = 'terminal-badge';
    }
    switchView('playground');
  }

  function initPlayground() {
    if (!playgroundCode || !snippetSelect) return;

    // Populate preset dropdown
    if (typeof CURRICULUM_PRESETS !== 'undefined' && Array.isArray(CURRICULUM_PRESETS)) {
      snippetSelect.innerHTML = '<option value="custom">Scratchpad (Custom)</option>';
      CURRICULUM_PRESETS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.title;
        snippetSelect.appendChild(opt);
      });
    }

    // Load initial code (first preset or saved scratchpad)
    const initialPreset = (typeof CURRICULUM_PRESETS !== 'undefined' && CURRICULUM_PRESETS[0]) || null;
    if (initialPreset) {
      const saved = typeof loadScratchpad === 'function' ? loadScratchpad(initialPreset.id) : null;
      playgroundCode.value = saved || initialPreset.code;
      snippetSelect.value = initialPreset.id;
      if (playgroundEditorTitle) {
        playgroundEditorTitle.textContent = 'SCRIPT EDITOR (' + initialPreset.id.toUpperCase() + ')';
      }
    } else {
      const savedCustom = typeof loadScratchpad === 'function' ? loadScratchpad('custom') : null;
      playgroundCode.value = savedCustom || '// Welcome to the Offline Code Playground\\nconsole.log("Hello AI Engineering from Scratch!");\\n';
    }

    // Handle snippet change
    snippetSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId === 'custom') {
        const savedCustom = typeof loadScratchpad === 'function' ? loadScratchpad('custom') : null;
        playgroundCode.value = savedCustom || '// Custom scratchpad\\nconsole.log("Custom code here");\\n';
        if (playgroundEditorTitle) playgroundEditorTitle.textContent = 'SCRIPT EDITOR (CUSTOM)';
      } else if (typeof CURRICULUM_PRESETS !== 'undefined') {
        const preset = CURRICULUM_PRESETS.find(p => p.id === selectedId);
        if (preset) {
          const saved = typeof loadScratchpad === 'function' ? loadScratchpad(preset.id) : null;
          playgroundCode.value = saved || preset.code;
          if (playgroundEditorTitle) playgroundEditorTitle.textContent = 'SCRIPT EDITOR (' + preset.id.toUpperCase() + ')';
        }
      }
      if (playgroundOutput) {
        playgroundOutput.innerHTML = '<div class="log-line log-empty">Click "▶ Run Code" or press Ctrl+Enter to execute.</div>';
      }
      if (terminalStatusBadge) {
        terminalStatusBadge.textContent = 'IDLE';
        terminalStatusBadge.className = 'terminal-badge';
      }
    });

    // Run Code
    function runPlaygroundCode() {
      if (!playgroundCode) return;
      const code = playgroundCode.value;
      if (terminalStatusBadge) {
        terminalStatusBadge.textContent = 'RUNNING...';
        terminalStatusBadge.className = 'terminal-badge';
      }
      const result = typeof executeSandboxCode === 'function'
        ? executeSandboxCode(code, 'javascript')
        : { logs: [{ type: 'log', text: 'Evaluation runner not ready.' }], error: null, durationMs: 0 };

      if (playgroundOutput) {
        if (typeof formatTerminalHtml === 'function') {
          playgroundOutput.innerHTML = formatTerminalHtml(result.logs, result.error, result.durationMs);
        } else {
          playgroundOutput.innerText = result.logs.map(l => l.text).join('\\n');
        }
      }
      if (terminalStatusBadge) {
        terminalStatusBadge.textContent = result.error ? 'ERROR' : 'SUCCESS';
        terminalStatusBadge.className = 'terminal-badge ' + (result.error ? 'error' : 'success');
      }
    }

    if (runCodeBtn) {
      runCodeBtn.addEventListener('click', runPlaygroundCode);
    }

    // Keyboard shortcut (Ctrl+Enter or Cmd+Enter)
    playgroundCode.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runPlaygroundCode();
      }
      // Tab key support
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = playgroundCode.selectionStart;
        const end = playgroundCode.selectionEnd;
        playgroundCode.value = playgroundCode.value.substring(0, start) + '  ' + playgroundCode.value.substring(end);
        playgroundCode.selectionStart = playgroundCode.selectionEnd = start + 2;
      }
    });

    // Reset code
    if (resetCodeBtn) {
      resetCodeBtn.addEventListener('click', () => {
        const curId = snippetSelect ? snippetSelect.value : 'custom';
        if (curId !== 'custom' && typeof CURRICULUM_PRESETS !== 'undefined') {
          const preset = CURRICULUM_PRESETS.find(p => p.id === curId);
          if (preset) {
            playgroundCode.value = preset.code;
            if (typeof saveScratchpad === 'function') saveScratchpad(preset.code, preset.id);
            if (playgroundSaveStatus) playgroundSaveStatus.textContent = 'Reset to preset default';
            setTimeout(() => { if (playgroundSaveStatus) playgroundSaveStatus.textContent = 'Saved locally'; }, 1500);
          }
        } else {
          playgroundCode.value = '// Custom scratchpad\\nconsole.log("Ready to code");\\n';
          if (typeof saveScratchpad === 'function') saveScratchpad(playgroundCode.value, 'custom');
        }
      });
    }

    // Copy code
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        if (!playgroundCode) return;
        navigator.clipboard.writeText(playgroundCode.value).then(() => {
          copyCodeBtn.textContent = 'Copied!';
          setTimeout(() => { copyCodeBtn.textContent = '📋 Copy'; }, 2000);
        }).catch(() => {
          copyCodeBtn.textContent = 'Copied!';
          setTimeout(() => { copyCodeBtn.textContent = '📋 Copy'; }, 2000);
        });
      });
    }

    // Clear Output
    if (clearOutputBtn) {
      clearOutputBtn.addEventListener('click', () => {
        if (playgroundOutput) {
          playgroundOutput.innerHTML = '<div class="log-line log-empty">Console output cleared.</div>';
        }
        if (terminalStatusBadge) {
          terminalStatusBadge.textContent = 'CLEARED';
          terminalStatusBadge.className = 'terminal-badge';
        }
      });
    }

    // Debounced auto-save
    let autoSaveTimer = null;
    playgroundCode.addEventListener('input', () => {
      if (playgroundSaveStatus) playgroundSaveStatus.textContent = 'Typing...';
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        const curId = snippetSelect ? snippetSelect.value : 'custom';
        if (typeof saveScratchpad === 'function') {
          saveScratchpad(playgroundCode.value, curId);
        }
        if (playgroundSaveStatus) playgroundSaveStatus.textContent = 'Saved locally';
      }, 500);
    });
  }

  function initPythonPlayground() {
    if (!pythonCode || !pythonSnippetSelect) return;

    let pythonWorker = null;
    let isPythonWorkerInitializing = false;
    let isPythonWorkerReady = false;
    let isPythonRunning = false;

    function getOrCreatePythonWorker() {
      if (pythonWorker && (isPythonWorkerReady || isPythonWorkerInitializing)) {
        return pythonWorker;
      }
      isPythonWorkerInitializing = true;

      if (pythonTerminalBadge) {
        pythonTerminalBadge.textContent = 'INITIALIZING...';
        pythonTerminalBadge.className = 'terminal-badge';
      }
      if (pythonOutput) {
        pythonOutput.innerHTML = '<div class="log-line log-info">⏳ Initializing offline Python 3.12 (NumPy, SciPy & Scikit-Learn)...</div>';
      }

      try {
        pythonWorker = new Worker('python-worker.js');
        pythonWorker.addEventListener('message', (event) => {
          const msg = event.data;
          if (!msg) return;

          if (msg.type === 'status') {
            if (pythonTerminalBadge) pythonTerminalBadge.textContent = 'LOADING...';
            if (pythonOutput) {
              pythonOutput.innerHTML += '<div class="log-line log-info">' + msg.message + '</div>';
            }
          } else if (msg.type === 'ready') {
            isPythonWorkerReady = true;
            isPythonWorkerInitializing = false;
            if (pythonTerminalBadge) {
              pythonTerminalBadge.textContent = 'READY';
              pythonTerminalBadge.className = 'terminal-badge success';
            }
            if (pythonOutput) {
              pythonOutput.innerHTML += '<div class="log-line log-info">✔ Python environment ready. Click \\"▶ Run Python\\" to execute.</div>';
            }
          } else if (msg.type === 'init_error') {
            isPythonWorkerReady = false;
            isPythonWorkerInitializing = false;
            if (pythonTerminalBadge) {
              pythonTerminalBadge.textContent = 'LOAD ERROR';
              pythonTerminalBadge.className = 'terminal-badge error';
            }
            if (pythonOutput) {
              pythonOutput.innerHTML += '<div class="log-line log-err">❌ Failed to initialize Python: ' + msg.error + '</div>';
            }
          } else if (msg.type === 'result') {
            isPythonRunning = false;
            if (runPythonBtn) runPythonBtn.disabled = false;
            if (pythonTerminalBadge) {
              pythonTerminalBadge.textContent = msg.error ? 'ERROR' : 'SUCCESS';
              pythonTerminalBadge.className = 'terminal-badge ' + (msg.error ? 'error' : 'success');
            }
            if (pythonOutput) {
              if (typeof formatPythonTerminalHtml === 'function') {
                pythonOutput.innerHTML = formatPythonTerminalHtml(msg.logs, msg.error, msg.durationMs);
              } else {
                pythonOutput.innerText = msg.logs.map(l => l.text).join('\\n');
              }
            }
          }
        });

        pythonWorker.postMessage({ type: 'init' });
      } catch (err) {
        isPythonWorkerInitializing = false;
        if (pythonOutput) {
          pythonOutput.innerHTML = '<div class="log-line log-err">Error creating Web Worker: ' + (err.message || String(err)) + '</div>';
        }
      }
      return pythonWorker;
    }

    // Populate preset dropdown from PYTHON_ML_PRESETS
    if (typeof PYTHON_ML_PRESETS !== 'undefined' && Array.isArray(PYTHON_ML_PRESETS)) {
      pythonSnippetSelect.innerHTML = '<option value="custom">Scratchpad (Custom)</option>';
      PYTHON_ML_PRESETS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.title;
        pythonSnippetSelect.appendChild(opt);
      });
    }

    // Load initial code (first preset or saved scratchpad)
    const initialPreset = (typeof PYTHON_ML_PRESETS !== 'undefined' && PYTHON_ML_PRESETS[0]) || null;
    if (initialPreset) {
      const saved = typeof loadPythonScratchpad === 'function' ? loadPythonScratchpad(initialPreset.id) : null;
      pythonCode.value = saved || initialPreset.code;
      pythonSnippetSelect.value = initialPreset.id;
      if (pythonEditorTitle) {
        pythonEditorTitle.textContent = 'PYTHON SCRIPT EDITOR (' + initialPreset.id.toUpperCase() + ')';
      }
    } else {
      const savedCustom = typeof loadPythonScratchpad === 'function' ? loadPythonScratchpad('custom') : null;
      pythonCode.value = savedCustom || '# Welcome to the Offline Python ML Playground\\nimport numpy as np\\nprint("Hello AI Engineering from Scratch!")\\n';
    }

    // Handle snippet change
    pythonSnippetSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId === 'custom') {
        const savedCustom = typeof loadPythonScratchpad === 'function' ? loadPythonScratchpad('custom') : null;
        pythonCode.value = savedCustom || '# Custom Python scratchpad\\nimport numpy as np\\nfrom sklearn.linear_model import LinearRegression\\nprint("Ready to code in Python")\\n';
        if (pythonEditorTitle) pythonEditorTitle.textContent = 'PYTHON SCRIPT EDITOR (CUSTOM)';
      } else if (typeof PYTHON_ML_PRESETS !== 'undefined') {
        const preset = PYTHON_ML_PRESETS.find(p => p.id === selectedId);
        if (preset) {
          const saved = typeof loadPythonScratchpad === 'function' ? loadPythonScratchpad(preset.id) : null;
          pythonCode.value = saved || preset.code;
          if (pythonEditorTitle) pythonEditorTitle.textContent = 'PYTHON SCRIPT EDITOR (' + preset.id.toUpperCase() + ')';
        }
      }
      if (pythonOutput) {
        pythonOutput.innerHTML = '<div class="log-line log-empty">Click "▶ Run Python" or press Ctrl+Enter to execute.</div>';
      }
      if (pythonTerminalBadge) {
        pythonTerminalBadge.textContent = isPythonWorkerReady ? 'READY' : 'PYTHON 3.12';
        pythonTerminalBadge.className = 'terminal-badge';
      }
    });

    // Run Python Code
    function runPythonScript() {
      if (!pythonCode || isPythonRunning) return;
      const code = pythonCode.value;
      isPythonRunning = true;
      if (runPythonBtn) runPythonBtn.disabled = true;
      if (pythonTerminalBadge) {
        pythonTerminalBadge.textContent = 'RUNNING...';
        pythonTerminalBadge.className = 'terminal-badge';
      }
      if (pythonOutput) {
        pythonOutput.innerHTML = '<div class="log-line log-info">⏳ Executing Python ML code...</div>';
      }

      const worker = getOrCreatePythonWorker();
      if (worker) {
        worker.postMessage({
          type: 'run',
          code,
          id: pythonSnippetSelect ? pythonSnippetSelect.value : 'custom'
        });
      } else {
        isPythonRunning = false;
        if (runPythonBtn) runPythonBtn.disabled = false;
        if (pythonOutput) {
          pythonOutput.innerHTML = '<div class="log-line log-err">Python execution worker unavailable.</div>';
        }
      }
    }

    if (runPythonBtn) {
      runPythonBtn.addEventListener('click', runPythonScript);
    }

    // Keyboard shortcut (Ctrl+Enter or Cmd+Enter) & 4-space Tab indent
    pythonCode.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runPythonScript();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = pythonCode.selectionStart;
        const end = pythonCode.selectionEnd;
        pythonCode.value = pythonCode.value.substring(0, start) + '    ' + pythonCode.value.substring(end);
        pythonCode.selectionStart = pythonCode.selectionEnd = start + 4;
      }
    });

    // Reset button
    if (resetPythonBtn) {
      resetPythonBtn.addEventListener('click', () => {
        const curId = pythonSnippetSelect ? pythonSnippetSelect.value : 'custom';
        if (curId !== 'custom' && typeof PYTHON_ML_PRESETS !== 'undefined') {
          const preset = PYTHON_ML_PRESETS.find(p => p.id === curId);
          if (preset) {
            pythonCode.value = preset.code;
            if (typeof savePythonScratchpad === 'function') savePythonScratchpad(preset.code, preset.id);
            if (pythonSaveStatus) pythonSaveStatus.textContent = 'Reset to preset default';
            setTimeout(() => { if (pythonSaveStatus) pythonSaveStatus.textContent = 'Saved locally'; }, 1500);
          }
        } else {
          pythonCode.value = '# Custom Python scratchpad\\nimport numpy as np\\nprint("Ready to code");\\n';
          if (typeof savePythonScratchpad === 'function') savePythonScratchpad(pythonCode.value, 'custom');
        }
      });
    }

    // Copy button
    if (copyPythonBtn) {
      copyPythonBtn.addEventListener('click', () => {
        if (!pythonCode) return;
        navigator.clipboard.writeText(pythonCode.value).then(() => {
          copyPythonBtn.textContent = 'Copied!';
          setTimeout(() => { copyPythonBtn.textContent = '📋 Copy'; }, 2000);
        }).catch(() => {
          copyPythonBtn.textContent = 'Copied!';
          setTimeout(() => { copyPythonBtn.textContent = '📋 Copy'; }, 2000);
        });
      });
    }

    // Clear Output button
    if (clearPythonOutputBtn) {
      clearPythonOutputBtn.addEventListener('click', () => {
        if (pythonOutput) {
          pythonOutput.innerHTML = '<div class="log-line log-empty">Python console output cleared.</div>';
        }
        if (pythonTerminalBadge) {
          pythonTerminalBadge.textContent = 'CLEARED';
          pythonTerminalBadge.className = 'terminal-badge';
        }
      });
    }

    // Debounced auto-save
    let autoSavePyTimer = null;
    pythonCode.addEventListener('input', () => {
      if (pythonSaveStatus) pythonSaveStatus.textContent = 'Typing...';
      clearTimeout(autoSavePyTimer);
      autoSavePyTimer = setTimeout(() => {
        const curId = pythonSnippetSelect ? pythonSnippetSelect.value : 'custom';
        if (typeof savePythonScratchpad === 'function') {
          savePythonScratchpad(pythonCode.value, curId);
        }
        if (pythonSaveStatus) pythonSaveStatus.textContent = 'Saved locally';
      }, 500);
    });

    // Expose worker initialization on view switch
    window.__initPythonWorker = getOrCreatePythonWorker;
  }

  initPlayground();
  initPythonPlayground();
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
  await bundleKaTeX();
  await bundlePyodide();
  copyStaticAssets();

  console.log('📚 Building 6 Curriculum Book Volumes (EPUB & HTML)...');
  execSync('python3 scripts/build_offline_books.py', { cwd: REPO_ROOT, stdio: 'inherit' });

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

module.exports = { main, extractMetadata, buildCurriculum, bundleKaTeX, renderMathInHtml };

