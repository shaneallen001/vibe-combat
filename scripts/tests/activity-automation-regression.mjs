import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Minimal Foundry utility mocks required by item-utils.
global.foundry = {
    utils: {
        duplicate: (obj) => JSON.parse(JSON.stringify(obj)),
        randomID: (length = 16) => {
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            let output = "";
            for (let i = 0; i < length; i++) {
                output += chars[Math.floor(Math.random() * chars.length)];
            }
            return output;
        },
        getProperty: (object, key) => {
            if (!key) return undefined;
            let target = object;
            for (const part of key.split(".")) target = target?.[part];
            return target;
        },
    },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "fixtures");

const { collectItemAutomationIssues } = await import("../utils/item-utils.js");
const { normalizeMutuallyExclusiveOptionItems } = await import("../utils/item-utils.js");
const { validateAndRepairItemAutomation } = await import("../utils/item-utils.js");

function loadFixture(name) {
    const fullPath = path.join(FIXTURE_DIR, name);
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runFixtureChecks() {
    const goodItem = loadFixture("good-automation-item.json");
    const badItem = loadFixture("bad-automation-item.json");
    const goodConeItem = loadFixture("good-cone-save-item.json");
    const badConeItem = loadFixture("bad-cone-save-item.json");

    const goodIssues = collectItemAutomationIssues(goodItem);
    const badIssues = collectItemAutomationIssues(badItem);
    const goodConeIssues = collectItemAutomationIssues(goodConeItem);
    const badConeIssues = collectItemAutomationIssues(badConeItem);

    assert(goodIssues.length === 0, `Expected good fixture to have 0 issues, got ${goodIssues.length}: ${goodIssues.join(" | ")}`);
    assert(badIssues.length > 0, "Expected bad fixture to produce automation issues.");
    assert(goodConeIssues.length === 0, `Expected good cone fixture to have 0 issues, got ${goodConeIssues.length}: ${goodConeIssues.join(" | ")}`);
    assert(badConeIssues.length > 0, "Expected bad cone fixture to produce automation issues.");
    assert(
        badIssues.some((issue) => issue.includes("saving throw") || issue.includes("activity.save")),
        "Expected bad fixture issues to include save wiring failures."
    );
    assert(
        badIssues.some((issue) => issue.includes("activity.effects") || issue.includes("limited uses")),
        "Expected bad fixture issues to include condition/effects or uses wiring failures."
    );
    assert(
        badConeIssues.some((issue) => issue.includes("activity.type") || issue.includes("activity.save")),
        "Expected bad cone fixture issues to include save/type wiring failures."
    );
    assert(
        badConeIssues.some((issue) => issue.includes("template size") || issue.includes("template.size")),
        "Expected bad cone fixture issues to include missing template size."
    );

    console.log("activity-automation-regression: PASS");
    console.log(`  good fixture issues: ${goodIssues.length}`);
    console.log(`  bad fixture issues: ${badIssues.length}`);
    console.log(`  good cone fixture issues: ${goodConeIssues.length}`);
    console.log(`  bad cone fixture issues: ${badConeIssues.length}`);
}

function runGroupedOptionNormalizationCheck() {
    const parent = {
        name: "Eye Rays",
        type: "feat",
        _id: "parentitem0000001",
        effects: [
            { _id: "effectparent00001", name: "Charmed", transfer: false, statuses: ["charmed"] },
            { _id: "effectparent00002", name: "Poisoned", transfer: false, statuses: ["poisoned"] }
        ],
        system: {
            description: {
                value: "Choose one of the following rays."
            },
            activities: {
                "parentact0000001": {
                    _id: "parentact0000001",
                    type: "save",
                    activation: { type: "action", value: 1 },
                    save: { ability: ["wis"], dc: { calculation: "flat", formula: "16" } },
                    effects: [{ _id: "effectparent00001", onSave: false }]
                }
            }
        }
    };
    const optionA = {
        name: "Eye Rays (Charm Ray)",
        type: "feat",
        _id: "optionitem0000001",
        effects: [{ _id: "effectoption00001", name: "Charmed", transfer: false, statuses: ["charmed"] }],
        system: {
            description: { value: "Charm option." },
            activities: {
                "optionaact000001": {
                    _id: "optionaact000001",
                    type: "save",
                    save: { ability: ["wis"], dc: { calculation: "flat", formula: "16" } },
                    damage: { parts: [], onSave: "none" },
                    effects: [{ _id: "effectoption00001", onSave: false }]
                }
            }
        }
    };
    const optionB = {
        name: "Eye Rays (Poison Ray)",
        type: "feat",
        _id: "optionitem0000002",
        effects: [{ _id: "effectoption00002", name: "Poisoned", transfer: false, statuses: ["poisoned"] }],
        system: {
            description: { value: "Poison option." },
            activities: {
                "optionbact000001": {
                    _id: "optionbact000001",
                    type: "save",
                    save: { ability: ["con"], dc: { calculation: "flat", formula: "16" } },
                    damage: { parts: [], onSave: "none" },
                    effects: [{ _id: "effectoption00002", onSave: false }]
                }
            }
        }
    };

    const normalized = normalizeMutuallyExclusiveOptionItems([parent, optionA, optionB]);
    const normalizedParent = normalized.find((item) => item.name === "Eye Rays");
    const parentActivities = Object.values(normalizedParent.system.activities || {});

    assert(parentActivities.length === 1, "Expected normalized parent to keep exactly one helper activity.");
    assert(parentActivities[0].type === "utility", "Expected normalized parent activity to be utility type.");
    assert((normalizedParent.effects || []).length === 0, "Expected normalized parent effects to be cleared after normalization.");
}

function runAttackSaveRiderRepairCheck() {
    const mixedAttackSaveItem = {
        name: "Blinding Arrow",
        type: "weapon",
        _id: "attacksaveitem001",
        effects: [
            { _id: "blindeffect00001", name: "Blinded", transfer: false, statuses: ["blinded"] }
        ],
        system: {
            description: {
                value: "Ranged Weapon Attack: +8 to hit, range 80/320 ft., one target. Hit: 3 (1d4 + 1) piercing damage, and the target must succeed on a DC 14 Dexterity saving throw or be blinded for 1 minute."
            },
            activities: {
                "attackactivity001": {
                    _id: "attackactivity001",
                    type: "attack",
                    activation: { type: "action", value: 1 },
                    attack: { flat: false, bonus: "+8", ability: "dex" },
                    range: { value: "80/320", units: "ft" },
                    target: {
                        affects: { type: "creature", count: "1", choice: false },
                        prompt: true
                    },
                    damage: {
                        parts: [{ number: 1, denomination: 4, types: ["piercing"], bonus: "+1" }]
                    },
                    effects: [{ _id: "blindeffect00001", onSave: false }]
                }
            }
        }
    };

    const preIssues = collectItemAutomationIssues(mixedAttackSaveItem);
    assert(
        preIssues.some((issue) => issue.includes("companion save rider")),
        "Expected pre-repair mixed attack/save fixture to report missing companion save rider."
    );

    const { item: repaired, warnings } = validateAndRepairItemAutomation(mixedAttackSaveItem);
    assert(warnings.length === 0, `Expected mixed attack/save fixture to repair cleanly, got warnings: ${warnings.join(" | ")}`);

    const activities = Object.values(repaired.system?.activities || {});
    const repairedAttack = activities.find((activity) => activity?.type === "attack");
    const repairedSaveRider = activities.find(
        (activity) => activity?.type === "save" && activity?.activation?.type === "passive"
    );

    assert(repairedAttack, "Expected repaired item to retain an attack activity.");
    assert(repairedSaveRider, "Expected repaired item to include a passive save rider activity.");
    assert((repairedAttack.effects || []).length === 0, "Expected repaired attack activity to remove save-gated effects.");
    const riderEffectIds = new Set((repairedSaveRider.effects || []).map((effectRef) => effectRef?._id).filter(Boolean));
    assert(
        (repaired.effects || []).some(
            (effect) => (effect.statuses || []).includes("blinded") && riderEffectIds.has(effect._id)
        ),
        "Expected save rider to carry the blinded effect link."
    );
    assert(
        Array.isArray(repairedSaveRider?.save?.ability) && repairedSaveRider.save.ability.includes("dex"),
        "Expected save rider to infer Dexterity save ability."
    );
    assert(
        String(repairedSaveRider?.save?.dc?.formula || "") === "14",
        "Expected save rider to infer DC 14 from prose."
    );

    const postIssues = collectItemAutomationIssues(repaired);
    assert(postIssues.length === 0, `Expected repaired mixed attack/save fixture to have 0 issues, got ${postIssues.join(" | ")}`);
}

try {
    runFixtureChecks();
    runGroupedOptionNormalizationCheck();
    runAttackSaveRiderRepairCheck();
} catch (error) {
    console.error("activity-automation-regression: FAIL");
    console.error(error.message);
    process.exit(1);
}
