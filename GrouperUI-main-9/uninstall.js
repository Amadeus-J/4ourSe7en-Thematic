document.addEventListener('DOMContentLoaded', () => {
    // Sync Dark Mode
    browser.storage.local.get('isDarkMode').then(storage => {
        if (storage.isDarkMode) document.body.setAttribute('data-theme', 'dark');
    }).catch(()=>{});

    const urlParams = new URLSearchParams(window.location.search);
    const themeId = urlParams.get('id');
    const themeName = urlParams.get('name');

    if (themeName) {
        document.getElementById('theme-name').textContent = `"${themeName}"`;
    }

    const btnConfirm = document.getElementById('btn-confirm');
    const btnCancel = document.getElementById('btn-cancel');
    const errorMsg = document.getElementById('error-msg');

    // PRE-EMPTIVE UNLOCK: Firefox refuses to delete active themes.
    // We check if it is active right now, and if so, switch to the default theme.
    browser.management.get(themeId).then(info => {
        if (info && info.enabled) {
            browser.management.setEnabled('default-theme@mozilla.org', true).catch(()=>{});
        }
    }).catch(()=>{});

    btnCancel.onclick = () => window.close();

    // Use async/await and a try...catch block to handle the synchronous crash
    btnConfirm.addEventListener('click', async () => {
        btnConfirm.textContent = "Uninstalling...";
        btnConfirm.disabled = true;
        errorMsg.style.display = 'none';

        try {
            // Check if the method exists before calling it to prevent a hard crash
            if (typeof browser.management.uninstall !== 'function') {
                throw new Error("Firefox does not support uninstalling other add-ons programmatically.");
            }

            // If Firefox ever adds support, this will work
            await browser.management.uninstall(themeId);
            window.close(); 
            
        } catch (err) {
            console.error("Uninstall blocked or unsupported:", err);
            
            // Show the fallback message with keyboard shortcuts
            errorMsg.innerHTML = "Firefox security prevents extensions from deleting other themes.<br><br>Press <b>Ctrl+Shift+A</b> (or <b>Cmd+Shift+A</b> on Mac) to open the Add-ons Manager and remove it manually.";
            errorMsg.style.display = 'block';
            
            // Turn the button into a "Close" button since we can't route them
            btnConfirm.textContent = "Close";
            btnConfirm.style.backgroundColor = "var(--bg-hover)";
            btnConfirm.style.color = "var(--text-primary)";
            btnConfirm.style.border = "1px solid var(--border-color)";
            btnConfirm.disabled = false;
            
                // Just close the modal so they can go do it manually
                btnConfirm.onclick = () => window.close();
            }
        });
    });