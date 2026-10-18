# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version 1.5.0 (Build 6)
**Release Date:** 2026-10-18  
**Package Identifier:** `com.aiengineering.offline`  
**Artifact:** `ai-engineering-v1.5.0.apk`  
**SHA-256 Checksum:** `c01d1e182d004b90c0c41fd642a114d2b105a7476ca89e9f04e339a9c43600d5`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

---

## 🌟 What's New in v1.5.0

### 1. Safe-Area Inset Support for Phone Screens (System Bar & Notch Overlap Fix)
- Fixed phone screen layout issue where headers and footers overlapped with Android battery icons, mobile tower indicators, camera notches, and gesture navigation bars.
- Implemented native `ViewCompat.setOnApplyWindowInsetsListener` in `MainActivity.java` to dynamically calculate display cutouts and inject `--safe-area-inset-top`, `--safe-area-inset-bottom`, `--safe-area-inset-left`, and `--safe-area-inset-right` CSS variables into the WebView root.
- Updated styles across `.app-header`, `.sidebar`, `.sidebar-footer`, `.article-wrap`, and mobile drawer modals using `env(safe-area-inset-*)` with runtime CSS variable fallbacks, providing crisp margins on phone screens while preserving edge-to-edge tablet and desktop experiences.

### 2. Offline Python ML Playground (Pyodide CPython 3.12 WebAssembly)
- Added a dedicated **🐍 Python Playground** tab accessible from the main navigation header and mobile sidebar drawer.
- Bundled full offline CPython 3.12 runtime powered by Pyodide WebAssembly with pre-bundled native wheels:
  - `numpy 1.26.4` + `openblas 0.3.26`
  - `scipy 1.12.0`
  - `scikit-learn 1.4.2`
  - `joblib 1.4.0`
  - `threadpoolctl 3.4.0`
- Zero external network dependencies: all wheels and WebAssembly binaries reside locally on-device (`file:///android_asset`).
- Hardened sandbox security: `pip` and `micropip` are completely disabled and blocked; any install attempt raises a descriptive `PermissionError` explaining the offline security policy.
- Multi-threaded non-blocking execution via dedicated Web Worker (`python-worker.js`) with custom stdout/stderr terminal streaming, reset to defaults, and local scratchpad persistence.

### 3. Pre-bundled Andrew Ng Machine Learning Course Models
- Included comprehensive presets for all 11 foundational machine learning algorithms taught in Andrew Ng's Machine Learning course:
  1. **Linear Regression with Gradient Descent & Normal Equation** (`ROUNDS_OF_TRAINING = 150`)
  2. **Logistic Regression Binary Classification** (`ROUNDS_OF_TRAINING = 200`)
  3. **Regularized Linear Regression (Ridge L2)** (`ROUNDS_OF_TRAINING = 150`, `LAMBDA_REG = 0.5`)
  4. **Softmax Regression Multi-Class** (`ROUNDS_OF_TRAINING = 200`)
  5. **2-Layer Neural Network with Backpropagation** (`ROUNDS_OF_TRAINING = 300`, `HIDDEN_UNITS = 8`)
  6. **Support Vector Machine (Linear SVM & Hinge Loss)** (`ROUNDS_OF_TRAINING = 150`, `C_PARAM = 1.0`)
  7. **Decision Tree Classifier (Entropy & Information Gain)** (`MAX_DEPTH = 3`)
  8. **K-Means Clustering** (`ROUNDS_OF_TRAINING = 15`, `K_CLUSTERS = 3`)
  9. **Principal Component Analysis (PCA & SVD)** (`N_COMPONENTS = 2`)
  10. **Anomaly Detection (Multivariate Gaussian)** (`EPSILON_THRESHOLD = 0.015`)
  11. **Collaborative Filtering Recommender** (`ROUNDS_OF_TRAINING = 150`, `LATENT_FACTORS = 3`)
- Each preset implements the algorithm from raw math using only `numpy`, and verifies the predictions side-by-side against production `scikit-learn`.
- Configurable training rounds allow learners to experiment with convergence rates directly on their mobile device.

### 4. Zero Regressions & Complete Test Coverage
- All 542 curriculum lessons, pre-rendered KaTeX formulas, 6-volume offline book library, SQLite progress tracking, and JavaScript sandbox remain intact.
- Expanded test suite to 67 unit tests across 11 test suites passing deterministically.

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
sha256sum -c ai-engineering-v1.5.0.apk.sha256
# Expected output:
# ai-engineering-v1.5.0.apk: OK
```

### Direct ADB Installation
```bash
adb install -r ai-engineering-v1.5.0.apk
```
