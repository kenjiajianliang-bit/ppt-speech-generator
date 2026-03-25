import { SlideAnalysis, ContentAnalystAgentInput, AgentResult, UncertaintyQuestion } from '../types/agent-types';

/**
 * 内容理解智能体
 *
 * 职责：
 * - 逐页分析 PPT，理解每个要素的含义
 * - 分析要素之间的逻辑关系（因果/对比/递进）
 * - 提炼每页的核心思想和目的
 * - 结合导演阐述，理解"为什么放这一页"
 * - 评估自身置信度，对低置信度内容标记疑问
 */
export class ContentAnalystAgent {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://coding.dashscope.aliyuncs.com/v1';
    this.model = model || 'qwen3.5-plus';
  }

  /**
   * 分析单页 PPT（带超时）
   */
  async analyze(input: ContentAnalystAgentInput, timeoutMs: number = 180000): Promise<AgentResult<SlideAnalysis>> {
    const startTime = Date.now();
    try {
      const prompt = this.buildPrompt(input);

      console.log(`[ContentAnalyst] 正在分析第 ${input.slide.slideNumber} 页...`);

      // 带超时的 fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      console.log(`[ContentAnalyst] 第 ${input.slide.slideNumber} 页 API 响应耗时：${elapsed}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log(`[ContentAnalyst] 第 ${input.slide.slideNumber} 页 AI 原始响应 (前 200 字符): ${content.substring(0, 200)}...`);

      const analysis = this.parseResponse(content, input.slide.slideNumber);

      const confidence = this.calculateConfidence(analysis);
      analysis.uncertainties = this.extractUncertainties(analysis, confidence);

      console.log(`[ContentAnalyst] 第 ${input.slide.slideNumber} 页分析完成`);
      console.log(`  - 核心信息：${analysis.coreMessage.substring(0, 50)}...`);
      console.log(`  - 置信度：${confidence}`);
      console.log(`  - 不确定点：${analysis.uncertainties?.length || 0}`);

      return {
        success: true,
        data: analysis,
        confidence
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[ContentAnalyst] 第 ${input.slide.slideNumber} 页分析失败 (耗时 ${elapsed}ms):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        confidence: 0
      };
    }
  }

  /**
   * 批量分析多页（并行处理，带进度回调）
   */
  async analyzeBatch(
    slides: ContentAnalystAgentInput[],
    concurrency: number = 3,
    onProgress?: (completed: number, total: number, currentSlide: number) => void
  ): Promise<AgentResult<SlideAnalysis>[]> {
    const results: AgentResult<SlideAnalysis>[] = [];
    const total = slides.length;

    console.log(`[ContentAnalyst] 开始批量分析，共 ${total} 页，并发度=${concurrency}`);

    // 分批处理，控制并发
    for (let i = 0; i < slides.length; i += concurrency) {
      const batch = slides.slice(i, i + concurrency);
      console.log(`[ContentAnalyst] 处理第 ${i + 1}-${Math.min(i + concurrency, total)} 页...`);

      const batchResults = await Promise.all(batch.map((input, idx) => {
        return this.analyze(input).then(result => {
          // 每完成一页，调用进度回调
          const completed = i + idx + 1;
          if (onProgress) {
            onProgress(completed, total, input.slide.slideNumber);
          }
          return result;
        });
      }));

      results.push(...batchResults);
      console.log(`[ContentAnalyst] 批次完成：${Math.min(i + concurrency, slides.length)}/${slides.length} 页`);
    }

    return results;
  }

  /**
   * 构建提示词
   */
  private buildPrompt(input: ContentAnalystAgentInput): string {
    const { slide, directorBrief, positionInNarrative } = input;

    const slideContent = this.formatSlideContent(slide);

    return `【当前页面内容】
${slideContent}

【导演阐述 - 整体背景】
- 核心主题：${directorBrief.coreTheme}
- 叙事主线：${directorBrief.narrativeArc}
- 基调：${directorBrief.tone}
- 关键信息：${directorBrief.keyMessages.join('; ')}
- 演讲目标：${directorBrief.speechGoal}

【当前页在整体中的位置】
- 所属章节：${positionInNarrative.section}
- 是否开头：${positionInNarrative.isBeginning ? '是' : '否'}
- 是否结尾：${positionInNarrative.isEnd ? '是' : '否'}

---

请作为内容理解专家，深入分析这一页 PPT。

**关键要求：不要简单复述 PPT 上的文字！**

你需要回答以下问题：

1. **要素分析**：这一页有哪些关键要素？（标题、要点、数据、图表等）每个要素的**深层含义**是什么？

2. **逻辑关系**：这些要素之间是什么关系？（并列/递进/因果/对比）它们如何共同支撑这一页的核心思想？

3. **核心思想**：这一页真正想传达的是什么？（用一句话概括）

4. **页面目的**：为什么演讲者要把这一页放在这里？它在整体叙事中起什么作用？

5. **与整体的关联**：这一页如何服务于导演阐述中的核心主题和关键信息？

6. **不确定点**：有什么内容是你不太确定的？（专业术语、缺少上下文的数据、模糊的表述等）如果有，请明确指出。

7. **演讲提示**：演讲者在讲这一页时，应该重点阐述什么？有什么需要特别注意的？

**置信度评估**：
- 如果内容清晰、逻辑连贯，给高分 (0.8+)
- 如果有专业术语但未解释，给中分 (0.5-0.8)，并在不确定点中说明
- 如果数据缺少上下文、逻辑跳跃，给低分 (<0.5)，必须标记不确定点

请按以下 JSON 格式输出（确保是合法的 JSON）：
{
  "slideNumber": ${slide.slideNumber},
  "slideTitle": "${slide.title || ''}",
  "elements": [
    {
      "type": "bullet",
      "content": "原始内容",
      "meaning": "深层含义",
      "emphasis": "需要强调的点",
      "confidence": 0.9
    }
  ],
  "relationships": {
    "type": "sequence",
    "description": "关系描述"
  },
  "coreMessage": "核心思想",
  "purpose": "页面目的",
  "connectionToNarrative": "与整体叙事的关联",
  "speakingNotes": ["演讲提示 1", "演讲提示 2"],
  "uncertainties": [
    {
      "element": "哪个要素",
      "question": "什么问题不确定",
      "suggestedInterpretation": "建议理解"
    }
  ],
  "confidence": 0.85
}`;
  }

  /**
   * 格式化页面内容
   */
  private formatSlideContent(slide: ContentAnalystAgentInput['slide']): string {
    let content = `第 ${slide.slideNumber} 页`;
    if (slide.title) {
      content += `\n标题：${slide.title}`;
    }

    if (slide.paragraphs && slide.paragraphs.length > 0) {
      content += '\n内容:';
      for (const para of slide.paragraphs) {
        const indent = '  '.repeat(para.level);
        content += `\n${indent}- ${para.text}`;
      }
    }

    if (slide.bulletPoints && slide.bulletPoints.length > 0) {
      content += '\n要点:';
      for (const bullet of slide.bulletPoints) {
        content += `\n- ${bullet}`;
      }
    }

    if (slide.notes) {
      content += `\n演讲者备注：${slide.notes}`;
    }

    return content;
  }

  /**
   * 系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一位资深的演讲内容分析师，擅长：
- 深入理解演示文稿中每一页的要素和逻辑关系
- 识别内容背后的核心思想和演讲者的真实意图
- 分析页面元素如何服务于整体叙事
- 识别模糊、不确定、需要用户确认的内容

你的工作原则：
1. **不机械复述**：不要简单描述"这页有什么"，要解释"这意味着什么"
2. **深度理解**：思考"这个数据和前后文有什么关系"、"为什么演讲者要把这一页放在这里"
3. **诚实评估**：遇到不懂的内容，明确标记出来，不要猜测
4. **服务演讲**：你的分析将用于生成演讲稿，要考虑"演讲者需要知道什么"

你要像一位经验丰富的编辑，能够看穿文字表面，理解作者的真正意图。`;
  }

  /**
   * 解析响应
   */
  private parseResponse(content: string, slideNumber: number): SlideAnalysis {
    // 清理 Markdown 代码块标记
    let cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // 尝试提取 JSON（匹配最外层的大括号）
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          slideNumber: parsed.slideNumber || slideNumber,
          slideTitle: parsed.slideTitle || '',
          elements: Array.isArray(parsed.elements) ? parsed.elements.map((e: any) => ({
            type: e.type || 'unknown',
            content: e.content || '',
            meaning: e.meaning || '',
            emphasis: e.emphasis || '',
            confidence: typeof e.confidence === 'number' ? e.confidence : 0.8
          })) : [],
          relationships: parsed.relationships || { type: 'elaboration', description: '' },
          coreMessage: parsed.coreMessage || '',
          purpose: parsed.purpose || '',
          connectionToNarrative: parsed.connectionToNarrative || '',
          speakingNotes: Array.isArray(parsed.speakingNotes) ? parsed.speakingNotes : [],
          uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : []
        };
      } catch (e) {
        console.warn('[ContentAnalyst] JSON 解析失败，使用降级解析');
        console.warn('[ContentAnalyst] 错误:', e instanceof Error ? e.message : String(e));
        console.warn('[ContentAnalyst] 原始内容 (前 300 字符):', content.substring(0, 300));
      }
    } else {
      console.warn('[ContentAnalyst] 未找到 JSON 内容，使用降级解析');
    }

    // 降级解析
    return this.fallbackParse(content, slideNumber);
  }

  /**
   * 降级解析
   */
  private fallbackParse(content: string, slideNumber: number): SlideAnalysis {
    const extractField = (field: string): string => {
      const patterns = [
        new RegExp(`"${field}"\\s*:\\s*"([^"]*)`, 'i'),
        new RegExp(`${field}["']?\\s*[:：]\\s*["']?([^"'\n]+)`, 'i')
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1].trim();
      }
      return '';
    };

    return {
      slideNumber,
      slideTitle: extractField('slideTitle') || extractField('标题'),
      elements: [],
      relationships: {
        type: 'elaboration',
        description: extractField('relationships') || extractField('逻辑关系') || ''
      },
      coreMessage: extractField('coreMessage') || extractField('核心思想') || '',
      purpose: extractField('purpose') || extractField('页面目的') || '',
      connectionToNarrative: extractField('connectionToNarrative') || '',
      speakingNotes: [],
      uncertainties: []
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(analysis: SlideAnalysis): number {
    if (analysis.uncertainties && analysis.uncertainties.length > 0) {
      // 有不确定点，降低置信度
      return Math.max(0.3, 0.8 - (analysis.uncertainties.length * 0.15));
    }

    // 根据要素分析的完整性评估
    if (analysis.elements.length === 0) {
      return 0.4;
    }

    const avgElementConfidence = analysis.elements.reduce((sum, e) => sum + (e.confidence || 0.8), 0) / analysis.elements.length;
    return avgElementConfidence;
  }

  /**
   * 提取不确定点
   */
  private extractUncertainties(analysis: SlideAnalysis, confidence: number): UncertaintyQuestion[] {
    const uncertainties: UncertaintyQuestion[] = [];

    // 检查要素中的低置信度内容
    for (const element of analysis.elements) {
      if ((element.confidence || 1) < 0.6) {
        uncertainties.push({
          slideNumber: analysis.slideNumber,
          element: element.content.substring(0, 50),
          question: `这个要素的含义不太确定：${element.meaning.substring(0, 50)}...`,
          suggestedInterpretation: element.emphasis
        });
      }
    }

    // 如果整体置信度低，添加概括性疑问
    if (confidence < 0.5) {
      uncertainties.push({
        slideNumber: analysis.slideNumber,
        element: '整体内容',
        question: '这一页的内容理解可能存在偏差，建议用户确认核心思想是否正确',
        suggestedInterpretation: analysis.coreMessage
      });
    }

    return uncertainties;
  }
}
