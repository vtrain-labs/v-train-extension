<div align="center">
  <img src="icon-128.png" alt="V-Train Logo" width="128" height="128">
  <h1>V-Train (VT) Smart Video Bookmarks & Progress Tracker</h1>
  <p>A powerful and lightweight Chrome extension designed to elevate your web video browsing experience.</p>
  
  <a href="https://chromewebstore.google.com/detail/v-train-adaptive-video-ba/cikabjkegiefjgalfncfoehmkpmkoiaf">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-Download-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://github.com/vtrain-labs/v-train-extension">
    <img src="https://img.shields.io/badge/GitHub-Open_Source-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  
  <br>
  <p><b>🌍 Languages:</b> <a href="README.md">繁體中文</a> | <span>English</span></p>
</div>

---

## 📖 Table of Contents
1. [Core Features](#core-features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [PRO Features](#pro-features)
5. [Architecture Highlights](#architecture)
6. [License](#license)

---

<a id="core-features"></a>
## ✨ Core Features

* **🎥 Non-intrusive Progress Tracking**: Intelligently analyzes video player pages, records exact playback progress, and automatically overlays a progress bar on video thumbnails.
* **🤖 Dynamic URL Parser (Training Mode)**: A powerful rule engine that allows users to manually select thumbnails. The extension automatically learns and creates custom parsing rules for that specific website.
* **❤️ Video Bookmarks & Hover Panel (PRO)**: Hover over any video thumbnail to reveal a sleek operations panel. Supports "Like/Dislike" ratings, one-click bookmarking, and custom folder management.
* **📸 Built-in Thumbnail Caching**: Bypasses CDN hotlinking restrictions by capturing the current video frame as a custom cover with a single click, caching the binary image directly to the local database.

---

<a id="installation"></a>
## 🚀 Installation

### Method 1: Chrome Web Store (Recommended)
The easiest way with automatic updates.
1. Go to the [Chrome Web Store](https://chromewebstore.google.com/detail/v-train-adaptive-video-ba/cikabjkegiefjgalfncfoehmkpmkoiaf).
2. Click **"Add to Chrome"**.

### Method 2: Manual Installation (Developer Mode)
If you want to install the latest dev build or modify the code yourself:
1. `Clone` or `Download ZIP` this repository and extract it to your computer.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the extracted folder.

---

<a id="quick-start"></a>
## 📚 Quick Start

> [!TIP]
> Here are the core features of V-Train to help you get started quickly!

### 1. Control Panel
A complete dashboard that allows you to toggle features, customize progress bar colors, and backup/restore all your custom rules and bookmark histories.

<div align="center">
  <img src="assets/popup.png" alt="Control Panel" width="800">
</div>

### 2. Adaptive Training Engine
Encounter a website that isn't automatically tracked? You can teach V-Train to recognize it!
Right-click on a video thumbnail and select `V-Train: Start Training Engine`. Use the Up/Down arrow keys to adjust the blue selection box, and press Enter to lock the target.

<div align="center">
  <img src="assets/training.png" alt="Training Engine Demo" width="800">
</div>

Next, the system will automatically extract and parse the URL. If the system fails to capture it perfectly, you can **manually edit the field** to help VT find the correct Video ID. Once confirmed, save it to the corresponding module, and the system will permanently remember the progress bar rules for that website!

<div align="center">
  <img src="assets/training-save.png" alt="Save ID Rule Interface" width="800">
</div>

---

<a id="pro-features"></a>
## 👑 PRO Features

V-Train offers a one-time purchase PRO version, providing heavy users and privacy-conscious players with greater control and an enhanced bookmarking experience:

### 1. Hover Operations Panel
When watching videos on supported sites, a beautiful operations panel automatically appears in the bottom right corner.
It includes progress tracking status (Recording), one-click bookmarking, ratings, and a quick screenshot tool.

<div align="center">
  <img src="assets/panel.png" alt="Hover Panel Demo" width="800">
</div>

### 2. Bookmark Vault
Click the extension icon or the "Bookmark Vault" button on the hover panel to enter your personal video library.
Supports folder categorization, chronological sorting, and an excellent dark mode visual experience.

<div align="center">
  <img src="assets/vault.png" alt="Bookmark Vault" width="800">
</div>

### 3. Passcode Protection
Your viewing privacy is paramount. The PRO version allows you to set a custom passcode. Anyone attempting to open the **Extension Control Panel** must pass verification first, completely protecting your settings and vault from prying eyes.

<div align="center">
  <img src="assets/pro-password.png" alt="Passcode Protection" width="800">
</div>

---

<a id="architecture"></a>
## 🛠️ Architecture Highlights

* **Perfect Manifest V3 Support**: Fully compliant with Google's latest security guidelines.
* **Hybrid IndexedDB Storage**: Combines `chrome.storage.local` with `IndexedDB` to ensure smooth reading and writing of massive video data.
* **Performance Optimization**: Heavily utilizes `requestAnimationFrame` for batch DOM reads/writes to prevent Layout Thrashing; uses a `Promise` Lock mechanism to ensure asynchronous writes do not conflict.

<a id="license"></a>
## 📜 License
This project is licensed under the [MIT License](LICENSE).
