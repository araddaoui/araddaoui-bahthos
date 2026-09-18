import React from "react";

export const parseMarkdownToReact = (text: string = "") => {
  return React.createElement("div", null, text);
};

export const formatReportText = (text: string = "") => text;
export const cleanReportMarkdown = (text: string = "") => text;
export const renderMarkdown = (text: string = "") => text;
export const deduplicateSources = <T extends { id?: string }>(sources: T[] = []) => {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.id || JSON.stringify(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function copyReportToClipboard(_title: string, text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

export function exportToWordDocument(title: string, text: string = ""): void {
  if (typeof document === "undefined") return;
  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  const blob = new Blob([
    `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><div>${escapeHtml(text)}</div></body></html>`
  ], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title || "report"}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

export default parseMarkdownToReact;
