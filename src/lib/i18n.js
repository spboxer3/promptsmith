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
        // Smart Replacement: Preserve Icons
        let replaced = false;

        // 1. Try to find an existing text node to replace
        if (el.childNodes && el.childNodes.length > 0) {
          el.childNodes.forEach((node) => {
            // Node.TEXT_NODE === 3
            if (node.nodeType === 3 && node.nodeValue.trim().length > 0) {
              node.nodeValue = text;
              replaced = true;
            }
          });
        }

        // 2. If no text node found (or empty), handle fallback
        if (!replaced) {
          if (el.children.length === 0) {
            // No children (icons), safe to set textContent
            el.textContent = text;
          } else {
            // Has icons but no text? Append the new text
            const textNode = document.createTextNode(text);
            el.appendChild(textNode);
          }
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
