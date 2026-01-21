import { StorageService } from "../../lib/storage.js";

import { I18nService } from "../../lib/i18n.js";

export class UIManager {
  constructor() {
    this.container = document.createElement("div");
    this.container.id = "promptsmith-root";
    document.body.appendChild(this.container);

    this.shadow = this.container.attachShadow({ mode: "open" });
    this.addStyles();

    this.menuVisible = false;
    this.isLoading = false;

    // Review Minimized State
    this.isReviewMinimized = false;
    this.restoreCallback = null;
    this.diffContext = null;
    this.positionDebounceTimer = null;

    // Resize Observer for Dynamic Positioning
    this.observedElement = null;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.updatePositions(entry.target);
      }
    });
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
          src: url("${chrome.runtime.getURL(
            "src/webfonts/fa-solid-900.woff2"
          )}") format("woff2");
        }
        @font-face {
          font-family: "Font Awesome 6 Free";
          font-style: normal;
          font-weight: 400;
          font-display: block;
          src: url("${chrome.runtime.getURL(
            "src/webfonts/fa-regular-400.woff2"
          )}") format("woff2");
        }
      `;
      document.head.appendChild(fontStyle);
    }

    // Inject Font Awesome CSS classes into Shadow DOM
    const faLink = document.createElement("link");
    faLink.rel = "stylesheet";
    faLink.href = chrome.runtime.getURL("src/lib/font-awesome.css");
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
        position: absolute;
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
    `;
    this.shadow.appendChild(style);
  }

  showFab(element, onClick, selectionState = null, showTriggerFab = true) {
    if (this.menuVisible) return;
    this.hideFab();

    if (!element) return;

    // Find the stable anchor (Scroll Container)
    const anchor = this._getStableAnchor(element);
    if (!anchor || !anchor.getBoundingClientRect) return;

    if (showTriggerFab) {
      const fab = document.createElement("div");
      fab.className = "fab";
      const iconUrl = chrome.runtime.getURL("assets/icons/icon48.png");
      fab.innerHTML = `<img src="${iconUrl}" style="width: 20px; height: 20px; object-fit: contain;">`;
      fab.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent focus loss from input
        this.hideFab();
        onClick(selectionState);
      };

      this._calculateFabPosition(fab, anchor);

      this.shadow.appendChild(fab);
      this.currentFab = fab;
    }

    // Start Observing the ANCHOR for resize/scroll, not the inner content
    // We observe even if Trigger FAB is hidden, so Review FAB can position correctly
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
    this.resizeObserver.observe(anchorElement);

    // Add Scroll Listener (Capture to detect any scroll on page)
    this.boundScrollHandler = () => {
      this.updatePositions(anchorElement);
    };
    window.addEventListener("scroll", this.boundScrollHandler, {
      capture: true,
      passive: true,
    });
  }

  stopObserving() {
    if (this.observedElement) {
      this.resizeObserver.unobserve(this.observedElement);
      this.observedElement = null;
    }

    if (this.boundScrollHandler) {
      window.removeEventListener("scroll", this.boundScrollHandler, {
        capture: true,
      });
      this.boundScrollHandler = null;
    }
  }

  updatePositions(anchorElement) {
    // 1. Immediate Update (Fast response)
    this._performUpdate(anchorElement);

    // 2. Debounced Update (Stability check)
    // Fixes issue where site scripts resize input AFTER our event,
    // or layout is still reflowing.
    if (this.positionDebounceTimer) {
      clearTimeout(this.positionDebounceTimer);
    }
    this.positionDebounceTimer = setTimeout(() => {
      this._performUpdate(anchorElement);
    }, 300);
  }

  _performUpdate(anchorElement) {
    // Re-calculate Strategy FAB
    if (this.currentFab) {
      this._calculateFabPosition(this.currentFab, anchorElement);
    }
    // Re-calculate Review FAB
    // Note: Review FAB logic might need the original element to check diffContext match
    // But the positioning should be based on the anchor.
    // The previous code passed 'element' (which became 'anchorElement' here).
    // So distinct logic for Review FAB check vs positioning?

    // Let's rely on _calculateFabPosition doing the right thing if passed the anchor.
    // Wait, _calculateFabPosition calls _getStableAnchor internally in previous code?
    // We should simplify: Pass the ALREADY RESOLVED anchor to _calculateFabPosition.

    if (
      this.currentMinFab &&
      this.isReviewMinimized &&
      this.diffContext
      // We can't easily check diffContext.element === anchorElement if anchor is different.
      // But we are only observing the relevant anchor.
    ) {
      // Just re-render based on this anchor
      const fab = this.currentMinFab;
      // Optimization: Don't re-render entire DOM, just calc pos
      this._calculateFabPosition(fab, anchorElement);

      // Manual Offset logic duplicated here?
      // Ideally _calculateFabPosition handles base, renderReviewFab handles offset.
      const currentLeft = parseFloat(fab.style.left);
      // Reset to calculating from anchor, then apply offset.
      // Actually renderReviewFab calls _calculateFabPosition then applies offset.
      // Let's call renderReviewFab(diffContext.element) -> which resolves anchor?

      // Simpler: Just recalculate pos directly here for efficiency
      if (fab) {
        const rect = anchorElement.getBoundingClientRect(); // Anchor rect
        // ... duplicate logic or extract helper?
        // Let's just call renderReviewFab with the original element,
        // and ensure renderReviewFab resolves the anchor correctly.

        if (this.diffContext.element) {
          this.renderReviewFab(this.diffContext.element);
        }
      }
    }
  }

  renderReviewFab(element) {
    let fab = this.currentMinFab;
    const anchor = this._getStableAnchor(element); // Resolve anchor
    if (!anchor) return;

    // Create if doesn't exist
    if (!fab) {
      fab = document.createElement("div");
      fab.className = "minimized-fab";
      fab.innerHTML = `<i class="fa-regular fa-pen-to-square"></i>`;
      fab.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.restoreCallback) this.restoreCallback();
      };
      fab.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      this.shadow.appendChild(fab);
      this.currentMinFab = fab;
    }

    this._calculateFabPosition(fab, anchor); // Use Anchor!

    // Manual Offset
    const currentLeft = parseFloat(fab.style.left);
    if (!isNaN(currentLeft)) {
      fab.style.left = currentLeft - 50 + "px";
    }
  }

  _calculateFabPosition(fabElement, targetElement) {
    // targetElement is now expected to be the ANCHOR (Scroll Container)
    if (!targetElement || !targetElement.getBoundingClientRect) return;
    const rect = targetElement.getBoundingClientRect();

    // Standard positioning: Top-Right
    const top = rect.top - 40;
    let left = rect.right - 30;

    // Boundary check
    if (top < 0) {
      // If scrolled out of view or too close to top, show inside
      fabElement.style.top = rect.top + 5 + "px";
      fabElement.style.zIndex = "2147483647";
    } else {
      fabElement.style.top = top + "px";
    }

    fabElement.style.left = left + "px";
  }

  _getStableAnchor(element) {
    if (!element) return null;

    // 1. Look for closest Scroll Container (overflow-y: auto/scroll)
    let current = element;
    // Traverse up, but stop at body to avoid locking to whole page
    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        // Double check it creates a stacking context or is block? Usually fine.
        return current;
      }
      current = current.parentElement;
    }

    // 2. Fallback: closest contenteditable host
    const host = element.closest('[contenteditable="true"]');
    if (host) return host;

    // 3. Fallback: original element
    return element;
  }

  showLoader(element) {
    this.hideFab();
    if (!element || !element.getBoundingClientRect) return;

    this.isLoading = true; // Lock visibility

    const fab = document.createElement("div");
    fab.className = "fab";
    fab.innerHTML = '<div class="spinner"></div>';
    fab.style.cursor = "wait";
    fab.style.pointerEvents = "none"; // Block clicks while loading

    // Reuse positioning logic
    this._calculateFabPosition(fab, element);

    this.shadow.appendChild(fab);
    this.currentFab = fab;
  }

  stopLoader() {
    this.isLoading = false;
    this.hideFab();
  }

  clearFabs() {
    this.hideFab();
    this.hideMinimizedFab();
  }

  hideFab() {
    if (this.isLoading) return; // Prevent external hiding

    this.stopObserving(); // Stop Resize Observer

    if (this.currentFab) {
      this.currentFab.remove();
      this.currentFab = null;
    }
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
      console.error(
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
        <span>${I18nService.t("menuTitle")}</span>
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
        chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
        this.hideMenu();
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

  showReviewLoading(original, context) {
    // If we are already showing diff/loading, hide it to refresh (or we could reuse)
    this.hideDiff();
    this.diffVisible = true;
    this.diffContext = { ...context, element: context.element };
    this.isReviewMinimized = false;
    this.isLoading = true; // Mark as loading
    this.hideMinimizedFab();

    const modal = document.createElement("div");
    modal.className = "diff-modal";

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
        /* Hide X button in header during loading */
        .diff-close.hidden { display: none; }
    `;
    modal.appendChild(style);

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeClass = isDark ? "theme-dark" : "theme-light";

    modal.innerHTML += `
      <div class="diff-header" style="justify-content: center; position: relative;">
        <span>PromptSmith Review</span>
        <!-- X button hidden -->
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
               <div class="loading-text">Processing<span class="dots"></span></div>
           </div>
        </div>
      </div>
      
      <!-- Empty Footer or specialized footer -->
      <div class="diff-footer" style="justify-content: center;">
         <span style="font-size: 12px; color: var(--text-muted);">AI is working on your request...</span>
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

    // --- Keyboard Event Handler for Loading State ---
    const loadingKeyListener = (e) => {
      if (!this.diffVisible) return;
      if (e.key === "Enter" || e.key === "Escape") {
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
        <span>PromptSmith Review</span> <!-- Or specific title key if exists -->
        <button class="diff-close" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">×</button>
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
    if (this.currentMinFab) {
      if (this.shadow.contains(this.currentMinFab)) {
        this.currentMinFab.remove();
      }
      this.currentMinFab = null;
    }

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
    p.textContent = text;
    return p.innerHTML;
  }
  cleanup() {
    this.stopObserving();
    if (this.container) {
      this.container.remove();
    }
  }
}
