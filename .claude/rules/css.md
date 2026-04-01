---
paths:
  - "css/**/*.css"
---

# CSS Rules

## Variables — always use, never hardcode

### Colors
- Primary: `--color-primary`, `--color-primary-light`, `--color-primary-dark`
- Accent: `--color-accent`, `--color-accent-light`
- Semantic: `--color-success`, `--color-danger`, `--color-warning`
- Surfaces: `--color-bg`, `--color-surface`, `--color-surface-alt`
- Text: `--color-text`, `--color-text-light`, `--color-text-inverse`
- Border: `--color-border`

### Typography
- Font stack: `var(--font-sans)` for body, `var(--font-mono)` for code
- Font sizes (use `--fs-*` variables, never hardcode px/rem):
  - `--fs-xs` (0.75rem) | `--fs-sm` (0.875rem) | `--fs-base` (1rem)
  - `--fs-md` (1.125rem) | `--fs-lg` (1.35rem) | `--fs-xl` (1.75rem) | `--fs-2xl` (2.25rem)
- Font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- Headings: h1=`--fs-2xl`, h2=`--fs-xl`, h3=`--fs-lg`, h4=`--fs-md`, weight 600

### Spacing
- Use `--sp-1` (4px) through `--sp-8` (64px) — never hardcode padding/margin/gap
- Exception: 0, 1px, 2px, 50%, auto are OK to hardcode

### Border radius
- `--radius-sm` (6px) | `--radius-md` (10px) | `--radius-lg` (16px) | `--radius-xl` (24px)
- Exception: `50%` for circles, `100px` for pills

### Shadows & transitions
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- `--t-fast` (150ms), `--t-normal` (250ms), `--ease-out`

## Naming
- BEM-lite convention for class names
- Mobile-first responsive approach
- Button classes: `.btn`, `.btn-primary`, `.btn-accent`, `.btn-success`, `.btn-danger`, `.btn-warning`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.btn-lg`, `.btn-icon`
- Utility classes: `.hidden`, `.active`, `.disabled`, `.text-center`, `.text-sm`, `.text-xs`, `.text-light`, `.text-danger`, `.text-success`, `.font-mono`

## Known debt — feedback state backgrounds
Some files use hardcoded lighter tints for success/error/warning backgrounds (e.g., `#e8f8ef`, `#fef0f0`, `#f5f8ff`).
These don't have CSS variables yet. When touching these areas, prefer creating a reusable class rather than adding more hardcoded values.
