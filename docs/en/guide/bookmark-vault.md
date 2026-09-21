# ❤️ Bookmark Vault & Hover Panel

>  Feature: Move your mouse over a video to open the control panel. Keep your favorite videos organized!

---

## 1. The Hover Panel 🎯

The **Hover Panel** is a great feature in V-Train . When you are on a **video playback page**, a small panel appears after you wait a tiny bit (150 milliseconds).

::: info 📍 It does not appear on small pictures
The panel only appears on the page where you watch the video. It does not appear when you hover over a small picture in a video list.
:::

> ![Floating Interaction Panel](/assets/manual/22.png)

The panel has these buttons:

| Button | Function |
|--------|----------|
| **Like** 👍 | Rate this video as good |
| **Dislike** 👎 | Rate this video as bad |
| **Bookmark** ❤️ | Save the video to a folder |
| **Screenshot** 📸 | Take a picture to use as the cover |
| **Open Vault** 📚 | Open your Bookmark Vault |

::: tip Move the panel!
You can click and drag the panel to anywhere on the screen. V-Train will remember where you put it.
:::

::: info  Feature
The Hover Panel and the Bookmark Vault are **V-Train ** features. If you use the version, you must upgrade to use them.
:::

---

## 2. Rating Videos (👍 Like / 👎 Dislike) ⭐

### What is rating?

Rating lets you quickly mark if you liked a video or not.

### How to rate a video?

1. Move your mouse over the video to open the panel.
2. Click **👍** for good, or click **👎** for bad.
3. Your rating is saved immediately.

### Seeing Your Ratings

After you rate a video, a **small badge** will appear on the video's picture:
- 👍 Thumbs up → You liked it
- 👎 Thumbs down → You did not like it

> ![Rating Badge Diagram](/assets/manual/23.png)

This helps you see what you already watched and liked.

::: tip Change your mind?
Click the same button again to remove the rating. Click the other button to change your rating.
:::

---

## 3. Save to Bookmark Vault (❤️) 📁

### How to save a video

1. On a video **playback page**, click **❤️** on the panel.
2. A list of your folders will open.
3. Click a folder to save it there.
4. Done!

::: info Note
You can only save a video from the playback page.
:::

> ![Folder Picker Diagram](/assets/manual/24.png)

---

## 4. Screenshot Cover Feature (📸) 🖼️

### What is a Screenshot Cover?

When you click the 📸 button, V-Train takes a picture of the video. It uses this picture as the cover in your Bookmark Vault.

Why do we need this? Many websites stop showing covers after a few days. Taking a picture saves the cover forever.

### Technical Flow of Screenshot

V-Train captures the cover using the following flow:

1. **Prioritize Canvas/Video Capture (Clean version)**: Attempts to take a pure screenshot directly from the `<video>` element on the page. This method ignores UI elements like progress bars or your mouse cursor.
2. **Fallback to OG Image**: If the first step fails, it tries to fetch the official sharing image from the page's `<meta property="og:image">` tag.
3. **Ultimate Fallback: Full-Screen Crop (Ponytail Fallback)**: For strictly protected adult sites where the video is locked inside an unreachable cross-origin iframe, V-Train will automatically trigger this fallback. It locates the largest iframe on your screen and uses Chrome's native screenshot API to capture the entire screen, then crops it precisely. This bypasses all protections, but because it takes a picture of your screen, any visible progress bars or mouse cursors will be included.
4. **Compression**: The captured image is compressed into a **320px wide WebP format** to balance image quality and storage space.
5. **Save to IndexedDB**: The compressed image is securely saved to your browser's local IndexedDB database.

### Keyboard Shortcuts (Essential for Fullscreen) ⚡

When a video goes **fullscreen**, the browser forces the video to the very top layer, hiding the Hover Panel behind a black background and making it unclickable. 
To solve this, use **Keyboard Shortcuts**! They bypass fullscreen limitations completely.

Default Shortcuts:
- **`Alt + S`** (Mac: `Option + S`): **1-Click Screenshot**
- **`Alt + B`** (Mac: `Option + B`): **1-Click Bookmark / Unbookmark**

::: tip How to customize shortcuts?
If the shortcuts conflict with other software or you prefer different keys (like `Ctrl + Shift + S`):
1. Type `chrome://extensions/shortcuts` into your browser's address bar and press Enter.
2. Find the **V-Train Control Panel** section.
3. Click the input box and press your desired key combination to change it!
:::

::: tip Where are the pictures saved?
The pictures are saved on **your computer only**. They are not uploaded to the internet. They will not sync to your other computers.
:::

> ![Screenshot Capture and WebP Compression Diagram](/assets/manual/25.png)

---

## 5. Bookmark Vault Screen 📚

### How to open the Bookmark Vault?

1. **From the Hover Panel**: Click the 📚 button.
2. **From the V-Train Menu**: Click the VT icon in Chrome, then click "Bookmark Vault".

> ![Bookmark Vault Main Interface Diagram](/assets/manual/26.png)

### What can you do here?

| Feature | Description |
|---------|-------------|
| **Grid View** | Show large pictures |
| **List View** | Show small pictures and more text |
| **Sort** | Sort by newest, oldest, or name |
| **Search** | Find a video by typing its name |
| **Folders** | See your folders on the left |
| **Pages** | Show 12 videos per page |

---

## 6. Using Folders 📂

### Create a Folder

Click the "New Folder" button on the left. You can create folders inside other folders. For example:

```
📁 Music
  📁 Pop
  📁 Rock
📁 Tutorials
  📁 Cooking
```

### Manage Folders

**Right-click** on any folder to:

- ✏️ **Rename**: Change the folder's name.
- 🗑️ **Delete**: Delete the folder and all videos inside it.

::: warning Be careful!
If you delete a folder, it is gone forever. You cannot get it back.
:::

### Move Videos

There are three buttons on each video card:

| Button | Function |
|--------|----------|
| 🗑️ Delete | Delete this video (cannot get it back) |
| 📂 Move to | Move this video to a different folder |
| ✏️ Rename | Change the video's name |

---

## 7. Find Your Videos 🔍

### Sort Videos

Click the sort menu in the top right corner:

- **Newest**: Show the newest videos first.
- **Oldest**: Show the oldest videos first.
- **Title A→Z**: Show videos in alphabetical order.

### Search for a Video

Type a word in the search box at the top. The system will find videos with that word in the title. It searches the current folder and all folders inside it.

---

## 8. Anti-Hotlinking Protection 🔒

### What is this?

Many websites block you from showing their pictures on other pages. This causes broken pictures in your Bookmark Vault.

### How V-Train fixes it

V-Train has a special tool that tricks those websites. It makes them think you are on their own page. This allows the pictures to load normally.

::: info 🛡️ Is this safe?
Yes, it is 100% safe. It only works for pictures and does not share your private data.
:::

---

## 9. Live Sync Across Tabs 🔄

If you have many Bookmark Vault pages open, they will all update at the same time!

If you add a video in Tab A, it will appear in Tab B immediately. You do not need to refresh the page.

::: info Note
This only works on the same computer. It does not sync to your phone or another computer.
:::

---

## 10. version: Bookmarks are Never Deleted 🛡️

V-Train automatically deletes very old video records to save space.

**But V-Train will NEVER delete a video if you put it in the Bookmark Vault.**

Even if you use the version, your saved videos are safe forever.

---

## Tip: How to use the Bookmark Vault well 🗂️

1. **Use the panel to rate**: If you like a video, click 👍.
2. **Use ❤️ to save**: Put the video in a folder so you can find it later.
3. **Use 📸 to take a picture**: If you think the cover picture might disappear later, take a picture of it.
4. **Clean your folders**: Move videos to the correct folders.
5. **Search**: If you cannot find a video, use the search box!
