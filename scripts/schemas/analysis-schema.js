import { z } from "../libs/zod.js";

const AutomationHintSchema = z.object({
    resolution: z.enum(["attack", "save", "damage", "utility"]).optional(),
    activationType: z.enum(["action", "bonus", "reaction", "special", "passive"]).optional(),
    save: z.object({
        ability: z.array(z.enum(["str", "dex", "con", "int", "wis", "cha"])).optional(),
        dc: z.object({
            calculation: z.string().default("flat"),
            formula: z.string().optional(),
        }).optional(),
        onSave: z.enum(["none", "half", "full"]).optional(),
    }).optional(),
    condition: z.object({
        statuses: z.array(z.string()).default([]),
        onSave: z.boolean().optional(),
    }).optional(),
    duration: z.object({
        value: z.number().int().min(0).optional(),
        units: z.enum(["inst", "turn", "round", "minute", "hour", "day"]).optional(),
        concentration: z.boolean().optional(),
    }).optional(),
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
    uses: z.object({
        max: z.string().optional(),
        recovery: z.array(z.object({
            period: z.string(),
            type: z.string(),
            formula: z.string().optional(),
        })).optional(),
        spend: z.number().int().min(1).optional(),
    }).optional(),
    trigger: z.object({
        type: z.enum(["manual", "when-hit", "start-turn", "end-turn", "other"]).optional(),
        text: z.string().optional(),
    }).optional(),
}).optional();

export const AnalysisSchema = z.object({
    selectedUuids: z.array(z.string()).describe("List of UUIDs of existing Compendium items to use directly."),
    customRequests: z.array(z.object({
        name: z.string(),
        description: z.string().describe("A full, rich description of the feature or item."),
        type: z.enum(["weapon", "feat", "spell", "equipment"]),
        automation: AutomationHintSchema.describe("Optional automation hints forwarded from blueprint analysis."),
    })).describe("List of features that require custom generation."),
});
