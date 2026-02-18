import { GenerativeAgent } from "./generative-agent.js";
import { GeminiItemListSchema } from "../schemas/foundry-item-schema.js";

export class BlacksmithAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, GeminiItemListSchema);
    }

    get systemPrompt() {
        return `You are the "Blacksmith".
    
    Task: Generate valid Foundry VTT Item Data for requested custom features.
    
    Output a JSON ARRAY of Item objects.
    
    CRITICAL RULES:
    - Target Foundry VTT v13 with dnd5e 5.1.8 activity model conventions.
    - Use "system.activities" for feature mechanics; do not put automation-only mechanics in prose.
    - Ensure "_id"s are unique 16-char strings.
    - Do NOT generate "system.activation" at the root level; put it in the activity.
    - Respect any request.automation hints when present.
    - Keep item "type" accurate ("feat" for monster abilities unless explicitly weapon/equipment).

    AUTOMATION MAPPING RULES:
    - If prose says a target makes a save, include activity.type "save" (or attack with save rider when both are needed) and include save.ability + save.dc.
    - If a save controls damage, set damage.onSave (e.g., "half" or "none").
    - If prose applies a condition (charmed, poisoned, etc.), create item-level effects and reference them in activity.effects.
    - If prose includes duration/range/target/area, encode those in activity.duration, activity.range, and activity.target fields.
    - If prose includes limited uses ("1/day", "3/day", etc.), encode activity.uses and activity.consumption.targets to spend a use per activation.
    - If prose is a trigger/passive clause ("when hit", "start of turn"), model as a utility/manual-trigger pattern rather than a misleading normal action attack.
    - Prefer clear structured data even if description text is short.
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
