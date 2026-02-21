/**
 * Vibe Combat Module
 * Main entry point - registers hooks and initializes the module
 */

import { registerModuleSettings } from "./settings.js";
import { addVibeCombatButton } from "./ui/combat-button-injector.js";
import { VibeCombatApp } from "./ui/vibe-combat-app.js";
import { clearCache as clearCompendiumCache } from "./services/compendium-service.js";
import { EncounterSuggestionService } from "./services/encounter-suggestion-service.js";

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    console.warn("Vibe Combat: This module requires the dnd5e system.");
    return;
  }

  const module = game.modules.get("vibe-combat");
  if (module) {
    module.api = {
      VibeCombatApp
    };
  }

  registerModuleSettings();
});

// The original "Vibe Combat" sidebar button has been removed in favor of the unified Vibe Menu in vibe-common.

/**
 * Cache Invalidation Hooks
 * Listen for document creations or updates to clear the compendium index cache.
 * We only clear if the document is part of a compendium or if we want world actors update.
 */
function handleDocumentChange(doc) {
  // Clear caches if the document is in a compendium, or if it's an actor (world actors are used for suggestions)
  if (doc.pack || doc.documentName === "Actor") {
    clearCompendiumCache();
    EncounterSuggestionService.clearCache();
  }
}

Hooks.on("createActor", handleDocumentChange);
Hooks.on("updateActor", handleDocumentChange);
Hooks.on("deleteActor", handleDocumentChange);
Hooks.on("createItem", handleDocumentChange);
Hooks.on("updateItem", handleDocumentChange);
Hooks.on("deleteItem", handleDocumentChange);
