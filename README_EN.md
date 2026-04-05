# MOGU Script Manager

English | [简体中文](./README.md)

> Its main function is to provide a visual interface for managing and running After Effects scripts, allowing users to organize, search, and execute various AE scripts more conveniently.
>
> You can download it directly here or visit: https://nocode.host/aj9p9x
>
> AI Tools: Claude, Doubao, Gemini, Deepseek, GPT 5.4

---

## 📋 Changelog

### v1.21 (Major Update)

- Improved script and preset card image preview functionality. Images with the same name as scripts and presets in their paths will be automatically recognized as preview images
- Changed background settings to interface settings, added interface font and card font adjustments to adapt to different interfaces
- Adjusted for unknown English issues

### v1.2 (Major Update)

- Added **AI Features (AI Subsystem)**: Supports ModelScope (text-to-image/image editing), ComfyUI (node workflow integration), Volcengine (TTS/STT voice-text conversion), and Coze workflows
- Added **Built-in Browser**: Supports opening web pages directly within the panel, managing bookmarks/history
- Added **Text Manager Panel**: Supports scanning text layers in the current composition, performing normal/precise/regex search and bulk replacement (Bulk Edit), as well as batch changing fonts and styles
- **Local Storage Diagnostics Optimization (Diagnostics)**: Provides multiple health checks including environment, paths, read/write permissions, and dependency detection, supports exporting diagnostic reports
- **Enhanced Import/Export and Persistence (Persistence)**: Supports selective export of configurations (scripts/presets, AI models, web bookmarks, etc.), optimized multi-channel data synchronization between app.settings and localStorage

### v1.11

- Fixed some old bugs, adjusted UI, added new bugs

### v1.1

- Updated preset management interface
- **Three Application Modes** (offset and last frame modes only work for basic properties like position, scale, etc.; other masks and effects use normal animation):
  - **Basic Mode**: Directly apply preset
  - **Offset Mode**: Superimposes preset animation changes on top of the layer's current property values; for example, if the preset animation moves position from (0,0) to (100,0) over 1s, applying offset mode at the 3rd second to a layer at position (200,200) will result in animation from (200,200) to (300,200) during 3-4s
  - **Last Frame Mode**: Aligns the animation's end state with the layer's current state and calculates the animation's start state in reverse; for example, if the preset animation moves position from (0,0) to (100,0) over 1s with glow effect intensity from 0 to 1, applying at the 3rd second to a layer at (200,200) will result in animation from (100,200) to (200,200) during 2-3s, with glow effect intensity from 0-1 during 2-3s

### v1.03

- Fixed the issue where scripts in some subfolders would be read when "read subfolders" was unchecked, for example, duik would read duik tools panels in subfolders
- Adjusted based on known issues

### v1.02

- Added script functionality detection in settings interface for easier troubleshooting
- Adjusted data caching for testing
- No need to update if the script is working fine

### v1.01

- Added an option in settings to read subfolders; if unchecked, subfolders in the set path won't be read
- If export function is not checked, the exported script folder will contain all files from the set path
- If export function is checked, the exported script folder will only contain jsx and jsxbin files

---

## ✨ Core Features

This script adds a "Preset" view to the AE script panel, coexisting with the original "Script" view, allowing users to switch between them at any time. In the "Preset" view, users can browse, search, categorize, manage, and apply AE animation presets.

### 1. Script Management

- **Folder Selection**: Users can select folders containing AE scripts (.jsx, .jsxbin files)
- **Script Scanning**: Automatically scans all script files in the specified folder
- **Script Execution**: Click to run the selected script

### 2. Category System

- **Category Management**: Users can create custom categories to organize scripts
- **Category Filtering**: Quickly filter scripts through the sidebar category list
- **Default Category**: Includes "All" category to display all scripts

### 3. Search Function

- **Real-time Search**: Input keywords to filter script list in real-time
- **Clear Search**: One-click to clear search conditions
- **Search Tips**: Provides help tips for the search input box

### 4. Tag System

- **Tag Management**: Add custom tags to scripts
- **Tag Filtering**: Filter related scripts by activating tags
- **Tag Editing**: Supports adding and deleting tags

### 5. Script Settings

- **Right-click Menu**: Right-click on script to open settings menu
- **Script Configuration**: Set custom properties for each script
- **Preview Function**: Supports script preview image display

### 6. User Interface Features

- **Responsive Layout**: Supports panel size adjustment
- **Theme Switching**: Supports light/dark theme switching
- **Size Adjustment**: Adjustable script item display size
- **Grid/List View**: Supports switching between two display modes

### 7. Data Management

- **Settings Save**: Automatically saves user settings and preferences
- **Import/Export**: Supports configuration data import/export
- **Persistent Storage**: Uses After Effects settings system to save data

### 8. Advanced Features

- **Background Settings**: Supports custom background images and videos
- **Clipboard Import**: Supports Ctrl+V to import clipboard images
- **Image Save Location**: Configurable to save images to desktop, documents folder, or project file directory

### 9. Preset Management

- **Script/Preset Switching**: Provides a button in the bottom right corner of the panel to seamlessly switch between "Script List" and "Preset Browser"
- **Three Application Modes**:
  - **Basic Mode**: Directly apply preset
  - **Offset Mode**: Superimposes preset animation changes on top of the layer's current property values; for example, if the preset animation moves position from (0,0) to (100,0) over 1s, applying offset mode at the 3rd second to a layer at position (200,200) will result in animation from (200,200) to (300,200) during 3-4s
  - **Last Frame Mode**: Aligns the animation's end state with the layer's current state and calculates the animation's start state in reverse; for example, if the preset animation moves position from (0,0) to (100,0) over 1s with glow effect intensity from 0 to 1, applying at the 3rd second to a layer at (200,200) will result in animation from (100,200) to (200,200) during 2-3s, with glow effect intensity from 0-1 during 2-3s

---

## 🛠 Technical Architecture

### Frontend Technologies

- **HTML5**: Provides basic page structure
- **CSS3**: Implements modern user interface styles
- **JavaScript**: Handles user interaction and business logic
- **CEP Framework**: Communicates with After Effects

### Backend Technologies

- **ExtendScript**: Interacts with After Effects API
- **File System Operations**: Scans and manages script files
- **Settings Management**: Uses AE built-in settings system

---

## 💡 Use Cases

- **Script Developers**: Manage and test self-developed AE scripts
- **Video Producers**: Quick access to commonly used AE script tools
- **Team Collaboration**: Unified management of team-shared script libraries
- **Workflow Optimization**: Improve script usage efficiency through categorization and tags

---

## ⭐ Advantages

- **User-Friendly**: Intuitive graphical interface, no need to memorize script paths
- **Highly Customizable**: Supports various customization options like categories, tags, themes
- **Performance Optimized**: Efficient script scanning and loading mechanism
- **Stable and Reliable**: Comprehensive error handling and settings persistence
- **Highly Extensible**: Modular design, easy to add new features

---

## 📈 Project History

[![Star History Chart](https://api.star-history.com/svg?repos=mogudesu/Mogu-AE-Script-Manager&type=Date)](https://star-history.com/#mogudesu/Mogu-AE-Script-Manager&Date)
