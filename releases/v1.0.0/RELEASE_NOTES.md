# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.0.0 (Official Initial Release)
**Release Date:** October 15, 2026  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.0.0.apk` (15 MB)  
**SHA-256 Checksum:** `e9ec2c8a5b3cdedb2ef3b1b206ed51b9e55d81831192585662f95e8e8598c1e3`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🎖️ Attribution & Acknowledgements

### App Creation, Offline Architecture & Packaging
- **App Creator & Architect:** **Amit Kumar**
- Engineered as a standalone, zero-network, high-performance offline Android learning platform.
- Implemented touch-optimized dual-pane responsive layout, DOM pre-rendering engine, offline Mermaid/SVG diagram zoom & pan viewer, interactive quiz grading system, 6-volume offline book library, client-side search engine, and local study tracking.

### Curriculum & Pedagogical Source
- **Curriculum Source:** **AI Engineering from Scratch Contributors**
- Original curriculum design, all 542 lesson writeups, from-scratch mathematical implementations, test suites, and exercises are authored and maintained by the contributors of the open-source repository [AI Engineering from Scratch](https://github.com/ai-engineering-from-scratch).
- All educational material is licensed under the curriculum repository's open-source terms.

---

## 🚀 Key Features in Version 1.0.0

1. **100% Offline-First Architecture**
   - Zero external network dependencies.
   - All 542 lessons across 20 phases pre-rendered and bundled directly into the APK assets.
   - Embedded fonts (`Source Serif 4`, `JetBrains Mono`, `VT323`).

2. **Interactive Knowledge Checks & Quiz Engine**
   - 6-question diagnostic quizzes per lesson (pre, check, and post stages).
   - Immediate answer validation, detailed pedagogical explanations, and passing grade calculation.

3. **Curriculum Book Library (6 Volumes)**
   - Pre-compiled standalone volumes covering Foundations, Deep Learning, NLP & Transformers, LLMs & Generative AI, Agents & Protocols, and Production Systems.
   - Built-in standalone offline reader, EPUB download, and print-to-PDF support.

4. **Interactive Architecture Diagrams & Zoom Viewer**
   - Offline Mermaid diagram rendering with adaptive color palette.
   - Standalone modal with pan, zoom in, zoom out, and reset for intricate network diagrams.

5. **Client-Side Instant Search Engine**
   - Sub-16ms query latency matching 60 FPS touch frame budgets.
   - Category filtering (Foundations, Deep Learning, NLP, LLMs, Agents, Production) and programming language filtering (Python, TypeScript, Rust, Julia).

6. **Study Analytics & Personal Reflection Dashboard**
   - Local progress tracking with percentage completion across all 20 phases.
   - Estimated study time calculation, bookmarks management, and lesson-specific personal notes.
   - Data safety: Full JSON export and import for seamless study backup across devices.

7. **Reading Ergonomics & Dual-Pane Adaptive Layout**
   - Native tablet split-screen master/detail view with collapsible drawer for mobile screens.
   - 4 display themes: Dark Mode, AMOLED Pitch Black, Clean Light, and Eye-Comfort Sepia.
   - Reader font size stepping from 0.85rem to 1.5rem.

---

## 📦 Verification & Installation

### Checksum Verification
Verify file integrity before installation:
```bash
sha256sum -c ai-engineering-v1.0.0.apk.sha256
# Expected output:
# ai-engineering-v1.0.0.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.0.0.apk
```

---

## 📌 Release Policy & Versioning
- **Archival Invariant:** All APK versions generated for this project are permanently archived under `releases/v<version>/` and will never be overwritten or deleted.
- **Release Tracking:** `releases/ai-engineering-latest.apk` always links to the most recent official build.
- **Versioning Strategy:** Future updates follow minor version increments (v1.1.0, v1.2.0, etc.) unless major platform changes are instructed by Amit Kumar.
