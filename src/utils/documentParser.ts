import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { normalizeArabicText } from './termExtractor';

// Set up worker for pdfjs in browser using jsdelivr CDN
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ParsedDocumentResult {
  text: string;
  base64?: undefined; // Explicitly undefined to prevent Vercel 413 Payload Too Large errors
  mimeType: string;
  fileName: string;
}

export async function parseDocumentFile(file: File): Promise<ParsedDocumentResult> {
  const fileName = file.name;
  const isPdf = file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isDocx = fileName.toLowerCase().endsWith(".docx") || 
                 fileName.toLowerCase().endsWith(".doc") || 
                 file.type.includes("word") || 
                 file.type.includes("office");

  if (isPdf) {
    let extractedText = "";
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
      });
      
      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("pdfjs load timeout")), 10000))
      ]);

      let fullText = "";
      const totalPages = Math.min(pdf.numPages, 120); // Process up to 120 pages

      for (let i = 1; i <= totalPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          if (pageText.trim()) {
            fullText += pageText + "\n\n";
          }
        } catch (pageErr) {
          console.warn(`Error reading page ${i} of PDF:`, pageErr);
        }
      }

      extractedText = normalizeArabicText(fullText.trim());
      console.log(`✅ Client PDF extracted: ${extractedText.length} characters from ${fileName}`);
    } catch (err) {
      console.warn("Client-side pdfjs text extraction failed or timed out:", err);
    }

    // If PDF text extraction is empty (e.g. scanned image PDF without text layer), provide a helpful structured notice
    if (!extractedText || extractedText.length < 20) {
      extractedText = `[مستند PDF: ${fileName}]\nملاحظة: هذا المستند قد يكون عبارة عن صورة مسحوبة (Scanned PDF) بدون طبقة نصية قابلة للقراءة المباشرة. يرجى استخدام ملف نصي قابل للبحث (Searchable PDF) للحصول على أفضل تحليل بحثي في نظام بحث OS.`;
    }

    // Chunk / truncate text if excessively large to keep JSON payload well under Vercel's 4.5MB limit
    if (extractedText.length > 100_000) {
      extractedText = extractedText.substring(0, 100_000) + "\n\n[... تم اقتصاص بقية النص لتجاوز الحد الأقصى للمعالجة الفورية ...] ";
    }

    return {
      text: extractedText,
      base64: undefined,
      mimeType: "application/pdf",
      fileName
    };
  }

  if (isDocx) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammothResult = await mammoth.extractRawText({ arrayBuffer } as any);
      let docText = "";
      if (mammothResult.value && mammothResult.value.trim().length > 0) {
        docText = normalizeArabicText(mammothResult.value.trim());
      }
      
      if (docText.length > 100_000) {
        docText = docText.substring(0, 100_000) + "\n\n[... تم اقتصاص بقية النص ...] ";
      }

      return {
        text: docText || `[مستند Word: ${fileName}]`,
        base64: undefined,
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName
      };
    } catch (err) {
      console.warn("Client-side mammoth text extraction failed:", err);
    }

    return {
      text: `[مستند Word: ${fileName}]`,
      base64: undefined,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName
    };
  }

  // Plain text / markdown / csv / json
  try {
    let text = await fileToText(file);
    text = normalizeArabicText(text);
    if (text.length > 100_000) {
      text = text.substring(0, 100_000) + "\n\n[... تم اقتصاص بقية النص ...] ";
    }
    return {
      text: text || `محتوى الملف ${fileName}`,
      base64: undefined,
      mimeType: file.type || "text/plain",
      fileName
    };
  } catch (e) {
    return {
      text: `[ملف: ${fileName}]`,
      base64: undefined,
      mimeType: file.type || "text/plain",
      fileName
    };
  }
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
