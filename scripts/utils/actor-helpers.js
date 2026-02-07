/**
 * Actor Helper Utilities
 * Functions for extracting data from dnd5e actors
 */

/**
 * Get actor level from dnd5e system
 */
export function getActorLevel(actor) {
  // For dnd5e 5.1.8, level is typically in actor.system.details.level
  if (actor.system?.details?.level) {
    return actor.system.details.level;
  }
  // Fallback for different data structures
  if (actor.data?.data?.details?.level) {
    return actor.data.data.details.level;
  }
  return 1;
}

/**
 * Get Challenge Rating from dnd5e actor
 */
export function getActorCr(actor) {
  // For dnd5e 5.1.8, CR is typically in actor.system.details.cr
  if (actor.system?.details?.cr) {
    const cr = actor.system.details.cr;
    // Handle null or undefined CR
    if (cr === null || cr === undefined) {
      return "0";
    }
    return cr.toString();
  }
  // Fallback for different data structures
  if (actor.data?.data?.details?.cr) {
    const cr = actor.data.data.details.cr;
    if (cr === null || cr === undefined) {
      return "0";
    }
    return cr.toString();
  }
  return "0";
}

/**
 * Get actor portrait image
 */
export function getActorPortrait(actor) {
  if (actor.img) {
    return actor.img;
  }
  const prototypeTexture = actor.prototypeToken?.texture?.src;
  if (prototypeTexture) {
    return prototypeTexture;
  }
  return "icons/svg/mystery-man.svg";
}

/**
 * Determine the preferred token image for an actor encounter entry
 */
export function getEncounterTokenImage(actor) {
  if (actor.prototypeToken?.texture?.src) {
    return actor.prototypeToken.texture.src;
  }
  if (actor.img) {
    return actor.img;
  }
  return "icons/svg/mystery-man.svg";
}

/**
 * Extract the class breakdown for a dnd5e character actor
 */
export function getActorClasses(actor) {
  const classes = [];

  // Preferred source: embedded class items
  const classItems = actor?.items?.filter
    ? actor.items.filter((item) => item.type === "class")
    : [];

  if (classItems.length > 0) {
    for (const cls of classItems) {
      const levels =
        Number(foundry.utils?.getProperty(cls, "system.levels")) ||
        Number(foundry.utils?.getProperty(cls, "system.level")) ||
        0;
      classes.push({
        name: cls.name ?? "Unknown Class",
        level: levels > 0 ? levels : null
      });
    }
  } else if (actor.system?.classes && typeof actor.system.classes === "object") {
    // dnd5e v4 exposes classes on system.classes
    for (const cls of Object.values(actor.system.classes)) {
      if (!cls) continue;
      classes.push({
        name: cls.name ?? cls.identifier ?? "Unknown Class",
        level: cls.levels ?? cls.level ?? null
      });
    }
  }

  // Fallback to single entry based on total level if nothing else was found
  if (classes.length === 0 && actor.system?.details?.level) {
    classes.push({
      name: "Adventurer",
      level: actor.system.details.level
    });
  }

  return classes;
}

