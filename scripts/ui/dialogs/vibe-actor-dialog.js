/**
 * Vibe Actor Dialog
 * Dialog and Gemini API integration for generating actors
 */

import { getCrOptions, CREATURE_TYPES, SIZE_OPTIONS } from "../../constants.js";
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { ensureItemHasId, ensureActivityIds } from "../../factories/actor-factory.js";
import { ImageGenerator } from "../image-generator.js";

export class VibeActorDialog {
  static show() {
    const apiKey = game.settings.get("vibe-combat", "geminiApiKey");
    if (!apiKey || apiKey.trim() === "") {
      ui.notifications.error("Please configure your Gemini API key in module settings first.");
      return;
    }

    // Generate CR options
    const crOptions = getCrOptions();

    const content = `
      <form>
        <div class="form-group">
          <label>Challenge Rating (CR):</label>
          <select name="cr" style="width: 100%; margin-bottom: 8px;">
            <option value="">Any</option>
            ${crOptions.map(cr => `<option value="${cr}" ${cr === "1" ? "selected" : ""}>${cr}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Type:</label>
          <select name="type" style="width: 100%; margin-bottom: 8px;">
            <option value="">Any</option>
            ${CREATURE_TYPES.map(type => `<option value="${type}" ${type === "Humanoid" ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Size:</label>
          <select name="size" style="width: 100%; margin-bottom: 8px;">
            <option value="">Any</option>
            ${SIZE_OPTIONS.map(size => `<option value="${size}" ${size === "Medium" ? "selected" : ""}>${size}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Description/Prompt:</label>
          <textarea name="prompt" rows="4" style="width: 100%; margin-bottom: 8px;" placeholder="Describe the creature you want to generate...">Rowdy tavern brawler</textarea>
        </div>
        <div class="form-group">
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" name="generateImage" checked>
            Generate Image after creation?
          </label>
        </div>
      </form>
    `;

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
