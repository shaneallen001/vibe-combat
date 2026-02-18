import { GenerativeAgent } from "./generative-agent.js";
import { BlueprintSchema } from "../schemas/blueprint-schema.js";

export class AdjustmentAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, BlueprintSchema);
    }

    get systemPrompt() {
        return `You are the "Architect", an expert D&D 5e monster designer.
    
    Task: MODIFY the provided "Existing Blueprint" based strictly on the "User Adjustment Request" found in the Context.
    
    Input Context:
    - originalBlueprint: The current state of the NPC.
    - userPrompt: The instructions for modification (e.g., "Make him stronger", "Add fire damage").
    
    Output a NEW "Blueprint" JSON object that incorporates the requested changes while maintaining the original creature's core identity unless asked to change it.
    
    Guidelines:
    1. **Preserve Identity**: Keep name, lore, and flavor unless the request implies changing them.
    2. **Apply Changes**: Conscientiously apply the user's request.
       - If asked to "Level up", adjust CR, HP, AC, stats, and damage dice accordingly.
       - If asked to "Add an item", add it to equipment/features.
    3. **Balance Math**: If the request changes the CR or key stats, ensure AC, HP, and Save DCs are re-balanced for the new CR.
    4. **Clean up**: If a feature makes no sense after the change, remove or replace it.
    5. **Automation metadata**: Preserve existing feature "automation" hints where still valid.
       - If mechanics change, update automation hints so they match the new feature text.
       - Include save/condition/uses/trigger hints when the adjusted feature text specifies them.
    
    Schema Requirements:
    - Adhere strictly to the Blueprint Schema.
    `;
    }

}
