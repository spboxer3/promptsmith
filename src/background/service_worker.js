/**
 * PromptSmith Service Worker
 * Handles cross-origin requests and Mixed Content proxying.
 */

// Listen for messages from Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXECUTE_REQUEST") {
    handleRequest(message.payload)
      .then((response) => sendResponse({ success: true, data: response }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
  }
});

// Handle Browser Commands (Shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  console.log("[PromptSmith] Background received command:", command);
  if (command === "trigger_menu") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_MENU" }).catch((err) => {
        // Content script might not be injected on this tab
        console.warn("Could not send trigger to tab", tab.url, err);
      });
    }
  }
});

/**
 * Proxies the fetch request to bypass Mixed Content restrictions
 * (HTTPS sites cannot fetch HTTP localhost directly, but background SW can).
 */
async function handleRequest(config) {
  const { url, method, headers, body } = config;

  try {
    const options = {
      method: method,
      headers: headers || { "Content-Type": "application/json" },
    };

    if (method === "POST" || method === "PUT") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json().catch(() => ({})); // Handle empty/text result gracefully
    return {
      status: response.status,
      statusText: response.statusText,
      data: json,
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
}
