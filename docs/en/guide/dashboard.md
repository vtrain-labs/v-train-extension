# 🎛️ Dashboard Overview

The V-Train Dashboard is the main control center. It is like an airplane's cockpit where you find all the buttons and switches! This page explains what each part does.

> ![Dashboard Main Screen](/assets/manual/5.png)

::: info 📋 How to open the Dashboard?
:::

---

## 1. Dashboard Layout

From top to bottom, the dashboard has these main areas:

 Function |
----------|
 Switch between Monitoring / Monitoring Off |
 Hover Panel, Monitor Panel, Progress Bar Color, Language |
 Authorize the current website |
 Number of recorded videos |
 Rules, Bookmark Vault, Backup,  |

---

## 2. Status Area: Monitoring / Monitoring Off

This is the most important switch. It controls if V-Train is "working".

> ![Monitoring Toggle](/assets/manual/8.png)

### Monitoring
- Switch is ON → Green light, text says "Monitoring"
- V-Train is tracking the videos you watch.
- Progress bars appear under video thumbnails.

### Monitoring Off
- Switch is OFF → Gray light, text says "Monitoring Off"
- V-Train is sleeping. **It will not record or show** progress bars.
- It leaves no trace of what you watch.

::: tip 💡 When should I use Monitoring Off?
Use Monitoring Off when you watch videos you do not want to record. You can switch modes at any time.
:::

::: warning ⚠️ Monitoring Off is default for new users
When you first install V-Train, **Monitoring Off is turned on by default**. If you do not see progress bars, please make sure the switch is set to "Monitoring".
:::

---

## 3. Settings Area

### 🖱️ Hover Panel (Show Interaction)

This controls the "Floating Panel" on the video playback screen.

This small panel lets you:
- **👍 Like / 👎 Dislike** — Rate the video quickly.
- **❤️ Bookmark** — Save the video to your Bookmark Vault.
- **📸 Snapshot Cover** — Take a picture of the video to use as a cover.

> ![Floating Interaction Panel](/assets/manual/10.png)

If you do not like this panel, you can turn it off here.

You can use all buttons on the Hover Panel to save your favorite videos. There is no limit to the number of bookmarks you can save.
:::

---

### 🖥️ Monitor Panel

This is a tool to help fix problems. If you turn it on, a small black window appears in the **bottom left** corner of your screen. It shows what V-Train is doing:

- Is it recording?
- What is the Video ID?
- What is the current progress (%)?

> ![Monitor Panel](/assets/manual/11.png)

Normal users do not need to turn this on. It is useful if progress bars are not working properly.

::: tip 💡 When is it useful?
When you train a new website, the rules might not work. Turn on the monitor panel to see what ID the system finds. This helps you fix mistakes!
:::

---

### 🎨 Progress Bar Color

Do you want to change the default red progress bar? You can set exclusive colors for three different video rating states: "Normal", "Like (👍)", and "Dislike (😤)"!

> ![Progress Bar Color Picker](/assets/manual/12.png)

- Use the dropdown menu to select a state, and click the color square on the right to pick your favorite color.
- Progress bars on all trained websites will instantly change to the corresponding color based on your rating for that video.
- If you don't set specific colors for "Like" or "Dislike", the system will automatically use the "Normal" color.
- To switch back to default red, type `#ff0000` in the color picker.

---

### 🌐 Language Select

Use the menu at the top right to change the language.

 Language |
----------|
 Traditional Chinese |
 English |

The text changes immediately. You do not need to refresh the page.

::: info Multi-language Support
The extension supports multiple languages. We will add more languages to the manual soon.
:::

---

## 4. Authorize Current Site Button

> ![Authorize Button](/assets/manual/6.png)

This **blue button** is at the **very top** of the dashboard. If you visit a website that is **not authorized**, the button says:

```
🔓 Authorize & Enable Current Site
```

Click it. Chrome will ask for permission. Click Allow. The button will turn **green** and say:

```
✅ Site Authorized
```

::: info 📌 V-Train's Authorization System
V-Train uses Chrome's **Optional Permissions**. It only works on websites you allow. It cannot read data from other websites. Your privacy is safe.
:::

---

## 5. Statistics: Video Record Count

The middle of the dashboard shows how many **video progress records** V-Train has saved.

- **Free Version**: Shows `{Count} / 200` (Maximum 200 records)

For free users, the number turns **red** when you get close to 200. When you reach 200, new records will delete the oldest records.

---

## 6. Trained Sites Management (Rules Panel)

Click the "**Trained Sites (Rules)**" button to open the rules management panel.

> ![Rules Management Panel](/assets/manual/13.png)

### 🔍 Search

Use the search box at the top. Type a website name (like `example.com`) to find it quickly.

### 📄 Pages

The list shows **10 websites** per page. Use the buttons to go to the next or previous page.

### 📋 Rule Details

Click a website name to **see more details**:

- **Slot Dots**: There are 4 training slots (Mod 1 ~ Mod 4). A red dot ● means a rule is saved here. A gray dot ○ means it is empty.
- **Rule Description**: Explains how the rule works (like "Last segment of URL path").
- **Raw JSON**: Click to see the code data.
- **SYNC Serial Number**: Every rule has a special serial number you can share.

> ![Rule Detail Card](/assets/manual/14.png)

### 📤 Share Rules (Copy Serial)

Click the **orange "📋 Share" button** on a rule card. The full `SYNC-Z...` serial number will copy to your clipboard. You can paste it to share with friends!

::: tip 💡 Full Serial Number
The dashboard only shows part of the serial number to save space. If you **hover your mouse** over it, you will see the full number. The Share button always copies the full number.
:::

### 🗑️ Delete Rules

Click the trash can icon 🗑️ to delete a rule. You must click confirm to delete it.

::: warning ⚠️ Cannot be undone
If you delete a rule, you cannot get it back. Use "Share" to copy the serial number as a backup before you delete it!
:::

### 📥 Import Rules

**Method 1: Paste Serial Number**
Find the serial input box. Paste the `SYNC-Z...` serial number. Click the "**Import**" button.

**Method 2: Import JSON File**
Click the "**Import File**" button. Choose a `VTrain_Rules_XXXX-XX-XX.json` file. The system will add these rules.

::: info 📌 Community Rules Library
:::

---

## 7. Bookmark Vault Access

::: tip 🌟 Unlimited Bookmarks\r?\nYou can save an unlimited number of bookmarks and enjoy high-quality thumbnail covers.\r?\n:::

Click the "**📚 Bookmark Vault**" button. A beautiful full-screen bookmark manager will open in a new tab.

> ![Bookmark Vault Main Screen](/assets/manual/15.png)

Bookmark Vault features:
- **Folders**: Create many folders. Right-click to rename or delete.
- **Bookmark Cards**: Each video has a cover picture, title, and link.
- **Quick Jump**: Click a card to open the video in a new tab.
- **Custom Covers**: Take pictures of the video to use as covers.

To learn more, read the [Bookmark Vault Guide](./bookmark-vault.md).

---

## 8. Backup & Restore

::: danger ⚠️ Important! Backup your data!
V-Train stores all data **only on your computer**. We have no servers. If you remove the extension or reinstall your browser, your data is gone forever!
:::

### 📥 Export Backup

Click the "**Export Full Backup**" button. The Backup Center will open. Choose what to backup:

- ✅ **Core Data**: History, settings, rules, folders.
- 🖼️ **Images**: Custom cover pictures.

The system will create a backup file and download it.

### 📤 Import (Restore)

Click the "**Import Full Backup**" button. The Restore Center will open. **Drag and drop** your downloaded backup file into the page. Your data will be restored.

To learn more, read the [Backup Guide](./backup.md).

---

## 9. Privacy Settings Area

### 🗑️ Clear Data

Click the "**🗑️ Clear Data**" button. This deletes all **local viewing history**.

It will delete:
- ✅ All video progress records
- ✅ Bookmarks and cover pictures

It will **NOT** delete:
- ❌ Trained website rules
- ❌ Extension settings (Language, Color, etc.)

::: danger ⚠️ Cannot be undone!
You cannot get this data back. Please **export a backup** before you clear data!
:::

---

## Summary

The dashboard has many buttons, but you only need to use these the most:

1. **🟢 Monitoring Toggle** — Keep it ON to see progress bars.
2. **🔓 Authorize Button** — Click this on every new website.
3. **📋 Rules** — Share and import website rules.
4. **Export Full Backup** — Backup often to protect your data.

If you have questions, read the [FAQ](./faq.md) page!


