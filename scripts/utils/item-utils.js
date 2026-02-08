/**
 * Item Utilities
 * Helper functions for validating and normalizing Foundry VTT items
 */

import { validateImagePath } from "./file-utils.js";

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
    return cloned;
}
