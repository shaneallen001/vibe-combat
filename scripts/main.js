/**
 * Vibe Combat Module
 * Main entry point - registers hooks and initializes the module
 */

import { registerModuleSettings } from "./settings.js";
import { addVibeCombatButton, addVibeActorButton } from "./ui/button-injector.js";
import { VibeActorDialog } from "./ui/dialogs/vibe-actor-dialog.js";
import { VibeCombatApp } from "./ui/vibe-combat-app.js";
import { ImageGenerator } from "./ui/image-generator.js";
import { VibeAdjustmentDialog } from "./ui/dialogs/vibe-adjustment-dialog.js";

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



// Function to hook header buttons for various sheet types

// Hook for ApplicationV2 sheets (Foundry V13+)
Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  // Only for GMs
  if (!game.user.isGM) return;

  // Check if it's an Actor Sheet
  if (app instanceof foundry.applications.sheets.ActorSheetV2) { // Verify this class name in environment if possible, or use duck typing/base class check
    const actor = app.document;
    if (!actor) return;

    console.log("Vibe Combat | getHeaderControlsApplicationV2 called for:", actor.name);

    // Add "Vibe Image" button
    console.log("Vibe Combat | Injecting Vibe Image button for", actor.name);
    controls.push({
      icon: "fas fa-magic",
      label: "Vibe Image",
      action: "vibeImage",
      onClick: async () => {
        console.log("Vibe Combat | Vibe Image button clicked for", actor.name);
        try {
          await ImageGenerator.generateImage(actor);
        } catch (error) {
          console.error("Vibe Combat | Error in Vibe Image handler:", error);
        }
      }
    });

    // Add "Vibe Adjust" button
    controls.push({
      icon: "fas fa-wrench",
      label: "Vibe Adjust",
      action: "vibeAdjustActor",
      onClick: () => {
        new VibeAdjustmentDialog(actor).render(true);
      }
    });
  }
});




