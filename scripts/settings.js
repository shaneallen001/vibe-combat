import {
  EncounterSuggestionService,
  DEFAULT_SUGGESTION_PROMPT
} from "./services/encounter-suggestion-service.js";
import { SUGGESTION_TYPES } from "./constants.js";
import { SuggestionSourcesConfig } from "./ui/suggestion-sources-config.js";

/**
 * Module Settings Registration
 * Registers all module settings for Vibe Combat
 */
export function registerModuleSettings() {
  game.settings.register("vibe-combat", "geminiApiKey", {
    name: "Gemini API Key",
    hint: "Your Google Gemini API key for generating actors",
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });

  game.settings.register("vibe-combat", "allowPlayerActorGeneration", {
    name: "Allow Players to Generate Actors",
    hint: "If enabled, players can use the Vibe Actor features using the GM's API keys (Gemini & OpenAI). Players must also have the 'Create New Actors' permission in Foundry.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register("vibe-combat", "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Your OpenAI API key for generating actor images",
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });

  game.settings.register("vibe-combat", "savedParties", {
    name: "Saved Parties",
    hint: "Internal setting for saved party configurations",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register("vibe-combat", "defaultPartyId", {
    name: "Default Party ID",
    hint: "Internal setting for the default party ID",
    scope: "world",
    config: false,
    type: String,
    default: null
  });

  game.settings.register("vibe-combat", "savedEncounters", {
    name: "Saved Encounters",
    hint: "Internal setting for saved encounter configurations",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register("vibe-combat", "defaultEncounterId", {
    name: "Default Encounter ID",
    hint: "Internal setting for the default encounter ID",
    scope: "world",
    config: false,
    type: String,
    default: null
  });

  const suggestionChoices = Object.fromEntries(
    SUGGESTION_TYPES.map((type) => [type.id, type.label])
  );

  game.settings.register("vibe-combat", "defaultSuggestionType", {
    name: "Default Suggestion Style",
    hint: "Encounter style that is preselected when requesting AI suggestions.",
    scope: "world",
    config: true,
    type: String,
    choices: suggestionChoices,
    default: EncounterSuggestionService.getDefaultTypeId()
  });

  game.settings.register("vibe-combat", "suggestionPromptTemplate", {
    name: "Suggestion Prompt Template",
    hint: "Base instructions appended to every encounter suggestion request.",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_SUGGESTION_PROMPT,
    textArea: true
  });

  // --- Encounter suggestion sources (new) ---
  // Backing setting storing selected Actor compendium pack IDs (e.g. "dnd5e.monsters").
  game.settings.register("vibe-combat", "suggestionSourceCompendiums", {
    name: "Suggestion Source Compendiums",
    hint: "Internal setting: selected Actor compendium packs used as the allowed catalog for suggestions.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Whether to include world NPC actors in the allowed catalog.
  game.settings.register("vibe-combat", "suggestionIncludeWorldActors", {
    name: "Suggestion Include World Actors",
    hint: "Internal setting: include world NPC actors in the allowed catalog for suggestions.",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  // Settings menu for selecting suggestion sources.
  game.settings.registerMenu("vibe-combat", "suggestionSourcesMenu", {
    name: "Encounter Suggestion Sources",
    label: "Configure Suggestion Sources",
    hint:
      "Choose which compendium packs (and whether world NPC actors) Gemini may suggest from. Suggestions will return UUIDs from this allowed catalog.",
    icon: "fas fa-book-open",
    type: SuggestionSourcesConfig,
    restricted: true
  });

  // --- Deprecated settings (kept for migration/backwards compatibility) ---
  game.settings.register("vibe-combat", "suggestionIncludeCompendiums", {
    name: "Suggestion Compendium Allow List (Deprecated)",
    hint:
      "Deprecated: used only for migration. Use the 'Encounter Suggestion Sources' menu instead.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("vibe-combat", "suggestionExcludeCompendiums", {
    name: "Suggestion Compendium Block List (Deprecated)",
    hint:
      "Deprecated: used only for migration. Use the 'Encounter Suggestion Sources' menu instead.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("vibe-combat", "lastSuggestionType", {
    name: "Last Suggestion Type",
    scope: "client",
    config: false,
    type: String,
    default: null
  });

  // Perform one-time migration and/or initialize defaults.
  // (Safe to run every boot; only writes when the new selection is empty.)
  migrateSuggestionSourceSettings().catch((error) => {
    console.warn("Vibe Combat: Failed to migrate suggestion source settings", error);
  });
}

async function migrateSuggestionSourceSettings() {
  const current = game.settings.get("vibe-combat", "suggestionSourceCompendiums");
  const hasSelection = Array.isArray(current) && current.length > 0;
  if (hasSelection) return;

  const includeWorldActors =
    game.settings.get("vibe-combat", "suggestionIncludeWorldActors") ?? true;

  // Prefer migrating from the old allow list if present.
  const legacyAllow = (game.settings.get("vibe-combat", "suggestionIncludeCompendiums") || "")
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (legacyAllow.length > 0) {
    await game.settings.set("vibe-combat", "suggestionSourceCompendiums", legacyAllow);
    if (typeof includeWorldActors !== "boolean") {
      await game.settings.set("vibe-combat", "suggestionIncludeWorldActors", true);
    }
    return;
  }

  // Otherwise default to all loaded Actor packs (reasonable v1 UX).
  const allActorPacks = Array.from(game.packs ?? [])
    .filter((pack) => pack.documentName === "Actor")
    .map((pack) => pack.collection);

  await game.settings.set("vibe-combat", "suggestionSourceCompendiums", allActorPacks);
  if (typeof includeWorldActors !== "boolean") {
    await game.settings.set("vibe-combat", "suggestionIncludeWorldActors", true);
  }
}

