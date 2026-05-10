import { render, screen } from "@testing-library/react";
import AnswerExplanationPanel from "../AnswerExplanationPanel";

const OPTIONS = ["Option A", "Option B", "Option C", "Option D"];
const EXPLANATIONS = ["A is wrong.", "B is correct.", "C is wrong.", "D is wrong."];

describe("AnswerExplanationPanel", () => {
  it("shows 'Correct' when selectedOption equals correctOption", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={1}
      />
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
  });

  it("shows 'Incorrect' when selectedOption differs from correctOption", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={0}
      />
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("shows 'Answer shown' when selectedOption is null", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={null}
      />
    );
    expect(screen.getByText("Answer shown")).toBeInTheDocument();
  });

  it("renders per-option explanation text when explanations array is provided", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={1}
        explanations={EXPLANATIONS}
      />
    );
    expect(screen.getByText("A is wrong.")).toBeInTheDocument();
    expect(screen.getByText("B is correct.")).toBeInTheDocument();
    expect(screen.getByText("C is wrong.")).toBeInTheDocument();
    expect(screen.getByText("D is wrong.")).toBeInTheDocument();
  });

  it("shows fallback 'No explanation available yet.' when no explanations are provided", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={0}
      />
    );
    const fallbacks = screen.getAllByText("No explanation available yet.");
    expect(fallbacks.length).toBeGreaterThan(0);
  });

  it("marks correct option with 'Correct answer' badge and wrong selected with 'Your answer' badge", () => {
    render(
      <AnswerExplanationPanel
        options={OPTIONS}
        correctOption={1}
        selectedOption={0}
        explanations={EXPLANATIONS}
      />
    );
    expect(screen.getByText("Correct answer")).toBeInTheDocument();
    expect(screen.getByText("Your answer")).toBeInTheDocument();
  });
});
