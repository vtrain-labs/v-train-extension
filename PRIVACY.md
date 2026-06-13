# Privacy Policy for V-Train (VT)

**Last Updated:** June 2026

V-Train ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension handles your data.

## 1. Zero-Server Architecture (Local Storage Only)
V-Train operates entirely on a "Zero-Server Architecture". 
- **All data generated or collected by the extension is stored strictly locally on your device** using your browser's built-in storage mechanisms (`chrome.storage.local` and `IndexedDB`).
- We **do not** own, operate, or maintain any external databases or cloud servers.
- We **do not** transmit, upload, or sync your personal data, watch history, or custom rules to any external server.

## 2. Data We Collect and How It Is Used
To provide its core functionality, V-Train processes the following data locally:

*   **Website Content (DOM Data):** When you use the Training Engine or watch a video, the extension reads the active webpage's structure (DOM) to extract the Video ID, Title, and Thumbnail image URL. This is used solely to generate the progress bar and save visual bookmarks.
*   **Web History / Watch Progress:** The extension records the exact timestamp of the videos you watch. This data is saved locally to resume your playback later and populate your Bookmark Vault.

## 3. Data Sharing and Third Parties
Because all data remains on your local device, **we do not sell, trade, or otherwise transfer your data to outside parties.**
The only network requests made by the extension are direct requests from your browser to the original video hosting websites (CDNs) to fetch thumbnail images for your local Bookmark Vault.

## 4. User Control and Data Deletion
You have complete control over your data:
- You can delete individual bookmarks or watch history directly within the extension's Bookmark Vault.
- You can wipe all extension data instantly by uninstalling the extension from your browser.
- You can manually export your data as a JSON backup file and store it wherever you choose.

## 5. Changes to This Privacy Policy
We may update this Privacy Policy from time to time to reflect changes in our practices or Chrome Web Store policies. We will notify users of any significant changes by updating the "Last Updated" date at the top of this policy.

## 6. Contact Us
If you have any questions regarding this Privacy Policy, please open an issue on our official [GitHub Repository](https://github.com/vtrain-labs/v-train-extension/issues).
