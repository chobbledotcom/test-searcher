declare module "pdf-parse" {
  interface PdfData {
    numpages: number;
    numrender: number;
    text: string;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  function pdf(dataBuffer: Buffer | Uint8Array): Promise<PdfData>;
  export default pdf;
}
