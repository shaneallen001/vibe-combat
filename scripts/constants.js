/**
 * Constants for Vibe Combat Module
 * Contains CR options, creature types, sizes, and XP tables
 */

/**
 * Generate CR options array (0, 1/8, 1/4, 1/2, 1-30)
 */
export function getCrOptions() {
  const crOptions = ["0", "1/8", "1/4", "1/2"];
  for (let i = 1; i <= 30; i++) {
    crOptions.push(i.toString());
  }
  return crOptions;
}

/**
 * Creature type options for D&D 5e
 */
export const CREATURE_TYPES = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead"
];

/**
 * Size options for D&D 5e
 */
export const SIZE_OPTIONS = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

/**
 * XP values by Challenge Rating
 * Based on D&D 5e DMG table: Experience Points by Challenge Rating (page 274)
 */
export const CR_XP_TABLE = {
  0: 0,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000
};

/**
 * XP Thresholds by Character Level
 * Based on D&D 5e DMG table: XP Thresholds by Character Level (page 82)
 */
export const XP_THRESHOLDS_BY_LEVEL = {
  1: { low: 50, medium: 75, high: 100, deadly: 100 },
  2: { low: 100, medium: 150, high: 200, deadly: 200 },
  3: { low: 150, medium: 225, high: 400, deadly: 400 },
  4: { low: 250, medium: 375, high: 500, deadly: 500 },
  5: { low: 500, medium: 750, high: 1100, deadly: 1100 },
  6: { low: 600, medium: 1000, high: 1400, deadly: 1400 },
  7: { low: 750, medium: 1300, high: 1700, deadly: 1700 },
  8: { low: 1000, medium: 1700, high: 2100, deadly: 2100 },
  9: { low: 1300, medium: 2000, high: 2600, deadly: 2600 },
  10: { low: 1600, medium: 2300, high: 3100, deadly: 3100 },
  11: { low: 1900, medium: 2900, high: 4100, deadly: 4100 },
  12: { low: 2200, medium: 3700, high: 4700, deadly: 4700 },
  13: { low: 2600, medium: 4200, high: 5400, deadly: 5400 },
  14: { low: 2900, medium: 4900, high: 6200, deadly: 6200 },
  15: { low: 3300, medium: 5400, high: 7800, deadly: 7800 },
  16: { low: 3800, medium: 6100, high: 9800, deadly: 9800 },
  17: { low: 4500, medium: 7200, high: 11700, deadly: 11700 },
  18: { low: 5000, medium: 8700, high: 14200, deadly: 14200 },
  19: { low: 5500, medium: 10700, high: 17200, deadly: 17200 },
  20: { low: 6400, medium: 13200, high: 22000, deadly: 22000 }
};

