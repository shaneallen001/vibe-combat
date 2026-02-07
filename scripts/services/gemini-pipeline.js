/**
 * Gemini Pipeline
 * Orchestrates the multi-step AI actor generation process.
 */

import { callGemini, extractJson } from "./gemini-service.js";
import * as CompendiumService from "./compendium-service.js";
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
     * Generates the concept and blueprint.
     */
    async runArchitect(request) {
        const prompt = `
        You are the "Architect", an expert D&D 5e monster designer.
        
        Task: Design a unique concept for a D&D 5e NPC based on the user's request.
        
        User Request:
        - Description: ${request.prompt}
        - Target CR: ${request.cr || "Appropriate for description"}
        - Type: ${request.type || "Any"}
        - Size: ${request.size || "Any"}
        
        Output a "Blueprint" JSON object with:
        - "name": Creative name.
        - "cr": Target Challenge Rating (number).
        - "type": Creature type (lowercase, e.g., "undead").
        - "alignment": Alignment string (e.g., "Chaotic Evil").
        - "stats": { 
            "ac": number, 
            "hp": number, 
            "movement": { "walk": number, "fly": number, "swim": number, "burrow": number, "climb": number, "hover": boolean }, 
            "abilities": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number } 
        }
        - "saves": Array of abilities with save proficiency (e.g., ["dex", "con"]).
        - "skills": Object with skill names and values (e.g., { "stealth": 5, "perception": 3 }). Use standard 5e skill names.
        - "senses": { "darkvision": number, "blindsight": number, "tremorsense": number, "truesight": number }.
        - "languages": Array of languages (lowercase, e.g., ["common", "draconic"]).
        - "resistances": Array of damage types (lowercase).
        - "immunities": Array of damage types (lowercase).
        - "condition_immunities": Array of conditions (lowercase).
        - "features": Array of desired features/actions. Each object: { "name": string, "description": string, "type": "action"|"bonus"|"reaction"|"passive" }.
        - "spellcasting": { "level": number, "school": string, "ability": string, "spells": [string] } (Optional, if spellcaster. List ONLY the spell name, e.g., "Fireball").
        - "behavior": Short description of combat tactics.
        - "appearance": Visual description.
        - "twist": A unique, unexpected trait or legendary action.
        - "biography": A rich, engaging backstory and description (HTML format allowed).
        - "habitat": String (e.g., "forest").
        - "treasure": String (e.g., "standard").
        
        Ensure the stats are mathematically balanced for the target CR in D&D 5e.
        `;

        const response = await callGemini({ apiKey: this.apiKey, prompt });
        return extractJson(response);
    }

    /**
     * Step 2: The Quartermaster
     * Selects existing items or requests custom ones.
     */
    async runQuartermaster(blueprint) {
        // 1. Prepare items to review (Features + Spells)
        const itemsToReview = [...blueprint.features];
        if (blueprint.spellcasting?.spells) {
            itemsToReview.push(...blueprint.spellcasting.spells.map(s => ({ name: s, type: "spell", description: "Spell" })));
        }

        // 2. Search for candidates
        const candidates = {};
        for (const item of itemsToReview) {
            const typeFilter = item.type === "spell" ? ["spell"] : ["feat", "weapon"];
            const results = await CompendiumService.search(item.name, typeFilter);
            // Take top 3 results
            candidates[item.name] = results.slice(0, 3).map(i => ({ name: i.name, uuid: i.uuid, type: i.type }));
        }

        const prompt = `
        You are the "Quartermaster".
        
        Task: Review the Actor Blueprint and the available Compendium Candidates.
        For each feature in the Blueprint, decide whether to use an existing Compendium item or request a Custom item.
        
        Blueprint Features (and Spells):
        ${JSON.stringify(itemsToReview, null, 2)}
        
        Available Candidates (Found in Database):
        ${JSON.stringify(candidates, null, 2)}
        
        Output a JSON object:
        {
            "selectedUuids": [ "uuid1", "uuid2" ], // List of UUIDs to use directly.
            "customRequests": [ // List of features that need custom generation.
                { "name": "Feature Name", "description": "Full description", "type": "action" } 
            ]
        }
        
        Rules:
        - If a Candidate matches the feature well, prefer using its UUID.
        - If no Candidate fits, add the feature to "customRequests".
        - You can also add standard items (like "Longsword") to "customRequests" if they weren't in the candidates but are needed.
        `;

        const response = await callGemini({ apiKey: this.apiKey, prompt });
        return extractJson(response);
    }

    /**
     * Step 3: The Blacksmith
     * Generates data for custom items.
     */
    async runBlacksmith(blueprint, customRequests) {
        if (!customRequests || customRequests.length === 0) return [];

        const exampleItem = {
            "name": "Bite",
            "type": "weapon",
            "_id": "dnd5eitem0000001",
            "img": "icons/svg/sword.svg",
            "system": {
                "description": { "value": "<p>Melee Weapon Attack.</p>" },
                "activities": {
                    "dnd5eactivity000": {
                        "_id": "dnd5eactivity000",
                        "type": "attack",
                        "activation": { "type": "action" },
                        "attack": { "flat": true, "bonus": "10" },
                        "damage": {
                            "parts": [{ "number": 2, "denomination": 10, "types": ["piercing"] }]
                        }
                    }
                }
            }
        };

        const prompt = `
        You are the "Blacksmith".
        
        Task: Generate valid Foundry VTT Item Data for the requested custom features.
        
        Context:
        - Creature: ${blueprint.name} (CR ${blueprint.cr})
        - Stats: ${JSON.stringify(blueprint.stats)}
        
        Requests:
        ${JSON.stringify(customRequests, null, 2)}
        
        Output a JSON ARRAY of Item objects.
        
        CRITICAL RULES:
        - Follow the D&D 5e data model for Foundry VTT v4.0+.
        - Use "system.activities" for damage and attacks.
        - Ensure "_id"s are unique 16-char strings.
        
        EXAMPLE ITEM STRUCTURE:
        ${JSON.stringify(exampleItem, null, 2)}
        `;

        const response = await callGemini({ apiKey: this.apiKey, prompt });
        const items = extractJson(response);
        return Array.isArray(items) ? items : [items];
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
        const processedCustomItems = customItems.map(item => {
            const sanitized = sanitizeCustomItem(item);
            ensureActivityIds(sanitized);
            ensureItemHasImage(sanitized);
            return sanitized;
        });

        // 3. Prepare System Data
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
                }
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

        // 4. Construct Actor Data
        // 4. Construct Actor Data
        const actorData = {
            name: blueprint.name,
            type: "npc",
            img: "icons/svg/mystery-man.svg",
            system: system,
            items: this._applyDynamicDescriptions([...compendiumItems, ...processedCustomItems], blueprint.name),
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
        for (const [name, value] of Object.entries(skills)) {
            const key = map[name.toLowerCase()];
            if (key) {
                result[key] = { value: value, ability: "" };
            }
        }
        return result;
    }
}
