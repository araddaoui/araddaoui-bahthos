import React from "react";
import { normalizeArabicText } from "./termExtractor";

/**
 * Utility to strip out XML evidence tags completely (<evidence ...>...</evidence>) and normalize Arabic font/OCR characters.
 */
export function stripEvidenceTags(text: string): string {
  if (!text) return "";
  const stripped = text.replace(/<evidence([\s\S]*?)>([\s\S]*?)<\/evidence>/gi, "").trim();
  return normalizeArabicText(stripped);
}

/**
 * Strips all markdown syntax (####, **, *, -, etc.) returning clean plain text
 */
export function cleanMarkdownToPlainText(text: string): string {
  if (!text) return "";
  let result = stripEvidenceTags(text);

  // Remove heading prefixes (####, ###, ##, #)
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Convert **ج:** or **س:** or **س1:** to clean labels without asterisks
  result = result.replace(/\*\*ج:\*\*/g, "ج: ");
  result = result.replace(/\*\*س:\*\*/g, "س: ");
  result = result.replace(/\*\*س(\d+):\*\*/g, "س$1: ");

  // Remove bold asterisks **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/\*([^*]+)\*/g, "$1");

  // Clean bullet markers
  result = result.replace(/^[* -]\s+/gm, "• ");

  return result.trim();
}

/**
 * Renders inline markdown text (like **bold**) as React nodes
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split by **bold** pattern
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const boldText = part.slice(2, -2);

      // Check if bold text is a QA label like **ج:** or **س:** or **س1:**
      if (/^(ج|س\d*|سؤال|إجابة|الجواب|الأسئلة):?$/.test(boldText.trim())) {
        const isAnswer = /^(ج|إجابة|الجواب):?$/.test(boldText.trim());
        return (
          <span
            key={index}
            className={`inline-flex items-center px-2 py-0.5 rounded font-black text-xs mx-1 border shadow-2xs ${
              isAnswer
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-teal-50 text-[#094d4e] border-teal-200"
            }`}
          >
            {boldText}
          </span>
        );
      }

      return (
        <strong key={index} className="font-extrabold text-gray-900">
          {boldText}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Converts a raw report string (containing markdown and XML) into structured React components.
 * Strips out ####, **, and formats headers, Q&A blocks, and lists seamlessly.
 */
export function parseMarkdownToReact(text: string): React.ReactNode {
  if (!text) return null;

  const clean = stripEvidenceTags(text);
  const lines = clean.split("\n");

  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];

  const flushList = (keyPrefix: string) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul`} className="my-2.5 space-y-1.5 pr-4 border-r-2 border-teal-600/30">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(`line-${idx}`);
      return;
    }

    // Check for Headings: ####, ###, ##, #
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushList(`line-${idx}`);
      const level = headingMatch[1].length;
      const headingContent = headingMatch[2];

      // Check if heading is a question like "#### س1: هل يؤدي..."
      const isQAHeading = /^(س\d*|سؤال|س):/i.test(headingContent.trim());

      if (level <= 2) {
        elements.push(
          <h2 key={idx} className="text-base md:text-lg font-black text-[#094d4e] mt-5 mb-2.5 pb-1 border-b border-teal-100 flex items-center gap-2">
            <span>{headingContent}</span>
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3 key={idx} className="text-sm md:text-base font-extrabold text-[#094d4e] mt-4 mb-2 flex items-center gap-2">
            <span>{headingContent}</span>
          </h3>
        );
      } else {
        // level >= 4
        if (isQAHeading) {
          const colonIdx = headingContent.indexOf(":");
          const qPrefix = colonIdx !== -1 ? headingContent.substring(0, colonIdx + 1) : headingContent;
          const qBody = colonIdx !== -1 ? headingContent.substring(colonIdx + 1) : "";
          elements.push(
            <div key={idx} className="mt-4 mb-2 p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-xl shadow-2xs">
              <div className="flex items-start gap-2">
                <span className="bg-[#094d4e] text-white px-2 py-0.5 rounded text-xs font-bold shrink-0">
                  {qPrefix}
                </span>
                <h4 className="text-xs md:text-sm font-extrabold text-[#094d4e] leading-snug">
                  {renderInlineMarkdown(qBody)}
                </h4>
              </div>
            </div>
          );
        } else {
          elements.push(
            <h4 key={idx} className="text-xs md:text-sm font-extrabold text-gray-900 mt-3.5 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#094d4e] shrink-0"></span>
              <span>{renderInlineMarkdown(headingContent)}</span>
            </h4>
          );
        }
      }
      return;
    }

    // Check for List Items: * or - or 1.
    const listMatch = /^([*-]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      const itemContent = listMatch[2];
      currentListItems.push(
        <li key={idx} className="text-xs md:text-sm text-gray-800 leading-relaxed flex items-start gap-2">
          <span className="text-[#094d4e] font-extrabold shrink-0 mt-0.5">•</span>
          <span className="flex-1">{renderInlineMarkdown(itemContent)}</span>
        </li>
      );
      return;
    }

    // Normal paragraph line
    flushList(`line-${idx}`);

    // Check if line starts with **ج:** or **س:** or ج:
    if (/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*)/.test(trimmed)) {
      const body = trimmed.replace(/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*)/, "").trim();
      elements.push(
        <div key={idx} className="my-2.5 p-3.5 bg-white border border-emerald-100/80 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300/60 px-2 py-0.5 rounded text-[11px] font-black">
              الإجابة (ج):
            </span>
          </div>
          <p className="text-xs md:text-sm leading-loose text-gray-800">
            {renderInlineMarkdown(body)}
          </p>
        </div>
      );
      return;
    }

    elements.push(
      <p key={idx} className="text-xs md:text-sm leading-loose text-gray-800 mb-2 font-sans">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList("end");

  return <div className="space-y-1 text-right" dir="rtl">{elements}</div>;
}

/**
 * Formats inline text into HTML strings for MS Word export
 */
function formatInlineHtml(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text** -> <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong style='font-weight: bold; color: #111;'>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

/**
 * Converts report text containing markdown and evidence tags into an MS Word compatible HTML document string.
 */
export function markdownToWordHtml(title: string, markdownText: string): string {
  const clean = stripEvidenceTags(markdownText);
  const lines = clean.split("\n");

  let bodyHtml = "";
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      return;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      const level = headingMatch[1].length;
      const content = cleanMarkdownToPlainText(headingMatch[2]);

      if (level <= 2) {
        bodyHtml += `<h2 style="color: #094d4e; font-size: 16pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 16pt; margin-bottom: 6pt; font-weight: bold; border-bottom: 1.5pt solid #094d4e; padding-bottom: 3pt;">${content}</h2>\n`;
      } else if (level === 3) {
        bodyHtml += `<h3 style="color: #094d4e; font-size: 13pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 12pt; margin-bottom: 4pt; font-weight: bold;">${content}</h3>\n`;
      } else {
        bodyHtml += `<h4 style="color: #0d6264; font-size: 11pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 10pt; margin-bottom: 4pt; font-weight: bold;">${content}</h4>\n`;
      }
      return;
    }

    // Bullet lists
    const listMatch = /^([*-]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      if (!inList) {
        bodyHtml += `<ul style="margin-right: 18pt; margin-top: 4pt; margin-bottom: 8pt; font-size: 11pt; font-family: 'Segoe UI', Arial, sans-serif;">\n`;
        inList = true;
      }
      const itemText = formatInlineHtml(listMatch[2]);
      bodyHtml += `  <li style="margin-bottom: 4pt; line-height: 1.7;">${itemText}</li>\n`;
      return;
    }

    if (inList) {
      bodyHtml += "</ul>\n";
      inList = false;
    }

    // QA lines
    if (/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*)/.test(trimmed)) {
      const answerContent = trimmed.replace(/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*)/, "").trim();
      bodyHtml += `<p style="margin-top: 6pt; margin-bottom: 8pt; background-color: #f0fdf4; padding: 8pt 10pt; border-right: 3.5pt solid #059669; font-size: 11pt; line-height: 1.7;"><strong style="color: #065f46;">الإجابة (ج):</strong> ${formatInlineHtml(answerContent)}</p>\n`;
      return;
    }

    // Standard paragraph
    bodyHtml += `<p style="margin-bottom: 8pt; font-size: 11pt; line-height: 1.7; color: #1f1f1f; font-family: 'Segoe UI', Arial, sans-serif;">${formatInlineHtml(trimmed)}</p>\n`;
  });

  if (inList) {
    bodyHtml += "</ul>\n";
  }

  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${title || "تقرير بحثي"}</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
  body {
    font-family: 'Segoe UI', 'Traditional Arabic', 'Arial', sans-serif;
    direction: rtl;
    text-align: right;
    line-height: 1.8;
    color: #1f1f1f;
    margin: 30pt;
  }
  h1, h2, h3, h4 { font-family: 'Segoe UI', 'Traditional Arabic', sans-serif; }
</style>
</head>
<body>
  ${title ? `<h1 style="color: #094d4e; font-size: 20pt; font-weight: bold; margin-bottom: 12pt; border-bottom: 2pt solid #094d4e; padding-bottom: 6pt;">${title}</h1>` : ""}
  ${bodyHtml}
</body>
</html>`.trim();
}

/**
 * Downloads report as an MS Word (.doc/.docx) file with proper typography and formatting
 */
export function exportToWordDocument(title: string, text: string) {
  const htmlContent = markdownToWordHtml(title, text);
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeFileName = (title || "تقرير_بحثي").replace(/[\\/:*?"<>|]/g, "_") + ".doc";
  link.download = safeFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies formatted report to clipboard with both Rich Text (HTML) for MS Word and Clean Plain Text fallback
 */
export async function copyReportToClipboard(title: string, text: string): Promise<boolean> {
  const htmlContent = markdownToWordHtml(title, text);
  const plainText = cleanMarkdownToPlainText(text);

  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      return true;
    } else {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.error("Clipboard write error:", err);
    try {
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch (e) {
      return false;
    }
  }
}
