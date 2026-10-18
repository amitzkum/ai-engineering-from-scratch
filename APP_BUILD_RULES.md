# Deterministic Android App Build Rules & Operating Manual

> **Scope:** Standard Operating Procedure (SOP) for all contributors and AI agents building, enhancing, or releasing the **AI Engineering from Scratch (Offline Android Tablet & Mobile Edition)**.
> **Target Branch:** `android-offline-app`  
> **Package Identifier:** `com.aiengineering.offline`  
> **App Title:** AI Engineering from Scratch  

---

## 1. Core Operating Principles

1. **100% Zero-Network Offline Architecture**  
   The application must function completely without an internet connection. Every lesson, quiz, code snippet, mathematical formula, diagram, book volume, and font must be pre-rendered and bundled into the local APK assets (`file:///android_asset`). No external CDNs, Google Analytics, remote scripts, or external API calls are allowed under any circumstances.
2. **Deterministic & Self-Healing Pipeline**  
   Every build must be reproducible from source in a single automated pass (`node scripts/build-offline-bundle.js`). No manual step in Android Studio is required to produce a valid APK.
3. **Phased Incremental Delivery**  
   Implement one cohesive phase at a time. Each phase must ship:
   - Feature implementation code.
   - Corresponding unit tests using Node.js stdlib test runner (`node --test`).
   - Verification of the installable APK.
   - Atomic Git commit adhering to conventional commit specifications.
4. **Offline Rendering Fidelity**  
   - **Code Blocks:** Must have language tagging, dark/light syntax styling, and offline clipboard copy buttons.
   - **Architecture Diagrams:** Pre-packaged Mermaid JS (`mermaid.min.js`) and SVG figure viewer with touch pan, zoom in, zoom out, and reset controls.
   - **Quizzes:** 6-question per-lesson interactive runner with instant client-side grading, detailed pedagogical explanations, and score tracking.

---

## 2. Git & Branching Protocol

1. **Dedicated Branch Isolation**  
   All Android-specific development, Capacitor configurations, and release archives live exclusively on the `android-offline-app` branch.
2. **Clean Main Switching & Ignore Rules**  
   Keep native build targets, Gradle caches, Node modules, and intermediate outputs out of the git working tree so switching to `main` is seamless:
   - `.gradle/`, `**/android/build/`, `**/android/app/build/` are ignored in `.gitignore`.
   - `offline-app/dist/` and `offline-app/node_modules/` are ignored in `.gitignore` and `.git/info/exclude`.
   - Specific release artifacts (`releases/**/*.apk`, `releases/*.apk`, `release.keystore`) are whitelisted so release versions remain permanently tracked.
   - When modifying tracked configuration in `offline-app/` (e.g. `build.gradle`, `strings.xml`), use `git add -f` if required by `.git/info/exclude`.
3. **Atomic Conventional Commits**  
   Commit messages must follow the project standard:
   - `feat(app/phase-NN): <concise slug>` for phase deliverables.
   - `fix(app/phase-NN): <concise slug>` for bug fixes.
   - `chore(release): official vX.Y.Z signed apk release with source and creator attributions` for release bundles.

---

## 3. Strict Attribution & Origin Invariants

Attribution is a hard invariant of this project and must be preserved across all builds, UI screens, and release metadata:

### A. App Creation & Packaging Attribution
- **App Creator & Architect:** **Amit Kumar**
- **Contribution:** Offline Android Architecture, pre-rendered static bundling pipeline, touch-optimized dual-pane tablet UI, mobile drawer navigation, client-side search engine, diagram zoom/pan modal, book library reader, and release packaging.
- **Mandatory Placements:**
  1. **Header Info Modal:** Triggered by the `ℹ️` button (`#aboutBtn` opening `#aboutModal`).
  2. **Sidebar Footer:** Fixed at bottom of the master navigation sidebar (`#sidebarFooter`):
     ```html
     <div class="sidebar-footer" id="sidebarFooter">
       <div class="sidebar-attribution">
         <span class="sidebar-release-tag">vX.Y.Z Release</span>
         <div class="sidebar-author">App: <strong>Amit Kumar</strong></div>
         <div class="sidebar-source">Curriculum: <strong>AI Engineering from Scratch</strong></div>
       </div>
     </div>
     ```
  3. **Study Dashboard:** Official Release & Attribution card within the Dashboard Backup & Info tab.
  4. **Native Android Metadata:**
     - `offline-app/android/app/src/main/res/values/strings.xml`:
       ```xml
       <string name="app_author">Amit Kumar</string>
       <string name="curriculum_source">AI Engineering from Scratch Contributors</string>
       ```
     - `offline-app/package.json`: `"author": "Amit Kumar"`
  5. **Release Keystore:** Signed using `release.keystore` with Subject DN:
     `CN=Amit Kumar, OU=App Development, O=Amit Kumar, L=Bangalore, ST=Karnataka, C=IN`.
  6. **Release Documentation:** Documented in `RELEASE_NOTES.md` and `releases/README.md`.

### B. Curriculum & Pedagogical Source Attribution
- **Curriculum Authors:** **AI Engineering from Scratch Contributors**
- **Contribution:** All 542 lessons, 20 phases, original raw-math algorithm implementations, pedagogical documentation, quiz questions, and tests.
- **Mandatory Reference:** Official repository link `github.com/ai-engineering-from-scratch` cited in the About modal, release notes, and documentation.

---

## 4. Release Archival & Versioning Policy

1. **Non-Destructive Permanent Archival**  
   Every generated release APK is permanently saved in a dedicated version directory:
   ```
   releases/
     v1.0.0/
       ai-engineering-v1.0.0.apk
       ai-engineering-v1.0.0.apk.sha256
       RELEASE_NOTES.md
     v1.1.0/
       ai-engineering-v1.1.0.apk
       ai-engineering-v1.1.0.apk.sha256
       RELEASE_NOTES.md
     ai-engineering-latest.apk
     README.md
   ```
   **RULE:** Existing release folders and APKs must **never be deleted, overwritten, or replaced**.
2. **Latest Release Pointer**  
   `releases/ai-engineering-latest.apk` must always mirror or symlink to the newest official release APK for convenient single-link sharing and downloading.
3. **Minor Version Cadence by Default**  
   Unless explicitly instructed otherwise by Amit Kumar, all new releases increment the **minor** version number:
   - Initial Release: `v1.0.0`
   - Next Release: `v1.1.0`
   - Subsequent Releases: `v1.2.0`, `v1.3.0`, etc.
4. **Mandatory Checksum & Verification**  
   Each release APK must be accompanied by a `.sha256` checksum file generated via:
   ```bash
   sha256sum ai-engineering-vX.Y.Z.apk > ai-engineering-vX.Y.Z.apk.sha256
   sha256sum -c ai-engineering-vX.Y.Z.apk.sha256  # Must return OK
   ```
5. **Signed Production Build**  
   All public releases must be compiled with `./gradlew assembleRelease` signed with `offline-app/android/app/release.keystore` using APK Signature Scheme v2. Unsigned or debug APKs are prohibited for release distribution.

---

## 5. Mandatory Quality Gates & Verification Checklist

To prevent regressions (such as the "Loading Curriculum..." infinite hang or broken DOM references), every build must pass the following four gates before committing or releasing:

### Gate 1: Automated JavaScript VM Syntax Check
Before running Capacitor sync, `dist/app.js` must be parsed using Node.js `node:vm` to verify zero syntax errors:
```javascript
const vm = require('node:vm');
const appJs = fs.readFileSync('offline-app/dist/app.js', 'utf8');
new vm.Script(appJs, { filename: 'app.js' }); // Must not throw
```

### Gate 2: DOM Contract Validation
`dist/index.html` must contain all required UI element IDs expected by `app.js` and sub-controllers:
- Navigation & Shell: `sidebarToggle`, `sidebar`, `drawerBackdrop`, `phaseList`, `searchInput`, `articleWrap`, `breadcrumbsBar`, `themeSelect`
- View Switching: `viewLessonsBtn`, `viewDashboardBtn`, `viewLibraryBtn`, `lessonView`, `studyDashboardView`, `libraryView`, `bookReaderView`
- Attribution & Modals: `aboutBtn`, `aboutModal`, `closeAboutBtn`, `sidebarFooter`, `figureModal`
- Study & Library: `bookmarkBtn`, `noteToggleBtn`, `lessonNotePanel`, `noteTextarea`, `dashboardMetricsGrid`, `phaseProgressGrid`, `libraryGrid`

### Gate 3: Full Unit Test Suite (73+ Tests)
Run the entire offline test suite using Node.js stdlib runner:
```bash
node --test offline-app/test_*.js
```
The suite verifies 11 specialized subsystems:
- `test_offline_bundle.js`: Pre-rendered lesson manifests, quizzes, zero network dependencies, and local font integrity.
- `test_responsive_shell.js`: Shell syntax, tablet/phone responsive classifications, safe-area insets, mobile touch containment, and author attributions.
- `test_search_engine.js`: Client-side search index across 542 lessons, category filters, and sub-16ms latency budgets.
- `test_quiz_and_viewer.js`: 6-stage quiz grading algorithms, passing thresholds, diagram zoom/pan transformations, and button hitboxes.
- `test_book_library.js`: 6-volume book manifest, EPUB 3 zip validation, standalone reader HTML, table containment (`.table-wrap`), and KaTeX pre-rendering.
- `test_study_dashboard.js`: Study metrics, progress percentages, bookmarks, note CRUD, and JSON import/export.
- `test_sqlite_db.js`: Relational SQLite3 schema, completion tracking, per-page notes auto-save, and `DatabaseSync` compliance.
- `test_rebuild_tool.js`: Version determination, SDK environment detection, and SHA-256 digest computation.
- `test_math_rendering.js`: KaTeX formula scanning across all 542 lessons, inline/block delimiters outside code blocks, table-cell math, and dynamic runtime helpers.
- `test_playground.js`: Interactive JavaScript code playground, console output capture, runtime error traps, and scratchpad persistence.
- `test_python_playground.js`: Offline Python 3.12 sandbox, Pyodide WASM asset integrity, 11 Andrew Ng ML presets (NumPy vs Scikit-Learn), configurable training rounds, and pip installation blocking.

**Gate Requirement:** 100% pass (0 failures, 0 skipped, 0 cancelled).

### Gate 4: Zero External Network Audit
Verify that no external CDN URLs (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `unpkg.com`) exist in `offline-app/dist/`:
```bash
grep -rn "http://" offline-app/dist/*.html offline-app/dist/*.js || true
grep -rn "https://" offline-app/dist/*.html offline-app/dist/*.js | grep -v "ai-engineering-from-scratch" || true
```

---

## 5.1 Local SQLite3 Persistence Architecture

Starting with Phase 9 / v1.3.0, user study progress and per-page notes are managed through a local, relational SQLite3 database layer (`sqlite-db.js`):

1. **Relational Database Schema:**
   - **`chapter_completions`**: `(lesson_id TEXT PRIMARY KEY, phase_id TEXT, title TEXT, completed_at INTEGER)`  
     Tracks explicit chapter completions from the in-article completion button (`#markCompleteBtn`) and passing quiz scores.
   - **`page_notes`**: `(lesson_id TEXT PRIMARY KEY, phase_id TEXT, title TEXT, note_text TEXT, updated_at INTEGER)`  
     Stores rich per-page notes captured directly from the in-article notes editor (`#pageNotesTextarea`) and header drawer (`#noteTextarea`).
   - **`schema_meta`**: `(key TEXT PRIMARY KEY, value TEXT)`  
     Maintains schema version and database migration metadata.

2. **Database Engine & Standards Compliance:**
   - Evaluates standard SQL queries (`CREATE TABLE`, `INSERT OR REPLACE`, `SELECT`, `DELETE`).
   - Ensures zero-network local persistence with atomic updates.
   - Tested directly against Node 22+ built-in `node:sqlite` (`DatabaseSync`) to ensure full SQLite3 syntax compliance.
   - Provides `exportSqlDump()` for standard SQL export.

3. **In-Article Completion & Notes UI Contract:**
   - Every lesson ends with a dedicated completion card containing `#markCompleteBtn` that toggles completion in SQLite and updates the sidebar checkmark (`✓`) and progress meters.
   - Every lesson ends with a per-page notes card containing `#pageNotesTextarea` that auto-saves debounced edits directly into the `page_notes` SQLite table with live status indicators.

---

## 5.2 Offline KaTeX Math Formula Typography & Pre-rendering (v1.4.0, v1.5.1)

Starting with v1.4.0, all mathematical expressions across the curriculum are pre-rendered into high-fidelity typography:

1. **Build-Time Pre-rendering:**
   - The pre-rendering engine in `scripts/build-offline-bundle.js` scans all 542 lessons and executes `katex.renderToString` at build time.
   - Converts display blocks (`$$...$$`) into `<div class="math-display">` and inline math (`$...$`) into `<span class="math-inline">`.
   - Protects code blocks (both triple-backtick and indented code) so raw code snippets containing dollar signs or variable symbols are preserved verbatim.

2. **Local KaTeX Asset & Font Bundling:**
   - Complete local KaTeX stylesheet (`katex.min.css`) and JavaScript runtime (`katex.min.js`) bundled directly into `dist/`.
   - Bundles all KaTeX WOFF2 fonts (`KaTeX_Main`, `KaTeX_Math`, `KaTeX_AMS`, `KaTeX_Caligraphic`, `KaTeX_Size1-4`, etc.) into `dist/fonts/`.
   - In v1.5.1, fixed font path resolution, glyph rendering for double vertical bars (`||` norm notation), and multi-line equation alignment.

3. **Regression Test Gate:**
   - `test_math_rendering.js` verifies that 100% of the 542 lesson markdown files have all LaTeX delimiters rendered without unparsed math symbols appearing outside code blocks.

---

## 5.3 Mobile Safe-Area Inset Architecture & Horizontal Containment (v1.5.0, v1.5.1, v1.5.2)

To deliver a flawless reading and testing experience on Android phones without system bar overlap or unwanted page scrolling:

1. **System Bar Safe-Area Insets (v1.5.0):**
   - Implemented dynamic CSS safe-area padding using `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with CSS custom variable fallbacks (`--safe-area-inset-top`, `--safe-area-inset-bottom`).
   - Prevents top header and sidebar navigation elements from overlapping the phone status bar (battery indicator, mobile signal, clock, notification icons).
   - Prevents bottom drawer navigation, bottom navigation bars, and terminal consoles from overlapping Android system gesture bars or navigation keys.

2. **Mobile Layout & Completion Card Reflow (v1.5.1):**
   - Refactored `.chapter-complete-card` under mobile media queries to `flex-direction: column; align-items: stretch;`.
   - Styled `.chapter-complete-btn` with `width: 100%; white-space: normal; justify-content: center;`, eliminating horizontal viewport overflow caused by long chapter titles.

3. **Touch-Scrollable Top View Switcher & Math Containers (v1.5.2):**
   - Header view switcher (`.view-switcher`) set to `overflow-x: auto; touch-action: pan-x; -webkit-overflow-scrolling: touch;` with `flex-shrink: 0;` tabs, ensuring all 5 modes (`Lessons`, `Study`, `Books`, `JS Playground`, `Python Playground`) are horizontally scrollable on small screens.
   - Large display equations (`.math-display`) wrapped in scroll-contained blocks (`overflow-x: auto; -webkit-overflow-scrolling: touch; font-size: clamp(0.78rem, 2.5vw, 1rem);`) so wide matrices and equations scroll smoothly without causing page jitter.

---

## 5.4 Offline Python 3.12 & Machine Learning Playground (v1.5.0, v1.5.2)

An interactive, zero-network scientific computing environment built into the offline APK:

1. **Pyodide WebAssembly Architecture:**
   - Bundles a complete WebAssembly distribution of Python 3.12 (`dist/pyodide/`).
   - Executes user scripts inside a dedicated background Web Worker (`python-worker.js`) to guarantee the main UI thread never freezes during intense computations.
   - Traps standard output and standard error, piping formatted messages back to the UI terminal.

2. **Pre-bundled ML & Scientific Stack:**
   - Pre-packages official WebAssembly wheels for `numpy`, `scipy`, and `scikit-learn` in `dist/pyodide/`.
   - Loaded locally without any internet connection.
   - **Sandbox Policy:** Strictly blocks `pip` and `micropip` installations; only the pre-bundled scientific and machine learning packages are accessible.

3. **Andrew Ng Machine Learning Presets:**
   - Ships 11 foundational machine learning algorithms covering supervised learning, unsupervised learning, and recommender systems:
     1. Linear Regression (Univariate Gradient Descent)
     2. Multiple Linear Regression & Normal Equation
     3. Logistic Regression with Sigmoid & Binary Cross-Entropy
     4. Neural Network (2-layer MLP Forward & Backpropagation)
     5. Multi-Class Classification with Softmax
     6. Decision Tree Classification (Information Gain & Entropy)
     7. K-Means Clustering with Dynamic Centroids
     8. Principal Component Analysis (PCA with SVD)
     9. Anomaly Detection (Gaussian Distribution & Probability Density)
     10. Collaborative Filtering Recommender (Matrix Factorization)
     11. Content-Based Filtering Recommender (Cosine Similarity)
   - Every preset includes **dual implementations**:
     - *Raw Math / Build It:* Implemented strictly with raw math using `numpy`.
     - *Production / Use It:* Implemented using production `scikit-learn` estimators.
   - Configurable training parameters (configurable iteration counts, learning rates, thresholds) and scratchpad persistence.

4. **Compact Marquee Selector (v1.5.2 / v1.5.3):**
   - Dropped preset button height to a clean 34px container.
   - Features an infinite looping CSS marquee animation (`@keyframes selectMarqueeScroll`) to legibly display long model titles on small phone screens without vertical stretching or horizontal page overflow.

---

## 5.5 Native Android Downloader Bridge & Local Book Export (v1.5.3)

Allows users to export and download offline curriculum books directly into their Android device's file storage:

1. **Capacitor / Android JavascriptInterface:**
   - Implemented `@JavascriptInterface AndroidDownloader.downloadBlob(base64Data, mimeType, filename)` in `MainActivity.java`.
   - On Android 10+ (API 29+), streams files into `MediaStore.Downloads` using `ContentResolver`.
   - On Android 9 and below, writes directly to `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)`.
   - Shows native Android `Toast` notifications upon download completion or error.

2. **Offline In-App Book Library:**
   - The Books tab (`#libraryView`) provides access to all 6 curriculum book volumes.
   - Action buttons on volume cards allow reading in-app, downloading the complete `.epub` copy, or downloading the complete `.pdf` copy.

---

## 5.6 High-Fidelity Book Volume Compilation Pipeline (v1.5.4)

Compiles all 542 lessons across 20 phases into publication-quality volumes:

1. **Canonical Markdown Parser Pipeline:**
   - `scripts/compile_book_chapters.js` utilizes `site/lesson-markdown.js` (`parseMd`) to compile Markdown chapters with complete GFM table support.
   - Tables are systematically wrapped in `<div class="table-wrap"><table>...</table></div>` with responsive typography and touch scrolling.

2. **Static KaTeX Math Typography for Headless LibreOffice PDFs:**
   - Headless LibreOffice operates without a JavaScript engine. To ensure mathematical equations render cleanly in exported PDFs, `compile_book_chapters.js` pre-renders LaTeX math into static HTML spans (`katex.renderToString`) at build time.
   - KaTeX CSS typography is inlined directly into the HTML sources, EPUB stylesheets, and LibreOffice conversion inputs.

3. **Mermaid Diagrams & Responsive Reader Shell:**
   - Standalone HTML readers include offline Mermaid diagram and figure rendering support.
   - Mobile reader toolbar (`.reader-toolbar`) responsive layout wraps the volume title full-width above action buttons, preventing horizontal overflow on phones.
   - Strict CSS containment (`overflow-x: hidden; box-sizing: border-box;`) guarantees zero horizontal page scrolling.

---

## 6. Environment Setup & Canonical Commands

### Required Environment Variables
Set these before running any Android build task (or let `rebuild-app.sh` detect them automatically):
```bash
export ANDROID_HOME=/home/amihkum/Android/Sdk
export JAVA_HOME=/home/amihkum/.jdk/jdk-21
export PATH=$JAVA_HOME/bin:$PATH
```

### One-Click Automated Rebuild Command (Recommended)
Run the automated release pipeline with a single command (see [RELEASE_NEW_BUILD.md](RELEASE_NEW_BUILD.md) for the complete developer runbook):
```bash
# Auto-increments minor version (e.g. v1.1.0 -> v1.2.0), runs tests, builds, signs, and archives
./scripts/rebuild-app.sh

# Or with an explicit version:
./scripts/rebuild-app.sh 1.3.0
```

> **IMPORTANT RULE: Manual Release Only — Zero In-App Update Polling**  
> The Android app must remain **100% strictly self-contained and offline**. App users are **NOT** allowed to check for updates or download patches from within the app. There are no background update checks or network calls. All releases are created and distributed manually by **Amit Kumar**.

### Complete Manual End-to-End Build Sequence (Step-by-Step)
```bash
# 1. Regenerate offline assets & 6 pre-compiled book volumes
node scripts/build-offline-bundle.js

# 2. Run unit tests (73+ tests across 11 suites)
node --test offline-app/test_*.js

# 3. Sync web assets to Capacitor Android project
cd offline-app && npx cap sync android

# 4. Compile Signed Release APK
cd android && ./gradlew assembleRelease

# 5. Archive and verify release artifact (Example for v1.5.4)
cd /home/amihkum/dev/gitprojects/ai-engineering-from-scratch
mkdir -p releases/v1.5.4
cp offline-app/android/app/build/outputs/apk/release/app-release.apk releases/v1.5.4/ai-engineering-v1.5.4.apk
cp releases/v1.5.4/ai-engineering-v1.5.4.apk releases/ai-engineering-latest.apk
cd releases/v1.5.4
sha256sum ai-engineering-v1.5.4.apk > ai-engineering-v1.5.4.apk.sha256
sha256sum -c ai-engineering-v1.5.4.apk.sha256

# 6. Verify signature
/home/amihkum/Android/Sdk/build-tools/35.0.0/apksigner verify --verbose ai-engineering-v1.5.4.apk
```

---

## 7. Troubleshooting & Common Pitfalls

| Symptom | Cause | Solution |
|---|---|---|
| App stuck on `"LOADING CURRICULUM..."` | Uncaught syntax error in `dist/app.js` halting execution | Run `node --test offline-app/test_responsive_shell.js` which executes `vm.Script` check to locate unclosed braces or syntax issues before building APK. |
| Diagrams missing or broken | External Mermaid CDN link blocked by offline WebView | Verify `dist/mermaid.min.js` exists and is referenced via `<script src="mermaid.min.js"></script>`. |
| Math formulas render as code/raw text | Unescaped or unrendered LaTeX delimiters (`$`, `$$`) | Run `node --test offline-app/test_math_rendering.js`. Pre-rendering must run during `node scripts/build-offline-bundle.js`. |
| Python Playground fails to execute | Pyodide WASM assets missing or blocked by Web Worker CORS | Ensure `dist/pyodide/` contains core WASM and wheel files (`numpy`, `scipy`, `scikit-learn`) and `python-worker.js` is served locally. |
| Horizontal scrolling on mobile screens | Uncontained long math formulas, tables, or buttons | Ensure `.math-display` and `.table-wrap` have `overflow-x: auto; max-width: 100%;` and `.chapter-complete-card` uses `flex-direction: column`. |
| PDF download missing math/tables | Headless LibreOffice cannot execute runtime JS scripts | Pre-render all math with `compile_book_chapters.js` into static HTML spans before passing HTML documents to LibreOffice. |
| APK is unsigned after `assembleRelease` | Missing `signingConfigs.release` in `app/build.gradle` | Ensure `buildTypes.release` specifies `signingConfig signingConfigs.release` pointing to `release.keystore`. |
| Git complains about unstaged `.gradle` or `dist/` | Build artifacts generated outside ignore rules | Verify `.gitignore` contains `!releases/**/*.apk` while ignoring intermediate build dirs. |
| Test fails on missing DOM ID | Added interactive feature in `app.js` without corresponding markup in `index.html` | Check `requiredIds` list in `offline-app/test_responsive_shell.js`. |

---

*Last updated and ratified: October 19, 2026 (v1.5.4 Official Release).*
