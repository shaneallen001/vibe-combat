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
1.  Ensure **`vibe-common`** is installed and enabled (vibe-combat will cleanly abort initialization and show an error notification if this dependency is missing).
2.  Install **`vibe-combat`** into your `Data/modules/` directory.
3.  Enable the module.

> **Recommended**: Install `vibe-actor` for AI NPC generation capabilities.

## Configuration
- **API Keys**: Configure your Gemini API key in the **Vibe Common** module settings.
- **Vibe Combat Settings**: Go to **Settings -> Configure Settings -> Vibe Combat** to configure saved parties and suggestion sources.

## Usage

1.  Open the **Combat Tracker**.
2.  Click the **"Vibe Combat"** button.
3.  **Party Tab**: Drag player actors here to calculate thresholds.
4.  **Encounters Tab**: Drag monsters here to build an encounter. See difficulty ratings update in real-time.
5.  **Suggestions**: Click "Suggest Encounter" to get AI-generated ideas.

---

## Developer Guide

For information on module extenisbility, APIs, rendering hooks, components, and encounter data flow, please see [ARCHITECTURE.md](./ARCHITECTURE.md).
