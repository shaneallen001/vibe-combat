# Vibe Combat

## Overview
**Vibe Combat** is a Foundry VTT module focused on enhancing the combat experience with AI-assisted encounter building and management. It works in tandem with `vibe-common` and optionally `vibe-actor`.

## Features

### 1. AI Encounter Suggestions
-   **Context-Aware Suggestions**: Analyze the current party composition and generate balanced encounter ideas based on CR and party size.
-   **Catalog Constraints**: Optionally constrain suggestions to monsters available in your Compendiums or World Actors.

### 2. Party XP Budgeting
-   **Real-time Calculations**: Automatically calculates the party's daily XP budget and encounter difficulty thresholds (Easy, Medium, Hard, Deadly).
-   **Drag-and-Drop Workflow**: Build parties and encounters by dragging actors directly into the Combat Tracker.

### 3. Encounter Management
-   **Save & Load**: Save generated parties and encounters for later use.
-   **Quick Setup**: Rapidly clear and rebuild the tracker for new battles.

## Installation
1.  Ensure **`vibe-common`** is installed and enabled.
2.  Install **`vibe-combat`** into your `Data/modules/` directory.
3.  Enable the module.

> **Recommended**: Install `vibe-actor` for AI NPC generation capabilities.

## Configuration
Go to **Settings -> Configure Settings -> Vibe Combat**:

-   **Gemini API Key**: Required for AI Encounter Suggestions.
-   **Encounter Settings**: Configure saved parties and suggestion sources.

## Usage

1.  Open the **Combat Tracker**.
2.  Click the **"Vibe Combat"** button.
3.  **Party Tab**: Drag player actors here to calculate thresholds.
4.  **Encounters Tab**: Drag monsters here to build an encounter. See difficulty ratings update in real-time.
5.  **Suggestions**: Click "Suggest Encounter" to get AI-generated ideas.

## Developer Guide

### Dependencies
-   **`vibe-common`**: Provides shared constants, math, and the `GeminiService`.
-   **`vibe-actor`**: (Optional) Handles actor generation. `vibe-combat` does not depend on `vibe-actor` code, but they are designed to work together.

### Runtime
-   `scripts/main.js`: Registers Combat-specific hooks.
-   `scripts/ui/vibe-combat-app.js`: Main application logic for the Combat Tracker overlay.
