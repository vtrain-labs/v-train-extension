# 5. 備份與還原中心

因為 V-Train 採用 **「零伺服器架構」**，您的所有數據都只存在您的電腦中。為了避免瀏覽器重裝導致資料遺失，請務必定期備份。

> ![備份與還原中心](/assets/manual/backup_center_main.png)

* **匯出 (Export JSON)**：在控制面板點擊「📥 Export JSON」。
  * **Core Data (核心資料)**：包含您的設定、觀看紀錄、規則。
  * **Images (圖片庫)**：包含您手動截圖的高畫質封面。若圖片極多，系統會智能分塊打包成 `images_part_X.json` 確保不當機。
* **匯入 (Import JSON)**：點擊「📤 Import JSON」開啟備份中心頁面，將下載的 ZIP 壓縮檔拖曳放入即可完美還原所有狀態。
