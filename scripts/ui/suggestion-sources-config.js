const MODULE_ID = "vibe-combat";

export class SuggestionSourcesConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vibe-combat-suggestion-sources",
      title: "Vibe Combat: Encounter Suggestion Sources",
      template: "modules/vibe-combat/templates/suggestion-sources.html",
      width: 520,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    });
  }

  getData(options = {}) {
    const selectedPackIds =
      game.settings.get(MODULE_ID, "suggestionSourceCompendiums") ?? [];
    const includeWorldActors =
      game.settings.get(MODULE_ID, "suggestionIncludeWorldActors") ?? true;

    const actorPacks = Array.from(game.packs ?? [])
      .filter((pack) => pack.documentName === "Actor")
      .map((pack) => ({
        packId: pack.collection,
        label: getPackDisplayLabel(pack),
        checked: Array.isArray(selectedPackIds) && selectedPackIds.includes(pack.collection)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      ...(super.getData?.(options) ?? {}),
      includeWorldActors: includeWorldActors !== false,
      actorPacks
    };
  }

  async _updateObject(event, formData) {
    const includeWorldActors = Boolean(formData?.includeWorldActors);
    const rawPackIds = formData?.packIds;
    const selectedPackIds = rawPackIds
      ? Array.isArray(rawPackIds)
        ? rawPackIds.map((id) => String(id))
        : [String(rawPackIds)]
      : [];

    await game.settings.set(MODULE_ID, "suggestionIncludeWorldActors", includeWorldActors);
    await game.settings.set(MODULE_ID, "suggestionSourceCompendiums", selectedPackIds);
  }
}

function getPackDisplayLabel(pack) {
  const raw = String(pack?.metadata?.label || "").trim();
  const docName = String(pack?.documentName || "").trim().toLowerCase();
  const isGeneric =
    !raw ||
    raw.toLowerCase() === "actors" ||
    raw.toLowerCase() === "actor" ||
    (docName && raw.toLowerCase() === docName);
  if (!isGeneric) return raw;

  const collection = String(pack?.collection || "").trim();
  if (!collection) return "Compendium";
  const parts = collection.split(".");
  if (parts.length <= 1) return collection;
  const type = parts[parts.length - 1];
  const base = parts.slice(0, -1).join(" ");
  const niceBase = base
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (type.toLowerCase() === "actors") return niceBase || collection;
  return `${niceBase || collection} (${type})`;
}

