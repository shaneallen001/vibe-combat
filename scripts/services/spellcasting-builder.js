/**
 * Spellcasting Builder
 * Builds Spellcasting feat items with cast-type activities for NPC spellcasters.
 * This matches the official 5e 2024 data model.
 */

import { getSpellUuid } from "./compendium-service.js";

/**
 * SpellcastingBuilder class
 * Responsible for creating Spellcasting feat items with embedded spell activities.
 */
export class SpellcastingBuilder {
    /**
     * Build a Spellcasting feat item with cast-type activities
     * This matches the official 5e 2024 data model for NPC spellcasters
     * @param {Object} blueprint - The actor blueprint containing spellcasting data
     * @returns {Object|null} { feat: Object, embeddedSpells: Array } or null if no spells
     */
    static async build(blueprint) {
        if (!blueprint.spellcasting?.spells) return null;

        const spells = blueprint.spellcasting.spells;
        const ability = blueprint.spellcasting.ability || "int";

        // Combine all spells
        const allAtWill = spells.atWill || [];
        const allPerDay = spells.perDay || [];

        if (allAtWill.length === 0 && allPerDay.length === 0) return null;

        // Generate feat ID upfront so we can reference it in spell links
        const featId = foundry.utils.randomID(16);

        // Build activities object and collect spell references for embedding
        const activities = {};
        const spellRefs = []; // { uuid, activityId } - for fetching and linking
        let activityIndex = 0;

        // Process at-will spells
        for (const spellName of allAtWill) {
            const uuid = await getSpellUuid(spellName);
            if (!uuid) {
                console.warn(`Vibe Combat | Could not find spell UUID for at-will spell: ${spellName}. Activity will be created without UUID link.`);
            }

            const actId = foundry.utils.randomID(16);
            activities[actId] = this._createAtWillActivity(actId, activityIndex++, uuid);

            if (uuid) {
                spellRefs.push({ uuid, activityId: actId });
            }
        }

        // Process per-day spells
        for (const spellEntry of allPerDay) {
            const spellName = spellEntry.spell;
            const uses = spellEntry.uses || 1;

            const uuid = await getSpellUuid(spellName);
            if (!uuid) {
                console.warn(`Vibe Combat | Could not find spell UUID for per-day spell: ${spellName}. Activity will be created without UUID link.`);
            }

            const actId = foundry.utils.randomID(16);
            activities[actId] = this._createPerDayActivity(actId, activityIndex++, uuid, uses);

            if (uuid) {
                spellRefs.push({ uuid, activityId: actId });
            }
        }

        // Build description HTML
        const description = this._buildDescription(ability, allAtWill, allPerDay);

        const feat = {
            name: "Spellcasting",
            type: "feat",
            img: "icons/magic/symbols/circled-gem-pink.webp",
            system: {
                type: { value: "monster", subtype: "" },
                activities: activities,
                uses: { spent: 0, recovery: [], max: "" },
                description: {
                    value: description,
                    chat: ""
                },
                identifier: "spellcasting",
                source: { revision: 1, rules: "2024" },
                enchant: {},
                prerequisites: { level: null, repeatable: false, items: [] },
                properties: [],
                requirements: "",
                advancement: [],
                cover: null,
                crewed: false
            },
            effects: [],
            flags: {},
            _id: featId
        };

        // Fetch and embed spell items
        const embeddedSpells = await this._embedSpellItems(spellRefs, featId);

        return { feat, embeddedSpells };
    }

    /**
     * Create an at-will cast activity
     * @private
     */
    static _createAtWillActivity(actId, sortIndex, uuid) {
        return {
            type: "cast",
            _id: actId,
            sort: sortIndex,
            activation: { type: "action", value: null, override: false },
            consumption: {
                scaling: { allowed: false },
                spellSlot: true,
                targets: []
            },
            description: { chatFlavor: "" },
            duration: { units: "inst", concentration: false, override: false },
            range: { override: false, units: "self" },
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

    /**
     * Create a per-day cast activity
     * @private
     */
    static _createPerDayActivity(actId, sortIndex, uuid, uses) {
        return {
            type: "cast",
            _id: actId,
            sort: sortIndex,
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
            range: { override: false, units: "self" },
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

    /**
     * Build the spellcasting description HTML
     * @private
     */
    static _buildDescription(ability, allAtWill, allPerDay) {
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

        return descParts.join("\n");
    }

    /**
     * Fetch and embed spell items from compendium
     * @private
     */
    static async _embedSpellItems(spellRefs, featId) {
        const embeddedSpells = [];
        for (const ref of spellRefs) {
            try {
                const spellDoc = await fromUuid(ref.uuid);
                if (spellDoc) {
                    const spellData = spellDoc.toObject();

                    // Generate new ID for the embedded spell
                    spellData._id = foundry.utils.randomID(16);

                    // Link spell to its cast activity (critical for Foundry to recognize it)
                    spellData.flags = spellData.flags || {};
                    spellData.flags.dnd5e = spellData.flags.dnd5e || {};
                    spellData.flags.dnd5e.cachedFor = `.Item.${featId}.Activity.${ref.activityId}`;

                    // Mark as a sourced spell
                    spellData.system = spellData.system || {};
                    spellData.system.method = "spell";

                    // Ensure _stats has compendium source for reference
                    spellData._stats = spellData._stats || {};
                    spellData._stats.compendiumSource = ref.uuid;

                    embeddedSpells.push(spellData);
                    console.log(`Vibe Combat | Embedded spell: ${spellData.name}`);
                }
            } catch (err) {
                console.warn(`Vibe Combat | Failed to fetch spell from ${ref.uuid}:`, err);
            }
        }
        return embeddedSpells;
    }
}
