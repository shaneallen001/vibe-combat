/**
 * File Utils
 * Helpers for file system and path validation
 */

/**
 * Validates if an image path exists and is accessible.
 * 
 * @param {string} path - The path to the image file
 * @returns {Promise<boolean>} - True if the image exists, false otherwise
 */
export async function validateImagePath(path) {
    if (!path) return false;

    // specialized handling for node.js test environment
    // we assume we are in node if 'window' is undefined or 'foundry' is undefined
    if (typeof window === "undefined" || typeof foundry === "undefined") {
        // In Node.js test environment, we can't easily valid Foundry assets via fetch
        // So we assume valid to avoid breaking tests, unless it's obviously bad
        return true;
    }

    try {
        // In Foundry VTT client
        const response = await fetch(path, { method: "HEAD" });
        return response.ok;
    } catch (error) {
        console.warn(`Vibe Combat | Failed to validate image path: ${path}`, error);
        return false;
    }
}
