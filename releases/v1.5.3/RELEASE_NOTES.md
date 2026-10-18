# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.5.3 (Build 9)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.5.3.apk`  
**SHA-256 Checksum:** `f4100d83a055e373702c7ac6fb130c6103460f5748ad0389760f9eea8a1848a7`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🚀 Key Changes & Improvements in v1.5.3

### 1. Local EPUB & PDF Downloads in Books Tab
- **Native Android Downloader Bridge:** Implemented `@JavascriptInterface AndroidDownloader.downloadBlob` in `MainActivity.java` that decodes base64 blobs and writes directly to Android's `MediaStore.Downloads` (Android 10+) or `Environment.DIRECTORY_DOWNLOADS` (Android 9-) with native system Toast alerts.
- **Offline Book Cards:** Replaced web/browser links on all 6 book volume cards (`Read Volume`, `EPUB`, `PDF`) with offline local download handlers.
- **All 6 Volumes Packaged in EPUB & PDF:** Bundled pre-generated standalone PDFs alongside EPUBs for Volume 1 through Volume 6 in `dist/books/`.
- **In-Reader Local Export:** Added dedicated `📥 EPUB` and `📄 PDF` download buttons to the standalone book reader toolbar.

### 2. Compact Select Menu with Infinite Horizontal Marquee
- **Reduced Button Height:** Reduced the vertical height of the algorithm and model preset dropdowns from multi-line expansion to a clean, compact 34px container.
- **Horizontal Scrolling Marquee:** Added smooth horizontal scrolling marquee animation (`@keyframes selectMarqueeScroll`) with text duplication for seamless infinite looping when title text exceeds screen width.
- **Single-Line Mobile Layout:** Arranged the preset label and select button side-by-side in a single row on mobile phones without vertical stretching or horizontal page overflow.
- **Accessible Native Selector:** Used a transparent touch overlay pattern so clicking the marquee container seamlessly opens the native mobile OS picker dialog.

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
sha256sum -c ai-engineering-v1.5.3.apk.sha256
# Expected output:
# ai-engineering-v1.5.3.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.5.3.apk
```
