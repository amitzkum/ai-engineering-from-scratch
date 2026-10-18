# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.5.4 (Build 10)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.5.4.apk`  
**SHA-256 Checksum:** `1a20d9f1a5cdf0bcc910166c05ccbc55ed726fcbb1f1c1b7df1fb8c2ac66df4e`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🚀 Key Changes & Improvements in v1.5.4

### 1. High-Fidelity Table, Math, and Diagram Rendering in Book Volumes
- **Canonical Markdown Pipeline:** Updated book compilation pipeline (`scripts/compile_book_chapters.js` and `scripts/build_offline_books.py`) to leverage the core `site/lesson-markdown.js` parser across all 542 chapters.
- **GFM Table Parsing:** All markdown tables now compile into structured HTML tables wrapped in `<div class="table-wrap">` with clean typography and responsive scroll containment.
- **Pre-rendered KaTeX Formulas:** Math equations (both block `$$...$$` and inline `$...$`) are pre-rendered into static KaTeX HTML spans at build time. This ensures mathematical formulas render crisply in the standalone reader, EPUB 3 readers, and generated PDF copies without requiring JavaScript execution in LibreOffice.
- **Mermaid Diagrams & Figures:** Enabled runtime Mermaid diagram and registered figure rendering across all volume chapters.

### 2. Zero Horizontal Scrolling in Standalone Reader
- **Mobile Reader Toolbar Containment:** Added responsive CSS rules (`@media (max-width: 768px)`) for `.reader-toolbar`, positioning the volume title neatly on its own full-width row above action buttons to eliminate layout stretching.
- **Strict Viewport Containment:** Added `overflow-x: hidden;` and `box-sizing: border-box;` on `.book-reader-view`, `.book-reader-container`, and the reader body to ensure phone screens stay strictly locked within viewport width.
- **Responsive Table Wrappers:** Set `.table-wrap { overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; }` allowing wide tables to scroll internally without forcing the page to horizontally scroll.

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
sha256sum -c ai-engineering-v1.5.4.apk.sha256
# Expected output:
# ai-engineering-v1.5.4.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.5.4.apk
```
