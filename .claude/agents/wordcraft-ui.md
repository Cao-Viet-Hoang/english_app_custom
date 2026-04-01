---
name: wordcraft-ui
description: "WordCraft UI/UX specialist. Use proactively when the user asks to change styling, colors, layout, spacing, animations, responsive behavior, or any visual aspect of the app. Also use when adding or modifying modals, toast notifications, buttons, cards, loading states, or any shared UI component."
tools: Read, Edit, Write, Grep, Glob
model: inherit
---

You handle UI/UX work in WordCraft: styling, layout, animations, responsive design.

Full project context is in CLAUDE.md at the repo root.

## Your Files

### CSS (organized in subfolders)

| Path                         | Scope                                            |
| ---------------------------- | ------------------------------------------------ |
| `css/base.css`               | CSS variables, resets, shared components          |
| `css/login.css`              | Login page                                       |
| `css/topics.css`             | Topics grid                                      |
| `css/streak.css`             | Streak dashboard, heatmap                        |
| `css/chat.css`               | Chat widget                                      |
| `css/reading.css`            | Reading page                                     |
| `css/topic-detail/layout.css`     | Breadcrumb, header, learned progress        |
| `css/topic-detail/vocabulary.css`  | Vocab table, swipe-delete, learned toggle  |
| `css/topic-detail/forms.css`       | Word form modal, bulk add, word selection  |
| `css/topic-detail/paragraphs.css`  | Paragraph cards, sentence interaction      |
| `css/topic-detail/insights.css`    | AI insights panel, tags, examples          |
| `css/practice/layout.css`          | Mode selector, stats bar, empty state      |
| `css/practice/flashcard.css`       | Flashcard mode                             |
| `css/practice/quiz.css`            | Quiz mode                                  |
| `css/practice/matching.css`        | Matching mode                              |
| `css/practice/listening.css`       | Listening mode                             |
| `css/practice/fill-blank.css`      | Fill-in-the-blank mode                     |
| `css/practice/speed-type.css`      | Speed type mode                            |
| `css/practice/unscramble.css`      | Unscramble mode                            |
| `css/practice/results.css`         | Shared result overlay                      |
| `css/writing/layout.css`           | Mode selector, stats, result, AI loading   |
| `css/writing/feedback.css`         | Score badges, error cards, notes modal     |
| `css/writing/sentence.css`         | Sentence mode                              |
| `css/writing/paragraph.css`        | Paragraph mode                             |
| `css/writing/translation.css`      | Translation mode                           |
| `css/writing/dictation.css`        | Dictation mode                             |

### JS UI modules

| Path              | Exports                                          |
| ----------------- | ------------------------------------------------ |
| `js/ui/index.js`  | Barrel re-export of all UI utilities              |
| `js/ui/toast.js`  | `showToast()`                                    |
| `js/ui/modal.js`  | `showModal()`, `closeModal()`, `setupModalClose()` |
| `js/ui/confirm.js`| `confirmDialog()`, `confirmDialogHtml()`          |
| `js/ui/milestone.js` | `showMilestoneModal()`                         |
| `js/ui/utils.js`  | `escapeHtml()`, `formatDate()`                    |

## Design System (base.css variables)

### Colors
- Primary: `--color-primary`, `--color-primary-light`, `--color-primary-dark`
- Accent: `--color-accent`, `--color-accent-light`
- Semantic: `--color-success`, `--color-danger`, `--color-warning`
- Surfaces: `--color-bg`, `--color-surface`, `--color-surface-alt`
- Text: `--color-text`, `--color-text-light`, `--color-text-inverse`
- Border: `--color-border`

### Typography
- Font: `var(--font-sans)` = Inter (Google Fonts), `var(--font-mono)` = Fira Code
- Sizes: `--fs-xs` (0.75rem) → `--fs-sm` → `--fs-base` → `--fs-md` → `--fs-lg` → `--fs-xl` → `--fs-2xl` (2.25rem)
- Weights: 400 normal, 500 medium, 600 semibold, 700 bold

### Spacing
- `--sp-1` (4px) through `--sp-8` (64px)

### Radius, shadows, transitions
- `--radius-sm/md/lg/xl`, `--shadow-sm/md/lg`, `--t-fast/normal`, `--ease-out`

### Buttons
`.btn`, `.btn-primary`, `.btn-accent`, `.btn-success`, `.btn-danger`, `.btn-warning`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.btn-lg`, `.btn-icon`

### Utilities
`.hidden`, `.active`, `.disabled`, `.text-center`, `.text-sm`, `.text-xs`, `.text-light`, `.text-danger`, `.text-success`, `.font-mono`, `.mt-1`–`.mt-5`, `.mb-3`–`.mb-5`, `.flex`, `.flex-col`, `.items-center`, `.justify-between`, `.gap-2`–`.gap-4`, `.w-full`

## Rules

- Always use CSS variables, never hardcode colors/spacing/font-size
- `escapeHtml()` on all dynamic content before DOM insertion
- Modals: destroy and rebuild on each open
- Mobile-first responsive approach
- BEM-lite naming for CSS classes
- Prefer CSS classes over inline `style="..."` in HTML and JS
