import { z } from "../libs/zod.js";

export const BlueprintSchema = z.object({
    name: z.string().describe("The name of the creature."),
    cr: z.number().describe("The Challenge Rating (CR) of the creature."),
    type: z.string().describe("The creature type (e.g., 'undead', 'beast')."),
    alignment: z.string().describe("The alignment of the creature."),
    stats: z.object({
        ac: z.number(),
        hp: z.number(),
        movement: z.object({
            walk: z.number(),
            fly: z.number().optional().default(0),
            swim: z.number().optional().default(0),
            burrow: z.number().optional().default(0),
            climb: z.number().optional().default(0),
            hover: z.boolean().optional().default(false),
        }),
        abilities: z.object({
            str: z.number(),
            dex: z.number(),
            con: z.number(),
            int: z.number(),
            wis: z.number(),
            cha: z.number(),
        }),
    }),
    saves: z.array(z.string()).describe("List of ability scores with save proficiency (e.g., ['dex', 'con'])."),
    skills: z.array(z.object({
        name: z.string(),
        value: z.number()
    })).describe("List of skills and their modifiers."),
    senses: z.object({
        darkvision: z.number().default(0),
        blindsight: z.number().default(0),
        tremorsense: z.number().default(0),
        truesight: z.number().default(0),
    }),
    languages: z.array(z.string()).default([]),
    resistances: z.array(z.string()).default([]),
    immunities: z.array(z.string()).default([]),
    condition_immunities: z.array(z.string()).default([]),
    equipment: z.array(z.object({
        name: z.string(),
        type: z.enum(["weapon", "armor", "shield", "gear"]),
        description: z.string().optional(),
    })).describe("Weapons, armor, and other equipment the creature carries.").default([]),
    features: z.array(z.object({
        name: z.string(),
        description: z.string(),
        type: z.enum(["action", "bonus", "reaction", "passive", "legendary", "mythic"]),
    })).describe("Special abilities and actions."),
    spellcasting: z.object({
        ability: z.enum(["int", "wis", "cha"]).describe("Spellcasting ability: 'int' for wizards, 'wis' for clerics/druids, 'cha' for sorcerers/warlocks."),
        spells: z.object({
            atWill: z.array(z.string()).default([]).describe("Spells that can be cast at will (unlimited)."),
            perDay: z.array(z.object({
                spell: z.string(),
                uses: z.number().describe("Number of times per day this spell can be cast.")
            })).default([]).describe("Spells with limited daily uses."),
        }),
    }).optional().describe("Spellcasting configuration. Include only if the creature is a spellcaster."),
    behavior: z.string().describe("Combat tactics and behavior."),
    appearance: z.string().describe("Visual description."),
    twist: z.string().describe("A unique or unexpected trait."),
    biography: z.string().describe("Backstory and lore."),
    habitat: z.string().optional(),
    treasure: z.string().optional(),
});
