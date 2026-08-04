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
 * Normalizes raw report text structure to guarantee line breaks between sections,
 * questions (س1:), answers (ج:), headings (####), disclosures, and fix all-bold lines.
 */
export function normalizeReportStructure(text: string): string {
  if (!text) return "";
  let result = stripEvidenceTags(text);

  // Untangle all-bold lines where heading and body were wrapped in double asterisks
  // e.g., **1. تحليل الأدلة من المصادر: توثق الوثيقة نتائج...** -> **1. تحليل الأدلة من المصادر:** توثق الوثيقة نتائج...
  result = result.replace(/^(\s*)\*\*(\d+\.\s*[^:\n]+:)\s*([^*]+)\*\*/gm, "$1**$2** $3");
  result = result.replace(/^(\s*)\*\*(تحليل الأدلة[^:\n]+:)\s*([^*]+)\*\*/gm, "$1**$2** $3");
  result = result.replace(/^(\s*)\*\*([^*:\n]+:)\s*([^*]{30,})\*\*/gm, "$1**$2** $3");

  // Ensure double newlines before key meta headers
  result = result.replace(/(\s*)(عنوان تقرير التوليف:)/gi, "\n\n$2\n");
  result = result.replace(/(\s*)(محتوى التقرير الأكاديمي:)/gi, "\n\n$2\n");
  
  // Ensure double newlines around disclosure banners (توضيح النطاق: or نطاق التقرير:)
  result = result.replace(/([^\n])\s*(توضيح النطاق:|نطاق التقرير:)/gi, "$1\n\n$2");
  result = result.replace(/(توضيح النطاق:[^\n]+|نطاق التقرير:[^\n]+)([^\n])/gi, "$1\n\n$2");

  // Ensure double newlines before markdown headings (####, ###, ##, #)
  result = result.replace(/([^\n])(#{1,6}\s+)/g, "$1\n\n$2");

  // Ensure double newlines before markdown tables starting with |
  result = result.replace(/([^\n|])\n*(\|[^\n]+\|)/g, "$1\n\n$2");

  // Ensure double newlines before questions like #### س1: or س1: or سؤال 1: or **س1:**
  result = result.replace(/([^\n])\s*(#{1,6}\s*)?(س\d+:|سؤال\s*\d*:|\*\*س\d+:\*\*|\*\*س:\*\*)/gi, "$1\n\n$2$3");

  // Ensure double newlines before answers like **ج:** or ج: or **إجابة:** or إجابة:
  result = result.replace(/([^\n])\s*(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*)/gi, "$1\n\n$2 ");

  // Ensure double newlines around section dividers
  result = result.replace(/([^\n])(---)/g, "$1\n\n$2\n\n");

  return result.trim();
}

/**
 * Strips all markdown syntax (####, **, *, -, etc.) returning clean plain text
 */
export function cleanMarkdownToPlainText(text: string): string {
  if (!text) return "";
  let result = normalizeReportStructure(text);

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
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : "bg-teal-100 text-[#094d4e] border-teal-300"
            }`}
          >
            {boldText}
          </span>
        );
      }

      return (
        <strong key={index} className="font-extrabold text-gray-950">
          {boldText}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Helper to parse and render a markdown table into a styled React component
 */
function renderMarkdownTableReact(tableLines: string[], key: string): React.ReactNode {
  if (tableLines.length === 0) return null;

  const parseRow = (rowStr: string) => {
    let trimmed = rowStr.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
    return trimmed.split("|").map((cell) => cell.trim());
  };

  const isDelimiter = (rowStr: string) => {
    return /^[\s|:-]+$/.test(rowStr.trim()) && rowStr.includes("-");
  };

  let headerCells: string[] = [];
  let dataRowsStr: string[] = [];

  if (tableLines.length >= 2 && isDelimiter(tableLines[1])) {
    headerCells = parseRow(tableLines[0]);
    dataRowsStr = tableLines.slice(2);
  } else if (tableLines.length >= 1 && isDelimiter(tableLines[0])) {
    dataRowsStr = tableLines.slice(1);
  } else {
    dataRowsStr = tableLines;
  }

  // Filter out empty rows or alignment delimiter artifacts (e.g. lines with only colons/hyphens)
  const rows = dataRowsStr
    .map(parseRow)
    .filter((rowCells) => rowCells.some((cell) => cell.replace(/[:\s-]/g, "").length > 0));

  if (headerCells.length === 0 && rows.length === 0) return null;

  const colWidths = headerCells.length === 4 
    ? ["w-[6%]", "w-[26%]", "w-[38%]", "w-[30%]"]
    : headerCells.length === 5 
    ? ["w-[6%]", "w-[24%]", "w-[25%]", "w-[25%]", "w-[20%]"]
    : headerCells.map(() => "");

  return (
    <div key={key} className="my-6 overflow-x-auto rounded-xl border border-teal-200/90 shadow-xs bg-white">
      <table className="w-full text-right border-collapse text-xs md:text-sm table-fixed" dir="rtl">
        {headerCells.length > 0 && (
          <thead className="bg-[#094d4e] text-white">
            <tr>
              {headerCells.map((h, i) => (
                <th key={i} className={`p-3 px-3.5 font-black border-b border-teal-700 text-right align-middle break-words ${colWidths[i] || ""}`}>
                  {renderInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-teal-100/80">
          {rows.map((rowCells, rIdx) => (
            <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white hover:bg-teal-50/40" : "bg-teal-50/25 hover:bg-teal-50/60"}>
              {rowCells.map((cell, cIdx) => (
                <td key={cIdx} className={`p-3 px-3.5 text-gray-850 leading-relaxed font-normal align-top text-right break-words ${colWidths[cIdx] || ""}`}>
                  {renderInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Helper to render a markdown table into MS Word HTML string with explicit table-layout and column widths
 */
function renderMarkdownTableHtml(tableLines: string[]): string {
  if (tableLines.length === 0) return "";

  const parseRow = (rowStr: string) => {
    let trimmed = rowStr.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
    return trimmed.split("|").map((cell) => cell.trim());
  };

  const isDelimiter = (rowStr: string) => {
    return /^[\s|:-]+$/.test(rowStr.trim()) && rowStr.includes("-");
  };

  let headerCells: string[] = [];
  let dataRowsStr: string[] = [];

  if (tableLines.length >= 2 && isDelimiter(tableLines[1])) {
    headerCells = parseRow(tableLines[0]);
    dataRowsStr = tableLines.slice(2);
  } else if (tableLines.length >= 1 && isDelimiter(tableLines[0])) {
    dataRowsStr = tableLines.slice(1);
  } else {
    dataRowsStr = tableLines;
  }

  // Filter out empty delimiter artifact rows
  const rows = dataRowsStr
    .map(parseRow)
    .filter((rowCells) => rowCells.some((cell) => cell.replace(/[:\s-]/g, "").length > 0));

  if (headerCells.length === 0 && rows.length === 0) return "";

  const colWidths = headerCells.length === 4 
    ? ["6%", "26%", "38%", "30%"]
    : headerCells.length === 5 
    ? ["6%", "24%", "25%", "25%", "20%"]
    : headerCells.map(() => `${Math.floor(100 / (headerCells.length || 1))}%`);

  let html = `<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 16pt; margin-bottom: 20pt; font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5pt;" dir="rtl">\n`;
  if (headerCells.length > 0) {
    html += `  <thead>\n    <tr style="background-color: #094d4e; color: #ffffff;">\n`;
    headerCells.forEach((h, i) => {
      const w = colWidths[i] || "auto";
      html += `      <th style="width: ${w}; padding: 8pt 8pt; border: 1pt solid #094d4e; font-weight: bold; text-align: right; font-size: 10pt; word-break: break-word; overflow-wrap: break-word;">${formatInlineHtml(h)}</th>\n`;
    });
    html += `    </tr>\n  </thead>\n`;
  }

  html += `  <tbody>\n`;
  rows.forEach((rowCells, rIdx) => {
    const bgColor = rIdx % 2 === 0 ? "#ffffff" : "#f0fdfa";
    html += `    <tr style="background-color: ${bgColor};">\n`;
    rowCells.forEach((cell, cIdx) => {
      const w = colWidths[cIdx] || "auto";
      html += `      <td style="width: ${w}; padding: 8pt 8pt; border: 1pt solid #cbd5e1; text-align: right; line-height: 1.5; color: #1e293b; vertical-align: top; word-break: break-word; overflow-wrap: break-word;">${formatInlineHtml(cell)}</td>\n`;
    });
    html += `    </tr>\n`;
  });
  html += `  </tbody>\n</table>\n`;

  return html;
}

/**
 * Converts a raw report string (containing markdown and XML) into structured React components.
 * Formats headers, Q&A blocks, scope disclosures, tables, and lists seamlessly with generous spacing.
 */
export function parseMarkdownToReact(text: string): React.ReactNode {
  if (!text) return null;

  const normalized = normalizeReportStructure(text);
  const lines = normalized.split("\n");

  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let currentTableLines: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul`} className="my-4 space-y-2 pr-4 border-r-3 border-teal-600/40 bg-teal-50/30 p-3 rounded-l-xl">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  const flushTable = (keyPrefix: string) => {
    if (currentTableLines.length > 0) {
      const tableNode = renderMarkdownTableReact(currentTableLines, `${keyPrefix}-tbl`);
      if (tableNode) elements.push(tableNode);
      currentTableLines = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Check if line is a table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
      flushList(`line-${idx}`);
      currentTableLines.push(trimmed);
      continue;
    } else {
      flushTable(`line-${idx}`);
    }

    if (!trimmed) {
      flushList(`line-${idx}`);
      continue;
    }

    // Horizontal rule divider
    if (trimmed === "---") {
      flushList(`line-${idx}`);
      elements.push(
        <hr key={idx} className="my-6 border-t-2 border-teal-100/80" />
      );
      continue;
    }

    // Meta / Scope disclosure banners
    if (trimmed.startsWith("عنوان تقرير التوليف:") || trimmed.startsWith("محتوى التقرير الأكاديمي:")) {
      flushList(`line-${idx}`);
      elements.push(
        <div key={idx} className="mt-4 mb-2 p-2.5 px-4 bg-[#094d4e]/10 border-r-4 border-[#094d4e] text-[#094d4e] font-extrabold text-xs md:text-sm rounded-lg flex items-center gap-2">
          <span>{trimmed}</span>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith("توضيح النطاق:")) {
      flushList(`line-${idx}`);
      elements.push(
        <div key={idx} className="my-4 p-3.5 px-4 bg-teal-50/90 border border-teal-200/80 text-[#094d4e] text-xs md:text-sm font-semibold rounded-xl shadow-2xs flex items-center gap-2 leading-relaxed">
          <span className="shrink-0 bg-[#094d4e] text-white px-2 py-0.5 rounded text-[11px] font-extrabold">نطاق التقرير</span>
          <span className="flex-1">{trimmed.replace("توضيح النطاق:", "").trim()}</span>
        </div>
      );
      continue;
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
          <h2 key={idx} className="text-base md:text-xl font-black text-[#094d4e] mt-7 mb-4 pb-2 border-b-2 border-teal-200/80 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#094d4e] rounded-sm shrink-0"></span>
            <span>{headingContent}</span>
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3 key={idx} className="text-sm md:text-lg font-extrabold text-[#094d4e] mt-6 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0"></span>
            <span>{headingContent}</span>
          </h3>
        );
      } else {
        // level >= 4
        if (isQAHeading) {
          const colonIdx = headingContent.indexOf(":");
          const qPrefix = colonIdx !== -1 ? headingContent.substring(0, colonIdx + 1) : "سؤال:";
          const qBody = colonIdx !== -1 ? headingContent.substring(colonIdx + 1) : headingContent;
          elements.push(
            <div key={idx} className="mt-6 mb-3 p-4 md:p-5 bg-teal-50/90 border-r-4 border-r-[#094d4e] border border-teal-200/90 rounded-xl shadow-xs">
              <div className="flex items-start gap-2.5">
                <span className="bg-[#094d4e] text-white px-2.5 py-1 rounded-md text-xs font-black shrink-0 mt-0.5">
                  {qPrefix}
                </span>
                <h4 className="text-sm md:text-base font-extrabold text-[#094d4e] leading-snug flex-1">
                  {renderInlineMarkdown(qBody.trim())}
                </h4>
              </div>
            </div>
          );
        } else {
          elements.push(
            <h4 key={idx} className="text-xs md:text-sm font-extrabold text-gray-900 mt-5 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#094d4e] shrink-0"></span>
              <span>{renderInlineMarkdown(headingContent)}</span>
            </h4>
          );
        }
      }
      continue;
    }

    // Direct Question line without #### (e.g. "س1: ما هي...")
    const directQuestionMatch = /^(س\d+:|سؤال\s*\d*:|\*\*س\d+:\*\*)\s*(.*)$/i.exec(trimmed);
    if (directQuestionMatch) {
      flushList(`line-${idx}`);
      const qPrefix = directQuestionMatch[1].replace(/\*/g, "").trim();
      const qBody = directQuestionMatch[2].trim();
      elements.push(
        <div key={idx} className="mt-6 mb-3 p-4 md:p-5 bg-teal-50/90 border-r-4 border-r-[#094d4e] border border-teal-200/90 rounded-xl shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="bg-[#094d4e] text-white px-2.5 py-1 rounded-md text-xs font-black shrink-0 mt-0.5">
              {qPrefix}
            </span>
            <h4 className="text-sm md:text-base font-extrabold text-[#094d4e] leading-snug flex-1">
              {renderInlineMarkdown(qBody)}
            </h4>
          </div>
        </div>
      );
      continue;
    }

    // Check for List Items: * or - or 1.
    const listMatch = /^([*-]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      const itemContent = listMatch[2];
      currentListItems.push(
        <li key={idx} className="text-xs md:text-sm text-gray-800 leading-relaxed flex items-start gap-2.5 py-0.5">
          <span className="text-[#094d4e] font-black shrink-0 mt-0.5 text-base">•</span>
          <span className="flex-1">{renderInlineMarkdown(itemContent)}</span>
        </li>
      );
      continue;
    }

    // Check if line starts with Answer tag (**ج:** or ج: or **إجابة:** or إجابة:)
    if (/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*)/.test(trimmed)) {
      flushList(`line-${idx}`);
      const body = trimmed.replace(/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*)/, "").trim();
      elements.push(
        <div key={idx} className="mt-2 mb-6 p-4 md:p-5 bg-emerald-50/60 border-r-4 border-r-emerald-600 border border-emerald-200/80 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded text-xs font-black">
              الإجابة العلمية (ج)
            </span>
          </div>
          <div className="text-xs md:text-sm leading-relaxed md:leading-loose text-gray-800 font-normal">
            {renderInlineMarkdown(body)}
          </div>
        </div>
      );
      continue;
    }

    // Normal paragraph line
    flushList(`line-${idx}`);

    elements.push(
      <p key={idx} className="text-xs md:text-sm leading-relaxed md:leading-loose text-gray-800 my-3 font-sans">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList("end");
  flushTable("end");

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
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong style='font-weight: bold; color: #0f172a;'>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

/**
 * Converts report text containing markdown and evidence tags into an MS Word compatible HTML document string.
 */
export function markdownToWordHtml(title: string, markdownText: string): string {
  const normalized = normalizeReportStructure(markdownText);
  const lines = normalized.split("\n");

  let bodyHtml = "";
  let inList = false;
  let currentTableLines: string[] = [];

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      bodyHtml += renderMarkdownTableHtml(currentTableLines);
      currentTableLines = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      currentTableLines.push(trimmed);
      return;
    } else {
      flushTable();
    }

    if (!trimmed) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      return;
    }

    // Divider
    if (trimmed === "---") {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      bodyHtml += `<hr style="border: none; border-top: 1.5pt solid #094d4e; margin-top: 18pt; margin-bottom: 18pt;" />\n`;
      return;
    }

    // Meta / Scope disclosure
    if (trimmed.startsWith("عنوان تقرير التوليف:") || trimmed.startsWith("محتوى التقرير الأكاديمي:")) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      bodyHtml += `<div style="background-color: #f0fdfa; border-right: 3.5pt solid #094d4e; padding: 8pt 12pt; margin-top: 12pt; margin-bottom: 10pt; font-weight: bold; color: #094d4e; font-size: 11pt; font-family: 'Segoe UI', Arial, sans-serif;">${formatInlineHtml(trimmed)}</div>\n`;
      return;
    }

    if (trimmed.startsWith("توضيح النطاق:")) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      bodyHtml += `<div style="background-color: #f0fdfa; border: 1pt solid #99f6e4; border-right: 3.5pt solid #094d4e; padding: 10pt 12pt; margin-top: 12pt; margin-bottom: 14pt; border-radius: 4pt; color: #0f766e; font-size: 10.5pt; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.7;"><strong>نطاق التقرير:</strong> ${formatInlineHtml(trimmed.replace("توضيح النطاق:", "").trim())}</div>\n`;
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
      const content = headingMatch[2];
      const isQAHeading = /^(س\d*|سؤال|س):/i.test(content.trim());

      if (level <= 2) {
        bodyHtml += `<h2 style="color: #094d4e; font-size: 16pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 20pt; margin-bottom: 8pt; font-weight: bold; border-bottom: 2pt solid #094d4e; padding-bottom: 4pt;">${cleanMarkdownToPlainText(content)}</h2>\n`;
      } else if (level === 3) {
        bodyHtml += `<h3 style="color: #094d4e; font-size: 13.5pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 16pt; margin-bottom: 6pt; font-weight: bold;">${cleanMarkdownToPlainText(content)}</h3>\n`;
      } else {
        if (isQAHeading) {
          const colonIdx = content.indexOf(":");
          const qPrefix = colonIdx !== -1 ? content.substring(0, colonIdx + 1) : "سؤال:";
          const qBody = colonIdx !== -1 ? content.substring(colonIdx + 1) : content;
          bodyHtml += `<div style="background-color: #f0fdfa; border-right: 4pt solid #094d4e; border: 1pt solid #ccfbf1; padding: 10pt 14pt; margin-top: 16pt; margin-bottom: 6pt; border-radius: 6pt;"><strong style="color: #094d4e; font-size: 11.5pt;">${formatInlineHtml(qPrefix)}</strong> <span style="font-size: 11.5pt; font-weight: bold; color: #0f172a;">${formatInlineHtml(qBody.trim())}</span></div>\n`;
        } else {
          bodyHtml += `<h4 style="color: #0f766e; font-size: 11.5pt; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 14pt; margin-bottom: 6pt; font-weight: bold;">${cleanMarkdownToPlainText(content)}</h4>\n`;
        }
      }
      return;
    }

    // Direct question
    const directQuestionMatch = /^(س\d+:|سؤال\s*\d*:|\*\*س\d+:\*\*)\s*(.*)$/i.exec(trimmed);
    if (directQuestionMatch) {
      if (inList) {
        bodyHtml += "</ul>\n";
        inList = false;
      }
      const qPrefix = directQuestionMatch[1].replace(/\*/g, "").trim();
      const qBody = directQuestionMatch[2].trim();
      bodyHtml += `<div style="background-color: #f0fdfa; border-right: 4pt solid #094d4e; border: 1pt solid #ccfbf1; padding: 10pt 14pt; margin-top: 16pt; margin-bottom: 6pt; border-radius: 6pt;"><strong style="color: #094d4e; font-size: 11.5pt;">${formatInlineHtml(qPrefix)}</strong> <span style="font-size: 11.5pt; font-weight: bold; color: #0f172a;">${formatInlineHtml(qBody)}</span></div>\n`;
      return;
    }

    // Bullet lists
    const listMatch = /^([*-]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      if (!inList) {
        bodyHtml += `<ul style="margin-right: 18pt; margin-top: 6pt; margin-bottom: 10pt; font-size: 11pt; font-family: 'Segoe UI', Arial, sans-serif;">\n`;
        inList = true;
      }
      const itemText = formatInlineHtml(listMatch[2]);
      bodyHtml += `  <li style="margin-bottom: 6pt; line-height: 1.8;">${itemText}</li>\n`;
      return;
    }

    if (inList) {
      bodyHtml += "</ul>\n";
      inList = false;
    }

    // QA Answer lines
    if (/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*)/.test(trimmed)) {
      const answerContent = trimmed.replace(/^(\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*)/, "").trim();
      bodyHtml += `<div style="background-color: #f0fdf4; border-right: 4pt solid #059669; border: 1pt solid #dcfce7; padding: 10pt 14pt; margin-top: 6pt; margin-bottom: 16pt; border-radius: 6pt; font-size: 11pt; line-height: 1.8;"><strong style="color: #047857; font-size: 11pt;">الإجابة العلمية (ج):</strong> <span style="color: #1e293b;">${formatInlineHtml(answerContent)}</span></div>\n`;
      return;
    }

    // Standard paragraph
    bodyHtml += `<p style="margin-bottom: 12pt; font-size: 11pt; line-height: 1.8; color: #1e293b; font-family: 'Segoe UI', Arial, sans-serif; text-align: justify;">${formatInlineHtml(trimmed)}</p>\n`;
  });

  if (inList) {
    bodyHtml += "</ul>\n";
  }
  flushTable();

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
    color: #1e293b;
    margin: 30pt;
  }
  h1, h2, h3, h4 { font-family: 'Segoe UI', 'Traditional Arabic', sans-serif; }
</style>
</head>
<body>
  ${title ? `<h1 style="color: #094d4e; font-size: 20pt; font-weight: bold; margin-bottom: 14pt; border-bottom: 2pt solid #094d4e; padding-bottom: 8pt;">${title}</h1>` : ""}
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

