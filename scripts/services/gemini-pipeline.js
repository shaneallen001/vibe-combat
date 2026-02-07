/**
 * Gemini Pipeline
 * Orchestrates the multi-step AI actor generation process.
 */

import { ArchitectAgent } from "../agents/architect-agent.js";
import { QuartermasterAgent } from "../agents/quartermaster-agent.js";
import { BlacksmithAgent } from "../agents/blacksmith-agent.js";
import * as CompendiumService from "./compendium-service.js";
import { getSpellUuid } from "./compendium-service.js";
import { sanitizeCustomItem, ensureActivityIds, ensureItemHasImage } from "../factories/actor-factory.js";

export class GeminiPipeline {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Execute the full generation pipeline
     * @param {object} request - { prompt, cr, type, size, etc. }
     */
    async generateActor(request) {
        console.log("Vibe Combat | Starting Gemini Pipeline...");

        // Step 1: Architect (Concept & Blueprint)
        const blueprint = await this.runArchitect(request);
        console.log("Vibe Combat | Blueprint created:", blueprint);

        // Step 2: Quartermaster (Component Selection)
        const selection = await this.runQuartermaster(blueprint);
        console.log("Vibe Combat | Components selected:", selection);

        // Step 3: Blacksmith (Custom Fabrication)
        const customItems = await this.runBlacksmith(blueprint, selection.customRequests);
        console.log("Vibe Combat | Custom items fabricated:", customItems);

        // Step 4: Builder (Assembly)
        const actorData = await this.runBuilder(blueprint, selection.selectedUuids, customItems);
        console.log("Vibe Combat | Actor data assembled.");

        return actorData;
    }

    /**
     * Step 1: The Architect
     */
    async runArchitect(request) {
        const agent = new ArchitectAgent(this.apiKey);
        // Transform request to match expected context if needed, or pass directly
        return await agent.generate(request);
    }

    /**
     * Step 2: The Quartermaster
     */
    async runQuartermaster(blueprint) {
        // 1. Prepare items to review (Features + Equipment - Spells are handled separately)
        const itemsToReview = [...(blueprint.features || [])];

        // Add equipment items (weapons, armor, shields, gear)
        if (blueprint.equipment) {
            itemsToReview.push(...blueprint.equipment.map(e => ({
                name: e.name,
                type: e.type === "weapon" ? "weapon" : "equipment",
                description: e.description || e.name
            })));
        }

        // NOTE: Spells are NOT processed here - they're handled in runBuilder via _buildSpellcastingFeat

        // 2. Search for candidates
        const candidates = {};
        for (const item of itemsToReview) {
            // Determine search types based on item type
            let typeFilter;
            if (item.type === "spell") {
                typeFilter = ["spell"];
            } else if (item.type === "weapon") {
                typeFilter = ["weapon"];
            } else if (item.type === "equipment") {
                typeFilter = ["equipment"];
            } else {
                typeFilter = ["feat", "weapon"];
            }

            const results = await CompendiumService.search(item.name, typeFilter);
            // Take top 3 results
            candidates[item.name] = results.slice(0, 3).map(i => ({ name: i.name, uuid: i.uuid, type: i.type }));
        }

        const context = {
            blueprintFeatures: itemsToReview,
            candidates: candidates
        };

        const agent = new QuartermasterAgent(this.apiKey);
        return await agent.generate(context);
    }

    /**
     * Step 3: The Blacksmith
     */
    async runBlacksmith(blueprint, customRequests) {
        if (!customRequests || customRequests.length === 0) return [];

        const context = {
            creatureName: blueprint.name,
            cr: blueprint.cr,
            stats: blueprint.stats,
            requests: customRequests
        };

        const agent = new BlacksmithAgent(this.apiKey);
        return await agent.generate(context);
    }

    /**
     * Step 4: The Builder
     * Assembles the final actor document.
     */
    async runBuilder(blueprint, selectedUuids, customItems) {
        // 1. Fetch Compendium Items
        const compendiumItems = [];
        for (const uuid of selectedUuids) {
            const item = await fromUuid(uuid);
            if (item) {
                const itemData = item.toObject();
                // Clean up data if needed
                delete itemData._id;
                compendiumItems.push(itemData);
            }
        }

        // 2. Process Custom Items
        const processedCustomItems = await Promise.all(customItems.map(async item => {
            const sanitized = await sanitizeCustomItem(item);
            ensureActivityIds(sanitized);
            await ensureItemHasImage(sanitized);
            return sanitized;
        }));

        // 3. Build Spellcasting Feat (if applicable)
        const spellcastingFeat = await this._buildSpellcastingFeat(blueprint);

        // 4. Prepare System Data
        const system = {
            abilities: blueprint.stats.abilities,
            attributes: {
                ac: { value: blueprint.stats.ac, calc: "natural" },
                hp: { value: blueprint.stats.hp, max: blueprint.stats.hp, formula: "" },
                movement: blueprint.stats.movement ? { ...blueprint.stats.movement, units: "ft" } : { walk: 30, units: "ft" },
                senses: {
                    darkvision: blueprint.senses?.darkvision || 0,
                    blindsight: blueprint.senses?.blindsight || 0,
                    tremorsense: blueprint.senses?.tremorsense || 0,
                    truesight: blueprint.senses?.truesight || 0,
                    units: "ft",
                    special: ""
                },
                spellcasting: blueprint.spellcasting?.ability || ""
            },
            details: {
                cr: blueprint.cr,
                type: { value: blueprint.type?.toLowerCase() || "humanoid" },
                alignment: blueprint.alignment || "Unaligned",
                biography: {
                    value: `
                        ${blueprint.biography || ""}
                        <hr>
                        <p><strong>Behavior:</strong> ${blueprint.behavior}</p>
                        <p><strong>Appearance:</strong> ${blueprint.appearance}</p>
                        <p><strong>Twist:</strong> ${blueprint.twist}</p>
                        <p><strong>Habitat:</strong> ${blueprint.habitat || "Unknown"}</p>
                        <p><strong>Treasure:</strong> ${blueprint.treasure || "None"}</p>
                    `
                },
                race: blueprint.name // Often used as a subtitle
            },
            traits: {
                size: blueprint.size || "med",
                languages: {
                    value: blueprint.languages || ["common"]
                },
                di: { value: blueprint.immunities || [] },
                dr: { value: blueprint.resistances || [] },
                ci: { value: blueprint.condition_immunities || [] }
            },
            skills: this._mapSkills(blueprint.skills)
        };

        // Transform abilities from simple numbers to D&D 5e object format
        // Ensure we handle the case where abilities might be raw numbers from the AI
        if (blueprint.stats.abilities) {
            for (const [key, val] of Object.entries(blueprint.stats.abilities)) {
                // Check if it's already an object (just in case), otherwise convert
                if (typeof val === 'number') {
                    system.abilities[key] = { value: val, proficient: 0 };
                } else {
                    system.abilities[key] = val;
                }
            }
        }

        // Apply Save Proficiencies
        if (blueprint.saves) {
            for (const ability of blueprint.saves) {
                if (system.abilities[ability]) {
                    system.abilities[ability].proficient = 1;
                }
            }
        }

        // 5. Construct Actor Data
        const allItems = [...compendiumItems, ...processedCustomItems];
        if (spellcastingFeat) {
            allItems.push(spellcastingFeat);
        }

        const actorData = {
            name: blueprint.name,
            type: "npc",
            img: "icons/svg/mystery-man.svg",
            system: system,
            items: this._applyDynamicDescriptions(allItems, blueprint.name),
            prototypeToken: {
                name: blueprint.name,
                displayName: 20, // Hover
                actorLink: false,
                disposition: -1, // Hostile by default
                ...this._getTokenSizing(blueprint.size)
            }
        };

        return actorData;
    }

    /**
     * Get token dimensions based on creature size
     */
    _getTokenSizing(size) {
        const sizeMap = {
            "tiny": { width: 0.5, height: 0.5, scale: 0.5 },
            "sm": { width: 1, height: 1, scale: 0.8 },
            "med": { width: 1, height: 1, scale: 1 },
            "lg": { width: 2, height: 2, scale: 1 },
            "huge": { width: 3, height: 3, scale: 1 },
            "grg": { width: 4, height: 4, scale: 1 }
        };

        const s = sizeMap[size?.toLowerCase()] || sizeMap["med"];

        return {
            width: s.width,
            height: s.height,
            texture: {
                src: "icons/svg/mystery-man.svg",
                scaleX: s.scale,
                scaleY: s.scale
            }
        };
    }

    /**
     * Build a Spellcasting feat item with cast-type activities
     * This matches the official 5e 2024 data model for NPC spellcasters
     */
    async _buildSpellcastingFeat(blueprint) {
        if (!blueprint.spellcasting?.spells) return null;

        const spells = blueprint.spellcasting.spells;
        const ability = blueprint.spellcasting.ability || "int";

        // Combine all spells
        const allAtWill = spells.atWill || [];
        const allPerDay = spells.perDay || [];

        if (allAtWill.length === 0 && allPerDay.length === 0) return null;

        // Build activities object
        const activities = {};
        let activityIndex = 0;

        // Process at-will spells
        for (const spellName of allAtWill) {
            const uuid = await getSpellUuid(spellName);
            if (!uuid) {
                console.warn(`Vibe Combat | Could not find spell UUID for: ${spellName}`);
                continue;
            }

            const actId = foundry.utils.randomID(16);
            activities[actId] = {
                type: "cast",
                _id: actId,
                sort: activityIndex++,
                activation: { type: "action", value: null, override: false },
                consumption: {
                    scaling: { allowed: false },
                    spellSlot: true,
                    targets: []
                },
                description: { chatFlavor: "" },
                duration: { units: "inst", concentration: false, override: false },
                range: { override: false },
                target: {
                    template: { contiguous: false, units: "ft" },
                    affects: { choice: false },
                    override: false,
                    prompt: true
                },
                uses: { spent: 0, recovery: [], max: "" },
                spell: {
                    uuid: uuid,
                    level: null,  // Null for at-will/cantrips
                    properties: [],
                    spellbook: true,
                    ability: ""
                },
                name: ""
            };
        }

        // Process per-day spells
        for (const spellEntry of allPerDay) {
            const spellName = spellEntry.spell;
            const uses = spellEntry.uses || 1;

            const uuid = await getSpellUuid(spellName);
            if (!uuid) {
                console.warn(`Vibe Combat | Could not find spell UUID for: ${spellName}`);
                continue;
            }

            const actId = foundry.utils.randomID(16);
            activities[actId] = {
                type: "cast",
                _id: actId,
                sort: activityIndex++,
                activation: { type: "action", value: null, override: false },
                consumption: {
                    scaling: { allowed: false },
                    spellSlot: true,
                    targets: [{
                        type: "activityUses",
                        value: "1",
                        scaling: {}
                    }]
                },
                description: { chatFlavor: "" },
                duration: { units: "inst", concentration: false, override: false },
                range: { override: false },
                target: {
                    template: { contiguous: false, units: "ft" },
                    affects: { choice: false },
                    override: false,
                    prompt: true
                },
                uses: {
                    spent: 0,
                    recovery: [{ period: "day", type: "recoverAll" }],
                    max: String(uses)
                },
                spell: {
                    uuid: uuid,
                    level: null,
                    properties: [],
                    spellbook: true,
                    ability: ""
                },
                name: ""
            };
        }

        // Build description HTML
        let descParts = [];
        descParts.push(`<p class="feature">The [[lookup @name lowercase]] casts one of the following spells, using ${ability.toUpperCase()} as the spellcasting ability:</p>`);

        if (allAtWill.length > 0) {
            descParts.push(`<p class="feature-trait"><strong>At Will:</strong> <em>${allAtWill.join(", ")}</em></p>`);
        }

        // Group per-day spells by usage
        const byUses = {};
        for (const entry of allPerDay) {
            const key = entry.uses || 1;
            if (!byUses[key]) byUses[key] = [];
            byUses[key].push(entry.spell);
        }

        for (const [uses, spellNames] of Object.entries(byUses).sort((a, b) => b[0] - a[0])) {
            descParts.push(`<p class="feature-trait"><strong>${uses}/Day Each:</strong> <em>${spellNames.join(", ")}</em></p>`);
        }

        return {
            name: "Spellcasting",
            type: "feat",
            img: "icons/magic/symbols/circled-gem-pink.webp",
            system: {
                type: { value: "monster", subtype: "" },
                activities: activities,
                uses: { spent: 0, recovery: [], max: "" },
                description: {
                    value: descParts.join("\n"),
                    chat: ""
                },
                identifier: "spellcasting",
                source: { revision: 1, rules: "2024" },
                enchant: {},
                prerequisites: { level: null, repeatable: false },
                properties: [],
                requirements: "",
                advancement: [],
                cover: null,
                crewed: false
            },
            effects: [],
            flags: {},
            _id: foundry.utils.randomID(16)
        };
    }

    /**
     * Replace actor name with dynamic lookup in item descriptions
     */
    _applyDynamicDescriptions(items, actorName) {
        if (!actorName) return items;

        // Escape special regex characters in the name
        const escapedName = actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        const replacement = "[[lookup @name lowercase]]";

        return items.map(item => {
            const newItem = foundry.utils.duplicate(item);

            // Handle main description
            if (newItem.system?.description?.value) {
                newItem.system.description.value = newItem.system.description.value.replace(nameRegex, replacement);
            }

            // Handle activities descriptions (if any)
            if (newItem.system?.activities) {
                for (const activity of Object.values(newItem.system.activities)) {
                    if (activity.description?.value) {
                        activity.description.value = activity.description.value.replace(nameRegex, replacement);
                    }
                }
            }

            return newItem;
        });
    }

    /**
     * Helper to map skill names to 5e keys
     */
    _mapSkills(skills) {
        if (!skills) return {};
        const map = {
            "acrobatics": "acr", "animal handling": "ani", "arcana": "arc", "athletics": "ath",
            "deception": "dec", "history": "his", "insight": "ins", "intimidation": "itm",
            "investigation": "inv", "medicine": "med", "nature": "nat", "perception": "prc",
            "performance": "prf", "persuasion": "per", "religion": "rel", "sleight of hand": "slt",
            "stealth": "ste", "survival": "sur"
        };

        const result = {};
        for (const skill of skills) {
            // Handle case where skill might be { name: "Athletics", value: 5 }
            // or potentially just strings if the AI gets confused, but schema enforces object.
            const name = skill.name;
            const value = skill.value;

            const key = map[name.toLowerCase()];
            if (key) {
                result[key] = { value: value, ability: "" };
            }
        }
        return result;
    }
}
