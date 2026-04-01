---
paths:
  - "**/*"
---

# Keep Documentation in Sync

After completing any codebase change, consider whether the following docs need updating. This is NOT optional — stale docs cause agents to generate wrong code.

## When to update what

| If you changed…                              | Update these                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| File/folder structure (add, rename, move, delete) | `CLAUDE.md` File Structure + Common Tasks, affected agents & skills in `.claude/` |
| CSS variables in `base.css`                  | `.claude/rules/css.md`, agent `wordcraft-ui.md`, `CLAUDE.md` Code Patterns   |
| Shared JS module exports (ui/, shared/, core/) | `.claude/rules/javascript.md`, affected agents, `CLAUDE.md` if public API changed |
| AI functions (add, rename, change signature) | `.claude/rules/ai-modules.md`, agent `wordcraft-ai.md`, skill `wordcraft-ai-prompt` |
| Firestore schema (new field, new collection) | `CLAUDE.md` Firestore Schema, agent `wordcraft-firebase.md`, skill `wordcraft-firestore` |
| New HTML page or new CSS file                | `CLAUDE.md` File Structure, agent `wordcraft-ui.md` CSS table, `wordcraft-feature.md` |
| Auth flow or router changes                  | Agent `wordcraft-firebase.md`, `CLAUDE.md` Authentication Flow               |
| New practice/writing/reading mode            | `CLAUDE.md` File Structure, skill `wordcraft-add-feature`                    |
| Design system (new button variant, utility)  | `.claude/rules/css.md`, agent `wordcraft-ui.md` Design System section        |
| Naming conventions                           | `CLAUDE.md` Naming Conventions                                               |

## How to update

1. **Check scope**: Does your change affect file paths, public APIs, conventions, or schema that docs reference?
2. **Update inline**: Fix the specific lines in the affected doc files — don't rewrite entire files
3. **Keep concise**: Docs should state facts, not explain reasoning. One line per item.
4. **No drift**: If a doc references a file path, function name, or variable name — it must match the actual code exactly

## Priority order

1. `CLAUDE.md` — loaded every conversation, highest impact
2. `.claude/rules/*.md` — auto-loaded when matching file paths are edited
3. `.claude/agents/*.md` — loaded when sub-agents are spawned
4. `.claude/skills/*/SKILL.md` — loaded when skills are invoked
