// ==============================================
//  GROUPMATIC - Theme Management Extension for Firefox
// ==============================================


// --------------------------------------------------------------
// 1. CONSTANTS & CONFIG
// --------------------------------------------------------------
    
const BUILTIN_IDS = {
    DEFAULT: 'default-theme@mozilla.org',
    LIGHT: 'firefox-compact-light@mozilla.org',
    DARK: 'firefox-compact-dark@mozilla.org',
    ALPENGLOW: 'firefox-alpenglow@mozilla.org'
};
const MAX_THEMES_PER_GROUP = 6;

const DEFAULTS_GROUP = {
    id: 'defaults', name: 'Firefox Defaults', type: 'system',
    themes: [
        { name: 'System Default', type: 'builtin', id: BUILTIN_IDS.DEFAULT, preview: '#ffffff' },
        { name: 'Alpenglow', type: 'builtin', id: BUILTIN_IDS.ALPENGLOW, preview: 'linear-gradient(to right, #9059FF, #FF4AA2, #FFBD4F)' },
        { name: 'Dark', type: 'builtin', id: BUILTIN_IDS.DARK, preview: '#1c1b22' },
        { name: 'Light', type: 'builtin', id: BUILTIN_IDS.LIGHT, preview: '#e0e0e6' }
    ]
};

// --- GLOBAL STATE ---
let themeData = [];
let rotationList = []; 
let isSelectionMode = false; 
let rotationInterval = 30; 
let managingGroupId = null; 

// --- LIFT AND STICK STATE ---
let liftState = null; 
let hoveredTarget = null; 

const listContainer = document.getElementById('group-list');
const contextMenu = document.getElementById('context-menu');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const rotateToggle = document.getElementById('rotate-toggle');

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    let userGroups = [];
    let addonOrder = [];
    
    try {
        const storage = await browser.storage.local.get(['savedThemeData', 'isDarkMode', 'rotationList', 'isRotationActive', 'rotationInterval', 'addonOrder']);
        
        if (storage.isDarkMode) {
            document.body.setAttribute('data-theme', 'dark');
            darkModeToggle.classList.add('active');
        }
        if (storage.rotationList) rotationList = storage.rotationList;
        if (storage.rotationInterval) rotationInterval = storage.rotationInterval;
        if (storage.addonOrder) addonOrder = storage.addonOrder;
        
        if (storage.isRotationActive) {
            rotateToggle.classList.add('active');
            rotateToggle.title = `Stop Rotation (${rotationInterval}m)`;
        } else {
            rotateToggle.classList.remove('active');
            rotateToggle.title = "Configure Rotation";
        }

        if (storage.savedThemeData) {
            userGroups = storage.savedThemeData.filter(g => g.type !== 'system');
        }
    } catch (e) { console.error(e); }

    if (!userGroups.find(g => g.type === 'colors_only')) {
        userGroups.unshift({ id: 'creations-1', name: 'My Creations', type: 'colors_only', themes: [] });
    }
    if (!userGroups.find(g => g.type === 'images_only')) {
        userGroups.push({ id: 'gallery-1', name: 'Gallery', type: 'images_only', themes: [] });
    }

    let installedGroup = { id: 'firefox-store', name: 'Browser Themes', type: 'system', themes: [] };
    if (browser.management && browser.management.getAll) {
        try {
            const allExt = await browser.management.getAll();
            const builtInValues = Object.values(BUILTIN_IDS);
            
            installedGroup.themes = allExt
                .filter(ext => ext.type === 'theme' && !builtInValues.includes(ext.id))
                .map(t => ({
                    name: t.name, type: 'addon', id: t.id,
                    preview: (t.icons && t.icons.length > 0) ? `url(${t.icons[t.icons.length-1].url}) center/cover` : '#aaaaaa'
                }));

            if (addonOrder.length > 0) {
                installedGroup.themes.sort((a, b) => {
                    let indexA = addonOrder.indexOf(a.id);
                    let indexB = addonOrder.indexOf(b.id);
                    if (indexA === -1) indexA = 9999;
                    if (indexB === -1) indexB = 9999;
                    return indexA - indexB;
                });
            }
        } catch (e) {}
    }

    themeData = [DEFAULTS_GROUP, installedGroup, ...userGroups];
    enforceGroupLimits();
    renderGroups();
}

// --- RENDER ---
function renderGroups() {
    const currentHeight = document.body.offsetHeight;
    if (currentHeight > 0) document.body.style.minHeight = currentHeight + 'px';

    listContainer.innerHTML = '';
    
    themeData.forEach((group, index) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group-item';
        if (managingGroupId === group.id) groupEl.classList.add('managing');
        
        // Group Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-name';
        nameSpan.style.display = 'flex';
        nameSpan.style.alignItems = 'center';

        const textNode = document.createElement('span');
        textNode.style.whiteSpace = 'nowrap';
        textNode.style.overflow = 'hidden';
        textNode.style.textOverflow = 'ellipsis';
        textNode.textContent = group.name;
        nameSpan.appendChild(textNode);
        groupEl.appendChild(nameSpan);

        // Controls Container
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'group-controls';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.alignItems = 'center';
        controlsDiv.style.gap = '2px';

        // 1. Rename Button
        if (group.type !== 'system') {
            const renameBtn = document.createElement('div');
            renameBtn.className = 'rename-group-btn';
            renameBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
            renameBtn.title = "Rename Group";
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                if (liftState) return;
                const newName = prompt("Enter new name for group:", group.name);
                if (newName && newName.trim() !== "") {
                    const idx = themeData.findIndex(g => g.id === group.id);
                    if (idx > -1) {
                        themeData[idx].name = newName.trim();
                        saveUserGroups();
                        renderGroups();
                    }
                }
            };
            controlsDiv.appendChild(renameBtn);
        }

        // 2. Manage (Gear) Button
        if (group.id !== 'defaults') {
            const manageBtn = document.createElement('div');
            manageBtn.className = 'manage-group-btn';
            manageBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
            manageBtn.title = "Manage Group";
            manageBtn.onclick = (e) => {
                e.stopPropagation();
                if (liftState) { cancelLift(); return; }
                managingGroupId = (managingGroupId === group.id) ? null : group.id;
                renderGroups();
            };
            controlsDiv.appendChild(manageBtn);
        }

        // 3. Add (+) Button
        const addBtn = document.createElement('div');
        addBtn.className = 'add-theme-btn';
        addBtn.textContent = '+';
        if(group.type === 'colors_only') addBtn.title = "Add Hex Color";
        else if(group.type === 'images_only') addBtn.title = "Upload Image";
        else if(group.name === 'Browser Themes') addBtn.title = "Open Theme Store";
        else addBtn.style.display = 'none';

        addBtn.onclick = (e) => {
            e.stopPropagation();
            if(isSelectionMode || managingGroupId || liftState) return;
            if (group.id === 'firefox-store') {
                browser.tabs.create({ url: "https://addons.mozilla.org/firefox/themes/" });
            } else {
                handleGroupSpecificAdd(group);
            }
        };
        controlsDiv.appendChild(addBtn);

        // 4. Group Hamburger Handle
        if (group.id !== 'defaults') {
            const groupHandle = document.createElement('div');
            groupHandle.className = 'drag-handle';
            groupHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`;
            groupHandle.onclick = (e) => {
                e.stopPropagation();
                if (liftState) { cancelLift(); return; }
                startLift('group', index, null, e, group.name);
            };
            controlsDiv.appendChild(groupHandle);
        }

        groupEl.appendChild(controlsDiv);

        // Auto-Scroll Hover Logic
        groupEl.addEventListener('mouseenter', () => {
            if (liftState && liftState.type === 'group') {
                hoveredTarget = { type: 'group', groupIndex: index };
                groupEl.classList.add('drop-target-group');
            }
            if (!liftState) {
                setTimeout(() => {
                    const menu = groupEl.querySelector('.theme-nested-menu');
                    if (menu) {
                        const rect = menu.getBoundingClientRect();
                        if (rect.bottom > window.innerHeight) {
                            groupEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                    }
                }, 50); 
            }
        });
        groupEl.addEventListener('mouseleave', () => {
            groupEl.classList.remove('drop-target-group');
            if (liftState && liftState.type === 'group') hoveredTarget = null;
        });
        groupEl.addEventListener('click', (e) => {
            if (liftState) {
                e.stopPropagation();
                e.preventDefault();
                if (liftState.type === 'group') setTimeout(executeLiftDrop, 10);
                else setTimeout(cancelLift, 10);
            }
        });

        // List
        const nestedMenu = document.createElement('div');
        nestedMenu.className = 'theme-nested-menu';
        
        if (managingGroupId === group.id) {
            nestedMenu.style.display = 'block';
        }
        
        if (group.themes.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'theme-option';
            empty.style.color = 'var(--text-secondary)';
            empty.textContent = 'Empty';

            empty.addEventListener('mouseenter', () => {
                if (liftState && liftState.type === 'theme') {
                    hoveredTarget = { type: 'theme', groupIndex: index, themeIndex: null };
                    empty.style.background = 'rgba(0, 96, 223, 0.1)';
                }
            });
            empty.addEventListener('mouseleave', () => {
                empty.style.background = 'transparent';
                if (liftState && liftState.type === 'theme') hoveredTarget = null;
            });
            empty.addEventListener('click', (e) => {
                if (liftState) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (liftState.type === 'theme') setTimeout(executeLiftDrop, 10);
                    else setTimeout(cancelLift, 10);
                }
            });
            
            nestedMenu.appendChild(empty);
        } else {
            group.themes.forEach((theme, tIndex) => {
                const themeEl = document.createElement('div');
                themeEl.className = 'theme-option';
                
                if (isThemeSelected(theme)) {
                    if (isSelectionMode) themeEl.classList.add('selected'); 
                    themeEl.classList.add('in-rotation'); 
                }

                const swatch = document.createElement('span');
                swatch.className = 'swatch';
                swatch.style.background = theme.preview; 
                themeEl.appendChild(swatch);
                
                const textSpan = document.createElement('span');
                textSpan.textContent = theme.name;
                textSpan.style.flexGrow = '1';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.marginRight = '4px';
                themeEl.appendChild(textSpan);
                
                const badge = document.createElement('div');
                badge.className = 'rotation-badge';
                themeEl.appendChild(badge);

                const themeControlsDiv = document.createElement('div');
                themeControlsDiv.style.display = 'flex';
                themeControlsDiv.style.alignItems = 'center';
                themeControlsDiv.style.gap = '2px';

                // THEME DELETE BTN ('X')
                const delBtn = document.createElement('div');
                delBtn.className = 'theme-delete-btn';
                delBtn.innerHTML = '×';
                delBtn.style.zIndex = '10'; 
                delBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    if (liftState) { cancelLift(); return; }
                    
                    performDelete(group, theme);
                };
                themeControlsDiv.appendChild(delBtn);

                // Theme Hamburger Handle
                if (managingGroupId === group.id && group.id !== 'defaults') {
                    const dragHandle = document.createElement('div');
                    dragHandle.className = 'drag-handle';
                    dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`;
                    
                    dragHandle.onclick = (e) => {
                        e.stopPropagation();
                        if (liftState) { cancelLift(); return; }
                        startLift('theme', index, tIndex, e, theme.name);
                    };
                    themeControlsDiv.appendChild(dragHandle);
                }

                themeEl.appendChild(themeControlsDiv);

                themeEl.addEventListener('mouseenter', () => {
                    if (liftState && liftState.type === 'theme') {
                        hoveredTarget = { type: 'theme', groupIndex: index, themeIndex: tIndex };
                        themeEl.classList.add('drop-target');
                    }
                });
                themeEl.addEventListener('mouseleave', () => {
                    themeEl.classList.remove('drop-target');
                    if (liftState && liftState.type === 'theme') hoveredTarget = null;
                });

                themeEl.onclick = (e) => {
                    if (liftState) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (liftState.type === 'theme') setTimeout(executeLiftDrop, 10);
                        else setTimeout(cancelLift, 10);
                    } else if (!managingGroupId) {
                        if (isSelectionMode) toggleThemeInRotation(theme);
                        else applyTheme(theme);
                    }
                };
                
                themeEl.addEventListener('contextmenu', (e) => {
                    if (managingGroupId || liftState) return;
                    e.preventDefault();
                    showThemeContextMenu(e, group, theme);
                });

                nestedMenu.appendChild(themeEl);
            });
        }
        groupEl.appendChild(nestedMenu);

        if (group.type !== 'system') {
            groupEl.addEventListener('contextmenu', (e) => {
                if (managingGroupId || liftState) return;
                showGroupContextMenu(e, group.id);
            });
        }
        listContainer.appendChild(groupEl);
    });

    requestAnimationFrame(() => {
        document.body.style.minHeight = '';
    });
}

// --- LIFT AND STICK API ---

function startLift(type, gIndex, tIndex, e, name) {
    cancelLift(); 
    
    const ghost = document.createElement('div');
    ghost.className = 'lift-ghost';
    ghost.textContent = "Placing: " + name;
    document.body.appendChild(ghost);
    
    ghost.style.left = e.pageX + 15 + 'px';
    ghost.style.top = e.pageY + 15 + 'px';

    liftState = { type, gIndex, tIndex, ghost };
    document.body.classList.add('is-lifting');
}

function cancelLift() {
    if (liftState) {
        liftState.ghost.remove();
        liftState = null;
    }
    hoveredTarget = null;
    document.body.classList.remove('is-lifting');
    document.querySelectorAll('.drop-target, .drop-target-group').forEach(el => {
        el.classList.remove('drop-target', 'drop-target-group');
    });
}

document.addEventListener('mousemove', (e) => {
    if (liftState) {
        liftState.ghost.style.left = e.pageX + 15 + 'px';
        liftState.ghost.style.top = e.pageY + 15 + 'px';
    }
});

document.addEventListener('click', () => {
    if (liftState) setTimeout(cancelLift, 10);
});

function executeLiftDrop() {
    if (!liftState || !hoveredTarget) return;

    const state = { ...liftState };
    const target = { ...hoveredTarget };
    cancelLift(); 

    if (state.type === 'group') {
        const src = state.gIndex;
        const tgt = target.groupIndex;
        
        if (themeData[tgt].id === 'defaults') {
            alert("Cannot move above defaults.");
            return;
        }
        
        if (src !== tgt) {
            const item = themeData.splice(src, 1)[0];
            themeData.splice(tgt, 0, item);
        }
    } 
    else if (state.type === 'theme') {
        const srcG = themeData[state.gIndex];
        const tgtG = themeData[target.groupIndex];
        
        if (srcG.type !== tgtG.type) {
            alert("Cannot mix different types of themes in the same group.");
            return;
        }
        
        const item = srcG.themes.splice(state.tIndex, 1)[0];
        
        if (target.themeIndex === null) {
            tgtG.themes.push(item);
        } else {
            let adjustedTargetIndex = target.themeIndex;
            if (state.gIndex === target.groupIndex && state.tIndex < target.themeIndex) {
                adjustedTargetIndex--;
            }
            tgtG.themes.splice(adjustedTargetIndex, 0, item);
        }
    }
    
    enforceGroupLimits();
    saveUserGroups();
    renderGroups();
}

// --- DELETE LOGIC ---
function performDelete(group, theme) {
    if (theme.type === 'addon') {
        // ROUTES TO SPECIFIC THEME UNINSTALL TAB
        browser.tabs.create({ 
            url: browser.runtime.getURL(`uninstall.html?id=${encodeURIComponent(theme.id)}&name=${encodeURIComponent(theme.name)}`)
        });
        window.close(); 
    } else {
        const idx = group.themes.indexOf(theme);
        if (idx > -1) {
            group.themes.splice(idx, 1);
            const rotIdx = rotationList.findIndex(t => t.name === theme.name && t.type === theme.type);
            if (rotIdx > -1) {
                rotationList.splice(rotIdx, 1);
                browser.storage.local.set({ rotationList: rotationList });
            }
            saveUserGroups();
            enforceGroupLimits(); 
            renderGroups();
        }
    }
}

// --- ROTATION ---
rotateToggle.onclick = async () => {
    managingGroupId = null;
    if (isSelectionMode) {
        isSelectionMode = false;
        document.body.classList.remove('selection-mode');
        const shouldRun = rotationList.length > 1;
        if (shouldRun) {
            const input = prompt("Rotate every X minutes:", rotationInterval);
            let duration = parseInt(input);
            if (isNaN(duration) || duration < 1) duration = rotationInterval; 
            rotationInterval = duration;
            await browser.storage.local.set({ rotationList, isRotationActive: true, rotationInterval });
            rotateToggle.classList.add('active');
            rotateToggle.title = `Stop Rotation (${rotationInterval}m)`;
            browser.alarms.create('theme-rotation', { periodInMinutes: rotationInterval });
        } else {
            await browser.storage.local.set({ isRotationActive: false });
            browser.alarms.clear('theme-rotation');
            rotateToggle.classList.remove('active');
            rotateToggle.title = "Configure Rotation";
        }
        renderGroups();
        return;
    }
    const storage = await browser.storage.local.get('isRotationActive');
    if (storage.isRotationActive) {
        await browser.storage.local.set({ isRotationActive: false });
        browser.alarms.clear('theme-rotation');
        rotateToggle.classList.remove('active');
        rotateToggle.title = "Configure Rotation";
    } else {
        isSelectionMode = true;
        document.body.classList.add('selection-mode');
        rotateToggle.title = "Select themes then click again to Start";
        renderGroups();
    }
};

function toggleThemeInRotation(theme) {
    const index = rotationList.findIndex(t => t.name === theme.name && t.type === theme.type && (t.id === theme.id || t.color === theme.color));
    if (index === -1) rotationList.push(theme); else rotationList.splice(index, 1);
    renderGroups(); 
}

function isThemeSelected(theme) {
    return rotationList.some(t => t.name === theme.name && t.type === theme.type && (t.id === theme.id || t.color === theme.color));
}

// --- THEME APPLICATION ---
function applyTheme(theme) {
    const isUIInDarkMode = document.body.hasAttribute('data-theme');
    if (theme.type === 'builtin' || theme.type === 'addon') {
        if (browser.management) browser.management.setEnabled(theme.id, true);
    }
    else if (theme.type === 'image') {
        browser.theme.update({
            images: { theme_frame: theme.data },
            colors: {
                frame: isUIInDarkMode ? '#1c1b22' : '#ffffff',
                tab_background_text: isUIInDarkMode ? '#f9f9fb' : '#15141a',
                toolbar: isUIInDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)',
                textcolor: isUIInDarkMode ? '#f9f9fb' : '#15141a'
            }
        });
    }
    else if (theme.type === 'custom') {
        browser.theme.update({
            colors: {
                frame: theme.color,
                tab_background_text: isUIInDarkMode ? '#f9f9fb' : '#15141a',
                toolbar: theme.color,
                textcolor: isUIInDarkMode ? '#f9f9fb' : '#15141a',
                toolbar_text: isUIInDarkMode ? '#f9f9fb' : '#15141a'
            }
        });
    }
}

// --- UTILS ---
function enforceGroupLimits() {
    let changesMade = false;
    for (let i = 0; i < themeData.length; i++) {
        let group = themeData[i];
        if (group.id === 'defaults') continue;

        if (group.themes.length === 0 && group.id.startsWith('auto-')) {
            themeData.splice(i, 1);
            changesMade = true;
            i--; 
            continue;
        }

        if (group.themes.length > MAX_THEMES_PER_GROUP) {
            const excess = group.themes.splice(MAX_THEMES_PER_GROUP);
            let nextGroup = themeData[i + 1];
            let baseName = group.name.replace(/ \d+$/, ''); 
            if (nextGroup && nextGroup.name.startsWith(baseName) && nextGroup.type === group.type) {
                nextGroup.themes = [...excess, ...nextGroup.themes];
            } else {
                let currentNum = parseInt(group.name.match(/\d+$/)?.[0] || '1');
                const newGroup = { id: 'auto-' + Date.now(), name: baseName + " " + (currentNum + 1), type: group.type, themes: excess };
                themeData.splice(i + 1, 0, newGroup);
            }
            changesMade = true;
        }
    }
    if (changesMade) saveUserGroups();
}

function saveUserGroups() {
    const userGroupsOnly = themeData.filter(g => g.type !== 'system');
    const isDark = document.body.hasAttribute('data-theme');
    
    const addonGroups = themeData.filter(g => g.type === 'system' && g.id !== 'defaults');
    const addonOrder = addonGroups.map(g => g.themes.map(t => t.id)).flat();

    browser.storage.local.set({ 
        savedThemeData: userGroupsOnly, 
        isDarkMode: isDark,
        addonOrder: addonOrder 
    });
}

document.getElementById('store-btn').onclick = () => browser.tabs.create({ url: "https://addons.mozilla.org/firefox/themes/" });

document.getElementById('global-upload-btn').onclick = () => { 
    browser.tabs.create({ url: browser.runtime.getURL("uploader.html") }); 
    window.close(); 
};

darkModeToggle.onclick = () => {
    const isDark = document.body.hasAttribute('data-theme');
    if (isDark) { document.body.removeAttribute('data-theme'); darkModeToggle.classList.remove('active'); } 
    else { document.body.setAttribute('data-theme', 'dark'); darkModeToggle.classList.add('active'); }
    saveUserGroups();
};
document.getElementById('add-group-btn').onclick = () => {
    const name = prompt("New Collection Name:");
    if(name) { themeData.push({ id: 'g-'+Date.now(), name: name, type: 'colors_only', themes: [] }); saveUserGroups(); renderGroups(); }
};

let currentRightClickedGroupId = null;
function showGroupContextMenu(e, groupId) {
    e.stopPropagation();
    currentRightClickedGroupId = groupId;
    document.getElementById('ctx-rename').style.display = 'block';
    document.getElementById('ctx-delete').style.display = 'block';
    document.getElementById('ctx-uninstall').style.display = 'none';
    document.getElementById('ctx-manage-sys').style.display = 'none';
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.classList.remove('hidden');
}

document.getElementById('ctx-rename').onclick = () => {
    const g = themeData.find(x => x.id === currentRightClickedGroupId);
    if(g) { const n = prompt("Rename:", g.name); if(n) { g.name = n; saveUserGroups(); renderGroups(); } }
};

document.getElementById('ctx-delete').onclick = () => {
    if(confirm("Delete group?")) { themeData = themeData.filter(x => x.id !== currentRightClickedGroupId); saveUserGroups(); renderGroups(); }
};

function showThemeContextMenu(e, group, theme) {
    e.stopPropagation();
    document.getElementById('ctx-rename').style.display = 'none'; 
    document.getElementById('ctx-delete').style.display = 'none'; 
    if (theme.type === 'addon') {
        const uninstallBtn = document.getElementById('ctx-uninstall');
        const manageBtn = document.getElementById('ctx-manage-sys');
        
        uninstallBtn.style.display = 'block';
        manageBtn.style.display = 'none'; 
        
        uninstallBtn.onclick = () => {
            browser.tabs.create({ 
                url: browser.runtime.getURL(`uninstall.html?id=${encodeURIComponent(theme.id)}&name=${encodeURIComponent(theme.name)}`)
            });
            window.close();
        };
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');
    } 
}
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.classList.add('hidden');
});
// --- ADVANCED COLOR & GRADIENT LOGIC ---
let targetColorGroup = null;

function handleGroupSpecificAdd(group) {
    if (group.type === 'colors_only') {
        targetColorGroup = group;
        document.getElementById('color-name').value = '';
        
        if (typeof window.resetAdvancedColorModal === 'function') {
            window.resetAdvancedColorModal();
        }
        
        document.getElementById('color-modal').style.display = 'flex';
    } else if (group.type === 'images_only') {
        browser.tabs.create({ url: browser.runtime.getURL("uploader.html") }); 
        window.close(); 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. COLOR MODAL LOGIC
    // ==========================================
    const colorModal = document.getElementById('color-modal');
    
    if (colorModal) {
        let isGradient = false;
        let activeTarget = 1; 
        
        // Added 'luma' memory to track light/dark changes independently
        let colors = {
            1: { r: 0, g: 96, b: 223, hex: '#0060DF', baseR: 0, baseG: 96, baseB: 223, luma: 0 },
            2: { r: 128, g: 0, b: 255, hex: '#8000FF', baseR: 128, baseG: 0, baseB: 255, luma: 0 }
        };

        const tabSolid = document.getElementById('tab-solid');
        const tabGradient = document.getElementById('tab-gradient');
        const colorTargets = document.getElementById('color-targets');
        const targetC1 = document.getElementById('target-c1');
        const targetC2 = document.getElementById('target-c2');
        const labelC1 = document.getElementById('label-c1');
        const labelC2 = document.getElementById('label-c2');
        const sliderR = document.getElementById('slider-r');
        const sliderG = document.getElementById('slider-g');
        const sliderB = document.getElementById('slider-b');
        const sliderLuma = document.getElementById('slider-luma');
        const sliderAngle = document.getElementById('slider-angle');
        const rowAngle = document.getElementById('row-angle');
        const previewBox = document.getElementById('color-preview-box');

        // --- CORE MATH FUNCTIONS ---
        function rgbToHex(r, g, b) {
            return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
        }

        function rgbToHsl(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return { h, s, l };
        }

        function hslToRgb(h, s, l) {
            let r, g, b;
            if (s === 0) r = g = b = l; 
            else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        }

        function generateGradientPNG(color1, color2, angleDeg) {
            const canvas = document.createElement('canvas');
            canvas.width = 3000; 
            canvas.height = 200; 
            const ctx = canvas.getContext('2d');

            const angleRad = (angleDeg - 90) * Math.PI / 180;
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const length = Math.abs(canvas.width * Math.cos(angleRad)) + Math.abs(canvas.height * Math.sin(angleRad));
            
            const x1 = cx - Math.cos(angleRad) * length / 2;
            const y1 = cy - Math.sin(angleRad) * length / 2;
            const x2 = cx + Math.cos(angleRad) * length / 2;
            const y2 = cy + Math.sin(angleRad) * length / 2;

            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            return canvas.toDataURL('image/png');
        }

        function updatePreview() {
            if (isGradient) {
                const angle = sliderAngle.value;
                previewBox.style.background = `linear-gradient(${angle}deg, ${colors[1].hex}, ${colors[2].hex})`;
            } else {
                previewBox.style.background = colors[1].hex;
            }
        }

        // Moves the RGB base color. Does NOT touch the luma slider, except to reset it.
        window.updateColorFromSliders = function() {
            const r = parseInt(sliderR.value);
            const g = parseInt(sliderG.value);
            const b = parseInt(sliderB.value);
            
            // Set as the new base color
            colors[activeTarget].baseR = r;
            colors[activeTarget].baseG = g;
            colors[activeTarget].baseB = b;
            
            // Reset Luma modifier because they picked a new raw color
            sliderLuma.value = 0;
            colors[activeTarget].luma = 0;
            
            // Output is identical to base since luma is 0
            colors[activeTarget].r = r;
            colors[activeTarget].g = g;
            colors[activeTarget].b = b;
            colors[activeTarget].hex = rgbToHex(r, g, b);
            
            if (activeTarget === 1) labelC1.textContent = colors[1].hex;
            else labelC2.textContent = colors[2].hex;
            
            updatePreview();
        };

        // Changes light/dark. Does NOT touch the RGB sliders.
        window.updateBrightness = function() {
            const lumaVal = parseInt(sliderLuma.value);
            colors[activeTarget].luma = lumaVal; // Save the modifier
            
            const adjustment = lumaVal / 100; 
            const baseHsl = rgbToHsl(colors[activeTarget].baseR, colors[activeTarget].baseG, colors[activeTarget].baseB);
            
            let newL = Math.max(0, Math.min(1, baseHsl.l + adjustment));
            const newRgb = hslToRgb(baseHsl.h, baseHsl.s, newL);
            
            colors[activeTarget].r = newRgb.r;
            colors[activeTarget].g = newRgb.g;
            colors[activeTarget].b = newRgb.b;
            colors[activeTarget].hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
            
            if (activeTarget === 1) labelC1.textContent = colors[1].hex;
            else labelC2.textContent = colors[2].hex;
            
            updatePreview();
        };

        function loadTargetToSliders(targetNum) {
            activeTarget = targetNum;
            if (targetNum === 1) {
                targetC1.classList.add('active'); targetC2.classList.remove('active');
            } else {
                targetC2.classList.add('active'); targetC1.classList.remove('active');
            }
            
            // Load the Base Color into the RGB sliders so they stay put
            sliderR.value = colors[activeTarget].baseR;
            sliderG.value = colors[activeTarget].baseG;
            sliderB.value = colors[activeTarget].baseB;
            
            // Restore the Luma slider to whatever it was for this target
            sliderLuma.value = colors[activeTarget].luma; 
        }

        window.resetAdvancedColorModal = function() {
            isGradient = false;
            activeTarget = 1;
            colors = { 
                1: { r: 0, g: 96, b: 223, hex: '#0060DF', baseR: 0, baseG: 96, baseB: 223, luma: 0 }, 
                2: { r: 128, g: 0, b: 255, hex: '#8000FF', baseR: 128, baseG: 0, baseB: 255, luma: 0 }
            };
            
            tabSolid.classList.add('active'); tabGradient.classList.remove('active');
            colorTargets.style.display = 'none';
            rowAngle.style.display = 'none';
            sliderAngle.value = 90;
            
            labelC1.textContent = colors[1].hex; labelC2.textContent = colors[2].hex;
            loadTargetToSliders(1);
            updatePreview();
        };

        sliderR.addEventListener('input', window.updateColorFromSliders);
        sliderG.addEventListener('input', window.updateColorFromSliders);
        sliderB.addEventListener('input', window.updateColorFromSliders);
        sliderLuma.addEventListener('input', window.updateBrightness);
        sliderAngle.addEventListener('input', updatePreview);

        tabSolid.addEventListener('click', () => {
            isGradient = false;
            tabSolid.classList.add('active'); tabGradient.classList.remove('active');
            colorTargets.style.display = 'none'; rowAngle.style.display = 'none';
            loadTargetToSliders(1);
            updatePreview();
        });

        tabGradient.addEventListener('click', () => {
            isGradient = true;
            tabGradient.classList.add('active'); tabSolid.classList.remove('active');
            colorTargets.style.display = 'flex'; rowAngle.style.display = 'flex';
            updatePreview();
        });

        targetC1.addEventListener('click', () => loadTargetToSliders(1));
        targetC2.addEventListener('click', () => loadTargetToSliders(2));

        document.getElementById('cancel-color-btn').addEventListener('click', () => {
            colorModal.style.display = 'none';
            targetColorGroup = null;
        });

        document.getElementById('save-color-btn').addEventListener('click', () => {
            if (!targetColorGroup) return;
            
            let name = document.getElementById('color-name').value.trim();
            if (!name) name = isGradient ? "Gradient Theme" : "Custom Color";
            
            if (isGradient) {
                const angle = parseInt(sliderAngle.value);
                const pngDataURI = generateGradientPNG(colors[1].hex, colors[2].hex, angle);
                
                targetColorGroup.themes.push({ 
                    name: name, 
                    type: 'image',
                    data: pngDataURI, 
                    preview: `linear-gradient(${angle}deg, ${colors[1].hex}, ${colors[2].hex})`
                });
            } else {
                const color = colors[1].hex;
                targetColorGroup.themes.push({ name: name, type: 'custom', color: color, preview: color });
            }

            if (typeof enforceGroupLimits === 'function') enforceGroupLimits();
            if (typeof saveUserGroups === 'function') saveUserGroups();
            if (typeof renderGroups === 'function') renderGroups();

            colorModal.style.display = 'none';
            targetColorGroup = null;
        });
    }

    // ==========================================
    // 2. BUG REPORT MODAL LOGIC
    // ==========================================
    const footer = document.getElementById("bug-footer");
    const modal = document.getElementById("bug-modal");
    const cancelBtn = document.getElementById("cancel-bug-btn");
    const submitBtn = document.getElementById("submit-bug-btn");

    if (!footer || !modal) return;

    function sanitize(str) {
        if (!str) return "N/A";
        return str.replace(/@/g, '&#64;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim().slice(0, 1000);        
    }

    footer.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    cancelBtn.addEventListener("click", () => {
        modal.style.display = "none";
        document.getElementById("bug-desc").value = "";
        document.getElementById("bug-steps").value = "";
    });

    submitBtn.addEventListener("click", async () => {
        const type = document.getElementById("bug-type").value;
        const severity = document.getElementById("bug-severity").value;
        const desc = sanitize(document.getElementById("bug-desc").value);
        const steps = sanitize(document.getElementById("bug-steps").value);

        if (desc === "N/A" || desc.length < 5) {
            alert("Please provide a bit more detail in the description.");
            return;
        }

        submitBtn.textContent = "Sending...";
        submitBtn.disabled = true;

        const systemInfo = sanitize(navigator.userAgent);
        const activeThemes = sanitize(rotationList.map(t => t.name).join(", ") || "None");
        const isDark = document.body.hasAttribute('data-theme') ? "Yes" : "No";

        const payloadObj = {
            type,
            severity,
            description: desc,
            steps,
            environment: `OS/Browser: ${systemInfo}\nDark Mode UI: ${isDark}\nThemes in Rotation: ${activeThemes}`
        };

        try {
            const response = await browser.runtime.sendMessage({ type: "reportBug", data: payloadObj });
            if (response && response.success) {
                alert("Bug report sent — thank you!");
                cancelBtn.click(); 
            } else {
                alert("Failed to send report. Please check your internet connection.");
            }
        } catch (e) {
            console.error("Messaging error:", e);
            alert("Error communicating with background script.");
        } finally {
            submitBtn.textContent = "Submit Report";
            submitBtn.disabled = false;
        }
    });
});