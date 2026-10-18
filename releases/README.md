# AI Engineering from Scratch — Android Releases Archive

This directory contains the official signed Android APK releases for the **AI Engineering from Scratch (Offline Tablet & Mobile Edition)**.

---

## 🏛️ Permanent Archival & Versioning Policy

1. **Non-destructive Storage**: Every generated release APK is permanently stored in its own version folder (`releases/v<version>/`) and is **never** replaced, overwritten, or deleted across subsequent releases.
2. **Latest Release Pointer**: `releases/ai-engineering-latest.apk` always mirrors the latest official release for sharing.
3. **Version Increment Cadence**: In accordance with project instructions, future releases follow **minor version updates** (v1.1.0, v1.2.0, v1.3.0, ...) unless explicitly specified by Amit Kumar.

---

## 🎖️ Attribution & Origin

- **App Creator & Architect:** **Amit Kumar** (Offline Android Architecture, UI/UX, Local Bundling, and Packaging)
- **Curriculum & Pedagogical Source:** **AI Engineering from Scratch Contributors** (Lessons, Math Implementations, Quizzes, and Tests)
- **Repository:** [github.com/ai-engineering-from-scratch](https://github.com/ai-engineering-from-scratch)

---

## 📂 Release Index

| Version | Release Date | APK File | SHA-256 Checksum | Release Notes |
|:-------:|:------------:|:--------:|:----------------:|:-------------:|
| **v1.5.1** | 2026-10-18 | [`ai-engineering-v1.5.1.apk`](v1.5.1/ai-engineering-v1.5.1.apk) | `02928f5727dcbeb80a918f6667cebd0491a977a516508813a711a06806fcd9ce` | [Notes](v1.5.1/RELEASE_NOTES.md) |
| **v1.5.0** | 2026-10-18 | [`ai-engineering-v1.5.0.apk`](v1.5.0/ai-engineering-v1.5.0.apk) | `c01d1e182d004b90c0c41fd642a114d2b105a7476ca89e9f04e339a9c43600d5` | [Notes](v1.5.0/RELEASE_NOTES.md) |
| **v1.4.0** | 2026-10-18 | [`ai-engineering-v1.4.0.apk`](v1.4.0/ai-engineering-v1.4.0.apk) | `dd5e972f60430946aa3cec76699e05a77f1baf4bea43c2bd4a932552e0612065` | [Notes](v1.4.0/RELEASE_NOTES.md) |
| **v1.3.0** | 2026-10-15 | [`ai-engineering-v1.3.0.apk`](v1.3.0/ai-engineering-v1.3.0.apk) | `779b9646cfd4c172cbdc28baa1739193916c5923984c4578c44d4b60a921ee10` | [Notes](v1.3.0/RELEASE_NOTES.md) |
| **v1.2.0** | 2026-10-15 | [`ai-engineering-v1.2.0.apk`](v1.2.0/ai-engineering-v1.2.0.apk) | `dbaff6b0dd28757c87b29984f20fb9ab0a7a9fd5a1ac859dcf1a7e984942bf43` | [Notes](v1.2.0/RELEASE_NOTES.md) |
| **v1.1.0** | 2026-10-15 | [`ai-engineering-v1.1.0.apk`](v1.1.0/ai-engineering-v1.1.0.apk) | `021bb1ff0172009f0e2af38b1f2822663422bf18208f740e48713dc8ede15fbc` | [Notes](v1.1.0/RELEASE_NOTES.md) |
| **v1.0.0** | 2026-10-15 | [`ai-engineering-v1.0.0.apk`](v1.0.0/ai-engineering-v1.0.0.apk) | `e9ec2c8a5b3cdedb2ef3b1b206ed51b9e55d81831192585662f95e8e8598c1e3` | [Notes](v1.0.0/RELEASE_NOTES.md) |

---

## 📲 Quick Install

To install the latest release on your Android device:
```bash
adb install -r releases/ai-engineering-latest.apk
```

---

## 🛠️ Rebuilding & Cutting New Releases

For step-by-step instructions on merging upstream commits and releasing new versions, see [RELEASE_NEW_BUILD.md](../RELEASE_NEW_BUILD.md).

