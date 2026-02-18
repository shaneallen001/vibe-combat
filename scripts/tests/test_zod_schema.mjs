import { z } from "../libs/zod.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";

function testZodNullable() {
    console.log("Testing ZodNullable support...");

    try {
        const schema = z.string().nullable();
        const jsonSchema = zodToJsonSchema(schema);

        console.log("Input Schema: z.string().nullable()");
        console.log("Output JSON Schema:", JSON.stringify(jsonSchema, null, 2));

        if (jsonSchema.type === "string") {
            console.log("SUCCESS: ZodNullable correctly unwrapped to inner type.");
        } else {
            console.error("FAILURE: ZodNullable did not unwrap correctly.");
            process.exit(1);
        }

    } catch (error) {
        console.error("CRASHED: zodToJsonSchema threw an error on ZodNullable.");
        console.error(error);
        process.exit(1);
    }
}

function testZodObjectNullable() {
    console.log("\nTesting ZodObject with Nullable fields...");

    try {
        const schema = z.object({
            name: z.string(),
            description: z.string().nullable().optional()
        });
        const jsonSchema = zodToJsonSchema(schema);

        console.log("Input Schema: z.object({ name: string, description: string.nullable().optional() })");
        console.log("Output JSON Schema:", JSON.stringify(jsonSchema, null, 2));

        if (jsonSchema.properties.description.type === "string") {
            console.log("SUCCESS: Nested ZodNullable correctly unwrapped.");
        } else {
            console.error("FAILURE: Nested ZodNullable did not unwrap correctly.");
            process.exit(1);
        }

    } catch (error) {
        console.error("CRASHED: zodToJsonSchema threw an error on nested ZodNullable.");
        console.error(error);
        process.exit(1);
    }
}

function testZodEffects() {
    console.log("\nTesting ZodEffects (superRefine) support...");

    try {
        const schema = z.object({
            type: z.string(),
            save: z.object({ ability: z.array(z.string()) }).optional(),
        }).superRefine(() => { });
        const jsonSchema = zodToJsonSchema(schema);

        console.log("Input Schema: z.object(...).superRefine(...)");
        console.log("Output JSON Schema:", JSON.stringify(jsonSchema, null, 2));

        if (jsonSchema.type === "object" && jsonSchema.properties?.type?.type === "string") {
            console.log("SUCCESS: ZodEffects correctly unwrapped to inner object.");
        } else {
            console.error("FAILURE: ZodEffects did not unwrap correctly.");
            process.exit(1);
        }

    } catch (error) {
        console.error("CRASHED: zodToJsonSchema threw an error on ZodEffects.");
        console.error(error);
        process.exit(1);
    }
}

testZodNullable();
testZodObjectNullable();
testZodEffects();
