/**
 * Standalone Test Script for Actor Adjustment
 * Usage: node scripts/utils/test-adjustment.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 1. Mocks for Foundry VTT Environment ---

global.foundry = {
    utils: {
        randomID: () => 'mock-id-' + Math.random().toString(36).substr(2, 9),
        getProperty: (obj, key) => key.split('.').reduce((o, i) => o?.[i], obj),
        mergeObject: (original, other) => ({ ...original, ...other }),
        duplicate: (obj) => JSON.parse(JSON.stringify(obj))
    }
};

global.Hooks = { callAll: () => { }, on: () => { } };
global.game = {
    settings: { get: () => process.env.GEMINI_API_KEY },
    system: { id: "dnd5e", version: "5.1.8" }
};
global.ui = { notifications: { info: console.log, warn: console.warn, error: console.error } };

// Mock Actor
// We need a class structure that mimics Foundry's Actor document
class MockActor {
    constructor(data) {
        this.name = data.name;
        this.system = data.system;
        this.items = data.items || [];
        this.img = "icons/svg/mystery-man.svg";
        this.prototypeToken = {};
        this._id = "mock-actor-id";
    }

    async update(data) {
        console.log("MockActor.update called with keys:", Object.keys(data));
        if (data.name) this.name = data.name;
        if (data.system) this.system = data.system; // Simplified merge
        if (data.prototypeToken) this.prototypeToken = data.prototypeToken;
        if (data.img) this.img = data.img;
        return this;
    }

    async deleteEmbeddedDocuments(type, ids) {
        console.log(`MockActor.deleteEmbeddedDocuments called for ${type}, count: ${ids.length}`);
        this.items = [];
    }

    async createEmbeddedDocuments(type, items) {
        console.log(`MockActor.createEmbeddedDocuments called for ${type}, count: ${items.length}`);
        this.items = items;
    }
}

// --- 2. Imports ---
// Using relative paths from 'scripts/utils' to 'scripts/services/gemini-pipeline.js'
import { GeminiPipeline } from "../services/gemini-pipeline.js";
import { collectItemAutomationIssues } from "./item-utils.js";

// --- 3. Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_ROOT = path.resolve(__dirname, '../../');

// Load .env
const envPath = path.join(MODULE_ROOT, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
    });
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found.");
    console.error("Please create a .env file in the module root.");
    process.exit(1);
}

// --- 4. Test Logic ---
async function runTest() {
    console.log("🚀 Starting Adjustment Test...");

    // Create a mock goblin
    const mockGoblin = new MockActor({
        name: "Test Goblin",
        system: {
            details: { cr: 0.25, type: { value: "humanoid" }, biography: { value: "A nasty little goblin." } },
            attributes: {
                ac: { value: 15 },
                hp: { value: 7, max: 7 },
                movement: { walk: 30 },
                spellcasting: ""
            },
            abilities: { str: { value: 8 }, dex: { value: 14 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 8 }, cha: { value: 8 } },
            skills: { ste: { value: 1 } },
            traits: { languages: { value: ["common", "goblin"] } }
        },
        items: [
            { name: "Scimitar", type: "weapon", system: { description: { value: "Slashy slashy." } } }
        ]
    });

    const pipeline = new GeminiPipeline(API_KEY);

    // Mock steps to focus on Adjustment Logic + Builder

    // 1. Mock Quartermaster (Component Selection)
    // We mock this so we don't need real CompendiumService (which needs game.packs)
    pipeline.runQuartermaster = async (blueprint) => {
        console.log("   (Mocking Quartermaster to save API Calls)");
        // Just treat everything as custom for this test
        const customRequests = [...(blueprint.features || []), ...(blueprint.equipment || [])];
        return {
            selectedUuids: [],
            customRequests: customRequests
        };
    };

    // 2. Mock Blacksmith (Custom Item Fabrication)
    pipeline.runBlacksmith = async (blueprint, requests) => {
        console.log("   (Mocking Blacksmith)");
        return requests.map(r => ({
            name: r.name,
            type: r.type || "feat",
            system: {
                description: { value: r.description || "Generated item" },
                activation: { type: "action" }
            },
            img: "icons/svg/item-bag.svg"
        }));
    };

    // 3. Mock Helpers used in runBuilder
    global.fromUuid = async () => null;

    // Try to run adjustment
    console.log("\n🧪 Request: 'Make him a massive fire giant boss (CR 8) with a flaming greatsword.'");

    try {
        await pipeline.adjustActor(mockGoblin, "Make him a massive fire giant boss (CR 8) with a flaming greatsword.");

        console.log("\n✅ Adjustment Complete!");
        console.log("New Name:", mockGoblin.name);
        // Depending on blueprint, these might change
        console.log("New CR:", mockGoblin.system.details.cr);
        console.log("New HP:", mockGoblin.system.attributes.hp.max);
        console.log("New Type:", mockGoblin.system.details.type.value);
        console.log("New Items:", mockGoblin.items.map(i => i.name));

        const automationIssues = [];
        for (const item of mockGoblin.items || []) {
            if (!item?.system?.activities) continue;
            automationIssues.push(...collectItemAutomationIssues(item));
        }
        if (automationIssues.length > 0) {
            console.warn(`⚠️ Found ${automationIssues.length} automation completeness issue(s):`);
            automationIssues.forEach((issue) => console.warn(`   - ${issue}`));
        } else {
            console.log("✅ No automation completeness issues detected.");
        }

        if (mockGoblin.system.details.cr !== 8) {
            console.warn("⚠️ CR did not update to 8 (might be fine if AI chose differently, but check logs)");
        }

        if (!mockGoblin.items.some(i => i.name.toLowerCase().includes("sword"))) {
            console.warn("⚠️ Flaming Greatsword not found in items.");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
        console.error(error.stack);
    }
}

runTest();
