/**
 * Blueprint Factory
 * Converts Foundry VTT Actor documents into Vibe Combat Blueprints
 */

export class BlueprintFactory {
    /**
     * Create a Blueprint JSON from an Actor document
     * @param {Actor} actor - The dnd5e Actor document
     * @returns {object} The Blueprint JSON string/object
     */
    static async createFromActor(actor) {
        const system = actor.system;

        // Helper to get ability value
        const getAbility = (key) => system.abilities?.[key]?.value || 10;

        // Helper to get save proficiency
        const getSaves = () => {
            const saves = [];
            for (const [key, ability] of Object.entries(system.abilities || {})) {
                if (ability.proficient) saves.push(key);
            }
            return saves;
        };

        // Helper to get skills
        const getSkills = () => {
            const skills = [];
            const skillMap = {
                "acr": "Acrobatics", "ani": "Animal Handling", "arc": "Arcana", "ath": "Athletics",
                "dec": "Deception", "his": "History", "ins": "Insight", "itm": "Intimidation",
                "inv": "Investigation", "med": "Medicine", "nat": "Nature", "prc": "Perception",
                "prf": "Performance", "per": "Persuasion", "rel": "Religion", "slt": "Sleight of Hand",
                "ste": "Stealth", "sur": "Survival"
            };

            for (const [key, skill] of Object.entries(system.skills || {})) {
                if (skill.value >= 1) { // Proficient or better
                    skills.push({ name: skillMap[key] || key, value: 5 });
                }
            }
            return skills;
        };

        // Strip HTML from text fields
        const stripHtml = (html) => {
            if (!html) return "";
            return html.replace(/<[^>]*>?/gm, '');
        };

        // Build optional automation hints from item activities/effects.
        const getAutomationHint = (item) => {
            const activities = Object.values(item.system?.activities || {}).filter((activity) => activity && typeof activity === "object");
            if (!activities.length) return undefined;
            const attackActivity = activities.find((activity) => activity.type === "attack");
            const saveActivities = activities.filter((activity) => activity.type === "save" && activity.save);
            const companionSaveActivity = attackActivity ? (
                saveActivities.find((activity) =>
                    activity.activation?.type === "passive"
                    || /when hit|after .*hit|on hit/i.test(String(activity.activation?.condition || ""))
                ) || saveActivities[0]
            ) : undefined;
            const hasSplitAttackSaveIntent = Boolean(attackActivity && companionSaveActivity);
            const primary = attackActivity || activities[0];
            const hint = {};

            if (["attack", "save", "damage", "utility"].includes(primary.type)) {
                hint.resolution = primary.type;
            }
            if (["action", "bonus", "reaction", "special", "passive"].includes(primary.activation?.type)) {
                hint.activationType = primary.activation.type;
            } else if (["legendary", "mythic"].includes(primary.activation?.type)) {
                hint.activationType = "special";
            }

            if (primary.save) {
                hint.save = {
                    ability: primary.save.ability,
                    dc: primary.save.dc,
                    onSave: primary.damage?.onSave,
                };
            }

            if (hasSplitAttackSaveIntent) {
                hint.resolution = "attack";
                hint.splitActivities = true;
                hint.secondaryResolution = "save";
                hint.rider = {};

                const riderTriggerText = String(companionSaveActivity.activation?.condition || "");
                hint.rider.trigger = /when hit|after .*hit|on hit/i.test(riderTriggerText)
                    ? "on-hit"
                    : companionSaveActivity.activation?.type === "passive"
                        ? "passive"
                        : "manual";

                if (companionSaveActivity.save) {
                    hint.rider.save = {
                        ability: companionSaveActivity.save.ability,
                        dc: companionSaveActivity.save.dc,
                        onSave: companionSaveActivity.damage?.onSave,
                    };
                }
            }

            if (primary.duration) {
                hint.duration = {
                    value: Number(primary.duration.value) || undefined,
                    units: primary.duration.units,
                    concentration: primary.duration.concentration,
                };
            }

            if (primary.range) {
                hint.range = {
                    value: Number(primary.range.value) || undefined,
                    units: primary.range.units,
                };
            }

            if (primary.target) {
                hint.target = {
                    type: primary.target.affects?.type,
                    count: primary.target.affects?.count,
                    templateType: primary.target.template?.type,
                    templateSize: primary.target.template?.size,
                    units: primary.target.template?.units || primary.range?.units,
                };
            }

            if (primary.uses) {
                hint.uses = {
                    max: primary.uses.max,
                    recovery: primary.uses.recovery,
                    spend: Number(primary.consumption?.targets?.[0]?.value) || undefined,
                };
            }

            const conditionSourceActivity = hasSplitAttackSaveIntent ? companionSaveActivity : primary;
            const referencedStatuses = [];
            for (const effectRef of conditionSourceActivity?.effects || []) {
                const effect = (item.effects || []).find((e) => e._id === effectRef._id);
                for (const status of effect?.statuses || []) referencedStatuses.push(status);
            }
            if (referencedStatuses.length > 0) {
                const conditionHint = { statuses: [...new Set(referencedStatuses)] };
                if (hasSplitAttackSaveIntent) {
                    hint.rider = hint.rider || {};
                    hint.rider.condition = conditionHint;
                } else {
                    hint.condition = conditionHint;
                }
            }

            if (hasSplitAttackSaveIntent && companionSaveActivity?.duration) {
                const durationHint = {
                    value: Number(companionSaveActivity.duration.value) || undefined,
                    units: companionSaveActivity.duration.units,
                    concentration: companionSaveActivity.duration.concentration,
                };
                hint.rider = hint.rider || {};
                hint.rider.duration = durationHint;
            }

            const triggerText = stripHtml(item.system?.description?.value || "");
            if (/when hit|when .* hits|start of turn|end of turn/i.test(triggerText)) {
                hint.trigger = {
                    type: /start of turn/i.test(triggerText)
                        ? "start-turn"
                        : /end of turn/i.test(triggerText)
                            ? "end-turn"
                            : "when-hit",
                    text: triggerText,
                };
            }

            return Object.keys(hint).length > 0 ? hint : undefined;
        };

        // Features & Equipment & Spells
        const features = [];
        const equipment = [];
        const spells = { atWill: [], perDay: [] };
        let hasSpells = false;

        for (const item of actor.items) {
            // Equipment & Features
            if (item.type === "feat" || item.type === "weapon" || item.type === "equipment" || item.type === "loot") {
                const isWeapon = item.type === "weapon";
                const isArmor = item.type === "equipment" && item.system.armor?.type;
                const isShield = item.type === "equipment" && item.system.armor?.type === "shield";
                // Treat loot as gear
                const isLoot = item.type === "loot";

                if (isWeapon || isArmor || isShield || isLoot) {
                    equipment.push({
                        name: item.name,
                        type: isWeapon ? "weapon" : isShield ? "shield" : isArmor ? "armor" : "gear",
                        description: stripHtml(item.system.description?.value || "")
                    });
                } else if (item.type === "feat") {
                    let type = "action";
                    const firstActivity = Object.values(item.system?.activities || {})[0];
                    const activation = item.system.activation?.type || firstActivity?.activation?.type;
                    if (activation === "bonus") type = "bonus";
                    if (activation === "reaction") type = "reaction";
                    if (activation === "legendary") type = "legendary";
                    if (activation === "mythic") type = "mythic";
                    if (!activation || activation === "none") type = "passive";

                    features.push({
                        name: item.name,
                        description: stripHtml(item.system.description?.value || ""),
                        type: type,
                        automation: getAutomationHint(item),
                    });
                }
            }
            // Spells
            else if (item.type === "spell") {
                hasSpells = true;
                const mode = item.system.preparation?.mode;
                if (mode === "atwill" || item.system.level === 0) {
                    spells.atWill.push(item.name);
                } else {
                    // Default to 1 use if we can't determine, but typically this is just a list of known spells
                    // The AI will decide how many slots/uses based on the class/CR it assigns.
                    spells.perDay.push({ spell: item.name, uses: 1 });
                }
            }
        }

        // Spellcasting Object
        let spellcasting = undefined;
        if (hasSpells || system.attributes.spellcasting) {
            spellcasting = {
                ability: system.attributes.spellcasting || "int", // Default to int if missing
                spells: spells
            };
        }

        // Handle CR (number or object)
        let cr = 0;
        if (typeof system.details?.cr === 'object') {
            cr = system.details.cr?.total ?? system.details.cr?.value ?? 0;
        } else {
            cr = Number(system.details?.cr || 0);
        }

        const bio = stripHtml(system.details?.biography?.value || "");

        return {
            name: actor.name,
            cr: cr,
            type: system.details?.type?.value || "humanoid",
            alignment: system.details?.alignment || "Unaligned",
            stats: {
                ac: system.attributes?.ac?.value || 10,
                hp: system.attributes?.hp?.max || system.attributes?.hp?.value || 10,
                movement: {
                    walk: system.attributes?.movement?.walk || 30,
                    fly: system.attributes?.movement?.fly || 0,
                    swim: system.attributes?.movement?.swim || 0,
                    climb: system.attributes?.movement?.climb || 0,
                    burrow: system.attributes?.movement?.burrow || 0,
                    hover: system.attributes?.movement?.hover || false
                },
                abilities: {
                    str: getAbility("str"),
                    dex: getAbility("dex"),
                    con: getAbility("con"),
                    int: getAbility("int"),
                    wis: getAbility("wis"),
                    cha: getAbility("cha")
                }
            },
            saves: getSaves(),
            skills: getSkills(),
            senses: {
                darkvision: system.attributes?.senses?.darkvision || 0,
                blindsight: system.attributes?.senses?.blindsight || 0,
                tremorsense: system.attributes?.senses?.tremorsense || 0,
                truesight: system.attributes?.senses?.truesight || 0
            },
            languages: system.traits?.languages?.value ? [...system.traits.languages.value] : [],
            resistances: system.traits?.dr?.value ? [...system.traits.dr.value] : [],
            immunities: system.traits?.di?.value ? [...system.traits.di.value] : [],
            condition_immunities: system.traits?.ci?.value ? [...system.traits.ci.value] : [],
            equipment: equipment,
            features: features,
            spellcasting: spellcasting,
            behavior: bio.substring(0, 100) + "...", // Placeholder from bio
            appearance: "As described in bio.",
            twist: "None",
            biography: bio,
            habitat: "Unknown",
            treasure: "Standard"
        };
    }
}
