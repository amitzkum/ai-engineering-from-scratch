# Rebuilding & Releasing New Builds: Step-by-Step Runbook

> **Target Audience:** Maintainer & Developer (Amit Kumar)  
> **App:** AI Engineering from Scratch (Offline Android Tablet & Mobile Edition)  
> **Target Branch:** `android-offline-app`  
> **Package Identifier:** `com.aiengineering.offline`

This runbook outlines the exact steps to pull new curriculum commits from `main`, regenerate the offline bundles, compile a signed production APK, and publish an official release.

---

## 📋 Quick Start Summary

Whenever new lessons or commits land on the `main` branch, run this 3-command sequence from the repository root:

```bash
# 1. Pull and merge latest curriculum changes
git fetch origin main && git merge origin/main

# 2. Execute the one-click build, test, signing & archival pipeline
./scripts/rebuild-app.sh

# 3. Commit and push the new release artifacts
git add -f offline-app/ android/ releases/ scripts/ package.json
git commit -m "chore(release): v1.5.4 update with upstream curriculum"
git push origin android-offline-app
```

---

## 🛠️ Prerequisites & Environment Setup

Ensure your local environment has the Android SDK and Java 21 configured. If not already exported in your shell profile, run:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=$HOME/.jdk/jdk-21
export PATH=$JAVA_HOME/bin:$PATH
```

*(The rebuild script `./scripts/rebuild-app.sh` also automatically detects these default paths if they exist).*

---

## 📖 Detailed Step-by-Step Procedure

### Step 1: Merge Upstream Commits

Always ensure your local working tree is clean on the `android-offline-app` branch before merging:

```bash
git checkout android-offline-app
git status

# Fetch and merge updates from the main curriculum branch
git fetch origin main
git merge origin/main
```

> [!NOTE]
> Offline app infrastructure (`offline-app/`, `android/`, `releases/`, `scripts/rebuild*`) lives exclusively on `android-offline-app`. Merge conflicts are rare and typically limited to `README.md` or `ROADMAP.md` if curriculum links were modified.

---

### Step 2: Run the One-Click Rebuilder

From the repository root, execute:

```bash
./scripts/rebuild-app.sh
```

#### Choosing the Version Number
- **Automatic Minor Increment (Default):**  
  Running `./scripts/rebuild-app.sh` without arguments automatically bumps the minor version (e.g. `v1.2.0` $\rightarrow$ `v1.3.0`).
- **Explicit Version Number:**  
  To specify an exact version (e.g., a major milestone or patch release):
  ```bash
  ./scripts/rebuild-app.sh 2.0.0
  # or
  ./scripts/rebuild-app.sh 1.5.4
  ```

#### What the Script Executes Automatically (~40 seconds):
1. **Validates Environment:** Confirms `ANDROID_HOME`, `JAVA_HOME`, and `release.keystore`.
2. **Synchronizes Metadata:** Updates version strings across `build.gradle`, `strings.xml`, `package.json`, and test files.
3. **Compiles Offline Bundle:** Scans all 542 lessons in `phases/`, pre-renders KaTeX math formulas into static HTML spans, bundles local fonts, SVGs, offline Pyodide 3.12 with NumPy/SciPy/Scikit-Learn wheels, and rebuilds the client-side search index.
4. **Pre-compiles Offline Library:** Compiles all 6 book volumes into EPUB 3 archives, responsive standalone HTML readers with table containment (`.table-wrap`), and high-fidelity LibreOffice PDFs with pre-rendered KaTeX math.
5. **Executes Quality Gates:** Runs the entire 73+ test suite across 11 test suites (`node --test offline-app/test_*.js`). If any test fails, the build halts immediately.
6. **Syncs Native Assets:** Runs `npx cap sync android` to stage web assets into the Android native directory.
7. **Compiles Signed Release APK:** Runs `./gradlew assembleRelease` using your production `release.keystore`.
8. **Verifies Cryptographic Signature:** Runs `apksigner verify` confirming APK Signature Scheme v2 (`CN=Amit Kumar`).
9. **Permanent Archival:**
   - Saves `releases/v<version>/ai-engineering-v<version>.apk`.
   - Generates SHA-256 checksum file (`ai-engineering-v<version>.apk.sha256`).
   - Generates release notes (`releases/v<version>/RELEASE_NOTES.md`).
   - Updates `releases/ai-engineering-latest.apk` (pointer to the latest build).
   - Appends the release row to [`releases/README.md`](releases/README.md).

---

### Step 3: Commit and Push Release Artifacts

Because `.git/info/exclude` ignores intermediate web dist outputs, use the `-f` flag to stage tracked files:

```bash
git add -f offline-app/ android/ releases/ scripts/ package.json
git commit -m "chore(release): vX.Y.0 update with upstream curriculum"
git push origin android-offline-app
```

---

### Step 4: Test & Distribute the APK

The signed production APK is immediately ready for distribution or physical testing:

#### A. Install Directly via USB (ADB)
Connect your Android tablet or phone with USB Debugging enabled:
```bash
adb install -r releases/ai-engineering-latest.apk
```

#### B. Verify Cryptographic Integrity
```bash
cd releases/v<version>
sha256sum -c ai-engineering-v<version>.apk.sha256
# Expected output: ai-engineering-v<version>.apk: OK
```

---

## 🔒 Attribution & Offline Invariants

Every build must preserve the core rules documented in [`APP_BUILD_RULES.md`](APP_BUILD_RULES.md):
1. **100% Zero-Network Guarantee:** The app contains zero network requests and no remote update checking. Releases are distributed strictly manually by Amit Kumar.
2. **Attribution Invariants:**
   - **App Creator & Architect:** Amit Kumar (UI, offline engine, packaging, release signing).
   - **Curriculum Authors:** AI Engineering from Scratch Contributors.
3. **Lean Archival:** Only the latest production APK release is preserved in Git; older release notes and checksums are permanently preserved.
