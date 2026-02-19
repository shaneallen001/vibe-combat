---
name: update-readme
description: Updates README.md to model the codebase with a clean high-level description for future developers, including lessons-learned. Use when asked to update the README, after significant code changes, or when keeping documentation in sync with the project.
---

# Update README

Keeps `README.md` accurate and useful for future developers (human or AI). Focus on high-level clarity and lessons learned.

## Workflow

1. **Audit the codebase** – List `scripts/`, `templates/`, `styles/`, and root files. Compare to the README's codebase tree.
2. **Update the tree** – Fix the directory structure in the README. Add new files, remove deleted ones, fix indentation. Keep one-line comments for key files.
3. **Refresh descriptions** – Ensure the opening paragraph, feature list, and Key Components match current behavior.
4. **Maintain Lessons Learned** – Add or refine a "Lessons Learned" section. Keep it high-level (3–8 items). Examples:
   - Foundry V13 `getHeaderControlsApplicationV2` uses `onClick` not `handler`
   - Gemini free tier: ~5 actors per rate limit window due to 4-step pipeline
   - dnd5e 2024 data model: spellcasting feats use `cast` activities and `flags.dnd5e.cachedFor`
5. **Verify version info** – Update `module.json` compatibility and README's Development Guidelines if versions changed.

## README Structure to Preserve

- **Features** – Bullet list of user-facing capabilities
- **Installation / Configuration / Usage** – User-facing instructions
- **Developer Guide** – Standalone testing, architecture, codebase structure, key components
- **Lessons Learned** – High-level gotchas (new or merged into Known Issues)
- **Known Issues & Error Handling** – API errors, rate limits
- **Development Guidelines** – Foundry core, system ID, system version

## Lessons Learned Guidelines

- **High-level only**: Document patterns that would save hours of debugging, not one-off bugs
- **Include**: API quirks, Foundry/dnd5e version gotchas, data model pitfalls, rate limits
- **Exclude**: Minor typos, trivial fixes, environment-specific issues
- **Format**: Short bullet or numbered list with brief explanation

## Checklist Before Finishing

- [ ] Codebase tree matches `scripts/`, `templates/`, `styles/` layout
- [ ] New agents, services, dialogs are listed
- [ ] Removed/renamed modules are no longer referenced
- [ ] Lessons Learned section exists and is concise
- [ ] Version compatibility is current
