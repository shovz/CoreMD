#!/bin/bash
set -e

MAX=${1:-10}
SLEEP=${2:-2}

# Force Python to use UTF-8 for stdin/stdout/stderr on all platforms
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

# Always run from project root regardless of where script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

resolve_codex_bin() {
    if command -v codex >/dev/null 2>&1; then
        echo "codex"
        return 0
    fi
    if command -v codex.cmd >/dev/null 2>&1; then
        echo "codex.cmd"
        return 0
    fi
    if [ -f "/c/Program Files/nodejs/codex.cmd" ]; then
        echo "/c/Program Files/nodejs/codex.cmd"
        return 0
    fi
    return 1
}

CODEX_BIN=$(resolve_codex_bin || true)
if [ -z "$CODEX_BIN" ]; then
    echo "ERROR: codex CLI not found. Install it or add it to PATH." >&2
    exit 1
fi

run_codex_prompt() {
    local prompt="$1"
    local -a args
    args=(exec --full-auto --cd "$PROJECT_ROOT" --color never)

    if [ -n "${CODEX_MODEL:-}" ]; then
        args+=(--model "$CODEX_MODEL")
    fi
    if [ -n "${CODEX_PROFILE:-}" ]; then
        args+=(--profile "$CODEX_PROFILE")
    fi

    # Feed prompt through stdin so multiline task blocks are preserved.
    printf '%s' "$prompt" | "$CODEX_BIN" "${args[@]}" -
}

file_hash() {
    local path="$1"
    python -c "
import hashlib, pathlib, sys
p = pathlib.Path(sys.argv[1])
if not p.exists():
    print('')
else:
    print(hashlib.md5(p.read_bytes()).hexdigest())
" "$path"
}

# Derive the explanation file path from the PRD title at startup
# Reads the first H1 heading from PRD.md, slugifies it, and maps to prds/<slug>-explained.md
get_explanation_path() {
    python -c "
import re
try:
    text = open('PRD.md', encoding='utf-8').read()
    m = re.search(r'^#\s+PRD:\s*(.+)', text, re.MULTILINE)
    title = m.group(1).strip() if m else 'unknown'
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    print(f'prds/{slug}-explained.md')
except Exception:
    print('prds/unknown-explained.md')
"
}

update_explanation() {
    local explanation_file="$1"
    echo ""
    echo "Updating explanation file: $explanation_file"
    run_codex_prompt "You are a technical writer. Read PRD.md and progress.txt in the current directory.
Update or create the explanation file at '$explanation_file'.

The file should explain:
1. What was implemented and why (high-level summary)
2. Key design decisions and the reasoning behind them
3. MongoDB document shapes produced
4. How to run the script/feature
5. What files changed and what each change does
6. Key learnings discovered during implementation (from progress.txt)

Write clearly for a developer who wasn't involved. Be concise but complete.
Only update the explanation file - do not touch PRD.md, progress.txt, or any source files." || true
}

EXPLANATION_FILE=$(get_explanation_path)
echo "Starting Ralph - Max $MAX iterations"
echo "Project root: $PROJECT_ROOT"
echo "Explanation file: $EXPLANATION_FILE"
echo ""

for ((i=1; i<=MAX; i++)); do
    echo "==========================================="
    echo "  Iteration $i of $MAX"
    echo "==========================================="

    # Re-check explanation file in case PRD changed between runs
    CURRENT_EXPLANATION=$(get_explanation_path)

    # Pre-extract the next incomplete task block from PRD.md
    TASK_BLOCK=$(python -c "
import re
text = open('PRD.md', encoding='utf-8').read()
sections = re.split(r'^(?=### )', text, flags=re.MULTILINE)
for s in sections:
    if '- [ ]' in s:
        print(s.strip())
        break
")
    TASK_TITLE=$(printf '%s\n' "$TASK_BLOCK" | sed -n '1p')

    if [ -z "$TASK_BLOCK" ]; then
        echo "==========================================="
        echo "  All tasks complete!"
        echo "==========================================="
        update_explanation "$CURRENT_EXPLANATION"
        exit 0
    fi

    # Pass only the Learnings section of progress.txt (not the full iteration history)
    LEARNINGS=$(python -c "
import re
text = open('progress.txt', encoding='utf-8').read()
m = re.match(r'(.*?)^## Iteration', text, re.DOTALL | re.MULTILINE)
print(m.group(1).strip() if m else text.strip())
")

    PRD_HASH_BEFORE=$(file_hash "PRD.md")
    PROGRESS_HASH_BEFORE=$(file_hash "progress.txt")

    result=$(run_codex_prompt "You are Ralph, an autonomous implementer for the CoreMD project.
CoreMD is a full-stack medical learning platform: FastAPI (Python) backend + React 19 (TypeScript) frontend + MongoDB + Redis.
Working directory: $PROJECT_ROOT

## Task
${TASK_BLOCK}

## Learnings from previous iterations
${LEARNINGS}

## Instructions
1. Implement the task above (do not read PRD.md - the task is already provided above).
2. Run any relevant checks to verify (e.g. python -c 'import app' for backend, npm run build for frontend).
3. If checks PASS:
   - Mark all task criteria [x] in PRD.md
   - Commit with: feat: <task name>
   - If you discovered a new reusable pattern, append it as a bullet under '## Learnings' in progress.txt
4. If checks FAIL:
   - Do NOT mark complete, do NOT commit
   - Append what failed as a bullet under '## Learnings' in progress.txt
5. Check PRD.md: if ALL tasks are [x], output the following token on its own line - ONLY if truly all boxes are checked. Do NOT mention, quote, or reference this token for any other reason:
DONE_SIGNAL_COREMD" || true)

    echo "$result"
    echo ""

    PRD_HASH_AFTER=$(file_hash "PRD.md")
    PROGRESS_HASH_AFTER=$(file_hash "progress.txt")

    # Enforce bookkeeping pass if model didn't update PRD/progress.
    if [ "$PRD_HASH_BEFORE" = "$PRD_HASH_AFTER" ] || [ "$PROGRESS_HASH_BEFORE" = "$PROGRESS_HASH_AFTER" ]; then
        echo "Bookkeeping enforcement: ensuring PRD/progress updates for this iteration."
        run_codex_prompt "You are Ralph in bookkeeping-only mode.
Working directory: $PROJECT_ROOT

Target task section title:
$TASK_TITLE

Task block:
${TASK_BLOCK}

Last iteration output:
${result}

Instructions:
1. Update ONLY PRD.md and progress.txt.
2. In PRD.md, find the section matching '$TASK_TITLE' and mark criteria [x] for items that were implemented in this iteration.
3. If a criterion could not be completed due known local environment issues (e.g. 'spawn EPERM', Git-Bash CreateFileMapping permission issues), leave it unchecked and add one concise note line directly under that criterion.
4. In progress.txt, append at least one new bullet under '## Learnings' summarizing either a reusable implementation pattern or a concrete blocker.
5. Do not modify any other files." || true

        # Hard fallback: always ensure at least one learning bullet is appended.
        PRD_HASH_AFTER=$(file_hash "PRD.md")
        PROGRESS_HASH_AFTER=$(file_hash "progress.txt")
        if [ "$PROGRESS_HASH_BEFORE" = "$PROGRESS_HASH_AFTER" ]; then
            python -c "
from datetime import datetime
line = f\"- Iteration bookkeeping fallback ({datetime.utcnow().isoformat()}Z): model did not append learnings automatically.\\n\"
with open('progress.txt', 'a', encoding='utf-8') as f:
    f.write('\\n' + line)
"
        fi
    fi

    if echo "$result" | grep -qx 'DONE_SIGNAL_COREMD'; then
        echo "==========================================="
        echo "  All tasks complete after $i iterations!"
        echo "==========================================="
        update_explanation "$CURRENT_EXPLANATION"
        exit 0
    fi

    sleep $SLEEP
done

echo "==========================================="
echo "  Reached max iterations ($MAX)"
echo "==========================================="
update_explanation "$CURRENT_EXPLANATION"
exit 1
