import DOMPurify from "dompurify";
import { formatReaderHtml, stripLeadingDuplicateHeading } from "../readerFormatting";

describe("formatReaderHtml", () => {
  it("splits oversized paragraphs into readable paragraphs", () => {
    const sentence =
      "Heart failure causes reduced cardiac output and compensatory neurohormonal activation.";
    const html = `<p>${Array.from({ length: 24 }, () => sentence).join(" ")}</p>`;

    const result = formatReaderHtml(html, null);

    expect(result).not.toBeNull();
    expect((result?.match(/<p>/g) ?? []).length).toBeGreaterThan(1);
  });

  it("preserves existing source headings", () => {
    const result = formatReaderHtml("<h2>Diagnosis</h2><p>Clinical context matters.</p>", null);

    expect(result).toContain("<h2>Diagnosis</h2>");
    expect(result).toContain("<p>Clinical context matters.</p>");
  });

  it("preserves inline markup in readable paragraphs", () => {
    const result = formatReaderHtml("<p><strong>Key:</strong> treat quickly.</p>", null);

    expect(result).toContain("<strong>Key:</strong>");
  });

  it("preserves structural tables and images", () => {
    const html =
      '<table><tbody><tr><td>Finding</td></tr></tbody></table><img src="/static/a.jpg">';

    const result = formatReaderHtml(html, null);

    expect(result).toContain("<table>");
    expect(result).toContain("<td>Finding</td>");
    expect(result).toContain('<img src="/static/a.jpg">');
  });

  it("removes unsafe script tags before sanitize flow", () => {
    const result = DOMPurify.sanitize(
      formatReaderHtml("<p>Safe text.</p><script>alert('x')</script>", null) ?? ""
    );

    expect(result).toContain("<p>Safe text.</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
  });

  it("escapes plain text fallback before generating reader HTML", () => {
    const result = formatReaderHtml(null, "CLINICAL PEARL\n<script>alert('x')</script>");

    expect(result).toContain("<h3>CLINICAL PEARL</h3>");
    expect(result).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });

  it("removes a leading duplicate heading for grouped reader units", () => {
    const result = stripLeadingDuplicateHeading(
      "<h2>Clinical Manifestations</h2><p>Dyspnea is common.</p>",
      "Clinical Manifestations"
    );

    expect(result).not.toContain("<h2>Clinical Manifestations</h2>");
    expect(result).toContain("<p>Dyspnea is common.</p>");
  });
});
