/**
 * Vibe Actor Dialog
 * Dialog and Gemini API integration for generating actors
 */

import { getCrOptions, CREATURE_TYPES, SIZE_OPTIONS } from "../../constants.js";
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { ensureItemHasId, ensureActivityIds } from "../../factories/actor-factory.js";
import { ImageGenerator } from "../image-generator.js";

export class VibeActorDialog {
  static async show() {
    const apiKey = game.settings.get("vibe-combat", "geminiApiKey");
    if (!apiKey || apiKey.trim() === "") {
      ui.notifications.error("Please configure your Gemini API key in module settings first.");
      return;
    }

    // Generate context for template
    const context = {
      crOptions: getCrOptions(),
      typeOptions: CREATURE_TYPES,
      sizeOptions: SIZE_OPTIONS
    };

    const content = await renderTemplate("modules/vibe-combat/templates/vibe-actor-dialog.html", context);

    new Dialog({
      title: "Vibe Actor - Generate Creature",
      content: content,
      buttons: {
        generate: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Generate",
          callback: async (html) => {
            const cr = html.find('[name="cr"]').val();
            const type = html.find('[name="type"]').val();
            const size = html.find('[name="size"]').val();
            const prompt = html.find('[name="prompt"]').val();

            const generateImage = html.find('[name="generateImage"]').is(":checked");

            if (!prompt || prompt.trim() === "") {
              ui.notifications.warn("Please provide a description/prompt for the creature.");
              return;
            }

            // Note: generateActor is static, so we call VibeActorDialog.generateActor
            // (or this.generateActor if 'this' is bound to the class, which it is in a static method)
            await this.generateActor(cr, type, size, prompt, generateImage);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "generate"
    }).render(true);
  }

  static async generateActor(cr, type, size, prompt, generateImage) {
    const apiKey = game.settings.get("vibe-combat", "geminiApiKey");

    if (!apiKey || apiKey.trim() === "") {
      ui.notifications.error("Gemini API key is not configured.");
      return;
    }

    // Show loading notification
    const notification = ui.notifications.info("Generating actor with Gemini Pipeline...", { permanent: true });

    try {
      const pipeline = new GeminiPipeline(apiKey);
      const actorData = await pipeline.generateActor({ cr, type, size, prompt });

      // Ensure the actor has the correct structure for dnd5e
      if (!actorData.name) {
        throw new Error("Generated actor data is missing required fields.");
      }

      // Create the actor
      const actor = await Actor.create(actorData, { renderSheet: true });
      if (!actor) {
        throw new Error("Failed to create actor document.");
      }

      notification.remove();
      ui.notifications.info(`Successfully created actor: ${actor.name}`);

      if (generateImage) {
        await ImageGenerator.generateImage(actor);
      }

    } catch (error) {
      notification.remove();
      console.error("Error generating actor:", error);
      ui.notifications.error(`Failed to generate actor: ${error.message}`);
    }
  }
}
