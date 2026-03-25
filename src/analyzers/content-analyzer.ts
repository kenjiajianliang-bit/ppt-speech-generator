import { PPTDocument, PPTSlide } from '../types';

/**
 * 幻灯片分析结果
 */
export interface SlideAnalysis {
  slideNumber: number;
  title?: string;
  slideType: SlideType;
  mainTopic?: string;
  keyPoints: string[];
  hasVisualElements: boolean;
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * 幻灯片类型
 */
export type SlideType =
  | 'title'        // 标题页
  | 'agenda'       // 目录/议程
  | 'content'      // 内容页
  | 'section'      // 章节过渡页
  | 'summary'      // 总结页
  | 'qa'           // 问答页
  | 'thankyou';    // 致谢页

/**
 * 整体结构分析结果
 */
export interface StructureAnalysis {
  openingSlides: number[];    // 开场部分页码
  bodySlides: number[];       // 主体部分页码
  closingSlides: number[];    // 结尾部分页码
  sections: SectionInfo[];    // 章节划分
  mainTopics: string[];       // 主要话题
}

export interface SectionInfo {
  title: string;
  startSlide: number;
  endSlide: number;
  topic?: string;
}

/**
 * 内容分析器 - 分析 PPT 结构和内容
 */
export class ContentAnalyzer {
  /**
   * 分析单个幻灯片
   */
  analyzeSlide(slide: PPTSlide): SlideAnalysis {
    const slideType = this.detectSlideType(slide);
    const keyPoints = this.extractKeyPoints(slide);
    const complexity = this.assessComplexity(slide);

    return {
      slideNumber: slide.slideNumber,
      title: slide.title,
      slideType,
      mainTopic: slide.title || keyPoints[0],
      keyPoints,
      hasVisualElements: false, // 简化处理
      complexity
    };
  }

  /**
   * 检测幻灯片类型
   */
  private detectSlideType(slide: PPTSlide): SlideType {
    const title = (slide.title || '').toLowerCase();
    const allText = [
      slide.title,
      ...slide.paragraphs.map(p => p.text)
    ].join(' ').toLowerCase();

    // 标题页判断
    if (slide.slideNumber === 1 && slide.paragraphs.length <= 3) {
      return 'title';
    }

    // 目录/议程页
    if (title.includes('目录') || title.includes('议程') || title.includes('agenda') ||
        allText.includes('大纲') || allText.includes('内容概要')) {
      return 'agenda';
    }

    // 章节过渡页
    if (slide.paragraphs.length === 0 || (slide.paragraphs.length === 1 && slide.paragraphs[0].text.length < 50)) {
      return 'section';
    }

    // 总结页
    if (title.includes('总结') || title.includes('回顾') || title.includes('summary') ||
        title.includes('结语') || title.includes('要点')) {
      return 'summary';
    }

    // 问答页
    if (title.includes('问答') || title.includes('q&a') || title.includes('question')) {
      return 'qa';
    }

    // 致谢页
    if (title.includes('谢谢') || title.includes('感谢') || title.includes('thank')) {
      return 'thankyou';
    }

    return 'content';
  }

  /**
   * 提取关键要点
   */
  private extractKeyPoints(slide: PPTSlide): string[] {
    const points: string[] = [];

    // 优先使用项目符号
    if (slide.bulletPoints && slide.bulletPoints.length > 0) {
      points.push(...slide.bulletPoints);
    }

    // 添加段落内容
    for (const para of slide.paragraphs) {
      if (para.level === 0 && para.text.length > 0) {
        points.push(para.text);
      }
    }

    return points;
  }

  /**
   * 评估幻灯片复杂度
   */
  private assessComplexity(slide: PPTSlide): 'simple' | 'medium' | 'complex' {
    const textLength = slide.paragraphs.reduce((sum, p) => sum + p.text.length, 0);
    const bulletCount = slide.bulletPoints?.length || 0;

    if (textLength < 100 && bulletCount <= 3) {
      return 'simple';
    } else if (textLength < 300 && bulletCount <= 7) {
      return 'medium';
    }
    return 'complex';
  }

  /**
   * 分析整体结构
   */
  analyzeStructure(doc: PPTDocument): StructureAnalysis {
    const slideAnalyses = doc.slides.map(slide => this.analyzeSlide(slide));

    const openingSlides: number[] = [];
    const bodySlides: number[] = [];
    const closingSlides: number[] = [];
    const sections: SectionInfo[] = [];

    let currentSection: SectionInfo | null = null;

    for (const slide of slideAnalyses) {
      const slideNum = slide.slideNumber;

      // 分类开场、主体、结尾
      if (slide.slideType === 'title' || slide.slideType === 'agenda') {
        openingSlides.push(slideNum);
      } else if (slide.slideType === 'summary' || slide.slideType === 'qa' || slide.slideType === 'thankyou') {
        closingSlides.push(slideNum);
      } else {
        bodySlides.push(slideNum);
      }

      // 检测新章节开始
      if (slide.slideType === 'section') {
        if (currentSection) {
          currentSection.endSlide = slideNum - 1;
          sections.push(currentSection);
        }
        currentSection = {
          title: slide.title || `第${slideNum}节`,
          startSlide: slideNum,
          endSlide: slideNum
        };
      }
    }

    // 完成最后一个章节
    if (currentSection) {
      currentSection.endSlide = doc.totalSlides;
      sections.push(currentSection);
    }

    // 如果没有检测到章节，创建一个默认的
    if (sections.length === 0 && bodySlides.length > 0) {
      sections.push({
        title: '主要内容',
        startSlide: bodySlides[0],
        endSlide: bodySlides[bodySlides.length - 1]
      });
    }

    // 提取主要话题
    const mainTopics = slideAnalyses
      .filter(s => s.slideType === 'content' && s.mainTopic)
      .map(s => s.mainTopic!)
      .slice(0, 10); // 限制数量

    return {
      openingSlides,
      bodySlides,
      closingSlides,
      sections,
      mainTopics
    };
  }

  /**
   * 生成分析摘要（用于 AI 理解）
   */
  generateAnalysisSummary(doc: PPTDocument, structure: StructureAnalysis): string {
    const slideAnalyses = doc.slides.map(slide => this.analyzeSlide(slide));

    let summary = `【PPT 结构分析】\n`;
    summary += `总页数：${doc.totalSlides} 页\n\n`;

    summary += `【结构划分】\n`;
    summary += `- 开场部分：第 ${structure.openingSlides.join(', ')} 页\n`;
    summary += `- 主体部分：第 ${structure.bodySlides.join(', ')} 页\n`;
    summary += `- 结尾部分：第 ${structure.closingSlides.join(', ')} 页\n\n`;

    if (structure.sections.length > 0) {
      summary += `【章节划分】\n`;
      for (const section of structure.sections) {
        summary += `- ${section.title} (第${section.startSlide}-${section.endSlide}页)\n`;
      }
      summary += '\n';
    }

    summary += `【各页内容详情】\n`;
    for (const slide of slideAnalyses) {
      summary += `\n第${slide.slideNumber}页 [${slide.slideType}]: ${slide.title || '无标题'}\n`;
      if (slide.keyPoints.length > 0) {
        summary += `  要点：${slide.keyPoints.join('; ')}\n`;
      }
    }

    return summary;
  }
}
