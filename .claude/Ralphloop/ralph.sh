#!/bin/bash
set -e

MAX=${1:-10}
SLEEP=${2:-2}

# Force Python to use UTF-8 for stdin/stdout/stderr on all platforms
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

# Always run from project root regardless of where script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Resolve claude binary — works on Mac/Linux (npm global) and Windows (VS Code extension)
if ! command -v claude &>/dev/null; then
    CLAUDE_EXT=$(ls /c/Users/Electro/.vscode/extensions/ 2>/dev/null | grep "anthropic.claude-code" | sort -V | tail -1)
    if [ -n "$CLAUDE_EXT" ]; then
        export PATH="/c/Users/Electro/.vscode/extensions/${CLAUDE_EXT%/}/resources/native-binary:$PATH"
    fi
fi

if ! command -v claude &>/dev/null; then
    echo "ERROR: claude CLI not found. Install it or add it to PATH." >&2
    exit 1
fi

# Derive the explanation file path from the PRD title at startup
# Reads the first H1 heading from PRD.md, slugifies it, and maps to docs/prds/implemented/<slug>-explained.md
get_explanation_path() {
    python -c "
import re, sys
try:
    text = open('PRD.md', encoding='utf-8').read()
    m = re.search(r'^#\s+PRD:\s*(.+)', text, re.MULTILINE)
    title = m.group(1).strip() if m else 'unknown'
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    print(f'docs/prds/implemented/{slug}-explained.md')
except Exception as e:
    print('docs/prds/implemented/unknown-explained.md')
"
}

# Get the PRD slug for archiving
get_prd_slug() {
    python -c "
import re
try:
    text = open('PRD.md', encoding='utf-8').read()
    m = re.search(r'^#\s+PRD:\s*(.+)', text, re.MULTILINE)
    title = m.group(1).strip() if m else 'unknown'
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    print(slug)
except Exception:
    print('unknown')
"
}

update_explanation() {
    local explanation_file="$1"
    echo ""
    echo "Updating explanation file: $explanation_file"
    claude --dangerously-skip-permissions -p "You are a technical writer. Read PRD.md and progress.txt in the current directory.
Update or create the explanation file at '$explanation_file'.

The file should explain:
1. What was implemented and why (high-level summary)
2. Key design decisions and the reasoning behind them
3. MongoDB document shapes produced
4. How to run the script/feature
5. What files changed and what each change does
6. Key learnings discovered during implementation (from progress.txt)

Write clearly for a developer who wasn't involved. Be concise but complete.
Only update the explanation file — do not touch PRD.md, progress.txt, or any source files." || true
}

archive_and_promote() {
    local slug
    slug=$(get_prd_slug)

    echo ""
    echo "Archiving completed PRD: $slug"
    mv PRD.md "docs/prds/implemented/${slug}-prd.md" || true
    mv progress.txt "docs/prds/implemented/${slug}-progress.txt" || true

    # Promote next upcoming PRD to root
    NEXT_PRD=$(ls docs/prds/upcoming/*.md 2>/dev/null | sort | head -1)
    if [ -n "$NEXT_PRD" ]; then
        cp "$NEXT_PRD" PRD.md
        rm "$NEXT_PRD"
        printf "# Progress Log\n\n## Learnings\n(Patterns discovered during implementation)\n\n---\n" > progress.txt
        echo "Promoted: $NEXT_PRD → PRD.md"
    else
        echo "No more upcoming PRDs. All done!"
    fi
}

EXPLANATION_FILE=$(get_explanation_path)
echo "Starting Ralph - Max $MAX iterations"
echo "Project root: $PROJECT_ROOT"
echo "Explanation file: $EXPLANATION_FILE"
echo ""

for ((i=1; i<=$MAX; i++)); do
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

    if [ -z "$TASK_BLOCK" ]; then
        echo "==========================================="
        echo "  All tasks complete!"
        echo "==========================================="
        update_explanation "$CURRENT_EXPLANATION"
        archive_and_promote
        exit 0
    fi

    # Pass only the Learnings section of progress.txt (not the full iteration history)
    LEARNINGS=$(python -c "
import re
text = open('progress.txt', encoding='utf-8').read()
m = re.match(r'(.*?)^## Iteration', text, re.DOTALL | re.MULTILINE)
print(m.group(1).strip() if m else text.strip())
")

    result=$(claude --dangerously-skip-permissions -p "You are Ralph, an autonomous implementer for the CoreMD project.
CoreMD is a full-stack medical learning platform: FastAPI (Python) backend + React 19 (TypeScript) frontend + MongoDB + Redis.
Working directory: $PROJECT_ROOT

## Task
${TASK_BLOCK}

## Learnings from previous iterations
${LEARNINGS}

## Instructions
1. Implement the task above (do not read PRD.md — the task is already provided above).
2. Run any relevant checks to verify (e.g. python -c 'import app' for backend, npm run build for frontend).
3. If checks PASS:
   - Mark all task criteria [x] in PRD.md
   - Commit with: feat: <task name>
   - If you discovered a new reusable pattern, append it as a bullet under '## Learnings' in progress.txt
4. If checks FAIL:
   - Do NOT mark complete, do NOT commit
   - Append what failed as a bullet under '## Learnings' in progress.txt
5. Check PRD.md: if ALL tasks are [x], output the following token on its own line — ONLY if truly all boxes are checked. Do NOT mention, quote, or reference this token for any other reason:
DONE_SIGNAL_COREMD") || true

    echo "$result"
    echo ""

    if echo "$result" | grep -qx 'DONE_SIGNAL_COREMD'; then
        echo "==========================================="
        echo "  All tasks complete after $i iterations!"
        echo "==========================================="
        update_explanation "$CURRENT_EXPLANATION"
        archive_and_promote
        exit 0
    fi

    sleep $SLEEP
done

echo "==========================================="
echo "  Reached max iterations ($MAX)"
echo "==========================================="
update_explanation "$CURRENT_EXPLANATION"
exit 1
