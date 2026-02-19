/**
 * Vibe Combat Module
 * Main entry point - registers hooks and initializes the module
 */

import { registerModuleSettings } from "./settings.js";
import { addVibeCombatButton } from "./ui/combat-button-injector.js";
import { VibeCombatApp } from "./ui/vibe-combat-app.js";

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    console.warn("Vibe Combat: This module requires the dnd5e system.");
    return;
  }
  registerModuleSettings();
});

/**
 * Add Vibe Combat button to Combat Tracker.
 * Mirrors the pattern used by vibe-actor (renderActorDirectory) and
 * vibe-scenes (renderSceneDirectory) which work correctly in v13.
 */
Hooks.on("renderCombatTracker", (app, html, data) => {
  requestAnimationFrame(() => addVibeCombatButton(app, html, VibeCombatApp));
});

// Also hook into renderSidebarTab for v13 (mirrors vibe-actor pattern exactly)
Hooks.on("renderSidebarTab", (app, html, data) => {
  if (app.tabName === "combat") {
    requestAnimationFrame(() => addVibeCombatButton(app, html, VibeCombatApp));
  }
});
