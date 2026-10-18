# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.4.0 (Build 5)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.4.0.apk`  
**SHA-256 Checksum:** `dd5e972f60430946aa3cec76699e05a77f1baf4bea43c2bd4a932552e0612065`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🌟 What's New in v1.4.0 (Offline KaTeX Mathematical Formula Pre-rendering & Typography)

### 1. 100% Pre-rendered Math Formulas Across All 542 Lessons
- Scanned all 542 lessons across 20 curriculum phases and pre-rendered every mathematical formula with KaTeX into standalone MathML and HTML markup.
- All 3,419 formulas (3,006 inline formulas and 413 display formulas) are now pre-compiled at build time, completely resolving the issue where formulas previously rendered as raw monospace code.
- Original LaTeX/TeX source is preserved cleanly in \`data-tex\` attributes alongside \`data-math-rendered="true"\`.

### 2. Zero-Network Bundled KaTeX Assets & Local WOFF2 Fonts
- Packaged KaTeX JavaScript (\`katex.min.js\`), stylesheets (\`katex.min.css\`), and all 20 KaTeX \`.woff2\` font files directly into local app assets (\`file:///android_asset\`).
- Stripped all external CDN imports to guarantee strict zero-network operation and full compliance with Gate 4.
- Mathematical typography adapts dynamically across all 4 themes (Dark Mode, AMOLED Pitch Black, Clean Light, and Sepia).

### 3. Standalone Book Volume Reader Math Support
- Updated the pre-compiled offline book generator (\`scripts/build_offline_books.py\`) to parse display math (\`$$\`) and inline math (\`$...$\`) across all 6 curriculum volumes.
- Included KaTeX CSS and runtime initializers in the standalone volume HTML readers.

### 4. Client-Side Dynamic Rendering Fallback & Automated Test Suite
- Wired runtime KaTeX hooks in \`app.js\` (\`#articleWrap\`) to automatically render any dynamically injected or loaded math elements.
- Added a dedicated test suite (\`offline-app/test_math_rendering.js\`) with 6 automated tests scanning the entire curriculum text to verify zero unrendered math formulas remain.

---

## 🎖️ Attribution & Origin

### App Creation, Offline Architecture & Packaging
- **App Creator & Architect:** **Amit Kumar**
- Engineered as a standalone, 100% offline-first Android learning platform with dual-pane layout, client-side search engine, diagram zoom/pan viewer, interactive quizzes, 6-volume offline book library, and interactive code playground.

### Curriculum & Pedagogical Source
- **Curriculum Source:** **AI Engineering from Scratch Contributors**
- All 542 lessons across 20 phases, original algorithm implementations, tests, and deep-dive pedagogical materials are authored by repository contributors: [github.com/ai-engineering-from-scratch](https://github.com/ai-engineering-from-scratch).

---

## 📦 Verification & Installation

### Checksum Verification
```bash
sha256sum -c ai-engineering-v1.4.0.apk.sha256
# Expected output:
# ai-engineering-v1.4.0.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.4.0.apk
```
