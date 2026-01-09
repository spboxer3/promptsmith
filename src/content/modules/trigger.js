export class TriggerManager {
  constructor(config, callbacks) {
    this.config = config;
    this.callbacks = callbacks; // { onTrigger, onSelection, onSelectionClear }
    this.currentSelection = null;
  }

  start() {
    document.addEventListener("keydown", this.handleKeydown.bind(this));
    document.addEventListener(
      "selectionchange",
      this.handleSelection.bind(this)
    );
    // Listen for focus on inputs
    document.addEventListener("focusin", this.handleFocus.bind(this));
    document.addEventListener("focusout", this.handleBlur.bind(this));

    // Listen for window blur (switching tabs/apps)
    window.addEventListener("blur", () => {
      this.callbacks.onSelectionClear();
    });

    // Check initial state
    if (this.isEditable(document.activeElement)) {
      this.handleFocus({ target: document.activeElement });
    }

    // Listen for config changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes["appConfig"]) {
        this.config = { ...this.config, ...changes["appConfig"].newValue };
        console.log("[PromptSmith] Config updated", this.config);
      }
    });
  }

  handleFocus(e) {
    const target = e.target;
    if (this.isEditable(target)) {
      // Delay slightly to ensure layout is ready
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        this.callbacks.onSelection(rect, target);
      }, 50);
    }
  }

  handleBlur(e) {
    // We need to clear, but UI might handle click inside itself (FAB).
    // UI handles its own persistence via mousedown prevention.
    // So we can signal clear, and UI normally hides FAB if it's not the click target.
    // But `focusout` happens before `mousedown` on FAB? No. `mousedown` prevents blur if preventDefault is called?
    // Actually, clicking FAB (div) usually causes blur on Input.
    // But we added preventDefault on FAB mousedown, so Input STAYS focused.
    // So focusout WON'T fire when clicking FAB.
    // So it is safe to call onSelectionClear here.

    // Give a small delay in case focus moves to another input immediately
    setTimeout(() => {
      if (document.activeElement && this.isEditable(document.activeElement)) {
        // Focus moved to another editable, handleFocus will trigger
        return;
      }
      this.callbacks.onSelectionClear();
    }, 100);
  }

  handleKeydown(e) {
    const triggerKey = this.config.triggerKey || "Ctrl+Shift+P";

    let targetKey = "";
    let modifiers = [];

    // Robust parsing to handle "+" key (e.g., "Ctrl++")
    if (triggerKey.endsWith("++")) {
      targetKey = "+";
      const rest = triggerKey.slice(0, -2); // Remove final "++" (separator + key)
      modifiers = rest.split("+").filter((p) => p !== "");
    } else {
      const parts = triggerKey.split("+");
      targetKey = parts.pop().toLowerCase();
      modifiers = parts.filter((p) => p !== "");
    }

    // Check key match
    if (e.key.toLowerCase() !== targetKey) {
      // Just content typing check
      setTimeout(() => this.handleSelection(), 50);
      return;
    }

    // Check modifiers
    const isMatch = modifiers.every((mod) => {
      if (mod === "Cmd") return e.metaKey || e.ctrlKey; // Allow Ctrl on Windows for "Cmd" default
      if (mod === "Ctrl") return e.ctrlKey;
      if (mod === "Alt") return e.altKey;
      if (mod === "Shift") return e.shiftKey;
      return false;
    });

    if (isMatch) {
      e.preventDefault();
      console.log("[PromptSmith] Custom trigger detected:", triggerKey);
      this.manualTrigger();
    }

    // Also trigger update on typing to show/hide FAB based on content length
    setTimeout(() => this.handleSelection(), 50);
  }

  handleSelection() {
    const selection = window.getSelection();

    // Check highlight
    const text = selection.toString().trim();
    if (text.length > 0 && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectionState = {
        text: text,
        isSelection: true,
        range: range, // persistent range ref
      };

      const active = document.activeElement;
      if (this.isEditable(active)) {
        this.callbacks.onSelection(
          range.getBoundingClientRect(),
          active,
          selectionState
        );
        return;
      }
      // Non-editable selection (static text)
      this.callbacks.onSelection(
        range.getBoundingClientRect(),
        null,
        selectionState
      );
      return;
    }

    // Check content in active editable
    const active = document.activeElement;
    if (this.isEditable(active)) {
      const val = active.value || active.innerText || active.textContent || "";
      if (val.trim().length > 0) {
        // Has content, show FAB attached to element
        const selectionState = {
          start: active.selectionStart,
          end: active.selectionEnd,
          text: val.substring(active.selectionStart, active.selectionEnd),
          isSelection: active.selectionStart !== active.selectionEnd,
        };
        this.callbacks.onSelection(
          active.getBoundingClientRect(),
          active,
          selectionState
        );
        return;
      }
    }

    this.callbacks.onSelectionClear();
  }

  manualTrigger(targetElementOverride = null, snapshotState = null) {
    console.log(
      "[PromptSmith] TriggerManager.manualTrigger called",
      snapshotState
    );
    const activeElement = targetElementOverride || document.activeElement;
    let text = "";
    let start = 0;
    let end = 0;

    if (snapshotState && snapshotState.isSelection) {
      // Use persisted state
      start = snapshotState.start;
      end = snapshotState.end;
      text = snapshotState.text;
    } else if (
      activeElement.tagName === "TEXTAREA" ||
      activeElement.tagName === "INPUT"
    ) {
      // ... existing logic ...
      start = activeElement.selectionStart;
      end = activeElement.selectionEnd;
      text = activeElement.value.substring(start, end);

      // If no text selected, take all? Or just cursor?
      // MVP: If no selection, take all text.
      if (!text) {
        text = activeElement.value;
      }
    } else if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      text = selection.toString();

      // Fallback: If no selection in contenteditable, take all text
      if (!text) {
        text = activeElement.innerText || activeElement.textContent;
      }
    } else {
      // Fallback for non-editable pages (Static text)
      const selection = window.getSelection();
      text = selection.toString();
    }

    console.log(
      "[PromptSmith] Captured text:",
      text ? text.substring(0, 20) + "..." : "EMPTY"
    );

    if (!text) return;

    let rect;
    let range;
    if (snapshotState && snapshotState.range) {
      range = snapshotState.range;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }
    }

    if (range) {
      try {
        rect = range.getBoundingClientRect();
      } catch (e) {}
    }

    // Fallback to element rect
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = activeElement.getBoundingClientRect();
    }

    // Determine isSelection
    let isSelection = false;
    if (snapshotState) {
      isSelection = snapshotState.isSelection;
    } else {
      // dynamic check
      if (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA"
      ) {
        isSelection = start !== end;
      } else {
        // ContentEditable
        // If text implies selection, or if range is not collapsed
        if (range && !range.collapsed) {
          isSelection = true;
        } else {
          isSelection = text && text.length > 0;
        }
      }
    }

    this.callbacks.onTrigger({
      text,
      element: activeElement,
      rect,
      isSelection: isSelection,
      selectionStart: start,
      selectionEnd: end,
      range: range,
    });
  }

  isEditable(element) {
    if (!element) return false;
    const tagName = element.tagName;
    return (
      tagName === "INPUT" || tagName === "TEXTAREA" || element.isContentEditable
    );
  }
}
