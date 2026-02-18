import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Minimal Foundry utility mocks required by item-utils.
global.foundry = {
    utils: {
        duplicate: (obj) => JSON.parse(JSON.stringify(obj)),
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

    const goodIssues = collectItemAutomationIssues(goodItem);
    const badIssues = collectItemAutomationIssues(badItem);

    assert(goodIssues.length === 0, `Expected good fixture to have 0 issues, got ${goodIssues.length}: ${goodIssues.join(" | ")}`);
    assert(badIssues.length > 0, "Expected bad fixture to produce automation issues.");
    assert(
        badIssues.some((issue) => issue.includes("saving throw") || issue.includes("activity.save")),
        "Expected bad fixture issues to include save wiring failures."
    );
    assert(
        badIssues.some((issue) => issue.includes("activity.effects") || issue.includes("limited uses")),
        "Expected bad fixture issues to include condition/effects or uses wiring failures."
    );

    console.log("activity-automation-regression: PASS");
    console.log(`  good fixture issues: ${goodIssues.length}`);
    console.log(`  bad fixture issues: ${badIssues.length}`);
}

try {
    runFixtureChecks();
} catch (error) {
    console.error("activity-automation-regression: FAIL");
    console.error(error.message);
    process.exit(1);
}
