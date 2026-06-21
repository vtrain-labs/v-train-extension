# ❓ Frequently Asked Questions (FAQ)

Do you have a problem? Look here first! If you cannot find the answer, please report it on [GitHub Issues](https://github.com/vtrain-labs/v-train-extension/issues).

---

## 🔴 Progress Bar Problems

### Q: Why do I not see progress bars on a video website?

**Check these things:**

1. **You did not authorize the website.**
   → Open the Dashboard. Click the **"Authorize & Enable Current Site"** button.

2. **V-Train does not know this website.**
   → If you authorized the website but still see nothing, V-Train needs rules. Use the [Adaptive Engine](./adaptive-engine) to train it!

3. **V-Train is turned off.**
   → ✅ Make sure the status toggle on the Dashboard says "**🟢 Monitoring**". It must not be "**Monitoring Off**".

4. **You are watching the video.**
   → Progress bars only appear on the **video list page**. You will not see them when you are watching the video.

5. **You need to refresh the page.**
   → Press **F5** to reload the website.

---

### Q: Why did some progress bars disappear?

::: warning Free Version Limit
The Free version only remembers **200 videos**. When you watch more than 200, it deletes the oldest ones.
If you want to keep all your progress, please upgrade to the [Pro Version](./pro-features).
:::

If you have the Pro version, you might have accidentally cleared your data. Please backup your data often!

---

### Q: How do I change the color of the progress bar?

Open the Dashboard. Click the colored square next to **"Progress Bar Color"**. You can choose any color you want!

---

## 🖼️ Screenshot Problems

### Q: Why is there a red ❌ on the screenshot button?

V-Train tries many ways to take a picture, but sometimes it fails:

::: warning Common reasons for screenshot failure
- **Cross-origin iframe**: The video is loaded from a different website.
- **Strict Security Policies**: The website blocks screenshots.
- **Protected Video**: You cannot take pictures of DRM-protected videos.
:::

If a screenshot fails, you can still:
- Save the video to your Bookmark Vault (it will use the website's original picture).
- Track your viewing progress.

---

### Q: My screenshot covers disappeared! What happened?

Your screenshots are saved inside your browser. They will disappear if you:
- Uninstall V-Train.
- Clear your browser data (cache and cookies).

::: tip 💡 How to keep them safe?
Use the **Export Full Backup** button on the Dashboard. Choose the option to include pictures. Your pictures will be saved in the backup ZIP file!
:::

---

## 📕 Bookmark Vault Problems

### Q: Why do the pictures in the Bookmark Vault break after a few days?

Many video websites stop you from loading their pictures on other pages. This is a common problem.

V-Train has a special tool to fix this:

> Every time you open the Bookmark Vault, V-Train finds the broken pictures. It tells Chrome to trick the video websites. This makes the pictures load normally.

::: tip 💡 How to fix broken pictures
1. Close the Bookmark Vault tab.
2. Open it again. Wait a few seconds for the tool to work.
3. If it is still broken, go to the video page and use the 📸 button to take your own picture. Your own pictures never break!
:::

---

### Q: I deleted a bookmark by mistake. Can I get it back?

No, you **cannot get it back** (unless you have a backup).
V-Train does not have a "trash bin". All data lives on your computer.

::: warning Advice
- **Backup** your data before you delete many bookmarks.
- Put important bookmarks in a special folder so you do not delete them.
:::

---

## 🔐 Passcode and Privacy Problems

### Q: I forgot my passcode!

Read the "I Forgot My Passcode!" section in the [Pro Features Guide](./pro-features.md).

Quick steps: Click **"Forgot Passcode?"** → Enter your **Pro License Key** → The passcode is removed.

---

### Q: Does V-Train upload my private data?

**No. Never.** V-Train does not use servers:

- All your viewing history, bookmarks, and rules stay **on your computer**.
- We only check your Pro License Key online. We do not send your personal data.
- V-Train **does not have a database server**.

---

### Q: If I uninstall V-Train, do I lose my data?

**Yes!** If you remove the extension, Chrome will delete all your data:
- Your history, bookmarks, and screenshots.
- Your settings.

::: danger ⚠️ Backup before uninstalling!
If you have important data, you must **Export a Full Backup** before you remove V-Train!
:::

---

## 🌐 Adaptive Engine Problems

### Q: I finished training, but there are no progress bars?

Check these things:

1. **Did you authorize the website?** Dashboard → Authorize Current Site.
2. **Did you refresh the page?** Press F5.
3. **Did the rule save?** Dashboard → Trained Sites. Check if the rule is there.
4. **Did you select the right box?** You must select the box that holds the picture, not the picture itself.

If it still does not work, the website link might be difficult. Delete the rule and try again. Try clicking a different part of the link for the Video ID.

---

### Q: My friend gave me a SYNC serial number. How do I use it?

1. Open the Dashboard.
2. Click the **"Trained Sites (Rules)"** button.
3. Find the "Import Rule" box.
4. Paste the `SYNC-Z...` number and click confirm.
5. The rule works immediately!

---

## ⚡ Speed Problems

### Q: Will V-Train make my computer slow?

No. V-Train is designed to be very fast:

- It only checks videos you can see on the screen.
- It pauses when nothing is happening.
- It uses very little computer power.

You will not notice it running.

---

### Q: I have many Bookmark Vault tabs open. Will they break?

No! V-Train syncs them all automatically.
If you add a bookmark in one tab, the other tabs will update immediately.

---

## 🔔 Incognito Mode Problems

### Q: Can I use V-Train in Incognito Mode?

Yes, but you must turn it on:

1. Type `chrome://extensions/` in Chrome.
2. Find V-Train and click **"Details"**.
3. Turn on the **"Allow in Incognito"** switch.

::: info Note
V-Train shares data between normal mode and incognito mode. Your history in incognito mode will be saved with your normal history.
:::

---

## 💬 Still need help?

1. Search on [GitHub Issues](https://github.com/vtrain-labs/v-train-extension/issues) to see if someone has the same problem.
2. If not, click **"New Issue"** and tell us:
   - Your Chrome version.
   - Your V-Train version.
   - The website that has the problem.
   - What went wrong.
