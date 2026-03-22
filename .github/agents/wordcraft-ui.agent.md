---
description: "UI/UX work — styling, layout, animations, responsive design for WordCraft"
tools:
  [
    "read_file",
    "create_file",
    "replace_string_in_file",
    "grep_search",
    "file_search",
  ]
---

# WordCraft UI Agent

You handle UI/UX work in WordCraft — styling, layout, animations, responsive design.

Full project context is in `CLAUDE.md` at the repo root. Read it first if you haven't.

## Your Files

| CSS File               | Scope                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `css/base.css`         | CSS variables, resets, shared components (modals, toasts, buttons) |
| `css/login.css`        | Login page                                                         |
| `css/topics.css`       | Topics grid                                                        |
| `css/topic-detail.css` | Word list, forms                                                   |
| `css/practice.css`     | Practice modes                                                     |
| `css/reading.css`      | Reading page                                                       |
| `css/writing.css`      | Writing page                                                       |
| `css/streak.css`       | Streak dashboard, heatmap                                          |

**JS Module**: `js/ui.js` — `showModal()`, `showToast()`, `escapeHtml()`, `showLoading()`/`hideLoading()`

## Design System (base.css variables)

- Colors: `--primary`, `--primary-light`, `--primary-dark`, `--success`, `--warning`, `--danger`
- Spacing: `--sp-1` (0.25rem) through `--sp-8` (4rem)
- Font: Inter (Google Fonts)
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`
- Utilities: `.hidden`, `.active`, `.disabled`, `.text-center`

## Rules

- Always use CSS variables — never hardcode colors/spacing
- `escapeHtml()` on all dynamic content before DOM insertion
- Modals: destroy and rebuild on each open
- Mobile-first responsive approach
- BEM-lite naming for CSS classes
