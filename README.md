<p align="center"><img src="assets/icons/icon128.png"></p>

<h1 align="center">PromptSmith - The Optimizing AI Client (BYOK)</h1>

<p align="center">English | <a href="README_zh-TW.md">繁體中文</a></p>

PromptSmith is a privacy-first, "Bring Your Own Key" (BYOK) AI client that integrates directly into your Chrome browser. It empowers you to optimize text, fix grammar, and refine prompts using your preferred AI models (OpenAI, Anthropic, Gemini, or local models via Generic/OpenAI-compatible APIs) on any webpage.

## Key Features

- **Bring Your Own Key (BYOK):** Connect your own API keys for OpenAI, Anthropic, or Google Gemini. You maintain full control over your usage and costs.
- **Local AI Support:** Seamlessly connect to local LLMs (e.g., via LM Studio, Ollama, LocalAI) for complete privacy and offline capability.
- **Domain Whitelist:** Control where the extension activates. Pre-configured for popular AI tools (ChatGPT, Claude, Gemini, etc.) with support for custom domains and wildcards.
- **Universal Compatibility:** Works on any website. Select text, invoke PromptSmith, and optimize instantly.
- **Customizable Strategies:** Create tailored prompts ("Strategies") for specific tasks like "Fix Grammar," "Professional Tone," "Summarize," or "Code Review."
- **Default Endpoint:** Set a global default endpoint and use it across multiple strategies. Change once, apply everywhere.
- **Privacy-First:** Your API keys and data are stored locally in your browser. No middleman servers.
- **Smart UI:** Minimalist floating review window, diff view for changes, and keyboard shortcuts (`Alt+P`) for rapid access.

## Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory containing the extension files.

## Usage

1.  **Configuration:**

    - Click the extension icon or open the Options page.
    - Go to **Endpoints** and add your AI provider details (API Key, Model Name).
    - (Optional) Configure **Strategies** to customize how the AI processes your text.

2.  **Optimizing Text:**
    - Highlight any text on a webpage.
    - Press the trigger shortcut (Default: `Alt+P`) OR click the floating "PromptSmith" button if enabled.
    - Select a Strategy from the menu.
    - Review the AI's suggestion in the diff view window.
    - Click **Apply** to replace the original text, or **Copy** to save it to your clipboard.

## Privacy Policy

[Privacy Policy](Privacy%20Policy.md)

## Changelog

### v0.5.0

- **History Feature**: Automatically saves your optimization history locally for 7 days.
- **History UI**: A new premium interface in the Options page to search, review, and copy past optimizations.
- **Quick Access**: Access recent history directly from the floating menu via the new clock icon.


### v0.4.1

- **Quick Whitelist**: Add or remove sites from the whitelist directly via the popup interface. Supports managing both custom domains and default supported sites (e.g., restoring removed defaults).

### v0.4.0

- **Default Endpoint:** Set a global default endpoint that can be shared across multiple strategies. Easily switch your preferred AI model in one place.
- **Custom Dropdown UI:** Redesigned endpoint selector with gradient tag styling for better visual clarity.
- **Star Button:** Quick one-click default endpoint selection with ★/☆ indicators in the endpoint list.
- **Auto-Transfer:** When deleting the default endpoint, automatically transfers the default to the next available endpoint.

### v0.3.10

- **Bug Fix**: Fixed an issue where the endpoint for the default "Make Prompt Better" strategy was lost during import.

### v0.3.9

- **FAB Cleanup**: Fixed "Ghost Icon" issue where floating buttons persisted after input elements were removed (e.g., in SPA switching).
- **Error Handling**: Suppressed false-positive error badges in Chrome and improved error handling for orphaned scripts.
- **Bug Fixes**: Fixed localhost validation support and preserved button icons during i18n translation.

### v0.3.7

- **Interaction Safety**: Prevented Enter key from triggering underlying website forms while Review UI or Loading state is active.

### v0.3.6

- **Permissions & Policy**: Optimized manifest permissions (removed `activeTab`, `contextMenus`) and updated privacy policy to justify `scripting` usage.

### v0.3.5

- **Whitelist Priority**: Moved whitelist check to earliest possible point, preventing any chrome API calls on non-whitelisted domains.
- **Listener Cleanup**: Fixed orphaned `chrome.storage.onChanged` listener causing context invalidated errors.

### v0.3.4

- **UI Fix**: Resolved layout issue in strategy list where long descriptions caused button misalignment.

### v0.3.3

- **Hot-fix Reload**: Automatically re-inject content scripts and clean up old instances when extension is reloaded, ensuring uninterrupted usage without page refresh.

### v0.3.2

- **Default Categories**: Updated defaults to General, Image, Writing, Coding
- **Shortcut Fix**: Prevent menu from reopening if already visible
- **Smart Categorization**: Built-in strategies now have default categories assigned, but user can override them

### v0.3.1

- **Category Filter**: Filter strategies by category in settings page

### v0.3.0

- **Strategy Categories**: Organize strategies into categories for better management
- **Cascading Menu**: Category-based hierarchical menu with submenu expansion
- **Drag-and-drop Reordering**: Easily reorder categories by dragging
- **Full Keyboard Navigation**: Navigate menus with arrow keys, Enter, and Escape
- **Category Display**: Show assigned category as a tag in strategy list
- **Toast Confirmation**: Improved delete confirmation using toast-style dialogs

### v0.2.1

- **Keyboard Navigation**: Navigate strategy menu with arrow keys and Enter
- **FAB Display Fix**: Floating button only appears when input has content

### v0.2.0

- **Domain Whitelist**: Enable/disable extension for specific domains
- **Advanced Variables**: Use JavaScript variables in strategy templates

## License

MIT
