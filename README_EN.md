<div align="center">
  <img src="icon-128.png" alt="V-Train Logo" width="128" height="128">
  <h1>V-Train (VT) Smart Video Bookmarks & Progress Tracker</h1>
  <p>A powerful and lightweight Chrome extension designed to elevate your web video browsing experience.</p>
  
  <a href="https://chromewebstore.google.com/detail/v-train-adaptive-video-ba/cikabjkegiefjgalfncfoehmkpmkoiaf">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-Download-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/jllikhebbofonocjpmnmmmlihmeiigfl">
    <img src="https://img.shields.io/badge/Edge_Add--ons-Download-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Edge Add-ons">
  </a>
  <a href="https://github.com/vtrain-labs/v-train-extension">
    <img src="https://img.shields.io/badge/GitHub-Open_Source-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  <a href="https://vtrain-labs.github.io/v-train-extension/">
    <img src="https://img.shields.io/badge/Docs-Online_Manual-blue?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Online Manual">
  </a>
  
  <br>
  <p><b>🌍 Languages:</b> <a href="README.md">繁體中文</a> | <span>English</span></p>
</div>

---

## 📖 Table of Contents
1. [Core Features](#core-features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
5. [Supported Platforms & Guidelines](#disclaimer)
6. [Architecture Highlights](#architecture)
7. [License](#license)

---

<a id="core-features"></a>
## ✨ Core Features

* **🎥 Non-intrusive Progress Tracking**: Intelligently analyzes video player pages, records exact playback progress, and automatically overlays a progress bar on video thumbnails.
* **🤖 Dynamic URL Parser (Training Mode)**: A powerful rule engine that allows users to manually select thumbnails. The extension automatically learns and creates custom parsing rules for that specific website.
* **❤️ Video Bookmarks & Hover Panel **: Hover over any video thumbnail to reveal a sleek operations panel. Supports "Like/Dislike" ratings, one-click bookmarking, and custom folder management.
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


<a id="disclaimer"></a>
## ⚠️ Official Support & Disclaimer

As a neutral progress management tool, V-Train natively guarantees updates and maintenance only for YouTube, Bilibili, and Odysee.

Due to the highly adaptable nature of V-Train's built-in "Visual Capture Engine," users can manually create tracking rules for almost any unsupported video website. **The official team cannot track, restrict, or record which websites you apply V-Train to on your local browser.**

### 🌐 Community Rules Database
If you need support for other websites, or if you want to share a rule you trained yourself, please visit the official third-party repository:
👉 **[V-Train Community Rules](https://github.com/vtrain-labs/community-rules)**

> **[Community Guidelines]**
> To keep the forum clean and comply with the content policies of major platforms:
> 1. The Issues section of this main repository is strictly for "Software Bugs & Feature Requests."
> 2. All requests and code sharing regarding "specific website rules" must be posted in the **[Community Rules Database](https://github.com/vtrain-labs/community-rules)**.
> 3. If the code you share involves sensitive, adult (NSFW), or pirated websites, **you must use asterisks to mask the URL in your post (e.g., p\*\*nhub.com)**. The official team only provides neutral technical code aggregation and does not endorse the content of any website shared by the community.

---

<a id="architecture"></a>
## 🛠️ Architecture Highlights

* **Perfect Manifest V3 Support**: Fully compliant with Google's latest security guidelines.
* **Hybrid IndexedDB Storage**: Combines `chrome.storage.local` with `IndexedDB` to ensure smooth reading and writing of massive video data.
* **Performance Optimization**: Heavily utilizes `requestAnimationFrame` for batch DOM reads/writes to prevent Layout Thrashing; uses a `Promise` Lock mechanism to ensure asynchronous writes do not conflict.

<a id="license"></a>
## 📜 License
This project is licensed under the [MIT License](LICENSE).
