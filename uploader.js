// --- 1. CONFIG & DEFAULTS ---
// We need these defaults just in case storage is empty/corrupt
const DEFAULT_DATA = [
    {
      id: 'defaults', name: 'Firefox Defaults', type: 'system',
      themes: [] 
    },
    { id: 'creations-1', name: 'My Creations', type: 'colors_only', themes: [] },
    { id: 'gallery-1', name: 'Gallery', type: 'images_only', themes: [] }
];
  
let themeData = [];
  
// --- 2. STORAGE & LOGIC ---

async function init() {
    const input = document.getElementById('uploader-input');
    const status = document.getElementById('status');

    // Load existing data
    if (typeof browser !== 'undefined' && browser.storage) {
        try {
            const result = await browser.storage.local.get(['savedThemeData']);
            if (result.savedThemeData && result.savedThemeData.length > 0) {
                themeData = result.savedThemeData;
            } else {
                themeData = JSON.parse(JSON.stringify(DEFAULT_DATA));
            }
        } catch (e) {
            console.error(e);
            themeData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }
    }

    // Input Listener
    input.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        status.textContent = "Compressing & Saving...";
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Compression Logic
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const MAX_WIDTH = 1920;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                // Add to Data
                addToGallery(compressedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function addToGallery(dataUrl) {
    // 1. Find or Create Gallery Group
    let targetGroup = themeData.find(g => g.type === 'images_only' && g.themes.length < 6);
    
    // If first gallery is full, find the next one or create one
    if (!targetGroup) targetGroup = themeData.find(g => g.type === 'images_only'); // fallback
    if (!targetGroup) {
        targetGroup = { id: 'gal-'+Date.now(), name: 'Gallery', type: 'images_only', themes: [] };
        themeData.push(targetGroup);
    }

    // 2. Add Theme
    const dateName = "Img " + new Date().toLocaleTimeString();
    const newTheme = {
        name: dateName,
        type: 'image',
        data: dataUrl,
        preview: `url(${dataUrl}) center/cover`
    };
    targetGroup.themes.push(newTheme);

    // 3. Enforce Limits (Split groups if > 6)
    enforceGroupLimits();

    // 4. Save & Apply
    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.set({ savedThemeData: themeData }).then(() => {
            // Apply theme immediately
            browser.theme.update({
                images: { theme_frame: dataUrl },
                colors: {
                    frame: '#ffffff',
                    tab_background_text: '#000',
                    toolbar: 'rgba(255,255,255,0.5)',
                    textcolor: '#000'
                }
            });
            
            // DONE
            setTimeout(() => {
                window.close(); // Auto-close tab
            }, 500);
        });
    }
}

function enforceGroupLimits() {
    const MAX_THEMES = 6;
    
    for (let i = 0; i < themeData.length; i++) {
        let group = themeData[i];
        if (group.type === 'system') continue;

        if (group.themes.length > MAX_THEMES) {
            const excess = group.themes.splice(MAX_THEMES);
            let nextGroup = themeData[i + 1];
            
            if (nextGroup && nextGroup.name.startsWith(group.name.split(' ')[0]) && nextGroup.type === group.type) {
                nextGroup.themes = [...excess, ...nextGroup.themes];
            } else {
                let baseName = group.name.replace(/ \d+$/, ''); 
                const newGroup = { 
                    id: 'auto-' + Date.now(), 
                    name: baseName + " " + (i + 2), 
                    type: group.type, 
                    themes: excess 
                };
                themeData.splice(i + 1, 0, newGroup);
            }
        }
    }
}

init();