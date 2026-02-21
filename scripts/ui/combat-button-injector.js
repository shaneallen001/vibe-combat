import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Add the Vibe Combat button to the Combat Tracker.
 * Compatible with Foundry VTT v13 (ApplicationV2 - native HTMLElement)
 * and legacy versions (jQuery objects).
 */
export function addVibeCombatButton(app, html, VibeCombatAppClass) {
  let trackerElement = null;

  // In v13 ApplicationV2, app.element is a native HTMLElement (not jQuery array)
  if (app?.element instanceof HTMLElement) {
    trackerElement = app.element;
  } else if (app?.element?.[0] instanceof HTMLElement) {
    // Legacy jQuery-style
    trackerElement = app.element[0];
  }

  // html can be a native HTMLElement (v13) or jQuery (legacy)
  if (!trackerElement) {
    if (html instanceof HTMLElement) {
      trackerElement = html;
    } else if (html?.[0] instanceof HTMLElement) {
      trackerElement = html[0];
    }
  }

  // DOM fallbacks
  if (!trackerElement) {
    trackerElement = document.querySelector("#combat");
  }
  if (!trackerElement) {
    trackerElement = document.querySelector("[data-tab='combat']");
  }
  if (!trackerElement) {
    trackerElement = document.querySelector(".combat-tracker");
  }

  if (!trackerElement) {
    console.warn("Vibe Combat: Could not find Combat Tracker element");
    return;
  }

  // Avoid duplicate buttons
  if (trackerElement.querySelector(".vibe-combat-button")) return;

  const button = document.createElement("button");
  button.className = "vibe-combat-button";
  button.type = "button";
  button.innerHTML = '<i class="fas fa-swords"></i> Vibe Combat';

  button.addEventListener("click", () => {
    if (!game.user.isGM) {
      VibeToast.warn("Only the GM can use Vibe Combat.");
      return;
    }
    new VibeCombatAppClass().render(true);
  });

  // Prefer the footer area (standard in v13 combat tab)
  const footer = trackerElement.querySelector(
    "#combat-footer, .combat-footer, .directory-footer, .action-buttons, .encounter-controls"
  );
  if (footer) {
    footer.appendChild(button);
    console.log("Vibe Combat: Button added to footer");
    return;
  }

  // Try next to existing combat control buttons
  const allButtons = trackerElement.querySelectorAll("button");
  for (const existing of allButtons) {
    const text = (existing.textContent || existing.innerText || "").toLowerCase();
    if (
      text.includes("roll") ||
      text.includes("reset") ||
      text.includes("begin") ||
      text.includes("end turn") ||
      text.includes("next") ||
      text.includes("combatant")
    ) {
      existing.parentNode?.appendChild(button);
      console.log("Vibe Combat: Button added next to combat controls");
      return;
    }
  }

  // Try the header
  const header = trackerElement.querySelector(
    "#combat-header, .combat-tracker-header, header, .window-header"
  );
  if (header) {
    header.appendChild(button);
    console.log("Vibe Combat: Button added to header");
    return;
  }

  // Final fallback: prepend a container to the tracker element
  const container = document.createElement("div");
  container.className = "vibe-combat-button-container";
  container.style.cssText = "padding:6px 8px; border-bottom:1px solid var(--color-border-light, #e0e0e0);";
  container.appendChild(button);
  trackerElement.insertBefore(container, trackerElement.firstChild);
  console.log("Vibe Combat: Button added via fallback container");
}
