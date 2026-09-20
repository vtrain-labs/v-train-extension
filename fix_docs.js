const fs = require('fs');

function appendToMD(filePath, contentToAppend) {
    let content = fs.readFileSync(filePath, 'utf8');
    // find "## 十、隱私約定區" or "## 九、隱私設定區" or "## 9. Privacy Settings Area"
    // we will insert the passcode section right before it.
    if (content.includes('## 九、隱私')) {
        content = content.replace('## 九、隱私', contentToAppend + '\n\n## 九、隱私');
    } else if (content.includes('## 9. Privacy')) {
        content = content.replace('## 9. Privacy', contentToAppend + '\n\n## 9. Privacy');
    } else {
        content += '\n\n' + contentToAppend;
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

let twPasscode = `### 🔒 設定密碼 (Passcode)

點擊「**🔒 設定密碼(Setup Passcode)**」按鈕，輸入您想要的密碼（可以是任意字元，例如數字組合 \`1234\`）。

設定完成後，每次點擊 VT 擴充圖示開啟面板時，都需要輸入密碼才能看到內容。這保障了您的隱私！

::: danger ⚠️ 密碼遺失警告
為了確保最高層級的隱私安全，V-Train **不提供**任何找回密碼的後門。
如果您忘記了設定的密碼，您唯一的解決辦法是點擊密碼鎖畫面下方的「**忘記密碼？(將清除所有資料)**」。這將會把您的**所有觀看紀錄與書籤全數銷毀**並重置擴充功能。請務必牢記您的密碼！
:::`;

let enPasscode = `### 🔒 Setup Passcode

Click "**🔒 Setup Passcode**". Type a password (like \`1234\`).

Now, you must enter this password every time you open the Dashboard. This protects your privacy!

::: danger ⚠️ Forgotten Passcode Warning
To ensure the highest level of privacy, V-Train **does not** provide any backdoors to recover a forgotten passcode.
If you forget your passcode, your only option is to click "**Forgot Passcode? (Wipe all data)**" on the lock screen. This will **permanently delete all your viewing records and bookmarks** and factory reset the extension. Please use caution and remember your passcode!
:::`;

appendToMD('docs/guide/dashboard.md', twPasscode);
appendToMD('docs/en/guide/dashboard.md', enPasscode);
