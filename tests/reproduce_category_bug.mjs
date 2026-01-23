// tests/reproduce_category_bug.mjs

// Mock chrome global
global.chrome = {
  storage: {
    local: {
      data: {},
      get: async (keys) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = global.chrome.storage.local.data[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => result[k] = global.chrome.storage.local.data[k]);
        }
        return result;
      },
      set: async (items) => {
        Object.assign(global.chrome.storage.local.data, items);
      }
    }
  }
};

import { StorageService, KEYS } from '../src/lib/storage.js';

async function runTest() {
  console.log("Starting Reproduction Test...");

  // 1. Setup: Define a built-in strategy but with category explicitly set to "" (Uncategorized)
  // The built-in strategy "default_optimize" usually has category "general".
  const userModifiedStrategy = {
    id: "default_optimize",
    name: "Make Prompt Better",
    instruction: "Some instruction...",
    linkedEndpointId: "",
    categoryId: "" // USER WANTS IT UNCATEGORIZED
  };

  // Seed storage
  await chrome.storage.local.set({
    [KEYS.STRATEGIES]: [userModifiedStrategy]
  });

  console.log("Storage seeded with strategy having categoryId: ''");

  // 2. Action: Call getStrategies()
  // This triggers the logic that merges built-in defaults.
  const strategies = await StorageService.getStrategies();
  const targetStrategy = strategies.find(s => s.id === "default_optimize");

  // 3. Assertion
  console.log("Retrieved Strategy Category:", `"${targetStrategy.categoryId}"`);

  if (targetStrategy.categoryId === "") {
    console.log("PASS: Category ID remained empty.");
  } else if (targetStrategy.categoryId === "general") {
    console.error("FAIL: Category ID was overwritten by default 'general'.");
    process.exit(1);
  } else {
    console.error(`FAIL: Unexpected Category ID: ${targetStrategy.categoryId}`);
    process.exit(1);
  }

  // 4. Verify secondary case: If user never touched it (undefined in storage), it SHOULD default.
  console.log("\nTesting fallback for missing category...");

  // Clear storage
  global.chrome.storage.local.data = {};

  // Seed with strategy MISSING categoryId
  const legacyStrategy = {
      id: "default_optimize",
      name: "Old Version Strategy",
      instruction: "...",
      linkedEndpointId: ""
      // categoryId is missing
  };
   await chrome.storage.local.set({
    [KEYS.STRATEGIES]: [legacyStrategy]
  });

  const strategies2 = await StorageService.getStrategies();
  const targetStrategy2 = strategies2.find(s => s.id === "default_optimize");

  if (targetStrategy2.categoryId === "general") {
      console.log("PASS: Fallback correctly applied when categoryId is missing.");
  } else {
      console.error(`FAIL: Fallback failed. Expected 'general', got '${targetStrategy2.categoryId}'`);
      process.exit(1);
  }
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
