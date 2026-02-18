import { z } from "../libs/zod.js";

const DurationHintSchema = z.object({
    value: z.number().int().min(0).optional(),
    units: z.enum(["inst", "turn", "round", "minute", "hour", "day"]).optional(),
    concentration: z.boolean().optional(),
});

const UsesHintSchema = z.object({
    max: z.string().optional().describe("Limited uses expression like '1' or '@prof'."),
    recovery: z.array(z.object({
        period: z.string(),
        type: z.string(),
        formula: z.string().optional(),
    })).optional(),
    spend: z.number().int().min(1).optional().describe("How many uses are consumed per activation."),
});

const SaveHintSchema = z.object({
    ability: z.array(z.enum(["str", "dex", "con", "int", "wis", "cha"])).optional(),
    dc: z.object({
        calculation: z.string().default("flat"),
        formula: z.string().optional(),
    }).optional(),
    onSave: z.enum(["none", "half", "full"]).optional().describe("Damage behavior on successful save."),
});

const ConditionHintSchema = z.object({
    statuses: z.array(z.string()).default([]).describe("dnd5e status ids such as 'charmed' or 'poisoned'."),
    onSave: z.boolean().optional().describe("If true, condition only applies when target fails save."),
});

const FeatureAutomationSchema = z.object({
    resolution: z.enum(["attack", "save", "damage", "utility"]).optional(),
    secondaryResolution: z.enum(["attack", "save", "damage", "utility"]).optional().describe("Companion resolution when the feature should be represented by multiple activities."),
    splitActivities: z.boolean().optional().describe("If true, implement as multiple linked activities instead of a single all-in-one activity."),
    activationType: z.enum(["action", "bonus", "reaction", "special", "passive"]).optional(),
    save: SaveHintSchema.optional(),
    condition: ConditionHintSchema.optional(),
    duration: DurationHintSchema.optional(),
    range: z.object({
        value: z.number().min(0).optional(),
        units: z.string().optional(),
    }).optional(),
    target: z.object({
        type: z.string().optional(),
        count: z.string().optional(),
        templateType: z.string().optional(),
        templateSize: z.string().optional(),
        units: z.string().optional(),
    }).optional(),
    uses: UsesHintSchema.optional(),
    trigger: z.object({
        type: z.enum(["manual", "when-hit", "start-turn", "end-turn", "other"]).optional(),
        text: z.string().optional(),
    }).optional(),
    rider: z.object({
        trigger: z.enum(["on-hit", "manual", "passive", "other"]).optional(),
        save: SaveHintSchema.optional(),
        condition: ConditionHintSchema.optional(),
        duration: DurationHintSchema.optional(),
        notes: z.string().optional(),
    }).optional().describe("Optional companion rider mechanic for split features, such as attack hit plus save-gated condition."),
}).optional().describe("Optional structured hints used to preserve feature automation intent across pipeline stages.");

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
        automation: FeatureAutomationSchema,
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
