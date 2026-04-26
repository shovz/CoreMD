# PRD: Section Content Styling

## Introduction

Enhance the typography and layout of the chapter section reader so that tables, lists, bold/italic text, blockquotes, and inline code render correctly. The raw HTML extracted from Harrison's PDFs contains these elements but the current `.section-content` CSS does not style them, making the content hard to read.

## Goals

- Tables render with visible borders, padded cells, and a shaded header row
- Unordered and ordered lists render with proper indentation and item spacing
- Bold and italic text are visually distinct
- Blockquotes are offset with a left border
- Inline code snippets have a monospace font with subtle background

## User Stories

### US-001: Extend .section-content CSS for all content elements
**Description:** As a resident reading a chapter, I want tables, lists, and formatted text to render correctly so that the content is easy to scan and read.

**Acceptance Criteria:**
- [x] `.section-content table` — `border-collapse: collapse; width: 100%; margin: 1rem 0`
- [x] `.section-content th, .section-content td` — `border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left`
- [x] `.section-content th` — `background: #f8fafc; font-weight: 600`
- [x] `.section-content ul, .section-content ol` — `padding-left: 1.5rem; margin: 0.75rem 0`
- [x] `.section-content li` — `margin-bottom: 0.25rem`
- [x] `.section-content strong, .section-content b` — `font-weight: 600; color: #111827`
- [x] `.section-content em, .section-content i` — `font-style: italic`
- [x] `.section-content blockquote` — `border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #6b7280; margin: 1rem 0`
- [x] `.section-content code` — `font-family: monospace; background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.875em`
- [x] Only `frontend/src/index.css` is modified — no other files changed
- [x] Typecheck passes
- [x] Verify changes work in browser

## Non-Goals

- No changes to the HTML extraction pipeline
- No custom fonts or font loading
- No dark mode variants

## Technical Considerations

- All rules must be scoped inside `.section-content { }` block that already exists in `frontend/src/index.css`
- Do not add a new CSS block — extend the existing one
