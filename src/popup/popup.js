import { StorageService } from "../lib/storage.js";
import { I18nService } from "../lib/i18n.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await I18nService.init();
    I18nService.apply();

    document.getElementById("openSettings").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

  // Single Source of Truth: Inject Version from Manifest
    const manifest = chrome.runtime.getManifest();
    const versionEl = document.getElementById("extensionVersion");
    if (versionEl) {
      versionEl.textContent = `v${manifest.version}`;
    }

  // 1. Update Shortcut Hint
    const config = await StorageService.getAppConfig();
    const hintKey = document.querySelector(".hint strong");
    if (hintKey) {
      hintKey.textContent = config.triggerKey || "Alt+P";
    }

  // 2. Check Configuration Health
    const endpoints = await StorageService.getEndpoints();
    const strategies = await StorageService.getStrategies();
    let isConfigValid = true;

    if (endpoints.length === 0) {
      isConfigValid = false;
      setPopupStatus("warning", I18nService.t("popupMissingEndpoint"));
    } else if (strategies.length === 0) {
      isConfigValid = false;
      setPopupStatus("warning", I18nService.t("popupMissingStrategy"));
    }

  // 3. Check Tab Validity and Whitelist Status
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
    // Global Config Warning takes precedence over Local Page Restriction
      if (!isConfigValid) return;

    // Chrome Extensions cannot run on chrome:// or edge:// pages
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://")
      ) {
        setPopupStatus("error", I18nService.t("popupRestrictedPage"));
        return;
      }

      await initWhitelistUI(tab.url);
    } else if (isConfigValid) {
      setPopupStatus("error", I18nService.t("popupPageUnavailable"));
    }
  } catch (error) {
    console.error("[PromptSmith] Popup initialization failed:", error);
    setPopupStatus("error", I18nService.t("popupLoadError"));
  }
});

import { DomainMatcher } from "../lib/domainMatcher.js";
import { DEFAULT_WHITELIST_DOMAINS } from "../lib/storage.js";

function setPopupStatus(state, message) {
  const dot = document.querySelector(".status-dot");
  const text = document.querySelector(".status-text");
  if (dot) {
    dot.classList.remove("active", "warning", "error");
    dot.classList.add(state);
  }
  if (text) text.textContent = message;
}

/**
 * Initialize the whitelist UI based on current URL
 * @param {string} url 
 */
async function initWhitelistUI(url) {
  const container = document.getElementById("whitelistSection");
  if (!container) return;

  const config = await StorageService.getAppConfig();
  if (config.whitelistEnabled === false) {
    container.replaceChildren();
    container.style.display = "none";
    return;
  }
  const customDomains = config.customDomains || [];
  const removedDefaults = config.removedDefaultDomains || [];
  const hostname = DomainMatcher.extractDomain(url);
  
  // Check Effective Whitelist Status
  const isCustomListed = customDomains.includes(hostname);
  
  // Check if it matches any default domain pattern AND is not removed
  // Note: Default domains might be wildcards.
  // We need to know IF it is whitelisted by default, what represents it?
  // Strategy:
  // 1. Is it currently effective? 
  //    Effective = (Matches Custom) OR (Matches Default AND NOT Matches Removed)
  //    Wait, removedDefaultDomains usually stores the exact pattern matched? Or the hostname?
  //    If default is "*.google.com", and user removes it on "mail.google.com".
  //    Do we block "mail.google.com" specifically (add to removed) or the whole rule?
  //    Typically, we "remove" the specific rule.
  
  // Let's look at DomainMatcher.isAllowed.
  // We need to know which rule matched to remove it.
  
  // Check Default Match
  const defaultRule = DEFAULT_WHITELIST_DOMAINS.find(pattern => DomainMatcher.isAllowed(url, [pattern]));
  const isDefaultListed = !!defaultRule;
  
  // Check if this default rule is effectively removed
  // This is tricky if defaults are wildcards. 
  // Implementation: We will ban the **matching rule string** in removedDefaultDomains.
  const isDefaultRemoved = defaultRule && removedDefaults.includes(defaultRule);
  
  const isEffectiveWhitelisted = isCustomListed || (isDefaultListed && !isDefaultRemoved);

  if (isEffectiveWhitelisted) {
    setPopupStatus("active", I18nService.t("popupReady"));
    // Determine what to show as "Matched"
    const matchedPattern = isCustomListed ? hostname : defaultRule; // For custom, we only use exact hostname now due to refactor
    renderRemoveView(container, matchedPattern, url);
  } else {
    setPopupStatus("warning", I18nService.t("popupNotWhitelisted"));
    // If it was a removed default, we treat it as just "not whitelisted", so we offer to Add (restore).
    // Restoring a removed default = removing from removedDefaultDomains ? 
    // OR just adding to customDomains?
    // Adding to customDomains is safer/simpler (overrides removal). 
    // But keeping config clean is better. 
    renderAddView(container, hostname, isDefaultRemoved ? defaultRule : null, url);
  }
  
  container.style.display = "block";
}

function renderAddView(container, hostname, removedDefaultPattern, currentUrl) {
  container.innerHTML = `
    <span class="whitelist-header" data-i18n="headerWhitelistAdd">Add to Whitelist</span>
    <button type="button" class="whitelist-action-btn add">
        <i class="fa-solid fa-plus"></i> 
        <span>${hostname}</span>
    </button>
  `;
  I18nService.apply(container);

  container.querySelector(".whitelist-action-btn").addEventListener("click", async () => {
    const button = container.querySelector(".whitelist-action-btn");
    button.disabled = true;
    try {
      await addToWhitelist(hostname, removedDefaultPattern);
      await initWhitelistUI(currentUrl);
    } catch (error) {
      console.error("[PromptSmith] Could not update whitelist:", error);
      button.disabled = false;
      setPopupStatus("error", I18nService.t("popupLoadError"));
    }
  });
}

function renderRemoveView(container, pattern, currentUrl) {
  container.innerHTML = `
    <span class="whitelist-header" data-i18n="headerWhitelistRemove">Site is Whitelisted</span>
    <button type="button" class="whitelist-action-btn remove">
        <i class="fa-solid fa-trash"></i>
        <span data-i18n="btnRemoveFromWhitelist">Remove from Whitelist</span>
    </button>
  `;
  I18nService.apply(container);
  
  // Update button text to precise action if it's a default wildcard?
  // User asked for "Remove", doesn't specify if we show wildcard.
  // But standard UI shows "Matched: patent".
  // Wait, I removed the "Matched Rule" text in previous refactor to simplify.
  // The user said: "Option 1... only show Remove".
  // So a simple Remove button is fine.

  container.querySelector(".whitelist-action-btn").addEventListener("click", async () => {
    const button = container.querySelector(".whitelist-action-btn");
    button.disabled = true;
    try {
      await removeFromWhitelist(pattern);
      await initWhitelistUI(currentUrl);
    } catch (error) {
      console.error("[PromptSmith] Could not update whitelist:", error);
      button.disabled = false;
      setPopupStatus("error", I18nService.t("popupLoadError"));
    }
  });
}

async function addToWhitelist(hostname, removedDefaultPattern) {
  const config = await StorageService.getAppConfig();
  
  if (removedDefaultPattern) {
    // Restore default: remove from removedDefaultDomains
    const removed = config.removedDefaultDomains || [];
    const newRemoved = removed.filter(d => d !== removedDefaultPattern);
    await StorageService.saveAppConfig({ removedDefaultDomains: newRemoved });
  } else {
    // Normal Add
    const domains = config.customDomains || [];
    if (!domains.includes(hostname)) {
      domains.push(hostname);
      await StorageService.saveAppConfig({ customDomains: domains });
    }
  }
}

async function removeFromWhitelist(pattern) {
  const config = await StorageService.getAppConfig();
  
  // 1. Check Custom
  const customDomains = config.customDomains || [];
  if (customDomains.includes(pattern)) {
    const newCustom = customDomains.filter(d => d !== pattern);
    await StorageService.saveAppConfig({ customDomains: newCustom });
    return;
  }
  
  // 2. Check Default (if pattern matches one of the defaults)
  // The pattern passed here IS the default rule string (e.g. "*.openai.com") or exact custom hostname.
  // If it's not in custom, it MUST be a default rule that is currently active.
  const removedDefaults = config.removedDefaultDomains || [];
  if (!removedDefaults.includes(pattern)) {
     removedDefaults.push(pattern);
     await StorageService.saveAppConfig({ removedDefaultDomains: removedDefaults });
  }
}
