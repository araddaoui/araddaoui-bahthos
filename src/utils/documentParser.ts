import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up worker for pdfjs in browser using jsdelivr CDN with unpkg fallback
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ParsedDocumentResult {
  text: string;
  base64?: string;
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
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("pdfjs load timeout")), 8000))
      ]);

      let fullText = "";
      const totalPages = Math.min(pdf.numPages, 100); // Process up to 100 pages

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

      extractedText = fullText.trim();
      console.log(`✅ Client PDF extracted: ${extractedText.length} characters from ${fileName}`);
    } catch (err) {
      console.warn("Client-side pdfjs text extraction failed or timed out:", err);
    }

    const base64 = await fileToBase64(file);

    // If client extracted text, return it along with lightweight base64 fallback
    return {
      text: extractedText,
      base64: base64.length < 4_000_000 ? base64 : undefined, // omit huge base64 if > 4MB to prevent network 413
      mimeType: "application/pdf",
      fileName
    };
  }

  if (isDocx) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammothResult = await mammoth.extractRawText({ arrayBuffer } as any);
      if (mammothResult.value && mammothResult.value.trim().length > 10) {
        return {
          text: mammothResult.value.trim(),
          mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileName
        };
      }
    } catch (err) {
      console.warn("Client-side mammoth text extraction failed, falling back to base64:", err);
    }

    const base64 = await fileToBase64(file);
    return {
      text: "",
      base64,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName
    };
  }

  // Plain text / markdown / csv / json
  try {
    const text = await fileToText(file);
    return {
      text: text || `محتوى الملف ${fileName}`,
      mimeType: file.type || "text/plain",
      fileName
    };
  } catch (e) {
    const base64 = await fileToBase64(file);
    return {
      text: "",
      base64,
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
