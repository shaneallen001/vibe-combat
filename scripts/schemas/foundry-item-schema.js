import { z } from "../libs/zod.js";

const DamagePartSchema = z.object({
    number: z.number().int().min(0),
    denomination: z.number().int(),
    types: z.array(z.string()),
    bonus: z.string().optional(),
});

const ActivityUsesSchema = z.object({
    spent: z.number().default(0),
    max: z.string().default(""),
    recovery: z.array(z.object({
        period: z.string(),
        type: z.string(),
        formula: z.string().optional(),
    })).default([]),
});

const ActivityConsumptionTargetSchema = z.object({
    type: z.string().default("activityUses"),
    target: z.string().optional(),
    value: z.string().optional(),
    scaling: z.object({
        mode: z.string().optional(),
        formula: z.string().optional(),
    }).optional(),
});

const ActivitySaveSchema = z.object({
    ability: z.array(z.string()).default([]),
    dc: z.object({
        calculation: z.string().default("flat"),
        formula: z.string().optional(),
    }).default({ calculation: "flat" }),
});

const ActivityEffectReferenceSchema = z.object({
    _id: z.string().min(1),
    onSave: z.boolean().optional(),
});

const ItemActiveEffectSchema = z.object({
    _id: z.string().min(1).default(""),
    name: z.string().default(""),
    transfer: z.boolean().default(false),
    statuses: z.array(z.string()).default([]),
    duration: z.object({
        seconds: z.number().optional(),
        rounds: z.number().optional(),
        turns: z.number().optional(),
        startTime: z.number().optional(),
        startRound: z.number().optional(),
        startTurn: z.number().optional(),
    }).optional(),
    changes: z.array(z.object({
        key: z.string(),
        mode: z.number().optional(),
        value: z.string().optional(),
    })).optional().default([]),
    disabled: z.boolean().optional(),
    flags: z.record(z.any()).optional(),
});

const ActivitySchema = z.object({
    _id: z.string().min(1).default(""), // Relaxed; will be sanitized to 16-char alphanumeric post-generation
    type: z.enum(["attack", "save", "utility", "heal", "damage", "enchant", "summon"]),
    activation: z.object({
        type: z.string().default("action"),
        value: z.number().nullable().default(1),
        condition: z.string().optional(),
        override: z.boolean().optional(),
    }).optional(),
    attack: z.object({
        flat: z.boolean().default(true),
        bonus: z.string().default("0"),
        ability: z.string().optional(), // New in v4, sometimes needed
    }).optional(),
    damage: z.object({
        parts: z.array(DamagePartSchema).default([]),
        onSave: z.string().optional(),
    }).optional(),
    save: ActivitySaveSchema.optional(),
    range: z.object({
        value: z.string().optional(),
        long: z.string().optional(),
        units: z.string().default("ft"),
        override: z.boolean().optional(),
    }).optional(),
    target: z.object({
        affects: z.object({
            type: z.string().optional(),
            count: z.string().optional(),
            choice: z.boolean().optional(),
            special: z.string().optional(),
        }).optional(),
        template: z.object({
            count: z.string().optional(),
            contiguous: z.boolean().default(false),
            type: z.string().optional(),
            size: z.string().optional(),
            width: z.string().optional(),
            height: z.string().optional(),
            units: z.string().default("ft"),
        }).optional(),
        override: z.boolean().optional(),
        prompt: z.boolean().optional(),
    }).optional(),
    duration: z.object({
        value: z.string().optional(),
        units: z.string().optional(),
        concentration: z.boolean().optional(),
        special: z.string().optional(),
        override: z.boolean().optional(),
    }).optional(),
    effects: z.array(ActivityEffectReferenceSchema).default([]),
    uses: ActivityUsesSchema.optional(),
    consumption: z.object({
        spellSlot: z.boolean().optional(),
        targets: z.array(ActivityConsumptionTargetSchema).default([]),
    }).optional(),
    roll: z.object({
        formula: z.string().optional(),
        prompt: z.boolean().optional(),
        visible: z.boolean().optional(),
    }).optional(),
    description: z.object({
        value: z.string().optional(),
        chat: z.string().optional(),
    }).optional(),
});

export const FoundryItemSchema = z.object({
    name: z.string(),
    type: z.enum(["weapon", "feat", "spell", "equipment", "consumable"]),
    _id: z.string().min(1).default(""), // Relaxed; will be sanitized to 16-char alphanumeric post-generation
    img: z.string().default("icons/svg/mystery-man.svg"),
    system: z.object({
        description: z.object({
            value: z.string().default(""),
        }),
        activities: z.record(ActivitySchema).default({}),
        // Common fields for spells/weapons
        level: z.number().min(0).optional(), // For spells/feats (no max; feats can reference higher spellcaster levels)
        school: z.string().optional(), // For spells
        quantity: z.number().default(1),
        weight: z.number().default(0),
        price: z.object({ value: z.number().default(0), denomination: z.string().default("gp") }).optional(),
        rarity: z.string().default("common"),
        uses: z.object({
            spent: z.number().default(0),
            max: z.string().default(""),
            recovery: z.array(z.object({ period: z.string(), type: z.string(), formula: z.string().optional() })).default([])
        }).optional()
    }),
    effects: z.array(ItemActiveEffectSchema).default([]),
    flags: z.record(z.any()).optional(),
});

export const FoundryItemListSchema = z.array(FoundryItemSchema);

// Schema for Gemini generation (uses Array for activities)
const GeminiItemSchema = FoundryItemSchema.extend({
    system: FoundryItemSchema.shape.system.extend({
        activities: z.array(ActivitySchema).default([])
    })
});

export const GeminiItemListSchema = z.array(GeminiItemSchema);
