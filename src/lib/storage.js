/**
 * PromptSmith Storage Utility
 * Wrapper around chrome.storage.local for type-safe data access.
 */

export const KEYS = {
  APP_CONFIG: "appConfig",
  ENDPOINTS: "endpoints",
  STRATEGIES: "strategies",
};

export const DEFAULT_APP_CONFIG = {
  triggerKey: "Ctrl+Alt+P", // Default shortcut
  showFloatingIcon: true, // Default FAB enabled
  language: "auto", // Default UI language
  outputLanguage: "", // Output language for AI responses (empty = auto/no override)
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
   * @param {string} id
   */
  static async deleteEndpoint(id) {
    const endpoints = await this.getEndpoints();
    const filtered = endpoints.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [KEYS.ENDPOINTS]: filtered });
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
      },
      {
        id: "default_image_gen",
        name: "Make Prompt Better (Image)",
        instruction:
          "Transform the user's idea into a detailed, high-quality prompt optimized for AI image generators (DALL-E, Midjourney, Stable Diffusion, etc.).",
        linkedEndpointId: "",
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
        // Merge: keep user's linkedEndpointId, but ensure name/instruction are correct
        const existing = stored[existingIndex];
        stored[existingIndex] = {
          ...builtin, // Base values (name, instruction, etc.)
          linkedEndpointId: existing.linkedEndpointId || "", // Preserve user's endpoint choice
        };
      } else {
        // Built-in strategy is missing - add it
        stored.push(builtin);
        needsPersist = true;
      }
    }

    // Persist if we added missing built-in strategies
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

    // Protect Built-in Strategy
    if (cleanData[KEYS.STRATEGIES]) {
      // Fetch current local state to preserve the built-in strategy
      const currentStrategies = await this.getStrategies();
      const localDefault = currentStrategies.find(
        (s) => s.id === "default_optimize"
      );

      // Filter out 'default_optimize' from the backup data (prevent overwrite)
      let newStrategies = cleanData[KEYS.STRATEGIES].filter(
        (s) => s.id !== "default_optimize"
      );

      // Restore the local built-in strategy (if existing)
      if (localDefault) {
        // Ensure it's at the beginning or end?
        // Default seeding puts it first?
        // Let's put it at the beginning for consistency.
        newStrategies.unshift(localDefault);
      } else {
        // If for some reason local didn't have it (rare), do we use the backup one?
        // No, user wants to enforce immutability of the *system* version.
        // But if local is missing, maybe we should seed it later?
        // getStrategies() seeds it on read. So if we save without it, next read seeds it.
        // But to be safe, let's just rely on getStrategies() seeding logic if we fail to find it here.
        // Actually, if we save an empty array (or array without default), next getStrategies() call MIGHT seed it if array is empty?
        // Logic: if (!stored || stored.length === 0) -> Seed.
        // If we have other strategies but no default, it WON'T seed.
        // So we MUST ensure it's here.
        // If localDefault is missing (impossible if we called getStrategies), we are fine.
        // getStrategies seeds it if missing. So localDefault WILL be defined.
      }

      cleanData[KEYS.STRATEGIES] = newStrategies;
    }

    await chrome.storage.local.set(cleanData);
  }
}
