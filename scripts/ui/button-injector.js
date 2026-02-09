import { ImageGenerator } from "./image-generator.js";
import { VibeAdjustmentDialog } from "./dialogs/vibe-adjustment-dialog.js";

/**
 * Button Injector
 * Functions for injecting Vibe Combat and Vibe Actor buttons into UI
 */

/**
 * Add the Vibe Combat button to the Combat Tracker
 */
export function addVibeCombatButton(app, html, VibeCombatAppClass) {
  // Try multiple ways to find the Combat Tracker element
  let trackerElement = null;

  // Method 1: Use the app's element if available
  if (app && app.element && app.element.length) {
    trackerElement = app.element[0];
  }

  // Method 2: Find by ID
  if (!trackerElement) {
    trackerElement = document.querySelector("#combat");
  }

  // Method 3: Find by class or data attribute
  if (!trackerElement) {
    trackerElement = document.querySelector(".combat-tracker, [data-tab='combat']");
  }

  // Method 4: Use the html parameter if it's a DOM element
  if (!trackerElement && html && html.length) {
    trackerElement = html[0];
  }

  if (!trackerElement) {
    console.warn("Vibe Combat: Could not find Combat Tracker element");
    return;
  }

  // Check if button already exists
  if (trackerElement.querySelector(".vibe-combat-button")) return;

  // Create the button
  const button = document.createElement("button");
  button.className = "vibe-combat-button";
  button.type = "button";
  button.innerHTML = '<i class="fas fa-swords"></i> Vibe Combat';

  // Add click handler
  button.addEventListener("click", () => {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can use Vibe Combat.");
      return;
    }
    new VibeCombatAppClass().render(true);
  });

  // Find the content area within the combat tracker (window-content or combat-tracker class)
  const contentArea = trackerElement.querySelector(".window-content, .combat-tracker") || trackerElement;

  // Try to find where the combat control buttons are located
  // In v13, buttons are typically in a header section
  const existingButtons = contentArea.querySelectorAll("button");
  let inserted = false;

  // Look for combat control buttons (like "Add Combatant", "Roll Initiative", etc.)
  for (const existingButton of existingButtons) {
    const buttonText = existingButton.textContent || existingButton.innerText || "";
    if (buttonText.includes("Add Combatant") || buttonText.includes("Roll Initiative") || buttonText.includes("Reset")) {
      // Insert after the existing button
      const parent = existingButton.parentNode;
      if (parent) {
        parent.insertBefore(button, existingButton.nextSibling);
        inserted = true;
        break;
      }
    }
  }

  // If we didn't find combat buttons, try to find the header area
  if (!inserted) {
    const header = contentArea.querySelector(".combat-tracker-header, .header-actions, header, .window-header");
    if (header) {
      // Look for any buttons in the header
      const headerButtons = header.querySelectorAll("button");
      if (headerButtons.length > 0) {
        const lastButton = headerButtons[headerButtons.length - 1];
        lastButton.parentNode.insertBefore(button, lastButton.nextSibling);
        inserted = true;
      } else {
        header.appendChild(button);
        inserted = true;
      }
    }
  }

  // Fallback: Find the combat list and insert button before it
  if (!inserted) {
    const combatList = contentArea.querySelector(".combat-list, .directory-list, .directory-items");
    if (combatList && combatList.parentNode) {
      // Create a button container if needed
      const buttonContainer = document.createElement("div");
      buttonContainer.style.padding = "8px";
      buttonContainer.style.borderBottom = "1px solid #e0e0e0";
      buttonContainer.appendChild(button);
      combatList.parentNode.insertBefore(buttonContainer, combatList);
      inserted = true;
    }
  }

  // Final fallback: Prepend to the content area
  if (!inserted) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.padding = "8px";
    buttonContainer.style.borderBottom = "1px solid #e0e0e0";
    buttonContainer.appendChild(button);
    contentArea.insertBefore(buttonContainer, contentArea.firstChild);
    inserted = true;
  }

  // Log success for debugging
  if (inserted) {
    console.log("Vibe Combat: Button added successfully");
  } else {
    console.warn("Vibe Combat: Button could not be inserted");
  }
}

/**
 * Add the Vibe Actor button to the Actor Directory
 */
export function addVibeActorButton(app, html, showVibeActorDialogFn) {
  // Try multiple ways to find the Actor Directory element
  let directoryElement = null;

  // Method 1: Use the app's element if available
  if (app && app.element && app.element.length) {
    directoryElement = app.element[0];
  }

  // Method 2: Find by ID
  if (!directoryElement) {
    directoryElement = document.querySelector("#actors");
  }

  // Method 3: Find by class or data attribute
  if (!directoryElement) {
    directoryElement = document.querySelector(".actors-directory, [data-tab='actors']");
  }

  // Method 4: Use the html parameter if it's a DOM element
  if (!directoryElement && html && html.length) {
    directoryElement = html[0];
  }

  if (!directoryElement) {
    console.warn("Vibe Combat: Could not find Actor Directory element");
    return;
  }

  // Check if button already exists
  if (directoryElement.querySelector(".vibe-actor-button")) return;

  // Create the button
  const button = document.createElement("button");
  button.className = "vibe-actor-button";
  button.type = "button";
  button.innerHTML = '<i class="fas fa-magic"></i> Vibe Actor';

  // Add click handler
  button.addEventListener("click", () => {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can use Vibe Actor.");
      return;
    }
    showVibeActorDialogFn();
  });

  // Find the content area within the actor directory
  const contentArea = directoryElement.querySelector(".window-content, .directory-list") || directoryElement;

  // Try to find where the directory control buttons are located
  const existingButtons = contentArea.querySelectorAll("button");
  let inserted = false;

  // Look for directory control buttons (like "Create Actor", etc.)
  for (const existingButton of existingButtons) {
    const buttonText = existingButton.textContent || existingButton.innerText || "";
    if (buttonText.includes("Create") || buttonText.includes("Add")) {
      // Insert after the existing button
      const parent = existingButton.parentNode;
      if (parent) {
        parent.insertBefore(button, existingButton.nextSibling);
        inserted = true;
        break;
      }
    }
  }

  // If we didn't find buttons, try to find the header area
  if (!inserted) {
    const header = contentArea.querySelector(".directory-header, .header-actions, header, .window-header");
    if (header) {
      // Look for any buttons in the header
      const headerButtons = header.querySelectorAll("button");
      if (headerButtons.length > 0) {
        const lastButton = headerButtons[headerButtons.length - 1];
        lastButton.parentNode.insertBefore(button, lastButton.nextSibling);
        inserted = true;
      } else {
        header.appendChild(button);
        inserted = true;
      }
    }
  }

  // Fallback: Find the directory list and insert button before it
  if (!inserted) {
    const directoryList = contentArea.querySelector(".directory-list, .directory-items");
    if (directoryList && directoryList.parentNode) {
      // Create a button container if needed
      const buttonContainer = document.createElement("div");
      buttonContainer.style.padding = "8px";
      buttonContainer.style.borderBottom = "1px solid #e0e0e0";
      buttonContainer.appendChild(button);
      directoryList.parentNode.insertBefore(buttonContainer, directoryList);
      inserted = true;
    }
  }

  // Final fallback: Prepend to the content area
  if (!inserted) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.padding = "8px";
    buttonContainer.style.borderBottom = "1px solid #e0e0e0";
    buttonContainer.appendChild(button);
    contentArea.insertBefore(buttonContainer, contentArea.firstChild);
    inserted = true;
  }

  // Log success for debugging
  if (inserted) {
    console.log("Vibe Combat: Vibe Actor button added successfully");
  } else {
    console.warn("Vibe Combat: Vibe Actor button could not be inserted");
  }
}


