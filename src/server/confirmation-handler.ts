import {
  DirectorBrief,
  SlideAnalysis,
  UncertaintyQuestion,
  GenerationSession,
  ConfirmationType
} from '../types/agent-types';

/**
 * 人机交互处理器
 *
 * 职责：
 * - 处理用户确认/修正请求
 * - 暂存中间结果（DirectorBrief、SlideAnalysis）
 * - 将用户反馈传递给相应智能体进行修正
 */
export class ConfirmationHandler {
  // Session 存储（内存）
  private sessions: Map<string, GenerationSession> = new Map();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 分钟

  constructor() {
    // 定期清理过期 session
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  // ==================== Session 管理 ====================

  /**
   * 创建新 Session
   */
  createSession(
    sessionId: string,
    params: {
      style: string;
      durationMinutes: number;
      audience?: string;
      additionalContext?: string;
    }
  ): GenerationSession {
    const session: GenerationSession = {
      sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      currentStage: 'director',
      params
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取 Session
   */
  getSession(sessionId: string): GenerationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - session.lastActiveAt > this.SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 更新 Session 活跃时间
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = Date.now();
    }
  }

  /**
   * 清理过期 Session
   */
  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
        console.log(`[ConfirmationHandler] Session ${id} 已过期，已清理`);
      }
    }
  }

  // ==================== 导演阐述确认 ====================

  /**
   * 保存导演阐述
   */
  saveDirectorBrief(sessionId: string, brief: DirectorBrief): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error('[ConfirmationHandler] Session 不存在:', sessionId);
      return false;
    }

    session.directorBrief = brief;
    session.currentStage = 'director';
    this.touchSession(sessionId);

    console.log('[ConfirmationHandler] 导演阐述已保存');
    return true;
  }

  /**
   * 处理导演阐述确认
   */
  confirmDirectorBrief(
    sessionId: string,
    confirmed: boolean,
    modifications?: Partial<DirectorBrief>
  ): { success: boolean; error?: string } {
    const session = this.getSession(sessionId);
    if (!session || !session.directorBrief) {
      return { success: false, error: 'Session 不存在或导演阐述未生成' };
    }

    if (confirmed) {
      // 用户确认，保存确认版本
      session.confirmedDirectorBrief = modifications
        ? { ...session.directorBrief, ...modifications }
        : session.directorBrief;
      session.currentStage = 'analyst';
      this.touchSession(sessionId);
      console.log('[ConfirmationHandler] 导演阐述已确认');
      return { success: true };
    } else {
      // 用户不确认，需要重新生成或手动修改
      if (modifications) {
        session.confirmedDirectorBrief = { ...session.directorBrief, ...modifications };
        session.currentStage = 'analyst';
        this.touchSession(sessionId);
        console.log('[ConfirmationHandler] 导演阐述已根据用户修改确认');
        return { success: true };
      }
      console.log('[ConfirmationHandler] 用户未确认导演阐述');
      return { success: false, error: '用户未确认，需要重新生成或提供修改意见' };
    }
  }

  // ==================== 内容分析确认 ====================

  /**
   * 保存内容分析结果
   */
  saveSlideAnalyses(sessionId: string, analyses: SlideAnalysis[]): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error('[ConfirmationHandler] Session 不存在:', sessionId);
      return false;
    }

    session.slideAnalyses = analyses;
    session.currentStage = 'analyst';
    this.touchSession(sessionId);

    console.log(`[ConfirmationHandler] 内容分析结果已保存，共 ${analyses.length} 页`);
    return true;
  }

  /**
   * 获取所有不确定点
   */
  getUncertainties(sessionId: string): UncertaintyQuestion[] {
    const session = this.getSession(sessionId);
    if (!session || !session.slideAnalyses) {
      return [];
    }

    const uncertainties: UncertaintyQuestion[] = [];
    for (const analysis of session.slideAnalyses) {
      if (analysis.uncertainties && analysis.uncertainties.length > 0) {
        uncertainties.push(...analysis.uncertainties);
      }
    }

    console.log(`[ConfirmationHandler] 检测到 ${uncertainties.length} 个不确定点`);
    return uncertainties;
  }

  /**
   * 处理内容分析确认（用户回答疑问后）
   */
  confirmAnalysis(
    sessionId: string,
    answers: { question: string; answer: string }[],
    needsRevision?: boolean
  ): { success: boolean; error?: string } {
    const session = this.getSession(sessionId);
    if (!session || !session.slideAnalyses) {
      return { success: false, error: 'Session 不存在或内容分析未完成' };
    }

    console.log('[ConfirmationHandler] 用户已回答疑问:', answers);

    if (needsRevision) {
      // 需要重新分析某些页面（简化处理，实际应该重新调用智能体）
      console.log('[ConfirmationHandler] 需要根据用户答案重新分析某些页面');
      return { success: false, error: '需要重新分析，此功能尚未实现' };
    }

    // 用户确认，继续下一步
    session.confirmedSlideAnalyses = session.slideAnalyses;
    session.currentStage = 'writer';
    this.touchSession(sessionId);

    console.log('[ConfirmationHandler] 内容分析已确认');
    return { success: true };
  }

  // ==================== 演讲稿确认 ====================

  /**
   * 保存演讲稿
   */
  saveSpeech(sessionId: string, speech: any): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error('[ConfirmationHandler] Session 不存在:', sessionId);
      return false;
    }

    session.speech = speech;
    session.currentStage = 'completed';
    this.touchSession(sessionId);

    console.log('[ConfirmationHandler] 演讲稿已保存');
    return true;
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取当前阶段
   */
  getCurrentStage(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    return session ? session.currentStage : null;
  }

  /**
   * 检查 Session 是否可以进行下一步
   */
  canProceed(sessionId: string, targetStage: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const stageOrder = ['director', 'analyst', 'writer', 'completed'];
    const currentIndex = stageOrder.indexOf(session.currentStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    // 当前阶段必须在前，目标阶段必须在后
    return currentIndex >= 0 && targetIndex > currentIndex;
  }

  /**
   * 获取 Session 的完整状态（用于前端展示）
   */
  getSessionStatus(sessionId: string): any {
    const session = this.getSession(sessionId);
    if (!session) {
      return { exists: false };
    }

    const status: any = {
      exists: true,
      sessionId: session.sessionId,
      currentStage: session.currentStage,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      hasPptContent: !!session.pptContent,
      hasDirectorBrief: !!session.directorBrief,
      hasConfirmedDirectorBrief: !!session.confirmedDirectorBrief,
      hasSlideAnalyses: !!session.slideAnalyses,
      hasConfirmedSlideAnalyses: !!session.confirmedSlideAnalyses,
      hasSpeech: !!session.speech,
      uncertaintyCount: session.slideAnalyses?.reduce(
        (sum, a) => sum + (a.uncertainties?.length || 0),
        0
      ) || 0
    };

    // 根据阶段添加相关数据
    if (session.confirmedDirectorBrief || session.directorBrief) {
      status.directorBrief = session.confirmedDirectorBrief || session.directorBrief;
    }

    if (session.confirmedSlideAnalyses || session.slideAnalyses) {
      status.slideAnalyses = session.confirmedSlideAnalyses || session.slideAnalyses;
      status.uncertainties = this.getUncertainties(sessionId);
    }

    if (session.speech) {
      status.speech = session.speech;
    }

    return status;
  }
}

// 导出单例
export const confirmationHandler = new ConfirmationHandler();
