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
    - Treat request.automation as authoritative intent metadata when provided.
    - Keep item "type" accurate ("feat" for monster abilities unless explicitly weapon/equipment).

    AUTOMATION MAPPING RULES:
    - If prose says a target makes a save, include activity.type "save" and include save.ability + save.dc.
    - If request.automation.splitActivities is true with request.automation.secondaryResolution "save", generate split activities accordingly.
    - If request.automation.rider is present, encode rider mechanics in a companion activity rather than burying rider logic in attack prose.
    - If prose has BOTH "attack roll to hit" and "target then makes a save" (save-gated rider), model it as two activities:
      1) attack activity for hit/damage,
      2) separate save rider activity (usually passive/manual-trigger) for the conditional rider.
      Do NOT leave the save branch only in attack description text.
    - If a save controls damage, set damage.onSave (e.g., "half" or "none").
    - If prose specifies an area template (cone/line/sphere/cylinder/cube), include target.template.type AND target.template.size.
    - If prose applies a condition (charmed, poisoned, etc.), create item-level effects and reference them in activity.effects.
    - If prose includes duration/range/target/area, encode those in activity.duration, activity.range, and activity.target fields.
    - If prose includes limited uses ("1/day", "3/day", etc.), encode activity.uses and activity.consumption.targets to spend a use per activation.
    - If prose is a trigger/passive clause ("when hit", "start of turn"), model as a utility/manual-trigger pattern rather than a misleading normal action attack.
    - Prefer clear structured data even if description text is short.
    - Never output save prose as activity.type "damage" only. Save mechanics must be machine-readable in activity.save.
    - Do not attach save-gated condition effects directly to attack-only activities unless a separate save activity exists for that rider.
    - If a feature offers multiple mutually exclusive options (e.g., "choose one: Mustard/Ketchup/Relish"), do NOT attach all option effects to one save activity.
      - Use a parent utility selector/roller activity, and one child save activity per option.
      - Each option activity should link only the effect(s) for that option.

    REQUIRED PATTERNS:
    - "Each creature in a 60-foot cone must make a DC 16 Dex save; fail takes 4d6 acid and is blinded; success half and not blinded":
      - activity.type = "save"
      - target.template = { type: "cone", size: "60", units: "ft" }
      - save = { ability: ["dex"], dc: { calculation: "flat", formula: "16" } }
      - damage.onSave = "half"
      - activity.effects links blinded effect with onSave false
    - "Target must make a Con save or be paralyzed for 1 minute":
      - activity.type = "save"
      - include save object, duration, and linked paralyzed effect
    - "Ranged Weapon Attack ... Hit: damage, and target must succeed on a DC 14 save or be poisoned":
      - Create attack activity for hit/damage
      - Create separate save rider activity with save object + linked poisoned effect (onSave false)
      - Keep rider uses/consumption consistent with feature intent; avoid double-consuming uses
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
