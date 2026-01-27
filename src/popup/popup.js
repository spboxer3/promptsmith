import { StorageService } from "../lib/storage.js";
import { I18nService } from "../lib/i18n.js";

document.addEventListener("DOMContentLoaded", async () => {
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
  const dot = document.querySelector(".status-dot");
  const text = document.querySelector(".status-text");
  let isConfigValid = true;

  if (endpoints.length === 0) {
    isConfigValid = false;
    if (dot) {
      dot.classList.remove("active");
      dot.style.backgroundColor = "#ffbb33"; // Orange
    }
    if (text) text.textContent = "Missing Endpoint";
  } else if (strategies.length === 0) {
    isConfigValid = false;
    if (dot) {
      dot.classList.remove("active");
      dot.style.backgroundColor = "#ffbb33"; // Orange
    }
    if (text) text.textContent = "Missing Strategy";
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
      tab.url.startsWith("about:")
    ) {
      if (dot) {
        dot.classList.remove("active");
        dot.style.backgroundColor = "#ff4444";
      }
      if (text) text.textContent = "Restricted on system pages";
      return; 
    }

    // Initialize Whitelist UI
    await initWhitelistUI(tab.url);
  }
});

import { DomainMatcher } from "../lib/domainMatcher.js";
import { DEFAULT_WHITELIST_DOMAINS } from "../lib/storage.js";

/**
 * Initialize the whitelist UI based on current URL
 * @param {string} url 
 */
async function initWhitelistUI(url) {
  const container = document.getElementById("whitelistSection");
  if (!container) return;

  const config = await StorageService.getAppConfig();
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
    // Determine what to show as "Matched"
    const matchedPattern = isCustomListed ? hostname : defaultRule; // For custom, we only use exact hostname now due to refactor
    renderRemoveView(container, matchedPattern);
  } else {
    // If it was a removed default, we treat it as just "not whitelisted", so we offer to Add (restore).
    // Restoring a removed default = removing from removedDefaultDomains ? 
    // OR just adding to customDomains?
    // Adding to customDomains is safer/simpler (overrides removal). 
    // But keeping config clean is better. 
    renderAddView(container, hostname, isDefaultRemoved ? defaultRule : null);
  }
  
  container.style.display = "block";
}

function renderAddView(container, hostname, removedDefaultPattern) {
  container.innerHTML = `
    <span class="whitelist-header" data-i18n="headerWhitelistAdd">Add to Whitelist</span>
    <button class="whitelist-action-btn add">
        <i class="fa-solid fa-plus"></i> 
        <span>${hostname}</span>
    </button>
  `;
  I18nService.apply(container);

  container.querySelector(".whitelist-action-btn").addEventListener("click", async () => {
    await addToWhitelist(hostname, removedDefaultPattern);
    // Refresh UI
    initWhitelistUI(hostname); 
  });
}

function renderRemoveView(container, pattern) {
  container.innerHTML = `
    <span class="whitelist-header" data-i18n="headerWhitelistRemove">Site is Whitelisted</span>
    <button class="whitelist-action-btn remove">
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
    await removeFromWhitelist(pattern);
    // Refresh UI
    initWhitelistUI(pattern); // pattern might be wildcard, but init handles URL/Hostname
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
