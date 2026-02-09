/**
 * Vibe Adjustment Dialog
 * Dialog for adjusting an existing actor using AI
 */
import { GeminiPipeline } from "../../services/gemini-pipeline.js";

export class VibeAdjustmentDialog extends Application {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.pipeline = new GeminiPipeline(game.settings.get("vibe-combat", "geminiApiKey"));
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "vibe-adjustment-dialog",
            title: "Vibe Adjust",
            template: "modules/vibe-combat/templates/vibe-adjustment-dialog.html",
            width: 400,
            height: "auto",
            classes: ["vibe-combat-window"],
            resizable: false
        });
    }

    getData() {
        return {
            actor: this.actor,
            name: this.actor.name
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Cancel button
        html.find(".cancel-button").click(() => this.close());

        // Adjust button
        html.find(".adjust-button").click(this._onAdjust.bind(this));

        // Enter key support in textarea
        html.find("textarea").keydown((ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                this._onAdjust(ev);
            }
        });
    }

    async _onAdjust(event) {
        event.preventDefault();
        const button = this.element.find(".adjust-button");
        const originalText = button.html();

        // Get prompt
        const prompt = this.element.find("textarea[name='prompt']").val();
        if (!prompt || !prompt.trim()) {
            ui.notifications.warn("Please enter an adjustment request.");
            return;
        }

        try {
            // Set loading state
            button.prop("disabled", true);
            button.html('<i class="fas fa-spinner fa-spin"></i> Adjusting...');

            // Execute pipeline
            // The pipeline's adjustActor method now handles the actor update internally
            await this.pipeline.adjustActor(this.actor, prompt);

            ui.notifications.info(`Adjusted ${this.actor.name} successfully!`);
            this.close();

        } catch (error) {
            console.error("Vibe Combat | Adjustment Error:", error);
            ui.notifications.error(`Adjustment failed: ${error.message}`);
        } finally {
            // Reset button state
            if (this.element.find(".adjust-button").length) {
                button.prop("disabled", false);
                button.html(originalText);
            }
        }
    }
}
