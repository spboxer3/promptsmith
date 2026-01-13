# Privacy Policy for PromptSmith

**Last Updated:** January 9, 2026

PromptSmith ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how our Chrome extension collects, uses, and safeguards your information. PromptSmith is designed as a privacy-first, "Bring Your Own Key" (BYOK) application, meaning we prioritize local processing and direct connections to AI providers of your choice.

## Data Collection and Usage

**We do not collect, store, or transmit your personal data to our own servers.** All data processing occurs locally within your browser or is transmitted directly to the AI service providers you explicitly configure.

### 1. API Keys and Settings

- **What we store:** Your API keys (e.g., for OpenAI, Anthropic, Gemini) and extension configuration settings.
- **Where it is stored:** This information is stored strictly locally on your device using the Chrome `storage` API (`chrome.storage.local`).
- **Purpose:** To enable the extension to authenticate with the third-party AI services you have chosen to use usage.
- **Security:** Your API keys never leave your browser except to be sent directly to the respective API endpoints you have configured.

### 2. User-Selected Content

- **What we process:** Text that you explicitly select on a webpage and submit for optimization.
- **How it is processed:** This text is sent directly from your browser to the API endpoint you have selected (e.g., OpenAI API).
- **Purpose:** To generate optimized text, grammar corrections, or other AI-generated content based on your request.
- **Retention:** We do not retain this text. It is transiently processed to provide the service and is not saved by the extension after the session.

## Permissions Usage Explanation

To function correctly, PromptSmith requires specific permissions. Here is a detailed breakdown of why each permission is necessary:

### `storage`

- **Purpose:** Required to save your user preferences, custom strategies, and configured API endpoints (including API keys) locally within your browser profile.
- **Justification:** This allows the extension to remember your settings between sessions without requiring a login or external database.


### `scripting`

- **Purpose:** Allows the extension to programmatically inject JavaScript and CSS into web pages.
- **Justification:** This permission is strictly used to implement a "Hot-fix" or "Live Reload" mechanism. When the extension is installed or updated, we use `chrome.scripting.executeScript` to immediately inject content scripts into already open tabs. This ensures the extension works immediately without forcing the user to manually refresh their pages. It is also used to dynamically render the user interface elements when needed.


### Host Permissions (`<all_urls>`)

- **Purpose:** Allows the extension to run on any website you visit.
- **Justification:** As a general-purpose text optimization tool, PromptSmith is designed to work universally across the web—whether you are writing an email, a blog post, or a social media update. We access pages only to detect selected text and render our UI.

## Third-Party Services

PromptSmith acts as a client interface. When you use this extension, you are interacting with third-party AI providers (such as OpenAI, Google, Anthropic, or others you configure).

- **Data Transfer:** Your inputs (prompts and selected text) are sent directly to these providers.
- **Policies:** We encourage you to review the privacy policies of the AI providers you choose to connect to, as their data handling practices are governed by their own terms.

## Data Security

We implement industry-standard security measures to protect your stored API keys. However, please be aware that no method of transmission over the internet or method of electronic storage is 100% secure.

## Changes to This Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.

## Contact Us

If you have any questions about this Privacy Policy, please contact us at:
[Your Support Email or Contact Page URL]
