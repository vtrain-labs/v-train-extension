document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup UI elements
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const logBox = document.getElementById('logBox');
    const spinner = document.getElementById('spinner');
    const btnClose = document.getElementById('btnClose');
    const fileInput = document.getElementById('fileInput');
    const btnSelectFile = document.getElementById('btnSelectFile');
    const progressBg = document.getElementById('progressBg');

    // Parse URL params first to get language
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const langParam = urlParams.get('lang');

    const currentLang = langParam || (globalThis.detectLanguage ? globalThis.detectLanguage() : 'en');

    function getLocalText(key, params) {
        if (globalThis.getLangText) {
            return globalThis.getLangText(currentLang, key, params);
        }
        return key;
    }

    document.title = getLocalText('backupCenterTitle') || "V-Train Backup Center";
    document.querySelector('.header').textContent = "📦 " + (getLocalText('backupCenterTitle') || "Backup & Restore Center");
    document.getElementById('uiDesc').textContent = getLocalText('backupCenterDesc') || "Please wait while the operation completes. Do not close this tab.";
    btnClose.textContent = getLocalText('closeTab') || "Close Tab";

    function log(msg) {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logBox.appendChild(div);
        logBox.scrollTop = logBox.scrollHeight;
    }

    btnClose.addEventListener('click', () => window.close());

    // URL params already parsed above

    if (action === 'export') {
        const exportCore = urlParams.get('core') === 'true';
        const exportImages = urlParams.get('images') === 'true';
        if (!exportCore && !exportImages) {
            log("No data selected for export.");
            statusText.textContent = "Error";
            spinner.classList.add('hidden');
        } else {
            statusText.textContent = "Initializing... Please wait";
            requestAnimationFrame(() => {
                setTimeout(async () => {
                    await performExport(exportCore, exportImages);
                }, 300);
            });
        }
    } else if (action === 'import') {
        statusText.textContent = getLocalText('statusSelectFile') || "Please select a backup file to import";
        spinner.classList.add('hidden');
        progressBg.classList.add('hidden');
        btnSelectFile.classList.remove('hidden');
        btnSelectFile.textContent = "📂 " + (getLocalText('btnSelectFile') || "Select Backup File");
        
        btnSelectFile.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle cancel
        document.body.onfocus = () => {
            setTimeout(() => {
                if(fileInput.files.length === 0) {
                    log("File selection cancelled.");
                    spinner.classList.add('hidden');
                    statusText.textContent = "Operation Cancelled";
                    btnClose.style.display = "inline-block";
                }
                document.body.onfocus = null;
            }, 500);
        };
    } else {
        log("No valid action specified.");
        statusText.textContent = "Error";
        spinner.classList.add('hidden');
    }

    fileInput.addEventListener('change', async (e) => {
        document.body.onfocus = null;
        const file = e.target.files[0];
        if (!file) return;
        
        btnSelectFile.classList.add('hidden');
        progressBg.classList.remove('hidden');
        statusText.textContent = getLocalText('initializing') || "Initializing... Please wait";
        spinner.classList.remove('hidden');
        
        requestAnimationFrame(() => {
            setTimeout(async () => {
                await performImport(file);
            }, 300);
        });
    });

    async function performExport(exportCore, exportImages) {
        try {
            log("Starting ZIP backup process...");
            const zip = new JSZip();
            
            // Core Data
            if (exportCore) {
                log("Fetching Core Data...");
                statusText.textContent = getLocalText('exporting') || "Exporting Core Data...";
                progressBar.style.width = "10%";
                
                const sysKeys = ['isStealthMode', 'enabledSites', 'userLang', 'site_config', 'showMonitorPanel', 'barColor', 'vt_video_count'];
                const sysData = await new Promise(r => chrome.storage.local.get(sysKeys, r));
                
                let chunks = ["{"];
                let isFirst = true;

                for (const k of sysKeys) {
                    if (sysData[k] !== undefined) {
                        chunks.push(`${isFirst ? "" : ","}${JSON.stringify(k)}:${JSON.stringify(sysData[k])}`);
                        isFirst = false;
                    }
                }

                // Export Bookmarks
                const bookmarks = await window.vtDB.getAll('vt_bookmarks');
                if (bookmarks.length > 0) {
                    const cleanedBookmarks = [];
                    const migrationReqs = [];
                    for (const bm of bookmarks) {
                        const cleanBm = { ...bm };
                        if (cleanBm.ogImg && cleanBm.ogImg.startsWith('data:image')) {
                            migrationReqs.push(window.vtDB.put('vt_thumbnails', { videoId: cleanBm.videoId, thumbnail: cleanBm.ogImg }).catch(()=>{}));
                            cleanBm.ogImg = ""; 
                            migrationReqs.push(window.vtDB.put('vt_bookmarks', cleanBm));
                        }
                        cleanedBookmarks.push(cleanBm);
                    }
                    if (migrationReqs.length > 0) {
                        log("Migrating legacy Base64 images from bookmarks...");
                        await Promise.all(migrationReqs);
                    }
                    chunks.push(`${isFirst ? "" : ","}${JSON.stringify('vt_bookmarks')}:${JSON.stringify(cleanedBookmarks)}`);
                    isFirst = false;
                }
                // Export Ratings
                const ratings = await window.vtDB.getAll('vt_ratings');
                if (ratings.length > 0) {
                    const ratingsObj = {};
                    ratings.forEach(r => ratingsObj[r.videoId] = r.rating);
                    chunks.push(`${isFirst ? "" : ","}${JSON.stringify('vt_ratings')}:${JSON.stringify(ratingsObj)}`);
                    isFirst = false;
                }
                // Export Folders
                const folders = await window.vtDB.getAll('vt_bm_folders');
                if (folders.length > 0) {
                    chunks.push(`${isFirst ? "" : ","}${JSON.stringify('vt_bm_folders')}:${JSON.stringify(folders)}`);
                    isFirst = false;
                }
                // Export Records
                const records = await window.vtDB.getAllRecords();
                for (const item of records) {
                    const k = item.id;
                    const val = { ...item };
                    delete val.id;
                    chunks.push(`${isFirst ? "" : ","}${JSON.stringify(k)}:${JSON.stringify(val)}`);
                    isFirst = false;
                }
                chunks.push("}");
                
                const coreBlob = new Blob(chunks, { type: "application/json" });
                zip.file("core_data.json", coreBlob);
                log("Core Data added to ZIP archive.");
                progressBar.style.width = "30%";
            }

            // Images
            if (exportImages) {
                log("Fetching Images from database...");
                statusText.textContent = getLocalText('fetchingImages') || "Fetching Images...";
                const thumbnails = await window.vtDB.getAll('vt_thumbnails');
                log(`Found ${thumbnails.length} images.`);
                
                if (thumbnails.length > 0) {
                    const CHUNK_SIZE = 1000;
                    const totalChunks = Math.ceil(thumbnails.length / CHUNK_SIZE);
                    
                    for (let i = 0; i < totalChunks; i++) {
                        statusText.textContent = getLocalText('msgExportImagesPart', { part: `${i + 1}/${totalChunks}` }) || `Packaging Images Part ${i + 1}/${totalChunks}...`;
                        let progress = 30 + Math.floor((i / totalChunks) * 50);
                        progressBar.style.width = `${progress}%`;
                        
                        let chunksStr = ["{"];
                        let isFirst = true;
                        chunksStr.push(`${JSON.stringify('vt_backup_type')}:${JSON.stringify('images')}`);
                        isFirst = false;
                        
                        const start = i * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, thumbnails.length);
                        const slice = thumbnails.slice(start, end);
                        
                        chunksStr.push(`${isFirst ? "" : ","}${JSON.stringify('vt_thumbnails')}:${JSON.stringify(slice)}`);
                        chunksStr.push("}");
                        
                        const imgBlob = new Blob(chunksStr, { type: "application/json" });
                        zip.file(`images_part_${i + 1}.json`, imgBlob);
                        log(`Added images_part_${i+1}.json to ZIP.`);
                        
                        // Yield to UI thread so progress bar updates
                        await new Promise(r => setTimeout(r, 15));
                    }
                } else if (!exportCore) {
                    log("No images found to export.");
                    statusText.textContent = getLocalText('noImagesFound') || "No images found";
                    spinner.classList.add('hidden');
                    btnClose.style.display = "inline-block";
                    return;
                }
            }
            
            // Generate ZIP
            log("Compressing files into ZIP... This may take a moment.");
            statusText.textContent = getLocalText('compressingZip') || "Compressing ZIP file...";
            progressBar.style.width = "85%";
            
            const zipBlob = await zip.generateAsync({
                type: "blob", 
                compression: "DEFLATE",
                compressionOptions: { level: 6 } 
            }, function updateCallback(metadata) {
                if(metadata.percent) {
                    progressBar.style.width = `${85 + (metadata.percent / 100 * 15)}%`;
                }
            });

            log("ZIP generation complete. Triggering download.");
            statusText.style.display = "none";
            progressBar.style.width = "100%";
            spinner.classList.add('hidden');
            btnClose.style.display = "inline-block";

            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VTrain_Backup_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 60000);

        } catch (e) {
            console.error(e);
            log(`Error: ${e.message}`);
            statusText.textContent = "Export Failed";
            spinner.classList.add('hidden');
            btnClose.style.display = "inline-block";
        }
    }

    async function performImport(file) {
        try {
            log(`Starting import process for ${file.name}...`);
            spinner.classList.remove('hidden');
            statusText.textContent = getLocalText('readingFile') || "Reading file...";
            progressBar.style.width = "10%";

            if (file.name.endsWith('.zip')) {
                log("Extracting ZIP archive...");
                const zip = await JSZip.loadAsync(file);
                const files = Object.keys(zip.files);
                log(`Found ${files.length} files in ZIP.`);

                // Process core_data.json first
                if (zip.files['core_data.json']) {
                    log("Importing Core Data...");
                    statusText.textContent = getLocalText('importProgress', {percent: 20}) || "Importing Core Data...";
                    const coreContent = await zip.files['core_data.json'].async('string');
                    await importJsonString(coreContent);
                    log("Core Data imported successfully.");
                }

                // Process image chunks
                const imageFiles = files.filter(f => f.startsWith('images_part_') && f.endsWith('.json'));
                for (let i = 0; i < imageFiles.length; i++) {
                    const f = imageFiles[i];
                    log(`Importing ${f}...`);
                    let pct = 20 + Math.floor(((i+1)/imageFiles.length) * 80);
                    statusText.textContent = getLocalText('importingFile', {current: i+1, total: imageFiles.length}) || `Importing Images (${i+1}/${imageFiles.length})...`;
                    progressBar.style.width = `${pct}%`;
                    
                    const imgContent = await zip.files[f].async('string');
                    await importJsonString(imgContent);
                    log(`${f} imported successfully.`);
                }

            } else if (file.name.endsWith('.json')) {
                log("Importing Legacy JSON file...");
                const content = await file.text();
                await importJsonString(content);
            } else {
                throw new Error("Unsupported file format. Please upload a .zip or .json file.");
            }

            statusText.textContent = getLocalText('msgSaved') || "Import Complete!";
            progressBar.style.width = "100%";
            spinner.classList.add('hidden');
            btnClose.style.display = "inline-block";
            log("Import process completed. You can now close this tab.");

        } catch (e) {
            console.error(e);
            log(`Error: ${e.message}`);
            statusText.textContent = "Import Failed";
            spinner.classList.add('hidden');
            btnClose.style.display = "inline-block";
        }
    }

    async function importJsonString(jsonString) {
        const data = JSON.parse(jsonString);
        
        if (data.vt_backup_type === 'images') {
            if (data.vt_thumbnails) {
                const thumbs = data.vt_thumbnails;
                const THUMB_BATCH_SIZE = 100;
                for (let j = 0; j < thumbs.length; j += THUMB_BATCH_SIZE) {
                    const batch = thumbs.slice(j, j + THUMB_BATCH_SIZE);
                    await Promise.all(batch.map(t => window.vtDB.put('vt_thumbnails', t)));
                }
            }
        } else {
            // Core data import
            const sysKeys = ['isStealthMode', 'enabledSites', 'userLang', 'site_config', 'showMonitorPanel', 'barColor', 'vt_video_count'];
            const sysDataToSave = {};
            for (const k of sysKeys) {
                if (data[k] !== undefined) sysDataToSave[k] = data[k];
            }
            if (Object.keys(sysDataToSave).length > 0) {
                await new Promise(r => chrome.storage.local.set(sysDataToSave, r));
            }

            if (data.vt_bookmarks) {
                const bmReqs = [];
                for (const bm of data.vt_bookmarks) {
                    if (bm.ogImg && bm.ogImg.startsWith('data:image')) {
                        bmReqs.push(window.vtDB.put('vt_thumbnails', { videoId: bm.videoId, thumbnail: bm.ogImg }).catch(()=>{}));
                        bm.ogImg = "";
                    }
                    bmReqs.push(window.vtDB.put('vt_bookmarks', bm));
                }
                await Promise.all(bmReqs);
            }
            if (data.vt_ratings) {
                await window.vtDB.clear('vt_ratings');
                const reqs = [];
                for (const [vid, rate] of Object.entries(data.vt_ratings)) {
                    reqs.push(window.vtDB.put('vt_ratings', { videoId: vid, rating: rate, lastUpdated: Date.now() }));
                }
                await Promise.all(reqs);
            }
            if (data.vt_bm_folders) {
                await Promise.all(data.vt_bm_folders.map(f => window.vtDB.put('vt_bm_folders', f)));
            }

            // Restore records
            for (const key of Object.keys(data)) {
                if (!sysKeys.includes(key) && !key.startsWith('vt_')) {
                    await window.vtDB.putRecord(key, data[key]);
                }
            }
        }
    }

});
