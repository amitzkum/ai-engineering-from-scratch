# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.5.1 (Build 7)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.5.1.apk`  
**SHA-256 Checksum:** `02928f5727dcbeb80a918f6667cebd0491a977a516508813a711a06806fcd9ce`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🌟 What's Fixed in v1.5.1

### 1. KaTeX WebFont `@font-face` Integrity & Math Glyph Fix (`||` vs `//`)
- **Root Cause:** In previous builds, an overly aggressive regex in `scripts/build-offline-bundle.js` inadvertently stripped the closing braces across `@font-face` blocks, collapsing all 20 KaTeX font definitions into a single broken `@font-face` declaration. Consequently, the Android WebView was unable to load `KaTeX_Main`, `KaTeX_Math`, `KaTeX_Size1-4`, and `KaTeX_AMS` webfonts, falling back to system serif/monospace fonts where norm symbols (`\lVert`, `\rVert`, `\parallel`, `\|`) rendered as slanted slashes (`//`), square roots had broken radical hooks, and large delimiters failed to scale.
- **The Fix:**
  - Corrected the font cleanup regex to preserve all 20 distinct `@font-face` rules mapping to local `.woff2` font files cleanly.
  - Bundled verified vendor assets under `offline-app/vendor/katex/` to guarantee 100% deterministic offline builds with zero external network access.
  - Added test assertions in `offline-app/test_math_rendering.js` verifying that `katex.min.css` contains all distinct `@font-face` rules for `KaTeX_Main` and supporting font families.

### 2. Phone Screen Horizontal Scrolling Fix (Chapter Complete Button & Notes Card)
- **Root Cause:** The SQLite-backed `.chapter-complete-card` used `display: flex; justify-content: space-between;` with a fixed `white-space: nowrap` button (`.chapter-complete-btn`). On mobile screens (under 768px / 360-390px phones), the combined width of the status text and the button exceeded the screen width, triggering an unwanted horizontal scroll across the entire lesson reader.
- **The Fix:**
  - Applied `box-sizing: border-box; max-width: 100%;` and `min-width: 0; word-break: break-word;` across the card, titles, and text containers.
  - Added dedicated `@media (max-width: 768px)` rules that stack `.chapter-complete-card` vertically (`flex-direction: column; align-items: stretch;`), expanding the "Mark Chapter as Complete" button to full-width with `white-space: normal` and centered alignment.
  - Adapted `.page-notes-card` and `.page-notes-header` on mobile devices with `flex-direction: column` to prevent SQLite badge overflow.
  - Added unit test in `offline-app/test_responsive_shell.js` verifying mobile responsive constraints.

### 3. Offline Books Fenced ```` ```math ```` Block Support
- Updated `scripts/build_offline_books.py` to recognize ```` ```math ```` fences alongside `$$` blocks so that algorithms and equations in curriculum book volumes render as proper display math rather than monospace pre-formatted code.

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
sha256sum -c ai-engineering-v1.5.1.apk.sha256
# Expected output:
# ai-engineering-v1.5.1.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.5.1.apk
```
