/**
 * PromptSmith Options Logic (Simplified)
 */
import { StorageService } from "../lib/storage.js";
import {
  RequestAdapter,
  PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
} from "../content/modules/adapters.js";
import { I18nService } from "../lib/i18n.js";

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

let currentModalMode = null; // 'endpoint' or 'strategy'
let currentEditId = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await I18nService.init(); // Initialize i18n first
  I18nService.apply(); // Apply to static HTML

  setupNavigation();
  setupModal();
  await loadEndpoints();
  await loadStrategies();
  await loadSettings();

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

      // Add active class
      item.classList.add("active");
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
  elements.saveModalBtn.addEventListener("click", handleSave);

  // Delegate test button logic
  elements.modalForm.addEventListener("click", async (e) => {
    if (e.target.id === "testEndpointBtn") {
      await handleTestConnection();
    }
  });

  setupSettingsListeners(); // Add listener for settings
}

// --- Settings Logic ---

async function loadSettings() {
  const config = await StorageService.getAppConfig();
  const triggerInput = document.getElementById("triggerKey");
  const floatToggle = document.getElementById("showFloatingIcon");
  const langSelect = document.getElementById("languageSelect");
  const outputLangInput = document.getElementById("outputLanguage");

  if (triggerInput) triggerInput.value = config.triggerKey || "Ctrl+Alt+P";
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
        data.name || ""
      }" placeholder="My AI Model" required>
    </div>

    <div class="form-group">
      <label>${I18nService.t("lblUrl")}</label>
      <input type="text" name="url" id="urlInput" value="${
        data.url || ""
      }" placeholder="https://api.openai.com/v1/chat/completions" required>
      <div id="urlHint" class="subtitle" style="margin-top:4px; font-size:11px; opacity:0.7"></div>
    </div>
    
    <div class="form-group">
      <label>${I18nService.t("lblApiKey")}</label>
      <input type="password" name="apiKey" value="${
        data.apiKey || ""
      }" placeholder="sk-...">
    </div>

    <div class="form-group">
      <label>${I18nService.t("lblModel")}</label>
      <input type="text" name="model" value="${
        data.model || ""
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
        data.name || ""
      }" placeholder="e.g., Fix Grammar" ${
    isBuiltIn
      ? 'disabled style="background-color:var(--bg-sidebar); cursor:not-allowed; opacity:0.7;"'
      : ""
  }>
    </div>
    <div class="form-group">
      <label>${I18nService.t("lblInstruction")}</label>
      <textarea name="instruction" placeholder="You are a helpful assistant..." ${
        isBuiltIn
          ? 'disabled style="background-color:var(--bg-sidebar); cursor:not-allowed; opacity:0.7;"'
          : ""
      }>${data.instruction || ""}</textarea>
    </div>
    <div class="form-group">
      <label>${I18nService.t("lblLinkedEndpoint")}</label>
      <select name="linkedEndpointId" id="endpointSelect">
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
                      data.systemPrompt || DEFAULT_SYSTEM_PROMPT
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

async function populateEndpointSelect(selectedId) {
  const endpoints = await StorageService.getEndpoints();
  const select = document.getElementById("endpointSelect");
  if (!select) return;

  const defaultOption = `<option value="">${I18nService.t(
    "txtSelectEndpoint"
  )}</option>`;

  select.innerHTML =
    defaultOption +
    endpoints
      .map(
        (e) =>
          `<option value="${e.id}" ${e.id === selectedId ? "selected" : ""}>${
            e.name
          }</option>`
      )
      .join("");

  if (endpoints.length === 0) {
    select.innerHTML =
      '<option value="">No endpoints found. Create one first.</option>';
  }
}

// --- Logic ---

async function handleTestConnection() {
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
        )}<br><em style="opacity:0.8">Output: "${outputText.substring(
          0,
          50
        )}..."</em>`;
        resultSpan.style.color = "var(--success)";
      } else {
        resultSpan.innerHTML = `⚠️ <strong>${status} OK</strong> (But no text found)<br><details><summary>Raw JSON</summary>${JSON.stringify(
          apiJson
        )}</details>`;
        resultSpan.style.color = "var(--warning)";
      }
    } else {
      resultSpan.textContent = `${I18nService.t(
        "msgTestFail"
      )}: ${status} ${statusText}`;
      resultSpan.style.color = "var(--danger)";
    }
  } catch (e) {
    resultSpan.textContent = "❌ Error: " + e.message;
    resultSpan.style.color = "var(--danger)";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = I18nService.t("btnTestConnection");
    }
  }
}

async function handleSave() {
  const formData = new FormData(elements.modalForm);
  const data = Object.fromEntries(formData.entries());

  if (!currentEditId) data.id = crypto.randomUUID();
  else data.id = currentEditId;

  if (currentModalMode === "endpoint") {
    // Save minimal data only
    await StorageService.saveEndpoint(data);
    loadEndpoints();
  } else {
    // Checkbox handling
    data.useCustomSystemPrompt = !!formData.get("useCustomSystemPrompt");

    await StorageService.saveStrategy(data);
    loadStrategies();
  }
  closeModal();
}

// --- Standard CRUD (Load/Delete) ---
async function loadEndpoints() {
  const endpoints = await StorageService.getEndpoints();
  elements.endpointList.innerHTML = endpoints
    .map(
      (e) => `
    <div class="card">
      <div>
        <h3>${e.name} <span class="endpoint-tag">${
        e.provider || "custom"
      }</span></h3>
        <p>${e.url}</p>
      </div>
      <div class="endpoint-actions">
        <button class="btn-secondary" data-action="edit" data-id="${
          e.id
        }">${I18nService.t("btnEdit")}</button>
        <button class="btn-secondary" data-action="delete" data-id="${
          e.id
        }" style="color:var(--danger);border-color:var(--border)">${I18nService.t(
        "btnDelete"
      )}</button>
      </div>
    </div>
  `
    )
    .join("");

  // Bind events
  elements.endpointList.onclick = async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "edit")
      openModal(
        "endpoint",
        endpoints.find((x) => x.id === id)
      );
    if (action === "delete") {
      if (confirm(I18nService.t("confirmDelete"))) {
        await StorageService.deleteEndpoint(id);
        loadEndpoints();
      }
    }
  };
}

async function loadStrategies() {
  const strategies = await StorageService.getStrategies();
  elements.strategyList.innerHTML = strategies
    .map(
      (s) => `
      <div class="card">
        <div>
          <h3>${s.name}</h3>
          <p>${(s.instruction || "").substring(0, 50)}...</p>
        </div>
        <div class="endpoint-actions">
           ${
             ["default_optimize", "default_image_gen"].includes(s.id)
               ? `
               <button class="btn-secondary" data-action="edit" data-id="${
                 s.id
               }">${I18nService.t("btnEditEndpoint")}</button>
               <span class="endpoint-tag" style="background:var(--bg-sidebar); border:1px solid var(--border); color:var(--text-muted);">${I18nService.t(
                 "tagBuiltIn"
               )}</span>
               `
               : `
               <button class="btn-secondary" data-action="edit" data-id="${
                 s.id
               }">${I18nService.t("btnEdit")}</button>
               <button class="btn-secondary" data-action="delete" data-id="${
                 s.id
               }" style="color:var(--danger);border-color:var(--border)">${I18nService.t(
                   "btnDelete"
                 )}</button>
               `
           }
        </div>
      </div>
    `
    )
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
      if (confirm("Delete?")) {
        await StorageService.deleteStrategy(id);
        loadStrategies();
      }
    }
  };
}

function openModal(mode, data = null) {
  currentModalMode = mode;
  currentEditId = data ? data.id : null;
  const verb = data
    ? I18nService.t("btnEdit")
    : I18nService.t("modalTitleAdd", [""]);
  // e.g. "Edit Endpoint" vs "Add Endpoint" logic was simple before, now slightly localized.
  // Better: "modalTitleEdit" with param.
  elements.modalTitle.textContent = data
    ? I18nService.t("modalTitleEdit", [mode])
    : I18nService.t("modalTitleAdd", [mode]);
  elements.modalOverlay.classList.remove("hidden");
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
}

function closeModal() {
  elements.modalOverlay.classList.add("hidden");
  currentModalMode = null;
  currentEditId = null;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Force reflow
  toast.offsetHeight;

  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
