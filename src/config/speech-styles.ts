import { SpeechStyle } from '../types';

/**
 * 演讲风格配置
 */
export interface StyleConfig {
  name: string;
  description: string;
  tone: string; // 语调
  structure: string; // 结构特点
  languageStyle: string; // 语言风格
  interactionLevel: 'low' | 'medium' | 'high'; // 互动程度
  formalityLevel: 'casual' | 'semi-formal' | 'formal'; // 正式程度
  promptSuffix: string; // 生成时的风格提示词
}

/**
 * 演讲风格配置字典
 */
export const SPEECH_STYLES: Record<SpeechStyle, StyleConfig> = {
  training: {
    name: '培训讲座',
    description: '适合面向学员的培训、教学场景',
    tone: '轻松友好，富有感染力，像一位经验丰富的导师',
    structure: '循序渐进，多使用"我们"、"大家"等亲切称呼，适时设置互动环节',
    languageStyle: '通俗易懂，多用案例和比喻，语言生动有趣',
    interactionLevel: 'high',
    formalityLevel: 'casual',
    promptSuffix: '请使用轻松友好的语气，像一位亲切的讲师。多使用"我们"、"大家"等称呼，适当设置互动环节（如提问、思考时间）。多用案例、故事、比喻来帮助理解。语言要通俗易懂，避免过多专业术语。'
  },
  presentation: {
    name: '正式汇报',
    description: '适合商务汇报、项目展示、学术报告等正式场合',
    tone: '专业严谨，逻辑清晰，展现专业素养',
    structure: '结论先行，论据支撑，层次分明',
    languageStyle: '正式规范，用词精准，适当使用专业术语',
    interactionLevel: 'low',
    formalityLevel: 'formal',
    promptSuffix: '请使用专业严谨的语气，适合正式汇报场合。采用"结论先行"的结构，先说核心观点再展开论据。用词精准规范，可适当使用专业术语。逻辑要清晰，层次要分明。避免过于随意的表达。'
  },
  report: {
    name: '工作汇报',
    description: '适合向上级汇报、工作总结、进度报告',
    tone: '简洁务实，重点突出，结果导向',
    structure: '金字塔结构，先说结论和成果，再展开细节',
    languageStyle: '简明扼要，用数据说话，避免冗长描述',
    interactionLevel: 'low',
    formalityLevel: 'semi-formal',
    promptSuffix: '请使用简洁务实的语气，适合向上级汇报。采用金字塔结构，先说结论和关键成果。多用数据支撑观点（如"提升了 X%"、"完成了 Y 项"）。语言简明扼要，重点突出，避免冗长描述。'
  },
  casual: {
    name: '大众演讲',
    description: '适合 TED 式演讲、公开分享、励志演讲',
    tone: '富有感染力，情感共鸣，引人入胜',
    structure: '故事驱动，设置悬念和情感高潮',
    languageStyle: '生动形象，多用修辞手法，富有节奏感',
    interactionLevel: 'medium',
    formalityLevel: 'semi-formal',
    promptSuffix: '请使用富有感染力的语气，适合大众演讲。多用故事、个人经历来引入主题。设置悬念和情感共鸣点。运用排比、对比等修辞手法增强表现力。语言要有节奏感，适合口头表达。'
  }
};

/**
 * 根据时长计算建议字数
 * 正常语速约 180-220 字/分钟
 */
export function calculateTargetWordCount(durationMinutes: number, style: SpeechStyle): number {
  const baseRate = 200; // 字/分钟

  // 不同风格的语速调整
  const rateModifiers: Record<SpeechStyle, number> = {
    training: 0.9,      // 培训稍慢，便于理解
    presentation: 1.0,  // 正常语速
    report: 1.1,        // 汇报稍快，信息密集
    casual: 0.85        // 演讲更慢，留白更多
  };

  return Math.round(durationMinutes * baseRate * rateModifiers[style]);
}

/**
 * 获取风格配置的辅助函数
 */
export function getStyleConfig(style: SpeechStyle): StyleConfig {
  return SPEECH_STYLES[style];
}

/**
 * 获取所有可用风格列表
 */
export function getAvailableStyles(): Array<{ key: SpeechStyle; config: StyleConfig }> {
  return (Object.keys(SPEECH_STYLES) as SpeechStyle[]).map(key => ({
    key,
    config: SPEECH_STYLES[key]
  }));
}
