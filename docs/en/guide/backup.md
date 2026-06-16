# 5. Backup & Restore Center

Because V-Train uses a **"Zero Server Architecture"**, all your data exists only on your computer. To prevent data loss due to browser reinstallation, please back up regularly.

> ![Backup Center Main](/assets/manual/backup_center_main.png)

* **Export JSON**: Click "📥 Export JSON" in the dashboard.
  * **Core Data**: Contains your settings, watch history, and rules.
  * **Images**: Contains your manually captured high-quality covers. If there are too many images, the system intelligently chunks and packs them into `images_part_X.json` to prevent crashes.
* **Import JSON**: Click "📤 Import JSON" to open the backup center page, then drag and drop the downloaded ZIP archive to perfectly restore all states.
