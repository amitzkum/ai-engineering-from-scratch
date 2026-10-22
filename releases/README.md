# AI Engineering from Scratch — Android Releases Archive

This directory contains the official signed Android APK releases for the **AI Engineering from Scratch (Offline Tablet & Mobile Edition)**.

---

## 🏛️ Permanent Archival & Versioning Policy

1. **Storage Optimization**: To keep repository clone size practical while maintaining reproducible builds, only the latest official production APK release (`v1.5.4` / `ai-engineering-latest.apk`) is bundled directly in Git. Historical metadata, SHA-256 checksums, and release notes are permanently preserved in `releases/v<version>/`.
2. **Latest Release Pointer**: `releases/ai-engineering-latest.apk` always mirrors the latest official release for sharing.
3. **Version Increment Cadence**: In accordance with project instructions, future releases follow **minor version updates** (v1.1.0, v1.2.0, v1.3.0, ...) unless explicitly specified by Amit Kumar.

---

## 🎖️ Attribution & Origin

- **App Creator & Architect:** **Amit Kumar** (Offline Android Architecture, UI/UX, Local Bundling, and Packaging)
- **Curriculum & Pedagogical Source:** **AI Engineering from Scratch Contributors** (Lessons, Math Implementations, Quizzes, and Tests)
- **Repository:** [github.com/ai-engineering-from-scratch](https://github.com/ai-engineering-from-scratch)

---

## 📂 Release Index

| Version | Release Date | APK File | SHA-256 Checksum | Release Notes |
|:-------:|:------------:|:--------:|:----------------:|:-------------:|
| **v1.5.4** | 2026-10-18 | [`ai-engineering-v1.5.4.apk`](v1.5.4/ai-engineering-v1.5.4.apk) | `1a20d9f1a5cdf0bcc910166c05ccbc55ed726fcbb1f1c1b7df1fb8c2ac66df4e` | [Notes](v1.5.4/RELEASE_NOTES.md) |
| **v1.5.3** | 2026-10-18 | *Archived (pruned)* | `f4100d83a055e373702c7ac6fb130c6103460f5748ad0389760f9eea8a1848a7` | [Notes](v1.5.3/RELEASE_NOTES.md) |
| **v1.5.2** | 2026-10-18 | *Archived (pruned)* | `4b879f3acda2a901299c04cb31a9efc6b429d09ccfcc7f055e4e803a44c3f34c` | [Notes](v1.5.2/RELEASE_NOTES.md) |
| **v1.5.1** | 2026-10-18 | *Archived (pruned)* | `02928f5727dcbeb80a918f6667cebd0491a977a516508813a711a06806fcd9ce` | [Notes](v1.5.1/RELEASE_NOTES.md) |
| **v1.5.0** | 2026-10-18 | *Archived (pruned)* | `c01d1e182d004b90c0c41fd642a114d2b105a7476ca89e9f04e339a9c43600d5` | [Notes](v1.5.0/RELEASE_NOTES.md) |
| **v1.4.0** | 2026-10-18 | *Archived (pruned)* | `dd5e972f60430946aa3cec76699e05a77f1baf4bea43c2bd4a932552e0612065` | [Notes](v1.4.0/RELEASE_NOTES.md) |
| **v1.3.0** | 2026-10-15 | *Archived (pruned)* | `779b9646cfd4c172cbdc28baa1739193916c5923984c4578c44d4b60a921ee10` | [Notes](v1.3.0/RELEASE_NOTES.md) |
| **v1.2.0** | 2026-10-15 | *Archived (pruned)* | `dbaff6b0dd28757c87b29984f20fb9ab0a7a9fd5a1ac859dcf1a7e984942bf43` | [Notes](v1.2.0/RELEASE_NOTES.md) |
| **v1.1.0** | 2026-10-15 | *Archived (pruned)* | `021bb1ff0172009f0e2af38b1f2822663422bf18208f740e48713dc8ede15fbc` | [Notes](v1.1.0/RELEASE_NOTES.md) |
| **v1.0.0** | 2026-10-15 | *Archived (pruned)* | `e9ec2c8a5b3cdedb2ef3b1b206ed51b9e55d81831192585662f95e8e8598c1e3` | [Notes](v1.0.0/RELEASE_NOTES.md) |

---

## 🚀 Recent Milestones & Release Highlights

### [v1.5.4](v1.5.4/RELEASE_NOTES.md) — High-Fidelity Book Rendering, Tables, Math & Mobile Containment
- **Canonical Markdown Table Pipeline:** Migrated chapter compilation to `site/lesson-markdown.js`, generating clean HTML `<table>` elements wrapped in responsive `<div class="table-wrap">`.
- **Pre-rendered KaTeX Math in Readers & PDFs:** Pre-rendered LaTeX formulas into static HTML spans so equations render cleanly in offline readers, EPUBs, and LibreOffice PDFs without runtime script dependencies.
- **Zero Horizontal Scrolling:** Added responsive `.reader-toolbar` wrapping and viewport containment (`overflow-x: hidden`) on mobile screens.

### [v1.5.3](v1.5.3/RELEASE_NOTES.md) — Native Local Book Downloads & Compact Selector
- **Native Android Downloader Bridge:** Implemented `@JavascriptInterface AndroidDownloader.downloadBlob` in `MainActivity.java` streaming EPUBs and PDFs directly to Android's `MediaStore.Downloads` or `DIRECTORY_DOWNLOADS` with native system Toasts.
- **Offline Book Downloads:** Updated all 6 volume cards in the Books tab to download local EPUB and PDF copies with zero network calls.
- **Compact Preset Selector:** Reduced playground dropdown height to 34px with an infinite looping horizontal marquee animation (`@keyframes selectMarqueeScroll`).

### [v1.5.2](v1.5.2/RELEASE_NOTES.md) — Touch-Scrollable Navigation & Equation Overflow Containment
- **Horizontal Header View Switcher:** Added touch-scrollable navigation (`touch-action: pan-x`) across all 5 app views (`Lessons`, `Study`, `Books`, `JS Playground`, `Python Playground`) on small mobile viewports.
- **Math Formula Touch Scrolling:** Added horizontal scroll containment (`overflow-x: auto`) and responsive font clamping to `.math-display` containers.

### [v1.5.1](v1.5.1/RELEASE_NOTES.md) — KaTeX Multi-Line Math & Mobile Completion Card Reflow
- **KaTeX Delimiter & Font Preloading:** Resolved rendering issues with multi-line LaTeX formulas, double vertical bar norms (`||`), and font glyph resolution.
- **Mobile Completion Button Reflow:** Replaced horizontal overflow on `#markCompleteBtn` with full-width vertical column wrapping on phones.

### [v1.5.0](v1.5.0/RELEASE_NOTES.md) — Safe-Area Viewport Insets & Offline Python ML Playground
- **System Bar Inset Support:** Integrated `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to eliminate UI overlap with battery, clock, status bar icons, and gesture bars on Android phones.
- **Offline Python 3.12 Runtime:** Bundled WebAssembly Pyodide engine running in a dedicated Web Worker (`python-worker.js`).
- **Pre-bundled Scientific Stack:** Bundled offline WebAssembly wheels for NumPy, SciPy, and Scikit-Learn with zero network dependencies.
- **Andrew Ng Machine Learning Presets:** Bundled 11 foundational ML models with dual raw math (`numpy`) and production (`scikit-learn`) implementations and configurable training rounds.
- **Strict Sandbox Security:** Disabled `pip` and `micropip` installations to enforce 100% offline security.

### [v1.4.0](v1.4.0/RELEASE_NOTES.md) — Offline KaTeX Math Formula Rendering Across All Lessons
- **542 Lessons Pre-rendered:** Scanned all 542 lessons and pre-rendered inline (`$...$`) and display (`$$...$$`) LaTeX formulas with KaTeX 0.16.47.
- **Local Font Packaging:** Bundled all KaTeX WOFF2 fonts into APK assets.
- **Math Regression Gate:** Added `test_math_rendering.js` validating zero unrendered math delimiters outside code blocks.

---

## 📲 Quick Install

To install the latest release on your Android device:
```bash
adb install -r releases/ai-engineering-latest.apk
```

---

## 🛠️ Rebuilding & Cutting New Releases

For step-by-step instructions on merging upstream commits and releasing new versions, see [RELEASE_NEW_BUILD.md](../RELEASE_NEW_BUILD.md).

