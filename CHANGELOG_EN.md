# Changelog

## [1.0.6] - 2026-06-17

### Added
- **Free Version Bookmark Features**: The Local Bookmark Vault is now fully available to Free version users (limited to 100 bookmarks).
- **Infinite Records Architecture Breakthrough**: Thanks to the performance breakthroughs of the underlying IndexedDB engine, the previous 200,000 record limit for Pro versions has been completely removed. We have now achieved a true, physically "infinite" record tracking architecture.

### Fixed
- **Unified Quota Calculation (Free Version)**: Refactored the quota calculation logic for Free versions (Total Quota = Bookmarks + History = 200). Bookmarks will now correctly occupy the overall quota. When the quota is full, the system will accurately replace the oldest regular history records first, ensuring precious bookmarks are never lost.
- **Dynamic Quota Sync**: Implemented cross-tab and dashboard broadcasting. Now, whether you click to bookmark on a video page or delete a bookmark inside the Bookmark Vault, the total quota and UI progress bars will instantly refresh across all windows in milliseconds.
- **Clear Data Reset Logic**: Fixed a bug where clicking "Clear Data" in the control panel would incorrectly reset the tracking number to zero even though bookmarks were successfully retained. The system now accurately calculates remaining bookmarks and displays the correct occupied quota.

## [1.0.7] - 2026-06-20

### Added
- **Built-in Global Tracking Engine (YouTube & Bilibili)**: V-Train now automatically injects and activates optimized default parsing rules for YouTube and Bilibili in the background upon installation. Users no longer need to manually import configurations and can enjoy out-of-the-box, precise progress tracking and thumbnail capturing for these two major platforms.
- **Exclusive Progress Bar Color**: You can now set exclusive progress bar colors for three different video rating states: "Normal", "Like", and "Dislike". These colors will instantly switch and apply on the video page based on your rating.
- **Fallback Snapshot via Context Menu**: To address screenshot failures (the red ❌) on certain video sites caused by cross-origin ad interference or strict CORS policies, we introduced a dynamic context menu fallback mechanism. If the 1-click snapshot fails, a tooltip will guide you to right-click the page and select "📸 V-Train: Force Physical Snapshot". This cleverly leverages the temporary `activeTab` permission to bypass all browser restrictions, guaranteeing a 100% snapshot success rate.

### Changed
- **Generic Sharing Code**: To enhance the tool's neutrality and privacy for community sharing, the exported configuration serial number prefix has been changed from `VT-RULE-` to a generic `SYNC-`. Legacy `VT-RULE-` serial numbers remain fully backwards compatible and can be seamlessly imported.

### Fixed
- **YouTube Case-Sensitivity & 404 Thumbnail Fix**: Completely removed the legacy "forced lowercase" rule for YouTube video IDs. This ensures the system utilizes the 100% accurate, case-sensitive ID to request high-res thumbnails from the official YouTube API, perfectly resolving the 404 image missing issue. This also fixes the visual bug where the heart icon on the main player and the sidebar thumbnails were out of sync due to case mismatches.
- **Fullscreen Panel Interference**: Implemented a `fullscreenchange` system listener. Now, when you enter fullscreen mode while watching a video, the bottom-right bookmark interaction panel will automatically hide itself. It restores automatically upon exiting fullscreen, giving you an unobstructed, pure viewing experience.
- **English i18n Modal Fallback**: Fixed an issue where raw i18n variable keys (e.g., `modalRescue`) were displayed instead of human-readable text in the dashboard and rescue modals under the English locale.


## [1.0.5] - 2026-06-15

### Added
- **All-New Independent ZIP Backup Center**: Created a full-screen, immersive independent backup control panel. Fully supports instant switching between 8 languages.
- **Extreme Compression & Data Separation Engine**: Solved the issue of legacy single JSON backup files causing crashes due to excessive size. The system now intelligently separates "Core Settings & Bookmarks (core_data.json)" and the "Binary Image Library (images_part_X.json)". It supports in-memory chunked packing and compression for up to 100,000 images, ensuring a smooth and crash-free experience under extreme data loads.

### Fixed
- **CORS Cross-Origin Blocking Error Fix**: Migrated the image fetching logic from the extension background to the content script, completely resolving the annoying issue where bookmarking caused massive red text errors in the extension management page (`chrome://extensions`) due to site cross-origin policies.
- **Legacy Base64 Auto-Migration**: Implemented an automated cleansing engine targeting the legacy system architecture. When users import legacy backups or export data, the system automatically extracts bloated Base64 image encodings from bookmarks and transfers them to the new `vt_thumbnails` image library, permanently optimizing the user's local database performance.

## [1.0.4] - 2026-06-14

### Added
- **Bookmark Vault - Move Folder Functionality**: Added a "Move Folder" feature to the folder right-click context menu in the local bookmark vault (`bookmarks.html`). It supports completely moving an entire folder (including its internal video bookmarks and subfolders) under another folder, and fully supports 8 language packs for UI display.

### Fixed
- **Video Thumbnail Accuracy Optimization**: Fixed an issue where clicking bookmark on certain video sites would mistakenly capture the thumbnail of a recommended video in the sidebar. Optimized the script's fetching weight to prioritize parsing the page's `schema.org` and `og:image` metadata, ensuring accurate capture of the currently playing main video's preview image.

## [1.0.3] - 2026-06-14

### Fixed
- **Cross-Origin Video Snapshot**: Deeply refactored the snapshot system by implementing a "Cross-Frame Message Relay". Snapshot commands from the external panel can now accurately penetrate multiple layers of iframes, reaching the deepest original video environment to perform native Canvas snapshots, perfectly bypassing black screen limitations caused by Chrome hardware acceleration.
- **Prevent Fake Video Misjudgment**: Enhanced the snapshot decision logic via `sysState._activeEl` to ensure screenshots are only taken for videos currently being tracked, avoiding interference from hidden ads or dummy video tags at the top layer of the web page that used to cause screenshot failures (Red X).
- **Cleaned Up Duplicate Panels**: Fixed a UI overlap error where two floating control panels (one external, one internal to the video) would be generated when a video is wrapped inside an iframe.

## [1.0.2] - 2026-06-14

### Fixed
- **Critical Bug**: Fixed an error where the system's automatic progress saving during video playback would overwrite and clear the user's custom "Bookmark Thumbnail", "Title", and "Bookmark Status". Database writes have now been changed to "Partial Update", perfectly preserving the user's customized covers and rating states.
- Removed the incomplete experimental Cross-Origin Iframe unlock feature to maintain a clean main interface and extension stability.

## [1.0.1] - 2026-06-10

### Added
- Initial release to the Chrome Web Store.
- Support for PRO version features: "Bookmark Management Center" and "Privacy Passcode Lock".
- Support for progress bar overlay and tracking on major video websites.
