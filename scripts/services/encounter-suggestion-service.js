import { calculateEncounterXp, calculateXpBudgets } from "../utils/xp-calculator.js";
import {
  getActorLevel,
  getActorCr,
  getActorPortrait,
  getEncounterTokenImage,
  getActorClasses
} from "../utils/actor-helpers.js";
import { callGemini, extractJson } from "./gemini-service.js";
import { SUGGESTION_TYPES } from "../constants.js";

const FALLBACK_IMAGE = "icons/svg/mystery-man.svg";
const DEFAULT_PROMPT_TEMPLATE = `Prioritize balanced, narratively coherent D&D 5e encounters. Favor official Wizards of the Coast or SRD monsters when possible. Respect the requested encounter style while ensuring the overall threat stays within safe bounds for the supplied party. Assume modern dnd5e (v4+) stat blocks.`;
const RESPONSE_SCHEMA_DESCRIPTION = `{
  "summary": "One to three sentences explaining the concept.",
  "dangerRating": "Easy | Medium | Hard | Deadly | Variable",
  "recommendedBudgetXp": 0,
  "entries": [
    {
      "uuid": "Actor.<id> or Compendium.<packId>.<documentId> (must come from creatureCatalog)",
      "quantity": 1,
      "name": "Optional: display name (not authoritative)",
      "cr": "Optional: display CR (not authoritative)",
      "role": "Brute | Artillery | Controller | Support | Skirmisher",
      "notes": "Tactical notes or how they interact with the party.",
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

// SUGGESTION_TYPES is now imported from ../constants.js

const CLASS_ROLE_MAP = new Map([
  ["barbarian", "Bruiser"],
  ["bard", "Support"],
  ["cleric", "Support"],
  ["druid", "Controller"],
  ["fighter", "Defender"],
  ["monk", "Skirmisher"],
  ["paladin", "Defender"],
  ["ranger", "Striker"],
  ["rogue", "Striker"],
  ["sorcerer", "Blaster"],
  ["warlock", "Blaster"],
  ["wizard", "Controller"],
  ["artificer", "Support"],
  ["blood hunter", "Striker"]
]);


const PACK_INDEX_CACHE = new Map();

export class EncounterSuggestionService {
  static _getPackDisplayLabel(pack) {
    const raw = String(pack?.metadata?.label || "").trim();
    const docName = String(pack?.documentName || "").trim().toLowerCase();
    const isGeneric =
      !raw ||
      raw.toLowerCase() === "actors" ||
      raw.toLowerCase() === "actor" ||
      (docName && raw.toLowerCase() === docName);
    if (!isGeneric) return raw;

    const collection = String(pack?.collection || "").trim();
    if (!collection) return "Compendium";
    const parts = collection.split(".");
    if (parts.length <= 1) return collection;
    const type = parts[parts.length - 1];
    const base = parts.slice(0, -1).join(" ");
    const niceBase = base
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (type.toLowerCase() === "actors") return niceBase || collection;
    return `${niceBase || collection} (${type})`;
  }

  static getSuggestionTypes() {
    return SUGGESTION_TYPES;
  }

  static getTypeById(id) {
    return SUGGESTION_TYPES.find((type) => type.id === id) ?? SUGGESTION_TYPES[0];
  }

  static getDefaultTypeId() {
    return "mixed-encounter";
  }

  static buildPartySummary(partyMembers = []) {
    const members = partyMembers.map((actor) => {
      const level = getActorLevel(actor);
      const classes = getActorClasses(actor);
      const primaryClass =
        classes.slice().sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.name ??
        "Adventurer";
      const role = EncounterSuggestionService._determineRole(primaryClass);
      return {
        id: actor.id,
        name: actor.name,
        level,
        role,
        classes: classes.map((cls) => ({
          name: cls.name,
          level: cls.level
        })),
        portrait: getActorPortrait(actor)
      };
    });

    const size = members.length;
    const averageLevel =
      size > 0
        ? Number(
          (
            members.reduce((acc, curr) => acc + (curr.level || 0), 0) / size
          ).toFixed(2)
        )
        : 0;

    const highestLevel = Math.max(...members.map((m) => m.level || 0), 0);
    const lowestLevel =
      members.length > 0 ? Math.min(...members.map((m) => m.level || 0)) : 0;

    return {
      size,
      averageLevel,
      highestLevel,
      lowestLevel,
      members
    };
  }

  static buildEncounterSummary(encounterEntries = [], partyMembers = []) {
    const totalXp = calculateEncounterXp(encounterEntries);
    const xpBudgets = calculateXpBudgets(partyMembers);
    const difficulty = this.determineEncounterDifficulty(xpBudgets, totalXp);

    return {
      totalEntries: encounterEntries.length,
      totalXp,
      difficulty,
      entries: encounterEntries.map((entry) => ({
        name: entry.actorName || "Stand-in",
        cr: entry.cr,
        quantity: entry.quantity,
        isActor: entry.isActor,
        source: entry.isActor ? (entry.actorUuid || entry.actorId || "world") : "stand-in"
      }))
    };
  }

  static determineEncounterDifficulty(budgets, encounterXp) {
    if (!budgets || encounterXp <= 0) {
      return {
        label: "None",
        relativeLoad: 0
      };
    }

    const tiers = [
      { key: "low", label: "Easy" },
      { key: "medium", label: "Medium" },
      { key: "high", label: "Hard" }
    ];

    for (const tier of tiers) {
      if (encounterXp <= (budgets[tier.key] || 0)) {
        return {
          label: tier.label,
          relativeLoad: encounterXp / (budgets[tier.key] || 1)
        };
      }
    }

    return {
      label: "Deadly",
      relativeLoad:
        encounterXp / Math.max(budgets?.high || budgets?.medium || 1, 1)
    };
  }

  static async requestSuggestions({
    partyMembers,
    encounterEntries,
    typeId,
    apiKey,
    promptTemplate,
    additionalInstructions,
    creatureCatalog,
    abortSignal
  }) {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("Gemini API key is not configured.");
    }

    if (!Array.isArray(partyMembers) || partyMembers.length === 0) {
      throw new Error("At least one party member is required for suggestions.");
    }

    if (!Array.isArray(creatureCatalog) || creatureCatalog.length === 0) {
      throw new Error(
        "Creature catalog is empty. Configure 'Encounter Suggestion Sources' in module settings."
      );
    }

    const type = this.getTypeById(typeId);
    const partySummary = this.buildPartySummary(partyMembers);
    const encounterSummary = this.buildEncounterSummary(encounterEntries, partyMembers);
    const xpBudgets = calculateXpBudgets(partyMembers);

    const catalogForPrompt = creatureCatalog
      .filter((entry) => entry?.uuid && entry?.name)
      .map((entry) => ({
        uuid: String(entry.uuid),
        name: String(entry.name),
        cr: entry.cr ?? null
      }));

    const payload = {
      timestamp: new Date().toISOString(),
      suggestionType: {
        id: type.id,
        label: type.label,
        description: type.description,
        promptHint: type.promptHint
      },
      party: partySummary,
      currentEncounter: encounterSummary,
      xpBudgets,
      gmInstructions: additionalInstructions?.trim() || null,
      creatureCatalog: catalogForPrompt
    };

    const prompt = this._buildPrompt({
      payload,
      promptTemplate: promptTemplate || DEFAULT_PROMPT_TEMPLATE
    });

    const generated = await callGemini({
      apiKey,
      prompt,
      abortSignal
    });

    const parsed = extractJson(generated);
    const normalizedEntries = this._normalizeSuggestions(parsed.entries || []);

    // Filter to keep only valid UUIDs
    const allowedUuids = new Set(
      catalogForPrompt.map((entry) => String(entry.uuid))
    );
    const validEntries = normalizedEntries.filter((entry) =>
      allowedUuids.has(String(entry.uuid))
    );

    if (validEntries.length === 0) {
      throw new Error(
        "Gemini did not return any valid suggestions from the provided catalog. Please try again."
      );
    }

    return {
      summary: parsed.summary || "",
      dangerRating: parsed.dangerRating || "Variable",
      recommendedBudgetXp: Number(parsed.recommendedBudgetXp) || null,
      entries: validEntries,
      rawResponse: parsed
    };
  }

  /**
   * Build the allowed creature catalog used to constrain Gemini suggestions.
   * Returns entries suitable for UI enrichment (includes img/sourceLabel), while
   * requestSuggestions only sends uuid/name/cr.
   */
  static async buildCreatureCatalog({ includeWorldActors = true, packIds = [] } = {}) {
    const catalog = [];

    if (includeWorldActors) {
      const worldCandidates = this._getWorldActorCandidates();
      for (const cand of worldCandidates) {
        if (!cand?.actorUuid || !cand?.name) continue;
        catalog.push({
          uuid: cand.actorUuid,
          name: cand.name,
          cr: cand.cr ?? null,
          img: cand.img ?? FALLBACK_IMAGE,
          sourceLabel: cand.sourceLabel || cand.source || "World Actors"
        });
      }
    }

    const compendiumCandidates = await this._getCompendiumCandidatesFromPackIds(packIds);
    for (const cand of compendiumCandidates) {
      if (!cand?.actorUuid || !cand?.name) continue;
      catalog.push({
        uuid: cand.actorUuid,
        name: cand.name,
        cr: cand.cr ?? null,
        img: cand.img ?? FALLBACK_IMAGE,
        sourceLabel: cand.sourceLabel || cand.source || "Compendium"
      });
    }

    const seen = new Set();
    const deduped = [];
    for (const entry of catalog) {
      const uuid = String(entry.uuid);
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      deduped.push(entry);
    }

    deduped.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return deduped;
  }

  static _buildPrompt({ payload, promptTemplate }) {
    return [
      "You are an expert D&D 5e encounter designer for Foundry VTT.",
      "Analyze the JSON context below and produce an encounter recommendation.",
      `Encounter Style: ${payload.suggestionType.label} — ${payload.suggestionType.description}`,
      `Style Hint: ${payload.suggestionType.promptHint}`,
      promptTemplate,
      payload.gmInstructions
        ? `GM specific requests: ${payload.gmInstructions}`
        : null,
      "You MUST choose `uuid` values from the provided `creatureCatalog` list.",
      "Do not invent UUIDs. Do not return creatures not in the catalog.",
      "If you cannot find a perfect fit, choose the closest appropriate creature from the catalog.",
      "Respond with concise JSON matching this schema:",
      RESPONSE_SCHEMA_DESCRIPTION,
      "Do NOT include Markdown code fences or commentary outside the JSON.",
      "Context JSON:",
      JSON.stringify(payload, null, 2)
    ]
      .filter(Boolean)
      .join("\n\n");
  }



  static _normalizeSuggestions(entries) {
    return entries
      .filter((entry) => entry?.uuid)
      .slice(0, 8)
      .map((entry, index) => {
        const quantity = Math.max(
          1,
          Number.isFinite(Number(entry.quantity)) ? Math.floor(entry.quantity) : 1
        );

        const uuid = String(entry.uuid).trim();
        const cr = this._sanitizeCr(entry.cr);
        return {
          id: String(index),
          uuid,
          name: entry.name?.trim?.() || "",
          quantity,
          role: entry.role || "",
          notes: entry.notes || entry.description || "",
          tags: Array.isArray(entry.tags)
            ? entry.tags.map((tag) => String(tag))
            : [],
          cr,
          crDisplay: cr ? `CR ${cr}` : "Unknown CR"
        };
      });
  }

  static _sanitizeCr(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return value.toString();
    const cleaned = String(value).trim();
    if (!cleaned) return null;
    return cleaned.replace(/cr\s*/i, "");
  }

  static _determineRole(className) {
    if (!className) return "Generalist";
    const normalized = className.toLowerCase();
    return CLASS_ROLE_MAP.get(normalized) || "Generalist";
  }

  static _getWorldActorCandidates() {
    const actors = Array.from(game.actors ?? []);
    return actors
      .filter((actor) => actor?.type === "npc")
      .map((actor) => ({
        source: "world",
        sourceLabel: "World Actors",
        actorId: actor.id,
        actorUuid: actor.uuid,
        name: actor.name,
        cr: getActorCr(actor),
        img: getEncounterTokenImage(actor),
        document: actor
      }));
  }

  static async _getCompendiumCandidatesFromPackIds(packIds = []) {
    const packIdSet = new Set(
      Array.isArray(packIds) ? packIds.map((id) => String(id)) : []
    );
    if (packIdSet.size === 0) return [];

    const packs = Array.from(game.packs ?? []).filter(
      (pack) => pack.documentName === "Actor" && packIdSet.has(pack.collection)
    );

    const candidates = [];

    for (const pack of packs) {
      const index = await this._getPackIndex(pack);
      for (const entry of index) {
        if (entry.type !== "npc") continue;
        candidates.push({
          source: "compendium",
          sourceLabel: this._getPackDisplayLabel(pack),
          actorId: null,
          actorUuid: `Compendium.${pack.collection}.${entry._id}`,
          name: entry.name,
          cr: this._sanitizeCr(entry.system?.details?.cr ?? entry.cr),
          img: entry.img || FALLBACK_IMAGE,
          packId: pack.collection,
          documentId: entry._id
        });
      }
    }

    return candidates;
  }

  static async _getPackIndex(pack) {
    if (!PACK_INDEX_CACHE.has(pack.collection)) {
      const index = await pack.getIndex({
        fields: ["name", "type", "img", "system.details.cr"]
      });
      PACK_INDEX_CACHE.set(pack.collection, index);
    }
    return PACK_INDEX_CACHE.get(pack.collection);
  }
}

export const DEFAULT_SUGGESTION_PROMPT = DEFAULT_PROMPT_TEMPLATE;

