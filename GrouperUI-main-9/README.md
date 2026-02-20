# SknkWrks_GMatic_UI_BldAirGap
### (Internal Release Name: Theme Grouper v1.2)

## Overview
**SknkWrks_GMatic_UI_BldAirGap** is a local-first Firefox browser extension designed for advanced theme management. It bridges the gap between installed AMO (Add-ons.mozilla.org) themes and local custom definitions. It allows users to group, rotate, and generate lightweight themes (solid colors or images) directly within the browser without external dependencies.

**Build Target:** Gecko / Firefox  
**Manifest Version:** V3  
**Permissions Model:** Strict (Local Storage, Alarms, Management)

---

## core_capabilities

### 1. Theme Aggregation & Grouping
* **System Integration:** Automatically detects and imports currently installed Firefox themes (Built-in, Dark, Light, Alpenglow) and third-party AMO themes.
* **Custom Groups:** Users can create named collections (e.g., "Night Mode", "Work", "Gallery").
* **Drag-and-Drop:** Groups can be reordered via drag-and-drop interface.
* **Limit Enforcement:** Groups are soft-capped at 6 themes; overflow automatically generates sequential buckets (e.g., "Gallery 2") to maintain UI performance.

### 2. Automated Rotation Engine
* **Timer-based Logic:** background.js utilizes `browser.alarms` to trigger theme changes.
* **Selection Mode:** Users can toggle specific themes into a "Rotation List".
* **Persistency:** Rotation state and index are saved to `storage.local` to survive browser restarts.

### 3. On-Device Theme Generation
* **Hex-Color Generator:** Create solid color themes instantly using Hex codes.
* **Image-to-Theme Pipeline:**
    * Utilizes a dedicated `uploader.html` interface.
    * **Client-Side Compression:** Images are processed via Canvas API, resized to max-width 1920px, and compressed (JPEG 0.7 quality) before storage to prevent `storage.local` quota parsing errors.
    * **Zero-Server Requirement:** All image data is Base64 encoded and stored locally.

### 4. UI/UX Architecture
* **Dark Mode Aware:** The popup UI (`popup.html`) respects system preferences and includes a manual toggle.
* **Context Menus:** Right-click support for renaming groups, deleting themes, and deep-linking to the Firefox Add-on Manager.

---

## technical_specifications

### File Structure
* `manifest.json` - Entry point, defines permissions (`theme`, `storage`, `alarms`, `management`).
* `background.js` - Handles the rotation alarm listener and rotation logic.
* `popup.html` / `popup.js` - Primary UI, rendering logic, and group management.
* `uploader.html` / `uploader.js` - Isolated environment for image processing and compression.
* `popup.css` - CSS variables for theming and layout.

### Data Model (storage.local)
The extension relies on a single storage object `savedThemeData` containing an array of group objects:
* **System Groups:** Read-only (fetched from `browser.management`).
* **Custom Groups:** Mutable arrays containing theme objects.
    * *Type 'builtin'/'addon':* Stores ID reference.
    * *Type 'custom':* Stores Hex color string.
    * *Type 'image':* Stores Base64 data URI.

---

## deployment_instructions

### Loading as Temporary Add-on
1.  Navigate to `about:debugging` in Firefox.
2.  Select **"This Firefox"**.
3.  Click **"Load Temporary Add-on..."**.
4.  Select the `manifest.json` file from the build directory.

### Rotation Configuration
1.  Open the extension popup.
2.  Click the **Rotate Icon** (circle arrow) to enter Selection Mode.
3.  Click themes to add/remove them from the rotation pool (highlighted blue).
4.  Click the **Rotate Icon** again to confirm.
5.  Input the desired interval in minutes (default: 30).

---

## change_log (v1.2)
* Implemented strict group overflow limits (Max 6 items per group).
* Added `uploader.html` for dedicated image processing.
* Refined Dark Mode CSS variables for higher contrast.
* Added "Management Mode" for easier deletion of items within groups.

---

*Property of SknkWrks / Internal Use Only*