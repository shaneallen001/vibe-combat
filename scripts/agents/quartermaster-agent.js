import { GenerativeAgent } from "./generative-agent.js";
import { AnalysisSchema } from "../schemas/analysis-schema.js";

export class QuartermasterAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, AnalysisSchema);
    }

    get systemPrompt() {
        return `You are the "Quartermaster".
    
    Task: Review the Actor Blueprint and the available Compendium Candidates.
    For each feature in the Blueprint, decide whether to use an existing Compendium item or request a Custom item.
    
    Output a JSON object with "selectedUuids" and "customRequests".
    
    Rules:
    - If a Candidate matches the feature well (name and intent), prefer using its UUID.
    - If no Candidate fits, add the feature to "customRequests".
    - You can also add standard items (like "Longsword") to "customRequests" if they weren't in the candidates but are needed.
    `;
    }
}
