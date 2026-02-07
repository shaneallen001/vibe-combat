import { callGemini, extractJson } from "../services/gemini-service.js";
import { z } from "../libs/zod.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";

export class GenerativeAgent {
    /**
     * @param {string} apiKey 
     * @param {z.ZodSchema} schema 
     */
    constructor(apiKey, schema) {
        this.apiKey = apiKey;
        this.schema = schema;
    }

    /**
     * The system prompt to set the context and persona.
     * @returns {string}
     */
    get systemPrompt() {
        return "You are a helpful AI assistant.";
    }

    /**
     * Generate content based on input, validating against the schema.
     * @param {any} input context for the prompt
     * @param {number} retries Number of self-correction attempts
     * @returns {Promise<any>} Validated output
     */
    async generate(input, retries = 3) {
        // key modification: use structured output by converting zod schema
        const jsonSchema = zodToJsonSchema(this.schema);

        // We can simplify the prompt since we are using structured output, 
        // but keeping context and JSON instruction as backup is good.
        let currentPrompt = `${this.systemPrompt}\n\nTask Context:\n${JSON.stringify(input, null, 2)}`;
        let attempt = 0;
        let lastError = null;

        while (attempt <= retries) {
            try {
                console.log(`Vibe Combat | Agent Generation Attempt ${attempt + 1}/${retries + 1}`);

                // Call Gemini
                const text = await callGemini({
                    apiKey: this.apiKey,
                    prompt: currentPrompt,
                    responseSchema: jsonSchema
                });

                // Extract JSON
                let json = extractJson(text);

                // Auto-correct: If schema is Array but we got an Object, wrap it
                if (this.schema._def.typeName === "ZodArray" && !Array.isArray(json) && typeof json === "object") {
                    console.warn("Vibe Combat | Auto-correcting: Wrapped single object in Array to match schema.");
                    json = [json];
                }

                // Validate
                const result = this.schema.safeParse(json);

                if (result.success) {
                    return result.data;
                } else {
                    // Validation failed
                    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
                    lastError = `Validation Error: ${issues}`;
                    console.warn(`Vibe Combat | ${lastError}`);
                    console.warn("Vibe Combat | Invalid JSON:", JSON.stringify(json, null, 2));

                    // Add error to prompt for correction
                    currentPrompt += `\n\nERROR: Your previous response was invalid. \nIssues: ${issues}\n\nPlease regenerate the JSON to fix these specific errors.`;
                    attempt++;
                }

            } catch (error) {
                console.error("Vibe Combat | Generation Error:", error);
                lastError = error.message;
                attempt++;
                // If it's a network/API error, maybe we shouldn't just append to prompt, but for now we retry.
            }
        }

        throw new Error(`Generative Agent failed after ${retries} retries. Last error: ${lastError}`);
    }
}
