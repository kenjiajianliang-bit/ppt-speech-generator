import { PPTDocument, PPTSlide } from '../types';
import { StructureAnalysis } from '../analyzers/content-analyzer';
import {
  DirectorBrief,
  SlideAnalysis,
  Speech,
  GenerationSession,
  DirectorAgentInput,
  ContentAnalystAgentInput,
  SpeechWriterAgentInput,
  UncertaintyQuestion,
  AgentResult
} from '../types/agent-types';
import { DirectorAgent } from './director-agent';
import { ContentAnalystAgent } from './content-analyst-agent';
import { SpeechWriterAgent } from './speech-writer-agent';

/**
 * 生成流程阶段
 */
export type GenerationStage = 'director' | 'analyst' | 'writer' | 'completed';

/**
 * 协同引擎 - 多智能体系统调度器
 *
 * 职责：
 * - 协调三个智能体的执行顺序
 * - 管理人机交互确认节点
 * - 传递上下文信息
 * - 处理异常情况
 */
export class Orchestrator {
  private directorAgent: DirectorAgent;
  private contentAnalystAgent: ContentAnalystAgent;
  private speechWriterAgent: SpeechWriterAgent;

  // Session 存储（内存）
  private sessions: Map<string, GenerationSession> = new Map();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 分钟

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.directorAgent = new DirectorAgent(apiKey, baseURL, model);
    this.contentAnalystAgent = new ContentAnalystAgent(apiKey, baseURL, model);
    this.speechWriterAgent = new SpeechWriterAgent(apiKey, baseURL, model);

    // 定期清理过期 session
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  // ==================== Stage 1: 导演分析 ====================

  /**
   * 阶段 1：生成导演阐述
   */
  async generateDirectorBrief(
    sessionId: string,
    pptContent: string,
    structure: StructureAnalysis,
    params: {
      style: string;
      durationMinutes: number;
      audience?: string;
      additionalContext?: string;
    },
    slides?: PPTSlide[]  // 新增：传入解析后的 slides
  ): Promise<AgentResult<DirectorBrief>> {
    try {
      console.log(`[Orchestrator] generateDirectorBrief 被调用，sessionId=${sessionId}`);
      console.log(`[Orchestrator] 收到 slides: ${slides ? slides.length : 0} 页`);

      // 创建或更新 session
      const session: GenerationSession = {
        sessionId,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        currentStage: 'director',
        pptContent,
        params
      };

      // 如果传入了 slides，保存到 session
      if (slides && slides.length > 0) {
        session.pptSlides = slides;
        console.log(`[Orchestrator] 已保存 ${slides.length} 页 slides 到 session ${sessionId}`);
      } else {
        console.warn(`[Orchestrator] 没有传入 slides 或 slides 为空`);
      }

      this.sessions.set(sessionId, session);
      console.log(`[Orchestrator] Session 已存储，pptSlides=${session.pptSlides ? session.pptSlides.length : 0} 页`);

      // 构建 PPT 摘要
      const pptSummary = this.buildPPTSummary(pptContent, structure);

      // 调用导演智能体
      const input: DirectorAgentInput = {
        pptSummary,
        structure: {
          openingSlides: structure.openingSlides,
          bodySlides: structure.bodySlides,
          closingSlides: structure.closingSlides,
          sections: structure.sections.map(s => ({
            title: s.title || `第${s.startSlide}节`,
            startSlide: s.startSlide,
            endSlide: s.endSlide
          }))
        },
        style: params.style,
        durationMinutes: params.durationMinutes,
        audience: params.audience,
        additionalContext: params.additionalContext
      };

      const result = await this.directorAgent.analyze(input);

      if (result.success && result.data) {
        session.directorBrief = result.data;
        session.lastActiveAt = Date.now();
      }

      return result;
    } catch (error) {
      console.error('[Orchestrator] 导演分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '导演分析失败'
      };
    }
  }

  /**
   * 确认导演阐述（用户确认后）
   */
  confirmDirectorBrief(
    sessionId: string,
    confirmed: boolean,
    modifications?: Partial<DirectorBrief>
  ): AgentResult<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.directorBrief) {
      return {
        success: false,
        error: 'Session 不存在或导演阐述未生成'
      };
    }

    if (confirmed) {
      // 用户确认，保存确认版本
      session.confirmedDirectorBrief = modifications
        ? { ...session.directorBrief, ...modifications }
        : session.directorBrief;
      session.currentStage = 'analyst';
      session.lastActiveAt = Date.now();

      return { success: true, data: true };
    } else {
      // 用户不确认，需要重新生成或手动修改
      if (modifications) {
        session.confirmedDirectorBrief = { ...session.directorBrief, ...modifications };
        session.currentStage = 'analyst';
        session.lastActiveAt = Date.now();
        return { success: true, data: true };
      }
      return { success: false, error: '用户未确认，需要重新生成或提供修改意见' };
    }
  }

  // ==================== Stage 2: 内容分析 ====================

  /**
   * 阶段 2：分析所有内容页面
   */
  async analyzeContent(
    sessionId: string,
    structure?: StructureAnalysis,  // 新增：传入 structure
    onProgress?: (completed: number, total: number, currentSlide: number) => void  // 进度回调
  ): Promise<AgentResult<SlideAnalysis[]>> {
    const session = this.sessions.get(sessionId);
    console.log(`[Orchestrator] analyzeContent 被调用，sessionId=${sessionId}`);
    console.log(`[Orchestrator] Session 存在：${!!session}`);
    console.log(`[Orchestrator] structure 参数:`, structure ? `有 ${structure.bodySlides?.length || 0} 页 bodySlides` : 'undefined');
    if (session) {
      console.log(`[Orchestrator] Session.pptSlides: ${session.pptSlides ? session.pptSlides.length : 0} 页`);
      console.log(`[Orchestrator] Session.confirmedDirectorBrief 存在：${!!session.confirmedDirectorBrief}`);
    }

    if (!session || !session.pptContent || !session.confirmedDirectorBrief) {
      return {
        success: false,
        error: 'Session 不存在或缺少必要数据'
      };
    }

    try {
      console.log('[Orchestrator] 开始分析内容页面...');

      // 从 session 中获取 slides
      const pptSlides = session.pptSlides;

      if (!pptSlides || pptSlides.length === 0) {
        return {
          success: false,
          error: 'Session 中没有 PPT 页面数据'
        };
      }

      console.log(`[Orchestrator] 从 session 获取到 ${pptSlides.length} 页 slides`);

      // 如果没有传入 structure，使用 session 中存储的
      const struct = structure || (session as any).structure;

      // 获取主体部分的页面
      const bodySlides = this.getBodySlides(sessionId, struct || { bodySlides: pptSlides.map(s => s.slideNumber) } as StructureAnalysis);

      console.log(`[Orchestrator] 主体部分共 ${bodySlides.length} 页`);

      // 构建每个 slide 的输入
      const analystInputs: ContentAnalystAgentInput[] = bodySlides.map((slide, index) => ({
        slide: {
          slideNumber: slide.slideNumber,
          title: slide.title,
          paragraphs: slide.paragraphs,
          bulletPoints: slide.bulletPoints,
          notes: slide.notes
        },
        directorBrief: session.confirmedDirectorBrief!,
        positionInNarrative: {
          section: this.getSectionForSlide(slide.slideNumber, session),
          isBeginning: index === 0,
          isEnd: index === bodySlides.length - 1
        }
      }));

      // 批量分析（并行处理，带进度回调）
      const results = await this.contentAnalystAgent.analyzeBatch(analystInputs, 3, onProgress);

      // 收集成功的分析结果
      const analyses: SlideAnalysis[] = [];
      let totalConfidence = 0;
      let successCount = 0;

      for (const result of results) {
        if (result.success && result.data) {
          analyses.push(result.data);
          totalConfidence += result.confidence || 0;
          successCount++;
        }
      }

      session.slideAnalyses = analyses;
      session.lastActiveAt = Date.now();

      const avgConfidence = successCount > 0 ? totalConfidence / successCount : 0;

      console.log(`[Orchestrator] 内容分析完成，成功 ${successCount}/${results.length} 页，平均置信度 ${avgConfidence.toFixed(2)}`);

      return {
        success: true,
        data: analyses,
        confidence: avgConfidence
      };
    } catch (error) {
      console.error('[Orchestrator] 内容分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '内容分析失败'
      };
    }
  }

  /**
   * 获取所有不确定点
   */
  getUncertainties(sessionId: string): UncertaintyQuestion[] {
    const session = this.sessions.get(sessionId);
    if (!session || !session.slideAnalyses) {
      return [];
    }

    const uncertainties: UncertaintyQuestion[] = [];
    for (const analysis of session.slideAnalyses) {
      if (analysis.uncertainties) {
        uncertainties.push(...analysis.uncertainties);
      }
    }
    return uncertainties;
  }

  /**
   * 确认内容分析（用户回答疑问后）
   */
  confirmAnalysis(
    sessionId: string,
    answers: { question: string; answer: string }[]
  ): AgentResult<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.slideAnalyses) {
      return {
        success: false,
        error: 'Session 不存在或内容分析未完成'
      };
    }

    // 根据用户答案修正分析结果（简化处理，实际应该重新调用智能体）
    console.log('[Orchestrator] 用户已回答疑问:', answers);

    // 标记为已确认
    session.confirmedSlideAnalyses = session.slideAnalyses;
    session.currentStage = 'writer';
    session.lastActiveAt = Date.now();

    return { success: true, data: true };
  }

  // ==================== Stage 3: 演讲稿生成 ====================

  /**
   * 阶段 3：生成演讲稿
   */
  async generateSpeech(sessionId: string): Promise<AgentResult<Speech>> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.confirmedDirectorBrief || !session.confirmedSlideAnalyses) {
      return {
        success: false,
        error: 'Session 不存在或缺少必要数据'
      };
    }

    try {
      console.log('[Orchestrator] 开始生成演讲稿...');

      const input: SpeechWriterAgentInput = {
        directorBrief: session.confirmedDirectorBrief,
        slideAnalyses: session.confirmedSlideAnalyses,
        style: session.params?.style || 'training',
        durationMinutes: session.params?.durationMinutes || 30,
        audience: session.params?.audience
      };

      const result = await this.speechWriterAgent.generate(input);

      if (result.success && result.data) {
        session.speech = result.data;
        session.currentStage = 'completed';
        session.lastActiveAt = Date.now();
      }

      return result;
    } catch (error) {
      console.error('[Orchestrator] 演讲稿生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '演讲稿生成失败'
      };
    }
  }

  // ==================== Session 管理 ====================

  /**
   * 获取 Session 状态
   */
  getSessionStatus(sessionId: string): GenerationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // 检查是否过期
    if (Date.now() - session.lastActiveAt > this.SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 清理过期 Session
   */
  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
        console.log(`[Orchestrator] Session ${id} 已过期，已清理`);
      }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 构建 PPT 摘要
   */
  private buildPPTSummary(pptContent: string, structure: StructureAnalysis): string {
    // 简化处理，实际应该解析 pptContent 获取详细内容
    return `PPT 共 ${structure.openingSlides.length + structure.bodySlides.length + structure.closingSlides.length} 页
开场部分：第 ${structure.openingSlides.join(', ')} 页
主体部分：第 ${structure.bodySlides.join(', ')} 页
结尾部分：第 ${structure.closingSlides.join(', ')} 页

${pptContent.substring(0, 2000)}...`;
  }

  /**
   * 从内容中解析 slides（简化版本）
   */
  private parseSlidesFromContent(content: string): any[] {
    // 这是一个简化实现，实际应该根据 PPT 解析结果来处理
    return [];
  }

  /**
   * 获取主体页面列表
   */
  private getBodySlides(
    sessionId: string,
    structure: StructureAnalysis
  ): PPTSlide[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    // 从 session 中获取 pptSlides
    const pptSlides = (session as any).pptSlides as PPTSlide[] | undefined;
    if (!pptSlides || pptSlides.length === 0) {
      console.warn(`[Orchestrator] Session ${sessionId} 中没有 pptSlides 数据`);
      return [];
    }

    console.log(`[Orchestrator] 从 session 获取到 ${pptSlides.length} 页 slides`);

    // 根据 structure.bodySlides 过滤出主体部分的页面
    const bodySlideNumbers = structure.bodySlides;
    return pptSlides.filter(slide => bodySlideNumbers.includes(slide.slideNumber));
  }

  /**
   * 获取页面所属章节
   */
  private getSectionForSlide(slideNumber: number, session: GenerationSession): string {
    // 简化实现
    return '主体部分';
  }
}
