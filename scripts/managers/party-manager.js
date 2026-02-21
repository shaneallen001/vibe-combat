import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Party Manager
 * Manages the party members state and persistence
 */

export class PartyManager {
    constructor() {
        this.partyMembers = [];
        this._defaultPartyLoaded = false;
    }

    /**
     * Initialize the manager, loading default party if needed
     */
    async initialize() {
        if (!this._defaultPartyLoaded) {
            this._defaultPartyLoaded = true;
            const defaultPartyId = game.settings.get("vibe-combat", "defaultPartyId");
            if (defaultPartyId) {
                await this.loadPartyById(defaultPartyId, false);
            }
        }
    }

    /**
     * Get current party members
     */
    get members() {
        return this.partyMembers;
    }

    /**
     * Add an actor to the party
     * @param {Actor} actor 
     * @returns {boolean} true if added, false if already exists
     */
    addMember(actor) {
        if (this.partyMembers.find(m => m.id === actor.id)) return false;
        this.partyMembers.push(actor);
        return true;
    }

    /**
     * Remove an actor from the party
     * @param {string} actorId 
     * @returns {boolean} true if removed
     */
    removeMember(actorId) {
        const initialLength = this.partyMembers.length;
        this.partyMembers = this.partyMembers.filter(m => m.id !== actorId);
        return this.partyMembers.length !== initialLength;
    }

    /**
     * Clear all party members
     */
    clear() {
        this.partyMembers = [];
    }

    /**
     * Load a party by ID
     * @param {string} partyId 
     * @param {boolean} notify whether to show notifications
     * @returns {Promise<boolean>} success
     */
    async loadPartyById(partyId, notify = true) {
        const savedParties = game.settings.get("vibe-combat", "savedParties");
        const partyData = savedParties[partyId];

        if (!partyData) {
            if (notify) VibeToast.warn(`Party not found: ${partyId}`);
            return false;
        }

        this.partyMembers = [];
        const missingActors = [];

        for (const actorId of partyData.actorIds) {
            const actor = game.actors.get(actorId);
            if (actor) {
                this.partyMembers.push(actor);
            } else {
                missingActors.push(actorId);
            }
        }

        if (notify) {
            if (missingActors.length > 0) {
                VibeToast.warn(`Loaded party "${partyData.name}" with ${missingActors.length} missing actors.`);
            } else {
                VibeToast.info(`Loaded party: ${partyData.name}`);
            }
        }
        return true;
    }

    /**
     * Save the current party
     * @param {string} name 
     * @param {boolean} setAsDefault 
     * @returns {Promise<string>} new party ID
     */
    async saveParty(name, setAsDefault) {
        const savedParties = game.settings.get("vibe-combat", "savedParties");
        const partyId = foundry.utils.randomID();

        const newParty = {
            name: name,
            actorIds: this.partyMembers.map(a => a.id),
            timestamp: Date.now()
        };

        savedParties[partyId] = newParty;
        await game.settings.set("vibe-combat", "savedParties", savedParties);

        if (setAsDefault) {
            await game.settings.set("vibe-combat", "defaultPartyId", partyId);
        }

        VibeToast.info(`Saved party: ${name}`);
        return partyId;
    }

    /**
     * Delete a saved party
     * @param {string} partyId 
     * @returns {Promise<boolean>} success
     */
    async deleteParty(partyId) {
        const savedParties = game.settings.get("vibe-combat", "savedParties");
        if (savedParties[partyId]) {
            const name = savedParties[partyId].name;
            delete savedParties[partyId];
            await game.settings.set("vibe-combat", "savedParties", savedParties);

            const defaultPartyId = game.settings.get("vibe-combat", "defaultPartyId");
            if (defaultPartyId === partyId) {
                await game.settings.set("vibe-combat", "defaultPartyId", "");
            }

            VibeToast.info(`Deleted party: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Set a party as default
     * @param {string} partyId 
     * @returns {Promise<boolean>} success
     */
    async setDefaultParty(partyId) {
        const savedParties = game.settings.get("vibe-combat", "savedParties");
        if (savedParties[partyId]) {
            await game.settings.set("vibe-combat", "defaultPartyId", partyId);
            VibeToast.info(`Set "${savedParties[partyId].name}" as default party.`);
            return true;
        }
        return false;
    }


    /**
     * Check if the current party matches the default party
     * @returns {boolean}
     */
    isCurrentPartyDefault() {
        const defaultPartyId = game.settings.get("vibe-combat", "defaultPartyId");
        if (!defaultPartyId) return false;

        const savedParties = game.settings.get("vibe-combat", "savedParties");
        const defaultParty = savedParties[defaultPartyId];
        if (!defaultParty) return false;

        const currentActorIds = this.partyMembers.map(m => m.id).sort();
        const defaultActorIds = (defaultParty.actorIds || []).sort();

        if (currentActorIds.length !== defaultActorIds.length) return false;

        return currentActorIds.every((id, index) => id === defaultActorIds[index]);
    }
}
