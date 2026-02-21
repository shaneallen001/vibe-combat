/**
 * Vibe Combat Application Window
 * Main application class for managing party XP budgets and encounters
 */

import { getCrOptions, SUGGESTION_TYPES } from "../constants.js";
import { getActorLevel, getActorCr, getActorPortrait, getEncounterTokenImage } from "../utils/actor-helpers.js";
import { getXpForCr, getXpThresholdsForLevel, calculateXpBudgets, calculateEncounterXp } from "../utils/xp-calculator.js";
import { EncounterSuggestionService } from "../services/encounter-suggestion-service.js";
import { PartyManager } from "../managers/party-manager.js";
import { EncounterManager } from "../managers/encounter-manager.js";
import { PartyDialogs } from "./dialogs/party-dialogs.js";
import { EncounterDialogs } from "./dialogs/encounter-dialogs.js";
import { DragDropHandler } from "../handlers/drag-drop-handler.js";
import { PlacementHandler } from "../handlers/placement-handler.js";

const SUGGESTION_REQUEST_COOLDOWN = 8000;
const DEFAULT_SUGGESTION_IMAGE = "icons/svg/mystery-man.svg";

export class VibeCombatApp extends Application {
  constructor(options = {}) {
    super(options);
    this.partyManager = new PartyManager();
    this.encounterManager = new EncounterManager();
    this.dragDropHandler = new DragDropHandler(this);
    this.placementHandler = new PlacementHandler(this);
    this._defaultEncounterLoaded = false;
    this.suggestionState = {
      status: "idle",
      visible: false,
      hidden: false,
      typeId: this._getPreferredSuggestionType(),
      summary: null,
      suggestions: [],
      error: null,
      metadata: null
    };
    this._suggestionAbortController = null;
    this._lastSuggestionRequestConfig = null;
    this._lastSuggestionRequestedAt = 0;
  }

  get partyMembers() {
    return this.partyManager.members;
  }

  get encounterEntries() {
    return this.encounterManager.entries;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vibe-combat-app",
      title: "Vibe Combat - Party XP Budget",
      template: "modules/vibe-combat/templates/vibe-combat.html",
      width: 980,
      height: "auto",
      resizable: true,
      dragDrop: [
        {
          dragSelector: ".actor-item",
          dropSelector: ".party-drop-zone, .encounter-drop-target"
        }
      ]
    });
  }

  /**
   * Get initial data including loading default party and encounter
   */
  async getData(options = {}) {
    // Load default party on first getData call if not already loaded
    // Load default party on first getData call if not already loaded
    await this.partyManager.initialize();

    // Load default encounter on first getData call if not already loaded
    await this.encounterManager.initialize();

    return this._getDataInternal();
  }

  /**
   * Internal method to get data (split from getData to avoid recursion)
   */
  _getDataInternal() {
    const xpBudgetsRaw = calculateXpBudgets(this.partyManager.members);
    const partyMembersWithLevel = this.partyManager.members.map(actor => ({
      id: actor.id,
      name: actor.name,
      level: getActorLevel(actor),
      portrait: getActorPortrait(actor)
    }));
    const totalEncounterXpRaw = calculateEncounterXp(this.encounterEntries);
    const xpMeter = this._buildXpMeter(xpBudgetsRaw, totalEncounterXpRaw);
    const difficulty = this._buildDifficultyViewModel(xpBudgetsRaw, totalEncounterXpRaw);

    // Generate CR options for dropdowns
    const crOptions = getCrOptions();

    const encounterEntriesWithXp = this.encounterEntries.map((entry, index) => {
      // Handle backwards compatibility - if entry doesn't have isActor, it's a stand-in
      const isActor = entry.isActor === true;
      const actorId = entry.actorId || null;
      const actorName = entry.actorName || null;

      const xpPerCreature = getXpForCr(entry.cr);
      const crString = entry.cr ? entry.cr.toString() : "0";
      const quantityRaw = Number(entry.quantity);
      const quantity = Math.max(Number.isFinite(quantityRaw) ? Math.floor(quantityRaw) : 1, 0);
      const tokenImage = this.encounterManager.getEncounterEntryTokenImage(entry);
      const tokenDisplayData = this.getEncounterEntryTokenDisplay(tokenImage, quantity);

      return {
        index: index,
        actorId: actorId,
        actorName: actorName,
        cr: entry.cr,
        crString: crString,
        quantity: quantity,
        xpPerCreature: xpPerCreature,
        totalXp: xpPerCreature * quantity,
        isActor: isActor,
        tokenImage: tokenImage,
        displayTokens: tokenDisplayData.displayTokens,
        extraTokens: tokenDisplayData.extraTokens,
        isEmptyQuantity: tokenDisplayData.isEmptyQuantity,
        hasTokens: tokenDisplayData.hasTokens,
        canDecrement: quantity > 0,
        crOptions: crOptions.map(cr => ({
          value: cr,
          label: cr,
          selected: cr === crString
        }))
      };
    });

    const suggestionView = this._buildSuggestionViewModel();

    return {
      partyMembers: partyMembersWithLevel,
      xpBudgets: {
        low: this.formatNumber(xpBudgetsRaw.low),
        medium: this.formatNumber(xpBudgetsRaw.medium),
        high: this.formatNumber(xpBudgetsRaw.high)
      },
      hasParty: this.partyManager.members.length > 0,
      encounterEntries: encounterEntriesWithXp.map(entry => ({
        ...entry,
        xpPerCreature: this.formatNumber(entry.xpPerCreature),
        totalXp: this.formatNumber(entry.totalXp)
      })),
      totalEncounterXp: this.formatNumber(totalEncounterXpRaw),
      hasEncounter: this.encounterManager.entries.length > 0,
      crOptions: crOptions,
      xpMeter: xpMeter,
      difficulty,
      suggestion: suggestionView
    };
  }

  /**
   * Format number with comma separators
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Place enemies button
    html.find(".place-enemies").on("click", () => {
      this.placementHandler.onPlaceEnemies();
    });

    html.find(".suggest-encounter").on("click", () => {
      this._openSuggestionDialog();
    });

    // Remove party member button
    html.find(".remove-party-member").on("click", (event) => {
      const actorId = $(event.currentTarget).data("actorId");
      this.removePartyMember(actorId);
    });

    // Save party button
    html.find(".save-party").on("click", () => {
      PartyDialogs.showSaveParty(this.partyManager);
    });

    // Load party button
    html.find(".load-party").on("click", () => {
      PartyDialogs.showLoadParty(this.partyManager, () => this.render());
    });

    // Clear all button
    html.find(".clear-party").on("click", () => {
      this.clearParty();
    });

    // Make drop zones accept actor drops using Foundry's drag system
    const partyDropZone = html.find(".party-drop-zone")[0];
    if (partyDropZone) {
      partyDropZone.addEventListener("dragover", this.dragDropHandler.handleDragOver.bind(this.dragDropHandler));
      partyDropZone.addEventListener("drop", this.dragDropHandler.handleDrop.bind(this.dragDropHandler));
      partyDropZone.addEventListener("dragleave", this.dragDropHandler.handleDragLeave.bind(this.dragDropHandler));
    }

    const encounterDropZones = html.find(".encounter-drop-target");
    encounterDropZones.each((_, element) => {
      element.addEventListener("dragover", this.dragDropHandler.handleDragOver.bind(this.dragDropHandler));
      element.addEventListener("drop", this.dragDropHandler.handleDrop.bind(this.dragDropHandler));
      element.addEventListener("dragleave", this.dragDropHandler.handleDragLeave.bind(this.dragDropHandler));
    });

    // Encounter builder: Add stand-in button
    html.find(".add-stand-in").on("click", () => {
      EncounterDialogs.showAddStandIn(this.encounterManager, () => this.render());
    });

    // Encounter builder: Remove entry button
    html.find(".remove-encounter-entry").on("click", (event) => {
      const index = parseInt($(event.currentTarget).data("index"));
      this.removeEncounterEntry(index);
    });

    // Encounter builder: Clear encounter button
    html.find(".clear-encounter").on("click", () => {
      this.clearEncounter();
    });

    // Save encounter button
    html.find(".save-encounter").on("click", () => {
      EncounterDialogs.showSaveEncounter(this.encounterManager);
    });

    // Load encounter button
    html.find(".load-encounter").on("click", () => {
      EncounterDialogs.showLoadEncounter(this.encounterManager, () => this.render());
    });

    // Encounter builder: Update CR input (only for stand-in entries)
    html.find(".encounter-cr-input").on("change", (event) => {
      const index = parseInt($(event.currentTarget).data("index"));
      const newCr = $(event.currentTarget).val();
      const entry = this.encounterManager.entries[index];
      if (entry && !entry.isActor) {
        // Only allow CR changes for stand-in entries
        entry.cr = newCr;
        this.render();
      }
    });

    // Encounter builder: Update quantity input
    html.find(".encounter-quantity-input").on("change", (event) => {
      const index = parseInt($(event.currentTarget).data("index"));
      const rawValue = parseInt($(event.currentTarget).val(), 10);
      const newQuantity = Number.isNaN(rawValue) ? 0 : Math.max(rawValue, 0);
      if (this.encounterManager.entries[index] !== undefined) {
        this.encounterManager.entries[index].quantity = newQuantity;
        this.render();
      }
    });

    // Encounter builder: Quantity increment/decrement buttons
    html.find(".qty-button").on("click", (event) => {
      const index = parseInt($(event.currentTarget).data("index"));
      const isIncrement = $(event.currentTarget).hasClass("qty-increment");
      this.adjustEncounterQuantity(index, isIncrement ? 1 : -1);
    });

    html.on("click", ".suggestion-cancel", (event) => {
      event.preventDefault();
      this._cancelSuggestionRequest();
    });

    html.on("click", ".suggestion-try-again", (event) => {
      event.preventDefault();
      this._retrySuggestionRequest();
    });

    html.on("click", ".suggestion-load", (event) => {
      event.preventDefault();
      const panel = html.find(".suggestion-panel");
      const clearEncounter = panel.find(".suggestion-option-clear").is(":checked");
      this._loadSuggestionResults({ clearEncounter });
    });

    html.on("click", ".suggestion-hide", (event) => {
      event.preventDefault();
      this._hideSuggestionPanel();
    });

    html.on("click", ".suggestion-show", (event) => {
      event.preventDefault();
      this._showSuggestionPanel();
    });

    html.on("dragstart", ".suggestion-card", (event) => {
      this._onSuggestionDragStart(event);
    });

    html.on("dragend", ".suggestion-card", (event) => {
      this._onSuggestionDragEnd(event);
    });

    html.on("click", ".carousel-nav", (event) => {
      this._onCarouselNavClick(event);
    });
  }





  /**
   * Adjust encounter entry quantity using increment/decrement controls
   */
  adjustEncounterQuantity(index, delta) {
    if (this.encounterManager.adjustQuantity(index, delta)) {
      this.render();
    }
  }





  removePartyMember(actorId) {
    if (this.partyManager.removeMember(actorId)) {
      this.render();
    }
  }

  clearParty() {
    this.partyManager.clear();
    this.render();
  }

  /**
   * Show dialog to save the current party
   */




  /**
   * Show dialog to load a saved party
   */


  /**
   * Save the current party with a name
   */


  /**
   * Load a party by ID
   */


  /**
   * Delete a saved party
   */


  /**
   * Show dialog to save the current encounter
   */


  /**
   * Check if the current encounter matches the default encounter
   */


  /**
   * Show dialog to load a saved encounter
   */


  /**
   * Save the current encounter with a name
   */


  /**
   * Load an encounter by ID
   */


  /**
   * Delete a saved encounter
   */


  /**
   * Add an encounter entry (stand-in, not actor-based)
   */
  addEncounterEntry(cr, quantity, options = {}) {
    const safeQuantity = Math.max(Math.floor(quantity), 1);
    if (!cr || safeQuantity <= 0) {
      ui.notifications.warn("Please provide a valid CR and quantity.");
      return;
    }
    const tokenImg = options.tokenImg || "icons/svg/mystery-man.svg";
    const label = options.label || null;
    this.encounterEntries.push({
      actorId: null,
      actorName: label,
      cr: cr,
      quantity: safeQuantity,
      isActor: false,
      tokenImg: tokenImg
    });
    this.render();
  }

  /**
   * Add an actor-based encounter entry
   */
  addActorEncounterEntry(actor, quantity = 1, source = {}) {
    if (!actor || actor.type !== "npc") {
      ui.notifications.warn("Only NPC actors can be added to encounters.");
      return;
    }

    const actorId = actor.id;
    const actorUuid = actor.uuid || source.uuid || null;
    const actorName = actor.name;
    const cr = getActorCr(actor);
    const increment = Math.max(Math.floor(quantity), 1);

    // Check if actor already exists in encounter
    const existingEntry = this.encounterEntries.find(entry => {
      if (!entry.isActor) return false;
      if (actorUuid && entry.actorUuid) {
        return entry.actorUuid === actorUuid;
      }
      return entry.actorId === actorId;
    });

    if (existingEntry) {
      // Increment quantity for existing actor
      const currentQuantity = Number(existingEntry.quantity) || 0;
      existingEntry.quantity = currentQuantity + increment;
      if (actorUuid && !existingEntry.actorUuid) {
        existingEntry.actorUuid = actorUuid;
      }
      if (!existingEntry.tokenImg) {
        existingEntry.tokenImg = getEncounterTokenImage(actor);
      }
      ui.notifications.info(`Increased quantity of ${actorName} to ${existingEntry.quantity}`);
    } else {
      // Add new actor entry
      this.encounterEntries.push({
        actorId: actorId,
        actorUuid: actorUuid,
        actorName: actorName,
        cr: cr,
        quantity: 1,
        isActor: true,
        tokenImg: getEncounterTokenImage(actor)
      });

      // If the requested quantity was more than one, apply the remainder now
      if (increment > 1) {
        const entry = this.encounterEntries[this.encounterEntries.length - 1];
        entry.quantity = increment;
      }
    }

    this.render();
  }

  /**
   * Remove an encounter entry by index
   */
  removeEncounterEntry(index) {
    if (this.encounterManager.removeEntry(index)) {
      this.render();
    }
  }

  /**
   * Clear all encounter entries
   */
  clearEncounter() {
    this.encounterManager.clear();
    this.render();
  }

  /**
   * Build XP meter display data for template rendering
   */
  _buildXpMeter(xpBudgets, totalEncounterXp) {
    const low = xpBudgets.low || 0;
    const medium = xpBudgets.medium || 0;
    const high = xpBudgets.high || 0;
    const hasParty = this.partyManager.members.length > 0;
    const capacity = Math.max(high, low, 1);

    const clampPercent = (value) => {
      if (capacity <= 0) return 0;
      return Math.min(Math.max((value / capacity) * 100, 0), 100);
    };

    const fillPercent = capacity > 0 ? Math.min((totalEncounterXp / capacity) * 100, 100) : 0;

    return {
      enabled: hasParty && capacity > 0,
      fillPercent: fillPercent.toFixed(1),
      lowPercent: clampPercent(low).toFixed(1),
      mediumPercent: clampPercent(medium).toFixed(1),
      highPercent: clampPercent(high).toFixed(1)
    };
  }

  /**
   * Build a small view-model describing encounter difficulty vs party budgets.
   * Uses the same tiering logic as EncounterSuggestionService.
   */
  _buildDifficultyViewModel(xpBudgets, totalEncounterXp) {
    const hasParty = this.partyManager.members.length > 0;
    const encounterXp = Number(totalEncounterXp) || 0;

    if (!hasParty || encounterXp <= 0) {
      return {
        enabled: false,
        label: "None",
        tier: "none",
        percent: 0
      };
    }

    const info = EncounterSuggestionService.determineEncounterDifficulty(
      xpBudgets,
      encounterXp
    );

    const label = info?.label || "None";
    const tier = String(label).toLowerCase(); // easy|medium|hard|deadly|none
    const percent = Math.max(0, Math.min(Number(info?.relativeLoad || 0) * 100, 999));

    return {
      enabled: true,
      label,
      tier,
      percent: percent.toFixed(0)
    };
  }

  /**
   * Retrieve a representative token image for an encounter entry
   */


  /**
   * Return display data for rendering token chips in the encounter table
   */
  getEncounterEntryTokenDisplay(tokenImage, quantity) {
    const maxTokens = 5;
    const safeQuantity = Math.max(Math.floor(quantity), 0);
    const tokensToShow = Math.max(Math.min(safeQuantity, maxTokens), 0);
    const displayTokens = Array.from({ length: tokensToShow }, () => tokenImage);
    return {
      displayTokens,
      extraTokens: Math.max(safeQuantity - maxTokens, 0),
      isEmptyQuantity: safeQuantity === 0,
      hasTokens: displayTokens.length > 0
    };
  }

  _getPreferredSuggestionType() {
    try {
      const last = game.settings.get("vibe-combat", "lastSuggestionType");
      if (last) return last;
    } catch (error) {
      console.warn("Vibe Combat: Unable to read last suggestion type", error);
    }
    try {
      const defaultType = game.settings.get("vibe-combat", "defaultSuggestionType");
      if (defaultType) return defaultType;
    } catch (error) {
      console.warn("Vibe Combat: Unable to read default suggestion type", error);
    }
    return EncounterSuggestionService.getDefaultTypeId();
  }

  async _persistLastSuggestionType(typeId) {
    if (!typeId) return;
    try {
      await game.settings.set("vibe-combat", "lastSuggestionType", typeId);
    } catch (error) {
      console.warn("Vibe Combat: Failed to store last suggestion type", error);
    }
  }

  _openSuggestionDialog() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can request encounter suggestions.");
      return;
    }

    const apiKey = game.settings.get("vibe-combat", "geminiApiKey");
    if (!apiKey || apiKey.trim() === "") {
      ui.notifications.error("Configure your Gemini API key in module settings first.");
      return;
    }

    if (this.partyManager.members.length === 0) {
      ui.notifications.warn("Add at least one party member before requesting suggestions.");
      return;
    }

    const currentType = this.suggestionState?.typeId || this._getPreferredSuggestionType();
    const options = SUGGESTION_TYPES.map(
      (type) => `<option value="${type.id}" ${type.id === currentType ? "selected" : ""}>${type.label}</option>`
    ).join("");

    const content = `
      <form class="vibe-suggestion-form">
        <div class="form-group">
          <label>Suggestion Style</label>
          <select name="suggestionType" style="width: 100%;">${options}</select>
          <p class="notes">Choose the encounter style you want Gemini to explore.</p>
        </div>
        <div class="form-group">
          <label>Additional Instructions</label>
          <textarea name="suggestionNotes" rows="4" style="width: 100%;" placeholder="Optional: theme, monster set, terrain, etc."></textarea>
        </div>
      </form>
    `;

    new Dialog({
      title: "AI Encounter Suggestions",
      content,
      buttons: {
        request: {
          icon: '<i class="fas fa-sparkles"></i>',
          label: "Request Suggestions",
          callback: (html) => {
            const typeId = html.find('[name="suggestionType"]').val();
            const additionalInstructions = html.find('[name="suggestionNotes"]').val();
            this._startSuggestionRequest({
              typeId,
              additionalInstructions
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "request"
    }).render(true);
  }

  async _startSuggestionRequest(config = {}) {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can request encounter suggestions.");
      return;
    }

    const apiKey = game.settings.get("vibe-combat", "geminiApiKey");
    if (!apiKey || apiKey.trim() === "") {
      ui.notifications.error("Configure your Gemini API key in module settings first.");
      return;
    }

    if (this.partyManager.members.length === 0) {
      ui.notifications.warn("Add at least one party member before requesting suggestions.");
      return;
    }

    if (this._suggestionAbortController) {
      ui.notifications.warn("A suggestion request is already in progress.");
      return;
    }

    const now = Date.now();
    if (now - this._lastSuggestionRequestedAt < SUGGESTION_REQUEST_COOLDOWN) {
      const seconds = Math.ceil(
        (SUGGESTION_REQUEST_COOLDOWN - (now - this._lastSuggestionRequestedAt)) / 1000
      );
      ui.notifications.warn(`Please wait ${seconds}s before sending another request.`);
      return;
    }
    this._lastSuggestionRequestedAt = now;

    const typeId = config.typeId || this._getPreferredSuggestionType();
    this.suggestionState.visible = true;
    this.suggestionState.hidden = false;
    this.suggestionState.status = "loading";
    this.suggestionState.error = null;
    this.suggestionState.summary = null;
    this.suggestionState.metadata = null;
    this.suggestionState.suggestions = [];
    this.suggestionState.typeId = typeId;
    this._lastSuggestionRequestConfig = {
      typeId,
      additionalInstructions: config.additionalInstructions?.trim() || ""
    };
    this.render();

    const controller = new AbortController();
    this._suggestionAbortController = controller;

    try {
      const promptTemplate = game.settings.get("vibe-combat", "suggestionPromptTemplate");
      const packIds = game.settings.get("vibe-combat", "suggestionSourceCompendiums") || [];
      const includeWorldActors =
        game.settings.get("vibe-combat", "suggestionIncludeWorldActors") ?? true;

      const creatureCatalog = await EncounterSuggestionService.buildCreatureCatalog({
        includeWorldActors,
        packIds
      });

      const result = await EncounterSuggestionService.requestSuggestions({
        partyMembers: this.partyManager.members,
        encounterEntries: this.encounterManager.entries,
        typeId,
        apiKey,
        promptTemplate,
        additionalInstructions: this._lastSuggestionRequestConfig.additionalInstructions,
        creatureCatalog,
        abortSignal: controller.signal
      });

      const catalogByUuid = new Map(
        creatureCatalog.map((entry) => [String(entry.uuid), entry])
      );
      const enriched = (result.entries || []).map((entry) => {
        const uuid = String(entry.uuid);
        const catalogEntry = catalogByUuid.get(uuid) || null;
        const name = catalogEntry?.name || entry.name || "Creature";
        const cr = catalogEntry?.cr ?? entry.cr ?? null;
        const crDisplay = cr ? `CR ${cr}` : "Unknown CR";
        return {
          ...entry,
          uuid,
          name,
          cr,
          crDisplay,
          portrait: catalogEntry?.img || DEFAULT_SUGGESTION_IMAGE,
          sourceLabel: catalogEntry?.sourceLabel || ""
        };
      });

      this.suggestionState.status = "ready";
      this.suggestionState.suggestions = enriched;
      this.suggestionState.summary = result.summary;
      this.suggestionState.metadata = {
        dangerRating: result.dangerRating,
        recommendedBudgetXp: result.recommendedBudgetXp
      };
      await this._persistLastSuggestionType(typeId);
    } catch (error) {
      if (error.name === "AbortError") {
        this.suggestionState.status = "cancelled";
        this.suggestionState.error = "Suggestion request cancelled.";
      } else {
        console.error("Vibe Combat: Failed to fetch encounter suggestions", error);
        this.suggestionState.status = "error";
        this.suggestionState.error = error.message || "Gemini request failed.";
      }
    } finally {
      this._suggestionAbortController = null;
      this.render();
    }
  }

  _cancelSuggestionRequest() {
    if (this._suggestionAbortController) {
      this._suggestionAbortController.abort();
      this._suggestionAbortController = null;
      this.suggestionState.status = "cancelled";
      this.suggestionState.error = "Suggestion request cancelled.";
      this.render();
    }
  }

  _retrySuggestionRequest() {
    if (this._suggestionAbortController) {
      ui.notifications.warn("Suggestion request already running.");
      return;
    }
    if (this._lastSuggestionRequestConfig) {
      this._startSuggestionRequest(this._lastSuggestionRequestConfig);
    } else {
      this._openSuggestionDialog();
    }
  }

  _hideSuggestionPanel() {
    if (!this.suggestionState.visible || this.suggestionState.hidden) {
      return;
    }
    this.suggestionState.hidden = true;
    this.render();
    this._refreshAppHeight();
  }

  _showSuggestionPanel() {
    if (!this.suggestionState.visible || !this.suggestionState.hidden) {
      return;
    }
    this.suggestionState.hidden = false;
    this.render();
    this._refreshAppHeight();
  }

  async _loadSuggestionResults({ clearEncounter = false } = {}) {
    if (this.suggestionState.status !== "ready") {
      ui.notifications.warn("No AI suggestions are ready to load.");
      return;
    }
    const suggestions = this.suggestionState.suggestions || [];
    if (suggestions.length === 0) {
      ui.notifications.warn("Gemini did not return any entries to load.");
      return;
    }

    if (clearEncounter) {
      this.clearEncounter();
    }

    let added = 0;
    for (const suggestion of suggestions) {
      const uuid = suggestion?.uuid ? String(suggestion.uuid) : null;
      if (!uuid || typeof fromUuid !== "function") continue;
      try {
        const actor = await fromUuid(uuid);
        if (actor && actor.type === "npc") {
          this.addActorEncounterEntry(actor, suggestion.quantity, { uuid });
          added++;
        }
      } catch (error) {
        console.warn("Vibe Combat: Failed to resolve suggestion actor UUID", uuid, error);
      }
    }

    if (added === 0) {
      ui.notifications.warn("No suggestions could be loaded. Try requesting again.");
      return;
    }

    ui.notifications.info(`Loaded ${added} suggestion${added === 1 ? "" : "s"} into the encounter.`);
    await this.render(true);
    this._refreshAppHeight();
  }

  _refreshAppHeight() {
    // Make the window resize to match content after big UI changes (like loading suggestions).
    requestAnimationFrame(() => {
      try {
        const el = this.element?.[0];
        if (!el) return;
        const desired = Math.max(320, el.scrollHeight || 0);
        const max = Math.max(320, (window?.innerHeight || desired) - 80);
        const height = Math.min(desired, max);
        this.setPosition({ height });
      } catch (error) {
        // If resizing fails in a particular Foundry build, it's non-fatal.
      }
    });
  }

  _onSuggestionDragStart(event) {
    const card = event.currentTarget;
    const suggestionId = card?.dataset?.suggestionId;
    const dataTransfer = event.originalEvent?.dataTransfer || event.dataTransfer || null;
    if (!card || !suggestionId || !dataTransfer) {
      return;
    }

    // Always use an Actor drag payload (suggestions are UUID-authoritative).
    const suggestions = this.suggestionState?.suggestions || [];
    const entry = suggestions.find((item) => String(item.id) === String(suggestionId));
    const quantity = Math.max(1, Math.floor(Number(entry?.quantity ?? 1)));

    const uuid = entry?.uuid ? String(entry.uuid) : null;
    if (!uuid) return;
    const payload = {
      type: "Actor",
      uuid,
      vibeCombatSuggestion: {
        suggestionId: String(suggestionId),
        quantity
      }
    };
    dataTransfer.setData("text/plain", JSON.stringify(payload));

    dataTransfer.effectAllowed = "copy";
    card.classList.add("dragging");
  }

  _onSuggestionDragEnd(event) {
    event.currentTarget?.classList?.remove("dragging");
  }

  _onCarouselNavClick(event) {
    event.preventDefault();
    const button = event.currentTarget;
    if (!button || button.disabled) return;
    const direction = button.dataset?.direction === "next" ? 1 : -1;
    const carousel = button.closest(".suggestion-carousel");
    const track = carousel?.querySelector("[data-carousel-track]");
    if (!track) return;
    const card = track.querySelector(".suggestion-card");
    const cardWidth = card ? card.getBoundingClientRect().width + 16 : track.clientWidth;
    track.scrollBy({ left: direction * cardWidth, behavior: "smooth" });
  }

  _buildSuggestionViewModel() {
    const state = this.suggestionState || {};
    if (!state.visible) {
      return { visible: false };
    }

    const type = EncounterSuggestionService.getTypeById(
      state.typeId || this._getPreferredSuggestionType()
    );
    const entries = (state.suggestions || []).map((entry) => {
      return {
        id: entry.id,
        name: entry.name,
        quantity: entry.quantity,
        quantityLabel: entry.quantity === 1 ? "1 creature" : `${entry.quantity} creatures`,
        crDisplay: entry.crDisplay || (entry.cr ? `CR ${entry.cr}` : "Unknown CR"),
        role: entry.role,
        notes: entry.notes,
        tags: entry.tags,
        uuid: entry.uuid,
        sourceLabel: entry.sourceLabel || "",
        portrait: entry.portrait || DEFAULT_SUGGESTION_IMAGE
      };
    });

    return {
      visible: true,
      hidden: state.hidden === true,
      status: state.status,
      typeLabel: type?.label ?? "Encounter",
      typeDescription: type?.description ?? "",
      isLoading: state.status === "loading",
      isReady: state.status === "ready",
      isError: state.status === "error",
      isCancelled: state.status === "cancelled",
      message: this._getSuggestionStatusMessage(state),
      summary: state.summary,
      metadata: state.metadata
        ? {
          dangerRating: state.metadata.dangerRating,
          recommendedBudgetXp: state.metadata.recommendedBudgetXp
            ? this.formatNumber(state.metadata.recommendedBudgetXp)
            : null
        }
        : null,
      entries,
      hasEntries: entries.length > 0,
      showActions: state.status === "ready" && entries.length > 0,
      showTryAgain:
        state.status === "ready" ||
        state.status === "error" ||
        state.status === "cancelled",
      canCancel: state.status === "loading",
      error: state.error,
      entryCount: entries.length,
      hasMultipleEntries: entries.length > 1,
      entriesLabel: entries.length === 1 ? "1 suggestion" : `${entries.length} suggestions`
    };
  }

  _getSuggestionStatusMessage(state) {
    switch (state.status) {
      case "loading":
        return "Contacting Gemini for tailored encounter ideas...";
      case "ready":
        return "Review the suggestions, then load them into the encounter.";
      case "error":
        return "Suggestion request failed. Try again or adjust your instructions.";
      case "cancelled":
        return "Suggestion request cancelled.";
      default:
        return "Request encounter assistance that accounts for the current party.";
    }
  }
}

