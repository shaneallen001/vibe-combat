/**
 * Vibe Combat Module
 * Main entry point - registers hooks and initializes the module
 */

import { registerModuleSettings } from "./settings.js";
import { addVibeCombatButton, addVibeActorButton, getActorSheetHeaderButtons } from "./ui/button-injector.js";
import { VibeActorDialog } from "./ui/dialogs/vibe-actor-dialog.js";
import { VibeCombatApp } from "./ui/vibe-combat-app.js";
import { ImageGenerator } from "./ui/image-generator.js";

Hooks.once("ready", () => {
  // Ensure we're using the dnd5e system
  if (game.system.id !== "dnd5e") {
    console.warn("Vibe Combat: This module requires the dnd5e system.");
    return;
  }

  // Register module settings
  registerModuleSettings();
});

/**
 * Add Vibe Combat button to Combat Tracker (Encounter tab)
 * For Foundry VTT v13
 */
Hooks.on("renderCombatTracker", (app, html, data) => {
  // Wait for next frame to ensure DOM is ready
  requestAnimationFrame(() => {
    addVibeCombatButton(app, html, VibeCombatApp);
  });
});

// Also hook into sidebar tab rendering for v13
Hooks.on("renderSidebarTab", (app, html, data) => {
  if (app.tabName === "combat") {
    requestAnimationFrame(() => {
      addVibeCombatButton(app, html, VibeCombatApp);
    });
  }
  if (app.tabName === "actors") {
    requestAnimationFrame(() => {
      addVibeActorButton(app, html, () => VibeActorDialog.show());
    });
  }
});

// Hook into Actor Directory rendering for additional compatibility
Hooks.on("renderActorDirectory", (app, html, data) => {
  requestAnimationFrame(() => {
    addVibeActorButton(app, html, () => VibeActorDialog.show());
  });
});

// Hook into Actor Sheet header buttons to add the Generate Image button
Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  getActorSheetHeaderButtons(app, buttons);
});

