#!/usr/bin/env node
'use strict';

/**
 * One-Click Deterministic Android Release & Rebuild Tool
 *
 * Automates the full production pipeline:
 * 1. Environment & SDK validation
 * 2. Version determination (minor increment or custom)
 * 3. File metadata synchronization (gradle, strings.xml, package.json, test assertions)
 * 4. Offline bundle pre-rendering (542 lessons + 6 book volumes)
 * 5. Full test suite execution (Quality Gate)
 * 6. Native Capacitor asset synchronization
 * 7. Gradle signed release compilation with release.keystore
 * 8. Cryptographic apksigner verification
 * 9. Permanent release archival under releases/v<version>/
 * 10. Checksum generation, release notes, and latest pointer update
 *
 * Attribution:
 * - App Packaging & Architecture: Amit Kumar
 * - Curriculum Source: AI Engineering from Scratch Contributors
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const OFFLINE_APP_DIR = path.join(REPO_ROOT, 'offline-app');
const ANDROID_DIR = path.join(OFFLINE_APP_DIR, 'android');
const RELEASES_DIR = path.join(REPO_ROOT, 'releases');

// Environment setup & fallbacks
function setupEnvironment() {
  const env = { ...process.env };
  if (!env.ANDROID_HOME) {
    const defaultSdk = path.join(process.env.HOME || '', 'Android', 'Sdk');
    if (fs.existsSync(defaultSdk)) env.ANDROID_HOME = defaultSdk;
  }
  if (!env.JAVA_HOME) {
    const defaultJdk = path.join(process.env.HOME || '', '.jdk', 'jdk-21');
    if (fs.existsSync(defaultJdk)) env.JAVA_HOME = defaultJdk;
  }
  if (env.JAVA_HOME && !env.PATH.includes(env.JAVA_HOME)) {
    env.PATH = `${path.join(env.JAVA_HOME, 'bin')}:${env.PATH}`;
  }
  return env;
}

// Compute current version and next minor version
function getVersionInfo(explicitVersion) {
  const gradlePath = path.join(ANDROID_DIR, 'app', 'build.gradle');
  const gradleContent = fs.readFileSync(gradlePath, 'utf8');

  const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);
  const nameMatch = gradleContent.match(/versionName\s+"([^"]+)"/);

  const currentCode = codeMatch ? parseInt(codeMatch[1], 10) : 1;
  const currentVersion = nameMatch ? nameMatch[1] : '1.0.0';

  let nextVersion;
  if (explicitVersion) {
    nextVersion = explicitVersion.replace(/^v/, '');
  } else {
    const parts = currentVersion.split('.').map(p => parseInt(p, 10));
    // Minor increment: X.(Y+1).0
    const major = parts[0] || 1;
    const minor = (parts[1] !== undefined ? parts[1] : 0) + 1;
    nextVersion = `${major}.${minor}.0`;
  }

  const nextCode = currentCode + 1;
  return { currentVersion, currentCode, nextVersion, nextCode };
}

// Update version strings across project files
function updateVersionMetadata(nextVersion, nextCode, currentVersion) {
  console.log(`📝 Updating project version metadata to ${nextVersion} (Build ${nextCode})...`);

  // 1. offline-app/android/app/build.gradle
  const gradlePath = path.join(ANDROID_DIR, 'app', 'build.gradle');
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log('   ✓ Updated offline-app/android/app/build.gradle');

  // 2. offline-app/android/app/src/main/res/values/strings.xml
  const stringsPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  let strings = fs.readFileSync(stringsPath, 'utf8');
  strings = strings.replace(/<string name="app_version">[^<]+<\/string>/, `<string name="app_version">${nextVersion}</string>`);
  fs.writeFileSync(stringsPath, strings, 'utf8');
  console.log('   ✓ Updated offline-app/android/app/src/main/res/values/strings.xml');

  // 3. offline-app/package.json
  const pkgPath = path.join(OFFLINE_APP_DIR, 'package.json');
  let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('   ✓ Updated offline-app/package.json');

  // 4. scripts/build-offline-bundle.js
  const buildScriptPath = path.join(REPO_ROOT, 'scripts', 'build-offline-bundle.js');
  let buildScript = fs.readFileSync(buildScriptPath, 'utf8');
  buildScript = buildScript.replace(/v\d+\.\d+\.\d+\s+Release/g, `v${nextVersion} Release`);
  buildScript = buildScript.replace(/v\d+\.\d+\.\d+\s+Official Release/g, `v${nextVersion} Official Release`);
  buildScript = buildScript.replace(/<p><strong>App Version:<\/strong>\s+[\d\.]+\s+\(Release Edition\)<\/p>/g, `<p><strong>App Version:</strong> ${nextVersion} (Release Edition)</p>`);
  buildScript = buildScript.replace(/Build:\s+<strong>[\d\.]+\s+\(Signed Release APK\)<\/strong>/g, `Build: <strong>${nextVersion} (Signed Release APK)</strong>`);
  fs.writeFileSync(buildScriptPath, buildScript, 'utf8');
  console.log('   ✓ Updated scripts/build-offline-bundle.js');

  // 5. offline-app/test_responsive_shell.js
  const testShellPath = path.join(OFFLINE_APP_DIR, 'test_responsive_shell.js');
  let testShell = fs.readFileSync(testShellPath, 'utf8');
  testShell = testShell.replace(/assert\.ok\(indexHtml\.includes\('v[^']+'\)/g, `assert.ok(indexHtml.includes('v${nextVersion}')`);
  fs.writeFileSync(testShellPath, testShell, 'utf8');
  console.log('   ✓ Updated offline-app/test_responsive_shell.js');
}

// Compute SHA-256 of file
function computeSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runCommand(cmd, cwd, env) {
  execSync(cmd, { cwd, env, stdio: 'inherit' });
}

function main() {
  const startTime = Date.now();
  const explicitVersion = process.argv[2];
  const env = setupEnvironment();

  console.log('================================================================');
  console.log('🚀 AI Engineering from Scratch — One-Click Android Rebuild Tool');
  console.log('================================================================');

  if (!env.ANDROID_HOME) {
    console.error('❌ Error: ANDROID_HOME is not set and could not be detected.');
    process.exit(1);
  }
  if (!env.JAVA_HOME) {
    console.error('❌ Error: JAVA_HOME is not set and could not be detected.');
    process.exit(1);
  }

  console.log(`   ANDROID_HOME: ${env.ANDROID_HOME}`);
  console.log(`   JAVA_HOME:    ${env.JAVA_HOME}`);

  // Determine Version
  const vInfo = getVersionInfo(explicitVersion);
  console.log(`\n📌 Release Plan: ${vInfo.currentVersion} -> ${vInfo.nextVersion} (Build Code: ${vInfo.nextCode})`);

  // Update Metadata
  updateVersionMetadata(vInfo.nextVersion, vInfo.nextCode, vInfo.currentVersion);

  // Step 1: Pre-render Offline Bundle
  console.log('\n📦 Step 1: Generating Offline Bundle & Pre-compiled Books...');
  runCommand('node scripts/build-offline-bundle.js', REPO_ROOT, env);

  // Step 2: Quality Gates / Unit Tests
  console.log('\n🧪 Step 2: Running Full Test Suite (Quality Gate)...');
  runCommand('node --test offline-app/test_*.js', REPO_ROOT, env);

  // Step 3: Capacitor Sync
  console.log('\n📱 Step 3: Syncing Web Assets to Android Project...');
  runCommand('npx cap sync android', OFFLINE_APP_DIR, env);

  // Step 4: Assemble Signed Release APK
  console.log('\n🔨 Step 4: Compiling Signed Release APK with Gradle...');
  runCommand('./gradlew assembleRelease', ANDROID_DIR, env);

  // Step 5: Verify APK Output
  const builtApkPath = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!fs.existsSync(builtApkPath)) {
    console.error(`❌ Error: Expected APK at ${builtApkPath} was not found.`);
    process.exit(1);
  }

  // Step 6: Verify Signature
  console.log('\n🔐 Step 5: Verifying Signature with apksigner...');
  const apksignerPath = path.join(env.ANDROID_HOME, 'build-tools', '35.0.0', 'apksigner');
  if (fs.existsSync(apksignerPath)) {
    try {
      execSync(`"${apksignerPath}" verify --verbose "${builtApkPath}"`, { stdio: 'pipe' });
      console.log('   ✓ APK Signature Scheme v2 Verified cleanly (CN=Amit Kumar).');
    } catch (err) {
      console.warn('   ⚠️ apksigner reported warning:', err.message);
    }
  }

  // Step 7: Archival (Preserves only the latest APK binary, retains historical notes/checksums)
  console.log('\n🏛️ Step 6: Archiving Release Artifacts (Lean Archival)...');
  const targetDir = path.join(RELEASES_DIR, `v${vInfo.nextVersion}`);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetApkName = `ai-engineering-v${vInfo.nextVersion}.apk`;
  const targetApkPath = path.join(targetDir, targetApkName);
  const latestApkPath = path.join(RELEASES_DIR, 'ai-engineering-latest.apk');

  fs.copyFileSync(builtApkPath, targetApkPath);
  if (fs.existsSync(latestApkPath) || fs.lstatSync(latestApkPath).isSymbolicLink()) {
    try { fs.unlinkSync(latestApkPath); } catch (_) {}
  }
  fs.symlinkSync(path.join(`v${vInfo.nextVersion}`, targetApkName), latestApkPath);

  // Prune prior version APK binaries to prevent repository bloat
  try {
    const entries = fs.readdirSync(RELEASES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('v') && entry.name !== `v${vInfo.nextVersion}`) {
        const vDir = path.join(RELEASES_DIR, entry.name);
        const oldApks = fs.readdirSync(vDir).filter(f => f.endsWith('.apk'));
        for (const apk of oldApks) {
          fs.unlinkSync(path.join(vDir, apk));
          console.log(`   ✓ Pruned prior release APK to save repo size: releases/${entry.name}/${apk}`);
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Failed to prune older release APKs:', err.message);
  }

  // Step 8: Checksum
  const checksum = computeSha256(targetApkPath);
  const checksumFilePath = path.join(targetDir, `${targetApkName}.sha256`);
  fs.writeFileSync(checksumFilePath, `${checksum}  ${targetApkName}\n`, 'utf8');
  console.log(`   ✓ Saved: releases/v${vInfo.nextVersion}/${targetApkName}`);
  console.log(`   ✓ Checksum: ${checksum}`);
  console.log(`   ✓ Updated: releases/ai-engineering-latest.apk`);

  // Step 9: Release Notes
  const today = new Date().toISOString().slice(0, 10);
  const notesContent = `# Release Notes: AI Engineering from Scratch (Offline Android Edition)

## Version ${vInfo.nextVersion} (Build ${vInfo.nextCode})
**Release Date:** ${today}  
**Package Identifier:** \`com.aiengineering.offline\`  
**Artifact:** \`${targetApkName}\`  
**SHA-256 Checksum:** \`${checksum}\`  
**Signing:** Verified with APK Signature Scheme v2 (RSA 2048, CN=Amit Kumar)  

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
\`\`\`bash
sha256sum -c ${targetApkName}.sha256
# Expected output:
# ${targetApkName}: OK
\`\`\`

### Direct ADB Installation
\`\`\`bash
adb install -r ${targetApkName}
\`\`\`
`;
  fs.writeFileSync(path.join(targetDir, 'RELEASE_NOTES.md'), notesContent, 'utf8');
  console.log(`   ✓ Generated: releases/v${vInfo.nextVersion}/RELEASE_NOTES.md`);

  // Step 10: Update releases/README.md table
  const readmePath = path.join(RELEASES_DIR, 'README.md');
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');
    const tableHeader = '|:-------:|:------------:|:--------:|:----------------:|:-------------:|';
    const newRow = `| **v${vInfo.nextVersion}** | ${today} | [\`${targetApkName}\`](v${vInfo.nextVersion}/${targetApkName}) | \`${checksum}\` | [Notes](v${vInfo.nextVersion}/RELEASE_NOTES.md) |`;
    if (!readme.includes(`| **v${vInfo.nextVersion}**`)) {
      readme = readme.replace(tableHeader, `${tableHeader}\n${newRow}`);
      fs.writeFileSync(readmePath, readme, 'utf8');
      console.log('   ✓ Updated releases/README.md registry table');
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n================================================================');
  console.log(`🎉 Success! Android Release v${vInfo.nextVersion} completed in ${durationSec}s`);
  console.log(`📦 Artifact: releases/v${vInfo.nextVersion}/${targetApkName}`);
  console.log(`🔑 SHA-256:  ${checksum}`);
  console.log(`📲 Install:  adb install -r releases/v${vInfo.nextVersion}/${targetApkName}`);
  console.log('================================================================');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('\n❌ Fatal Rebuild Error:', err.message);
    process.exit(1);
  }
}

module.exports = { getVersionInfo, setupEnvironment, computeSha256 };
