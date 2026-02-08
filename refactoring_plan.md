# Vibe Combat Refactoring Checklist

Work through each item in order. Each task is self-contained.

---

## Priority 1: Remove Duplicate Files

- [x] **1.1 Delete duplicate Zod library**
  - Delete [scripts/tests/zod.mjs](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/vibe-combat/scripts/tests/zod.mjs) (62KB duplicate)
  - Keep [scripts/libs/zod.js](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/vibe-combat/scripts/libs/zod.js) as the single source
  - Update any imports in `scripts/tests/` to use `../libs/zod.js`

- [x] **1.2 Delete duplicate zod-to-json-schema**
  - Delete `scripts/tests/zod-to-json-schema.mjs`
  - Keep `scripts/utils/zod-to-json-schema.js` as the single source
  - Update imports in `scripts/tests/test_zod_schema.mjs`

---

## Priority 2: Relocate Misplaced Files

- [x] **2.1 Move EncounterSuggestionService to services/**
  - Move `scripts/ui/encounter-suggestion-service.js` → `scripts/services/encounter-suggestion-service.js`
  - Update all imports (check `vibe-combat-app.js`)

- [x] **2.2 Extract SUGGESTION_TYPES to constants**
  - Move `SUGGESTION_TYPES` array from `encounter-suggestion-service.js` to `scripts/constants.js`
  - Update imports

---

## Priority 3: Extract Shared Utilities

- [x] **3.1 Create item-utils.js**
  - Create `scripts/utils/item-utils.js`
  - Move from `actor-factory.js`: `ensureValidId`, `ensureItemHasId`, `ensureItemHasImage`, `ensureActivityIds`, `autoEquipIfArmor`, `sanitizeCustomItem`
  - Update imports in `actor-factory.js` and `compendium-service.js`

- [x] **3.2 Move _mapSkills to actor-helpers.js**
  - Move `_mapSkills` method from `gemini-pipeline.js` to `scripts/utils/actor-helpers.js`
  - Export as `mapSkillsToKeys` and update import in pipeline

---

## Priority 4: Decompose Large Files

- [x] **4.1 Extract SpellcastingBuilder from GeminiPipeline**
  - Create `scripts/services/spellcasting-builder.js`
  - Move `_buildSpellcastingFeat` logic (~200 lines) to new class
  - Keep `GeminiPipeline` calling the builder

- [ ] **4.2 Extract SuggestionPanelManager from VibeCombatApp**
  - Create `scripts/ui/suggestion-panel-manager.js`
  - Move methods: `_startSuggestionRequest`, `_cancelSuggestionRequest`, `_retrySuggestionRequest`, `_hideSuggestionPanel`, `_showSuggestionPanel`, `_loadSuggestionResults`, `_buildSuggestionViewModel`, `_getSuggestionStatusMessage`, `_openSuggestionDialog`
  - Keep `VibeCombatApp` delegating to manager

- [ ] **4.3 Extract XpMeterRenderer from VibeCombatApp**
  - Create `scripts/ui/xp-meter-renderer.js`
  - Move methods: `_buildXpMeter`, `_buildDifficultyViewModel`, `formatNumber`

---

## Priority 5: Template Extraction

- [x] **5.1 Create vibe-actor-dialog.html template**
  - Create `templates/vibe-actor-dialog.html`
  - Move inline HTML from `vibe-actor-dialog.js` show() method
  - Use Foundry's `loadTemplates()` pattern

---

## Priority 6: Cleanup Legacy Code

- [x] **6.1 Remove generateActorData if unused**
  - Check if `generateActorData` in `gemini-service.js` is called anywhere
  - If unused, delete the function (~153 lines)

---

## Verification (Run After Each Task)

```bash
# Test actor generation pipeline
node scripts/utils/test-generation.js

# Test schema validation
node scripts/tests/test_zod_schema.mjs
```

Manual: Open Foundry VTT, test Vibe Actor generation and Vibe Combat encounter panel.

---

## After All Tasks Complete

- [ ] Update `README.md` to reflect any structural changes
- [ ] Git commit with message: `refactor: code cleanup and file reorganization`
