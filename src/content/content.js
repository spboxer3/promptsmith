/**
 * PromptSmith Content Script
 * Entry point for DOM interaction.
 */

(async () => {
  // Check if extension context is still valid (handles orphaned scripts after extension reload)
  try {
    if (!chrome.runtime.id) {
      console.warn("[PromptSmith] Extension context invalidated, script is orphaned.");
      return;
    }
  } catch (e) {
    // Extension context is invalid
    return;
  }

  // We use dynamic imports to load modules to keep the extension clean.
  // This requires these files to be in web_accessible_resources.
  try {
    const src = chrome.runtime.getURL("src/content/main.js");
    const contentMain = await import(src);
    contentMain.init();
  } catch (e) {
    // Extension context invalidated during load - silently ignore
    console.warn("[PromptSmith] Failed to initialize:", e.message);
  }
})();
