# AI Engineering from Scratch — Offline Android Edition

> **100% Zero-Network Offline Learning Platform for Android Tablets & Phones**  
> **Package Identifier:** `com.aiengineering.offline`  
> **App Creator & Architect:** **Amit Kumar**  
> **Curriculum Source:** **AI Engineering from Scratch Contributors**  

---

## 📱 Overview

The **Offline Android Edition** packages the entire 542-lesson AI Engineering curriculum into a standalone, production-signed Android APK (`releases/ai-engineering-latest.apk`) that runs completely without an internet connection.

Every lesson explainer, quiz question, code snippet, mathematical formula, architectural diagram, and book volume is bundled locally into Android application assets (`file:///android_asset/public`).

---

## 🏛️ Core Architectural Subsystems

### 1. Adaptive Tablet & Phone Layout
- **Dual-Pane Tablet Workspace:** Split-view navigation sidebar and expansive reading canvas on tablet viewports ($\ge 768\text{px}$).
- **Mobile Drawer Navigation:** Collapsible off-canvas navigation drawer with smooth backdrop transitions for phone screens.
- **Safe-Area Inset Support:** Uses CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with `--safe-area-inset-*` fallbacks to eliminate UI overlap with battery, clock, status bar icons, and gesture bars.
- **Strict Viewport Containment:** Viewport elements, headers, and code containers enforce `overflow-x: hidden;` and touch scrolling to prevent mobile screen horizontal stretching.

### 2. High-Fidelity Math Typography (KaTeX)
- **Zero-Network Formula Pre-rendering:** Scans all 542 lessons at build time and converts LaTeX formulas into static HTML spans (`<div class="math-display">` and `<span class="math-inline">`) using KaTeX 0.16.47.
- **Offline Font Packaging:** Bundles all KaTeX WOFF2 fonts (`KaTeX_Main`, `KaTeX_Math`, `KaTeX_AMS`, etc.) locally into APK assets.
- **Scroll Containment:** Math display containers feature horizontal touch scrolling (`touch-action: pan-x`) and font scaling to fit wide equations smoothly on phones.

### 3. Offline Python 3.12 & Machine Learning Playground
- **Web Worker WebAssembly Architecture:** Pyodide 0.26 WebAssembly runs in a dedicated background worker (`python-worker.js`) ensuring zero UI freezing during execution.
- **Pre-bundled Scientific Stack:** Bundles official WebAssembly wheels for `numpy`, `scipy`, and `scikit-learn` in `dist/pyodide/`.
- **Andrew Ng Machine Learning Presets:** 11 foundational machine learning algorithms implemented with dual raw-math (`numpy`) and production (`scikit-learn`) code:
  1. Univariate Linear Regression (Gradient Descent)
  2. Multiple Linear Regression & Normal Equation
  3. Logistic Regression & Binary Cross-Entropy
  4. Neural Network (2-Layer MLP Forward/Backprop)
  5. Multi-Class Classification with Softmax
  6. Decision Tree Classification (Entropy & Information Gain)
  7. K-Means Clustering
  8. Principal Component Analysis (PCA with SVD)
  9. Gaussian Anomaly Detection
  10. Collaborative Filtering Recommender
  11. Content-Based Filtering Recommender
- **Configurable Training:** Configurable iteration count slider/number input and persistent scratchpad storage.
- **Compact Marquee Selector:** 34px compact preset selector with smooth infinite looping CSS marquee animation (`@keyframes selectMarqueeScroll`).
- **Enforced Security:** Strictly blocks `pip` and `micropip` installations.

### 4. Local Relational Persistence (SQLite3)
- Relational schema (`chapter_completions`, `page_notes`, `schema_meta`) managed locally via `sqlite-db.js`.
- In-article completion buttons (`#markCompleteBtn`) update completion status and sidebar checkmarks.
- Per-page notes editor (`#pageNotesTextarea`) auto-saves debounced notes with live status indicators.
- Compliant with Node.js 22+ `DatabaseSync` (`node:sqlite`).

### 5. 6-Volume Offline Book Library & Native Downloader
- Pre-compiles all 20 phases into 6 publication-ready volumes:
  - Volume I: Foundations (Phases 00–02)
  - Volume II: Deep Learning Core (Phases 03–06)
  - Volume III: Language & Transformers (Phases 07–09)
  - Volume IV: LLMs from Scratch (Phases 10–12)
  - Volume V: Agents & Swarms (Phases 13–16)
  - Volume VI: Production & Alignment (Phases 17–19)
- **High-Fidelity Tables:** All markdown tables compile to HTML `<table>` elements wrapped in touch-scrollable `<div class="table-wrap">`.
- **Pre-rendered KaTeX in PDFs:** Pre-renders math into static HTML spans so LibreOffice headless generates crisp mathematical formulas in PDFs.
- **Native Android Downloader Bridge:** `@JavascriptInterface AndroidDownloader.downloadBlob` in `MainActivity.java` saves EPUBs and PDFs directly to Android's `MediaStore.Downloads` or `DIRECTORY_DOWNLOADS` with system Toasts.

---

## 📂 Directory Layout

```
offline-app/
├── android/                 # Capacitor Android native project
│   ├── app/
│   │   ├── build.gradle     # Android application build configuration
│   │   ├── release.keystore # Production release signing certificate
│   │   └── src/main/java/   # MainActivity with AndroidDownloader bridge
├── dist/                    # Compiled offline web assets (gitignored)
│   ├── index.html           # Main application shell
│   ├── app.js               # Application coordinator and search engine
│   ├── lesson.css           # Typography and responsive styles
│   ├── sqlite-db.js         # SQLite3 relational persistence engine
│   ├── python-worker.js     # Background Pyodide execution worker
│   ├── pyodide/             # Pyodide WASM, NumPy, SciPy & Scikit-Learn
│   ├── books/               # Pre-compiled EPUB, HTML, and PDF volumes
│   └── fonts/               # Offline fonts (KaTeX, Source Serif, JetBrains Mono)
├── test_*.js                # 11 unit test suites (73+ tests)
├── package.json             # App packaging manifest
└── capacitor.config.json    # Capacitor configuration
```

---

## 🧪 Testing & Verification

Run the full quality gate test suite (73+ tests):

```bash
node --test offline-app/test_*.js
```

### Test Suites:
| Suite | Purpose |
|---|---|
| `test_offline_bundle.js` | Bundle manifest, 542 lessons, quizzes, zero network check |
| `test_responsive_shell.js` | Tablet/phone layout, safe-area insets, mobile touch containment |
| `test_search_engine.js` | 542-lesson search indexing, ranking, and sub-16ms latency |
| `test_quiz_and_viewer.js` | 6-stage quiz grading, passing scores, diagram pan/zoom |
| `test_book_library.js` | 6-volume manifest, EPUB 3 zip, HTML readers, table wrappers, KaTeX |
| `test_study_dashboard.js` | Study analytics, progress computations, bookmarks, notes CRUD |
| `test_sqlite_db.js` | Relational SQLite3 operations, SQL dump, DatabaseSync |
| `test_rebuild_tool.js` | Deterministic versioning, SDK detection, SHA-256 computation |
| `test_math_rendering.js` | KaTeX formula scanning across all 542 lessons outside code blocks |
| `test_playground.js` | JavaScript code sandbox, console output trapping, error capture |
| `test_python_playground.js` | Python 3.12 sandbox, Pyodide wheels, 11 Andrew Ng ML presets |

---

## 🚀 Building & Releasing

To compile a signed production release APK:

```bash
# One-click automated rebuild (runs tests, compiles, signs, archives):
./scripts/rebuild-app.sh
```

See [RELEASE_NEW_BUILD.md](../RELEASE_NEW_BUILD.md) and [APP_BUILD_RULES.md](../APP_BUILD_RULES.md) for full runbooks and operating procedures.
