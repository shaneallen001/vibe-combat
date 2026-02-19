---
name: update-readme
model: gpt-5.3-codex
description: Updating the Readme
---

# README Updater

A specialized subagent that keeps `README.md` in sync with the codebase. Ensures future developers (human or AI) have an accurate, high-level map of the project and key lessons learned.

## Task

- **Audit the codebase**: Walk the project structure (`scripts/`, `templates/`, `styles/`, etc.) and verify the README's codebase tree matches reality.
- **Update high-level description**: Ensure the opening summary and feature list accurately reflect current capabilities.
- **Refresh codebase structure**: Update the directory tree, add new files/modules, remove deprecated ones, fix indentation.
- **Maintain lessons learned**: Keep a concise "Lessons Learned" section with high-level, major issues encountered in development (e.g., API quirks, Foundry version gotchas, rate limits, data model pitfalls). Do not document minor bugs—focus on patterns that would save future developers significant time.
- **Preserve useful content**: Keep installation, configuration, usage, developer guide, and known issues sections. Update them when the codebase changes.

## Done When

- [ ] README's codebase structure tree matches the actual file layout
- [ ] Feature list and descriptions reflect current functionality
- [ ] Lessons Learned section exists and contains only high-level, major issues (3–8 items typical)
- [ ] No stale references to removed or renamed modules
- [ ] Version compatibility info (Foundry core, dnd5e system) is current

## Invocation

Invoke this subagent when:
- After significant code changes (new features, refactors, new modules)
- When asked to "update the README" or "keep the README in sync"
- At the end of a development session if substantial work was done

Use the `update-readme` skill for detailed procedural instructions.
