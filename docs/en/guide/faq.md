# 7. FAQ

**Q: Why isn't the progress bar showing up?**  
A: First, make sure you have clicked "Authorize & Enable Current Site". If it still doesn't show up after authorization, it's possible that the site doesn't have a rule yet. You can use the "Adaptive Engine" to manually train it.

**Q: Why does the snapshot feature show a red ❌?**  
A: Some videos on websites are deeply nested inside multiple `iframe`s or are restricted by Cross-Origin Resource Sharing (CORS) policies. We have built-in a penetration engine, but a very small number of videos protected by strict Content Security Policies (CSP) still might not allow snapshots.

**Q: If I remove the extension, is my data still there?**  
A: **NO!** For absolute privacy and security, V-Train does not upload your data to any cloud. Removing the extension will completely clear the browser's local database. Please make sure to use the "Backup & Restore" feature to save your ZIP backup file.
