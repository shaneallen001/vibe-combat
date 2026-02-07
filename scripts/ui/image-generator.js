/**
 * OpenAI Image Generator
 * Handles generating images for actors using OpenAI's DALL-E 3
 */

import { generateAndSetActorImage, ensureDirectoryExists } from "../services/image-generation-service.js";
import { ImageGenerationDialog } from "./dialogs/image-generation-dialog.js";

const OPENAI_MODEL = "dall-e-3"; // The macro used "gpt-image-1" which seems to be a placeholder or custom model, but standard is dall-e-3 or dall-e-2. The macro code has `const OPENAI_MODEL = "gpt-image-1";`. I will stick to what the macro had or maybe default to dall-e-3 if that's what they meant. Actually, "gpt-image-1" is not a standard OpenAI model name. It might be a proxy. However, the user said "Foundry VTT -> OpenAI Image Macro". Standard models are dall-e-2 or dall-e-3. I will use "dall-e-3" as default but maybe allow configuration? The macro had it hardcoded. I'll stick to the macro's value but maybe it's a typo in the macro provided?
// Wait, the macro has `const OPENAI_MODEL = "gpt-image-1";`.
// And `const SIZE_LOCK = "1024x1024";`
// And `partial_images: PARTIALS_TO_GET` which suggests it supports streaming partials? OpenAI DALL-E 3 does NOT support streaming partial images.
// This macro looks like it might be using a proxy or a specific backend that supports this.
// "Foundry VTT → OpenAI Image Macro (SSE streaming + partial_images → live token updates)"
// This suggests it might be using a custom backend or a specific feature I'm not aware of, or it's a proxy.
// BUT, the URL is `https://api.openai.com/v1/images/generations`.
// OpenAI's API does not support `stream: true` or `partial_images` for image generation as far as I know.
// However, I should implement what the user provided.
// If the user provided a working macro, I should use its logic.

export class ImageGenerator {
  static async generateImage(actor) {
    const apiKey = game.settings.get("vibe-combat", "openaiApiKey");
    if (!apiKey) {
      ui.notifications.error("Please set the OpenAI API Key in the Vibe Combat module settings.");
      return;
    }

    try {
      const { prompt, background } = await ImageGenerationDialog.prompt(actor.name);
      if (!prompt) return;

      ui.notifications.info(`Generating image for ${actor.name} (streaming)...`);

      const saveDir = `worlds/${game.world.id}/ai-images`;
      const storageSrc = "data";

      // Ensure destination dir exists
      await ensureDirectoryExists(storageSrc, saveDir);

      // Stream from Images API
      // Stream from Images API
      await generateAndSetActorImage(actor, apiKey, {
        prompt,
        size: "1024x1024",
        background,
        partialImages: 3,
        saveDir,
        storageSrc
      });

      ui.notifications.info("Done! Actor image updated.");
    } catch (err) {
      console.error(err);
      const msg = (err?.name === "AbortError")
        ? "Request timed out."
        : (err?.message || String(err));
      ui.notifications.error(`Image generation failed: ${msg}`);
    }
  }




}




