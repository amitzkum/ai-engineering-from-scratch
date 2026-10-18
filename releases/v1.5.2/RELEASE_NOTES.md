# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.5.2 (Build 8)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.5.2.apk`  
**SHA-256 Checksum:** `4b879f3acda2a901299c04cb31a9efc6b429d09ccfcc7f055e4e803a44c3f34c`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🌟 What's Fixed in v1.5.2

### 1. Math Formulas Mobile Horizontal Scroll Containment
- **Root Cause:** KaTeX display formulas (`<div class="math-display">` wrapping `<span class="katex-display">`) set `white-space: nowrap` by default on formula contents without `overflow-x: auto` or container width limits. Long equations (e.g. multivariate cost functions, matrix decompositions, attention equations) exceeded the 360px–390px mobile viewport width. In addition, `main.content-area` defaulted to flex child `min-width: auto` without `overflow-x: hidden`, causing the entire screen to scroll horizontally.
- **The Fix:**
  - Added responsive containment rules to `.math-display`, `.katex-display`, and `.math-inline` with `overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; max-width: 100%; box-sizing: border-box;`.
  - Applied `min-width: 0; max-width: 100%; overflow-x: hidden; box-sizing: border-box;` to `main.content-area` and `.article-wrap`.
  - Equations wider than the device screen now scroll smoothly inside their own container without expanding the page viewport or causing document-level horizontal scrolling.

### 2. View-Switcher Navigation Horizontal Touch Scrolling on Mobile
- **Root Cause:** The top app header view switcher (`<div class="view-switcher" id="viewSwitcher">`) was styled as `display: inline-flex;` without `overflow-x: auto`, and its parent `.header-left` lacked `min-width: 0; flex: 1; overflow: hidden;`. On phone viewports under 768px, the 5 view buttons (Lessons, Study, Books, JS Playground, Python Playground) exceeded the remaining header width, causing the "🐍 Python Playground" button to be clipped and completely inaccessible.
- **The Fix:**
  - Styled `.view-switcher` with `display: flex; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; touch-action: pan-x; scrollbar-width: none; min-width: 0; max-width: 100%;`.
  - Added `flex-shrink: 0; white-space: nowrap;` to `.view-btn` so tab buttons preserve touch targets without wrapping.
  - Added responsive header media queries for `@media (max-width: 768px)` optimizing padding, button sizes, and theme selector dimensions.
  - Added automated `activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` in `switchView()` ensuring any activated tab is smoothly brought into view.

### 3. Python Playground Select Button & Toolbar Containment
- **Root Cause:** The ML Model Preset `<select id="pythonSnippetSelect">` was populated with verbose 80+ character titles (e.g. `9. Principal Component Analysis (PCA) Dimensionality Reduction (Andrew Ng Week 8)`). Because HTML `<select>` elements expand to the text length of their longest option and lacked `max-width: 100%; text-overflow: ellipsis;`, the select element stretched to ~650px–850px width. Combined with horizontal action buttons in `.playground-toolbar`, this created a massive horizontal overflow on mobile screens.
- **The Fix:**
  - Formatted preset titles concisely (e.g. `1. Linear Regression (Gradient Descent)`, `9. PCA Dimensionality Reduction`, `11. Collaborative Filtering (Recommender)`) while preserving comprehensive Andrew Ng course metadata in descriptions and code comments.
  - Applied `width: 100%; max-width: 100%; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; box-sizing: border-box;` to `.playground-select`.
  - Added `@media (max-width: 768px)` rules stacking `.playground-toolbar` and `.preset-selector-wrap` into full-width vertical columns (`flex-direction: column; align-items: stretch; gap: 12px;`) and placing action buttons into a balanced 2-column grid (`grid-template-columns: 1fr 1fr; gap: 8px;`).
  - Added text wrapping and truncation to `.playground-badge`, `.playground-title`, `.playground-desc`, `.editor-header`, and `.editor-title`.

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
sha256sum -c ai-engineering-v1.5.2.apk.sha256
# Expected output:
# ai-engineering-v1.5.2.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.5.2.apk
```
