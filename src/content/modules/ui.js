import { StorageService } from "../../lib/storage.js";

import { I18nService } from "../../lib/i18n.js";

// Safe wrapper for chrome.runtime.getURL to handle orphaned scripts
function safeGetURL(path) {
  try {
    if (!chrome.runtime.id) return "";
    return chrome.runtime.getURL(path);
  } catch (e) {
    return "";
  }
}

export class UIManager {
  constructor() {
    this.container = document.createElement("div");
    this.container.id = "promptsmith-root";
    document.body.appendChild(this.container);

    this.shadow = this.container.attachShadow({ mode: "open" });
    this.addStyles();

    this.menuVisible = false;
    this.isLoading = false;
    this.currentFabHost = null;
    this.currentFabMount = null;
    this.currentMinFabHost = null;
    this.currentMinFabMount = null;
    this.fabMountStates = new Map();

    // Review Minimized State
    this.isReviewMinimized = false;
    this.restoreCallback = null;
    this.diffContext = null;
    this.observedElement = null;
  }

  addStyles() {
    // Inject @font-face into the MAIN document head (not Shadow DOM)
    // This ensures fonts are loaded globally and can be used by Shadow DOM
    if (!document.getElementById("promptsmith-fa-fonts")) {
      const fontStyle = document.createElement("style");
      fontStyle.id = "promptsmith-fa-fonts";
      fontStyle.textContent = `
        @font-face {
          font-family: "Font Awesome 6 Free";
          font-style: normal;
          font-weight: 900;
          font-display: block;
          src: url("${safeGetURL(
            "src/webfonts/fa-solid-900.woff2"
          )}") format("woff2");
        }
        @font-face {
          font-family: "Font Awesome 6 Free";
          font-style: normal;
          font-weight: 400;
          font-display: block;
          src: url("${safeGetURL(
            "src/webfonts/fa-regular-400.woff2"
          )}") format("woff2");
        }
      `;
      document.head.appendChild(fontStyle);
    }

    // Inject Font Awesome CSS classes into Shadow DOM
    const faLink = document.createElement("link");
    faLink.rel = "stylesheet";
    faLink.href = safeGetURL("src/lib/font-awesome.css");
    this.shadow.appendChild(faLink);

    const style = document.createElement("style");
    style.textContent = `
      
      :host {
        all: initial;
        z-index: 2147483647; /* Max Z-Index */
        position: fixed;
        top: 0; 
        left: 0;
        width: 0;
        height: 0;
        font-family: "Inter", system-ui, -apple-system, sans-serif;
        
        --primary: #2563eb;
        --primary-hover: #1d4ed8;
        --bg-card: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --border: #e2e8f0;
        --danger: #ef4444;
        --success: #22c55e;
        --radius: 8px;
        --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        --overlay-bg: rgba(15, 23, 42, 0.65); /* Dark blue-ish tint */
      }
      
      /* --- FAB --- */
      .fab {
        position: fixed;
        width: 36px;
        height: 36px;
        background: white;
        border: 1px solid var(--border);
        border-radius: 50%;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        font-size: 18px;
        color: var(--primary);
        overflow: hidden;
      }
      
      .fab:hover {
        transform: scale(1.1) translateY(-1px);
        box-shadow: 0 6px 8px rgba(0,0,0,0.15);
        background: #f8fafc;
      }

      .fab::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(168, 85, 247, 0.1));
          opacity: 0;
          transition: opacity 0.2s;
      }
      .fab:hover::after { opacity: 1; }
      
      /* --- Menu --- */
      .menu {
        position: absolute;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 6px;
        width: 220px;
        box-shadow: var(--shadow-lg);
        color: var(--text-main);
        display: none; 
        flex-direction: column;
        gap: 2px;
        animation: scaleIn 0.1s ease-out;
        transform-origin: top left;
        max-height: 80vh; /* Viewport Height Limit */
      }
      
      .menu.visible {
        display: flex;
      }

      .menu-header {
        padding: 4px 8px 8px 8px;
        font-size: 11px;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        user-select: none;
        border-bottom: 1px solid var(--border);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0; /* Header doesn't shrink */
      }

      .menu-items {
        overflow-y: auto;
        overscroll-behavior: contain;
        flex: 1; /* Take remaining space */
        min-height: 0; /* Fix flex overflow */
      }

      .menu-items::-webkit-scrollbar {
        width: 6px;
      }
      .menu-items::-webkit-scrollbar-track {
        background: transparent;
      }
      .menu-items::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 3px;
      }
      .menu-items::-webkit-scrollbar-thumb:hover {
        background: var(--text-muted);
      }

      .menu-item {
        padding: 10px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        color: var(--text-main);
        transition: background 0.15s;
        box-sizing: border-box;
      }

      .history-header {
        border-radius: 20px;
        margin-bottom: 12px;
      }
      
      .history-list {
        border-radius: 20px;
        overflow: hidden; /* Ensure content obeys radius */
      }
      
      .history-search-container {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 8px; /* Gap between elements */
      }
      
      /* Custom Dropdown in Shadow DOM */
      .custom-dropdown {
        position: relative;
        width: 140px; /* Default width */
        z-index: 100;
      }
      
      .custom-dropdown-trigger {
        width: 100%;
        padding: 8px 12px;
        background-color: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text-main);
        font-family: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .custom-dropdown-trigger:hover { border-color: var(--text-muted); }
      .custom-dropdown-trigger:focus { outline: none; border-color: var(--primary); }
      
      .custom-dropdown-trigger .trigger-content {
          flex: 1; min-width: 0; overflow: hidden;
      }
      .custom-dropdown-trigger .trigger-text {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
      }
      .custom-dropdown-trigger .dropdown-arrow {
          font-size: 10px; color: var(--text-muted); transition: transform 0.2s;
      }
      
      .custom-dropdown.open .dropdown-arrow { transform: rotate(180deg); }
      
      .custom-dropdown-menu {
        position: absolute;
        top: 100%; left: 0; right: 0;
        margin-top: 4px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        max-height: 200px;
        overflow-y: auto;
        display: none;
      }
      .custom-dropdown.open .custom-dropdown-menu { display: block; }
      
      .custom-dropdown-option {
        padding: 8px 12px;
        cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
        color: var(--text-main);
      }
      .custom-dropdown-option:last-child { border-bottom: none; }
      .custom-dropdown-option:hover { background-color: #f1f5f9; }
      .custom-dropdown-option.selected { background-color: rgba(59, 130, 246, 0.08); }
      .custom-dropdown-option .option-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Search Input Style adjustment to match */
      .history-search-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
      }
      .history-search-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
          pointer-events: none;
          z-index: 10;
      }
      .history-search {
          width: 100%;
          padding: 8px 12px 8px 32px; /* Left padding for icon */
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-main);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
      }
      .history-search:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }


      .menu-item:hover, .menu-item:focus, .menu-item.selected {
        background: #eff6ff;
        color: var(--primary);
      }

      .menu-item.has-submenu {
        justify-content: space-between;
      }

      .menu-item.has-submenu::after {
        content: "▶";
        font-size: 8px;
        opacity: 0.5;
        margin-left: 8px;
      }

      .menu-item.has-submenu.submenu-open::after {
        opacity: 1;
      }

      .menu-separator {
        height: 1px;
        background: var(--border);
        margin: 4px 8px;
      }

      .submenu {
        position: fixed;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 6px;
        min-width: 180px;
        max-height: 300px;
        overflow-y: auto;
        box-shadow: var(--shadow-lg);
        z-index: 2147483647;
        animation: fadeIn 0.1s ease-out;
      }
      
      /* --- Diff Modal --- */
      .diff-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--overlay-bg);
        z-index: 2147483646;
        animation: fadeIn 0.2s ease-out;
        backdrop-filter: blur(2px);
      }

      .diff-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0;
        width: 700px;
        max-width: 90vw;
        max-height: 85vh;
        box-shadow: var(--shadow-lg);
        color: var(--text-main);
        display: flex;
        flex-direction: column;
        z-index: 2147483647;
        overflow: hidden;
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      .diff-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        background: #f8fafc;
        font-weight: 600;
        font-size: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--text-main);
      }

      .diff-body {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0; 
        overflow: hidden;
        flex: 1;
        min-height: 200px;
      }
      
      .diff-pane {
        padding: 20px;
        overflow-y: auto;
        border-right: 1px solid var(--border);
      }
      .diff-pane:last-child { border-right: none; }

      .diff-pane h4 {
        margin: 0 0 12px 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      /* Status dots */
      .diff-pane h4::before {
        content: "";
        display: block;
        width: 8px; 
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted);
      }
      .diff-pane:last-child h4::before {
        background: var(--success);
      }
      
      .diff-content {
        white-space: pre-wrap;
        font-family: "Menlo", "Monaco", "Courier New", monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-main);
      }

      .diff-content.new {
        color: #1a5c2d; /* Dark green for text */
      }
      
      .diff-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--border);
        background: white;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      button {
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      button:focus-visible,
      input:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.2);
        outline-offset: 2px;
      }

      .btn-secondary {
        background: white;
        border: 1px solid var(--border);
        color: var(--text-muted);
      }
      
      .btn-secondary:hover {
        border-color: var(--text-muted);
        color: var(--text-main);
        background: #f8fafc;
      }
      
      .btn-primary {
        background: var(--primary);
        color: white;
        border: 1px solid transparent;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .btn-primary:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
      }
      
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(37, 99, 235, 0.2);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .spinner-small {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(37, 99, 235, 0.2);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: auto; /* Push to right */
      }

      /* --- Toast --- */
      .toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #1e293b;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483647;
      }
      .toast.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      .toast.danger {
        background: var(--danger);
      }
      .toast.success {
        background: var(--success);
      }
      
      
      /* --- Minimized FAB --- */
      .minimized-fab {
        position: fixed; /* Calculated via JS */
        width: 36px;
        height: 36px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 50%;
        box-shadow: var(--shadow-lg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        z-index: 2147483647;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        color: var(--primary);
      }
      .minimized-fab:hover {
        transform: scale(1.05) translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        background: #f8fafc;
      }
      /* Tooltip on hover */
      .minimized-fab::before {
        content: "Pending Review";
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s;
        pointer-events: none;
      }
      .minimized-fab:hover::before {
        opacity: 1;
        visibility: visible;
        top: -35px;
      }

      /* --- History Modal --- */
      .history-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0;
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        box-shadow: var(--shadow-lg);
        color: var(--text-main);
        display: flex;
        flex-direction: column;
        z-index: 2147483647;
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
      }

      .history-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        background: #f8fafc;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .history-search-container {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
      }
      
      .history-search {
        width: 100%;
        padding: 8px 12px 8px 32px;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-family: inherit;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      .history-search:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
      }
      
      .history-search-icon {
        position: absolute;
        left: 10px;
        color: var(--text-muted);
        font-size: 12px;
        pointer-events: none;
      }
      
      .history-list {
        overflow-y: auto;
        padding: 8px 0;
        flex: 1;
        min-height: 200px;
        background: var(--bg-card);
      }

      .history-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background 0.15s;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .history-item:last-child {
        border-bottom: none;
      }
      .history-item:hover {
        background: #f8fafc;
      }
      
      .history-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: var(--text-muted);
      }
      
      .history-strategy-tag {
        background: #eff6ff;
        color: var(--primary);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .history-preview {
        font-size: 13px;
        color: var(--text-main);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.5;
      }
      
      .history-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
        font-size: 13px;
      }

      @media (max-width: 600px) {
        .diff-modal,
        .history-modal {
          width: calc(100vw - 16px);
          max-width: none;
          max-height: calc(100vh - 16px);
          border-radius: 10px;
        }

        .diff-body {
          display: block;
          min-height: 0;
          overflow-y: auto;
        }

        .diff-pane {
          min-height: 150px;
          overflow: visible;
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }

        .diff-pane:last-child {
          border-bottom: 0;
        }

        .diff-footer {
          flex-wrap: wrap;
          padding: 12px;
        }

        .diff-footer .footer-left {
          flex-basis: 100%;
        }

        .diff-footer .footer-right {
          width: 100%;
          flex-wrap: wrap;
        }

        .diff-footer .footer-right button {
          flex: 1;
        }

        .history-header {
          align-items: flex-start;
        }

        .history-search-container {
          align-items: stretch;
          flex-direction: column;
        }

        .history-search-container .custom-dropdown {
          width: 100%;
        }

        .history-search-wrapper {
          width: 100%;
        }

        .history-list {
          min-height: 160px;
        }

        .toast {
          width: calc(100vw - 32px);
          max-width: 420px;
          box-sizing: border-box;
          text-align: center;
          overflow-wrap: anywhere;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    this.shadow.appendChild(style);
  }

  showFab(element, onClick, selectionState = null, showTriggerFab = true) {
    if (this.menuVisible) return;
    if (this.isLoading) return; // Prevent creating duplicate FAB while loader is active
    this.hideFab();

    if (!element) return;

    // Resolve the visible editor surface used for positioning.
    const anchor = this._getStableAnchor(element);
    if (!anchor) return;
    if (showTriggerFab) {
      const portal = this._createCssFabPortal(anchor, "4px");
      if (!portal) return;
      const { host, shadow: fabShadow, mount } = portal;

      const fab = document.createElement("button");
      fab.type = "button";
      fab.className = "fab";
      fab.setAttribute("aria-label", "PromptSmith");
      const iconUrl = safeGetURL("assets/icons/icon48.png");
      fab.innerHTML = `<img src="${iconUrl}" alt="">`;
      fab.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent focus loss from input
        this.hideFab();
        onClick(selectionState);
      };

      fabShadow.appendChild(fab);
      this.currentFab = fab;
      this.currentFabHost = host;
      this.currentFabMount = mount;
    }
    // CSS follows layout changes automatically; observe removal for cleanup.
    this.startObserving(anchor);

    // Sync Review FAB if active
    if (
      this.isReviewMinimized &&
      this.diffContext &&
      this.diffContext.element === element
    ) {
      this.renderReviewFab(element);
    }
  }

  startObserving(anchorElement) {
    if (this.observedElement === anchorElement) return; // Already observing

    this.stopObserving(); // Clean up previous if any

    this.observedElement = anchorElement;

    // Add MutationObserver to detect when element is removed from DOM
    this.removalObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removedNode of mutation.removedNodes) {
          if (
            removedNode === anchorElement ||
            (removedNode.contains && removedNode.contains(anchorElement))
          ) {
            // The observed element was removed from DOM
            this.clearFabs();
            this.stopObserving();
            return;
          }
        }
      }
    });
    this.removalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stopObserving() {
    if (this.observedElement) {
      this.observedElement = null;
    }

    if (this.removalObserver) {
      this.removalObserver.disconnect();
      this.removalObserver = null;
    }

    // Clear pending position debounce timer to prevent stale updates
    if (this.positionDebounceTimer) {
      clearTimeout(this.positionDebounceTimer);
      this.positionDebounceTimer = null;
    }
  }

  renderReviewFab(element) {
    let fab = this.currentMinFab;
    const anchor = this._getStableAnchor(element);
    if (!anchor) return;

    if (!fab) {
      const portal = this._createCssFabPortal(anchor, "48px");
      if (!portal) return;

      fab = document.createElement("button");
      fab.type = "button";
      fab.className = "fab minimized";
      fab.setAttribute("aria-label", "PromptSmith pending review");
      fab.textContent = "✎";
      fab.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.restoreCallback) this.restoreCallback();
      };
      fab.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      portal.shadow.appendChild(fab);
      this.currentMinFab = fab;
      this.currentMinFabHost = portal.host;
      this.currentMinFabMount = portal.mount;
    }
  }

  _getStableAnchor(element) {
    if (!element) return null;

    // ChatGPT, Claude and Gemini expose their editor as a contenteditable
    // surface. Native inputs and textareas are already their own anchor.
    return element.closest?.('[contenteditable="true"]') || element;
  }

  _getCssFabMount(editor) {
    let mount = editor?.parentElement;

    // Fallback for editors that do not expose a flex/grid composer row.
    while (mount && mount !== document.body) {
      const style = window.getComputedStyle(mount);
      if (style.display !== "contents") return mount;
      mount = mount.parentElement;
    }

    return editor?.parentElement || null;
  }

  _getCssFabInsertionPoint(editor) {
    let branch = editor;
    const nativeControlSelector =
      'button, [role="button"], select, [aria-haspopup], [data-testid*="send"], [data-testid*="submit"]';
    const modelControlSelector =
      '[data-testid*="model-selector"], button[aria-label^="Model:"], button[aria-label*="model" i]';

    while (
      branch?.parentElement &&
      branch.parentElement !== document.body &&
      branch.parentElement !== document.documentElement
    ) {
      const container = branch.parentElement;
      const containerStyle = window.getComputedStyle(container);
      const children = Array.from(container.children).filter(
        (child) => !child.matches?.('[data-promptsmith-fab-host="true"]')
      );
      const branchIndex = children.indexOf(branch);

      // ChatGPT and Gemini use named CSS grid areas for their composer.
      // Mount inside the native trailing controls area instead of becoming a
      // new auto-placed grid item.
      if (
        containerStyle.display === "grid" ||
        containerStyle.display === "inline-grid"
      ) {
        const trailingControls = children.find((child) => {
          const area = window.getComputedStyle(child).gridArea;
          return (
            /(^|-)trailing($|-)/.test(area) &&
            (child.matches?.(nativeControlSelector) ||
              child.querySelector?.(nativeControlSelector))
          );
        });

        if (trailingControls) {
          return {
            container: trailingControls,
            before: trailingControls.firstElementChild,
          };
        }
      }

      // Claude keeps the editor and its native action bar in a flex column.
      // Put PromptSmith in that action bar immediately before the model
      // selector, leaving the site's spacer to handle all horizontal layout.
      if (
        (containerStyle.display === "flex" ||
          containerStyle.display === "inline-flex") &&
        containerStyle.flexDirection === "column"
      ) {
        const actionBar = children.slice(branchIndex + 1).find((child) => {
          const style = window.getComputedStyle(child);
          return (
            (style.display === "flex" || style.display === "inline-flex") &&
            style.flexDirection === "row" &&
            child.querySelector?.(nativeControlSelector)
          );
        });
        const modelControl = actionBar?.querySelector?.(modelControlSelector);

        if (actionBar && modelControl) {
          let modelBranch = modelControl;
          while (
            modelBranch.parentElement &&
            modelBranch.parentElement !== actionBar
          ) {
            modelBranch = modelBranch.parentElement;
          }

          return { container: actionBar, before: modelBranch };
        }
      }

      branch = container;
    }

    return null;
  }

  _createCssFabPortal(editor, rightOffset) {
    const insertionPoint = this._getCssFabInsertionPoint(editor);
    const mount = insertionPoint ? null : this._getCssFabMount(editor);
    if (!insertionPoint && !mount) return null;

    if (mount) this._retainFabMount(mount);

    const host = document.createElement("span");
    host.dataset.promptsmithFabHost = "true";
    host.dataset.promptsmithLayout = insertionPoint ? "inline" : "overlay";
    host.style.setProperty("--promptsmith-fab-right", rightOffset);

    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        z-index: 2147483647;
      }

      :host([data-promptsmith-layout="inline"]) {
        position: relative;
        inset: auto;
        display: inline-flex;
        flex: 0 0 40px;
        width: 40px;
        height: 100%;
        min-height: 32px;
        max-height: 40px;
        align-self: center;
        align-items: center;
        justify-content: center;
      }

      .fab {
        position: absolute;
        top: 50%;
        right: var(--promptsmith-fab-right, 4px);
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid #e2e8f0;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        color: #2563eb;
        cursor: pointer;
        pointer-events: auto;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
          box-shadow 0.2s, background-color 0.2s;
      }

      :host([data-promptsmith-layout="inline"]) .fab {
        position: static;
        inset: auto;
        transform: none;
        flex: none;
        width: 32px;
        height: 32px;
      }

      .fab.minimized {
        font: 600 19px/1 system-ui, sans-serif;
      }

      .fab:hover {
        transform: translateY(-50%) scale(1.08);
        background: #f8fafc;
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
      }

      :host([data-promptsmith-layout="inline"]) .fab:hover {
        transform: scale(1.08);
      }

      .fab:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.25);
        outline-offset: 2px;
      }

      .fab img {
        width: 20px;
        height: 20px;
        object-fit: contain;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .fab {
          transition: none;
        }
      }
    `;

    shadow.appendChild(style);
    if (insertionPoint) {
      insertionPoint.container.insertBefore(
        host,
        insertionPoint.before
      );
    } else {
      mount.appendChild(host);
    }
    return { host, shadow, mount };
  }

  _retainFabMount(mount) {
    const existing = this.fabMountStates.get(mount);
    if (existing) {
      existing.references += 1;
      return;
    }

    const state = {
      originalPosition: mount.style.position,
      references: 1,
    };
    this.fabMountStates.set(mount, state);

    if (window.getComputedStyle(mount).position === "static") {
      mount.style.position = "relative";
    }
  }

  _releaseFabMount(mount) {
    if (!mount) return;
    const state = this.fabMountStates.get(mount);
    if (!state) return;

    state.references -= 1;
    if (state.references > 0) return;

    mount.style.position = state.originalPosition;
    this.fabMountStates.delete(mount);
  }

  clearFabs() {
    // Force-clear all FABs including during loading state (e.g., when element is removed from DOM)
    this.stopObserving();
    if (this.currentFab) {
      this.currentFab.remove();
      this.currentFab = null;
    }
    this.hideMinimizedFab();
  }

  hideFab() {
    if (this.isLoading) return; // Prevent external hiding

    this.stopObserving(); // Stop Resize Observer

    if (this.currentFabHost) {
      this.currentFabHost.remove();
      this.currentFabHost = null;
      this.currentFab = null;
    } else if (this.currentFab) {
      this.currentFab.remove();
      this.currentFab = null;
    }

    this._releaseFabMount(this.currentFabMount);
    this.currentFabMount = null;
  }

  async showMenu(context, onSelect) {
    console.log("[PromptSmith] UIManager.showMenu called", context);

    // Prevent opening multiple menus - if already visible, ignore
    if (this.menuVisible) {
      console.log("[PromptSmith] Menu already visible, ignoring trigger");
      return;
    }

    this.hideFab();
    if (this.currentMenu) this.currentMenu.remove();
    if (this.currentSubmenu) this.currentSubmenu.remove();

    let strategies = [];
    let categories = [];
    try {
      strategies = await StorageService.getStrategies();
      categories = await StorageService.getCategories();
    } catch (err) {
      console.warn(
        "[PromptSmith] Extension context invalidated. Please refresh the page."
      );
      this.showToast("Extension updated. Please refresh the page.", "warning");
      return;
    }

    // Group strategies by category
    const strategyByCategory = {};
    const uncategorized = [];

    strategies.forEach((s) => {
      if (s.categoryId && s.categoryId.length > 0) {
        if (!strategyByCategory[s.categoryId]) {
          strategyByCategory[s.categoryId] = [];
        }
        strategyByCategory[s.categoryId].push(s);
      } else {
        uncategorized.push(s);
      }
    });

    // Filter categories that have strategies
    const categoriesWithStrategies = categories.filter(
      (c) => strategyByCategory[c.id] && strategyByCategory[c.id].length > 0
    );

    const menu = document.createElement("div");
    menu.className = "menu visible";

    menu.innerHTML = `
      <div class="menu-header">
        <span style="flex:1;">${I18nService.t("menuTitle")}</span>
        
        <!-- History Icon -->
        <span id="historyIcon" style="cursor: pointer; opacity: 0.7; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 4px;" title="History">
           <i class="fa-solid fa-clock-rotate-left" style="font-size: 14px;"></i>
        </span>

        <!-- Settings Icon -->
        <span id="settingsIcon" style="cursor: pointer; opacity: 0.7; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;" title="${I18nService.t(
          "navSettings"
        )}">
          <svg viewBox="0 0 512 512" style="width: 14px; height: 14px; fill: currentColor;"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>
        </span>
      </div>

      <div class="menu-items">
        <!-- Items injected here -->
      </div>
    `;

    const settingsIcon = menu.querySelector("#settingsIcon");
    if (settingsIcon) {
      settingsIcon.onmouseover = () => {
        settingsIcon.style.opacity = "1";
        settingsIcon.style.color = "var(--primary)";
      };
      settingsIcon.onmouseout = () => {
        settingsIcon.style.opacity = "0.7";
        settingsIcon.style.color = "inherit";
      };
      settingsIcon.onclick = (e) => {
        e.stopPropagation();
        try {
          chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
        } catch (err) {
          // Extension context invalidated
        }
        this.hideMenu();
      };
    }
    
    const historyIcon = menu.querySelector("#historyIcon");
    if (historyIcon) {
        historyIcon.onmouseover = () => {
            historyIcon.style.opacity = "1";
            historyIcon.style.color = "var(--primary)";
        };
        historyIcon.onmouseout = () => {
            historyIcon.style.opacity = "0.7";
            historyIcon.style.color = "inherit";
        };
        historyIcon.onclick = (e) => {
            e.stopPropagation();
            this.hideMenu();
            // Call showHistoryModal (we'll implement it next, passing context for any positioning if needed, though modal is fixed)
            console.log("[PromptSmith] Opening History Modal");
            this.showHistoryModal(); 
        };
    }

    const itemsContainer = menu.querySelector(".menu-items");

    if (strategies.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = I18nService.t("noStrategies");
      empty.style.cssText = `padding: 12px 16px; color: var(--text-muted); font-size: 13px; text-align: center;`;
      itemsContainer.appendChild(empty);
    } else {
      // Render categories with strategies
      categoriesWithStrategies.forEach((cat) => {
        const btn = document.createElement("button");
        btn.className = "menu-item has-submenu";
        btn.textContent = cat.name;
        btn.dataset.type = "category";
        btn.dataset.categoryId = cat.id;
        itemsContainer.appendChild(btn);
      });

      // Add separator if both categories and uncategorized exist
      if (categoriesWithStrategies.length > 0 && uncategorized.length > 0) {
        const sep = document.createElement("div");
        sep.className = "menu-separator";
        itemsContainer.appendChild(sep);
      }

      // Render uncategorized strategies
      uncategorized.forEach((s) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = s.name;
        btn.dataset.type = "strategy";
        btn.dataset.id = s.id;
        btn.onclick = () => onSelect(s.id);
        itemsContainer.appendChild(btn);
      });
    }

    // Position menu
    this.shadow.appendChild(menu);
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const rect = context.rect;

    let top = rect.bottom + 10;
    let left = rect.left;

    if (top + menuHeight > vh - 10) {
      const spaceAbove = rect.top;
      if (spaceAbove > menuHeight + 10) {
        top = rect.top - menuHeight - 10;
        menu.style.transformOrigin = "bottom left";
      } else {
        top = Math.max(10, vh - menuHeight - 10);
      }
    }

    if (left + menuWidth > vw - 10) {
      left = Math.max(10, vw - menuWidth - 10);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.addEventListener("mousedown", (e) => e.stopPropagation());

    this.currentMenu = menu;
    this.menuVisible = true;

    // Submenu logic
    let currentSubmenu = null;
    let submenuItems = [];
    let submenuSelectedIndex = -1;
    let isInSubmenu = false;

    const showSubmenu = (categoryId, anchorBtn) => {
      hideSubmenu();

      const strats = strategyByCategory[categoryId] || [];
      if (strats.length === 0) return;

      // Mark parent as open
      anchorBtn.classList.add("submenu-open");

      const submenu = document.createElement("div");
      submenu.className = "submenu";

      strats.forEach((s) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = s.name;
        btn.dataset.id = s.id;
        btn.onclick = () => onSelect(s.id);
        submenu.appendChild(btn);
      });

      // Position submenu to right of anchor
      const anchorRect = anchorBtn.getBoundingClientRect();

      // Hide initially to calculate dimensions without flicker
      submenu.style.opacity = "0";
      submenu.style.top = `${anchorRect.top}px`;
      submenu.style.left = `${anchorRect.right + 4}px`;

      this.shadow.appendChild(submenu);
      currentSubmenu = submenu;
      this.currentSubmenu = submenu;
      submenuItems = Array.from(submenu.querySelectorAll(".menu-item"));
      submenuSelectedIndex = -1;
      isInSubmenu = true;

      // Check horizontal overflow
      const subWidth = submenu.offsetWidth;
      if (anchorRect.right + 4 + subWidth > vw - 10) {
        submenu.style.left = `${anchorRect.left - subWidth - 4}px`;
      }

      // Check vertical overflow
      const subHeight = submenu.offsetHeight;
      if (anchorRect.top + subHeight > vh - 10) {
        submenu.style.top = `${Math.max(10, vh - subHeight - 10)}px`;
      }

      // Reveal after positioning
      submenu.style.opacity = "1";

      // Auto-select first item
      if (submenuItems.length > 0) {
        submenuSelectedIndex = 0;
        submenuItems[0].classList.add("selected");
      }
    };

    const hideSubmenu = () => {
      if (currentSubmenu) {
        currentSubmenu.remove();
        currentSubmenu = null;
        this.currentSubmenu = null;
      }
      submenuItems = [];
      submenuSelectedIndex = -1;
      isInSubmenu = false;
      // Remove open class from all
      itemsContainer
        .querySelectorAll(".submenu-open")
        .forEach((el) => el.classList.remove("submenu-open"));
    };

    // Main menu navigation state
    let selectedIndex = -1;
    const menuItems = Array.from(itemsContainer.querySelectorAll(".menu-item"));

    const updateMainSelection = (newIndex) => {
      menuItems.forEach((item) => item.classList.remove("selected"));
      hideSubmenu();

      if (newIndex < 0) newIndex = menuItems.length - 1;
      if (newIndex >= menuItems.length) newIndex = 0;
      selectedIndex = newIndex;

      if (menuItems[selectedIndex]) {
        menuItems[selectedIndex].classList.add("selected");
        menuItems[selectedIndex].scrollIntoView({ block: "nearest" });
      }
    };

    const updateSubmenuSelection = (newIndex) => {
      submenuItems.forEach((item) => item.classList.remove("selected"));

      if (newIndex < 0) newIndex = submenuItems.length - 1;
      if (newIndex >= submenuItems.length) newIndex = 0;
      submenuSelectedIndex = newIndex;

      if (submenuItems[submenuSelectedIndex]) {
        submenuItems[submenuSelectedIndex].classList.add("selected");
        submenuItems[submenuSelectedIndex].scrollIntoView({ block: "nearest" });
      }
    };

    // Hover to open submenu
    menuItems.forEach((btn, idx) => {
      btn.addEventListener("mouseenter", () => {
        updateMainSelection(idx);
        if (btn.dataset.type === "category") {
          showSubmenu(btn.dataset.categoryId, btn);
        }
      });
    });

    // Close & keyboard listeners
    const closeListener = (e) => {
      const path = e.composedPath();
      if (
        !path.includes(menu) &&
        (!currentSubmenu || !path.includes(currentSubmenu))
      ) {
        this.hideMenu();
        removeListeners();
      }
    };

    const escListener = (e) => {
      if (e.key === "Escape") {
        if (isInSubmenu) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          hideSubmenu();
        } else {
          this.hideMenu();
          removeListeners();
        }
      }
    };

    const keyNavListener = (e) => {
      if (!this.menuVisible) return;

      if (isInSubmenu) {
        // Submenu navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          updateSubmenuSelection(submenuSelectedIndex + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          updateSubmenuSelection(submenuSelectedIndex - 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          hideSubmenu();
        } else if (e.key === "Enter" && submenuSelectedIndex >= 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const btn = submenuItems[submenuSelectedIndex];
          if (btn && !btn.disabled) btn.click();
        }
      } else {
        // Main menu navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          updateMainSelection(selectedIndex + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          updateMainSelection(selectedIndex - 1);
        } else if (
          (e.key === "ArrowRight" || e.key === "Enter") &&
          selectedIndex >= 0
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const btn = menuItems[selectedIndex];
          if (btn && btn.dataset.type === "category") {
            showSubmenu(btn.dataset.categoryId, btn);
          } else if (
            btn &&
            btn.dataset.type === "strategy" &&
            e.key === "Enter"
          ) {
            btn.click();
          }
        }
      }
    };

    const removeListeners = () => {
      document.removeEventListener("mousedown", closeListener);
      document.removeEventListener("keydown", escListener);
      document.removeEventListener("keydown", keyNavListener, true);
    };

    setTimeout(() => {
      document.addEventListener("mousedown", closeListener);
      document.addEventListener("keydown", escListener);
      document.addEventListener("keydown", keyNavListener, true);

      if (menuItems.length > 0) {
        updateMainSelection(0);
      }
    }, 0);
  }

  hideMenu() {
    if (this.currentSubmenu) {
      this.currentSubmenu.remove();
      this.currentSubmenu = null;
    }
    if (this.currentMenu) {
      this.currentMenu.remove();
      this.currentMenu = null;
    }
    this.menuVisible = false;
  }

  setMenuItemLoading(strategyId, isLoading) {
    if (!this.currentMenu) return;

    const btn = this.currentMenu.querySelector(
      `button[data-id="${strategyId}"]`
    );
    if (!btn) return;

    if (isLoading) {
      // Add spinner if not exists
      if (!btn.querySelector(".spinner-small")) {
        const spinner = document.createElement("div");
        spinner.className = "spinner-small";
        btn.appendChild(spinner);
        btn.style.cursor = "wait";
      }
      // Disable all buttons to prevent multiple clicks
      const allBtns = this.currentMenu.querySelectorAll("button");
      allBtns.forEach((b) => (b.disabled = true));
    } else {
      // Re-enable buttons? Usually we close header after this, but if error, we might want to re-enable.
      const allBtns = this.currentMenu.querySelectorAll("button");
      allBtns.forEach((b) => (b.disabled = false));
    }
  }

  showReviewLoading(original, context, onCancel) {
    // If we are already showing diff/loading, hide it to refresh (or we could reuse)
    this.hideDiff();
    this.diffVisible = true;
    this.diffContext = { ...context, element: context.element };
    this.isReviewMinimized = false;
    this.isLoading = true; // Mark as loading
    this.hideMinimizedFab();

    const modal = document.createElement("div");
    modal.className = "diff-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", I18nService.t("diffTitle"));

    // Styles for Loading
    const style = document.createElement("style");
    style.textContent = `
        .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
        }
        .loading-text {
            margin-top: 16px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: 0.02em;
        }
        .dots::after {
            content: '';
            animation: dots 1.5s steps(4, end) infinite;
            display: inline-block;
            width: 12px;
            text-align: left;
        }
        @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80%, 100% { content: '...'; }
        }
    `;
    modal.appendChild(style);

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeClass = isDark ? "theme-dark" : "theme-light";

    modal.innerHTML += `
      <div class="diff-header" style="position: relative;">
        <span>${I18nService.t("diffTitle")}</span>
        <button type="button" class="diff-close" aria-label="${I18nService.t(
          "btnCancel"
        )}" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">×</button>
      </div>
      
      <div class="diff-body">
        <!-- Pane 1: Original -->
        <div class="diff-pane">
          <h4>${I18nService.t("diffOriginal")}</h4>
          <div class="diff-content">${this.escapeHtml(original)}</div>
        </div>
        
        <!-- Pane 2: Loading -->
        <div class="diff-pane" style="position: relative;">
           <div class="loading-container">
               <div class="spinner"></div> <!-- reusing existing spinner class -->
               <div class="loading-text">${I18nService.t(
                 "processing"
               )}<span class="dots"></span></div>
           </div>
        </div>
      </div>
      
      <!-- Empty Footer or specialized footer -->
      <div class="diff-footer" style="justify-content: center;">
         <span style="font-size: 12px; color: var(--text-muted);">${I18nService.t(
           "processingHint"
         )}</span>
         <button type="button" id="loadingCancel" class="btn-secondary">${I18nService.t(
           "btnCancel"
         )}</button>
      </div>
    `;

    // Create Overlay (Locked)
    const overlay = document.createElement("div");
    overlay.className = "diff-overlay";
    // No click listener for minimize during loading!

    this.shadow.appendChild(overlay);
    this.shadow.appendChild(modal);

    this.currentDiffModal = modal;
    this.currentDiffOverlay = overlay;

    const cancelLoading = () => {
      if (!this.isLoading) return;
      this.hideDiff();
      if (onCancel) onCancel();
    };
    modal.querySelector(".diff-close").onclick = cancelLoading;
    modal.querySelector("#loadingCancel").onclick = cancelLoading;

    // --- Keyboard Event Handler for Loading State ---
    const loadingKeyListener = (e) => {
      if (!this.diffVisible) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cancelLoading();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    this.reviewKeyListener = loadingKeyListener;
    document.addEventListener("keydown", loadingKeyListener, true);
  }

  showDiff(original, optimized, context, onApply, onDiscard, onRegenerate) {
    this.isLoading = false; // Loading done
    // Force close any existing diff UI to handle new strategies or re-opens
    this.hideDiff();
    this.diffVisible = true;
    this.diffContext = { ...context, element: context.element };

    this.isReviewMinimized = false;
    this.hideMinimizedFab();

    const modal = document.createElement("div");
    modal.className = "diff-modal"; // Uses existing CSS class
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", I18nService.t("diffTitle"));

    // Add extra styles for utilities not in main CSS
    const style = document.createElement("style");
    style.textContent = `
        .copy-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            padding: 4px;
            font-size: 16px;
            line-height: 1;
            color: var(--text-muted);
            transition: all 0.2s;
            z-index: 10;
        }
        .copy-btn:hover { 
            background: rgba(0,0,0,0.05); 
            color: var(--primary);
        }
        
        .footer-left { flex: 1; }
        .footer-right { display: flex; gap: 10px; }
        
        .btn-ghost {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 8px 12px;
        }
        .btn-ghost:hover {
            color: var(--text-main);
            background: rgba(0,0,0,0.05);
        }
        .btn-ghost.danger:hover {
            color: var(--danger);
            background: rgba(239, 68, 68, 0.1);
        }
    `;
    modal.appendChild(style);

    modal.innerHTML += `
      <div class="diff-header">
        <span>${I18nService.t("diffTitle")}</span>
        <button type="button" class="diff-close" aria-label="${I18nService.t(
          "btnCancel"
        )}" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">×</button>
      </div>
      
      <div class="diff-body">
        <!-- Pane 1: Original -->
        <div class="diff-pane">
          <h4>${I18nService.t("diffOriginal")}</h4>
          <div class="diff-content">${this.escapeHtml(original)}</div>
        </div>
        
        <!-- Pane 2: Optimized -->
        <div class="diff-pane" style="position: relative;">
          <h4>${I18nService.t("diffOptimized")}</h4>
          <button id="diffCopyBtn" class="copy-btn" title="${I18nService.t(
            "tooltipCopied"
          )}"><i class="fa-regular fa-copy"></i></button>
          <div class="diff-content new">${this.escapeHtml(optimized)}</div>
        </div>
      </div>
      
      <div class="diff-footer" style="justify-content: space-between;">
        <div class="footer-left">
          <button id="diffDiscard" class="btn-ghost danger">${I18nService.t(
            "btnDiscard"
          )}</button>
        </div>
        <div class="footer-right">
          <button id="diffRegenerate" class="btn-secondary"><i class="fa-solid fa-rotate-right"></i> ${I18nService.t(
            "btnRegenerate"
          )}</button>
          <button id="diffApply" class="btn-primary">${I18nService.t(
            "btnApply"
          )}</button>
        </div>
      </div>
    `;

    // Create Overlay
    const overlay = document.createElement("div");
    overlay.className = "diff-overlay";
    overlay.onclick = () => this.minimizeDiff();

    this.shadow.appendChild(overlay);
    this.shadow.appendChild(modal); // Ensure modal is on top

    this.currentDiffModal = modal;
    this.currentDiffOverlay = overlay;

    // --- Events ---

    // Close / Minimize
    const closeBtn = modal.querySelector(".diff-close");
    if (closeBtn) closeBtn.onclick = () => this.minimizeDiff();

    // Copy
    const copyBtn = modal.querySelector("#diffCopyBtn");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(optimized).then(() => {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        copyBtn.style.color = "var(--success)";
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML; // Restore icon
          copyBtn.style.color = "";
        }, 1500);
      }).catch(() => {
        this.showToast(
          I18nService.t("errCopyFailed") || "Could not copy to the clipboard.",
          "danger"
        );
      });
    };

    // Regenerate
    modal.querySelector("#diffRegenerate").onclick = () => {
      this.hideDiff();
      this.hideMinimizedFab();
      if (onRegenerate) onRegenerate();
    };

    // Apply
    modal.querySelector("#diffApply").onclick = () => {
      if (onApply) onApply(optimized); // Note: Content is not editable div anymore, so we pass original optimized text.
      // If user wants edit, we need textarea. But user complained about textarea look.
      // Assuming read-only for now based on "disfigured" complaint about inputs.
      this.hideDiff();
      this.hideMinimizedFab();
    };

    // Discard
    modal.querySelector("#diffDiscard").onclick = () => {
      if (onDiscard) onDiscard();
      this.hideDiff();
      this.hideMinimizedFab();
    };

    // --- Keyboard Event Handler for Review UI ---
    const reviewKeyListener = (e) => {
      // Only handle when diff is visible and not loading
      if (!this.diffVisible || this.isLoading) return;
      // Skip if diff is minimized
      if (this.isReviewMinimized) return;

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Trigger Apply
        modal.querySelector("#diffApply")?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Trigger Minimize
        this.minimizeDiff();
      }
    };

    // Store reference for cleanup and add listener with capture phase
    this.reviewKeyListener = reviewKeyListener;
    document.addEventListener("keydown", reviewKeyListener, true);
  }

  minimizeDiff() {
    if (this.currentDiffModal) {
      this.currentDiffModal.style.display = "none";
    }
    if (this.currentDiffOverlay) {
      this.currentDiffOverlay.style.display = "none";
    }

    this.showMinimizedFab(() => {
      // Restore Callback: Re-open Diff
      if (this.currentDiffModal) {
        this.currentDiffModal.style.display = "flex"; // Changed to flex to fix layout
        this.isReviewMinimized = false;
        this.hideMinimizedFab();
      }
      if (this.currentDiffOverlay) {
        this.currentDiffOverlay.style.display = "block";
      }
    });
  }

  hideDiff() {
    // Remove keyboard listener
    if (this.reviewKeyListener) {
      document.removeEventListener("keydown", this.reviewKeyListener, true);
      this.reviewKeyListener = null;
    }
    if (this.currentDiffModal) {
      this.currentDiffModal.remove();
      this.currentDiffModal = null;
    }
    if (this.currentDiffOverlay) {
      this.currentDiffOverlay.remove();
      this.currentDiffOverlay = null;
    }
    this.diffVisible = false;
    this.isLoading = false;
  }

  /**
   * Refresh the language of the currently displayed diff modal.
   * Called when the user changes the language setting.
   */
  refreshDiffLanguage() {
    if (!this.currentDiffModal || !this.diffVisible) {
      return;
    }

    // Update h4 titles
    const h4s = this.currentDiffModal.querySelectorAll(".diff-pane h4");
    if (h4s[0]) h4s[0].textContent = I18nService.t("diffOriginal");
    if (h4s[1]) h4s[1].textContent = I18nService.t("diffOptimized");

    // Update button texts
    const discardBtn = this.currentDiffModal.querySelector("#diffDiscard");
    const regenBtn = this.currentDiffModal.querySelector("#diffRegenerate");
    const applyBtn = this.currentDiffModal.querySelector("#diffApply");

    if (discardBtn) discardBtn.textContent = I18nService.t("btnDiscard");
    if (regenBtn) {
      // Preserve icon
      regenBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> ${I18nService.t(
        "btnRegenerate"
      )}`;
    }
    if (applyBtn) applyBtn.textContent = I18nService.t("btnApply");

    console.log("[PromptSmith] Diff language refreshed");
  }

  async showHistoryModal() {
    this.hideFab();
    if (this.currentDiffModal) this.hideDiff();
    
    const overlay = document.createElement("div");
    overlay.className = "diff-overlay";
    overlay.style.zIndex = "2147483648"; // Higher than review modal
    
    const modal = document.createElement("div");
    modal.className = "history-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", I18nService.t("sectionHistory"));
    
    modal.innerHTML = `
        <div class="history-header">
          <div class="history-search-container">
            <!-- Custom Dropdown -->
            <div class="custom-dropdown" id="historyStrategyDropdown">
               <button class="custom-dropdown-trigger" type="button">
                  <span class="trigger-content">
                     <span class="trigger-text">${I18nService.t("placeholderFilterStrategy") || "Filter..."}</span>
                  </span>
                  <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
               </button>
               <div class="custom-dropdown-menu"></div>
            </div>

            <!-- Search Wrapper -->
            <div class="history-search-wrapper">
               <i class="fa-solid fa-magnifying-glass history-search-icon"></i>
               <input type="text" class="history-search" placeholder="${I18nService.t("placeholderSearchHistory") || "Search history..."}">
            </div>
          </div>
          <button type="button" class="diff-close" aria-label="${I18nService.t(
            "btnCancel"
          )}" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">×</button>
        </div>
        <div class="history-list">
          <div class="spinner" style="margin: 20px auto;"></div>
        </div>
      `;
    
    this.shadow.appendChild(overlay);
    this.shadow.appendChild(modal);
    
    // Custom Dropdown Logic
    const dropdown = modal.querySelector(".custom-dropdown");
    const dropdownTrigger = dropdown.querySelector(".custom-dropdown-trigger");
    const dropdownMenu = dropdown.querySelector(".custom-dropdown-menu");
    const dropdownText = dropdown.querySelector(".trigger-text");
    let currentFilter = "";
    
    const toggleDropdown = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    };
    dropdownTrigger.onclick = toggleDropdown;
    
    const closeDropdown = (e) => {
       if (!dropdown.contains(e.composedPath()[0])) {
           dropdown.classList.remove("open");
       }
    };
    
    // Use click on shadow root to handle clicks outside
    this.shadow.addEventListener("click", closeDropdown);
    
    
    // Close Logic
    const close = () => {
      this.shadow.removeEventListener("click", closeDropdown);
      modal.remove();
      overlay.remove();
      document.removeEventListener("keydown", keyHandler, true);
    };
    
    modal.querySelector(".diff-close").onclick = close;
    overlay.onclick = close;
    
    const keyHandler = (e) => {
      if (e.key === "Escape") {
         e.preventDefault(); e.stopPropagation();
         close();
      }
    };
    // Use capture to prevent other handlers
    document.addEventListener("keydown", keyHandler, true);
    
    // Load Data
    const listContainer = modal.querySelector(".history-list");
    const searchInput = modal.querySelector(".history-search");
    
    const renderList = (items) => {
      listContainer.innerHTML = "";
      if (items.length === 0) {
        listContainer.innerHTML = `<div class="history-empty">${I18nService.t("noHistory") || "No history records found."}</div>`;
        return;
      }
      
      items.forEach(item => {
        const el = document.createElement("div");
        el.className = "history-item";
        
        // Time diff
        const diffDesc = this._timeAgo(item.timestamp);
        
        el.innerHTML = `
          <div class="history-meta">
            <span class="history-strategy-tag">${this.escapeHtml(item.strategy)}</span>
            <span>${diffDesc}</span>
          </div>
          <div class="history-preview" title="${this.escapeHtml(item.optimizedResult)}">
             ${this.escapeHtml(item.optimizedResult)}
          </div>
        `;
        
        el.onclick = async () => {
            // Restore this result
            // Define action: Copy? Or Re-open Diff?
            // Let's re-open Diff in "Review Mode" (read only? or allow apply if editable context found?)
            // If user wants edit, we need textarea. But user complained about textarea look.
            // Assuming read-only for now based on "disfigured" complaint about inputs.
            
            // For now: Just copy to clipboard with toast, easiest v1
            try {
              await navigator.clipboard.writeText(item.optimizedResult);
              this.showToast(I18nService.t("tooltipCopied") || "Copied to clipboard", "success");
              close();
            } catch {
              this.showToast(
                I18nService.t("errCopyFailed") || "Could not copy to the clipboard.",
                "danger"
              );
            }
        };
        
        listContainer.appendChild(el);
      });
    };
    
    // Initial Load
    try {
        const history = await StorageService.getHistory(); // Get all to populate dropdown
        
        // Populate Dropdown
        const strategies = new Set(history.map(i => i.strategy).filter(Boolean));
        const sorted = Array.from(strategies).sort();
        
        dropdownMenu.innerHTML = "";
        
        // All Option
        const allOption = document.createElement("div");
        allOption.className = "custom-dropdown-option selected";
        allOption.innerHTML = `<span class="option-text">${I18nService.t("placeholderFilterStrategy") || "Filter..."}</span>`;
        allOption.onclick = () => {
            currentFilter = "";
            dropdownText.textContent = I18nService.t("placeholderFilterStrategy") || "Filter...";
            dropdown.classList.remove("open");
            // Highlight
            dropdownMenu.querySelectorAll(".custom-dropdown-option").forEach(d => d.classList.remove("selected"));
            allOption.classList.add("selected");
            // Re-fetch
            refreshList();
        };
        dropdownMenu.appendChild(allOption);
        
        sorted.forEach(s => {
            const opt = document.createElement("div");
            opt.className = "custom-dropdown-option";
            opt.innerHTML = `<span class="option-text">${this.escapeHtml(s)}</span>`;
            opt.onclick = () => {
                currentFilter = s;
                dropdownText.textContent = s;
                dropdown.classList.remove("open");
                // Highlight
                dropdownMenu.querySelectorAll(".custom-dropdown-option").forEach(d => d.classList.remove("selected"));
                opt.classList.add("selected");
                // Re-fetch
                refreshList();
            };
            dropdownMenu.appendChild(opt);
        });
        
        renderList(history);
        
        // Refresh Helper
        const refreshList = async () => {
             const query = searchInput.value;
             const filtered = await StorageService.getHistory({ query, strategy: currentFilter });
             renderList(filtered);
        };
        
        // Search Binder
        let debounce;
        const handleInput = () => {
            clearTimeout(debounce);
            debounce = setTimeout(refreshList, 300);
        };

        searchInput.oninput = handleInput;
        
        searchInput.focus(); // Auto focus
        
    } catch (e) {
        listContainer.innerHTML = `<div class="history-empty" style="color:var(--danger)">Error loading history</div>`;
        console.error(e);
    }
  }
  
  _timeAgo(timestamp) {
      if (!Number.isFinite(Number(timestamp))) return "";
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return "Just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
  }

  showMinimizedFab(onRestore) {
    this.isReviewMinimized = true;
    this.restoreCallback = onRestore;

    // If we are currently focused on the element, render immediately
    // (TriggerManager might not fire if we just closed modal and didn't move cursor/type)
    if (
      this.diffContext &&
      this.diffContext.element === document.activeElement
    ) {
      // We can simulate a showFab call? Or just render directly.
      // Actually, best to rely on TriggerManager?
      // TriggerManager handles focus logic. But we just set state to true.
      // If we want it to verify position, we should render.
      this.renderReviewFab(this.diffContext.element);
    }
  }

  hideMinimizedFab() {
    if (this.currentMinFabHost) {
      this.currentMinFabHost.remove();
      this.currentMinFabHost = null;
    } else {
      this.currentMinFab?.remove();
    }
    this.currentMinFab = null;
    this._releaseFabMount(this.currentMinFabMount);
    this.currentMinFabMount = null;

    // Cleanup listeners
    if (this.diffContext && this.diffContext.element) {
      if (this.minFabFocusHandler) {
        this.diffContext.element.removeEventListener(
          "focus",
          this.minFabFocusHandler
        );
      }
      if (this.minFabBlurHandler) {
        this.diffContext.element.removeEventListener(
          "blur",
          this.minFabBlurHandler
        );
      }
      if (this.minFabWindowBlurHandler) {
        window.removeEventListener("blur", this.minFabWindowBlurHandler);
      }

      if (this.minFabInputHandler) {
        this.diffContext.element.removeEventListener(
          "input",
          this.minFabInputHandler
        );
      }

      if (this.minFabScrollHandler) {
        window.removeEventListener("scroll", this.minFabScrollHandler, {
          capture: true,
        });
      }

      if (this.fabResizeObserver) {
        this.fabResizeObserver.disconnect();
        this.fabResizeObserver = null;
      }
    }
    this.minFabFocusHandler = null;
    this.minFabBlurHandler = null;
    this.minFabWindowBlurHandler = null;
    this.minFabInputHandler = null;
    this.minFabScrollHandler = null;
  }

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`; // e.g. 'toast danger'
    toast.textContent = message;

    this.shadow.appendChild(toast);

    // Animate In
    setTimeout(() => toast.classList.add("visible"), 10);

    // Remove after 3s
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const p = document.createElement("p");
    p.textContent = String(text ?? "");
    return p.innerHTML;
  }
  cleanup() {
    this.isLoading = false;
    this.hideFab();
    this.hideMinimizedFab();
    this.stopObserving();
    if (this.container) {
      this.container.remove();
    }
  }
}
