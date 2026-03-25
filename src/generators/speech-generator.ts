import { StructureAnalysis, SectionInfo } from '../analyzers/content-analyzer';
import { SpeechStyle, SpeechGenerationParams, Speech, SpeechSection } from '../types';
import { getStyleConfig } from '../config/speech-styles';

/**
 * 演讲稿生成器 - 调用大模型 API 生成演讲稿
 */
export class SpeechGenerator {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = model || 'qwen-plus';
  }

  /**
   * 生成演讲稿
   */
  async generate(
    pptContent: string,
    structure: StructureAnalysis,
    params: SpeechGenerationParams
  ): Promise<Speech> {
    const wordsPerMinute = this.getWordsPerMinute(params.style);
    const totalWords = Math.floor(params.durationMinutes * wordsPerMinute);
    const totalSeconds = params.durationMinutes * 60;

    const prompt = this.buildPrompt(pptContent, structure, params, totalWords, totalSeconds, wordsPerMinute);

    console.log('正在调用大模型 API...');
    console.log('模型:', this.model);
    console.log('目标字数:', totalWords);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    console.log('API 响应长度:', responseText.length);

    return this.parseResponse(responseText, params);
  }

  private getWordsPerMinute(style: SpeechStyle): number {
    const rates: Record<SpeechStyle, number> = {
      training: 180,
      presentation: 200,
      report: 220,
      casual: 170
    };
    return rates[style];
  }

  private buildPrompt(
    pptContent: string,
    structure: StructureAnalysis,
    params: SpeechGenerationParams,
    totalWords: number,
    totalSeconds: number,
    wordsPerMinute: number
  ): string {
    const totalSlides = structure.bodySlides.length + structure.openingSlides.length + structure.closingSlides.length;

    return `你是一位资深的演讲稿撰写专家，擅长深入理解演示文稿的核心思想，并为演讲者创作有深度、有洞察力的演讲稿。

【任务说明】
你的任务是根据 PPT 内容创作一份专业的演讲稿。**关键要求：不要简单复述 PPT 上的文字！**

你需要：
1. 深入理解每一页 PPT 要表达的核心思想和背后的逻辑
2. 分析这页 PPT 在整个演讲中的作用和目的
3. 阐述和展开 PPT 要点，提供上下文、解释、例子
4. 建立连接，让各页之间有逻辑过渡，形成连贯的叙述

【PPT 内容详情】
${pptContent}

【结构信息】
- 总页数：${totalSlides} 页
- 开场部分：第 ${structure.openingSlides.join(', ')} 页
- 主体部分：第 ${structure.bodySlides.join(', ')} 页
- 结尾部分：第 ${structure.closingSlides.join(', ')} 页

【演讲要求】
- 演讲时长：严格控制在 ${params.durationMinutes} 分钟（${totalSeconds} 秒）
- 目标字数：约 ${totalWords} 字（按${wordsPerMinute}字/分钟的语速计算）
${params.audience ? `- 受众群体：${params.audience}` : ''}
${params.additionalContext ? `- 额外背景：${params.additionalContext}` : ''}

【写作要求】
1. 不要照念 PPT：PPT 上的内容是提示，你的演讲稿需要展开阐述、解释、举例
2. 理解深层含义：思考"这一页 PPT 想传达什么核心信息？为什么放在这里？"
3. 建立逻辑连接：页与页之间要有过渡语
4. 提供背景解释：专业术语要解释，数据要说明来源和意义
5. 适合口头表达：句子要简短有力，避免复杂从句

【输出格式】
请用 Markdown 格式输出：

# 演讲稿标题

> **预计时长**：XX 分钟 | **总字数**：约 XXXX 字 | **PPT 页数**：XX 页

---

## 开场白（约 XX 秒）

[开场白内容]

---

## 第 1 页：PPT 页面标题

**建议时长**：XX 秒

**核心信息**：[用一句话概括]

[详细的演讲词内容，不是复述 PPT 文字，而是解释、阐述、举例]

---

## 第 2 页：PPT 页面标题

...（结构同上，每一页都要有）...

---

## 结束语（约 XX 秒）

[总结核心观点，呼应开场]

---

## 时长统计

| 部分 | 预计时长 | 预估字数 |
|------|----------|----------|
| 开场白 | XX 秒 | XXX 字 |
| 各页内容 | ... | ... |
| 结束语 | XX 秒 | XXX 字 |
| **合计** | **${totalSeconds} 秒** | **约${totalWords}字** |
`;
  }

  private parseResponse(responseText: string, params: SpeechGenerationParams): Speech {
    try {
      // 提取代码块中的 Markdown
      const codeBlockMatch = responseText.match(/```markdown\s*([\s\S]*?)```/);
      const markdown = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

      // 提取标题
      const titleMatch = markdown.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : '演讲稿';

      // 简化处理：直接返回完整 Markdown
      return {
        title,
        opening: '',
        sections: [],
        closing: '',
        estimatedDuration: params.durationMinutes,
        markdown
      };
    } catch (error) {
      console.error('解析演讲稿失败:', error);
      return this.createFallbackSpeech(responseText, params);
    }
  }

  private extractMarkdown(responseText: string): string {
    const codeBlockMatch = responseText.match(/```markdown\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return responseText.trim();
  }

  private createFallbackSpeech(responseText: string, params: SpeechGenerationParams): Speech {
    const markdown = `# 演讲稿\n\n> **预计时长**：${params.durationMinutes} 分钟\n\n${responseText}\n`;

    return {
      title: '演讲稿',
      opening: responseText.substring(0, 200),
      sections: [],
      closing: '',
      estimatedDuration: params.durationMinutes,
      markdown
    };
  }

  /**
   * 根据用户反馈优化演讲稿
   */
  async refine(
    originalSpeech: Speech,
    pptContent: string,
    feedback: string,
    params: SpeechGenerationParams
  ): Promise<Speech> {
    const wordsPerMinute = this.getWordsPerMinute(params.style);
    const totalWords = Math.floor(params.durationMinutes * wordsPerMinute);
    const totalSeconds = params.durationMinutes * 60;

    const prompt = `你是一位专业的演讲稿撰写专家。用户希望你根据他们的反馈修改之前创作的演讲稿。

【用户反馈】
${feedback}

【原演讲稿】
${originalSpeech.markdown}

【原始 PPT 内容参考】
${pptContent}

【修改要求】
1. 根据用户的反馈进行针对性修改
2. 保持演讲时长在 ${params.durationMinutes} 分钟（${totalSeconds} 秒，约 ${totalWords} 字）
3. 保持 Markdown 格式输出
4. 确保每一页 PPT 都有对应的演讲词

请直接输出修改后的完整演讲稿（Markdown 格式）：`;

    console.log('正在优化演讲稿...');
    console.log('用户反馈:', feedback);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    return this.parseResponse(responseText, params);
  }
}
