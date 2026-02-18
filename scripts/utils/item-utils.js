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

    const statuses = CONDITION_STATUSES.filter((status) => normalized.includes(status));
    const saveAbilityRaw = dcSaveMatch?.[2] || saveAbilityMatch?.[1];
    const saveAbility = saveAbilityRaw ? ABILITY_ALIASES[saveAbilityRaw] : undefined;
    const saveDc = dcSaveMatch ? Number(dcSaveMatch[1]) : undefined;

    return {
        hasSaveLanguage: /saving throw|\bsave\b|must succeed on|must make/i.test(normalized),
        hasConditionLanguage: statuses.length > 0,
        statuses,
        saveAbility,
        saveDc,
        hasDamageLanguage: /damage|takes/i.test(normalized),
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
    return foundry.utils.randomID(16).toLowerCase();
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

/**
 * Validate one activity for automation completeness.
 * @param {object} activity
 * @param {object} item
 * @param {string} fallbackDescription
 * @returns {{issues: string[], hints: object}}
 */
export function validateActivityAutomation(activity, item, fallbackDescription = "") {
    const description = `${fallbackDescription || ""} ${activity?.description?.value || ""}`.trim();
    const hints = extractHints(description);
    const issues = [];
    const activityEffects = Array.isArray(activity?.effects) ? activity.effects : [];
    const itemEffectIds = new Set((item.effects || []).map((effect) => effect._id));

    if (activity?.type === "save" && !activity?.save) {
        issues.push("Activity type is save but save data is missing.");
    }

    if (hints.hasSaveLanguage && !activity?.save) {
        issues.push("Description implies saving throw but activity.save is missing.");
    }

    if (hints.hasConditionLanguage && activityEffects.length === 0) {
        issues.push("Description implies condition but activity.effects is empty.");
    }

    if (hints.uses && (!activity?.uses?.max || String(activity.uses.max).trim() === "")) {
        issues.push("Description implies limited uses but activity.uses.max is missing.");
    }

    if (activity?.save && activity?.damage && !activity?.damage?.onSave) {
        issues.push("Save + damage activity is missing damage.onSave.");
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

    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity || typeof activity !== "object") continue;
        activity.effects = Array.isArray(activity.effects) ? activity.effects : [];
        const description = activity.description?.value || fallbackDescription;
        const { hints } = validateActivityAutomation(activity, cloned, fallbackDescription);

        // Safe repair: infer explicit save data when both DC and ability are present in prose.
        if (!activity.save && hints.saveAbility && Number.isFinite(hints.saveDc)) {
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

        // Safe repair: if save + damage exists but onSave missing, default to none.
        if (activity.save && activity.damage && !activity.damage.onSave) {
            activity.damage.onSave = "none";
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
        const after = validateActivityAutomation(activity, cloned, description);
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
        const result = validateActivityAutomation(activity, cloned, fallbackDescription);
        for (const issue of result.issues) {
            issues.push(`${cloned.name || "Unknown Item"} [${activityId}]: ${issue}`);
        }
    }

    return issues;
}
