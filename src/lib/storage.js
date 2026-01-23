/**
 * PromptSmith Storage Utility
 * Wrapper around chrome.storage.local for type-safe data access.
 */

export const KEYS = {
  APP_CONFIG: "appConfig",
  ENDPOINTS: "endpoints",
  STRATEGIES: "strategies",
  CATEGORIES: "categories",
};

// Default categories for organizing strategies
export const DEFAULT_CATEGORIES = [
  { id: "general", name: "General", order: 0 },
  { id: "image", name: "Image", order: 1 },
  { id: "writing", name: "Writing", order: 2 },
  { id: "coding", name: "Coding", order: 3 },
];

// Default whitelist domains for AI tools
export const DEFAULT_WHITELIST_DOMAINS = [
  "gemini.google.com",
  "aistudio.google.com",
  "chatgpt.com",
  "*.chatgpt.com",
  "openai.com",
  "*.openai.com",
  "grok.com",
  "x.com", // Grok is on X
  "perplexity.ai",
  "*.perplexity.ai",
  "claude.ai",
  "*.claude.ai",
  "anthropic.com",
  "*.anthropic.com",
];

export const DEFAULT_APP_CONFIG = {
  triggerKey: "Alt+P", // Default shortcut
  showFloatingIcon: true, // Default FAB enabled
  language: "auto", // Default UI language
  outputLanguage: "", // Output language for AI responses (empty = auto/no override)
  whitelistEnabled: true, // Default whitelist mode enabled
  customDomains: [], // User's custom whitelist domains
  removedDefaultDomains: [], // Default domains user has removed
  defaultEndpointId: "", // Default endpoint ID for strategies using "__default__"
};

export class StorageService {
  /**
   * Get the full AppConfig object.
   * @returns {Promise<Object>}
   */
  static async getAppConfig() {
    const result = await chrome.storage.local.get(KEYS.APP_CONFIG);
    return { ...DEFAULT_APP_CONFIG, ...(result[KEYS.APP_CONFIG] || {}) };
  }

  /**
   * Save AppConfig updates.
   * @param {Object} config Partial config to update
   */
  static async saveAppConfig(config) {
    const current = await this.getAppConfig();
    const updated = { ...current, ...config };
    await chrome.storage.local.set({ [KEYS.APP_CONFIG]: updated });
  }

  /**
   * Get all defined Endpoints.
   * @returns {Promise<Array>}
   */
  static async getEndpoints() {
    const result = await chrome.storage.local.get(KEYS.ENDPOINTS);
    return result[KEYS.ENDPOINTS] || [];
  }

  /**
   * Save an Endpoint.
   * @param {Object} endpoint
   */
  static async saveEndpoint(endpoint) {
    const endpoints = await this.getEndpoints();
    const index = endpoints.findIndex((e) => e.id === endpoint.id);
    if (index >= 0) {
      endpoints[index] = endpoint;
    } else {
      endpoints.push(endpoint);
    }
    await chrome.storage.local.set({ [KEYS.ENDPOINTS]: endpoints });
  }

  /**
   * Delete an Endpoint by ID.
   * If the deleted endpoint is the default, transfer default to the first remaining endpoint.
   * @param {string} id
   */
  static async deleteEndpoint(id) {
    const endpoints = await this.getEndpoints();
    const config = await this.getAppConfig();
    
    // Check if we're deleting the default endpoint
    const isDeletingDefault = config.defaultEndpointId === id;
    
    const filtered = endpoints.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [KEYS.ENDPOINTS]: filtered });
    
    // If we deleted the default endpoint, transfer to first remaining or clear
    if (isDeletingDefault) {
      const newDefaultId = filtered.length > 0 ? filtered[0].id : "";
      await this.saveAppConfig({ defaultEndpointId: newDefaultId });
    }
  }

  /**
   * Get the default endpoint.
   * Falls back to the first endpoint if defaultEndpointId is invalid or empty.
   * @returns {Promise<Object|null>} The default endpoint or null if no endpoints exist
   */
  static async getDefaultEndpoint() {
    const config = await this.getAppConfig();
    const endpoints = await this.getEndpoints();
    
    if (endpoints.length === 0) {
      return null;
    }
    
    // Try to find the configured default endpoint
    if (config.defaultEndpointId) {
      const defaultEndpoint = endpoints.find(e => e.id === config.defaultEndpointId);
      if (defaultEndpoint) {
        return defaultEndpoint;
      }
    }
    
    // Fallback: use the first endpoint
    return endpoints[0];
  }

  /**
   * Set an endpoint as the default.
   * @param {string} id The endpoint ID to set as default
   */
  static async setDefaultEndpoint(id) {
    await this.saveAppConfig({ defaultEndpointId: id });
  }

  /**
   * Get all Strategies.
   * @returns {Promise<Array>}
   */
  static async getStrategies() {
    const result = await chrome.storage.local.get(KEYS.STRATEGIES);
    let stored = result[KEYS.STRATEGIES] || [];

    // Built-in strategies definition (source of truth)
    const BUILTIN_STRATEGIES = [
      {
        id: "default_optimize",
        name: "Make Prompt Better",
        instruction:
          "Analyze the user's input. Rewrite it into a clear, structured, and high-quality prompt for an LLM. Ensure intent is correctly captured and ambiguity is removed.",
        linkedEndpointId: "",
        categoryId: "general",
      },
      {
        id: "default_image_gen",
        name: "Make Prompt Better (Image)",
        instruction:
          "Transform the user's idea into a detailed, high-quality prompt optimized for AI image generators (DALL-E, Midjourney, Stable Diffusion, etc.).",
        linkedEndpointId: "",
        categoryId: "image",
        // Custom system prompt specifically for image generation
        useCustomSystemPrompt: true,
        systemPrompt: `You are an expert prompt engineer specializing in AI image generation. Your task is to transform user ideas into detailed, high-quality prompts.

**OUTPUT FORMAT:**
Return ONLY the optimized prompt text. Do not include explanations, titles, or markdown formatting.

**PROMPT STRUCTURE:**
1. **Subject**: Describe the main subject with specific details (appearance, pose, expression, clothing)
2. **Scene/Setting**: Environment, background, context
3. **Style**: Art style (photorealistic, anime, oil painting, digital art, watercolor, etc.)
4. **Lighting**: Type and direction (soft natural light, dramatic rim lighting, golden hour, studio lighting)
5. **Mood/Atmosphere**: Emotional tone (serene, dramatic, mysterious, joyful)
6. **Camera/Composition**: Angle, framing (close-up, wide shot, bird's eye view, rule of thirds)
7. **Quality Enhancers**: Technical terms (8K, highly detailed, sharp focus, professional photography)

**GUIDELINES:**
- Be specific and descriptive, not vague
- Use comma-separated descriptive phrases
- Avoid negative terms (use positive descriptions instead)
- Include artistic references when appropriate ("in the style of...")
- Keep the prompt focused and coherent

**EXAMPLE:**
User Input: "a cat in space"
Optimized: "A majestic orange tabby cat floating gracefully in zero gravity, surrounded by distant galaxies and nebulae, cosmic dust particles sparkling around its fur, Earth visible in the background, photorealistic digital art, dramatic rim lighting from a distant star, sense of wonder and adventure, wide shot composition, 8K, highly detailed, cinematic lighting"`,
      },
    ];

    let needsPersist = false;

    // Ensure all built-in strategies exist and have correct base properties
    for (const builtin of BUILTIN_STRATEGIES) {
      const existingIndex = stored.findIndex((s) => s.id === builtin.id);

      if (existingIndex >= 0) {
        // Merge: keep user's linkedEndpointId and categoryId, but ensure name/instruction are correct
        const existing = stored[existingIndex];
        const merged = {
          ...builtin, // Base values (name, instruction, categoryId, etc.)
          linkedEndpointId: existing.linkedEndpointId || "", // Preserve user's endpoint choice
          // Preserve user's category choice (even if empty string for 'Uncategorized'), fallback to builtin default only if undefined
          categoryId:
            existing.categoryId !== undefined
              ? existing.categoryId
              : builtin.categoryId || "",
        };
        // Only mark for persist if something changed
        if (JSON.stringify(stored[existingIndex]) !== JSON.stringify(merged)) {
          stored[existingIndex] = merged;
          needsPersist = true;
        }
      } else {
        // Built-in strategy is missing - add it
        stored.push(builtin);
        needsPersist = true;
      }
    }

    // Persist if we made any changes
    if (needsPersist) {
      await chrome.storage.local.set({ [KEYS.STRATEGIES]: stored });
    }

    return stored;
  }

  /**
   * Save a Strategy.
   * @param {Object} strategy
   */
  static async saveStrategy(strategy) {
    const strategies = await this.getStrategies();
    const index = strategies.findIndex((s) => s.id === strategy.id);
    if (index >= 0) {
      strategies[index] = strategy;
    } else {
      strategies.push(strategy);
    }
    await chrome.storage.local.set({ [KEYS.STRATEGIES]: strategies });
  }

  /**
   * Delete a Strategy by ID.
   * @param {string} id
   */
  static async deleteStrategy(id) {
    // List of protected built-in strategy IDs
    const PROTECTED_IDS = ["default_optimize", "default_image_gen"];

    // Prevent deletion of built-in strategies
    if (PROTECTED_IDS.includes(id)) {
      console.warn("[Storage] Cannot delete built-in strategy:", id);
      return;
    }
    const strategies = await this.getStrategies();
    const filtered = strategies.filter((s) => s.id !== id);
    await chrome.storage.local.set({ [KEYS.STRATEGIES]: filtered });
  }

  // --- Category Methods ---

  /**
   * Get all categories.
   * @returns {Promise<Array>}
   */
  static async getCategories() {
    const result = await chrome.storage.local.get(KEYS.CATEGORIES);
    let stored = result[KEYS.CATEGORIES];

    // Only seed default categories on first run (when key doesn't exist)
    if (!stored) {
      stored = [...DEFAULT_CATEGORIES];
      await chrome.storage.local.set({ [KEYS.CATEGORIES]: stored });
    }

    // Sort by order
    return stored.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Save a category.
   * @param {Object} category
   */
  static async saveCategory(category) {
    const categories = await this.getCategories();
    const index = categories.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      categories[index] = category;
    } else {
      // New category - assign next order
      category.order = categories.length;
      categories.push(category);
    }
    await chrome.storage.local.set({ [KEYS.CATEGORIES]: categories });
  }

  /**
   * Delete a category by ID. Strategies linked to this category become uncategorized.
   * @param {string} id
   */
  static async deleteCategory(id) {
    const categories = await this.getCategories();
    const filtered = categories.filter((c) => c.id !== id);
    await chrome.storage.local.set({ [KEYS.CATEGORIES]: filtered });

    // Clear categoryId from strategies that used this category
    const strategies = await this.getStrategies();
    let updated = false;
    for (const s of strategies) {
      if (s.categoryId === id) {
        s.categoryId = "";
        updated = true;
      }
    }
    if (updated) {
      await chrome.storage.local.set({ [KEYS.STRATEGIES]: strategies });
    }

    return true;
  }

  /**
   * Get all data for backup.
   * @returns {Promise<Object>}
   */
  static async getBackupData() {
    const keys = Object.values(KEYS);
    const result = await chrome.storage.local.get(keys);
    return result;
  }

  /**
   * Restore data from backup.
   * @param {Object} data
   */
  static async restoreBackupData(data) {
    const validKeys = Object.values(KEYS);
    const cleanData = {};

    validKeys.forEach((key) => {
      if (data[key] !== undefined) {
        cleanData[key] = data[key];
      }
    });

    if (Object.keys(cleanData).length === 0) {
      throw new Error("Invalid backup file: No recognized data found.");
    }

    // Built-in strategies are protected by getStrategies() merging logic.
    // We allow importing them here to preserve user's linkedEndpointId and categoryId preferences.
    if (cleanData[KEYS.STRATEGIES]) {
      // No filtering needed for default_optimize
    }

    await chrome.storage.local.set(cleanData);
  }
}
