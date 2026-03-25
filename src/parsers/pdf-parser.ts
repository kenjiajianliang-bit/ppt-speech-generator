import * as fs from 'fs';
import pdf from 'pdf-parse';
import { PPTDocument, PPTSlide, Paragraph } from '../types';

/**
 * PDF 解析器 - 解析 PDF 文件并提取文本内容
 */
export class PDFParser {
  /**
   * 解析 PDF 文件
   * @param filePath - PDF 文件路径
   * @returns 解析后的文档对象（复用 PPTDocument 结构）
   */
  async parse(filePath: string): Promise<PPTDocument> {
    try {
      const fileName = filePath.split('/').pop() || 'unknown.pdf';
      const fileBuffer = fs.readFileSync(filePath);

      // 使用 pdf-parse 解析文件
      const pdfData = await pdf(fileBuffer);

      // 将 PDF 内容按页分割
      const slides: PPTSlide[] = [];

      // pdf-parse 不直接支持按页提取，需要手动处理
      // 这里我们简单地将整个文本按页数平均分割
      const totalPages = pdfData.numpages;
      const fullText = pdfData.text;

      // 简单处理：将整个文本分成若干页
      // 更精确的做法需要分析 PDF 结构
      const lines = fullText.split('\n').filter((line: string) => line.trim());
      const linesPerPage = Math.ceil(lines.length / totalPages);

      for (let i = 0; i < totalPages; i++) {
        const pageLines = lines.slice(i * linesPerPage, (i + 1) * linesPerPage);
        const pageText = pageLines.join('\n');

        if (pageText.trim()) {
          const pageSlides = this.parsePage(pageText, i + 1);
          slides.push(...pageSlides);
        }
      }

      // 如果解析后页数为 0，创建一个包含所有内容的单页
      if (slides.length === 0) {
        slides.push({
          slideNumber: 1,
          title: this.extractTitle(fullText),
          paragraphs: this.extractParagraphs(fullText),
          bulletPoints: undefined,
          notes: undefined
        });
      }

      return {
        fileName,
        totalSlides: slides.length,
        slides,
        metadata: {
          title: pdfData.info?.Title,
          author: pdfData.info?.Author,
          subject: pdfData.info?.Subject
        }
      };
    } catch (error) {
      throw new Error(`解析 PDF 文件失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析单页内容
   */
  private parsePage(text: string, slideNumber: number): PPTSlide[] {
    const lines = text.split('\n').filter(line => line.trim());
    const slides: PPTSlide[] = [];

    let currentTitle: string | undefined;
    let currentParagraphs: Paragraph[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 如果当前没有标题，第一行作为标题
      if (!currentTitle) {
        currentTitle = trimmed;
      } else {
        currentParagraphs.push({
          text: trimmed,
          level: 0
        });
      }
    }

    if (currentTitle || currentParagraphs.length > 0) {
      slides.push({
        slideNumber,
        title: currentTitle,
        paragraphs: currentParagraphs,
        bulletPoints: currentParagraphs.map(p => p.text),
        notes: undefined
      });
    }

    return slides;
  }

  /**
   * 提取标题
   */
  private extractTitle(text: string): string | undefined {
    const lines = text.split('\n').filter(line => line.trim());
    return lines[0]?.trim();
  }

  /**
   * 提取段落
   */
  private extractParagraphs(text: string): Paragraph[] {
    const lines = text.split('\n').filter(line => line.trim());
    // 跳过第一行（标题）
    return lines.slice(1).map(line => ({
      text: line.trim(),
      level: 0
    }));
  }

  /**
   * 将 PDF 内容转换为文本摘要（用于 AI 处理）
   */
  toTextSummary(doc: PPTDocument): string {
    return doc.slides.map(slide => {
      const parts = [];
      if (slide.title) parts.push(`[第${slide.slideNumber}页] ${slide.title}`);
      else parts.push(`[第${slide.slideNumber}页]`);

      if (slide.paragraphs.length > 0) {
        parts.push(slide.paragraphs.map(p => p.text).join(' | '));
      }

      return parts.join('\n');
    }).join('\n\n');
  }
}
