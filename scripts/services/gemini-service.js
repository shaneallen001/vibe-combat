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
