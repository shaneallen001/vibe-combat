import { z } from "../libs/zod.js";

const DamagePartSchema = z.object({
    number: z.number().int().min(0),
    denomination: z.number().int(),
    types: z.array(z.string()),
    bonus: z.string().optional(),
});

const ActivitySchema = z.object({
    _id: z.string().min(1).default(""), // Relaxed; will be sanitized to 16-char alphanumeric post-generation
    type: z.enum(["attack", "save", "utility", "heal", "damage", "enchant", "summon"]),
    activation: z.object({
        type: z.string().default("action"),
        value: z.number().nullable().default(1),
        condition: z.string().optional(),
    }).optional(),
    attack: z.object({
        flat: z.boolean().default(true),
        bonus: z.string().default("0"),
        ability: z.string().optional(), // New in v4, sometimes needed
    }).optional(),
    damage: z.object({
        parts: z.array(DamagePartSchema).default([]),
    }).optional(),
    save: z.object({
        ability: z.array(z.string()),
        dc: z.object({
            calculation: z.string().default("flat"),
            formula: z.string().optional(),
        }),
    }).optional(),
    target: z.object({
        template: z.object({
            count: z.string().optional(),
            contiguous: z.boolean().default(false),
            type: z.string().optional(),
            size: z.string().optional(),
            width: z.string().optional(),
            height: z.string().optional(),
            units: z.string().default("ft"),
        }).optional(),
    }).optional(),
    description: z.object({
        value: z.string().optional(),
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
});

export const FoundryItemListSchema = z.array(FoundryItemSchema);

// Schema for Gemini generation (uses Array for activities)
const GeminiItemSchema = FoundryItemSchema.extend({
    system: FoundryItemSchema.shape.system.extend({
        activities: z.array(ActivitySchema).default([])
    })
});

export const GeminiItemListSchema = z.array(GeminiItemSchema);
