/**
 * Actor Blueprint Schema
 * Defines the structure for the intermediate "Concept" stage of actor generation.
 */

export const ACTOR_BLUEPRINT_SCHEMA = {
    name: "string",
    cr: "number",
    type: "string",
    alignment: "string",
    stats: {
        ac: "number",
        hp: "number",
        movement: {
            walk: "number",
            fly: "number",
            swim: "number",
            burrow: "number",
            climb: "number",
            hover: "boolean"
        },
        abilities: {
            str: "number",
            dex: "number",
            con: "number",
            int: "number",
            wis: "number",
            cha: "number"
        }
    },
    features: [
        {
            name: "string",
            description: "string",
            type: "string" // "action", "bonus", "reaction", "passive", "legendary"
        }
    ],
    spellcasting: {
        level: "number",
        school: "string",
        ability: "string",
        spells: ["string"] // List of spell names
    },
    behavior: "string",
    appearance: "string",
    twist: "string"
};

/**
 * Validates a blueprint object against the schema (basic check)
 * @param {object} blueprint 
 * @returns {boolean}
 */
export function validateBlueprint(blueprint) {
    if (!blueprint || typeof blueprint !== "object") return false;
    if (typeof blueprint.name !== "string") return false;
    if (typeof blueprint.cr !== "number") return false;
    if (!blueprint.stats || typeof blueprint.stats !== "object") return false;
    return true;
}
