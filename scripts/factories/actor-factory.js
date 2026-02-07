/**
 * Actor Factory
 * Handles creation and normalization of Actor data and items
 */

import { htmlToPlainText, paragraphsFromText, replaceNamesWithUuids, escapeRegExp, stripAbilityLabel } from "../utils/text-utils.js";

export function ensureValidId(value) {
    const sanitized = (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (sanitized.length === 16) return sanitized;
    return foundry.utils.randomID(16).toLowerCase();
}

export function ensureItemHasId(item) {
    item._id = ensureValidId(item._id);
}

export function ensureItemHasImage(item) {
    if (item.img && item.img !== "" && !item.img.toLowerCase().includes("placeholder")) {
        return;
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

export function autoEquipIfArmor(item) {
    if (item.type !== "equipment") return;
    const armorValue = item.system?.armor?.value;
    const isShield = item.system?.type?.value === "shield";
    if (armorValue || isShield) {
        foundry.utils.setProperty(item, "system.equipped", true);
    }
}

export function sanitizeCustomItem(item) {
    const cloned = foundry.utils.duplicate(item);
    ensureItemHasId(cloned);
    ensureItemHasImage(cloned);
    ensureActivityIds(cloned);
    return cloned;
}

export async function createContainerFeats(actor, multiattackText, spellcastingText) {
    if (!multiattackText && !spellcastingText) {
        return;
    }

    if (!actor || !actor.items) {
        console.warn("Vibe Combat | createContainerFeats called with invalid actor:", actor);
        return;
    }

    const itemsToRemove = actor.items
        .filter((item) => {
            const name = item.name?.toLowerCase();
            return name === "multiattack" || name === "spellcasting";
        })
        .map((item) => item.id);

    if (itemsToRemove.length > 0) {
        await actor.deleteEmbeddedDocuments("Item", itemsToRemove);
    }

    const itemsToCreate = [];

    if (multiattackText) {
        const rawText = stripAbilityLabel(htmlToPlainText(multiattackText), "multiattack");
        const linkedText = replaceNamesWithUuids(rawText, getAttackReferenceItems(actor));
        itemsToCreate.push({
            name: "Multiattack",
            type: "feat",
            img: "icons/skills/melee/strike-weapons-orange.webp",
            system: {
                description: { value: paragraphsFromText(linkedText) },
                type: { value: "monster" }
            }
        });
    }

    if (spellcastingText) {
        const rawText = stripAbilityLabel(htmlToPlainText(spellcastingText), "spellcasting");
        const linkedText = replaceNamesWithUuids(rawText, getSpellReferenceItems(actor));
        itemsToCreate.push({
            name: "Spellcasting",
            type: "feat",
            img: "icons/magic/symbols/circled-gem-pink.webp",
            system: {
                description: { value: paragraphsFromText(linkedText) },
                type: { value: "monster" }
            }
        });
    }

    if (itemsToCreate.length > 0) {
        await actor.createEmbeddedDocuments("Item", itemsToCreate);
        console.log(`Vibe Combat | Added ${itemsToCreate.length} container feats to ${actor.name}.`);
    }
}

function getAttackReferenceItems(actor) {
    return actor.items.filter(
        (item) =>
            item.type === "weapon" ||
            (item.type === "feat" && itemHasOffensiveActivity(item))
    );
}

function getSpellReferenceItems(actor) {
    return actor.items.filter((item) => item.type === "spell");
}

function itemHasOffensiveActivity(item) {
    const activities = item.system?.activities;
    if (!activities) return false;
    return Object.values(activities).some((activity) =>
        ["attack", "save"].includes(activity?.type)
    );
}
