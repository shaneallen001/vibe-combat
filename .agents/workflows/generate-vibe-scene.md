---
description: how to run the vibe scene 2 generation process end-to-end through Foundry VTT
---

# Generate Vibe Scene Two Process

This workflow allows you (the agent) to trigger the end-to-end Vibe Scene Two generation pipeline via the browser in Foundry VTT. It relies on executing JavaScript directly in the Foundry VTT browser session rather than manual UI clicks, to ensure consistent and reliable testing.

## Prerequisites
1. You must be connected to the Foundry VTT server via the `browser_subagent`. If you aren't already connected, log in to `http://192.168.86.28:30000/` or `http://174.53.226.172:30000/` as the `Antigravity` user.
2. Ensure you are on the game view interface, not the login screen.

## Steps to Execute

1. **Start the Browser Subagent**
   Use the `browser_subagent` tool with a specific `Task`, asking it to run the scene generation.
   
   Here is an exact JavaScript sequence it should execute step-by-step:
   
   *Step 1: Open the App*
   ```javascript
   new game.modules.get('vibe-scene-two').api.GeneratorApp().render(true);
   ```
   *Step 2: Enter the Prompt and Generate*
   You can instruct the browser subagent to fill out the `<textarea class="vibe-input">` (or similar prompt input field) inside the app with a desired scene description (e.g., "A creepy abandoned graveyard with a mausoleum") and then submit the form by clicking the "Generate Layout" or "Submit" button.

2. **Wait for Generation**
   The subagent will need to wait for the generation pipeline to complete. This is a multi-step process:
   - Generating outline/SVG layout.
   - Using Imagen 4 to create the JPEG base image map.
   - Parsing the results and creating the Scene.

   Instruct the subagent to wait for the "Create Scene" button to become available (which indicates the map render is finished) and then click it.

3. **Verify**
   Once the process completes, the UI will transition the current view to the newly generated scene. Instruct the subagent to capture a screenshot (`capture_browser_screenshot`) of the final active Foundry VTT canvas to verify success.

4. **Return Results**
   The browser subagent should return success after validating the scene is correctly created.
