browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'theme-rotation') {
        rotateTheme();
    }
});

async function rotateTheme() {
    const data = await browser.storage.local.get(['rotationList', 'currentRotationIndex', 'isDarkMode']);
    const list = data.rotationList || [];
    let index = data.currentRotationIndex || 0;
    
    if (list.length === 0) return;

    // Advance Index
    index = (index + 1) % list.length;
    
    // Save new index immediately
    await browser.storage.local.set({ currentRotationIndex: index });

    // Apply
    const theme = list[index];
    applyThemeLogic(theme, data.isDarkMode);
}

function applyThemeLogic(theme, isDarkMode) {
    if (theme.type === 'builtin' || theme.type === 'addon') {
        browser.management.setEnabled(theme.id, true);
    }
    else if (theme.type === 'image') {
        browser.theme.update({
            images: { theme_frame: theme.data },
            colors: {
                frame: isDarkMode ? '#1c1b22' : '#ffffff',
                tab_background_text: isDarkMode ? '#f9f9fb' : '#15141a',
                toolbar: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)',
                textcolor: isDarkMode ? '#f9f9fb' : '#15141a'
            }
        });
    }
    else if (theme.type === 'custom') {
        browser.theme.update({
            colors: {
                frame: theme.color,
                tab_background_text: isDarkMode ? '#f9f9fb' : '#15141a',
                toolbar: theme.color,
                textcolor: isDarkMode ? '#f9f9fb' : '#15141a',
                toolbar_text: isDarkMode ? '#f9f9fb' : '#15141a'
            }
        });
    }
}

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === "reportBug") {
    const webhookUrl = "https://discord.com/api/webhooks/1473149576486846687/ujdxZv8Jaei5qNXiNkzEStWkxFuZcu_qgY-KPwKeqiZGNP2Y4LwSvnAVOwwHHD_thAtU";
    const payload = { content: `🐞 **Bug Report:**\n${message.text}` };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) console.error("Discord error:", await res.text());
      return { success: res.ok };
    } catch (e) {
      console.error("Fetch failed:", e);
      return { success: false, error: e.message };
    }
  }
})

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === "reportBug") {
    
    // Your webhook is encoded here to hide it from automated scraping bots
    const encoded = "aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTQ3MzE0OTU3NjQ4Njg0NjY4Ny91amR4WnY4SmFlaTVxTlhpTmt6RVN0V2t4RnVaY3VfcWdZLUtQd0tlcWlaR05QMlk0THdTdm5BVk93d0hIRF90aEF0VQ==";
    const webhookUrl = atob(encoded);
    
    const d = message.data;
    
    // Choose embed color based on severity
    let embedColor = 3447003; // Default Blue
    if (d.severity === "High") embedColor = 15158332; // Red
    else if (d.severity === "Medium") embedColor = 16776960; // Yellow

    const payload = {
      embeds: [
        {
          title: `🐞 New Report: ${d.type}`,
          color: embedColor,
          fields: [
            { name: "Severity", value: d.severity, inline: true },
            { name: "Description", value: d.description },
            { name: "Steps to Reproduce", value: d.steps },
            { name: "Environment Info", value: `\`\`\`${d.environment}\`\`\`` }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) console.error("Discord API error:", await res.text());
      return { success: res.ok };
    } catch (e) {
      console.error("Fetch failed:", e);
      return { success: false, error: e.message };
    }
  }
});