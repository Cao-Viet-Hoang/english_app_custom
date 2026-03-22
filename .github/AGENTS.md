# WordCraft Agents

Specialized agents for the WordCraft English vocabulary learning app.
Full project context is in `CLAUDE.md` at the repo root.

| Agent                | Purpose                                 | Files                                              |
| -------------------- | --------------------------------------- | -------------------------------------------------- |
| `wordcraft-feature`  | General feature implementation          | All files                                          |
| `wordcraft-ai`       | AI prompts, evaluation, new AI modes    | `js/ai.js`, `js/reading-ai.js`, `js/writing-ai.js` |
| `wordcraft-ui`       | Styling, layout, animations, responsive | `css/*`, `js/ui.js`                                |
| `wordcraft-firebase` | Database operations, auth flow          | `js/firebase.js`, `js/auth.js`, `js/streak.js`     |
