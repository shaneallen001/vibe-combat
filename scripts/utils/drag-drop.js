/**
 * Drag and Drop Utilities
 * Helper functions for handling drag and drop events
 */

/**
 * Fallback drag data parser for older core versions
 */
export function legacyParseDragEvent(event) {
  try {
    const dragData = event.dataTransfer?.getData("text/plain");
    if (!dragData) return null;
    return JSON.parse(dragData);
  } catch (error) {
    console.warn("Vibe Combat: Could not parse drag data", error);
    return null;
  }
}

/**
 * Extract drag data from event using Foundry utilities
 */
export function getDragEventData(event) {
  const rawEvent = event?.originalEvent ?? event;

  // Foundry v13+: TextEditor is namespaced under foundry.applications.ux.TextEditor.implementation
  const textEditor =
    globalThis.foundry?.applications?.ux?.TextEditor?.implementation ??
    globalThis.foundry?.applications?.ux?.TextEditor ??
    globalThis.TextEditor;

  // Use Foundry utility to extract drag data (handles compendium drops)
  if (typeof textEditor?.getDragEventData === "function") {
    return textEditor.getDragEventData(rawEvent);
  }

  return legacyParseDragEvent(rawEvent);
}

