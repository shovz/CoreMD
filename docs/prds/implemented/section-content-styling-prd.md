# PRD: Ask AI Auto-Submit on Prefill

## Introduction

When a user selects text in the chapter reader and clicks "Ask AI about this", the text is pre-filled into the AI chat input but the user still has to manually press Send. This friction defeats the purpose of the one-click flow. Auto-submitting the question when prefill text arrives makes the experience seamless.

## Goals

- Selecting text and clicking "Ask AI about this" immediately triggers an AI response without the user pressing Send
- The input box is cleared after auto-submit so the user can type a follow-up
- The fix must avoid stale React state (the submit function must use the prefill text directly, not the `input` state)

## User Stories

### US-001: Auto-submit AssistantChat when prefillText is provided
**Description:** As a resident reading a chapter, I want the AI to immediately answer when I select text and click "Ask AI about this" so that I don't need to manually press Send.

**Acceptance Criteria:**
- [ ] In `frontend/src/components/AssistantChat.tsx`, extract submit logic into `submitQuestion(question: string)` that takes the question as an explicit argument (not from `input` state)
- [ ] The `prefillText` useEffect calls `submitQuestion(prefillText)` directly after calling `onPrefillConsumed?.()` — no `setTimeout` needed since we pass the value directly
- [ ] `handleSubmit()` (called by button click and Enter key) calls `submitQuestion(input.trim())`
- [ ] After auto-submit, the input field is empty (cleared by `setInput("")` inside `submitQuestion`)
- [ ] The focus-on-prefill behavior is removed (no longer needed since we auto-submit)
- [ ] Only `frontend/src/components/AssistantChat.tsx` is modified
- [ ] Typecheck passes
- [ ] Verify changes work in browser: select text in chapter reader → click "Ask AI about this" → AI response appears in the floating panel automatically

## Non-Goals

- No changes to AiContext, AiChatLauncher, or ChaptersPage selection popover
- No streaming/typing indicator changes
- No changes to how history is built

## Technical Considerations

- The stale-state problem: React `useState` closures mean that calling `handleSubmit()` inside a useEffect will read stale `input`. The fix is to pass the text as a parameter to avoid relying on state.
- `submitQuestion` signature: `async function submitQuestion(question: string)` — replace `const question = input.trim()` inside with the parameter.
