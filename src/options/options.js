/**
 * PromptSmith Options Logic (Simplified)
 */
import {
  StorageService,
  DEFAULT_WHITELIST_DOMAINS,
  DEFAULT_CATEGORIES,
} from "../lib/storage.js";
import {
  RequestAdapter,
  PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
} from "../content/modules/adapters.js";
import { I18nService } from "../lib/i18n.js";
import { DomainMatcher } from "../lib/domainMatcher.js";

const elements = {
  navItems: document.querySelectorAll(".nav-item"),
  tabContents: document.querySelectorAll(".tab-content"),
  endpointList: document.getElementById("endpointList"),
  strategyList: document.getElementById("strategyList"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalForm: document.getElementById("modalForm"),
  modalTitle: document.getElementById("modalTitle"),
  addEndpointBtn: document.getElementById("addEndpointBtn"),
  addStrategyBtn: document.getElementById("addStrategyBtn"),
  saveModalBtn: document.getElementById("saveModalBtn"),
  closeModalBtns: document.querySelectorAll(".close-modal"),
};

// --- History Logic ---

// Helper to escape HTML for safe display
function escapeHtml(unsafe) {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmptyState(container, icon, message, tone = "muted") {
  if (!container) return;
  const toneStyle = tone === "danger" ? ' style="color:var(--danger)"' : "";
  container.innerHTML = `
    <div class="empty-state"${toneStyle}>
      <i class="fa-solid ${icon}" aria-hidden="true"></i>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function initHistoryTab() {
  const listContainer = document.getElementById("historyList");
  const searchInput = document.getElementById("historySearch");
  const clearBtn = document.getElementById("clearHistoryBtn");
  
  // Custom Dropdown Elements
  const dropdown = document.getElementById("historyStrategyDropdown");
  const dropdownTrigger = dropdown.querySelector(".custom-dropdown-trigger");
  const dropdownMenu = dropdown.querySelector(".custom-dropdown-menu");
  const dropdownText = dropdown.querySelector(".trigger-text");
  
  let currentStrategyFilter = ""; // State for selected filter

  const renderHistory = async (query = "", strategy = "") => {
    try {
      const items = await StorageService.getHistory({ query, strategy });
      listContainer.innerHTML = "";
      
      // Populate Dropdown Options (based on ALL history)
      // Only if menu is empty to persist selection state easily
      // But we should refresh if new strategies appear? For now, refresh on clear/load.
      if (dropdownMenu.children.length === 0) {
          const allHistory = await StorageService.getHistory(); 
          const strategies = new Set(allHistory.map(i => i.strategy).filter(Boolean));
          const sorted = Array.from(strategies).sort();
          
          dropdownMenu.innerHTML = "";
          
          // "All Strategies" Option
          const allOption = document.createElement("div");
          allOption.className = "custom-dropdown-option";
          allOption.dataset.value = "";
          if (strategy === "") allOption.classList.add("selected");
          allOption.innerHTML = `<span class="option-text" data-i18n="placeholderFilterStrategy">Filter by strategy...</span>`;
          allOption.onclick = () => {
              selectStrategy("", I18nService.t("placeholderFilterStrategy") || "Filter by strategy...");
          };
          dropdownMenu.appendChild(allOption);
          
          sorted.forEach(s => {
             const opt = document.createElement("div");
             opt.className = "custom-dropdown-option";
             opt.dataset.value = s;
             if (s === strategy) opt.classList.add("selected");
             opt.innerHTML = `<span class="option-text">${escapeHtml(s)}</span>`;
             opt.onclick = () => {
                 selectStrategy(s, s);
             };
             dropdownMenu.appendChild(opt);
          });
      }

      if (items.length === 0) {
        renderEmptyState(
          listContainer,
          "fa-clock-rotate-left",
          I18nService.t("noHistory") || "No history records found."
        );
        return;
      }

      items.forEach(item => {
        const card = document.createElement("div");
        card.className = "history-card";
        
        const timeStr = new Date(item.timestamp).toLocaleString();
        const strategyName = escapeHtml(item.strategy || "Unknown Strategy");
        const endpointName = escapeHtml(item.endpoint || "Unknown Endpoint");

        card.innerHTML = `
          <!-- Header -->
          <div class="history-header-row">
             <span class="history-strategy-badge">
               <i class="fa-solid fa-wand-magic-sparkles"></i> ${strategyName}
             </span>
             <span class="history-time">${timeStr}</span>
          </div>
          
          <!-- Body -->
          <div class="history-body-row">
             <!-- Original Column -->
             <div class="history-col original">
                <div class="col-label"><i class="fa-regular fa-file-lines"></i> ${I18nService.t("lblOriginal") || "ORIGINAL"}</div>
                <div class="col-content">${escapeHtml(item.originalText)}</div>
             </div>
             
             <!-- Optimized Column -->
             <div class="history-col optimized">
                <div class="col-label opt"><i class="fa-solid fa-check"></i> ${I18nService.t("lblOptimized") || "OPTIMIZED"}</div>
                <div class="col-content">${escapeHtml(item.optimizedResult)}</div>
             </div>
          </div>
          
          <!-- Footer -->
          <div class="history-footer-row">
             <span class="endpoint-info">
                <i class="fa-solid fa-server"></i> ${endpointName}
             </span>
             <div class="history-actions">
                <button class="btn-secondary copy-btn" title="${I18nService.t("btnCopy") || "Copy Result"}">
                   <i class="fa-regular fa-copy"></i> ${I18nService.t("btnCopy") || "Copy"}
                </button>
             </div>
          </div>
        `;

        // Bind Copy
        const copyBtn = card.querySelector(".copy-btn");
        if(copyBtn) {
            copyBtn.onclick = () => {
                 navigator.clipboard.writeText(item.optimizedResult).then(() => {
                     showToast(I18nService.t("tooltipCopied") || "Copied to clipboard", "success");
                 }).catch(() => {
                     showToast(I18nService.t("errCopyFailed") || "Could not copy to clipboard", "danger");
                 });
            };
        }
        
        listContainer.appendChild(card);
      });

    } catch (e) {
      console.error("Error loading history:", e);
      renderEmptyState(
        listContainer,
        "fa-triangle-exclamation",
        I18nService.t("errHistoryLoad") || "Could not load history.",
        "danger"
      );
      showToast(I18nService.t("errHistoryLoad") || "Could not load history", "danger");
    }
  };

  // Dropdown Logic
  const selectStrategy = (value, label) => {
      currentStrategyFilter = value;
      dropdownText.textContent = label;
      dropdown.classList.remove("open");
      
      // Update Selection UI
      const options = dropdownMenu.querySelectorAll(".custom-dropdown-option");
      options.forEach(opt => {
         if (opt.dataset.value === value) {
             opt.classList.add("selected");
         } else {
             opt.classList.remove("selected");
         }
      });
      
      renderHistory(searchInput.value, currentStrategyFilter);
  };
  
  dropdownTrigger.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
  };
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("open");
      }
  });


  // Initial Render
  renderHistory();

  // Search
  let debounce;
  const handleInput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
        renderHistory(searchInput.value, currentStrategyFilter);
    }, 300);
  };

  searchInput.oninput = handleInput;

  // Clear All
  clearBtn.onclick = async () => {
    if (confirm(I18nService.t("confirmClearHistory") || "Clear all history records? This cannot be undone.")) {
        await StorageService.clearHistory();
        currentStrategyFilter = ""; // Reset filter
        dropdownText.innerText = I18nService.t("placeholderFilterStrategy") || "Filter by strategy...";
        dropdownMenu.innerHTML = ""; // Clear dropdown cache
        renderHistory();
        showToast(I18nService.t("toastHistoryCleared") || "History cleared", "success");
    }
  };
}

// Global Toast (reusing existing if available, or simple impl)
function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
        console.warn("Toast container not found. Cannot display toast:", message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("visible");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("visible");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
let currentModalMode = null; // 'endpoint' or 'strategy'
let currentEditId = null;
let modalPreviouslyFocused = null;
let modalAbortController = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await I18nService.init(); // Initialize i18n first
  I18nService.apply(); // Apply to static HTML

  setupNavigation();
  setupModal();
  await loadEndpoints();
  await loadCategories(); // Load categories before strategies
  await loadStrategies();
  await loadSettings();
  await loadWhitelistSettings(); // Load whitelist settings
  initHistoryTab(); // Initialize History Tab

  // Single Source of Truth: Inject Version from Manifest
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById("extensionVersion");
  if (versionEl) {
    versionEl.textContent = `v${manifest.version}`;
  }
});

// Navigation
function setupNavigation() {
  elements.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // Remove active class
      elements.navItems.forEach((nav) => nav.classList.remove("active"));
      elements.tabContents.forEach((tab) => tab.classList.remove("active"));
      elements.navItems.forEach((nav) => nav.setAttribute("aria-selected", "false"));

      // Add active class
      item.classList.add("active");
      item.setAttribute("aria-selected", "true");
      const tabId = item.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
}

// Modal Handlers
function setupModal() {
  elements.addEndpointBtn.addEventListener("click", () =>
    openModal("endpoint")
  );
  elements.addStrategyBtn.addEventListener("click", () =>
    openModal("strategy")
  );
  elements.closeModalBtns.forEach((btn) =>
    btn.addEventListener("click", closeModal)
  );
  elements.modalForm.addEventListener("submit", handleSave);

  // Delegate test button logic
  elements.modalForm.addEventListener("click", async (e) => {
    if (e.target.closest("#testEndpointBtn")) {
      await handleTestConnection();
    }
  });

  elements.modalOverlay.addEventListener("click", (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elements.modalOverlay.classList.contains("hidden")) {
      e.preventDefault();
      closeModal();
    }
  });

  setupSettingsListeners(); // Add listener for settings
  setupWhitelistListeners(); // Add listener for whitelist
}

// --- Settings Logic ---

async function loadSettings() {
  const config = await StorageService.getAppConfig();
  const triggerInput = document.getElementById("triggerKey");
  const floatToggle = document.getElementById("showFloatingIcon");
  const langSelect = document.getElementById("languageSelect");
  const outputLangInput = document.getElementById("outputLanguage");

  if (triggerInput) triggerInput.value = config.triggerKey || "Alt+P";
  if (floatToggle) floatToggle.checked = config.showFloatingIcon !== false;
  if (langSelect) langSelect.value = config.language || "auto";
  if (outputLangInput) outputLangInput.value = config.outputLanguage || "";
}

function setupSettingsListeners() {
  const triggerInput = document.getElementById("triggerKey");
  const floatToggle = document.getElementById("showFloatingIcon");
  const langSelect = document.getElementById("languageSelect");
  const outputLangInput = document.getElementById("outputLanguage");

  if (langSelect) {
    langSelect.addEventListener("change", async (e) => {
      await StorageService.saveAppConfig({ language: e.target.value });
      showToast(I18nService.t("toastReloading"), "info");
      setTimeout(() => location.reload(), 500);
    });
  }

  if (outputLangInput) {
    // Save on blur (when user finishes editing)
    outputLangInput.addEventListener("change", async (e) => {
      await StorageService.saveAppConfig({ outputLanguage: e.target.value });
      showToast(I18nService.t("toastSaved"), "success");
    });
  }

  if (floatToggle) {
    floatToggle.addEventListener("change", async (e) => {
      await StorageService.saveAppConfig({
        showFloatingIcon: e.target.checked,
      });
    });
  }

  if (triggerInput) {
    triggerInput.addEventListener("keydown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore standalone modifiers
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.metaKey) parts.push("Cmd"); // Save as Cmd for display, logic treats as Meta
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      // Key Code mapping for letters to uppercase
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(key);

      const shortcut = parts.join("+");
      triggerInput.value = shortcut;

      // Auto save
      StorageService.saveAppConfig({ triggerKey: shortcut });
    });
  }

  // Backup Listeners
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  if (exportBtn) {
    exportBtn.addEventListener("click", handleExport);
  }
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", handleImport);
  }
}

// --- Whitelist Logic ---

async function loadWhitelistSettings() {
  const config = await StorageService.getAppConfig();
  const toggle = document.getElementById("whitelistEnabled");
  const content = document.getElementById("whitelistContent");

  if (toggle) {
    toggle.checked = config.whitelistEnabled !== false;
  }
  if (content) {
    content.classList.toggle("disabled", !toggle?.checked);
  }

  renderDomainLists(
    config.customDomains || [],
    config.removedDefaultDomains || []
  );
}

function renderDomainLists(customDomains, removedDefaultDomains = []) {
  // Filter out removed default domains
  const activeDefaults = DEFAULT_WHITELIST_DOMAINS.filter(
    (d) => !removedDefaultDomains.includes(d)
  );

  // Render default domains (now deletable)
  const defaultList = document.getElementById("defaultDomainsList");
  if (defaultList) {
    defaultList.innerHTML = activeDefaults.length
      ? activeDefaults
          .map(
            (d) => `<span class="domain-chip default">
              ${escapeHtml(d)}
              <button type="button" class="remove-btn remove-default-btn" data-domain="${escapeHtml(d)}"
                aria-label="${escapeHtml(I18nService.t("btnDelete"))}">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>`
          )
          .join("")
      : `<span style="color:var(--text-muted); font-size:12px;">${I18nService.t(
          "noDefaultDomains"
        )}</span>`;
  }

  // Render custom domains
  const customList = document.getElementById("customDomainsList");
  if (customList) {
    customList.innerHTML = customDomains.length
      ? customDomains
          .map(
            (d) => `<span class="domain-chip">
              ${escapeHtml(d)}
              <button type="button" class="remove-btn" data-domain="${escapeHtml(d)}"
                aria-label="${escapeHtml(I18nService.t("btnDelete"))}">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>`
          )
          .join("")
      : `<span style="color:var(--text-muted); font-size:12px;" data-i18n="noCustomDomains">${I18nService.t(
          "noCustomDomains"
        )}</span>`;
  }
}

function setupWhitelistListeners() {
  const toggle = document.getElementById("whitelistEnabled");
  const content = document.getElementById("whitelistContent");
  const addBtn = document.getElementById("addDomainBtn");
  const input = document.getElementById("newDomainInput");
  const customList = document.getElementById("customDomainsList");
  const defaultList = document.getElementById("defaultDomainsList");

  // Toggle whitelist on/off
  if (toggle && content) {
    toggle.addEventListener("change", async (e) => {
      content.classList.toggle("disabled", !e.target.checked);
      await StorageService.saveAppConfig({
        whitelistEnabled: e.target.checked,
      });
      showToast(I18nService.t("toastSaved"), "success");
    });
  }

  // Add domain
  if (addBtn && input) {
    addBtn.addEventListener("click", async () => {
      const domain = DomainMatcher.normalizeDomain(input.value);
      if (!domain) return;

      // Validate format
      if (!DomainMatcher.isValidPattern(domain)) {
        showToast(I18nService.t("errInvalidDomain"), "danger");
        return;
      }

      const config = await StorageService.getAppConfig();
      const domains = config.customDomains || [];

      if (domains.includes(domain)) {
        showToast(I18nService.t("errDomainExists"), "danger");
        return;
      }

      domains.push(domain);
      await StorageService.saveAppConfig({ customDomains: domains });
      input.value = "";
      renderDomainLists(domains, config.removedDefaultDomains || []);
      showToast(I18nService.t("toastSaved"), "success");
    });

    // Enter key to add
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });
  }

  // Remove custom domain
  if (customList) {
    customList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".remove-btn");
      if (!btn) return;

      const domain = btn.dataset.domain;
      const config = await StorageService.getAppConfig();
      const domains = (config.customDomains || []).filter((d) => d !== domain);
      await StorageService.saveAppConfig({ customDomains: domains });
      renderDomainLists(domains, config.removedDefaultDomains || []);
      showToast(I18nService.t("toastDeleted"), "success");
    });
  }

  // Remove default domain
  if (defaultList) {
    defaultList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".remove-default-btn");
      if (!btn) return;

      const domain = btn.dataset.domain;
      const config = await StorageService.getAppConfig();
      const removed = config.removedDefaultDomains || [];

      if (!removed.includes(domain)) {
        removed.push(domain);
        await StorageService.saveAppConfig({ removedDefaultDomains: removed });
        renderDomainLists(config.customDomains || [], removed);
        showToast(I18nService.t("toastDeleted"), "success");
      }
    });
  }
}

// --- Category Logic ---

async function loadCategories() {
  const categories = await StorageService.getCategories();
  const list = document.getElementById("categoryList");

  if (list) {
    list.innerHTML = categories
      .map(
        (
          c,
          index
        ) => `<span class="category-chip" draggable="true" data-id="${escapeHtml(c.id)}" data-index="${index}">
          <i class="fa-solid fa-grip-vertical drag-handle"></i>
          ${escapeHtml(c.name)}
          <button type="button" class="remove-btn" data-id="${escapeHtml(c.id)}"
            aria-label="${escapeHtml(I18nService.t("btnDelete"))}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>`
      )
      .join("");

    // Drag and drop reordering
    const chips = list.querySelectorAll(".category-chip");
    let draggedItem = null;

    chips.forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        draggedItem = chip;
        chip.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        draggedItem = null;
        // Save new order
        saveNewCategoryOrder();
      });

      chip.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === chip) return;

        const rect = chip.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        if (e.clientX < midX) {
          chip.parentNode.insertBefore(draggedItem, chip);
        } else {
          chip.parentNode.insertBefore(draggedItem, chip.nextSibling);
        }
      });
    });

    // Save new order to storage
    async function saveNewCategoryOrder() {
      const newOrder = [];
      list.querySelectorAll(".category-chip").forEach((chip, index) => {
        const cat = categories.find((c) => c.id === chip.dataset.id);
        if (cat) {
          cat.order = index;
          newOrder.push(cat);
        }
      });

      // Save each category with updated order
      for (const cat of newOrder) {
        await StorageService.saveCategory(cat);
      }
    }

    // Delete category handler
    list.onclick = async (e) => {
      const btn = e.target.closest(".remove-btn");
      if (!btn) return;

      const id = btn.dataset.id;
      const confirmed = await showConfirmToast(
        I18nService.t("confirmDeleteCategory")
      );
      if (confirmed) {
        await StorageService.deleteCategory(id);
        loadCategories();
        loadStrategies();
        showToast(I18nService.t("toastDeleted"), "success");
      }
    };
  }

  // Add category handler
  const addBtn = document.getElementById("addCategoryBtn");
  const input = document.getElementById("newCategoryInput");

  if (addBtn && input) {
    addBtn.onclick = async () => {
      const name = input.value.trim();
      if (!name) return;

      const categories = await StorageService.getCategories();
      if (categories.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
        showToast(I18nService.t("errCategoryExists"), "danger");
        return;
      }

      const id = "cat_" + Date.now();
      await StorageService.saveCategory({ id, name });
      input.value = "";
      loadCategories();
      showToast(I18nService.t("toastSaved"), "success");
    };

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });
  }
}

// Helper to populate category select in strategy form
async function populateCategorySelect(selectedId) {
  const select = document.getElementById("categorySelect");
  if (!select) return;

  const categories = await StorageService.getCategories();
  select.innerHTML =
    `<option value="">${I18nService.t("lblUncategorized")}</option>` +
    categories
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? "selected" : ""}>${
            escapeHtml(c.name)
          }</option>`
      )
      .join("");
}

async function handleExport() {
  try {
    const data = await StorageService.getBackupData();
    const json = JSON.stringify(data, null, 2);

    // Date format: YYYYMMDD_hhmmss
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const filename = `PromptSmith_${timestamp}.json`;

    // Download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    showToast(I18nService.t("toastExportFail", [e.message]), "danger");
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const json = JSON.parse(event.target.result);
      await StorageService.restoreBackupData(json);
      showToast(I18nService.t("toastImportSuccess"), "success");
      // Reload to reflect changes
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast(I18nService.t("toastImportFail", [err.message]), "danger");
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be selected again
  e.target.value = "";
}

// --- Simplified Endpoint Form ---
function getEndpointForm(data) {
  data = data || {};
  const provider = data.provider || PROVIDERS.OPENAI;

  return `
    <div class="form-group">
      <label>${I18nService.t("lblProviderType")}</label>
      <select name="provider" id="providerSelect">
        <option value="${PROVIDERS.OPENAI}" ${
    provider === PROVIDERS.OPENAI ? "selected" : ""
  }>OpenAI Compatible (ChatGPT, LocalAI, LM Studio)</option>
        <option value="${PROVIDERS.GEMINI}" ${
    provider === PROVIDERS.GEMINI ? "selected" : ""
  }>Gemini (Google AI / Local Proxy)</option>
        <option value="${PROVIDERS.ANTHROPIC}" ${
    provider === PROVIDERS.ANTHROPIC ? "selected" : ""
  }>Anthropic (Claude)</option>
      </select>
    </div>

    <div class="form-group">
      <label>${I18nService.t("lblName")}</label>
      <input type="text" name="name" value="${
        escapeHtml(data.name)
      }" placeholder="My AI Model" required>
    </div>

    <div class="form-group">
      <label>${I18nService.t("lblUrl")}</label>
      <input type="text" name="url" id="urlInput" value="${
        escapeHtml(data.url)
      }" placeholder="https://api.openai.com/v1/chat/completions" required>
      <div id="urlHint" class="subtitle" style="margin-top:4px; font-size:11px; opacity:0.7"></div>
    </div>
    
    <div class="form-group">
      <label>${I18nService.t("lblApiKey")}</label>
      <input type="password" name="apiKey" value="${
        escapeHtml(data.apiKey)
      }" placeholder="sk-...">
    </div>

    <div class="form-group">
      <label>${I18nService.t("lblModel")}</label>
      <input type="text" name="model" value="${
        escapeHtml(data.model)
      }" placeholder="gpt-4, gemini-pro, llama3...">
    </div>

    <div class="test-area" style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border)">
        <button type="button" id="testEndpointBtn" class="btn-secondary">${I18nService.t(
          "btnTestConnection"
        )}</button>
        <span id="testResult" style="margin-left:10px; font-size:12px;"></span>
    </div>
  `;
}

// Window level helper for dynamic UI updates
// Window level helper for dynamic UI updates
window.updatePlaceholder = (provider) => {
  const urlInput = document.getElementById("urlInput");
  const hint = document.getElementById("urlHint");
  const modelInput = document.querySelector('input[name="model"]');

  if (provider === PROVIDERS.OPENAI) {
    if (urlInput)
      urlInput.placeholder = "https://api.openai.com/v1/chat/completions";
    if (hint)
      hint.textContent =
        "Standard OpenAI format. For local proxies: http://localhost:1234/v1/chat/completions";
    if (modelInput) modelInput.placeholder = "gpt-4o, gpt-3.5-turbo";
  } else if (provider === PROVIDERS.GEMINI) {
    if (urlInput)
      urlInput.placeholder =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    if (hint)
      hint.textContent =
        "Gemini format: .../models/{model-name}:generateContent";
    if (modelInput) modelInput.placeholder = "gemini-1.5-flash";
  } else if (provider === PROVIDERS.ANTHROPIC) {
    if (urlInput)
      urlInput.placeholder = "https://api.anthropic.com/v1/messages";
    if (hint)
      hint.textContent = "Anthropic format: v1/messages (via Messages API)";
    if (modelInput) modelInput.placeholder = "claude-3-5-sonnet-20240620";
  }
};

// --- Strategy Form (Same as before) ---
function getStrategyForm(data) {
  data = data || {};
  const isBuiltIn = ["default_optimize", "default_image_gen"].includes(data.id);
  setTimeout(populateEndpointSelect, 0, data.linkedEndpointId);
  setTimeout(populateCategorySelect, 0, data.categoryId);

  return `
    <div class="form-group">
      <label>${I18nService.t("lblStrategyName")} ${
    isBuiltIn
      ? `<span class="endpoint-tag" style="background:#f1f5f9; color:#64748b; margin-left:8px;">${I18nService.t(
          "tagBuiltIn"
        )}</span>`
      : ""
  }</label>
      <input type="text" name="name" value="${
        escapeHtml(data.name)
      }" placeholder="e.g., Fix Grammar" ${
    isBuiltIn
      ? 'disabled style="background-color:var(--bg-sidebar); cursor:not-allowed; opacity:0.7;"'
      : ""
      } required>
    </div>
    <div class="form-group">
      <label>${I18nService.t("lblInstruction")}</label>
      <textarea name="instruction" placeholder="You are a helpful assistant..." ${
        isBuiltIn
          ? 'disabled style="background-color:var(--bg-sidebar); cursor:not-allowed; opacity:0.7;"'
          : ""
      } required>${escapeHtml(data.instruction)}</textarea>
    </div>
    <div class="form-group">
      <label>${I18nService.t("lblLinkedEndpoint")}</label>
      <div id="endpointDropdownContainer"></div>
      <input type="hidden" name="linkedEndpointId" id="endpointSelectValue" value="${escapeHtml(data.linkedEndpointId)}">
    </div>
    <div class="form-group">
      <label>${I18nService.t("lblCategory")}</label>
      <select name="categoryId" id="categorySelect">
        <option>Loading...</option>
      </select>
    </div>

    ${
      isBuiltIn
        ? `
        <div style="margin-top:24px; padding:12px; background:var(--bg-sidebar); border-radius:var(--radius); border:1px solid var(--border);">
            <p style="font-size:12px; color:var(--text-muted); margin:0; line-height:1.4;">
                ${I18nService.t("builtInNote")}
            </p>
        </div>
        `
        : `
    <!-- Advanced Section -->
    <details style="margin-top:24px; border-top:1px solid var(--border); padding-top:16px;" ${
      data.useCustomSystemPrompt ? "open" : ""
    }>
        <summary style="cursor:pointer; font-weight:600; font-size:13px; color:var(--text-muted); user-select:none; margin-bottom:16px; outline:none;">${I18nService.t(
          "lblAdvanced"
        )}</summary>
        
        <div style="padding-left:4px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                <label for="useCustomSys" style="margin:0; font-size:13px; font-weight:500; color:var(--text-main); cursor:pointer;">${I18nService.t(
                  "lblCustomSystemPrompt"
                )}</label>
                <label class="toggle-switch">
                    <input type="checkbox" name="useCustomSystemPrompt" id="useCustomSys" ${
                      data.useCustomSystemPrompt ? "checked" : ""
                    }>
                    <span class="slider"></span>
                </label>
            </div>
            
            <div id="advancedArea" class="${
              data.useCustomSystemPrompt ? "" : "hidden"
            }">
                <div class="form-group">
                    <textarea name="systemPrompt" style="min-height:150px; font-size:12px; font-family:'Menlo', monospace; line-height:1.5; width:100%;" placeholder="Default System Prompt...">${
                      escapeHtml(data.systemPrompt || DEFAULT_SYSTEM_PROMPT)
                    }</textarea>
                    <div class="subtitle" style="margin-top:6px;">${I18nService.t(
                      "hintSystemPrompt"
                    )}</div>
                </div>
            </div>
        </div>
    </details>
    `
    }
  `;
}

/**
 * Create a custom dropdown component with support for default endpoint option
 */
function createCustomDropdown(container, options, selectedValue, onChange) {
  if (!container) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  
  // Find current selection display text
  let displayText = I18nService.t("txtSelectEndpoint") || "-- Select Endpoint --";
  let displayTag = null;
  
  for (const opt of options) {
    if (opt.value === selectedValue) {
      displayText = opt.label;
      displayTag = opt.tag || null;
      break;
    }
  }
  
  // Create trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-dropdown-trigger';
  trigger.innerHTML = `
    <span class="trigger-content">
      <span class="trigger-text">${escapeHtml(displayText)}</span>
      ${displayTag ? `<span class="custom-dropdown-tag small">${escapeHtml(displayTag)}</span>` : ''}
    </span>
    <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
  `;
  
  // Create menu
  const menu = document.createElement('div');
  menu.className = 'custom-dropdown-menu';
  
  options.forEach(opt => {
    const optionEl = document.createElement('div');
    optionEl.className = 'custom-dropdown-option' + 
      (opt.isDefault ? ' default-option' : '') +
      (opt.value === selectedValue ? ' selected' : '');
    optionEl.dataset.value = opt.value;
    
    optionEl.innerHTML = `
      <span class="option-text">${escapeHtml(opt.label)}</span>
      ${opt.tag ? `<span class="custom-dropdown-tag">${escapeHtml(opt.tag)}</span>` : ''}
    `;
    
    optionEl.addEventListener('click', () => {
      // Update hidden input
      const hiddenInput = document.getElementById('endpointSelectValue');
      if (hiddenInput) hiddenInput.value = opt.value;
      
      // Update trigger display
      trigger.querySelector('.trigger-text').textContent = opt.label;
      const existingTag = trigger.querySelector('.custom-dropdown-tag');
      if (existingTag) existingTag.remove();
      if (opt.tag) {
        const tagEl = document.createElement('span');
        tagEl.className = 'custom-dropdown-tag small';
        tagEl.textContent = opt.tag;
        trigger.querySelector('.trigger-content').appendChild(tagEl);
      }
      
      // Update selected state
      menu.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('selected'));
      optionEl.classList.add('selected');
      
      // Close dropdown
      wrapper.classList.remove('open');
      
      // Callback
      if (onChange) onChange(opt.value);
    });
    
    menu.appendChild(optionEl);
  });
  
  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    wrapper.classList.toggle('open');
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove('open');
    }
  }, modalAbortController ? { signal: modalAbortController.signal } : undefined);
  
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  
  container.innerHTML = '';
  container.appendChild(wrapper);
}

async function populateEndpointSelect(selectedId) {
  const endpoints = await StorageService.getEndpoints();
  const config = await StorageService.getAppConfig();
  const container = document.getElementById("endpointDropdownContainer");
  if (!container) return;
  
  // Build options array
  const options = [];
  
  // Get default endpoint name for display
  let defaultEndpointName = '';
  if (config.defaultEndpointId) {
    const defaultEp = endpoints.find(e => e.id === config.defaultEndpointId);
    if (defaultEp) defaultEndpointName = defaultEp.name;
  } else if (endpoints.length > 0) {
    defaultEndpointName = endpoints[0].name; // Fallback
  }
  
  // Add "Use Default Endpoint" option first
  if (endpoints.length > 0) {
    const defaultLabel = I18nService.t("txtUseDefaultEndpoint") || "Use Default Endpoint";
    options.push({
      value: "__default__",
      label: defaultLabel,
      tag: defaultEndpointName ? `${I18nService.t("tagDefault") || "Default"}: ${defaultEndpointName}` : null,
      isDefault: true
    });
  }
  
  // Add all endpoints
  endpoints.forEach(e => {
    options.push({
      value: e.id,
      label: e.name,
      tag: null,
      isDefault: false
    });
  });
  
  // If no endpoints, show message
  if (endpoints.length === 0) {
    container.innerHTML = `<div class="inline-notice">
      ${escapeHtml(I18nService.t("noEndpoints") || "No endpoints found. Create one first.")}
    </div>`;
    return;
  }
  
  // Default to "__default__" for new strategies if no selection
  const effectiveSelectedId = selectedId || "__default__";
  createCustomDropdown(container, options, effectiveSelectedId);
}

// --- Logic ---

async function handleTestConnection() {
  if (!elements.modalForm.reportValidity()) return;

  const btn = document.getElementById("testEndpointBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = I18nService.t("btnTestSending");
  }

  const formData = new FormData(elements.modalForm);
  const data = Object.fromEntries(formData.entries());
  const resultSpan = document.getElementById("testResult");

  resultSpan.textContent = "Testing...";
  resultSpan.style.color = "var(--text-muted)";

  // Use Adapter to build request
  const config = {
    provider: data.provider,
    url: data.url,
    apiKey: data.apiKey,
    model: data.model,
  };

  const request = RequestAdapter.buildRequest(
    config,
    "Hello World",
    "Say hi back"
  );

  console.log("[Test Connection] Sending:", request);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "EXECUTE_REQUEST",
      payload: request,
    });

    if (!response.success) throw new Error(response.error);

    const { status, statusText, data: apiJson } = response.data;
    const outputText = RequestAdapter.parseResponse(data.provider, apiJson);

    if (status >= 200 && status < 300) {
      // Basic success check: did we get ANY text back?
      if (outputText && outputText.length > 0) {
        resultSpan.innerHTML = `${I18nService.t(
          "msgTestSuccess"
        )}<br><em style="opacity:0.8">Output: "${escapeHtml(
          outputText.substring(0, 50)
        )}${outputText.length > 50 ? "..." : ""}"</em>`;
        resultSpan.style.color = "var(--success)";
      } else {
        resultSpan.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b; margin-right:4px;"></i> <strong>${escapeHtml(
          status
        )} OK</strong> (But no text found)<br><details><summary>Raw JSON</summary><pre>${escapeHtml(
          JSON.stringify(apiJson, null, 2)
        )}</pre></details>`;
        resultSpan.style.color = "var(--warning)";
      }
    } else {
      resultSpan.textContent = `${I18nService.t(
        "msgTestFail"
      )}: ${status} ${statusText}`;
      resultSpan.style.color = "var(--danger)";
    }
  } catch (e) {
    resultSpan.innerHTML =
      `<i class="fa-solid fa-circle-xmark" style="color:#ef4444; margin-right:4px;"></i> Error: ` +
      escapeHtml(e.message);
    resultSpan.style.color = "var(--danger)";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = I18nService.t("btnTestConnection");
    }
  }
}

async function handleSave(e) {
  e?.preventDefault();
  if (!elements.modalForm.reportValidity()) return;

  elements.saveModalBtn.disabled = true;
  const formData = new FormData(elements.modalForm);
  const data = Object.fromEntries(formData.entries());

  if (!currentEditId) data.id = crypto.randomUUID();
  else data.id = currentEditId;

  try {
    if (currentModalMode === "endpoint") {
      await StorageService.saveEndpoint(data);
      await loadEndpoints();
    } else {
      data.useCustomSystemPrompt = !!formData.get("useCustomSystemPrompt");
      await StorageService.saveStrategy(data);
      await loadStrategies();
    }
    closeModal();
    showToast(I18nService.t("toastSaved"), "success");
  } catch (error) {
    showToast(
      I18nService.t("toastSaveFail", [error.message]) || `Save failed: ${error.message}`,
      "danger"
    );
  } finally {
    elements.saveModalBtn.disabled = false;
  }
}

// --- Standard CRUD (Load/Delete) ---
async function loadEndpoints() {
  const endpoints = await StorageService.getEndpoints();
  const config = await StorageService.getAppConfig();
  const defaultId = config.defaultEndpointId || (endpoints.length > 0 ? endpoints[0].id : "");

  if (endpoints.length === 0) {
    renderEmptyState(
      elements.endpointList,
      "fa-plug",
      I18nService.t("noEndpoints") || "No endpoints yet. Add one to start optimizing."
    );
    return;
  }

  elements.endpointList.innerHTML = endpoints
    .map(
      (e) => {
        const isDefault = e.id === defaultId;
        return `
    <div class="card">
      <div>
        <h3>${escapeHtml(e.name)} <span class="endpoint-tag">${
          escapeHtml(e.provider || "custom")
        }</span>${isDefault ? ` <span class="custom-dropdown-tag small">${I18nService.t("tagDefault") || "Default"}</span>` : ''}</h3>
        <p title="${escapeHtml(e.url)}">${escapeHtml(e.url)}</p>
      </div>
      <div class="endpoint-actions">
        <button type="button" class="btn-set-default ${isDefault ? 'is-default' : ''}" data-action="setDefault" data-id="${escapeHtml(e.id)}" title="${escapeHtml(I18nService.t("btnSetDefault") || "Set as Default")}">
          ${isDefault ? '★' : '☆'}
        </button>
        <button type="button" class="btn-secondary" data-action="edit" data-id="${
          escapeHtml(e.id)
        }">${I18nService.t("btnEdit")}</button>
        <button type="button" class="btn-secondary" data-action="delete" data-id="${
          escapeHtml(e.id)
        }" style="color:var(--danger);border-color:var(--border)">${I18nService.t(
          "btnDelete"
        )}</button>
      </div>
    </div>
  `;
      }
    )
    .join("");

  // Bind events
  elements.endpointList.onclick = async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { action, id } = btn.dataset;
    
    if (action === "setDefault") {
      await StorageService.setDefaultEndpoint(id);
      loadEndpoints(); // Refresh to update UI
      showToast(I18nService.t("toastSaved") || "Saved successfully", "success");
    }
    
    if (action === "edit") {
      openModal(
        "endpoint",
        endpoints.find((x) => x.id === id)
      );
    }
    
    if (action === "delete") {
      const currentConfig = await StorageService.getAppConfig();
      const isDeletingDefault = currentConfig.defaultEndpointId === id || 
        (!currentConfig.defaultEndpointId && endpoints.length > 0 && endpoints[0].id === id);
      
      // Use different confirmation message for default endpoint
      const confirmMsg = isDeletingDefault 
        ? (I18nService.t("confirmDeleteDefaultEndpoint") || "This is the default endpoint. Delete it?")
        : I18nService.t("confirmDelete");
      
      if (confirm(confirmMsg)) {
        await StorageService.deleteEndpoint(id);
        loadEndpoints();
        showToast(I18nService.t("toastDeleted") || "Deleted successfully", "success");
      }
    }
  };
}

async function loadStrategies(filterCategoryId = null) {
  const strategies = await StorageService.getStrategies();
  const categories = await StorageService.getCategories();

  // Create a map for quick category name lookup
  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.id] = c.name;
  });

  // Populate filter dropdown
  const filterSelect = document.getElementById("categoryFilter");
  if (filterSelect) {
    const currentValue =
      filterCategoryId !== null ? filterCategoryId : filterSelect.value;
    filterSelect.innerHTML = `
      <option value="">${
        I18nService.t("optionAllCategories") || "All Categories"
      }</option>
      <option value="uncategorized">${
        I18nService.t("lblUncategorized") || "Uncategorized"
      }</option>
      ${categories
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join("")}
    `;
    filterSelect.value = currentValue;

    // Add change listener (only once)
    if (!filterSelect.dataset.listenerAdded) {
      filterSelect.addEventListener("change", () => {
        loadStrategies(filterSelect.value);
      });
      filterSelect.dataset.listenerAdded = "true";
    }
  }

  // Filter strategies
  const selectedFilter = filterSelect ? filterSelect.value : "";
  let filteredStrategies = strategies;

  if (selectedFilter === "uncategorized") {
    filteredStrategies = strategies.filter(
      (s) => !s.categoryId || s.categoryId === ""
    );
  } else if (selectedFilter) {
    filteredStrategies = strategies.filter(
      (s) => s.categoryId === selectedFilter
    );
  }

  if (filteredStrategies.length === 0) {
    renderEmptyState(
      elements.strategyList,
      "fa-filter",
      I18nService.t("noMatchingStrategies") || "No strategies match this filter."
    );
    return;
  }

  elements.strategyList.innerHTML = filteredStrategies
    .map((s) => {
      const categoryName = s.categoryId ? categoryMap[s.categoryId] : null;
      return `
      <div class="card">
        <div>
          <h3>${escapeHtml(s.name)}${
        categoryName ? ` <span class="category-tag">${escapeHtml(categoryName)}</span>` : ""
      }</h3>
          <p>${escapeHtml((s.instruction || "").substring(0, 100))}${
            (s.instruction || "").length > 100 ? "…" : ""
          }</p>
        </div>
        <div class="endpoint-actions">
           ${
             ["default_optimize", "default_image_gen"].includes(s.id)
               ? `
               <button type="button" class="btn-secondary" data-action="edit" data-id="${
                 escapeHtml(s.id)
               }">${I18nService.t("btnEditEndpoint")}</button>
               <span class="endpoint-tag" style="background:var(--bg-sidebar); border:1px solid var(--border); color:var(--text-muted);">${I18nService.t(
                 "tagBuiltIn"
               )}</span>
               `
               : `
               <button type="button" class="btn-secondary" data-action="edit" data-id="${
                 escapeHtml(s.id)
               }">${I18nService.t("btnEdit")}</button>
               <button type="button" class="btn-secondary" data-action="delete" data-id="${
                 escapeHtml(s.id)
               }" style="color:var(--danger);border-color:var(--border)">${I18nService.t(
                   "btnDelete"
                 )}</button>
               `
           }
        </div>
      </div>
    `;
    })
    .join("");

  elements.strategyList.onclick = async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "edit")
      openModal(
        "strategy",
        strategies.find((x) => x.id === id)
      );
    if (action === "delete") {
      if (confirm(I18nService.t("confirmDelete"))) {
        await StorageService.deleteStrategy(id);
        loadStrategies();
      }
    }
  };
}

function openModal(mode, data = null) {
  modalPreviouslyFocused = document.activeElement;
  modalAbortController?.abort();
  modalAbortController = new AbortController();
  currentModalMode = mode;
  currentEditId = data ? data.id : null;
  const itemLabel = I18nService.t(
    mode === "endpoint" ? "itemEndpoint" : "itemStrategy"
  );
  elements.modalTitle.textContent = data
    ? I18nService.t("modalTitleEdit", [itemLabel])
    : I18nService.t("modalTitleAdd", [itemLabel]);
  elements.modalOverlay.classList.remove("hidden");
  elements.modalOverlay.setAttribute("aria-hidden", "false");
  elements.modalForm.innerHTML =
    mode === "endpoint" ? getEndpointForm(data) : getStrategyForm(data);

  // Trigger UI updates for initial state
  if (mode === "endpoint") {
    const providerSelect = document.getElementById("providerSelect");
    const provider = data ? data.provider : PROVIDERS.OPENAI;

    if (providerSelect) {
      providerSelect.addEventListener("change", (e) => {
        window.updatePlaceholder(e.target.value);
      });
    }

    // Initial update
    window.updatePlaceholder(provider);
  } else if (mode === "strategy") {
    const checkbox = document.getElementById("useCustomSys");
    const area = document.getElementById("advancedArea");
    if (checkbox && area) {
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) area.classList.remove("hidden");
        else area.classList.add("hidden");
      });
    }
  }

  requestAnimationFrame(() => {
    const firstField = elements.modalForm.querySelector(
      "input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled)"
    );
    firstField?.focus();
  });
}

function closeModal() {
  elements.modalOverlay.classList.add("hidden");
  elements.modalOverlay.setAttribute("aria-hidden", "true");
  elements.modalForm.innerHTML = "";
  currentModalMode = null;
  currentEditId = null;
  modalAbortController?.abort();
  modalAbortController = null;
  if (modalPreviouslyFocused instanceof HTMLElement) {
    modalPreviouslyFocused.focus();
  }
  modalPreviouslyFocused = null;
}



/**
 * Show a confirmation toast with Confirm/Cancel buttons
 * @param {string} message - The message to display
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmToast(message) {
  return new Promise((resolve) => {
    const toast = document.createElement("div");
    toast.className = "toast confirm-toast";
    toast.innerHTML = `
      <span>${message}</span>
      <div class="confirm-toast-actions">
        <button class="confirm-btn">${
          I18nService.t("btnConfirm") || "Confirm"
        }</button>
        <button class="cancel-btn">${
          I18nService.t("btnCancel") || "Cancel"
        }</button>
      </div>
    `;
    const toastContainer = document.getElementById("toastContainer");
    (toastContainer || document.body).appendChild(toast);

    // Force reflow
    toast.offsetHeight;
    toast.classList.add("visible");

    const confirmBtn = toast.querySelector(".confirm-btn");
    const cancelBtn = toast.querySelector(".cancel-btn");

    const cleanup = (result) => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
      resolve(result);
    };

    confirmBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
  });
}
