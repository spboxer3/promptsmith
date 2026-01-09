import { TriggerManager } from "./modules/trigger.js";
import { UIManager } from "./modules/ui.js";
import { InjectionManager } from "./modules/injector.js";
import { StorageService } from "../lib/storage.js";
import { RequestAdapter } from "./modules/adapters.js";
import { I18nService } from "../lib/i18n.js";

export async function init() {
  console.log("[PromptSmith] Initializing...");

  await I18nService.init(); // Init i18n
  const config = await StorageService.getAppConfig();

  const ui = new UIManager();
  const injector = new InjectionManager();

  const triggerManager = new TriggerManager(config, {
    onTrigger: (context) => {
      // Context contains { text, element, rect }
      ui.showMenu(context, async (strategyId) => {
        // Callback when strategy is selected
        await handleOptimization(strategyId, context, injector, ui);
      });
    },
    onSelection: (rect, element, selectionState) => {
      ui.showFab(
        element,
        () => {
          // Simulate manual trigger, passing the element
          triggerManager.manualTrigger(element, selectionState);
        },
        selectionState,
        config.showFloatingIcon // New argument: showTriggerFab
      );
    },
    onSelectionClear: () => {
      ui.clearFabs();
    },
  });

  triggerManager.start();

  // Keep local config updated
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["appConfig"]) {
      Object.assign(config, changes["appConfig"].newValue);
    }
  });

  // Listen for Browser Shortcut Command
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRIGGER_MENU") {
      console.log("[PromptSmith] Content Script received TRIGGER_MENU");
      triggerManager.manualTrigger();
    }
  });
}

async function handleOptimization(strategyId, context, injector, ui) {
  console.log("[PromptSmith] handleOptimization started", strategyId);

  // Close menu and show Loading UI immediately
  ui.hideMenu();
  ui.showReviewLoading(context.text, context);

  try {
    const strategies = await StorageService.getStrategies();
    const strategy = strategies.find((s) => s.id === strategyId);
    if (!strategy) {
      throw new Error("Strategy not found");
    }

    const endpoints = await StorageService.getEndpoints();
    const endpoint = endpoints.find((e) => e.id === strategy.linkedEndpointId);
    if (!endpoint) {
      throw new Error("Endpoint not found for this strategy.");
    }

    console.log("[PromptSmith] Building request for endpoint:", endpoint.name);

    // Get app config for output language setting
    const appConfig = await StorageService.getAppConfig();

    // buildRequest(config, input, instruction, customSystemPrompt, outputLanguage)
    const requestConfig = RequestAdapter.buildRequest(
      endpoint,
      context.text,
      strategy.instruction,
      strategy.useCustomSystemPrompt ? strategy.systemPrompt : undefined,
      appConfig.outputLanguage
    );

    console.log("[PromptSmith] Executing Optimization Request:", requestConfig);

    // Send to Background
    const response = await chrome.runtime.sendMessage({
      type: "EXECUTE_REQUEST",
      payload: requestConfig,
    });

    console.log("[PromptSmith] Background response:", response);

    if (!response.success) {
      throw new Error(response.error);
    }

    // Parse Response
    const responseWrapper = response.data;

    if (responseWrapper.status >= 400) {
      throw new Error(
        `API Error ${responseWrapper.status}: ${JSON.stringify(
          responseWrapper.data
        )}`
      );
    }

    const apiBody = responseWrapper.data;
    const resultText = RequestAdapter.parseResponse(endpoint.provider, apiBody);

    console.log("[PromptSmith] Parsed Result Text:", resultText);

    if (!resultText) {
      throw new Error(
        "AI returned empty response or format was unrecognized. Raw: " +
          JSON.stringify(apiBody)
      );
    }

    // Diff Confirmation
    console.log("[PromptSmith] Showing Diff UI...");
    // Diff Confirmation
    console.log("[PromptSmith] Showing Diff UI...");
    ui.showDiff(
      context.text, // Original
      resultText, // New
      context, // Context for positioning
      (finalText) => {
        // On Apply - Accept final text from editor (user might have edited it)
        injector.replaceText(context, finalText);
      },
      () => {
        // On Discard
        console.log("Optimization discarded by user");
      },
      () => {
        // On Regenerate
        console.log("[PromptSmith] Regenerating...");
        // Retry logic: Call handleOptimization again with same params
        handleOptimization(strategyId, context, injector, ui);
      }
    );
  } catch (err) {
    // On error, show toast (and maybe close preloader or keep it with error?)
    // For now, close preloader implicitly by hiding diff? Or just show error toast?
    // If showReviewLoading is open, user is stuck unless we close or show error.
    // ui.hideDiff() will close the loader.
    ui.hideDiff();
    console.error("[PromptSmith] Optimization Error:", err);
    ui.showToast(err.message, "danger");
  }
}
