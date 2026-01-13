<p align="center"><img src="assets/icons/icon128.png"></p>

<h1 align="center">PromptSmith - The Optimizing AI Client (BYOK)</h1>

<p align="center">English | <a href="README_zh-TW.md">繁體中文</a></p>

PromptSmith is a privacy-first, "Bring Your Own Key" (BYOK) AI client that integrates directly into your Chrome browser. It empowers you to optimize text, fix grammar, and refine prompts using your preferred AI models (OpenAI, Anthropic, Gemini, or local models via Generic/OpenAI-compatible APIs) on any webpage.

## Key Features

- **Bring Your Own Key (BYOK):** Connect your own API keys for OpenAI, Anthropic, or Google Gemini. You maintain full control over your usage and costs.
- **Local AI Support:** Seamlessly connect to local LLMs (e.g., via LM Studio, Ollama, LocalAI) for complete privacy and offline capability.
- **Domain Whitelist:** Control where the extension activates. Pre-configured for popular AI tools (ChatGPT, Claude, Gemini, etc.) with support for custom domains and wildcards.
- **Universal Compatibility:** Works on any website. Select text, invoke PromptSmith, and optimize instantly.
- **Customizable Strategies:** creating tailored prompts ("Strategies") for specific tasks like "Fix Grammar," "Professional Tone," "Summarize," or "Code Review."
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
