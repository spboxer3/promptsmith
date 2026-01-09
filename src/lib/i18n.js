import { StorageService } from "./storage.js";

export class I18nService {
  static currentLocale = "auto";
  static messages = null; // null means use chrome.i18n (system default)

  /**
   * Initialize the i18n service.
   * Loads the user's language preference and fetches custom messages if needed.
   */
  static async init() {
    const config = await StorageService.getAppConfig();
    this.currentLocale = config.language || "auto";

    if (this.currentLocale === "auto") {
      this.messages = null; // Use native chrome.i18n
      console.log("[I18n] Using system locale:", chrome.i18n.getUILanguage());
    } else {
      console.log("[I18n] Loading custom locale:", this.currentLocale);
      try {
        const url = chrome.runtime.getURL(
          `_locales/${this.currentLocale}/messages.json`
        );
        const response = await fetch(url);
        this.messages = await response.json();
      } catch (e) {
        console.error("[I18n] Failed to load locale:", e);
        this.messages = null; // Fallback
      }
    }
  }

  /**
   * Get a localized string.
   * @param {string} key - The message key (e.g., "appTitle")
   * @param {string[]} placeholders - Optional substitutions
   * @returns {string} The localized string
   */
  static t(key, placeholders = []) {
    let message = "";

    if (this.messages && this.messages[key]) {
      // Custom loaded locale
      message = this.messages[key].message;

      // Handle placeholders $1, $2, etc.
      if (placeholders && placeholders.length > 0) {
        placeholders.forEach((val, index) => {
          // Replace $1, $2... (1-based index)
          message = message.replace(new RegExp(`\\$${index + 1}`, "g"), val);
        });
      }
    } else {
      // Fallback to chrome.i18n (System default)
      try {
        message = chrome.i18n.getMessage(key, placeholders);
      } catch (e) {
        // Ignored
      }
    }

    return message || key; // Return key if translation missing
  }

  /**
   * Apply translations to the DOM.
   * Searches for elements with [data-i18n] attribute.
   * @param {HTMLElement} root - The root element to search within
   */
  static apply(root = document) {
    const elements = root.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (text) {
        // If specific structure needed (e.g. icon + text), might need better handling
        // For now, simpler is replace content.
        // BUT, if element has children (like icons), we might wipe them.
        // Strategy: If element has no children, textContent.
        // If it has children, look for a text node?
        // Safer: Only replace valid text.
        if (el.children.length === 0) {
          el.textContent = text;
        } else {
          // Try to find a text node to replace, or append?
          // Simple heuristic: if it has data-i18n, assume it owns the text content.
          // Maybe we should use a specific span for text if mixed with icons.
          // Let's assume for now UI text is mostly simple.
          // Exception: Buttons with icons. <button><span class="icon"></span> Text</button>
          // Better validation:
          // 1. If we use data-i18n on a container, likely meant to replace ALL content?
          // 2. Or we put data-i18n on the text span itself.
          // We will recommend putting data-i18n on the text-holding element.
          el.textContent = text;
        }
      }

      // Also handle placeholders/titles
      const attrParams = el.getAttribute("data-i18n-attrs");
      if (attrParams) {
        // format: "title=key1;placeholder=key2"
        attrParams.split(";").forEach((pair) => {
          const [attr, k] = pair.split("=");
          if (attr && k) {
            el.setAttribute(attr.trim(), this.t(k.trim()));
          }
        });
      }
    });
  }
}
