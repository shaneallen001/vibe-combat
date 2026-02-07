import { GenerativeAgent } from "./generative-agent.js";
import { GeminiItemListSchema } from "../schemas/foundry-item-schema.js";

export class BlacksmithAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, GeminiItemListSchema);
    }

    get systemPrompt() {
        return `You are the "Blacksmith".
    
    Task: Generate valid Foundry VTT Item Data for the requested custom features.
    
    Output a JSON ARRAY of Item objects.
    
    CRITICAL RULES:
    - Follow the D&D 5e data model for Foundry VTT v4.0+.
    - Use "system.activities" for damage and attacks.
    - Ensure "_id"s are unique 16-char strings.
    - Do NOT generate "system.activation" at the root level; put it in the activity.
    `;
    }

    /**
     * Override generate to sanitize IDs and convert Array activities to Map (Record)
     */
    async generate(context) {
        // 1. Generate items with Array-based activities (easier for AI)
        const items = await super.generate(context);

        // 2. Sanitize and convert
        return items.map(item => {
            // Always regenerate item _id with valid 16-char alphanumeric
            item._id = foundry.utils.randomID(16);

            // Convert activities Array -> Object Map and sanitize activity IDs
            if (item.system?.activities && Array.isArray(item.system.activities)) {
                const activityMap = {};
                item.system.activities.forEach(activity => {
                    // Always regenerate activity _id with valid 16-char alphanumeric
                    activity._id = foundry.utils.randomID(16);
                    activityMap[activity._id] = activity;
                });
                item.system.activities = activityMap;
            }
            return item;
        });
    }

}
