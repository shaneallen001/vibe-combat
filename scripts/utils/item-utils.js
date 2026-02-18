/**
 * Item Utilities
 * Helper functions for validating and normalizing Foundry VTT items
 */

import { validateImagePath } from "./file-utils.js";

const CONDITION_STATUSES = [
    "blinded",
    "charmed",
    "deafened",
    "frightened",
    "grappled",
    "incapacitated",
    "invisible",
    "paralyzed",
    "petrified",
    "poisoned",
    "prone",
    "restrained",
    "stunned",
    "unconscious",
];

const ABILITY_ALIASES = {
    strength: "str",
    str: "str",
    dexterity: "dex",
    dex: "dex",
    constitution: "con",
    con: "con",
    intelligence: "int",
    int: "int",
    wisdom: "wis",
    wis: "wis",
    charisma: "cha",
    cha: "cha",
};

const AREA_TEMPLATE_TYPES = new Set(["cone", "line", "cube", "cylinder", "sphere"]);

function stripHtml(html) {
    if (!html) return "";
    return String(html).replace(/<[^>]*>?/gm, " ");
}

function normalizeText(value) {
    return stripHtml(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function extractHints(text) {
    const normalized = normalizeText(text);
    const dcSaveMatch = normalized.match(/dc\s*(\d+)\s*(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s*saving throw/i);
    const saveAbilityMatch = normalized.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s*saving throw/i);
    const usesMatch = normalized.match(/(\d+)\s*\/\s*(day|long rest|short rest)/i);
    const radiusTemplateMatch = normalized.match(/(\d+)\s*(?:-|\s*)foot(?:-|\s*)radius\s*(sphere|cylinder)\b/i);
    const directTemplateMatch = normalized.match(/(\d+)\s*(?:-|\s*)foot(?:-|\s*)?(cone|line|cube|cylinder|sphere)\b/i);
    const squareTemplateMatch = normalized.match(/(\d+)\s*(?:-|\s*)foot(?:-|\s*)square\b/i);
    const halfOnSaveMatch = /on a successful save[^.]*half|on a success[^.]*half|half as much damage|half damage on a successful save|success[^.]*half as much/i.test(normalized);
    const noneOnSaveMatch = /on a successful save[^.]*no damage|on a success[^.]*no damage|takes no damage on a successful save|takes no damage on a success|success[^.]*isn't/i.test(normalized);
    const hasChoiceLanguage = /\bone of the following\b|\bchoose one\b|\bchoose which\b|\brandomly chooses\b/i.test(normalized);

    const statuses = CONDITION_STATUSES.filter((status) => normalized.includes(status));
    const saveAbilityRaw = dcSaveMatch?.[2] || saveAbilityMatch?.[1];
    const saveAbility = saveAbilityRaw ? ABILITY_ALIASES[saveAbilityRaw] : undefined;
    const saveDc = dcSaveMatch ? Number(dcSaveMatch[1]) : undefined;
    const templateType = radiusTemplateMatch?.[2] || directTemplateMatch?.[2] || (squareTemplateMatch ? "cube" : undefined);
    const templateSize = radiusTemplateMatch?.[1] || directTemplateMatch?.[1] || squareTemplateMatch?.[1];
    const saveOnSuccess = halfOnSaveMatch ? "half" : noneOnSaveMatch ? "none" : undefined;

    return {
        hasSaveLanguage: /saving throw|\bsave\b|must succeed on|must make/i.test(normalized),
        hasConditionLanguage: statuses.length > 0,
        statuses,
        saveAbility,
        saveDc,
        hasDamageLanguage: /damage|takes/i.test(normalized),
        templateType,
        templateSize,
        saveOnSuccess,
        hasChoiceLanguage,
        uses: usesMatch
            ? {
                max: String(usesMatch[1]),
                period: usesMatch[2].toLowerCase() === "day" ? "day" : usesMatch[2].toLowerCase() === "long rest" ? "lr" : "sr",
            }
            : null,
    };
}

function getEffectStatusSet(item) {
    const set = new Set();
    for (const effect of item.effects || []) {
        for (const status of effect.statuses || []) set.add(status);
    }
    return set;
}

function getOrCreateEffectForStatus(item, status) {
    item.effects = Array.isArray(item.effects) ? item.effects : [];
    const existing = item.effects.find((effect) => (effect.statuses || []).includes(status));
    if (existing) return existing;

    const created = {
        _id: ensureValidId(""),
        name: status.charAt(0).toUpperCase() + status.slice(1),
        transfer: false,
        statuses: [status],
        changes: [],
    };
    item.effects.push(created);
    return created;
}

function ensureItemEffectIds(item) {
    if (!Array.isArray(item.effects)) return;
    for (const effect of item.effects) {
        effect._id = ensureValidId(effect._id);
    }
}

function ensureAutomationFlagContainer(item) {
    item.flags = item.flags || {};
    item.flags["vibe-combat"] = item.flags["vibe-combat"] || {};
    if (!Array.isArray(item.flags["vibe-combat"].automationWarnings)) {
        item.flags["vibe-combat"].automationWarnings = [];
    }
}

/**
 * Ensures a value is a valid 16-character Foundry ID.
 * @param {string} value - The value to validate
 * @returns {string} - A valid 16-character ID
 */
export function ensureValidId(value) {
    const sanitized = (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (sanitized.length === 16) return sanitized;
    if (typeof foundry?.utils?.randomID === "function") {
        return foundry.utils.randomID(16).toLowerCase();
    }
    // Test/runtime fallback when Foundry randomID is unavailable.
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let generated = "";
    for (let i = 0; i < 16; i++) {
        generated += chars[Math.floor(Math.random() * chars.length)];
    }
    return generated;
}

/**
 * Ensures an item has a valid _id property.
 * @param {object} item - The item to check
 */
export function ensureItemHasId(item) {
    item._id = ensureValidId(item._id);
}

/**
 * Ensures an item has a valid image path, applying defaults based on type if needed.
 * @param {object} item - The item to check
 */
export async function ensureItemHasImage(item) {
    if (item.img && item.img !== "" && !item.img.toLowerCase().includes("placeholder")) {
        const isValid = await validateImagePath(item.img);
        if (isValid) return;
    }

    switch (item.type?.toLowerCase()) {
        case "weapon":
            item.img = "icons/svg/sword.svg";
            break;
        case "feat":
            item.img = "icons/svg/dice-target.svg";
            break;
        case "spell":
            item.img = "icons/svg/book.svg";
            break;
        case "equipment":
        case "consumable":
        case "tool":
        case "loot":
        case "container":
            item.img = "icons/svg/item-bag.svg";
            break;
        default:
            item.img = "icons/svg/mystery-man.svg";
    }
}

/**
 * Ensures all activities in an item have valid IDs.
 * @param {object} item - The item to check
 */
export function ensureActivityIds(item) {
    const activities = foundry.utils.getProperty(item, "system.activities");
    if (!activities || typeof activities !== "object") return;
    const normalized = {};
    for (const [key, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        const newId = ensureValidId(activity._id || key);
        activity._id = newId;
        normalized[newId] = activity;
    }
    item.system.activities = normalized;
}

function parseOptionItemName(name) {
    const match = String(name || "").match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!match) return null;
    const baseName = (match[1] || "").trim();
    const optionName = (match[2] || "").trim();
    if (!baseName || !optionName) return null;
    return { baseName, optionName };
}

function toUtilityActivity(activity = {}) {
    return {
        _id: ensureValidId(activity._id || ""),
        type: "utility",
        activation: activity.activation || { type: "action", value: 1, override: false },
        range: activity.range || { units: "ft", override: false },
        target: activity.target || {},
        duration: activity.duration || { units: "inst", concentration: false, override: false },
        uses: activity.uses,
        consumption: activity.consumption,
        roll: activity.roll,
        effects: [],
        description: activity.description || {},
    };
}

function itemHasResolutionActivity(item) {
    const activities = foundry.utils.getProperty(item, "system.activities") || {};
    return Object.values(activities).some((activity) =>
        activity && ["save", "attack", "damage"].includes(String(activity.type || "").toLowerCase())
    );
}

/**
 * Normalize mutually-exclusive option features only when output is redundant.
 * If a base feature with choice language has separate option items as siblings,
 * keep the base as utility/helper and preserve option resolution on child items.
 *
 * This is intentionally conditional:
 * - Applies only when BOTH a base item and 2+ "(Option)" siblings exist.
 * - Requires explicit choice language in the base description.
 * - Does not touch single-item multi-activity designs (e.g. beholder-style Eye Rays).
 *
 * @param {object[]} items
 * @returns {object[]}
 */
export function normalizeMutuallyExclusiveOptionItems(items) {
    if (!Array.isArray(items) || items.length === 0) return items;
    const cloned = foundry.utils.duplicate(items);
    const nameToIndex = new Map();

    for (let i = 0; i < cloned.length; i++) {
        const key = String(cloned[i]?.name || "").trim().toLowerCase();
        if (key) nameToIndex.set(key, i);
    }

    const groups = new Map();
    for (let i = 0; i < cloned.length; i++) {
        const parsed = parseOptionItemName(cloned[i]?.name);
        if (!parsed) continue;
        const key = parsed.baseName.toLowerCase();
        if (!groups.has(key)) {
            groups.set(key, { baseName: parsed.baseName, optionIndexes: [] });
        }
        groups.get(key).optionIndexes.push(i);
    }

    const candidateBaseIndexes = new Set();
    for (const [key] of groups.entries()) {
        const baseIndex = nameToIndex.get(key);
        if (baseIndex !== undefined) candidateBaseIndexes.add(baseIndex);
    }
    for (let i = 0; i < cloned.length; i++) {
        const description = cloned[i]?.system?.description?.value || "";
        if (extractHints(description).hasChoiceLanguage) {
            candidateBaseIndexes.add(i);
        }
    }

    for (const baseIndex of candidateBaseIndexes.values()) {
        const baseItem = cloned[baseIndex];
        if (!baseItem || !["feat", "weapon"].includes(String(baseItem.type || "").toLowerCase())) continue;

        const baseDescription = baseItem?.system?.description?.value || "";
        const hints = extractHints(baseDescription);
        if (!hints.hasChoiceLanguage) continue;

        const lowerBaseName = String(baseItem.name || "").trim().toLowerCase();
        const groupedOptionIndexes = groups.get(lowerBaseName)?.optionIndexes || [];
        const descriptionText = normalizeText(baseDescription);
        const mentionedOptionIndexes = [];
        for (let i = 0; i < cloned.length; i++) {
            if (i === baseIndex) continue;
            const sibling = cloned[i];
            const siblingName = String(sibling?.name || "").trim().toLowerCase();
            if (!siblingName) continue;
            if (!itemHasResolutionActivity(sibling)) continue;
            if (descriptionText.includes(siblingName)) {
                mentionedOptionIndexes.push(i);
            }
        }
        const optionIndexes = [...new Set([...groupedOptionIndexes, ...mentionedOptionIndexes])];
        if (optionIndexes.length < 2) continue;

        const activities = foundry.utils.getProperty(baseItem, "system.activities") || {};
        const entries = Object.entries(activities).filter(([, activity]) => activity && typeof activity === "object");
        if (entries.length === 0) continue;

        const utilityEntries = entries.filter(([, activity]) => activity.type === "utility");
        const nonUtilityEntries = entries.filter(([, activity]) => activity.type !== "utility");

        if (utilityEntries.length > 0 && nonUtilityEntries.length === 0) {
            continue; // Already in desired parent-helper-only structure.
        }

        const sourceActivity = nonUtilityEntries[0]?.[1] || utilityEntries[0]?.[1] || entries[0][1];
        const utilityActivity = toUtilityActivity(sourceActivity);

        if (!utilityActivity.uses && sourceActivity?.uses) {
            utilityActivity.uses = foundry.utils.duplicate(sourceActivity.uses);
        }
        if (!utilityActivity.consumption && sourceActivity?.consumption) {
            utilityActivity.consumption = foundry.utils.duplicate(sourceActivity.consumption);
        }

        baseItem.system = baseItem.system || {};
        baseItem.system.activities = { [utilityActivity._id]: utilityActivity };
        baseItem.effects = [];

        ensureAutomationFlagContainer(baseItem);
        baseItem.flags["vibe-combat"].normalizedOptionStructure = true;
    }

    return cloned;
}

/**
 * Automatically equips armor and shield equipment.
 * @param {object} item - The item to check
 */
export function autoEquipIfArmor(item) {
    if (item.type !== "equipment") return;
    const armorValue = item.system?.armor?.value;
    const isShield = item.system?.type?.value === "shield";
    if (armorValue || isShield) {
        foundry.utils.setProperty(item, "system.equipped", true);
    }
}

/**
 * Sanitizes a custom item by ensuring it has valid IDs and images.
 * @param {object} item - The item to sanitize
 * @returns {object} - The sanitized item
 */
export async function sanitizeCustomItem(item) {
    const cloned = foundry.utils.duplicate(item);
    ensureItemHasId(cloned);
    await ensureItemHasImage(cloned);
    ensureActivityIds(cloned);
    ensureItemEffectIds(cloned);
    return cloned;
}

function getActivityDescriptionText(activity, fallbackDescription = "") {
    return `${fallbackDescription || ""} ${activity?.description?.value || ""}`.trim();
}

function parseSaveDcValue(activity) {
    const formula = activity?.save?.dc?.formula;
    const value = Number(formula);
    return Number.isFinite(value) ? value : undefined;
}

function hasCompanionSaveActivity(activity, activities = {}, fallbackDescription = "") {
    if (!activity || typeof activity !== "object") return false;
    const sourceDescription = getActivityDescriptionText(activity, fallbackDescription);
    const sourceHints = extractHints(sourceDescription);
    const sourceEffectIds = new Set(
        (Array.isArray(activity.effects) ? activity.effects : [])
            .map((effectRef) => effectRef?._id)
            .filter(Boolean)
    );

    for (const sibling of Object.values(activities || {})) {
        if (!sibling || sibling === activity) continue;
        if (String(sibling.type || "").toLowerCase() !== "save") continue;
        if (!sibling.save) continue;

        const siblingSaveAbilities = Array.isArray(sibling?.save?.ability) ? sibling.save.ability : [];
        const siblingDc = parseSaveDcValue(sibling);
        const siblingEffects = Array.isArray(sibling.effects) ? sibling.effects : [];
        const siblingEffectIds = new Set(siblingEffects.map((effectRef) => effectRef?._id).filter(Boolean));

        const abilityMatches = !sourceHints.saveAbility || siblingSaveAbilities.includes(sourceHints.saveAbility);
        const dcMatches = !Number.isFinite(sourceHints.saveDc) || siblingDc === sourceHints.saveDc;
        const effectMatches = sourceEffectIds.size === 0
            ? (!sourceHints.hasConditionLanguage || siblingEffects.length > 0)
            : [...sourceEffectIds].some((effectId) => siblingEffectIds.has(effectId));

        if (abilityMatches && dcMatches && effectMatches) {
            return true;
        }
    }

    return false;
}

/**
 * Validate one activity for automation completeness.
 * @param {object} activity
 * @param {object} item
 * @param {string} fallbackDescription
 * @param {object} activitiesContext
 * @returns {{issues: string[], hints: object}}
 */
export function validateActivityAutomation(activity, item, fallbackDescription = "", activitiesContext = null) {
    const description = getActivityDescriptionText(activity, fallbackDescription);
    const hints = extractHints(description);
    const issues = [];
    const activityEffects = Array.isArray(activity?.effects) ? activity.effects : [];
    const itemEffectIds = new Set((item.effects || []).map((effect) => effect._id));
    const activityType = String(activity?.type || "").toLowerCase();
    const templateType = String(activity?.target?.template?.type || "").toLowerCase();
    const templateSize = String(activity?.target?.template?.size || "").trim();
    const templateWidth = String(activity?.target?.template?.width || "").trim();
    const isChoiceUtilityHelper = hints.hasChoiceLanguage && activityType === "utility";
    const hasAttackSaveCompanion = activityType === "attack"
        && hints.hasSaveLanguage
        && hasCompanionSaveActivity(activity, activitiesContext || {}, fallbackDescription);

    if (activity?.type === "save" && !activity?.save) {
        issues.push("Activity type is save but save data is missing.");
    }

    if (hints.hasSaveLanguage && !activity?.save && !isChoiceUtilityHelper && !hasAttackSaveCompanion) {
        if (activityType === "attack") {
            issues.push("Attack activity includes save language but has no companion save rider activity.");
        } else {
            issues.push("Description implies saving throw but activity.save is missing.");
        }
    }

    if (hints.hasSaveLanguage && (activityType === "damage" || activityType === "utility") && !isChoiceUtilityHelper) {
        issues.push(`Description implies saving throw but activity.type is "${activityType}".`);
    }

    if (AREA_TEMPLATE_TYPES.has(templateType) && !templateSize && !templateWidth) {
        issues.push(`Area template type "${templateType}" is missing template size.`);
    }

    if (hints.templateType && !templateType) {
        issues.push(`Description implies ${hints.templateType} template but activity.target.template.type is missing.`);
    }

    if (hints.templateSize && !templateSize && !templateWidth) {
        issues.push("Description implies template size but activity.target.template.size is missing.");
    }

    if (hints.hasConditionLanguage && activityEffects.length === 0 && !isChoiceUtilityHelper && !hasAttackSaveCompanion) {
        issues.push("Description implies condition but activity.effects is empty.");
    }

    if (hints.hasChoiceLanguage && activityEffects.length > 1) {
        issues.push("Description implies a one-of choice, but a single activity links multiple effects.");
    }

    if (hints.uses && (!activity?.uses?.max || String(activity.uses.max).trim() === "")) {
        issues.push("Description implies limited uses but activity.uses.max is missing.");
    }

    if (activity?.save && activity?.damage && !activity?.damage?.onSave) {
        issues.push("Save + damage activity is missing damage.onSave.");
    }

    if (hints.saveOnSuccess && activity?.save && activity?.damage?.onSave && activity.damage.onSave !== hints.saveOnSuccess) {
        issues.push(`Description implies onSave "${hints.saveOnSuccess}" but activity.damage.onSave is "${activity.damage.onSave}".`);
    }

    for (const effectRef of activityEffects) {
        if (!effectRef?._id || !itemEffectIds.has(effectRef._id)) {
            issues.push(`Activity references missing effect id: ${effectRef?._id || "(empty)"}.`);
        }
    }

    return { issues, hints };
}

/**
 * Repair activity automation where safe and record unresolved warnings.
 * @param {object} item
 * @returns {{item: object, warnings: string[]}}
 */
export function validateAndRepairItemAutomation(item) {
    const cloned = foundry.utils.duplicate(item);
    ensureItemEffectIds(cloned);
    ensureAutomationFlagContainer(cloned);
    const warnings = [];

    const fallbackDescription = cloned.system?.description?.value || "";
    const activities = foundry.utils.getProperty(cloned, "system.activities") || {};
    const seenEffectLinks = new Set();

    // Pre-pass repair: split one-of choice activities that incorrectly link multiple effects.
    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        const description = `${fallbackDescription || ""} ${activity?.description?.value || ""}`.trim();
        const hints = extractHints(description);
        const effectRefs = Array.isArray(activity.effects) ? activity.effects : [];
        if (!hints.hasChoiceLanguage || activity.type !== "save" || effectRefs.length < 2) continue;

        const helper = toUtilityActivity(activity);
        helper._id = ensureValidId(activity._id || activityId);
        helper.name = activity.name || "Choose Option";
        helper.effects = [];
        activities[helper._id] = helper;
        if (helper._id !== activityId) delete activities[activityId];

        for (const effectRef of effectRefs) {
            const effect = (cloned.effects || []).find((e) => e._id === effectRef._id);
            const optionActivity = foundry.utils.duplicate(activity);
            optionActivity._id = ensureValidId("");
            optionActivity.effects = [{ _id: effectRef._id, onSave: effectRef.onSave ?? false }];
            optionActivity.name = effect?.name || optionActivity.name || "Option";
            if (effect?.description) {
                optionActivity.description = optionActivity.description || {};
                optionActivity.description.value = effect.description;
            }
            activities[optionActivity._id] = optionActivity;
        }
    }

    // Pre-pass repair: split attack activities with save-gated condition riders.
    // Pattern: attack activity prose includes save clause and links condition effects.
    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        if (String(activity.type || "").toLowerCase() !== "attack") continue;
        if (activity.save) continue;

        const description = getActivityDescriptionText(activity, fallbackDescription);
        const hints = extractHints(description);
        const effectRefs = Array.isArray(activity.effects) ? activity.effects : [];
        if (!hints.hasSaveLanguage || effectRefs.length === 0) continue;
        if (!hints.saveAbility || !Number.isFinite(hints.saveDc)) continue;
        if (hasCompanionSaveActivity(activity, activities, fallbackDescription)) continue;

        const riderId = ensureValidId("");
        const riderEffects = effectRefs.map((effectRef) => ({
            _id: effectRef._id,
            onSave: effectRef.onSave ?? false,
        }));

        activities[riderId] = {
            _id: riderId,
            type: "save",
            activation: {
                type: "passive",
                value: 1,
                condition: "Trigger after this attack hits.",
                override: false,
            },
            target: foundry.utils.duplicate(activity.target || {
                affects: { type: "creature", count: "1", choice: false },
                prompt: true,
                override: false,
            }),
            range: foundry.utils.duplicate(activity.range || { units: "ft", override: false }),
            save: {
                ability: [hints.saveAbility],
                dc: {
                    calculation: "flat",
                    formula: String(hints.saveDc),
                },
            },
            damage: { parts: [], onSave: "none" },
            effects: riderEffects,
            duration: { units: "inst", concentration: false, override: false },
            description: {
                value: "Save rider for this attack's conditional effect.",
            },
            sort: Number.isFinite(activity.sort) ? activity.sort + 1 : 1,
        };

        // Keep hit resolution on attack; move save-gated effects to rider.
        activity.effects = [];
    }

    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        activity.effects = Array.isArray(activity.effects) ? activity.effects : [];
        const description = activity.description?.value || fallbackDescription;
        const { hints } = validateActivityAutomation(activity, cloned, fallbackDescription, activities);
        const templateType = String(activity?.target?.template?.type || "").toLowerCase();
        const activityType = String(activity?.type || "").toLowerCase();
        const attackHasSaveCompanion = activityType === "attack"
            && hints.hasSaveLanguage
            && hasCompanionSaveActivity(activity, activities, fallbackDescription);

        // Compatibility cleanup: some outputs put area length in template.width.
        if (AREA_TEMPLATE_TYPES.has(templateType) && !activity?.target?.template?.size && activity?.target?.template?.width) {
            activity.target.template.size = String(activity.target.template.width);
        }

        // Safe repair: infer explicit save data when both DC and ability are present in prose.
        if (!activity.save && hints.saveAbility && Number.isFinite(hints.saveDc) && !attackHasSaveCompanion) {
            activity.save = {
                ability: [hints.saveAbility],
                dc: {
                    calculation: "flat",
                    formula: String(hints.saveDc),
                },
            };
            if (!activity.type || activity.type === "utility") {
                activity.type = "save";
            }
        }

        // Safe repair: keep save-driven features on save activity type.
        if (activity.save && (activity.type === "damage" || activity.type === "utility")) {
            activity.type = "save";
        }

        // Safe repair: fill in obvious area template geometry from prose.
        if (hints.templateType || hints.templateSize) {
            activity.target = activity.target || {};
            activity.target.template = activity.target.template || {};
            if (hints.templateType && !activity.target.template.type) {
                activity.target.template.type = hints.templateType;
            }
            if (!activity.target.template.size && activity.target.template.width) {
                activity.target.template.size = String(activity.target.template.width);
            }
            if (hints.templateSize && (!activity.target.template.size || String(activity.target.template.size).trim() === "")) {
                activity.target.template.size = String(hints.templateSize);
            }
            if (!activity.target.template.units) {
                activity.target.template.units = activity.range?.units || "ft";
            }
        }

        // Safe repair: if save + damage exists but onSave is missing/mismatched, infer from prose.
        if (activity.save && activity.damage) {
            if (!activity.damage.onSave) {
                activity.damage.onSave = hints.saveOnSuccess || "none";
            } else if (hints.saveOnSuccess && activity.damage.onSave !== hints.saveOnSuccess) {
                activity.damage.onSave = hints.saveOnSuccess;
            }
        }

        // Safe repair: encode obvious X/day patterns.
        if (hints.uses && (!activity.uses || !activity.uses.max || String(activity.uses.max).trim() === "")) {
            activity.uses = activity.uses || { spent: 0, max: "", recovery: [] };
            activity.uses.max = hints.uses.max;
            activity.uses.recovery = Array.isArray(activity.uses.recovery) ? activity.uses.recovery : [];
            if (!activity.uses.recovery.some((r) => r?.period === hints.uses.period)) {
                activity.uses.recovery.push({ period: hints.uses.period, type: "recoverAll" });
            }
            activity.consumption = activity.consumption || { targets: [] };
            activity.consumption.targets = Array.isArray(activity.consumption.targets) ? activity.consumption.targets : [];
            if (!activity.consumption.targets.some((target) => target?.type === "activityUses")) {
                activity.consumption.targets.push({ type: "activityUses", value: "1" });
            }
        }

        // Safe repair: map condition keywords to item effects and reference them.
        if (hints.statuses.length > 0) {
            const effectStatusSet = getEffectStatusSet(cloned);
            for (const status of hints.statuses) {
                if (attackHasSaveCompanion) continue;
                if (!effectStatusSet.has(status) || !activity.effects.some((effectRef) => {
                    const effect = (cloned.effects || []).find((e) => e._id === effectRef._id);
                    return (effect?.statuses || []).includes(status);
                })) {
                    const effect = getOrCreateEffectForStatus(cloned, status);
                    const linkKey = `${activityId}:${effect._id}`;
                    if (!seenEffectLinks.has(linkKey)) {
                        activity.effects.push({ _id: effect._id, onSave: false });
                        seenEffectLinks.add(linkKey);
                    }
                }
            }
        }

        // Cleanup: drop effect refs that are still invalid after repair.
        const validEffectIds = new Set((cloned.effects || []).map((effect) => effect._id));
        activity.effects = activity.effects.filter((effectRef) => effectRef?._id && validEffectIds.has(effectRef._id));

        // Re-evaluate and keep only unresolved issues as warnings.
        const after = validateActivityAutomation(activity, cloned, description, activities);
        for (const issue of after.issues) {
            warnings.push(`${cloned.name || "Unknown Item"} [${activityId}]: ${issue}`);
        }
    }

    if (warnings.length > 0) {
        cloned.flags["vibe-combat"].automationWarnings = warnings;
        console.warn("Vibe Combat | Automation warnings:", warnings);
    } else {
        cloned.flags["vibe-combat"].automationWarnings = [];
    }

    return { item: cloned, warnings };
}

/**
 * Collect unresolved automation issues for one item without mutating input.
 * @param {object} item
 * @returns {string[]}
 */
export function collectItemAutomationIssues(item) {
    const cloned = foundry.utils.duplicate(item);
    const activities = foundry.utils.getProperty(cloned, "system.activities") || {};
    const fallbackDescription = cloned.system?.description?.value || "";
    const issues = [];

    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        const result = validateActivityAutomation(activity, cloned, fallbackDescription, activities);
        for (const issue of result.issues) {
            issues.push(`${cloned.name || "Unknown Item"} [${activityId}]: ${issue}`);
        }
    }

    return issues;
}
