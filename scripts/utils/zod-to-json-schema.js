export function zodToJsonSchema(zodSchema) {
    if (!zodSchema) return {};

    // Unwrap optional and default wrapper
    // Unwrap optional, nullable and default wrapper
    if (zodSchema._def.typeName === "ZodOptional" || zodSchema._def.typeName === "ZodDefault" || zodSchema._def.typeName === "ZodNullable") {
        // If it's a default, technically it is "optional" in input, but in output we expect the value.
        // Yet for schema definition, we just want the inner type structure.
        return zodToJsonSchema(zodSchema._def.innerType);
    }

    const result = {};

    if (zodSchema.description) {
        result.description = zodSchema.description;
    }

    switch (zodSchema._def.typeName) {
        case "ZodString":
            result.type = "string";
            // Handle enum inside string if applicable (not common in basic ZodString)
            break;
        case "ZodNumber":
            result.type = "number";
            break;
        case "ZodBoolean":
            result.type = "boolean";
            break;
        case "ZodArray":
            result.type = "array";
            result.items = zodToJsonSchema(zodSchema._def.type);
            break;
        case "ZodObject":
            result.type = "object";
            result.properties = {};
            const required = [];
            const shape = zodSchema._def.shape();

            for (const key in shape) {
                const fieldSchema = shape[key];
                result.properties[key] = zodToJsonSchema(fieldSchema);

                // Determine if required
                // In Zod, fields are required unless Optional or have Default (sometimes).
                // For Gemini output, we usually want all fields if possible, but 
                // strict JSON schema validation requires listing required fields.
                const isOptional = fieldSchema._def.typeName === "ZodOptional";
                const isDefault = fieldSchema._def.typeName === "ZodDefault"; // Default values are applied by Zod, but schema-wise they might be optional in JSON

                // If it has a default, the LLM doesn't *strictly* need to return it if we apply defaults later.
                // But for "structured output", we often want the LLM to return valid full objects.
                // Let's mark as required unless explicitly optional.
                if (!isOptional) {
                    required.push(key);
                }
            }

            if (required.length > 0) {
                result.required = required;
            }
            // Gemini / some validators dislike empty required arrays, so only add if length > 0
            break;
        case "ZodEnum":
            result.type = "string";
            result.enum = zodSchema._def.values;
            break;
        case "ZodRecord":
            result.type = "object";
            // Gemini support for additionalProperties might be limited, but this is the standard way
            //result.additionalProperties = zodToJsonSchema(zodSchema._def.valueType);
            // NOTE: Gemini "Response Schema" usually prefers `properties`. 
            // If `z.record` is used for "map of skill names", it might be safer to define specific known keys if possible,
            // or accept that Gemini might not perfectly validate arbitrary keys.
            // However, `additionalProperties` is valid JSON Schema.
            break;
        default:
            console.warn(`[zodToJsonSchema] Unsupported Zod type: ${zodSchema._def.typeName}`);
            break;
    }

    return result;
}
