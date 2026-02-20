# 🚀 Vibe Suite: Foundry VTT Marketplace Release Plan

## The Modules
| Module          | Purpose                                  | Free or Paid?              |
| --------------- | ---------------------------------------- | -------------------------- |
| **vibe-common** | Shared library, required by all others   | Free (required dependency) |
| **vibe-actor**  | AI NPC generation & image generation     | Paid or free with Pro tier |
| **vibe-combat** | AI encounter building, XP budgeting      | Paid or free with Pro tier |
| **vibe-scenes** | Procedural dungeon generation, AI assets | Paid flagship              |

---

## Phase 1: Pre-Release Technical Prep (Week 1–2)

### Step 1.1 — Fix [module.json](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/ATL/module.json) for All Four Modules

Every [module.json](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/ATL/module.json) currently has empty `url`, `manifest`, and `download` fields. These **must** be filled in before submission.

**For each module, update:**
```json
{
  "url": "https://github.com/YOUR_USERNAME/vibe-MODULE",
  "manifest": "https://github.com/YOUR_USERNAME/vibe-MODULE/releases/latest/download/module.json",
  "download": "https://github.com/YOUR_USERNAME/vibe-MODULE/releases/latest/download/vibe-MODULE.zip",
  "authors": [
    {
      "name": "Your Name",
      "email": "your@email.com",
      "discord": "your_discord_handle",
      "url": "https://your-website-or-patreon.com"
    }
  ],
  "license": "MIT",
  "readme": "README.md",
  "changelog": "CHANGELOG.md",
  "bugs": "https://github.com/YOUR_USERNAME/vibe-MODULE/issues"
}
```

> [!IMPORTANT]
> Add `"icon"` field pointing to a 512x512 PNG logo for each module. The marketplace displays module icons prominently.

> [!WARNING]
> The `verified` compatibility field currently says `"13.348"`. Update this to the highest Foundry build you have personally tested on before submission.

### Step 1.2 — GitHub Repository Setup

Each module needs its own **public** GitHub repository. Foundry hosts nothing — GitHub is your distribution layer.

**Checklist per module:**
- [x] Create public repo: `vibe-common`, `vibe-actor`, `vibe-combat`, `vibe-scenes`
- [x] Add a `.gitignore` (exclude `node_modules`, [tests/config.json](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/vibe-scenes/tests/config.json) with API keys)
- [x] Add a `LICENSE` file (`MIT` is the standard for Foundry modules)
- [x] Add a `CHANGELOG.md` (even just `## v1.0.0 - Initial Release`)
- [x] Tag the initial commit: `git tag v1.0.0 && git push --tags`

### Step 1.3 — GitHub Release Automation

Create a GitHub Action that auto-packages the module on every tagged release:

```yaml
# .github/workflows/release.yml
name: Create Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create ZIP
        run: |
          zip -r vibe-MODULE.zip . \
            --exclude "*.git*" --exclude "tests/*" --exclude "*.md" \
            --exclude ".github/*"
      - name: Upload Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            vibe-MODULE.zip
            module.json
```

This means every `git tag v1.0.1 && git push --tags` triggers a release. The `manifest` URL in [module.json](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/ATL/module.json) becomes permanently valid.

### Step 1.4 — Create Module Icons & Screenshots

You'll need these assets before submitting to the marketplace:
- **Module icon**: 512×512 PNG (square logo for each module)
- **Screenshots**: At least 3–5 per module showing the UI in action
- **Cover image**: 1920×1080 banner for the marketplace listing

> [!TIP]
> Foundry's new marketplace (`foundryvtt.store`) launched Feb 2025. A polished icon and compelling screenshots are the #1 factor in conversion.

---

## Phase 2: Free Listing on Foundry Package Ecosystem (Week 2–3)

This gets your modules searchable and installable inside Foundry VTT — at no cost to users.

### Step 2.1 — Submit Each Module

1. Go to [foundryvtt.com/creators/submit/](https://foundryvtt.com/creators/submit/)
2. Log in with your Foundry VTT account (must own a license)
3. Fill in for **each module**:
   - **Package ID**: `vibe-common`, `vibe-actor`, `vibe-combat`, `vibe-scenes`
   - **Title**: "Vibe Common", "Vibe Actor", etc.
   - **Description**: See marketing copy below
   - **Manifest URL**: The GitHub release URL
   - **Systems**: D&D Fifth Edition (`dnd5e`)
   - **Tags**: `ai`, `tools`, `automation`, `combat`, `actors`, `scenes` (as applicable)

4. Submit and wait for **manual review** (usually 1–3 business days)

### Step 2.2 — Create Releases in Package Management

After approval, log into the Foundry Package Management portal and create version `1.0.0` for each module. Version numbers must match your GitHub tags exactly.

**Submission order matters — submit in dependency order:**
1. `vibe-common` (no deps → submit first)
2. `vibe-combat` (depends on vibe-common)
3. `vibe-actor` (depends on vibe-common)
4. `vibe-scenes` (depends on vibe-common)

---

## Phase 3: Monetization Options

You have three realistic paths. They are not mutually exclusive.

### Option A: Patreon (Recommended to start — lowest friction)

**Model**: Free tier = vibe-common + vibe-combat. Patreon supporters ($5–$10/mo) get vibe-actor + vibe-scenes.

**Implementation**:
- Create a Patreon page with a "Vibe Pro" tier ($5–10/month)
- Host the paid modules on GitHub as **private** repos
- Patreon automates Discord role grants — you share a private Discord channel with install instructions
- List the free modules publicly, link to Patreon in descriptions
- **Revenue**: 100 supporters × $7/mo = $700/mo gross (after Patreon's ~8% cut)

**Pros**: No contracts, no approval process, fastest to set up  
**Cons**: No integration with Foundry's in-app installer for paid modules

### Option B: Itch.io (Best for one-time purchases)

**Model**: Sell the full Vibe Suite bundle (~$15–25) as a one-time purchase on Itch.io.

**Implementation**:
- Create an [itch.io](https://itch.io) account and new project
- Package the four module ZIPs plus an install guide PDF
- Set a price (consider PWYW with a minimum of $12)
- Itch.io handles payments, no approval needed from Foundry
- Buyers download and install manually — no content key system required
- **Revenue**: 50 buyers/month × $15 = $750/mo (Itch.io takes 0–30%, you control the split)

**Pros**: Full control, quick setup, great discoverability on itch.io RPG community  
**Cons**: Manual install steps for buyers, no Foundry in-app integration

### Option C: Foundry Premium Content System / foundryvtt.store (Most legitimate, most effort)

**Model**: Officially premium modules with in-app purchase and install via Foundry's new marketplace.

**Implementation**:
1. Apply to become a **Content Provider** at [foundryvtt.com/store/](https://foundryvtt.com/store/)
2. Foundry reviews your application and content
3. If approved, they host your module ZIPs on their CDN
4. Buyers get a "content key" that unlocks in-app install
5. You integrate with [module.json](file:///c:/Users/allen/AppData/Local/FoundryVTT/Data/modules/ATL/module.json) premium content flags
6. Foundry takes a revenue share (specific % not publicly disclosed, typically 30%)

**Pros**: In-app integration, looks most professional, Foundry promotes premium content  
**Cons**: Approval process (Foundry is selective), revenue share, longer time-to-market

> [!NOTE]
> The **foundryvtt.store** marketplace (launched February 12, 2025) is still relatively new. Foundry is actively onboarding new Content Providers. This is the highest-effort but highest-visibility path.

### Recommended Strategy: Start with A + B, work toward C

```
Month 1: List all modules FREE on Foundry Package ecosystem (visibility)
Month 1: Launch Patreon with Vibe Pro tier (immediate revenue)
Month 2: Launch Itch.io bundle (one-time purchases)
Month 3+: Apply to foundryvtt.store premium program (long-term legitimacy)
```

---

## Phase 4: Marketing Copy & Listings

### Package Descriptions (for Foundry submission)

**vibe-common**
> The shared foundation for the Vibe AI module suite. Required by Vibe Actor, Vibe Combat, and Vibe Scenes. Provides the Gemini API client, D&D 5e constants, shared CSS design tokens, and XP calculation utilities used across all Vibe modules.

**vibe-actor**
> Bring your NPCs to life with AI. Generate complete D&D 5e NPC stat blocks from a simple prompt — "A cunning vampire lord who collects rare books." Vibe Actor creates stats, features, actions, and spells in seconds, then populates them from your compendiums. Includes AI portrait generation via DALL-E. Requires vibe-common and a Google Gemini API key.

**vibe-combat**
> Your AI-powered encounter architect. Build perfectly-balanced encounters for your party, get AI-suggested monster combos constrained to your actual compendiums, and calculate XP budgets in real-time. Save and load your favorite encounters for quick reuse. Requires vibe-common and a Google Gemini API key.

**vibe-scenes**
> Generate complete, playable dungeon maps in seconds. Vibe Scenes combines procedural dungeon layout algorithms with AI-powered room theming, asset generation, and smart furniture placement. Every room gets AI-written flavor text and auto-generated journal entries. Walls, doors, and vision blockers are placed automatically. Requires vibe-common and a Google Gemini API key.

---

## Phase 5: Post-Launch

### Known Technical Debt to Address Before v1.1

These items will affect reviews and user satisfaction — fix before or shortly after launch:

| Issue                                                      | Module      | Priority              |
| ---------------------------------------------------------- | ----------- | --------------------- |
| V1 Dialog/Application framework still in use               | vibe-scenes | HIGH — removed in v16 |
| V1 Dialog still used in some combat dialogs                | vibe-combat | MEDIUM                |
| Duplicated agent code between vibe-combat and vibe-actor   | both        | MEDIUM                |
| No user-facing error UI when Gemini key is missing/invalid | all         | HIGH                  |
| `url`, `manifest`, `download` fields empty                 | all         | DONE                  |

### Pricing Guidance

Based on comparable AI-enhanced Foundry modules:
- **Free tier**: vibe-common (baseline, no option to charge for this)
- **Individual modules**: $5–8 one-time or $3–5/month
- **Full suite bundle**: $15–25 one-time

> [!TIP]
> Starting FREE and adding a Patreon/donation link is the fastest way to build community trust. Foundry users are generous tippers once they love a module. Consider launching free and adding premium features later.

### Community Building

- **Discord**: Create a `#vibe-suite` channel or a dedicated server. Foundry users heavily rely on Discord for support.
- **Reddit**: Post in [r/FoundryVTT](https://www.reddit.com/r/FoundryVTT/) when you launch. Showcase post with a video demo gets the best traction.
- **Foundry Discord**: Post in the `#module-showcase` channel on the official Foundry Discord.
- **YouTube**: A 3-minute demo video of dungeon generation running live is extremely compelling for vibe-scenes.

---

## Checklist Summary

```
PRE-RELEASE
[x] Set up 4 public GitHub repos
[x] Fix all module.json: url, manifest, download, authors, license
[ ] Add module icons (512x512 PNG per module) - vibe-common, vibe-actor, and vibe-combat generated, pending scenes
[x] Set up GitHub Actions release automation
[ ] Take screenshots and create banner images
[x] Write CHANGELOG.md for each module
[x] Tag v1.0.0 on all repos

FREE LISTING
[ ] Submit vibe-common to Foundry (first)
[ ] Submit vibe-combat, vibe-actor, vibe-scenes
[ ] Create v1.0.0 releases in Package Management portal

MONETIZATION (pick your path)
[ ] Option A: Create Patreon, set up Vibe Pro tier
[ ] Option B: Create Itch.io listing with ZIP bundle
[ ] Option C: Apply to foundryvtt.store Content Provider program

MARKETING
[ ] Post on r/FoundryVTT
[ ] Post in Foundry Discord #module-showcase
[ ] Record a demo video (especially for vibe-scenes)
[ ] Create a simple landing page or link-in-bio
```
