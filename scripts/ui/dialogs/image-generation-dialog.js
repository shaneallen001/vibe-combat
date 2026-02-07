/**
 * Image Generation Dialog
 * Dialog for collecting user input for image generation
 */

export class ImageGenerationDialog {
  static async prompt(defaultName) {
    return new Promise((resolve) => {
      const content = `
        <div style="display:grid; gap:0.5rem;">
          <div>
            <label>Subject (short)</label>
            <input name="subject" type="text" value="${defaultName || ""}" placeholder="e.g., Elf ranger">
          </div>
          <div>
            <label>Description (details, style, mood)</label>
            <textarea name="desc" rows="5" placeholder="Pose, gear, lighting, background, art style..."></textarea>
          </div>
          <label style="display:flex; gap:.5rem; align-items:center;">
            <input type="checkbox" name="transparent" checked/>
            Transparent background
          </label>
          <p style="margin:.25rem 0 0; font-size:12px; opacity:.8">
            Streaming is on; image will update 1-3 times before the final.
          </p>
        </div>
      `;
      new Dialog({
        title: "Generate Actor Image",
        content,
        buttons: {
          ok: {
            label: "Generate",
            icon: '<i class="fas fa-wand-magic-sparkles"></i>',
            callback: (html) => {
              const subject = html.find('[name="subject"]').val()?.trim();
              const desc = html.find('[name="desc"]').val()?.trim();
              const finalPrompt = (subject || desc) ? [subject, desc].filter(Boolean).join(": ") : "";
              const wantTransparent = html.find('[name="transparent"]')[0]?.checked;
              resolve({ prompt: finalPrompt, background: wantTransparent ? "transparent" : "auto" });
            }
          },
          cancel: { label: "Cancel", callback: () => resolve({}) }
        },
        default: "ok",
        close: () => resolve({})
      }).render(true);
    });
  }
}
