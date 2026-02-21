import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Encounter Manager
 * Manages the encounter entries state and persistence
 */

import { getActorCr, getEncounterTokenImage } from "../utils/actor-helpers.js";

export class EncounterManager {
    constructor() {
        this.encounterEntries = [];
        this._defaultEncounterLoaded = false;
    }

    /**
     * Initialize the manager, loading default encounter if needed
     */
    async initialize() {
        if (!this._defaultEncounterLoaded) {
            this._defaultEncounterLoaded = true;
            const defaultEncounterId = game.settings.get("vibe-combat", "defaultEncounterId");
            if (defaultEncounterId) {
                await this.loadEncounterById(defaultEncounterId, false);
            }
        }
    }

    get entries() {
        return this.encounterEntries;
    }

    /**
     * Add a stand-in encounter entry
     */
    addEntry(cr, quantity, options = {}) {
        const safeQuantity = Math.max(Math.floor(quantity), 1);
        if (!cr || safeQuantity <= 0) return false;

        const tokenImg = options.tokenImg || "icons/svg/mystery-man.svg";
        const label = options.label || null;
        this.encounterEntries.push({
            actorId: null,
            actorName: label,
            cr: cr,
            quantity: safeQuantity,
            isActor: false,
            tokenImg: tokenImg
        });
        return true;
    }

    /**
     * Add an actor-based encounter entry
     */
    addActorEntry(actor, quantity = 1, source = {}) {
        if (!actor || actor.type !== "npc") return false;

        const actorId = actor.id;
        const actorUuid = actor.uuid || source.uuid || null;
        const actorName = actor.name;
        const cr = getActorCr(actor);
        const increment = Math.max(Math.floor(quantity), 1);

        // Check if actor already exists in encounter
        const existingEntry = this.encounterEntries.find(entry => {
            if (!entry.isActor) return false;
            if (actorUuid && entry.actorUuid) {
                return entry.actorUuid === actorUuid;
            }
            return entry.actorId === actorId;
        });

        if (existingEntry) {
            // Increment quantity for existing actor
            const currentQuantity = Number(existingEntry.quantity) || 0;
            existingEntry.quantity = currentQuantity + increment;
            if (actorUuid && !existingEntry.actorUuid) {
                existingEntry.actorUuid = actorUuid;
            }
            if (!existingEntry.tokenImg) {
                existingEntry.tokenImg = getEncounterTokenImage(actor);
            }
        } else {
            // Add new actor entry
            this.encounterEntries.push({
                actorId: actorId,
                actorUuid: actorUuid,
                actorName: actorName,
                cr: cr,
                quantity: 1,
                isActor: true,
                tokenImg: getEncounterTokenImage(actor)
            });

            // If the requested quantity was more than one, apply the remainder now
            if (increment > 1) {
                const entry = this.encounterEntries[this.encounterEntries.length - 1];
                entry.quantity = increment;
            }
        }
        return true;
    }

    removeEntry(index) {
        if (index >= 0 && index < this.encounterEntries.length) {
            this.encounterEntries.splice(index, 1);
            return true;
        }
        return false;
    }

    clear() {
        this.encounterEntries = [];
    }

    adjustQuantity(index, delta) {
        if (!Number.isInteger(index)) return false;
        const entry = this.encounterEntries[index];
        if (!entry) return false;

        const currentQuantity = Math.max(Math.floor(Number(entry.quantity) || 0), 0);
        const nextQuantity = Math.max(currentQuantity + delta, 0);
        if (nextQuantity === currentQuantity) return false;

        entry.quantity = nextQuantity;
        return true;
    }

    updateEntry(index, updates) {
        if (!this.encounterEntries[index]) return false;
        foundry.utils.mergeObject(this.encounterEntries[index], updates);
        return true;
    }

    /**
     * Save the current encounter
     */
    async saveEncounter(name, setAsDefault = false) {
        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters") || {};
        const encounterId = foundry.utils.randomID();

        // Save encounter entries with all necessary data
        const entries = this.encounterEntries.map(entry => ({
            actorId: entry.actorId || null,
            actorUuid: entry.actorUuid || null,
            actorName: entry.actorName || null,
            cr: entry.cr,
            quantity: entry.quantity,
            isActor: entry.isActor,
            tokenImg: entry.tokenImg || null
        }));

        const encounterData = {
            name: name,
            entries: entries,
            savedAt: Date.now()
        };

        savedEncounters[encounterId] = encounterData;
        await game.settings.set("vibe-combat", "savedEncounters", savedEncounters);

        if (setAsDefault) {
            await game.settings.set("vibe-combat", "defaultEncounterId", encounterId);
        }

        VibeToast.info(`Encounter "${name}" saved successfully${setAsDefault ? " and set as default" : ""}.`);
        return encounterId;
    }

    /**
     * Load an encounter by ID
     */
    async loadEncounterById(encounterId, showNotification = true) {
        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters") || {};
        const encounter = savedEncounters[encounterId];

        if (!encounter) {
            if (showNotification) {
                VibeToast.warn("Encounter not found.");
            }
            return false;
        }

        const entries = encounter.entries || [];
        this.encounterEntries = [];

        for (const entryData of entries) {
            if (entryData.isActor && entryData.actorId) {
                // Try to load the actor
                let actor = game.actors.get(entryData.actorId);

                // If not found and we have a UUID, try to resolve it
                if (!actor && entryData.actorUuid && typeof fromUuid === "function") {
                    try {
                        actor = await fromUuid(entryData.actorUuid);
                    } catch (e) {
                        console.warn("Vibe Combat: Failed to resolve actor from UUID", entryData.actorUuid, e);
                    }
                }

                if (actor && actor.type === "npc") {
                    // Verify CR matches (in case it changed)
                    const currentCr = getActorCr(actor);

                    this.encounterEntries.push({
                        actorId: actor.id,
                        actorUuid: actor.uuid || entryData.actorUuid || null,
                        actorName: actor.name,
                        cr: currentCr,
                        quantity: entryData.quantity || 1,
                        isActor: true,
                        tokenImg: getEncounterTokenImage(actor)
                    });
                } else {
                    // Actor not found, but preserve as a stand-in with the saved CR
                    if (showNotification) {
                        console.warn(`Vibe Combat: Actor ${entryData.actorId || entryData.actorName} not found, loading as stand-in`);
                    }
                    this.encounterEntries.push({
                        actorId: null,
                        actorUuid: entryData.actorUuid || null,
                        actorName: entryData.actorName || null,
                        cr: entryData.cr || "0",
                        quantity: entryData.quantity || 1,
                        isActor: false,
                        tokenImg: entryData.tokenImg || "icons/svg/mystery-man.svg"
                    });
                }
            } else {
                // Stand-in entry
                this.encounterEntries.push({
                    actorId: null,
                    actorUuid: null,
                    actorName: null,
                    cr: entryData.cr || "0",
                    quantity: entryData.quantity || 1,
                    isActor: false,
                    tokenImg: entryData.tokenImg || "icons/svg/mystery-man.svg"
                });
            }
        }

        if (showNotification) {
            const loadedCount = this.encounterEntries.length;
            VibeToast.info(`Loaded encounter "${encounter.name}" with ${loadedCount} entry/entries.`);
        }
        return true;
    }

    async deleteEncounter(encounterId) {
        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters") || {};
        const encounter = savedEncounters[encounterId];

        if (!encounter) {
            VibeToast.warn("Encounter not found.");
            return false;
        }

        const defaultEncounterId = game.settings.get("vibe-combat", "defaultEncounterId");
        if (encounterId === defaultEncounterId) {
            await game.settings.set("vibe-combat", "defaultEncounterId", null);
        }

        delete savedEncounters[encounterId];
        await game.settings.set("vibe-combat", "savedEncounters", savedEncounters);

        VibeToast.info(`Encounter "${encounter.name}" deleted successfully.`);
        return true;
    }

    async setDefaultEncounter(encounterId) {
        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters");
        if (savedEncounters[encounterId]) {
            await game.settings.set("vibe-combat", "defaultEncounterId", encounterId);
            VibeToast.info(`Set "${savedEncounters[encounterId].name}" as default encounter.`);
            return true;
        }
        return false;
    }

    isCurrentEncounterDefault() {
        const defaultEncounterId = game.settings.get("vibe-combat", "defaultEncounterId");
        if (!defaultEncounterId) return false;

        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters");
        const defaultEncounter = savedEncounters[defaultEncounterId];
        if (!defaultEncounter) return false;

        const currentEntries = JSON.stringify(this.encounterEntries.map(e => ({
            actorId: e.actorId,
            actorUuid: e.actorUuid,
            actorName: e.actorName,
            cr: e.cr,
            quantity: e.quantity,
            isActor: e.isActor,
            tokenImg: e.tokenImg
        })).sort((a, b) => {
            const keyA = `${a.actorId || 'stand-in'}-${a.cr}-${a.isActor}`;
            const keyB = `${b.actorId || 'stand-in'}-${b.cr}-${b.isActor}`;
            return keyA.localeCompare(keyB);
        }));

        const defaultEntries = JSON.stringify((defaultEncounter.entries || []).sort((a, b) => {
            const keyA = `${a.actorId || 'stand-in'}-${a.cr}-${a.isActor}`;
            const keyB = `${b.actorId || 'stand-in'}-${b.cr}-${b.isActor}`;
            return keyA.localeCompare(keyB);
        }));

        return currentEntries === defaultEntries;
    }

    getEncounterEntryTokenImage(entry) {
        if (entry.tokenImg) {
            return entry.tokenImg;
        }

        if (entry.isActor && entry.actorId) {
            const actor = game.actors.get(entry.actorId);
            if (actor) {
                return getEncounterTokenImage(actor);
            }
        }

        return "icons/svg/mystery-man.svg";
    }
}
