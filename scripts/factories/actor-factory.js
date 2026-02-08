/**
 * Actor Factory
 * Handles creation and normalization of Actor data and items
 */

import { htmlToPlainText, paragraphsFromText, replaceNamesWithUuids, escapeRegExp, stripAbilityLabel } from "../utils/text-utils.js";
import { ensureValidId, ensureItemHasId, ensureItemHasImage, ensureActivityIds, autoEquipIfArmor, sanitizeCustomItem } from "../utils/item-utils.js";

// Re-export item utilities for backwards compatibility
export { ensureValidId, ensureItemHasId, ensureItemHasImage, ensureActivityIds, autoEquipIfArmor, sanitizeCustomItem };

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
