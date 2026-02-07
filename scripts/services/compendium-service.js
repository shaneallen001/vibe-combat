/**
 * Compendium Service
 * Handles looking up items in system compendiums
 */

import { autoEquipIfArmor, ensureItemHasImage, ensureActivityIds, sanitizeCustomItem, ensureItemHasId } from "../factories/actor-factory.js";

const COMPENDIUM_MAP = {
    "dnd5e.spells": ["spell"],
    "dnd5e.items": ["weapon", "equipment", "consumable", "tool", "loot", "backpack", "feat"],
    "dnd5e.monsterfeatures": ["feat"],
    "dnd5e.classfeatures": ["feat"]
};

let _indexCache = null;

/**
 * Initialize the compendium index
 */
export async function initializeIndex() {
    if (_indexCache) return _indexCache;
    _indexCache = [];

    console.log("Vibe Combat | Initializing Compendium Index...");

    for (const [packId, allowedTypes] of Object.entries(COMPENDIUM_MAP)) {
        const pack = game.packs.get(packId);
        if (!pack) {
            console.warn(`Vibe Combat | Compendium pack not found: ${packId}`);
            continue;
        }

        // We need name and type. Description is too heavy for a full index, 
        // but we might fetch it on demand or for specific searches.
        const index = await pack.getIndex({ fields: ["name", "type", "img"] });

        for (const entry of index) {
            if (allowedTypes.includes(entry.type)) {
                _indexCache.push({
                    uuid: entry.uuid,
                    name: entry.name,
                    type: entry.type,
                    img: entry.img,
                    pack: packId,
                    _id: entry._id
                });
            }
        }
    }

    console.log(`Vibe Combat | Indexed ${_indexCache.length} compendium items.`);
    return _indexCache;
}

/**
 * Search for items in the index
 * @param {string} query - The search query (name)
 * @param {string[]} types - Optional list of item types to filter by
 * @returns {Array} - List of matching items
 */
export async function search(query, types = []) {
    if (!_indexCache) await initializeIndex();
    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();

    // 1. Exact match
    const exactMatches = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase() === lowerQuery;
    });

    if (exactMatches.length > 0) return exactMatches;

    // 2. Starts with
    const startsWith = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase().startsWith(lowerQuery);
    });

    if (startsWith.length > 0) return startsWith;

    // 3. Includes
    const includes = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase().includes(lowerQuery);
    });

    if (includes.length > 0) return includes;

    // 4. Reverse Includes (Query includes Item Name)
    // Useful if the AI generated "Fireball (3rd Level)" but the item is "Fireball"
    const reverseIncludes = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return lowerQuery.includes(item.name.toLowerCase());
    });

    if (reverseIncludes.length > 0) {
        // Sort by length descending to match the most specific item (e.g. "Fireball" over "Fire")
        return reverseIncludes.sort((a, b) => b.name.length - a.name.length);
    }

    return [];
}

/**
 * Get all items of a specific type from the index
 * @param {string} type - The item type (e.g., "spell", "weapon")
 * @returns {Array} - List of items
 */
export async function getAll(type) {
    if (!_indexCache) await initializeIndex();
    return _indexCache.filter(item => item.type === type);
}

/**
 * Retrieve the full data for a specific index entry
 * @param {object} indexEntry 
 */
export async function getItemData(indexEntry) {
    if (!indexEntry || !indexEntry.pack || !indexEntry._id) return null;
    const pack = game.packs.get(indexEntry.pack);
    if (!pack) return null;
    const doc = await pack.getDocument(indexEntry._id);
    return doc ? doc.toObject() : null;
}

// --- Legacy/Helper Methods (kept for compatibility or specific logic) ---

export async function buildCompendiumBackedItems(aiItems = []) {
    const resolvedItems = [];
    let multiattackText = "";
    let spellcastingText = "";
    let reusedCount = 0;
    let customCount = 0;

    // Ensure index is ready
    await initializeIndex();

    for (const rawItem of aiItems) {
        if (!rawItem || typeof rawItem !== "object") continue;
        const name = rawItem.name?.trim();
        if (!name) continue;

        const lowerName = name.toLowerCase();
        const description = foundry.utils.getProperty(rawItem, "system.description.value") ?? "";

        if (lowerName.includes("multiattack")) {
            if (!multiattackText) {
                multiattackText = description || name;
            }
            continue;
        }

        if (lowerName.includes("spellcasting")) {
            if (!spellcastingText) {
                spellcastingText = description || name;
            }
            continue;
        }

        // Try to find an existing item
        const matches = await search(name, [rawItem.type]);
        const bestMatch = matches.length > 0 ? matches[0] : null;

        if (bestMatch) {
            const compendiumItem = await getItemData(bestMatch);
            if (compendiumItem) {
                autoEquipIfArmor(compendiumItem);
                await ensureItemHasImage(compendiumItem);
                ensureActivityIds(compendiumItem);
                resolvedItems.push(compendiumItem);
                reusedCount++;
                continue;
            }
        }

        const customItem = await sanitizeCustomItem(rawItem);
        autoEquipIfArmor(customItem);
        ensureActivityIds(customItem);
        resolvedItems.push(customItem);
        customCount++;
    }

    console.log(`Vibe Combat | Compendium item prep reused ${reusedCount} entries, created ${customCount} custom items.`);
    return { resolvedItems, multiattackText, spellcastingText, reusedCount, customCount };
}

export async function findCompendiumEntry(itemData) {
    const matches = await search(itemData.name, [itemData.type]);
    if (matches.length > 0) {
        return getItemData(matches[0]);
    }
    return null;
}
