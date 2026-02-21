# Vibe Combat Architecture & Developer Guide

This document is intended for AI agents and human developers working on the `vibe-combat` module. Complete usage details are in [README.md](./README.md).

## 1. Entry Point & Hooks (`scripts/main.js`)

This is the first file executed by Foundry. It registers two hooks to inject the Vibe Combat button into the Combat Tracker sidebar:

```
Hooks.once("init")             → Checks for `vibe-common` dependency; aborts and notifies if missing
Hooks.once("ready")            → Validates dnd5e system requirement, calls registerModuleSettings()
Hooks.on("renderCombatTracker")→ Calls addVibeCombatButton() via requestAnimationFrame
Hooks.on("renderSidebarTab")   → Same as above, but guards on app.tabName === "combat" for v13
```

> **Why two hooks?** In Foundry v13, `renderCombatTracker` and `renderSidebarTab` can both fire depending on how the user opens the tab. Both are registered defensively so the button always appears.

## 2. Key Classes & Data Flow

### Encounter Suggestion Flow
```
User clicks "Suggest Encounter"
  → VibeCombatApp._onSuggestEncounter()
  → EncounterSuggestionService.buildCreatureCatalog({ includeWorldActors, packIds })
       → Queries game.actors (world NPCs) + game.packs (compendium indexes, cached)
  → EncounterSuggestionService.requestSuggestions({ partyMembers, catalog, typeId, apiKey })
       → Builds a JSON payload with party summary, XP budgets, catalog list
       → Calls callGemini() (from vibe-common GeminiService)
       → Parses and validates response: only UUIDs present in the catalog are kept
       → Throws if no valid entries returned
  → VibeCombatApp re-renders with suggestion results
```

### Encounter State (EncounterManager)
`EncounterManager` is an **in-memory, instance-scoped** state class. One instance lives inside `VibeCombatApp`. It is **not a singleton**.

| Method                            | Behavior                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `addActorEntry(actor, qty)`       | Merges if actor UUID already present; otherwise appends                          |
| `addEntry(cr, qty)`               | Adds a "stand-in" (no live actor attached)                                       |
| `saveEncounter(name, setDefault)` | Serializes to `game.settings` keyed object                                       |
| `loadEncounterById(id)`           | Resolves actor UUIDs via `fromUuid()`; falls back to stand-in if actor not found |

**Persistence**: Encounters are stored in `game.settings` under `"vibe-combat"` → `"savedEncounters"` as a flat object keyed by `randomID()`. The active default is stored in `"defaultEncounterId"`.

## 3. Settings (`scripts/settings.js`)
All settings registered via `game.settings.register("vibe-combat", ...)`:

| Key                          | Type   | Notes                                    |
| ---------------------------- | ------ | ---------------------------------------- |
| `savedEncounters`            | Object | `{ [id]: { name, entries[], savedAt } }` |
| `defaultEncounterId`         | String | ID of default encounter                  |
| `encounterSuggestionSources` | Object | `{ includeWorldActors, packIds[] }`      |
| `suggestionPromptTemplate`   | String | Custom prompt prefix                     |

## 4. Common Gotchas
- **Catalog UUID mismatch**: The most common AI error is Gemini returning a UUID not in the catalog. The service filters these out and throws if no valid entries remain. The catalog is built fresh on each suggestion call — no stale state.
- **Pack index caching**: `PACK_INDEX_CACHE` is a module-level `Map` that caches compendium index results per session. Clear it (or reload) if you add new actors to a compendium during a session.
- **Actor Placement Origin**: When placing tokens from encounter suggestions programmatically, you must check if the linked `actor.pack` exists. If the actor is from a compendium pack, it must be imported into the world (`game.actors.importFromCompendium`) before calling `getTokenDocument()`, otherwise the resulting token is detached and cannot open its actor sheet.
