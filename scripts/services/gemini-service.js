/**
 * Gemini Service
 * Handles interactions with Google's Gemini API
 */

export const GEMINI_MODELS = [
    "gemini-2.5-flash-lite"
];

export const GEMINI_API_VERSIONS = ["v1beta"];

/**
 * Call the Gemini API with fallback for models and versions
 */
/**
 * Call the Gemini API with fallback for models and versions
 */
export async function callGemini({ apiKey, prompt, responseSchema, abortSignal }) {
    let lastError = null;

    for (const apiVersion of GEMINI_API_VERSIONS) {
        for (const model of GEMINI_MODELS) {
            let attempt = 0;
            const maxRetries = 3;

            while (attempt <= maxRetries) {
                try {
                    const requestBody = {
                        contents: [
                            {
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.75,
                            response_mime_type: responseSchema ? "application/json" : "text/plain",
                            ...(responseSchema && { response_schema: responseSchema })
                        }
                    };

                    console.log(`Vibe Combat | Gemini Request (${model}, try ${attempt + 1}):`, JSON.stringify(requestBody, null, 2));

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestBody),
                            signal: abortSignal
                        }
                    );

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error(`Vibe Combat | Gemini Error (${model}):`, JSON.stringify(errorData, null, 2));

                        // Handle Rate Limit (429) & Service Unavailable (503) with Backoff
                        if (response.status === 429 || response.status === 503) {
                            attempt++;
                            if (attempt > maxRetries) {
                                const errorMessage = errorData.error?.message || response.statusText;
                                throw new Error(`Gemini Rate Limit/Unavailable (${model}): ${errorMessage} (Max retries reached)`);
                            }

                            // Calculate delay: Default to exponential backoff (1s, 2s, 4s...)
                            let delay = Math.pow(2, attempt) * 1000;

                            // Check "Retry-After" header? (Gemini returns it mostly on 429)
                            // NOTE: Fetch headers might be iterable or specialized config depending on environment.
                            // Basic check just in case.
                            const retryHeader = response.headers?.get?.("Retry-After");
                            if (retryHeader) {
                                const seconds = parseInt(retryHeader, 10);
                                if (!isNaN(seconds)) delay = seconds * 1000;
                            }

                            console.warn(`Vibe Combat | Rate limit/Unavailable (${response.status}). Retrying in ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue; // Retry loop
                        }

                        // If 404, try next model/version (break retry loop)
                        if (response.status === 404) {
                            break; // Break retry loop, try next model in for(model)
                        }

                        const errorMessage = errorData.error?.message || response.statusText;
                        lastError = `Gemini API error (${apiVersion}/${model}): ${response.status} ${response.statusText}. ${errorMessage}`;
                        console.warn(lastError);
                        break; // Break retry loop, try next model
                    }

                    const data = await response.json();
                    const text =
                        data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ||
                        "";

                    if (!text.trim()) {
                        lastError = "Gemini returned an empty response.";
                        break; // Break retry loop, try next model
                    }
                    return text; // Success!

                } catch (error) {
                    if (error.name === "AbortError") {
                        throw error;
                    }
                    // If we manually threw max retries error
                    if (error.message && error.message.includes("Max retries reached")) {
                        throw error;
                    }

                    // If it's a network error from fetch, try next model/version
                    if (error instanceof TypeError || (error.message && error.message.includes("fetch"))) {
                        lastError = `Network error calling Gemini API (${apiVersion}/${model}): ${error.message}`;
                        console.warn(lastError);
                        break; // Break retry loop, try next model
                    }
                    lastError = error.message || "Gemini request failed.";
                    break; // Break retry loop, try next model
                }
            }
        }
    }

    throw new Error(lastError || "All Gemini models failed. Please check your API key and model availability.");
}

/**
 * Extract JSON from Gemini response text
 */
export function extractJson(text) {
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    const markdownMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (markdownMatch?.[1]) {
        jsonText = markdownMatch[1];
    } else if (jsonText.startsWith("```")) {
        // Fallback: remove first and last lines if they're markdown delimiters
        const lines = jsonText.split("\n");
        if (lines[0].trim().startsWith("```")) {
            lines.shift();
        }
        if (lines[lines.length - 1].trim() === "```") {
            lines.pop();
        }
        jsonText = lines.join("\n");
    }

    // Trim again after markdown removal
    jsonText = jsonText.trim();

    // Detect and extract JSON structure
    const firstBracket = jsonText.indexOf("[");
    const firstBrace = jsonText.indexOf("{");
    const lastBracket = jsonText.lastIndexOf("]");
    const lastBrace = jsonText.lastIndexOf("}");

    // If array bracket comes first, extract array
    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
        if (lastBracket !== -1) {
            jsonText = jsonText.slice(firstBracket, lastBracket + 1);
        }
    } else if (firstBrace !== -1 && lastBrace !== -1) {
        // Extract from first { to last }
        jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        // Attempt auto-fix: If it looks like unwrapped array objects, wrap them
        if (jsonText.startsWith("{") && jsonText.includes("},{")) {
            try {
                const wrappedJson = "[" + jsonText + "]";
                console.warn("Vibe Combat | Auto-fix: Wrapped unwrapped array in brackets.");
                return JSON.parse(wrappedJson);
            } catch (wrapError) {
                // Fall through to original error
            }
        }
        console.error("Vibe Combat | Failed to parse Gemini response:", jsonText);
        throw new Error("Invalid JSON returned from Gemini. Please try again.");
    }
}

if (type) {
    userPrompt += `\nType: ${type}`;
}
if (size) {
    userPrompt += `\nSize: ${size}`;
}

const systemInstruction = `You are an expert D&D 5e monster designer and a Foundry VTT data architect.

Your task is to generate a complete and valid JSON object representing a D&D 5e monster stat block for Foundry VTT, specifically for the "dnd5e" system (v4.0+).

The output MUST be a single, valid JSON object and NOTHING ELSE. Do not include any explanatory text, markdown backticks like \`\`\`json, or any content outside of the JSON structure.

The JSON structure should follow this Foundry VTT Actor data model:

- "name": (string)
- "type": "npc"
- "img": "icons/svg/mystery-man.svg" (placeholder for actor sheet image)
- "system": {
  "abilities": { /* e.g., "str": {"value": 10, "proficient": 0} ... */ },
  "attributes": {
    "ac": { "calc": "default", "flat": null }, /* Use "default" if items provide AC (like armor), "natural" with "flat" value otherwise */
    "hp": { "value": 45, "max": 45, "formula": "6d8+18" }, /* Adjust HP based on CR */
    "movement": { "walk": 30, "units": "ft" },
    "senses": { "darkvision": 60, "units": "ft" }
  },
  "details": { "cr": 3, "alignment": "Chaotic Evil", "type": { "value": "undead", "subtype": "clown" }, "biography": {"value": "<p>Description text</p>"} },
  "traits": { "size": "med", "languages": { "value": ["common"], "custom": "" }, "di": {"value":[]}, "dr":{"value":[]}, "dv":{"value":[]}, "ci":{"value":[]} },
  "skills": { /* e.g. "prf": {"ability":"cha", "value": 1}, "ste": {"ability":"dex", "value":1} */ }
},
"items": [ 
  /* Populate this array with weapons, armor, and features. 
     Every item must have a unique 16-char alphanumeric "_id".
     Items must not just have description text; they must have structured automation data in "system.activities".
  */
],
"prototypeToken": { "texture": { "src": "icons/svg/mystery-man.svg" }, "sight": {"enabled": true, "range": 60, "visionMode": "darkvision"}, "name": "" }

### ITEM STRUCTURE RULES (CRITICAL)

For every item in the "items" array, you MUST follow these rules:

1. **Root Level**: 
   - "_id": 16-character random alphanumeric string (e.g., "dnd5eitem0000001").
   - "name": Name of the item.
   - "type": "weapon" (for attacks), "feat" (for features/actions), "equipment" (armor/shield), "spell" (for spells).
   - "system": { "description": { "value": "..." }, "activities": { ... } }

2. **Activities (\`system.activities\`)**:
   - You MUST generate a \`system.activities\` object with a unique ID (e.g., "actAttack01") as the key.
   - Inside this activity, place the damage parts and attack rolls. Do NOT put damage parts in the item root.

   **A. Weapon/Attack Activity (e.g., Bites, Claws, Swords)**
   - Create an activity with \`type: "attack"\`.
   - \`activation\`: \`{ "type": "action", "value": 1 }\`
   - \`attack\`: \`{ "flat": true, "bonus": "5" }\` (calculate bonus based on stats/CR)
   - \`damage\`: \`{ "parts": [{ "number": 1, "denomination": 8, "types": ["slashing"] }] }\`

   **B. Save Activity (e.g., Breath Weapons, Poison Bursts)**
   - Create an activity with \`type: "save"\`.
   - \`save\`: \`{ "ability": ["dex"], "dc": { "calculation": "flat", "formula": "15" } }\`
   - \`damage\`: \`{ "parts": [{ "number": 8, "denomination": 6, "types": ["fire"] }] }\`
   - \`target\`: \`{ "template": { "type": "cone", "size": "60" } }\`

   **C. Utility Activity (e.g., Multiattack, Legendary Resistance)**
   - Create an activity with \`type: "utility"\`.

   **D. Spells (IMPORTANT)**
   - Create an item with \`type: "spell"\`.
   - Set \`system.level\` (number, 0-9).
   - Set \`system.school\` (3-letter code, e.g., "evo", "abj", "enc").
   - Create an activity (usually "cast", "save", or "attack") matching the spell's function.
   - Example: A Fireball spell should have a "save" activity with damage.

3. **Multiattack Logic**:
   - The "Multiattack" feature should have a description that references other items.
   - Format: \`[[/item ItemName]]\` or text description if exact naming is difficult.
   - Example: "<p>The monster makes two attacks: one with its [[/item Bite]] and one with its [[/item Claw]].</p>"

### EXAMPLE ITEM JSON

\`\`\`json
{
  "name": "Bite",
  "type": "weapon",
  "_id": "dnd5eitem0000001",
  "img": "icons/svg/sword.svg",
  "system": {
    "type": { "value": "natural" },
    "description": { "value": "<p>Melee Weapon Attack.</p>" },
    "activities": {
      "dnd5eactivity000": {
        "_id": "dnd5eactivity000",
        "type": "attack",
        "activation": { "type": "action" },
        "attack": { "flat": true, "bonus": "10" },
        "damage": { 
          "parts": [ { "number": 2, "denomination": 10, "types": ["piercing"] } ] 
        }
      }
    }
  }
},
{
  "name": "Fireball",
  "type": "spell",
  "_id": "dnd5espell000001",
  "img": "icons/magic/fire/barrier-shield-explosion-yellow.webp",
  "system": {
    "level": 3,
    "school": "evo",
    "activities": {
      "dnd5eactivity001": {
        "_id": "dnd5eactivity001",
        "type": "save",
        "activation": { "type": "action" },
        "save": { "ability": ["dex"], "dc": { "calculation": "spellcasting" } },
        "damage": { "parts": [{ "number": 8, "denomination": 6, "types": ["fire"] }] }
      }
    }
  }
}
\`\`\`

CRITICAL REMINDERS:
1. ALL "_id" fields (items and activities) must be unique, 16-character strings.
2. Place damage and attack data INSIDE "system.activities.ACTIVITY_ID", NOT in the item root.
3. "system.attributes.ac.calc" should be "default" (if wearing armor) or "natural" (if using flat natural armor).
4. Base all stats (abilities, HP, AC, attack bonuses, damage dice) on the requested CR and creature type.
5. Include the specific attacks and traits requested by the user.

User's request:

---

${userPrompt}

---

Generate ONLY the JSON object.`;

const generatedText = await callGemini({ apiKey, prompt: systemInstruction });
return extractJson(generatedText);
}
