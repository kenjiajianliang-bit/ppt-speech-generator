// PPT 解析结果类型定义

export interface PPTSlide {
  slideNumber: number;
  title?: string;
  paragraphs: Paragraph[];
  bulletPoints?: string[];
  notes?: string; // 演讲者备注
}

export interface Paragraph {
  text: string;
  level: number; // 缩进级别
}

export interface PPTDocument {
  fileName: string;
  totalSlides: number;
  slides: PPTSlide[];
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

// 演讲风格类型
export type SpeechStyle = 'training' | 'presentation' | 'report' | 'casual';

// 演讲稿生成参数
export interface SpeechGenerationParams {
  style: SpeechStyle;
  durationMinutes: number; // 演讲时长（分钟）
  audience?: string; // 受众描述
  additionalContext?: string; // 额外背景信息
}

// 演讲稿输出
export interface Speech {
  title: string;
  opening: string; // 开场白
  sections: SpeechSection[];
  closing: string; // 结束语
  estimatedDuration: number; // 预估时长（分钟）
  markdown: string; // Markdown 格式全文
}

export interface SpeechSection {
  slideRange: string; // 对应的 PPT 页码范围
  title: string;
  content: string;
  talkingPoints: string[]; // 要点
}

// 导出多智能体类型
export * from './agent-types';
