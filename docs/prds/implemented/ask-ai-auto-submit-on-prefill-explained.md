# Ask AI Auto-Submit on Prefill — Implementation Explained

## What Was Implemented and Why

CoreMD's chapter reader lets users select text and click "Ask AI about this". That action opens the floating AI panel and pre-fills the selected text into the input box — but previously the user still had to manually press **Send**. The extra click broke the "one-click" promise of the selection popover.

This feature makes the AI panel fire immediately when pre-fill text arrives: the moment `prefillText` is passed into `AssistantChat`, the component submits the question and an answer starts streaming back. The user never sees the pre-filled text sitting in the input — they just see the conversation begin.

## Key Design Decisions

**Pass the text directly to `submitQuestion` instead of reading `input` state.** The previous approach called `setInput(prefillText)` inside a `useEffect`, then tried to call `handleSubmit()`. That fails because React state updates are asynchronous — `handleSubmit` closes over the stale `input` value (empty string) and submits nothing. The fix is to extract the API-call logic into `submitQuestion(question: string)` that accepts the text as an explicit argument. The useEffect then calls `submitQuestion(prefillText)` directly, skipping state entirely.

**No `setTimeout` hack.** The previous code used a `setTimeout(() => inputRef.current?.focus(), 50)` as a band-aid to let state settle. That's fragile and unnecessary once the text is passed as a parameter. Removing it simplifies the flow and eliminates a class of timing bugs.

**`handleSubmit` becomes a thin wrapper.** The button-click / Enter-key handler now reads from `input` state and delegates to `submitQuestion`:

```ts
function handleSubmit() {
  submitQuestion(input.trim());
}
```

This keeps the two entry-points (user typing vs. external prefill) sharing the same logic with no duplication.

**Focus-on-prefill removed.** Focusing the input field after a prefill no longer makes sense — the panel immediately enters a loading state and the input is cleared. Removing the focus side-effect also removes the only reason `inputRef` was needed in the useEffect.

**`!compact` guard on the header.** The commit also added a `{!compact && ...}` wrapper around the "Harrison's AI Assistant" header block. When the panel is rendered inside `AiChatLauncher` (which passes `compact={true}`), the redundant header was already hidden by the panel's own title bar. This prevents the title from rendering twice in compact mode.

**Placeholder text is context-aware.** The input placeholder now switches based on the `compact` prop:
- Compact (panel): `"Ask anything about Harrison's…"`
- Full-page: `"Ask a clinical question..."`

## MongoDB Document Shapes Produced

This feature is purely frontend. No backend routes, database writes, or document schema changes are involved.

## How to Run / Verify

Start the frontend dev server:

```bash
cd frontend
npm run dev     # Vite dev server on :5173
```

Manual verification steps:

1. Navigate to any chapter and open a section.
2. Select a passage of text — a popover should appear with "Ask AI about this".
3. Click "Ask AI about this".
4. The floating AI panel opens and the AI response begins loading immediately — no manual Send required.
5. After the response arrives, the input field is empty and ready for a follow-up question.

TypeScript check:

```bash
npm run build   # tsc + vite build — must pass with no errors
```

## Files Changed

| File | What changed |
|------|-------------|
| `frontend/src/components/AssistantChat.tsx` | See detail below. Only this file was modified. |

### Changes inside `AssistantChat.tsx`

**`submitQuestion(question: string)` — renamed and re-signed from `handleSubmit`**

The former `handleSubmit` read from `input` state internally. It is now `submitQuestion` and receives the question text as a parameter. `setInput("")` remains inside it so the field clears regardless of how the function is invoked.

**`handleSubmit()` — new thin wrapper**

```ts
function handleSubmit() {
  submitQuestion(input.trim());
}
```

Called by the Send button and the Enter key handler, unchanged from the user's perspective.

**`prefillText` useEffect — auto-submits instead of focusing**

Before:
```ts
useEffect(() => {
  if (!prefillText) return;
  setInput(prefillText);
  onPrefillConsumed?.();
  setTimeout(() => {
    inputRef.current?.focus();
  }, 50);
}, [prefillText]);
```

After:
```ts
useEffect(() => {
  if (!prefillText) return;
  onPrefillConsumed?.();
  submitQuestion(prefillText);
}, [prefillText]); // eslint-disable-line react-hooks/exhaustive-deps
```

The eslint-disable comment suppresses the exhaustive-deps warning for `submitQuestion`. The function is stable within a render and adding it as a dep would cause an infinite loop via the `messages` closure it captures.

**Compact header guard**

The "Harrison's AI Assistant" title/New Chat header row is now wrapped in `{!compact && (...)}` so it only renders on the standalone full-page version of the component, not inside the floating panel.

**Context-aware placeholder**

```ts
placeholder={
  limitReached
    ? "Start a new conversation to continue"
    : compact
    ? "Ask anything about Harrison's…"
    : "Ask a clinical question..."
}
```

## Key Learnings

The `progress.txt` for this feature contained no recorded learnings. The implementation was straightforward once the root cause was identified.

The core insight worth carrying forward: **never read React state inside a `useEffect` that is triggered by a prop change and then immediately acts on that state.** State updates from `useEffect` are batched and deferred — the updated value will not be visible in the same tick. The pattern to reach for instead is passing the value as a function argument, bypassing state entirely. This avoids both stale-closure bugs and the `setTimeout` workarounds that tend to paper over them.
