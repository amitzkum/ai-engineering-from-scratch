# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.1.0 (Phase 7: Code Playground & Interactive Sandbox)
**Release Date:** October 15, 2026  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.1.0.apk` (15 MB)  
**SHA-256 Checksum:** `021bb1ff0172009f0e2af38b1f2822663422bf18208f740e48713dc8ede15fbc`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🎖️ Attribution & Acknowledgements

### App Creation, Offline Architecture & Packaging
- **App Creator & Architect:** **Amit Kumar**
- Designed, engineered, and packaged the interactive offline Code Playground, sandbox execution engine, responsive dual-pane layout, and in-lesson integration.

### Curriculum & Pedagogical Source
- **Curriculum Source:** **AI Engineering from Scratch Contributors**
- Core curriculum algorithms, math derivations, and test cases authored by the contributors of [AI Engineering from Scratch](https://github.com/ai-engineering-from-scratch).

---

## 🚀 What's New in Version 1.1.0

### 1. In-App Offline Code Playground (`#playgroundView`)
- Added dedicated 4th navigation view: **`📖 Lessons` | `📊 Study` | `📚 Books` | `💻 Playground`**.
- Integrated script editor with monospace typography (`JetBrains Mono`), Tab indentation handling, keyboard shortcut execution (`Ctrl+Enter` / `Cmd+Enter`), and debounced local auto-save.
- Built-in live terminal output console displaying runtime execution metrics (`⏱ Xms`, execution status badges `SUCCESS` / `ERROR`, line counts, and formatted logs).

### 2. Pre-loaded Curriculum Algorithm Presets
Learners can load and run core algorithms from the curriculum with zero setup:
1. **Self-Attention from Raw Math (Phase 04):** Computes $Q K^T / \sqrt{d_k}$, 2D softmax attention weights, and context value projection.
2. **Gradient Descent Linear Regression (Phase 01):** Implements MSE loss, analytical weight updates, and prediction evaluation.
3. **Vector Cosine Similarity (Phase 03):** Calculates dot product and norm-based cosine similarities across semantic embeddings.
4. **Byte-Pair Encoding Merge Step (Phase 03):** Bigram pair frequency counting and vocab merging.
5. **ReAct Agent Loop Simulator (Phase 13):** Thought $\to$ Action $\to$ Observation execution cycle with simulated search and calculator tools.

### 3. In-Lesson Code Integration ("▶ Playground")
- Every code snippet throughout all 542 lessons now features a **"▶ Playground"** button right next to the "Copy" button.
- One tap transfers the code directly into the Playground editor and opens the sandbox for immediate offline experimentation.

---

## 📦 Verification & Installation

### Checksum Verification
```bash
sha256sum -c ai-engineering-v1.1.0.apk.sha256
# Expected output:
# ai-engineering-v1.1.0.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.1.0.apk
```
