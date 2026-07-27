import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Scale, 
  BookOpen 
} from "lucide-react";
import { parseMarkdownToReact, stripEvidenceTags } from "../utils/reportFormatter";

export { stripEvidenceTags };

export interface EvidenceNode {
  strength: string; // "قوية" | "جيدة" | "محدودة"
  agreement: string; // "متفقة" | "متفقة إلى حد كبير" | "يوجد اختلاف جزئي" | "مختلفة"
  supporting: string; // e.g. "3 من أصل 4 مصادر"
  supportingSources: { title: string; quotes: string[] }[];
  opposingSources?: { title: string; quotes: string[] }[];
  explanation: string;
}

export type ContentItem = 
  | { type: "text"; content: string }
  | { type: "evidence"; data: EvidenceNode };

/**
 * Safely parses the report text containing XML evidence tags into structured items.
 */
export function parseReportText(text: string): ContentItem[] {
  if (!text) return [];
  
  const items: ContentItem[] = [];
  let currentIndex = 0;

  // Regex to find any <evidence ...> ... </evidence> block
  const regex = /<evidence([\s\S]*?)>([\s\S]*?)<\/evidence>/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    
    // 1. Save text block before the match if there is any
    if (matchIndex > currentIndex) {
      items.push({
        type: "text",
        content: text.substring(currentIndex, matchIndex),
      });
    }

    const attrText = match[1];
    const body = match[2];

    // Extract attributes resiliently (order-independent)
    const strengthMatch = /strength="([^"]*)"/i.exec(attrText);
    const agreementMatch = /agreement="([^"]*)"/i.exec(attrText);
    const supportingMatchAttr = /supporting="([^"]*)"/i.exec(attrText);

    const strength = strengthMatch ? strengthMatch[1].trim() : "جيدة";
    const agreement = agreementMatch ? agreementMatch[1].trim() : "متفقة";
    const supporting = supportingMatchAttr ? supportingMatchAttr[1].trim() : "1 من أصل 1";

    // Parse the inner content of the evidence block
    const supportingSources: { title: string; quotes: string[] }[] = [];
    const opposingSources: { title: string; quotes: string[] }[] = [];
    let explanation = "";

    // Parse <supporting> ... </supporting>
    const supportingMatch = /<supporting>([\s\S]*?)<\/supporting>/i.exec(body);
    if (supportingMatch) {
      const supportingBody = supportingMatch[1];
      const sourceRegex = /<source\s+title="([^"]*)"\s*>([\s\S]*?)<\/source>/gi;
      let srcMatch;
      while ((srcMatch = sourceRegex.exec(supportingBody)) !== null) {
        const title = srcMatch[1].trim();
        const srcContent = srcMatch[2];
        const quotes: string[] = [];
        const quoteRegex = /<quote>([\s\S]*?)<\/quote>/gi;
        let qMatch;
        while ((qMatch = quoteRegex.exec(srcContent)) !== null) {
          quotes.push(qMatch[1].trim());
        }
        supportingSources.push({ title, quotes });
      }
    }

    // Parse <opposing> ... </opposing>
    const opposingMatch = /<opposing>([\s\S]*?)<\/opposing>/i.exec(body);
    if (opposingMatch) {
      const opposingBody = opposingMatch[1];
      const sourceRegex = /<source\s+title="([^"]*)"\s*>([\s\S]*?)<\/source>/gi;
      let srcMatch;
      while ((srcMatch = sourceRegex.exec(opposingBody)) !== null) {
        const title = srcMatch[1].trim();
        const srcContent = srcMatch[2];
        const quotes: string[] = [];
        const quoteRegex = /<quote>([\s\S]*?)<\/quote>/gi;
        let qMatch;
        while ((qMatch = quoteRegex.exec(srcContent)) !== null) {
          quotes.push(qMatch[1].trim());
        }
        opposingSources.push({ title, quotes });
      }
    }

    // Parse <explanation> ... </explanation>
    const explanationMatch = /<explanation>([\s\S]*?)<\/explanation>/i.exec(body);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
    }

    items.push({
      type: "evidence",
      data: {
        strength,
        agreement,
        supporting,
        supportingSources,
        opposingSources: opposingSources.length > 0 ? opposingSources : undefined,
        explanation: explanation || "تم التوصل إلى الاستنتاج بناءً على توافق الأدلة في وثائق المجموعة الأكاديمية.",
      }
    });

    currentIndex = regex.lastIndex;
  }

  // 2. Add remaining text if there is any
  if (currentIndex < text.length) {
    items.push({
      type: "text",
      content: text.substring(currentIndex),
    });
  }

  return items;
}

/**
 * Helper to select the single shortest quotation from an array of quotes
 */
function getShortestQuote(quotes: string[]): string {
  if (!quotes || quotes.length === 0) return "";
  const sorted = [...quotes].sort((a, b) => a.length - b.length);
  return sorted[0];
}

/**
 * Collapsible Evidence Layer Component
 */
export function EvidenceLayer({ data }: { data: EvidenceNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-3 border border-teal-50 rounded-xl overflow-hidden shadow-2xs font-sans text-right" dir="rtl">
      {/* Collapsed view summary bar - shows ONLY "▼ الأدلة" or "▲ الأدلة" */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-xs font-bold text-teal-800 bg-gray-50/80 p-2.5 px-4 cursor-pointer hover:bg-teal-50/40 transition-colors select-none ${isOpen ? "border-b border-gray-100" : ""}`}
      >
        {isOpen ? <ChevronUp className="w-4 h-4 text-teal-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-teal-600 flex-shrink-0" />}
        <span>الأدلة</span>
      </div>

      {/* Expanded view content with no redundant information and in the exact academic evaluation order */}
      {isOpen && (
        <div className="bg-white p-4 px-5 space-y-4">
          
          {/* 1. قوة الأدلة */}
          <div className="flex items-center gap-2 text-xs pb-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">قوة الأدلة:</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              data.strength === "قوية" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
              data.strength === "جيدة" ? "bg-amber-50 text-amber-700 border border-amber-200" : 
              "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>{data.strength}</span>
          </div>

          {/* 2. حالة المصادر */}
          <div className="flex items-center gap-2 text-xs pb-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">حالة المصادر:</span>
            <span className="text-gray-900 font-semibold">{data.agreement} ({data.supporting})</span>
          </div>

          {/* 3. المصادر الداعمة */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-gray-500 block">المصادر الداعمة:</span>
            <div className="space-y-1.5 pr-2">
              {data.supportingSources.map((src, sIdx) => (
                <div key={sIdx} className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="text-emerald-600">📖</span>
                  <span>{src.title}</span>
                </div>
              ))}
              {data.opposingSources && data.opposingSources.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 block">المصادر المعارضة:</span>
                  {data.opposingSources.map((src, sIdx) => (
                    <div key={sIdx} className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <span className="text-rose-600">⚠️</span>
                      <span>{src.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. الاقتباسات (Verbatim shortest quote per document) */}
          <div className="space-y-2.5 pt-1">
            <span className="text-xs font-bold text-gray-500 block">الاقتباسات:</span>
            <div className="space-y-2.5 pr-2">
              {data.supportingSources.map((src, sIdx) => {
                const shortest = getShortestQuote(src.quotes);
                if (!shortest) return null;
                return (
                  <div key={sIdx} className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400">{src.title}:</p>
                    <p className="text-xs text-gray-600 italic font-medium leading-relaxed bg-[#fafaf8] p-2 px-3 border-r-2 border-emerald-500 rounded-l">
                      "{shortest}"
                    </p>
                  </div>
                );
              })}
              {data.opposingSources && data.opposingSources.map((src, sIdx) => {
                const shortest = getShortestQuote(src.quotes);
                if (!shortest) return null;
                return (
                  <div key={sIdx} className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400">{src.title} (معارض):</p>
                    <p className="text-xs text-gray-600 italic font-medium leading-relaxed bg-rose-50/20 p-2 px-3 border-r-2 border-rose-500 rounded-l">
                      "{shortest}"
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. سبب الاستنتاج */}
          <div className="space-y-1.5 pt-3 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-500 block">سبب الاستنتاج:</span>
            <p className="text-xs text-gray-600 leading-relaxed font-medium bg-teal-50/20 p-3 rounded-lg border border-teal-50/30">
              {data.explanation}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

interface SynthesisReportViewProps {
  text: string;
}

export default function SynthesisReportView({ text }: SynthesisReportViewProps) {
  if (!text) return null;

  const parsedItems = parseReportText(text);

  return (
    <div className="w-full text-right font-sans" dir="rtl">
      {parsedItems.map((item, index) => {
        if (item.type === "text") {
          return (
            <div key={index} className="mb-3">
              {parseMarkdownToReact(item.content)}
            </div>
          );
        } else {
          return <div key={index}><EvidenceLayer data={item.data} /></div>;
        }
      })}
    </div>
  );
}
