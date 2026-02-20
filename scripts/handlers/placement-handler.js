/**
 * Placement Handler
 * Manages token placement on the canvas
 */

export class PlacementHandler {
    constructor(app) {
        this.app = app;
        this._placementQueue = [];
        this._placementIndex = 0;
        this._placementHandlers = null;
    }

    async onPlaceEnemies() {
        if (this.app.encounterManager.entries.length === 0) {
            ui.notifications.warn("No enemies to place.");
            return;
        }

        // Minimize the window
        this.app.minimize();

        // Start placement mode
        this._beginPlacementMode();
    }

    _beginPlacementMode() {
        // Create a flat list of tokens to place
        this._placementQueue = [];
        for (const entry of this.app.encounterManager.entries) {
            if (!entry.isActor || !entry.actorId) continue; // Skip stand-ins or invalid actors

            for (let i = 0; i < entry.quantity; i++) {
                this._placementQueue.push({
                    actorId: entry.actorId,
                    actorUuid: entry.actorUuid,
                    tokenImg: entry.tokenImg,
                    name: entry.actorName
                });
            }
        }

        if (this._placementQueue.length === 0) {
            ui.notifications.warn("No valid actors to place.");
            this.app.maximize();
            return;
        }

        this._placementIndex = 0;
        this._activatePlacementTool();
    }

    _activatePlacementTool() {
        if (this._placementIndex >= this._placementQueue.length) {
            ui.notifications.info("All enemies placed.");
            this.app.maximize();
            return;
        }

        const nextToPlace = this._placementQueue[this._placementIndex];
        ui.notifications.info(`Click on the scene to place: ${nextToPlace.name} (${this._placementQueue.length - this._placementIndex} remaining). Right-click to cancel.`);

        // We need to listen for a click on the canvas
        // Using a one-time listener on the canvas stage
        const clickHandler = this._onPlacementClick.bind(this);
        const cancelHandler = this._onPlacementCancel.bind(this);

        canvas.stage.once('mousedown', clickHandler);
        canvas.stage.once('rightdown', cancelHandler);

        // Store handlers to remove them if needed
        this._placementHandlers = { click: clickHandler, cancel: cancelHandler };
    }

    async _onPlacementClick(event) {
        // Remove the cancel listener since we handled the click
        if (this._placementHandlers?.cancel) {
            canvas.stage.off('rightdown', this._placementHandlers.cancel);
        }

        const nextToPlace = this._placementQueue[this._placementIndex];
        if (!nextToPlace) return;

        // Get position - handle different Foundry versions/event structures
        let x, y;
        if (typeof event.getLocalPosition === "function") {
            const pos = event.getLocalPosition(canvas.tokens);
            x = pos.x;
            y = pos.y;
        } else if (event.data && typeof event.data.getLocalPosition === "function") {
            const pos = event.data.getLocalPosition(canvas.tokens);
            x = pos.x;
            y = pos.y;
        } else {
            // Fallback to global mouse position transformed to tokens layer
            const t = canvas.tokens.worldTransform.applyInverse(canvas.mousePosition);
            x = t.x;
            y = t.y;
        }

        // Snap to grid - prefer getTopLeft to ensure we are in the clicked square
        let targetX, targetY;

        // Try to use getTopLeft (v10/v11) or getTopLeftPoint (v12+)
        if (typeof canvas.grid.getTopLeft === "function") {
            const topLeft = canvas.grid.getTopLeft(x, y);
            if (Array.isArray(topLeft)) {
                [targetX, targetY] = topLeft;
            } else {
                targetX = topLeft.x;
                targetY = topLeft.y;
            }
        } else if (typeof canvas.grid.getTopLeftPoint === "function") {
            const p = canvas.grid.getTopLeftPoint({ x, y });
            targetX = p.x;
            targetY = p.y;
        } else {
            // Fallback to snapped position
            const snapped = canvas.grid.getSnappedPosition(x, y);
            targetX = snapped.x;
            targetY = snapped.y;
        }

        // Create token
        let actor = game.actors.get(nextToPlace.actorId);
        if (!actor && nextToPlace.actorUuid) {
            try {
                actor = await fromUuid(nextToPlace.actorUuid);
            } catch (e) {
                console.warn("Vibe Combat: Failed to resolve actor for placement", nextToPlace.actorUuid);
            }
        }

        if (actor) {
            // If the actor is from a compendium, import it into the world first
            if (actor.pack) {
                const pack = game.packs.get(actor.pack);
                if (pack) {
                    try {
                        // Check if we already imported this actor to the world
                        let worldActor = game.actors.find(a => a.flags?.core?.sourceId === actor.uuid);
                        if (!worldActor) {
                            worldActor = await game.actors.importFromCompendium(pack, actor.id);
                        }
                        if (worldActor) actor = worldActor;
                    } catch (e) {
                        console.warn("Vibe Combat: Failed to import actor from compendium", e);
                    }
                }
            }

            const tokenData = await actor.getTokenDocument({
                x: targetX,
                y: targetY,
                hidden: false
            });

            await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
        } else {
            ui.notifications.warn(`Could not find actor for ${nextToPlace.name}`);
        }

        this._placementIndex++;

        // Continue placement
        // Add a small delay to prevent double clicks or immediate re-triggering
        setTimeout(() => {
            this._activatePlacementTool();
        }, 200);
    }

    _onPlacementCancel(event) {
        // Remove the click listener
        if (this._placementHandlers?.click) {
            canvas.stage.off('mousedown', this._placementHandlers.click);
        }

        ui.notifications.info("Placement cancelled.");
        this.app.maximize();
    }
}
