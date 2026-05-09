interface AnswerExplanationPanelProps {
  options: string[];
  correctOption: number;
  selectedOption: number | null;
  explanations?: string[];
  summary?: string;
  compact?: boolean;
}

const FALLBACK_EXPLANATION = "No explanation available yet.";

function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export default function AnswerExplanationPanel({
  options,
  correctOption,
  selectedOption,
  explanations,
  summary,
  compact = false,
}: AnswerExplanationPanelProps) {
  const isRevealedOnly = selectedOption === null;
  const isCorrect = selectedOption === correctOption;
  const padding = compact ? "p-3" : "p-4";
  const textSize = compact ? "text-xs" : "text-sm";

  return (
    <div
      className={`rounded-xl border ${padding} ${
        isCorrect || isRevealedOnly
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-rose-200 bg-rose-50/70"
      }`}
    >
      <p className={`font-semibold ${isCorrect || isRevealedOnly ? "text-emerald-800" : "text-rose-800"}`}>
        {isRevealedOnly ? "Answer shown" : isCorrect ? "Correct" : "Incorrect"}
      </p>
      {summary && !explanations?.length && <p className={`mt-1 leading-6 text-slate-700 ${textSize}`}>{summary}</p>}

      <div className="mt-3 space-y-2">
        {options.map((option, index) => {
          const correct = index === correctOption;
          const selected = index === selectedOption;
          const explanation = explanations?.[index]?.trim() || (correct ? summary : "") || FALLBACK_EXPLANATION;
          const rowClass = correct
            ? "border-emerald-300 bg-white text-emerald-950"
            : selected
              ? "border-rose-300 bg-white text-rose-950"
              : "border-slate-200 bg-white/80 text-slate-700";

          return (
            <div key={`${option}-${index}`} className={`rounded-lg border ${rowClass} ${compact ? "p-2.5" : "p-3"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{optionLabel(index)}.</span>
                <span className="font-medium">{option}</span>
                {correct && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Correct answer</span>}
                {selected && !correct && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Your answer</span>}
                {!correct && !selected && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Incorrect option</span>}
              </div>
              <p className={`mt-1.5 leading-6 ${textSize}`}>{explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
