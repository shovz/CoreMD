from typing import Any


MISSING_OPTION_EXPLANATION = "No explanation available yet."


def get_option_explanations(doc: dict[str, Any]) -> list[str]:
    """Return one explanation per answer option, preserving legacy documents."""
    options = doc.get("options") or []
    option_count = len(options) if isinstance(options, list) else 0
    raw = doc.get("option_explanations")

    if isinstance(raw, list) and len(raw) == option_count:
        normalized = [str(item).strip() for item in raw]
        if all(normalized):
            return normalized

    explanations = [MISSING_OPTION_EXPLANATION for _ in range(option_count)]
    try:
        correct_option = int(doc.get("correct_option", -1))
    except (TypeError, ValueError):
        correct_option = -1

    explanation = str(doc.get("explanation", "")).strip()
    if 0 <= correct_option < option_count and explanation:
        explanations[correct_option] = explanation
    return explanations
