/**
 * Utility for converting Markdown reports into Word-compatible, Right-to-Left (R2L) rich HTML
 * so that when copied and pasted into Microsoft Word or Google Docs, all headings,
 * tables, lists, bold text, and R2L alignment are natively preserved.
 */

/**
 * Format inline markdown syntax (bold, italic, code, links) into HTML with inline Word styles
 */
function formatInlineMarkdown(text: string): string {
  if (!text) return "";

  let res = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text** or __text__
  res = res.replace(/(\*\*|__)(.*?)\1/g, '<strong style="font-weight: bold; color: #094d4e;">$2</strong>');

  // Italic *text* or _text_
  res = res.replace(/(\*|_)(.*?)\1/g, '<em style="font-style: italic;">$2</em>');

  // Inline code `text`
  res = res.replace(/`(.*?)`/g, '<code style="font-family: Consolas, monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-size: 10pt;">$1</code>');

  return res;
}

/**
 * Converts Markdown text to full Word-optimized HTML document with explicit RTL directions and styles.
 */
export function markdownToRtlHtml(markdown: string, title?: string): string {
  if (!markdown) return "";

  // Strip XML evidence tags if present to keep output clean for academic reports
  const cleanMd = markdown.replace(/<evidence([\s\S]*?)>([\s\S]*?)<\/evidence>/gi, "").trim();

  const lines = cleanMd.split(/\r?\n/);
  const htmlLines: string[] = [];
  
  let inTable = false;
  let tableRows: string[][] = [];
  let inList: "ul" | "ol" | null = null;

  const closeListIfOpen = () => {
    if (inList) {
      htmlLines.push(`</${inList}>`);
      inList = null;
    }
  };

  const closeTableIfOpen = () => {
    if (inTable) {
      if (tableRows.length > 0) {
        let tableHtml = `<table border="1" cellPadding="6" cellSpacing="0" style="border-collapse: collapse; width: 100%; margin-top: 12pt; margin-bottom: 12pt; border: 1px solid #cbd5e1; direction: rtl; font-family: 'Segoe UI', Arial, sans-serif; text-align: right;" dir="rtl">`;
        
        // Header row
        if (tableRows.length >= 1) {
          tableHtml += `<thead><tr style="background-color: #094d4e; color: #ffffff;">`;
          tableRows[0].forEach((cell) => {
            tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 8pt 10pt; font-weight: bold; text-align: right; background-color: #094d4e; color: #ffffff; font-size: 11pt; direction: rtl;">${formatInlineMarkdown(cell.trim())}</th>`;
          });
          tableHtml += `</tr></thead>`;
        }

        // Body rows
        if (tableRows.length > 1) {
          tableHtml += `<tbody>`;
          for (let i = 1; i < tableRows.length; i++) {
            const bg = i % 2 === 0 ? "#f8fafc" : "#ffffff";
            tableHtml += `<tr style="background-color: ${bg};">`;
            tableRows[i].forEach((cell) => {
              tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 7pt 10pt; text-align: right; font-size: 10.5pt; color: #1e293b; direction: rtl;">${formatInlineMarkdown(cell.trim())}</td>`;
            });
            tableHtml += `</tr>`;
          }
          tableHtml += `</tbody>`;
        }

        tableHtml += `</table>`;
        htmlLines.push(tableHtml);
      }
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table rows pattern: | cell | cell |
    if (line.startsWith("|") && line.endsWith("|")) {
      closeListIfOpen();
      // Ignore divider row like | --- | --- |
      if (/^\|[\s\-:\r|]+\|$/.test(line)) {
        continue;
      }
      const cells = line.split("|").slice(1, -1);
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      continue;
    } else {
      closeTableIfOpen();
    }

    // Headings
    if (line.startsWith("# ")) {
      closeListIfOpen();
      const text = line.substring(2).trim();
      htmlLines.push(`<h1 dir="rtl" style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; font-size: 20pt; font-weight: bold; color: #094d4e; margin-top: 18pt; margin-bottom: 8pt; line-height: 1.4;">${formatInlineMarkdown(text)}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeListIfOpen();
      const text = line.substring(3).trim();
      htmlLines.push(`<h2 dir="rtl" style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; font-size: 16pt; font-weight: bold; color: #0d6264; margin-top: 14pt; margin-bottom: 6pt; line-height: 1.4; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt;">${formatInlineMarkdown(text)}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      closeListIfOpen();
      const text = line.substring(4).trim();
      htmlLines.push(`<h3 dir="rtl" style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; font-size: 13.5pt; font-weight: bold; color: #1e293b; margin-top: 12pt; margin-bottom: 4pt; line-height: 1.4;">${formatInlineMarkdown(text)}</h3>`);
      continue;
    }
    if (line.startsWith("#### ")) {
      closeListIfOpen();
      const text = line.substring(5).trim();
      htmlLines.push(`<h4 dir="rtl" style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; font-size: 12pt; font-weight: bold; color: #334155; margin-top: 10pt; margin-bottom: 4pt; line-height: 1.4;">${formatInlineMarkdown(text)}</h4>`);
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      closeListIfOpen();
      const text = line.substring(2).trim();
      htmlLines.push(`<blockquote dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #334155; background-color: #f1f5f9; border-right: 4px solid #094d4e; margin: 10pt 0; padding: 8pt 12pt; font-style: italic;">${formatInlineMarkdown(text)}</blockquote>`);
      continue;
    }

    // Unordered Lists (- or * or •)
    const ulMatch = line.match(/^[\-\*\•]\s+(.+)/);
    if (ulMatch) {
      if (inList !== "ul") {
        closeListIfOpen();
        inList = "ul";
        htmlLines.push(`<ul dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin-top: 6pt; margin-bottom: 6pt; padding-right: 24pt; list-style-type: disc;">`);
      }
      htmlLines.push(`<li style="direction: rtl; text-align: right; margin-bottom: 4pt; line-height: 1.7;">${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered Lists (1. 2. etc.)
    const olMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) {
      if (inList !== "ol") {
        closeListIfOpen();
        inList = "ol";
        htmlLines.push(`<ol dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin-top: 6pt; margin-bottom: 6pt; padding-right: 24pt;">`);
      }
      htmlLines.push(`<li style="direction: rtl; text-align: right; margin-bottom: 4pt; line-height: 1.7;">${formatInlineMarkdown(olMatch[2])}</li>`);
      continue;
    }

    // Empty lines
    if (!line) {
      closeListIfOpen();
      continue;
    }

    // Paragraph
    closeListIfOpen();
    htmlLines.push(`<p dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.85; color: #1e293b; margin-top: 0; margin-bottom: 8pt;">${formatInlineMarkdown(line)}</p>`);
  }

  closeTableIfOpen();
  closeListIfOpen();

  let bodyContent = htmlLines.join("\n");

  if (title) {
    const titleHeader = `<h1 dir="rtl" style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; font-size: 22pt; font-weight: bold; color: #094d4e; margin-top: 0; margin-bottom: 12pt; border-bottom: 2px solid #094d4e; padding-bottom: 6pt;">${formatInlineMarkdown(title)}</h1>`;
    bodyContent = titleHeader + "\n" + bodyContent;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title || "تقرير بحث OS"}</title>
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
    direction: rtl;
    text-align: right;
    font-family: 'Segoe UI', Arial, 'Traditional Arabic', sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #1e293b;
    background-color: #ffffff;
    padding: 20pt;
  }
  h1, h2, h3, h4, h5, h6 {
    direction: rtl;
    text-align: right;
    font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif;
  }
  p, li, blockquote, td, th {
    direction: rtl;
    text-align: right;
  }
  table {
    direction: rtl;
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    direction: rtl;
    text-align: right;
    border: 1px solid #cbd5e1;
  }
</style>
</head>
<body dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif;">
<div dir="rtl" style="direction: rtl; text-align: right; font-family: 'Segoe UI', Arial, sans-serif;">
${bodyContent}
</div>
</body>
</html>`;
}

/**
 * Copies markdown text to the system clipboard as both Rich Text HTML (for MS Word / Google Docs)
 * and clean plain text as a fallback.
 */
export async function copyReportToClipboard(markdownText: string, title?: string): Promise<boolean> {
  const cleanMarkdown = markdownText.replace(/<evidence([\s\S]*?)>([\s\S]*?)<\/evidence>/gi, "").trim();
  const htmlContent = markdownToRtlHtml(markdownText, title);

  // Method 1: Async Clipboard API with ClipboardItem
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([cleanMarkdown], { type: "text/plain" });

      const item = new window.ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });

      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn("ClipboardItem write failed, trying DOM selection fallback:", err);
  }

  // Method 2: DOM Range Selection Fallback (Works reliably in virtually all browsers)
  try {
    const hiddenDiv = document.createElement("div");
    hiddenDiv.setAttribute("dir", "rtl");
    hiddenDiv.style.direction = "rtl";
    hiddenDiv.style.textAlign = "right";
    hiddenDiv.style.position = "fixed";
    hiddenDiv.style.left = "-9999px";
    hiddenDiv.style.top = "-9999px";
    hiddenDiv.innerHTML = htmlContent;
    document.body.appendChild(hiddenDiv);

    const range = document.createRange();
    range.selectNodeContents(hiddenDiv);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      const success = document.execCommand("copy");
      selection.removeAllRanges();
      document.body.removeChild(hiddenDiv);
      if (success) return true;
    }
  } catch (e) {
    console.warn("execCommand fallback failed:", e);
  }

  // Method 3: Standard text copy fallback
  try {
    await navigator.clipboard.writeText(cleanMarkdown);
    return true;
  } catch (e) {
    console.error("All copy attempts failed:", e);
    return false;
  }
}
