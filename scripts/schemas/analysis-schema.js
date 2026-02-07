import { z } from "../libs/zod.js";

export const AnalysisSchema = z.object({
    selectedUuids: z.array(z.string()).describe("List of UUIDs of existing Compendium items to use directly."),
    customRequests: z.array(z.object({
        name: z.string(),
        description: z.string().describe("A full, rich description of the feature or item."),
        type: z.enum(["weapon", "feat", "spell", "equipment"]),
    })).describe("List of features that require custom generation."),
});
