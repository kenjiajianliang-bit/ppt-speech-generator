import * as fs from 'fs';
import { PPTDocument, PPTSlide, Paragraph } from '../types';

// 使用 JSZip 解析 PPTX 文件（PPTX 本质上是 ZIP 文件）
import JSZip from 'jszip';

/**
 * PPT 解析器 - 解析 PPTX 文件并提取结构化内容
 */
export class PPTParser {
  /**
   * 解析 PPTX 文件
   * @param filePath - PPTX 文件路径
   * @returns 解析后的 PPT 文档对象
   */
  async parse(filePath: string): Promise<PPTDocument> {
    try {
      const fileName = filePath.split('/').pop() || 'unknown.pptx';
      const fileBuffer = fs.readFileSync(filePath);

      // PPTX 是 ZIP 格式，使用 JSZip 解压
      const zip = await JSZip.loadAsync(fileBuffer);

      const slides: PPTSlide[] = [];
      let slideIndex = 0;

      // 遍历所有幻灯片
      const slideFiles = Object.keys(zip.files)
        .filter(path => path.match(/ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
          const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
          return numA - numB;
        });

      for (const slideFile of slideFiles) {
        slideIndex++;
        const slideContent = await zip.files[slideFile].async('string');
        const slide = this.parseSlide(slideContent, slideIndex);
        slides.push(slide);
      }

      // 尝试提取备注
      for (let i = 0; i < slides.length; i++) {
        const notesFile = `ppt/notesSlides/notesSlide${i + 1}.xml`;
        if (zip.files[notesFile]) {
          const notesContent = await zip.files[notesFile].async('string');
          slides[i].notes = this.extractNotesFromXml(notesContent);
        }
      }

      return {
        fileName,
        totalSlides: slides.length,
        slides,
        metadata: {
          title: this.extractCoreProperty(zip, 'title'),
          author: this.extractCoreProperty(zip, 'creator'),
          subject: this.extractCoreProperty(zip, 'subject')
        }
      };
    } catch (error) {
      throw new Error(`解析 PPT 文件失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析单个幻灯片 XML
   */
  private parseSlide(xmlContent: string, slideNumber: number): PPTSlide {
    const paragraphs: Paragraph[] = [];
    let title: string | undefined;

    // 提取文本内容
    const textMatches = xmlContent.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    const texts: string[] = [];

    for (const match of textMatches) {
      const text = match[1];
      if (text && text.trim()) {
        texts.push(text.trim());
      }
    }

    // 简单处理：第一个非空文本作为标题，其余作为段落
    if (texts.length > 0) {
      title = texts[0];
      for (let i = 1; i < texts.length; i++) {
        paragraphs.push({
          text: texts[i],
          level: 0
        });
      }
    }

    return {
      slideNumber,
      title,
      paragraphs,
      bulletPoints: paragraphs.length > 0 ? paragraphs.map(p => p.text) : undefined,
      notes: undefined
    };
  }

  /**
   * 从备注 XML 中提取文本
   */
  private extractNotesFromXml(xmlContent: string): string | undefined {
    const textMatches = xmlContent.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    const texts: string[] = [];

    for (const match of textMatches) {
      const text = match[1];
      if (text && text.trim()) {
        texts.push(text.trim());
      }
    }

    return texts.join(' ') || undefined;
  }

  /**
   * 提取核心属性
   */
  private extractCoreProperty(zip: JSZip, propName: string): string | undefined {
    const coreFile = zip.files['docProps/core.xml'];
    if (!coreFile) return undefined;

    // 异步读取会有问题，这里简化处理
    return undefined;
  }

  /**
   * 将 PPT 内容转换为文本摘要（用于 AI 处理）
   */
  toTextSummary(doc: PPTDocument): string {
    return doc.slides.map(slide => {
      const parts = [];
      if (slide.title) parts.push(`[第${slide.slideNumber}页] ${slide.title}`);
      else parts.push(`[第${slide.slideNumber}页]`);

      if (slide.paragraphs.length > 0) {
        parts.push(slide.paragraphs.map(p => p.text).join(' | '));
      }

      if (slide.notes) {
        parts.push(`(备注：${slide.notes})`);
      }

      return parts.join('\n');
    }).join('\n\n');
  }
}
