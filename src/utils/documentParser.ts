import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up worker for pdfjs in Vite / browser
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        if (pageText.trim()) {
          fullText += pageText + "\n\n";
        }
      }

      const extractedText = fullText.trim();
      
      // If client-side pdfjs extracted meaningful text, return it directly
      if (extractedText.length > 20) {
        return {
          text: extractedText,
          mimeType: "application/pdf",
          fileName
        };
      }
    } catch (err) {
      console.warn("Client-side pdfjs text extraction failed, falling back to base64:", err);
    }

    // Fallback if pdfjs failed or PDF is scanned image: read base64
    const base64 = await fileToBase64(file);
    return {
      text: "",
      base64,
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
