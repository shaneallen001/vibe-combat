/**
 * XP Calculation Utilities
 * Functions for calculating XP budgets and encounter XP
 */

import { CR_XP_TABLE, XP_THRESHOLDS_BY_LEVEL } from "../constants.js";
import { getActorLevel } from "./actor-helpers.js";

/**
 * Get XP value for a given Challenge Rating
 * Based on D&D 5e DMG table: Experience Points by Challenge Rating (page 274)
 * Uses dnd5e system's built-in values if available, otherwise falls back to hardcoded table
 */
export function getXpForCr(cr) {
  // Try to use dnd5e system's built-in CR-to-XP mapping if available
  if (game.system.id === "dnd5e" && game.dnd5e?.config?.crValues) {
    const xp = game.dnd5e.config.crValues[cr];
    if (xp !== undefined) {
      return xp;
    }
  }

  // Fallback to hardcoded table (DMG page 274)
  // Handle both string and number CR values
  const crKey = typeof cr === "string" ? cr : cr.toString();
  return CR_XP_TABLE[crKey] || CR_XP_TABLE[cr] || 0;
}

/**
 * Get XP thresholds for a given character level
 * Based on D&D 5e DMG table: XP Thresholds by Character Level
 * Uses dnd5e system's built-in values if available, otherwise falls back to hardcoded table
 */
export function getXpThresholdsForLevel(level) {
  // Try to use dnd5e system's built-in XP threshold data if available
  if (game.system.id === "dnd5e" && game.dnd5e?.config?.encounterThresholds) {
    const thresholds = game.dnd5e.config.encounterThresholds[level];
    if (thresholds) {
      return {
        low: thresholds.easy || thresholds.low,
        medium: thresholds.medium,
        high: thresholds.hard || thresholds.high,
        deadly: thresholds.deadly
      };
    }
  }

  // Fallback to hardcoded table (DMG page 82)
  const thresholds = XP_THRESHOLDS_BY_LEVEL[Math.min(Math.max(level, 1), 20)] || XP_THRESHOLDS_BY_LEVEL[1];

  return {
    low: thresholds.low,
    medium: thresholds.medium,
    high: thresholds.high
  };
}

/**
 * Calculate XP budgets based on D&D 5e rules
 * Uses the XP Thresholds by Character Level table from the DMG
 */
export function calculateXpBudgets(partyMembers) {
  if (partyMembers.length === 0) {
    return {
      low: 0,
      medium: 0,
      high: 0
    };
  }

  let totalLow = 0;
  let totalMedium = 0;
  let totalHigh = 0;

  partyMembers.forEach(actor => {
    const level = getActorLevel(actor);
    const thresholds = getXpThresholdsForLevel(level);

    totalLow += thresholds.low;
    totalMedium += thresholds.medium;
    totalHigh += thresholds.high;
  });

  return {
    low: totalLow,
    medium: totalMedium,
    high: totalHigh
  };
}

/**
 * Calculate total XP for an encounter
 */
export function calculateEncounterXp(encounterEntries) {
  if (!encounterEntries || !Array.isArray(encounterEntries)) return 0;
  let total = 0;
  encounterEntries.forEach(entry => {
    const xpPerCreature = getXpForCr(entry.cr);
    const quantityRaw = Number(entry.quantity);
    const quantity = Math.max(Number.isFinite(quantityRaw) ? Math.floor(quantityRaw) : 1, 0);
    total += xpPerCreature * quantity;
  });
  return total;
}

