export class InjectionManager {
  replaceText(context, newText) {
    const element = context.element;

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      let newValue;
      let newCursorPos;

      if (context.isSelection) {
        // Partial replacement using captured indices
        const originalValue = element.value;
        const start = context.selectionStart;
        const end = context.selectionEnd;

        newValue =
          originalValue.substring(0, start) +
          newText +
          originalValue.substring(end);
        newCursorPos = start + newText.length;
      } else {
        // Full replacement
        newValue = newText;
        newCursorPos = newText.length;
      }

      this.setInputRequest(element, newValue);

      // Restore cursor / focus
      try {
        element.focus();
        element.setSelectionRange(newCursorPos, newCursorPos);
      } catch (e) {
        console.warn("[PromptSmith] Failed to set cursor position:", e.message);
      }
    } else if (element.isContentEditable) {
      this.handleContentEditable(element, context, newText);
    }
  }

  handleContentEditable(element, context, newText) {
    // ContentEditable is tricky.
    // Try simple execCommand first (deprecated but works broadly)

    // If we want to replace ALL (no selection was made)
    if (!context.isSelection) {
      document.execCommand("selectAll", false, null);
    }

    // Better: Use selection range if we had it.
    // MVP: Just replace content of element for now or use insertText at cursor.

    // If we used execCommand 'insertText', it handles Undo stack nicely.
    // Let's try to focus and paste.
    element.focus();

    // Select all content if we are replacing all (?)
    // For now, let's assume we replace selection.
    // Ideally we should have passed range from Trigger context.

    document.execCommand("insertText", false, newText);
  }

  /**
   * React/Vue compatible input setter
   */
  setInputRequest(element, value) {
    const lastValue = element.value;
    element.value = value;

    const event = new Event("input", { bubbles: true });

    // React 15/16 hack
    const tracker = element._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }

    element.dispatchEvent(event);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
