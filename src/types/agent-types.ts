/**
 * 多智能体系统类型定义
 */

import { PPTSlide } from '../types';

// ==================== 导演阐述 ====================

/**
 * 总导演智能体输出 - 导演阐述
 * 包含对整个 PPT 的核心主题、基调、叙事主线的把握
 */
export interface DirectorBrief {
  /** 核心主题（一句话概括） */
  coreTheme: string;
  /** 叙事主线（如何展开） */
  narrativeArc: string;
  /** 基调（严肃/轻松/激励） */
  tone: string;
  /** 受众分析 */
  audienceAnalysis: string;
  /** 3-5 个关键信息 */
  keyMessages: string[];
  /** 演讲目标（听众听完后应该...） */
  speechGoal: string;
  /** 可能的难点/需要注意的地方 */
  potentialChallenges: string;
  /** 置信度 (0-1)，低于阈值需要用户确认 */
  confidence: number;
}

// ==================== 内容理解 ====================

/**
 * 页面要素类型
 */
export type SlideElementType = 'title' | 'bullet' | 'data' | 'chart' | 'image' | 'unknown';

/**
 * 逻辑关系类型
 */
export type RelationshipType = 'sequence' | 'contrast' | 'cause-effect' | 'elaboration';

/**
 * 内容理解智能体输出 - 单页深度分析
 */
export interface SlideAnalysis {
  /** 页码 */
  slideNumber: number;
  /** 页面标题 */
  slideTitle: string;

  /** 要素分析 */
  elements: {
    /** 要素类型 */
    type: SlideElementType;
    /** 原始内容 */
    content: string;
    /** 这个要素的含义 */
    meaning: string;
    /** 需要强调的点 */
    emphasis: string;
    /** 置信度 (0-1) */
    confidence?: number;
  }[];

  /** 逻辑关系 */
  relationships: {
    /** 关系类型 */
    type: RelationshipType;
    /** 关系描述 */
    description: string;
  };

  /** 一句话概括这一页的核心 */
  coreMessage: string;
  /** 这一页的目的（为什么放这里） */
  purpose: string;
  /** 与整体叙事的关系 */
  connectionToNarrative: string;

  /** 需要阐述的关键点 */
  speakingNotes: string[];

  /** 【新增】不确定点（需要用户确认） */
  uncertainties?: UncertaintyQuestion[];
}

/**
 * 单条疑问 - 内容理解智能体不确定的地方
 */
export interface UncertaintyQuestion {
  /** 页码 */
  slideNumber: number;
  /** 哪个要素 */
  element: string;
  /** 什么问题不确定 */
  question: string;
  /** 建议的理解 */
  suggestedInterpretation?: string;
}

// ==================== 演讲稿输出 ====================

/**
 * 演讲稿输出结构
 */
export interface Speech {
  /** 标题 */
  title: string;
  /** 预估时长（分钟） */
  estimatedDuration: number;
  /** 开场白 */
  opening: {
    /** 内容 */
    content: string;
    /** 时长（秒） */
    durationSeconds: number;
  };
  /** 逐页演讲词 */
  slides: {
    /** 页码 */
    slideNumber: number;
    /** 页面标题 */
    title: string;
    /** 演讲词（深入阐述） */
    content: string;
    /** 过渡语 */
    transitions: string;
    /** 时长（秒） */
    durationSeconds: number;
  }[];
  /** 结束语 */
  closing: {
    /** 内容 */
    content: string;
    /** 时长（秒） */
    durationSeconds: number;
  };
  /** Markdown 格式全文 */
  markdown: string;
}

// ==================== 人机交互 ====================

/**
 * 确认请求类型
 */
export type ConfirmationType = 'directorBrief' | 'slideAnalysis' | 'uncertainty';

/**
 * 人机交互确认请求
 */
export interface ConfirmationRequest {
  /** 确认类型 */
  type: ConfirmationType;
  /** 需要确认的数据 */
  data: DirectorBrief | SlideAnalysis | UncertaintyQuestion;
  /** 需要用户回答的问题列表 */
  questions: string[];
}

/**
 * Session 存储结构
 */
export interface GenerationSession {
  /** Session ID */
  sessionId: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
  /** 当前阶段 */
  currentStage: 'director' | 'analyst' | 'writer' | 'completed';
  /** PPT 原始内容 */
  pptContent?: string;
  /** PPT 解析后的 slides（用于内容分析） */
  pptSlides?: PPTSlide[];
  /** 导演阐述 */
  directorBrief?: DirectorBrief;
  /** 用户确认的导演阐述（可能有修改） */
  confirmedDirectorBrief?: DirectorBrief;
  /** 页面分析结果 */
  slideAnalyses?: SlideAnalysis[];
  /** 用户确认的分析结果（修正后） */
  confirmedSlideAnalyses?: SlideAnalysis[];
  /** 最终生成的演讲稿 */
  speech?: Speech;
  /** 用户参数 */
  params?: {
    style: string;
    durationMinutes: number;
    audience?: string;
    additionalContext?: string;
  };
}

// ==================== 智能体配置 ====================

/**
 * 智能体执行结果
 */
export interface AgentResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 输出数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 置信度 (0-1) */
  confidence?: number;
}

/**
 * 导演智能体输入参数
 */
export interface DirectorAgentInput {
  /** PPT 内容摘要 */
  pptSummary: string;
  /** 结构分析 */
  structure: {
    openingSlides: number[];
    bodySlides: number[];
    closingSlides: number[];
    sections: { title: string; startSlide: number; endSlide: number }[];
  };
  /** 演讲风格 */
  style: string;
  /** 演讲时长（分钟） */
  durationMinutes: number;
  /** 受众描述 */
  audience?: string;
  /** 额外背景 */
  additionalContext?: string;
}

/**
 * 内容分析智能体输入参数
 */
export interface ContentAnalystAgentInput {
  /** 单页内容 */
  slide: {
    slideNumber: number;
    title?: string;
    paragraphs: { text: string; level: number }[];
    bulletPoints?: string[];
    notes?: string;
  };
  /** 导演阐述 */
  directorBrief: DirectorBrief;
  /** 该页在整体中的位置 */
  positionInNarrative: {
    section: string;
    isBeginning: boolean;
    isEnd: boolean;
  };
}

/**
 * 演讲稿撰写智能体输入参数
 */
export interface SpeechWriterAgentInput {
  /** 导演阐述 */
  directorBrief: DirectorBrief;
  /** 所有页面的分析结果 */
  slideAnalyses: SlideAnalysis[];
  /** 演讲风格 */
  style: string;
  /** 演讲时长（分钟） */
  durationMinutes: number;
  /** 受众描述 */
  audience?: string;
}
