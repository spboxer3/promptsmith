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
    hintKey.textContent = config.triggerKey || "Ctrl+Shift+K";
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

  // 3. Check Tab Validity
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
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
    }
  }
});
