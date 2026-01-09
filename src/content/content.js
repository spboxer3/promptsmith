/**
 * PromptSmith Content Script
 * Entry point for DOM interaction.
 */

(async () => {
  // We use dynamic imports to load modules to keep the extension clean.
  // This requires these files to be in web_accessible_resources.

  const src = chrome.runtime.getURL("src/content/main.js");
  const contentMain = await import(src);
  contentMain.init();
})();
