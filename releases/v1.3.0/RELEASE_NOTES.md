# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.3.0 (Build 4)
**Release Date:** 2026-10-15  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.3.0.apk`  
**SHA-256 Checksum:** `779b9646cfd4c172cbdc28baa1739193916c5923984c4578c44d4b60a921ee10`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🌟 What's New in v1.3.0 (Phase 9: Local SQLite3 Persistence)

### 1. In-Article Chapter Completion Button
- Added an interactive completion card at the end of every lesson with the **"Mark Chapter as Complete"** button (`#markCompleteBtn`).
- Tracks completion state directly in a local SQLite3 relational database (`chapter_completions` table).
- Dynamically updates completion timestamp, sidebar checkmarks (`✓`), progress counters, and Study Dashboard statistics.
- Automatically marks completion when passing the 6-question lesson knowledge check.

### 2. Per-Page Note Taking Stored in Local SQLite3 Database
- Added a dedicated, in-page notes card at the end of each lesson (`#pageNotesTextarea`) alongside the header notes drawer (`#noteTextarea`).
- Real-time debounced auto-save writing directly to the `page_notes` SQLite table (`lesson_id`, `phase_id`, `title`, `note_text`, `updated_at`).
- Live status indicators ("Saved to SQLite Database (`page_notes`)") and live character counter.
- Dual synchronization: typing in either the in-page notes editor or the top action drawer updates both in real-time.

### 3. Local SQLite3 Relational Database Engine (`sqlite-db.js`)
- 100% self-contained, zero-network relational SQLite engine supporting standard DDL/DML (`CREATE TABLE`, `INSERT OR REPLACE`, `SELECT`, `DELETE`, `BEGIN`, `COMMIT`).
- Rigorously tested against Node 22+ built-in `node:sqlite` (`DatabaseSync(':memory:')`) to verify standard SQLite3 syntax compatibility.
- Comprehensive test suite expanded to 52 passing tests across 9 suites.

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
sha256sum -c ai-engineering-v1.3.0.apk.sha256
# Expected output:
# ai-engineering-v1.3.0.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.3.0.apk
```
