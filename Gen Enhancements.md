# Generation Enhancements: The Cemented Pipeline

**Goal:** Transform the current text-based "hope for the best" generation process into a deterministic, type-safe, and fault-tolerant system. The generation process should "work almost without fail."

## Core Philosophy

1.  **Structure over Syntax:** Move away from prompting for "JSON blocks" and towards **Native Structured Output** (Gemini `responseSchema` or Function Calling).
2.  **Validation is Authority:** No data leaves an AI step without passing a strict **Zod Schema** validation.
3.  **Self-Healing:** If validation fails, the error (and the invalid payload) is fed back to the AI for a targeted fix (Reflection/Correction loop).

---

## 1. Major Architectural Upchanges

### A. Strict Schema Definition (The "Contract")
We need to define the exact shape of data we expect at every stage. We will use **Zod** (or a similar runtime validation library) to define these contracts.

-   **`BlueprintSchema`**: Defines the Architect's output (Stats, Biography, Features).
-   **`AnalysisSchema`**: Defines the Quartermaster's decisions (Keep, Replace, Modify).
-   **`FoundryItemSchema`**: Defines the Blacksmith's output. *This is critical* as Foundry's data structure is complex. We shouldn't ask the AI for the *entire* item structure if we can avoid it—just the reactive parts (Activities, Description, Damage).

### B. Gemini Structured Output / Tool Use
Instead of parsing Markdown code blocks, we will use Gemini's **Structured Output** capabilities.
-   **Config**: `responseMimeType: "application/json"`
-   **Schema**: Pass the JSON schema directly to the API.
-   **Benefit**: The model is constrained to generate *only* valid JSON matching our schema, eliminating 99% of formatting errors.

### C. The "Agent" Class Pattern
Refactor the distinct steps (Architect, Quartermaster, Blacksmith) into formal classes that inherit from a `GenerativeAgent`.

```typescript
abstract class GenerativeAgent<TInput, TOutput> {
  abstract schema: ZodSchema<TOutput>;
  abstract systemPrompt: string;
  
  async generate(input: TInput, retries = 3): Promise<TOutput> {
    // 1. Construct prompt
    // 2. Call Gemini with Schema
    // 3. Validate Result
    // 4. Catch validation error -> Retry with error context
  }
}
```

---

## 2. Detailed Workflow Enhancements

### Step 1: The Architect (Concept Generation)
*Current State:* Prompts for a loose JSON.
*Enhancement:*
-   **Schema:** Enforce D&D 5e math in the schema? Or at least strict types for `stats`, `movements`, `senses`.
-   **Enums:** Use Enums for `size`, `alignment`, `type` to prevent "Chaotic Random" or "Medium-ish".
-   **Constraint:** The Architect should output *intent*, not final Foundry data yet.

### Step 2: The Quartermaster (The Smart Filter)
*Current State:* Simple text search.
*Enhancement:*
-   **Vector Search (Future):** Instead of text search, use embedding-based search for better feature matching (finding "Parry" logic even if called "Defensive Stance").
-   **Decision Tool:** The Quartermaster should output a specific decision list:
    ```json
    [
      { "feature": "Multiattack", "action": "USE_EXISTING", "uuid": "..." },
      { "feature": "Death Gaze", "action": "GENERATE_CUSTOM", "reason": "No match found" }
    ]
    ```

### Step 3: The Blacksmith (The Foundry Expert)
*Current State:* High failure rate area. Generating full Foundry Item structures is hard.
*Enhancement:*
-   ** Partial Generation:** Don't ask the AI to generate the *entire* JSON object (`_id`, `img`, `folder`, `sort`).
-   **Factories:** Ask the AI for the *logical* components: `activities`, `description`, `activation`.
-   **Assembly:** Use a code-based factory to wrap those logical components into a valid Foundry Item Document.
    -   *AI Output:* `{ "damage": "2d6 + 4", "save": "dex" }`
    -   *Code Factory:* `new Weapon({ damage: ..., save: ... })`

---

## 3. Reliability Features

### The "Correction Loop"
If the generated JSON fails Zod validation:
1.  **Do not crash.**
2.  **Reprompt:** Send the invalid JSON + the Zod Error Message back to Gemini.
    -   *User:* "You provided invalid JSON. Error: `Path 'stats.ac' expected Number, received String`. Fix it."
3.  **Repeat:** Up to 3 times.

### "Dry Run" Capability
Allow the user to "Preview" the Blueprint before the Quartermaster/Blacksmith get to work.
-   UI shows the Blueprint.
-   User tweaks "CR" or "Name".
-   Pipeline resumes.

---

## 4. Implementation Steps

1.  **Vendor Zod:** Since this project uses native ES modules without a bundler, we will include a bundled version of Zod (e.g., from a CDN or built separately) directly in `scripts/libs/zod.js`. This ensures the GM does not need to install anything.
2.  **Define Schemas:** Create `scripts/schemas/` and define the data shapes.
3.  **Update Gemini Service:** Add support for passing `responseSchema` to the API call.
4.  **Refactor Agents:** Rewrite `GeminiPipeline.js` to use `ArchitectAgent`, `QuartermasterAgent`, `BlacksmithAgent`.
