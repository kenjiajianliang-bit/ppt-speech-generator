import { Speech, SpeechWriterAgentInput, AgentResult, DirectorBrief, SlideAnalysis } from '../types/agent-types';
import { getStyleConfig, calculateTargetWordCount } from '../config/speech-styles';

/**
 * 演讲稿撰写智能体
 *
 * 职责：
 * - 基于导演阐述和每页深度分析撰写演讲稿
 * - 确保内容准确、逻辑连贯
 * - 用受众易于接受的方式表达
 * - 控制时长和风格
 */
export class SpeechWriterAgent {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://coding.dashscope.aliyuncs.com/v1';
    this.model = model || 'qwen3.5-plus';
  }

  /**
   * 生成演讲稿
   */
  async generate(input: SpeechWriterAgentInput): Promise<AgentResult<Speech>> {
    try {
      const targetWordCount = calculateTargetWordCount(input.durationMinutes, input.style as any);
      const wordsPerMinute = this.getWordsPerMinute(input.style);
      const totalSeconds = input.durationMinutes * 60;

      const prompt = this.buildPrompt(input, targetWordCount, totalSeconds, wordsPerMinute);

      console.log('[SpeechWriter] 正在撰写演讲稿...');
      console.log('  - 目标字数:', targetWordCount);
      console.log('  - 预计时长:', input.durationMinutes, '分钟');

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
          temperature: 0.8,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const speech = this.parseResponse(content, input);

      console.log('[SpeechWriter] 演讲稿生成完成');
      console.log('  - 标题:', speech.title);
      console.log('  - 实际字数:', speech.markdown.length);

      return {
        success: true,
        data: speech
      };
    } catch (error) {
      console.error('[SpeechWriter] 生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取语速（字/分钟）
   */
  private getWordsPerMinute(style: string): number {
    const rates: Record<string, number> = {
      training: 180,
      presentation: 200,
      report: 220,
      casual: 170
    };
    return rates[style] || 200;
  }

  /**
   * 构建提示词
   */
  private buildPrompt(
    input: SpeechWriterAgentInput,
    targetWordCount: number,
    totalSeconds: number,
    wordsPerMinute: number
  ): string {
    const styleConfig = getStyleConfig(input.style as any);

    const slidesContent = input.slideAnalyses.map(analysis => {
      let content = `## 第 ${analysis.slideNumber} 页：${analysis.slideTitle}\n\n`;
      content += `**核心信息**: ${analysis.coreMessage}\n\n`;
      content += `**页面目的**: ${analysis.purpose}\n\n`;
      content += `**与整体叙事的关联**: ${analysis.connectionToNarrative}\n\n`;

      if (analysis.elements.length > 0) {
        content += `**页面要素**:\n`;
        for (const elem of analysis.elements) {
          content += `- ${elem.content}: ${elem.meaning} (强调：${elem.emphasis})\n`;
        }
        content += '\n';
      }

      if (analysis.relationships.description) {
        content += `**逻辑关系**: ${analysis.relationships.description}\n\n`;
      }

      if (analysis.speakingNotes.length > 0) {
        content += `**演讲提示**:\n${analysis.speakingNotes.map(n => `- ${n}`).join('\n')}\n\n`;
      }

      return content;
    }).join('\n---\n\n');

    return `【导演阐述】
核心主题：${input.directorBrief.coreTheme}
叙事主线：${input.directorBrief.narrativeArc}
基调：${input.directorBrief.tone}
受众分析：${input.directorBrief.audienceAnalysis}
关键信息：${input.directorBrief.keyMessages.join('; ')}
演讲目标：${input.directorBrief.speechGoal}
潜在挑战：${input.directorBrief.potentialChallenges}

【演讲要求】
- 时长：${input.durationMinutes} 分钟（${totalSeconds}秒）
- 目标字数：约 ${targetWordCount} 字（按${wordsPerMinute}字/分钟计算）
- 风格：${styleConfig.name} - ${styleConfig.description}
- 语调：${styleConfig.tone}
- 结构：${styleConfig.structure}
- 语言风格：${styleConfig.languageStyle}
${input.audience ? `- 受众：${input.audience}` : ''}

【页面分析详情】
共 ${input.slideAnalyses.length} 页

${slidesContent}

---

请作为专业演讲稿撰写人，根据以上导演阐述和页面分析，撰写一份完整的演讲稿。

**关键要求**：

1. **不要复述 PPT 文字**：页面分析中的内容是给你理解的，演讲时要用自己的话展开阐述

2. **遵循导演阐述**：
   - 核心主题要贯穿始终
   - 基调要符合要求（如轻松、严谨、激励等）
   - 关键信息要适当重复和强调

3. **深入阐述每页内容**：
   - 基于页面分析中的"核心信息"和"页面目的"
   - 解释要素的"深层含义"，不要只说表面
   - 体现"逻辑关系"，让听众理解来龙去脉

4. **建立页面间的连接**：
   - 使用过渡语，让页面之间自然衔接
   - 呼应前面的内容，预告后面的内容
   - 让整场演讲像一个连贯的故事

5. **符合口语表达**：
   - 句子要简短有力
   - 避免复杂从句
   - 适当使用修辞手法（如排比、对比、设问）

6. **控制时长**：
   - 总字数接近目标字数（±10%）
   - 每页时长分配合理（重点页面多花时间）

7. **跳过不重要的元素**（重要！）：
   - **封面页**：只讲主题和问候，跳过日期、logo、公司名等
     - ✅ "大家好，今天我想和大家分享的主题是..."
     - ❌ "这张幻灯片的标题是...下面写着 2025 年 3 月 25 日..."
   - **封底页**：简单感谢即可，不要过度解读
     - ✅ "以上就是我今天的分享，谢谢大家！"
     - ❌ "屏幕上显示着'THANK YOU'，但这不仅仅是结束，更是开始..."
   - **其他辅助信息**：页码、装饰性文字、标语等不用念

**输出格式**（Markdown）：

\`\`\`markdown
# [演讲稿标题]

> **预计时长**：${input.durationMinutes}分钟 | **目标字数**：约${targetWordCount}字 | **PPT 页数**：${input.slideAnalyses.length}页

---

## 开场白

[开场白内容，吸引注意，建立预期，呼应导演阐述的核心主题]

---

## 第 1 页：[页面标题]

[详细演讲词，基于页面分析深入阐述]

---

## 第 2 页：[页面标题]

[详细演讲词，包含与前一页的过渡]

...

---

## 结束语

[总结核心观点，呼应开场，给听众留下深刻印象]

---

## 时长统计

| 部分 | 预计时长 | 预估字数 |
|------|----------|----------|
| 开场白 | XX 秒 | XXX 字 |
| 第 1 页 | XX 秒 | XXX 字 |
| ... | ... | ... |
| 结束语 | XX 秒 | XXX 字 |
| **合计** | **${totalSeconds}秒** | **约${targetWordCount}字** |
\`\`\`

${styleConfig.promptSuffix}

请直接输出 Markdown 格式的演讲稿（包含在代码块中）：`;
  }

  /**
   * 系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一位专业的演讲稿撰写专家，擅长：
- 将结构化的内容分析转化为生动、自然的演讲词
- 根据场合和受众调整语言风格
- 建立页面间的逻辑连接，让演讲流畅连贯
- 控制时长，确保内容精炼但不失深度

你的工作原则：
1. **基于分析，不止于分析**：利用内容理解智能体的分析结果，但要用自己的话表达
2. **像对人说话**：想象你正站在台上，面对真实的听众
3. **逻辑清晰**：让听众容易跟上思路，知道"我们现在在哪里，为什么要讲这个"
4. **有温度**：适当加入情感元素，让演讲更有感染力

你要像一位经验丰富的撰稿人，写出来的稿子要让演讲者说得顺口，听众听得入耳。`;
  }

  /**
   * 解析响应
   */
  private parseResponse(content: string, input: SpeechWriterAgentInput): Speech {
    // 提取 Markdown 代码块
    const codeBlockMatch = content.match(/```markdown\s*([\s\S]*?)```/);
    const markdown = codeBlockMatch ? codeBlockMatch[1].trim() : content.trim();

    // 提取标题
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : '演讲稿';

    // 提取开场白
    const openingMatch = markdown.match(/## 开场白\s*\n([\s\S]*?)(?=---\s*\n## 第 \d+ 页|$)/);
    const openingContent = openingMatch ? openingMatch[1].trim() : '';

    // 提取结束语
    const closingMatch = markdown.match(/## 结束语\s*\n([\s\S]*?)(?=---|$)/);
    const closingContent = closingMatch ? closingMatch[1].trim() : '';

    // 提取各页面内容
    const slides: Speech['slides'] = [];
    const slideRegex = /## 第 (\d+) 页：([^\n]+)\s*\n([\s\S]*?)(?=---\s*\n## 第 \d+ 页：|---\s*\n## 结束语|$)/g;
    let match;

    while ((match = slideRegex.exec(markdown)) !== null) {
      const slideNumber = parseInt(match[1]);
      const slideTitle = match[2].trim();
      let slideContent = match[3].trim();

      // 移除可能的元数据行
      slideContent = slideContent.replace(/^\*\*[^*]+\*\*.*\n?/gm, '');

      // 查找过渡语（下一段开始前的一般性陈述）
      const transitionMatch = slideContent.match(/^(\[?[ 过渡 [^\]]*\]?)(.+)/i);
      const transition = transitionMatch ? transitionMatch[1] : '';
      if (transitionMatch) {
        slideContent = slideContent.replace(transitionMatch[0], '').trim();
      }

      // 估算时长（按字速计算）
      const wordCount = slideContent.replace(/\s/g, '').length;
      const wordsPerMinute = this.getWordsPerMinute(input.style);
      const durationSeconds = Math.round((wordCount / wordsPerMinute) * 60);

      slides.push({
        slideNumber,
        title: slideTitle,
        content: slideContent,
        transitions: transition,
        durationSeconds
      });
    }

    // 计算开场和结尾的时长
    const openingWords = openingContent.replace(/\s/g, '').length;
    const closingWords = closingContent.replace(/\s/g, '').length;
    const wordsPerMinute = this.getWordsPerMinute(input.style);

    const openingDuration = Math.round((openingWords / wordsPerMinute) * 60);
    const closingDuration = Math.round((closingWords / wordsPerMinute) * 60);

    return {
      title,
      estimatedDuration: input.durationMinutes,
      opening: {
        content: openingContent,
        durationSeconds: openingDuration
      },
      slides,
      closing: {
        content: closingContent,
        durationSeconds: closingDuration
      },
      markdown
    };
  }
}
