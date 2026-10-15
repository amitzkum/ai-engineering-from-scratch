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

### Gate 3: Full Unit Test Suite (34+ Tests)
Run the entire offline test suite using Node.js stdlib runner:
```bash
node --test \
  offline-app/test_offline_bundle.js \
  offline-app/test_responsive_shell.js \
  offline-app/test_search_engine.js \
  offline-app/test_quiz_and_viewer.js \
  offline-app/test_book_library.js \
  offline-app/test_study_dashboard.js
```
**Gate Requirement:** 100% pass (0 failures, 0 skipped, 0 cancelled).

### Gate 4: Zero External Network Audit
Verify that no external CDN URLs (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `unpkg.com`) exist in `offline-app/dist/`:
```bash
grep -rn "http://" offline-app/dist/*.html offline-app/dist/*.js || true
grep -rn "https://" offline-app/dist/*.html offline-app/dist/*.js | grep -v "ai-engineering-from-scratch" || true
```

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

# 2. Run unit tests (44+ tests across 8 suites)
node --test offline-app/test_*.js

# 3. Sync web assets to Capacitor Android project
cd offline-app && npx cap sync android

# 4. Compile Signed Release APK
cd android && ./gradlew assembleRelease

# 5. Archive and verify release artifact (Example for v1.1.0)
cd /home/amihkum/dev/gitprojects/ai-engineering-from-scratch
mkdir -p releases/v1.1.0
cp offline-app/android/app/build/outputs/apk/release/app-release.apk releases/v1.1.0/ai-engineering-v1.1.0.apk
cp releases/v1.1.0/ai-engineering-v1.1.0.apk releases/ai-engineering-latest.apk
cd releases/v1.1.0
sha256sum ai-engineering-v1.1.0.apk > ai-engineering-v1.1.0.apk.sha256
sha256sum -c ai-engineering-v1.1.0.apk.sha256

# 6. Verify signature
/home/amihkum/Android/Sdk/build-tools/35.0.0/apksigner verify --verbose ai-engineering-v1.1.0.apk
```

---

## 7. Troubleshooting & Common Pitfalls

| Symptom | Cause | Solution |
|---|---|---|
| App stuck on `"LOADING CURRICULUM..."` | Uncaught syntax error in `dist/app.js` halting execution | Run `node --test offline-app/test_responsive_shell.js` which executes `vm.Script` check to locate unclosed braces or syntax issues before building APK. |
| Diagrams missing or broken | External Mermaid CDN link blocked by offline WebView | Verify `dist/mermaid.min.js` exists and is referenced via `<script src="mermaid.min.js"></script>`. |
| APK is unsigned after `assembleRelease` | Missing `signingConfigs.release` in `app/build.gradle` | Ensure `buildTypes.release` specifies `signingConfig signingConfigs.release` pointing to `release.keystore`. |
| Git complains about unstaged `.gradle` or `dist/` | Build artifacts generated outside ignore rules | Verify `.gitignore` contains `!releases/**/*.apk` while ignoring intermediate build dirs. |
| Test fails on missing DOM ID | Added interactive feature in `app.js` without corresponding markup in `index.html` | Check `requiredIds` list in `offline-app/test_responsive_shell.js`. |

---

*Last updated and ratified: October 15, 2026 (v1.0.0 Official Release).*
