<div align="center">
  <img src="icon-128.png" alt="V-Train Logo" width="128" height="128">
  <h1>V-Train (VT) 智慧影片收藏與進度追蹤</h1>
  <p>一個強大且輕量級的 Chrome 擴充功能，專為提升網頁影片瀏覽體驗所設計。</p>
  
  <a href="https://chromewebstore.google.com/detail/v-train-adaptive-video-ba/cikabjkegiefjgalfncfoehmkpmkoiaf">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-前往下載-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://github.com/vtrain-labs/v-train-extension">
    <img src="https://img.shields.io/badge/GitHub-開源專案-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  <a href="https://vtrain-labs.github.io/v-train-extension/">
    <img src="https://img.shields.io/badge/Docs-線上說明手冊-blue?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Online Manual">
  </a>
  
  <br>
  <p><b>🌍 Languages:</b> <span>繁體中文</span> | <a href="README_EN.md">English</a></p>
</div>

---

## 📖 目錄
1. [特色介紹](#core-features)
2. [安裝指南](#install-guide)
3. [快速開始教學](#quick-start)
4. [PRO 版專屬功能](#pro-features)
5. [支援範圍與規範](#disclaimer)
6. [系統架構亮點](#architecture)
7. [授權條款](#license)

---

<a id="core-features"></a>
## ✨ 核心特色

* **🎥 零侵入式進度追蹤**：智慧分析影片播放頁面，記錄精確的觀看進度，並在影片縮圖上自動覆蓋進度條。
* **🤖 動態自學引擎 (URL Parser)**：強大的 URL 規則解析器，支援使用者手動選取縮圖，擴充功能會自動學習並建立該網站的專屬解析規則。
* **❤️ 影片書籤與浮動面板 (PRO)**：游標懸停影片即出現浮動操作面板，支援「喜歡/不喜歡」評分、一鍵收藏、並能自訂資料夾分類管理。
* **📸 內建縮圖快取系統**：解決 CDN 防盜鏈問題，一鍵擷取目前影片畫面作為自訂封面，並將二進位影像快取至本地資料庫。

---

<a id="install-guide"></a>
## 🚀 安裝指南

### 方式一：官方商店安裝 (推薦)
最簡單的方式，支援自動更新。
1. 前往 [Chrome 應用程式商店](https://chromewebstore.google.com/detail/v-train-adaptive-video-ba/cikabjkegiefjgalfncfoehmkpmkoiaf)。
2. 點擊 **「加到 Chrome」**。

### 方式二：手動安裝 (搶鮮版/開發者模式)
如果你想安裝最新的開發版本，或是想自行修改代碼：
1. 將本專案 `Clone` 或 `下載 ZIP` 到你的電腦並解壓縮。
2. 開啟 Chrome 瀏覽器，前往 `chrome://extensions/`。
3. 在右上角開啟 **「開發者模式」**。
4. 點擊左上角的 **「載入未封裝項目」**，選擇本專案資料夾。

---

<a id="quick-start"></a>
## 📚 快速開始教學

> [!TIP]
> 以下是 V-Train 的核心功能操作說明，幫助你快速上手！

### 1. 擴充功能主控面板 (Control Panel)
完整的擴充功能主控台，允許你自由開關按鈕、自訂進度條顏色、備份與還原你的所有自訂規則與書籤紀錄。

<div align="center">
  <img src="assets/popup.png" alt="主控台與設定面板" width="800">
</div>

### 2. 規則自學引擎 (Training Mode)
遇到無法自動追蹤的網站？你可以教導 V-Train 認識它！
對著影片縮圖點擊右鍵選擇 `V-Train: Start Training Engine`，透過上下鍵調整藍色選取框，鎖定目標後按下 Enter。

<div align="center">
  <img src="assets/training.png" alt="規則自學引擎展示" width="800">
</div>

接著，系統會自動擷取並解析 URL。若系統未能精準抓取，你也可以**手動編輯欄位**來協助 VT 找到正確的影片 ID。確認 ID 無誤後，點擊儲存到對應的模組，系統就會永久記憶該網站的進度條規則！

<div align="center">
  <img src="assets/training-save.png" alt="儲存 ID 規則介面" width="800">
</div>

### 3. 社群規則庫 (Community Rules)
不想自己慢慢訓練？歡迎前往官方的 [社群規則庫 (Community Rules)](https://github.com/vtrain-labs/community-rules)！
你可以在這裡找到其他玩家分享的 `SYNC-Zxxxx` 規則序號，直接複製並到擴充功能內的「Serial Import」貼上，一秒鐘無痛支援各大影音網站！

---

<a id="pro-features"></a>
## 👑 PRO 版專屬功能

V-Train 提供了一次性買斷的 PRO 版本，為重度使用者與注重隱私的玩家提供更強大的控制權與收藏體驗：

### 1. 浮動收藏操作面板 (Hover Panel)
當你在支援的影片網站上觀看影片時，右下角會自動浮現精美的操作面板。
包含觀看進度 (Recording)、一鍵收藏、評分，以及快速擷取影片畫面的功能。

<div align="center">
  <img src="assets/panel.png" alt="浮動面板操作展示" width="800">
</div>

### 2. 書籤管理中心 (Vault)
點擊擴充功能圖示，或是面板上的「書籤管理」按鈕，即可進入你的個人影片庫。
支援資料夾分類、時間排序，以及絕佳的暗色模式視覺體驗。

<div align="center">
  <img src="assets/vault.png" alt="書籤管理中心" width="800">
</div>

### 3. 隱私密碼鎖定 (Passcode Protection)
你的觀看隱私至關重要。PRO 版允許你設定專屬密碼，任何人在開啟**擴充功能主控面板**之前都必須先經過驗證，徹底保護你的設定與收藏庫不被窺探。

<div align="center">
  <img src="assets/pro-password.png" alt="隱私密碼保護" width="800">
</div>

---

<a id="disclaimer"></a>
## ⚠️ 支援範圍與社群內容規範

因受限於付費訂閱與地區限制，**V-Train 官方目前僅能針對 YouTube、Bilibili 與 Odysee 提供原生保證與維護**。

但 V-Train 內建的「動態自學引擎」極度靈活，允許使用者在幾乎任何未受官方支援的影音網站（包含需付費的 OTT 平台、私人論壇或特殊串流網站）上建立進度追蹤規則。使用者可以利用 GitHub 第三方社群互相交流這些常規串流平台的規則序號。

> **【嚴正警告】**
> 為符合擴充商店政策，本官方專案（包含 Issues 與 PR）**嚴格禁止張貼、討論任何針對成人 (NSFW)、暴力或盜版網站所建立的自訂規則**。官方無法干涉您在本地端瀏覽器上將 VT 引擎用於何種網站，但在此公開版面上，任何涉及上述違規網站的規則分享將被直接刪除。

---

<a id="architecture"></a>
## 🛠️ 系統架構亮點

* **Manifest V3 完美支援**：完全符合 Google 最新的安全規範。
* **混合式高效儲存 (Hybrid IndexedDB)**：結合 `chrome.storage.local` 與 `IndexedDB`，確保龐大的影片資料也能流暢讀寫。
* **效能優化 (Performance)**：大量運用 `requestAnimationFrame` 進行 DOM 批次讀寫，避免 Layout Thrashing；運用 `Promise` 鎖 (Lock) 機制確保非同步寫入不衝突。

<a id="license"></a>
## 📜 授權條款 (License)
本專案採用 [MIT License](LICENSE) 授權條款。
