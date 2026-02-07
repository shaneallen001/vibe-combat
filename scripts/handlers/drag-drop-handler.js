/**
 * Drag and Drop Handler
 * Manages drag and drop interactions for Vibe Combat App
 */

import { getDragEventData } from "../utils/drag-drop.js";

export class DragDropHandler {
    constructor(app) {
        this.app = app;
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget && event.currentTarget.classList) {
            event.currentTarget.classList.add("drag-over");
        }
    }

    handleDragLeave(event) {
        if (event.currentTarget && event.currentTarget.classList) {
            event.currentTarget.classList.remove("drag-over");
        }
    }

    async handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        // Guard against duplicate handling
        const rawEvent = event?.originalEvent ?? event;
        if (rawEvent?.__vibeCombatDropHandled) return;
        if (rawEvent) rawEvent.__vibeCombatDropHandled = true;

        // Remove drag-over class
        if (event.currentTarget && event.currentTarget.classList) {
            event.currentTarget.classList.remove("drag-over");
        }

        const data = getDragEventData(event);
        if (!data) return;

        if (data && (data.type === "Actor" || data.documentName === "Actor")) {
            await this._handleActorDrop(event, data);
        }
    }

    async _handleActorDrop(event, data) {
        const suggestedQuantity = Math.max(
            1,
            Math.floor(Number(data?.vibeCombatSuggestion?.quantity ?? 1))
        );

        let actorId = data.id;
        let actor = actorId ? game.actors.get(actorId) : null;
        let actorUuid = data.uuid || null;
        const actorPack = data.pack || null;

        // Handle UUID format (Actor.xxx)
        if (!actor && actorUuid && typeof fromUuid === "function") {
            try {
                actor = await fromUuid(actorUuid);
                if (actor && !actorId) {
                    actorId = actor.id;
                }
            } catch (e) {
                console.warn("Vibe Combat: Failed to resolve actor from UUID", actorUuid, e);
            }
        }

        // Try fetching from the compendium pack directly if needed
        if (!actor && actorPack && actorId) {
            const pack = game.packs.get(actorPack);
            if (pack && typeof pack.getDocument === "function") {
                try {
                    actor = await pack.getDocument(actorId);
                    if (actor && !actorUuid) {
                        actorUuid = actor.uuid;
                    }
                } catch (e) {
                    console.warn("Vibe Combat: Failed to retrieve actor from compendium", actorPack, actorId, e);
                }
            }
        }

        if (!actor) {
            ui.notifications.warn("Could not find the dragged actor.");
            return;
        }

        const dropZone = this._getDropZoneFromEvent(event);

        if (!dropZone || !dropZone.classList) {
            console.warn("Vibe Combat: Could not determine drop zone, defaulting to encounter zone");
            // Default to adding to encounter if we can't determine the zone
            if (actor.type === "npc") {
                if (this.app.encounterManager.addActorEntry(actor, 1, { uuid: actorUuid, pack: actorPack })) {
                    this.app.render();
                }
            } else {
                ui.notifications.warn("Only NPC actors can be added to encounters.");
            }
            return;
        }

        const isPartyDropZone = dropZone.classList.contains("party-drop-zone");
        const isEncounterDropZone = dropZone.classList.contains("encounter-drop-target");

        if (isPartyDropZone) {
            // Handle party member drop
            if (actor.type === "character") {
                if (this.app.partyManager.addMember(actor)) {
                    this.app.render();
                }
            } else {
                ui.notifications.warn("Only character actors can be added to the party.");
            }
        } else if (isEncounterDropZone) {
            // Handle encounter entry drop
            if (actor.type === "npc") {
                if (this.app.encounterManager.addActorEntry(actor, suggestedQuantity, {
                    uuid: actorUuid,
                    pack: actorPack
                })) {
                    this.app.render();
                }
            } else {
                ui.notifications.warn("Only NPC actors can be added to encounters.");
            }
        }
    }

    _getDropZoneFromEvent(event) {
        let dropZone = event.currentTarget;
        if (!dropZone || !dropZone.classList) {
            dropZone = event.target?.closest(".party-drop-zone, .encounter-drop-target");
        }
        if (!dropZone || !dropZone.classList) {
            const appElement = this.app.element?.[0];
            if (appElement) {
                const encounterZone = appElement.querySelector(".encounter-drop-target");
                const partyZone = appElement.querySelector(".party-drop-zone");
                dropZone = dropZone || encounterZone || partyZone || null;
            }
        }
        return dropZone;
    }
}
