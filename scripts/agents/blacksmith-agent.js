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
     * Override generate to convert Array activities back to Map (Record)
     */
    async generate(context) {
        // 1. Generate items with Array-based activities (easier for AI)
        const items = await super.generate(context);

        // 2. Convert Activities Array -> Object Map
        return items.map(item => {
            if (item.system?.activities && Array.isArray(item.system.activities)) {
                const activityMap = {};
                item.system.activities.forEach(activity => {
                    // Ensure ID
                    if (!activity._id) activity._id = foundry.utils.randomID(16);
                    activityMap[activity._id] = activity;
                });
                item.system.activities = activityMap;
            }
            return item;
        });
    }
}
