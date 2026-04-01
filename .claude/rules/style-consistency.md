---
paths:
  - "css/**/*.css"
  - "js/**/*.js"
  - "*.html"
---

# Style Consistency Rules

## In CSS files
- NEVER hardcode hex colors (#xxx), rgb(), rgba() — use CSS variables from base.css
- NEVER hardcode font-size in px or rem — use `--fs-*` variables
- NEVER hardcode padding/margin/gap values — use `--sp-*` variables (0, 1px, 2px are exceptions)
- NEVER hardcode border-radius — use `--radius-*` variables (50%, 100px are exceptions)
- NEVER hardcode font-family — use `var(--font-sans)` or `var(--font-mono)`
- NEVER hardcode box-shadow — use `--shadow-sm/md/lg`

## In JS files
- NEVER set colors via element.style — toggle CSS classes instead
- NEVER put hardcoded hex colors in innerHTML/template literals
- NEVER use CSS var fallbacks in inline styles (e.g., `var(--color-warning, #F2D07A)`)
- OK to set dynamic calculated values via style (width for progress bars, height for auto-resize)

## In HTML files
- Avoid inline `style="..."` attributes — use CSS classes
- Use `.hidden` class instead of `style="display:none"`
- Table column widths should be in CSS, not inline styles
- Never put hardcoded colors or font-sizes in inline styles

## Font weight convention
- 400: normal body text
- 500: medium (labels, nav items, buttons)
- 600: semibold (headings h1-h4, emphasis)
- 700: bold (brand, strong emphasis)

## Known patterns to improve when touching these areas
- Feedback state backgrounds (success=#e8f8ef, error=#fef0f0, info=#f5f8ff) — no CSS vars yet, create reusable classes
- Badge POS-type colors in base.css — hardcoded, acceptable for now
- Button hover darken colors in base.css — hardcoded, acceptable for now
