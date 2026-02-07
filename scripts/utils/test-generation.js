/**
 * Standalone Test Script for Actor Generation
 * Usage: node scripts/utils/test-generation.js
 * 
 * Environment Variables:
 * - GEMINI_API_KEY: Your Gemini API key (Required)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 1. Mocks for Foundry VTT Environment ---

global.foundry = {
    utils: {
        randomID: (length = 16) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        getProperty: (object, key) => {
            if (!key) return undefined;
            let target = object;
            for (const p of key.split('.')) {
                target = target?.[p];
            }
            return target;
        },
        setProperty: (object, key, value) => {
            if (!key) return false;
            let target = object;
            const parts = key.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                if (!target[p]) target[p] = {};
                target = target[p];
            }
            target[parts[parts.length - 1]] = value;
            return true;
        },
        duplicate: (obj) => JSON.parse(JSON.stringify(obj)),
        mergeObject: (original, other, { insertKeys = true, insertValues = true, overwrite = true, recursive = true } = {}) => {
            // Simple specific implementation for now
            return { ...original, ...other };
        }
    }
};

global.Hooks = {
    on: () => { },
    call: () => { }
};

global.Actor = {
    create: async (data) => {
        console.log("Mock Actor.create called with:", data.name);
        return { ...data, _id: global.foundry.utils.randomID() };
    }
};

// --- 2. Imports (after mocks) ---

// We need to use dynamic imports or ensure paths are correct relative to this script
// Using relative paths from 'scripts/utils' to 'scripts/agents'
import { ArchitectAgent } from "../agents/architect-agent.js";
import { GeminiPipeline } from "../services/gemini-pipeline.js"; // Optional: Test full pipeline if possible

// --- 3. Setup & Configuration ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_ROOT = path.resolve(__dirname, '../../');

const EXAMPLE_DIR = path.join(MODULE_ROOT, "Example JSON's/Test Generated");
const ERROR_DIR = path.join(MODULE_ROOT, "Error Logs");
const ERROR_FILE = path.join(ERROR_DIR, "Test Errors.md");

// Ensure directories exist
if (!fs.existsSync(EXAMPLE_DIR)) fs.mkdirSync(EXAMPLE_DIR, { recursive: true });
if (!fs.existsSync(ERROR_DIR)) fs.mkdirSync(ERROR_DIR, { recursive: true });

// Load .env if it exists
const envPath = path.join(MODULE_ROOT, '.env');
if (fs.existsSync(envPath)) {
    console.log(`📄 Loading environment variables from ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, ''); // Remove quotes if present
        }
    });
}

// API Key Check
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("\n❌ ERROR: GEMINI_API_KEY environment variable is not set.");
    console.error("Please create a .env file in the module root with: GEMINI_API_KEY=your_key_here");
    console.error("OR set it in your terminal session before running this script.");
    console.error("Example (PowerShell): $env:GEMINI_API_KEY='your_key_here'; node scripts/utils/test-generation.js");
    console.error("Example (Bash): export GEMINI_API_KEY='your_key_here' && node scripts/utils/test-generation.js\n");
    process.exit(1);
}

// --- 4. Test Logic ---

async function runTest() {
    console.log("🚀 Starting Standalone Actor Generation Test...");
    console.log(`📂 Output Directory: ${EXAMPLE_DIR}`);

    const prompt = "A CR 8 lich-like undead wizard spellcaster. Uses intelligence for spellcasting. Has Fireball and Animate Dead at will, and Power Word Kill 1/day.";

    try {
        // Test 1: Architect Agent (Blueprint only)
        console.log("\n🧪 Testing Architect Agent (SKIPPED to save quota)...");
        // const architect = new ArchitectAgent(API_KEY);

        // console.time("Architect Generation");
        // const blueprint = await architect.generate({ prompt, cr: 1 });
        // console.timeEnd("Architect Generation");

        // console.log("✅ Architect Generation Successful!");
        // console.log(`   Name: ${blueprint.name}`);
        // console.log(`   CR: ${blueprint.cr}`);

        // // Save Blueprint
        // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // const filename = `blueprint_${timestamp}.json`;
        // const filePath = path.join(EXAMPLE_DIR, filename);

        // fs.writeFileSync(filePath, JSON.stringify(blueprint, null, 2));
        // console.log(`💾 Saved blueprint to: ${filename}`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Mock game.packs
        global.game = {
            packs: {
                get: (packId) => ({
                    getIndex: async () => [],
                    getDocument: async (id) => ({ toObject: () => ({ name: "Mock Item", type: "weapon", system: {} }) })
                })
            }
        };

        // Mock fromUuid
        global.fromUuid = async (uuid) => ({
            toObject: () => ({ name: "Mock Item from UUID", type: "weapon", system: {} })
        });

        // Mock Hooks.callAll
        global.Hooks.callAll = () => { };

        // Test 2: Full Gemini Pipeline
        console.log("\n🧪 Testing Full Gemini Pipeline...");
        const pipeline = new GeminiPipeline(API_KEY);
        console.time("Pipeline Generation");
        const actor = await pipeline.generateActor({ prompt, cr: 1 });
        console.timeEnd("Pipeline Generation");

        console.log("✅ Pipeline Generation Successful!");
        console.log(`   Name: ${actor.name}`);
        console.log(`   Items: ${actor.items.length}`);

        // Save Actor
        const filenameActor = `actor_${timestamp}.json`;
        const filePathActor = path.join(EXAMPLE_DIR, filenameActor);
        fs.writeFileSync(filePathActor, JSON.stringify(actor, null, 2));
        console.log(`💾 Saved actor to: ${filenameActor}`);

    } catch (error) {
        console.error("\n❌ Test Failed!");
        console.error(error);

        // Log to file
        const timestamp = new Date().toISOString();
        const errorLog = `
## Test Failure - ${timestamp}
**Error**: ${error.message}
**Stack**:
\`\`\`
${error.stack}
\`\`\`
---
`;
        fs.appendFileSync(ERROR_FILE, errorLog);
        console.log(`📝 Error logged to: ${ERROR_FILE}`);
        process.exit(1);
    }
}

runTest();
