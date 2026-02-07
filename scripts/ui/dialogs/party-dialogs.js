/**
 * Party Dialogs
 * Dialogs for saving and loading parties
 */

export class PartyDialogs {
    static showSaveParty(partyManager) {
        if (partyManager.members.length === 0) {
            ui.notifications.warn("Cannot save an empty party.");
            return;
        }

        const defaultPartyId = game.settings.get("vibe-combat", "defaultPartyId");
        const isDefaultParty = defaultPartyId && partyManager.isCurrentPartyDefault();

        const content = `
      <form>
        <div class="form-group">
          <label>Party Name:</label>
          <input type="text" name="partyName" style="width: 100%; margin-bottom: 8px;" placeholder="Enter party name..." required>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" name="setAsDefault" ${isDefaultParty ? "checked" : ""}>
            Set as default party
          </label>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
            The default party will automatically load when opening Vibe Combat.
          </p>
        </div>
      </form>
    `;

        new Dialog({
            title: "Save Party",
            content: content,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "Save",
                    callback: (html) => {
                        const partyName = html.find('[name="partyName"]').val().trim();
                        const setAsDefault = html.find('[name="setAsDefault"]').is(':checked');

                        if (!partyName) {
                            ui.notifications.warn("Please enter a party name.");
                            return;
                        }

                        partyManager.saveParty(partyName, setAsDefault);
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

    static showLoadParty(partyManager, onUpdate) {
        const savedParties = game.settings.get("vibe-combat", "savedParties");
        const defaultPartyId = game.settings.get("vibe-combat", "defaultPartyId");

        const partyEntries = Object.entries(savedParties);
        if (partyEntries.length === 0) {
            ui.notifications.warn("No saved parties found.");
            return;
        }

        const partyListItems = partyEntries.map(([id, party]) => {
            const isDefault = id === defaultPartyId;
            return `
        <div class="vibe-party-item" data-party-id="${id}">
          <div class="party-item-content">
            <button type="button" class="party-default-toggle" data-party-id="${id}" title="Set as default party">
              <i class="fas fa-star ${isDefault ? 'default-active' : ''}"></i>
            </button>
            <span class="party-name">${party.name}</span>
          </div>
          <div class="party-item-actions">
            <button type="button" class="party-load-btn" data-party-id="${id}" title="Load party">
              <i class="fas fa-folder-open"></i>
            </button>
            <button type="button" class="party-delete-btn" data-party-id="${id}" title="Delete party">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
        }).join('');

        const content = `
      <div class="vibe-party-list-dialog">
        <div class="party-list-container">
          ${partyListItems}
        </div>
      </div>
    `;

        const dialog = new Dialog({
            title: "Load Party",
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
            dialog.element.find(".party-default-toggle").on("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const partyId = $(event.currentTarget).data("party-id");
                const currentDefault = game.settings.get("vibe-combat", "defaultPartyId");

                if (partyId === currentDefault) {
                    // Unset default
                    await game.settings.set("vibe-combat", "defaultPartyId", null);
                    dialog.element.find(".party-default-toggle .fa-star").removeClass("default-active");
                } else {
                    // Set as default
                    await partyManager.setDefaultParty(partyId);
                    dialog.element.find(".party-default-toggle .fa-star").removeClass("default-active");
                    $(event.currentTarget).find(".fa-star").addClass("default-active");
                }
            });

            // Handle load button
            dialog.element.find(".party-load-btn").on("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const partyId = $(event.currentTarget).data("party-id");
                dialog.close();
                await partyManager.loadPartyById(partyId, true);
                if (onUpdate) onUpdate();
            });

            // Handle delete button
            dialog.element.find(".party-delete-btn").on("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const partyId = $(event.currentTarget).data("party-id");
                const party = savedParties[partyId];

                if (party) {
                    new Dialog({
                        title: "Delete Party",
                        content: `<p>Are you sure you want to delete "<strong>${party.name}</strong>"?</p>`,
                        buttons: {
                            yes: {
                                icon: '<i class="fas fa-check"></i>',
                                label: "Delete",
                                callback: async () => {
                                    await partyManager.deleteParty(partyId);
                                    // Refresh the dialog
                                    dialog.close();
                                    PartyDialogs.showLoadParty(partyManager, onUpdate);
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
        dialog.element.find(".vibe-party-item").on("mouseenter", function () {
            $(this).addClass("hover");
        }).on("mouseleave", function () {
            $(this).removeClass("hover");
        });
    }
}
