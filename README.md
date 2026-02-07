# Vibe Combat

Vibe Combat is a Foundry VTT module for the dnd5e system that helps Game Masters manage party XP budgets, encounter difficulties, and generate NPC actors using Google's Gemini AI.

## Features

-   **Party XP Budget Management**: Calculate and track party XP thresholds (Easy, Medium, Hard, Deadly) based on party size and level.
-   **Encounter Difficulty Calculation**: Real-time feedback on encounter difficulty as you add monsters.
-   **AI Actor Generation**: Generate complete dnd5e NPC stat blocks from text descriptions using Google Gemini.
-   **AI Image Generation**: Generate token images for actors using OpenAI (DALL-E 3).

## Installation

1.  Download the module.
2.  Extract to your Foundry VTT `Data/modules/vibe-combat` directory.
3.  Enable the module in Foundry VTT.

## Configuration

To use the AI features, you must configure your API keys:

1.  Go to **Game Settings** -> **Configure Settings** -> **Module Settings**.
2.  Find **Vibe Combat**.
3.  Enter your **Gemini API Key** (for actor generation).
4.  Enter your **OpenAI API Key** (for image generation).

## Usage

### Vibe Combat (Encounter Builder)
Access the Vibe Combat interface via the "Vibe Combat" button in the Combat Tracker (Encounter tab).
-   **Party**: Add actors to the party to calculate the XP budget.
-   **Encounter**: Add monsters to the encounter to see the difficulty rating.

### Vibe Actor (AI Generator)
Access the Vibe Actor interface via the "Vibe Actor" button in the Actor Directory.
-   **Generate Creature**: Select CR, Type, Size, and provide a description. Click "Generate" to create a new NPC.
-   **Auto-Image**: Check "Generate Image after creation?" to automatically prompt for an image after the actor is created.

### AI Image Generation
-   **From Actor Sheet**: Open any actor sheet, click the "Configure" (or "Sheet Configuration") menu in the header, and select "Generate Image" to create or update the actor's token image using AI.

---

## Developer Guide

This section is intended for developers (human or AI) working on this module.

### Codebase Structure

The module follows a standard Foundry VTT module structure with a focus on modular JavaScript (ES modules).

```
vibe-combat/
├── module.json              # Manifest: Entry point, dependencies, and metadata
├── scripts/                 # Core logic
│   ├── main.js              # Entry point: Hooks, settings, and UI injection
│   ├── constants.js         # Shared constants (e.g., XP tables)
│   ├── settings.js          # Foundry VTT settings registration
│   ├── factories/           # Object creation logic
│   │   ├── actor-blueprint.js        # Actor Blueprint schema and validation
│   │   └── actor-factory.js          # Actor data normalization and creation
│   ├── handlers/            # UI interaction handlers
│   │   ├── drag-drop-handler.js      # Drag-and-drop logic
│   │   └── placement-handler.js      # Token placement logic
│   ├── managers/            # State management
│   │   ├── encounter-manager.js      # Encounter state and persistence
│   │   └── party-manager.js          # Party state and persistence
│   ├── services/            # External or shared services
│   │   ├── compendium-service.js     # Compendium lookup logic
│   │   ├── gemini-pipeline.js        # Orchestrates the AI actor generation pipeline
│   │   ├── gemini-service.js         # Google Gemini API interaction
│   │   └── image-generation-service.js # Image generation logic
│   ├── ui/                  # UI Components
│   │   ├── dialogs/                  # Dialog classes
│   │   │   ├── encounter-dialogs.js
│   │   │   ├── image-generation-dialog.js
│   │   │   ├── party-dialogs.js
│   │   │   └── vibe-actor-dialog.js
│   │   ├── button-injector.js        # Logic for injecting buttons into Foundry UI
│   │   ├── encounter-suggestion-service.js # Logic for AI encounter suggestions
│   │   ├── image-generator.js        # Image generation UI coordinator
│   │   └── vibe-combat-app.js        # Main Encounter Builder Application
│   └── utils/               # Helper functions
│       ├── actor-helpers.js          # Actor data extraction helpers
│       ├── drag-drop.js              # Drag-and-drop utilities
│       ├── text-utils.js             # Text processing helpers
│       └── xp-calculator.js          # XP and difficulty math
├── styles/                  # CSS
│   ├── main.css             # Base styles
│   └── components/          # Component-specific styles
│       ├── encounter.css
│       ├── party.css
│       ├── suggestion.css
│       └── xp-meter.css
└── templates/               # HTML (Handlebars)
    └── vibe-combat.html     # Template for VibeCombatApp
```

### Key Components

#### 1. Entry Point (`scripts/main.js`)
-   **Hooks**: Listens for `ready`, `renderCombatTracker`, `renderSidebarTab`, and `renderActorDirectory`.
-   **Initialization**: Verifies the `dnd5e` system and registers settings.
-   **UI Injection**: Uses `button-injector.js` to place "Vibe Combat" and "Vibe Actor" buttons in the sidebar.

#### 2. Encounter Builder (`scripts/ui/vibe-combat-app.js`)
-   **Class**: `VibeCombatApp` (extends `Application`).
-   **Responsibility**: Orchestrates the UI for Party vs. Encounter management.
-   **Delegation**:
    -   **State**: Uses `PartyManager` and `EncounterManager` for state and persistence.
    -   **Interaction**: Uses `DragDropHandler` for drag-and-drop and `PlacementHandler` for token placement.
    -   **Dialogs**: Uses `PartyDialogs` and `EncounterDialogs` for user interactions.

#### 3. Managers (`scripts/managers/`)
-   **PartyManager**: Manages party members, saves/loads parties from settings.
-   **EncounterManager**: Manages encounter entries, saves/loads encounters from settings.

#### 4. Services (`scripts/services/`)
-   **GeminiService**: Handles all interactions with the Google Gemini API.
-   **GeminiPipeline**: Orchestrates the multi-step actor generation process (Architect -> Quartermaster -> Blacksmith -> Builder).
-   **CompendiumService**: Efficiently searches and retrieves items from compendiums.
-   **ImageGenerationService**: Handles image generation requests and file saving.

#### 5. AI Actor Generator (`scripts/ui/dialogs/vibe-actor-dialog.js`)
-   **Class**: `VibeActorDialog`.
-   **Responsibility**: Collects user input and coordinates actor generation.
-   **Flow**: Uses `GeminiPipeline` to execute the generation workflow and create the actor document.

#### 6. AI Image Generator (`scripts/ui/image-generator.js`)
-   **Responsibility**: Coordinates the image generation workflow.
-   **Integration**: Uses `ImageGenerationDialog` for prompts and `ImageGenerationService` for the backend work.

### Data Flow

1.  **User Action**: User clicks "Vibe Combat" in Combat Tracker.
2.  **App Render**: `VibeCombatApp` renders using `templates/vibe-combat.html`.
3.  **Interaction**: User drags an Actor into the "Party" zone.
4.  **Update**: `_onDrop` handler processes the actor, updates `partyMembers`, recalculates XP, and re-renders.
5.  **AI Request**: User opens "Vibe Actor", enters prompt, clicks "Generate".
6.  **Pipeline Execution**: `VibeActorDialog` initiates the `GeminiPipeline`.
    -   **Architect**: Generates a blueprint concept.
    -   **Quartermaster**: Selects compendium items or requests custom ones.
    -   **Blacksmith**: Fabricates custom item data.
    -   **Builder**: Assembles the final actor data.
7.  **Creation**: On success, a new Actor is created in the world and the sheet is opened.

### Development Notes

-   **System Compatibility**: Strictly requires `dnd5e`.
-   **API Keys**: The module relies on `game.settings.get("vibe-combat", "geminiApiKey")`.
-   **Async/Await**: Heavy use of async functions for API calls and Foundry document creation.
-   **Modular Architecture**: The codebase is split into Managers, Services, Factories, and UI components. Shared logic is kept in `utils/`.

## Development Guidelines

All FoundryVTT code must be compatible with the following version information:

-   **Core Version**: 13.348
-   **System ID**: dnd5e
-   **System Version**: 5.1.8
