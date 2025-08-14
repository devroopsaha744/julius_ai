import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromPDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

export async function extractTextFromWord(filePath: string): Promise<string> {
  const data = await mammoth.extractRawText({ path: filePath });
  return data.value;
}

export async function extractText(filePath: string): Promise<string> {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) throw new Error("File has no extension");

  if (ext === "pdf") {
    return extractTextFromPDF(filePath);
  } else if (ext === "docx") {
    return extractTextFromWord(filePath);
  } else {
    throw new Error("Unsupported file type. Only PDF and DOCX allowed.");
  }
}
