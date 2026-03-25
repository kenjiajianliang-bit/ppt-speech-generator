declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    [key: string]: any;
  }

  interface PDFData {
    numpages: number;
    text: string;
    info: PDFInfo;
    [key: string]: any;
  }

  function pdf(data: Buffer, options?: any): Promise<PDFData>;

  export default pdf;
}
