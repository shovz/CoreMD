import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Questions Answered" value={42} />);
    expect(screen.getByText("Questions Answered")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders sub text when provided", () => {
    render(<StatCard label="Accuracy" value="78%" sub="last 7 days" />);
    expect(screen.getByText("last 7 days")).toBeInTheDocument();
  });

  it("does not render sub when omitted", () => {
    render(<StatCard label="Score" value={100} />);
    expect(screen.queryByText("last 7 days")).not.toBeInTheDocument();
  });

  it("renders numeric zero value", () => {
    render(<StatCard label="Streak" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
