import { VibeToast } from "../../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Encounter Dialogs
 * Dialogs for saving and loading encounters, and adding stand-ins
 */

import { getCrOptions } from "../../constants.js";

export class EncounterDialogs {
    static showSaveEncounter(encounterManager) {
        if (encounterManager.entries.length === 0) {
            VibeToast.warn("Cannot save an empty encounter.");
            return;
        }

        const defaultEncounterId = game.settings.get("vibe-combat", "defaultEncounterId");
        const isDefaultEncounter = defaultEncounterId && encounterManager.isCurrentEncounterDefault();

        const content = `
      <form>
        <div class="form-group">
          <label>Encounter Name:</label>
          <input type="text" name="encounterName" style="width: 100%; margin-bottom: 8px;" placeholder="Enter encounter name..." required>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" name="setAsDefault" ${isDefaultEncounter ? "checked" : ""}>
            Set as default encounter
          </label>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
            The default encounter will automatically load when opening Vibe Combat.
          </p>
        </div>
      </form>
    `;

        new Dialog({
            title: "Save Encounter",
            content: content,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "Save",
                    callback: (html) => {
                        const encounterName = html.find('[name="encounterName"]').val().trim();
                        const setAsDefault = html.find('[name="setAsDefault"]').is(':checked');

                        if (!encounterName) {
                            VibeToast.warn("Please enter an encounter name.");
                            return;
                        }

                        encounterManager.saveEncounter(encounterName, setAsDefault);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "save",
            close: () => { }
        }).render(true);
    }

    static showLoadEncounter(encounterManager, onUpdate) {
        const savedEncounters = game.settings.get("vibe-combat", "savedEncounters");
        const defaultEncounterId = game.settings.get("vibe-combat", "defaultEncounterId");

        const encounterEntries = Object.entries(savedEncounters);
        if (encounterEntries.length === 0) {
            VibeToast.warn("No saved encounters found.");
            return;
        }

        const encounterListItems = encounterEntries.map(([id, encounter]) => {
            const isDefault = id === defaultEncounterId;
            return `
        <div class="vibe-encounter-item" data-encounter-id="${id}">
          <div class="encounter-item-content">
            <button type="button" class="encounter-default-toggle" data-encounter-id="${id}" title="Set as default encounter">
              <i class="fas fa-star ${isDefault ? 'default-active' : ''}"></i>
            </button>
            <span class="encounter-name">${encounter.name}</span>
          </div>
          <div class="encounter-item-actions">
            <button type="button" class="encounter-load-btn" data-encounter-id="${id}" title="Load encounter">
              <i class="fas fa-folder-open"></i>
            </button>
            <button type="button" class="encounter-delete-btn" data-encounter-id="${id}" title="Delete encounter">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
        }).join('');

        const content = `
      <div class="vibe-encounter-list-dialog">
        <div class="encounter-list-container">
          ${encounterListItems}
        </div>
      </div>
    `;

        const dialog = new Dialog({
            title: "Load Encounter",
            content: content,
            buttons: {},
            default: "",
            close: () => { }
        });

        dialog.render(true);

        // Set dialog width via CSS
        dialog.element.css("width", "400px");

        // Use requestAnimationFrame to ensure DOM is ready before attaching handlers
        requestAnimationFrame(() => {
            // Handle default toggle
            dialog.element.find(".encounter-default-toggle").on("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const encounterId = $(event.currentTarget).data("encounter-id");
                const currentDefault = game.settings.get("vibe-combat", "defaultEncounterId");

                if (encounterId === currentDefault) {
                    // Unset default
                    await game.settings.set("vibe-combat", "defaultEncounterId", null);
                    dialog.element.find(".encounter-default-toggle .fa-star").removeClass("default-active");
                } else {
                    // Set as default
                    await encounterManager.setDefaultEncounter(encounterId);
                    dialog.element.find(".encounter-default-toggle .fa-star").removeClass("default-active");
                    $(event.currentTarget).find(".fa-star").addClass("default-active");
                }
            });

            // Handle load button
            dialog.element.find(".encounter-load-btn").on("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const encounterId = $(event.currentTarget).data("encounter-id");
                dialog.close();
                await encounterManager.loadEncounterById(encounterId, true);
                if (onUpdate) onUpdate();
            });

            // Handle delete button
            dialog.element.find(".encounter-delete-btn").on("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const encounterId = $(event.currentTarget).data("encounter-id");
                const encounter = savedEncounters[encounterId];

                if (encounter) {
                    new Dialog({
                        title: "Delete Encounter",
                        content: `<p>Are you sure you want to delete "<strong>${encounter.name}</strong>"?</p>`,
                        buttons: {
                            yes: {
                                icon: '<i class="fas fa-check"></i>',
                                label: "Delete",
                                callback: async () => {
                                    await encounterManager.deleteEncounter(encounterId);
                                    // Refresh the dialog
                                    dialog.close();
                                    EncounterDialogs.showLoadEncounter(encounterManager, onUpdate);
                                }
                            },
                            no: {
                                icon: '<i class="fas fa-times"></i>',
                                label: "Cancel"
                            }
                        },
                        default: "no"
                    }).render(true);
                }
            });
        });

        // Add hover effects
        dialog.element.find(".vibe-encounter-item").on("mouseenter", function () {
            $(this).addClass("hover");
        }).on("mouseleave", function () {
            $(this).removeClass("hover");
        });
    }

    static showAddStandIn(encounterManager, onUpdate) {
        const crOptions = getCrOptions();
        const content = `
      <form>
        <div class="form-group">
          <label>Challenge Rating (CR):</label>
          <select name="cr" style="width: 100%; margin-bottom: 8px;">
            ${crOptions.map(cr => `<option value="${cr}">${cr}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity:</label>
          <input type="number" name="quantity" value="1" min="1" style="width: 100%;">
        </div>
      </form>
    `;

        new Dialog({
            title: "Add Stand-In",
            content: content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-user-plus"></i>',
                    label: "Add Stand-In",
                    callback: (html) => {
                        const cr = html.find('[name="cr"]').val();
                        const quantity = parseInt(html.find('[name="quantity"]').val()) || 1;
                        if (encounterManager.addEntry(cr, quantity)) {
                            if (onUpdate) onUpdate();
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "add"
        }).render(true);
    }
}
