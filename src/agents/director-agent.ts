import { DirectorBrief, DirectorAgentInput, AgentResult } from '../types/agent-types';

/**
 * 总导演智能体
 *
 * 职责：
 * - 解析文档整体结构和核心思想
 * - 确定培训基调和叙事主线
 * - 分析目标受众和演讲目的
 * - 为后续智能体提供指导框架
 */
export class DirectorAgent {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://coding.dashscope.aliyuncs.com/v1';
    this.model = model || 'qwen3.5-plus';
  }

  /**
   * 分析 PPT，生成导演阐述
   */
  async analyze(input: DirectorAgentInput): Promise<AgentResult<DirectorBrief>> {
    try {
      const prompt = this.buildPrompt(input);

      console.log('[DirectorAgent] 正在分析 PPT 整体结构和核心思想...');

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const brief = this.parseResponse(content);

      console.log('[DirectorAgent] 导演阐述生成完成');
      console.log('  - 核心主题:', brief.coreTheme);
      console.log('  - 基调:', brief.tone);
      console.log('  - 置信度:', brief.confidence);

      return {
        success: true,
        data: brief,
        confidence: brief.confidence
      };
    } catch (error) {
      console.error('[DirectorAgent] 分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        confidence: 0
      };
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(input: DirectorAgentInput): string {
    const { pptSummary, structure, style, durationMinutes, audience, additionalContext } = input;

    return `【PPT 内容摘要】
${pptSummary}

【PPT 结构信息】
- 总页数：${structure.openingSlides.length + structure.bodySlides.length + structure.closingSlides.length} 页
- 开场部分：第 ${structure.openingSlides.join(', ')} 页
- 主体部分：第 ${structure.bodySlides.join(', ')} 页
- 结尾部分：第 ${structure.closingSlides.join(', ')} 页

${structure.sections.length > 0 ? `【章节划分】
${structure.sections.map(s => `- ${s.title} (第${s.startSlide}-${s.endSlide}页)`).join('\n')}
` : ''}

【演讲要求】
- 演讲风格：${style}
- 演讲时长：${durationMinutes} 分钟
${audience ? `- 目标受众：${audience}` : ''}
${additionalContext ? `- 额外背景：${additionalContext}` : ''}

---

请作为总导演，深入分析这份 PPT，为演讲稿撰写提供指导框架。

你需要回答以下问题：

1. **核心主题**：这份 PPT 真正想传达的核心思想是什么？（用一句话概括，不要停留在表面）

2. **叙事主线**：演讲者应该如何展开这个主题？是"问题→分析→解决方案"的结构，还是"现象→原因→对策"，或是其他叙事方式？

3. **培训基调**：根据 PPT 内容和受众，应该采用什么样的语调？（严肃专业？轻松亲切？激励人心？）为什么？

4. **受众分析**：听众是谁？他们现有的知识水平如何？他们最想从这次演讲中获得什么？可能有什么疑问或抵触情绪？

5. **关键信息**：列出 3-5 个听众听完后必须记住的关键点。这些关键点应该服务于核心主题。

6. **演讲目标**：听完后，听众应该能够做什么？或者对什么有新的认识？

7. **潜在挑战**：演讲者可能遇到什么难点？哪些地方容易引起听众困惑？哪些内容需要特别注意表达方式？

请按以下 JSON 格式输出（确保是合法的 JSON）：
{
  "coreTheme": "核心主题",
  "narrativeArc": "叙事主线",
  "tone": "基调",
  "audienceAnalysis": "受众分析",
  "keyMessages": ["关键信息 1", "关键信息 2", ...],
  "speechGoal": "演讲目标",
  "potentialChallenges": "潜在挑战",
  "confidence": 0.85
}

注意：
- confidence 表示你对分析的置信度（0-1），如果 PPT 内容清晰、逻辑连贯，给高分；如果内容模糊、信息不足，给低分并说明原因
- 分析要具体，避免泛泛而谈
- 要深入理解 PPT 的"言外之意"，不要只停留在表面文字`;
  }

  /**
   * 系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一位经验丰富的演讲策划总监，擅长：
- 快速把握演示文稿的核心思想和深层目的
- 分析演讲者、听众、场合三者之间的关系
- 为不同类型的演讲（培训、汇报、产品发布等）确定合适的基调
- 识别内容中的关键信息和潜在难点

你的工作是为演讲稿撰写团队提供清晰的指导框架，让他们知道：
1. 这场演讲的核心是什么
2. 听众是谁，他们想知道什么
3. 应该用什么样的方式讲述
4. 哪些内容是必须传达的关键信息

你要像电影导演一样，在开拍前就想清楚整部戏的基调、主题和叙事方式。`;
  }

  /**
   * 解析响应
   */
  private parseResponse(content: string): DirectorBrief {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          coreTheme: parsed.coreTheme || '',
          narrativeArc: parsed.narrativeArc || '',
          tone: parsed.tone || '',
          audienceAnalysis: parsed.audienceAnalysis || '',
          keyMessages: Array.isArray(parsed.keyMessages) ? parsed.keyMessages : [],
          speechGoal: parsed.speechGoal || '',
          potentialChallenges: parsed.potentialChallenges || '',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7
        };
      } catch (e) {
        console.warn('[DirectorAgent] JSON 解析失败，使用降级解析');
      }
    }

    // 降级解析：尝试从文本中提取关键信息
    return this.fallbackParse(content);
  }

  /**
   * 降级解析（当 JSON 解析失败时）
   */
  private fallbackParse(content: string): DirectorBrief {
    const extractSection = (keyword: string): string => {
      const patterns = [
        new RegExp(`${keyword}["']?\\s*[:：]\\s*["']?([^"'}\\n]+)`, 'i'),
        new RegExp(`["'**]?${keyword}["'**]?\\s*[:：]\\s*([^\n]+)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          return match[1].trim().replace(/^["']|["']$/g, '');
        }
      }
      return '';
    };

    const extractArray = (keyword: string): string[] => {
      const pattern = new RegExp(`${keyword}["']?\\s*[:：]\\s*\\[([^\\]]+)\\]`, 'i');
      const match = content.match(pattern);
      if (match) {
        return match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }

      // 尝试提取列表形式
      const listPattern = new RegExp(`${keyword}["']?\\s*[:：]\\s*\n([\\s\\S]*?)(?=\n\\s*\n|\\d+\\.|$)`, 'i');
      const listMatch = content.match(listPattern);
      if (listMatch) {
        const lines = listMatch[1].split('\n')
          .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
          .map(line => line.replace(/^[\-\*]?\s*\d*\.?\s*/, '').trim());
        if (lines.length > 0) {
          return lines;
        }
      }

      return [];
    };

    const extractNumber = (keyword: string, defaultValue: number): number => {
      const pattern = new RegExp(`${keyword}["']?\\s*[:：]\\s*([0-9.]+)`, 'i');
      const match = content.match(pattern);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? defaultValue : num;
      }
      return defaultValue;
    };

    return {
      coreTheme: extractSection('核心主题') || extractSection('coreTheme'),
      narrativeArc: extractSection('叙事主线') || extractSection('narrativeArc'),
      tone: extractSection('基调') || extractSection('tone'),
      audienceAnalysis: extractSection('受众分析') || extractSection('audienceAnalysis'),
      keyMessages: extractArray('关键信息') || extractArray('keyMessages'),
      speechGoal: extractSection('演讲目标') || extractSection('speechGoal'),
      potentialChallenges: extractSection('潜在挑战') || extractSection('potentialChallenges'),
      confidence: extractNumber('confidence', 0.7)
    };
  }
}
