import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PPTParser } from '../parsers/ppt-parser';
import { PDFParser } from '../parsers/pdf-parser';
import { ContentAnalyzer } from '../analyzers/content-analyzer';
import { SpeechGenerator } from '../generators/speech-generator';
import { getAvailableStyles } from '../config/speech-styles';
import { Orchestrator } from '../agents/orchestrator';
import { confirmationHandler } from './confirmation-handler';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../../public')));

// 配置文件上传
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pptx', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PPTX 和 PDF 格式文件'));
    }
  }
});

// 初始化服务
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.DASHSCOPE_MODEL;
const baseURL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

if (!apiKey) {
  console.warn('警告：未设置 ANTHROPIC_API_KEY 环境变量');
}
console.log('API baseURL:', baseURL);
console.log('Model:', model);
const speechGenerator = new SpeechGenerator(apiKey || 'dummy-key', baseURL, model);
const pptParser = new PPTParser();
const pdfParser = new PDFParser();
const contentAnalyzer = new ContentAnalyzer();

// 初始化多智能体协同引擎
const orchestrator = new Orchestrator(apiKey || 'dummy-key', baseURL, model);

// 进度跟踪
const progressMap = new Map<string, { completed: number; total: number; currentSlide: number; status: string }>();

// 分析超时时间（毫秒）
const ANALYSIS_TIMEOUT_MS = parseInt(process.env.ANALYSIS_TIMEOUT_MS || '300000'); // 默认 5 分钟

// 生成唯一的 Session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 进度更新回调
function createProgressCallback(sessionId: string) {
  return (completed: number, total: number, currentSlide: number) => {
    progressMap.set(sessionId, {
      completed,
      total,
      currentSlide,
      status: `正在分析第 ${currentSlide} 页... (${completed}/${total})`
    });
    console.log(`[Progress] Session ${sessionId}: ${completed}/${total} - 第 ${currentSlide} 页`);
  };
}

// ==================== 多智能体分阶段 API ====================

/**
 * 阶段 1：生成导演阐述
 */
app.post('/api/generate/phase1-director', async (req, res) => {
  try {
    const { sessionId, pptContent, structure, style, durationMinutes, audience, additionalContext, slides } = req.body;

    if (!pptContent || !structure || !style || !durationMinutes) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const currentSessionId = sessionId || generateSessionId();

    const result = await orchestrator.generateDirectorBrief(
      currentSessionId,
      pptContent,
      structure,
      { style, durationMinutes, audience, additionalContext },
      slides  // 传入解析后的 slides
    );

    if (result.success) {
      res.json({
        sessionId: currentSessionId,
        stage: 'director',
        directorBrief: result.data,
        confidence: result.confidence,
        message: '导演阐述已生成，请确认后继续'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('导演阐述生成失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '导演阐述生成失败'
    });
  }
});

/**
 * 确认导演阐述
 */
app.post('/api/generate/confirm-director', async (req, res) => {
  try {
    const { sessionId, confirmed, modifications } = req.body;
    console.log(`[API] confirm-director 收到请求：sessionId=${sessionId}, confirmed=${confirmed}`);

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    const result = orchestrator.confirmDirectorBrief(sessionId, confirmed, modifications);
    console.log(`[API] confirmDirectorBrief 返回：success=${result.success}`);

    if (result.success) {
      res.json({
        success: true,
        message: '导演阐述已确认，可以进入内容分析阶段',
        nextStage: 'analyst'
      });
    } else {
      console.error(`[API] confirmDirectorBrief 返回错误：${result.error}`);
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('确认导演阐述失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '确认失败'
    });
  }
});

/**
 * 阶段 2：分析内容（到疑问点暂停）
 */
app.post('/api/generate/phase2-analyst', async (req, res) => {
  try {
    const { sessionId, structure } = req.body;
    console.log(`[API] phase2-analyst 收到请求：sessionId=${sessionId}`);

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    // 初始化进度
    progressMap.set(sessionId, { completed: 0, total: 0, currentSlide: 0, status: '准备分析...' });

    // 创建进度回调
    const onProgress = createProgressCallback(sessionId);

    // 传入 structure 用于分析
    console.log(`[API] 调用 orchestrator.analyzeContent...`);
    const result = await orchestrator.analyzeContent(sessionId, structure, onProgress);
    console.log(`[API] analyzeContent 返回：success=${result.success}`);

    // 清理进度
    progressMap.delete(sessionId);

    if (result.success) {
      const uncertainties = orchestrator.getUncertainties(sessionId);

      res.json({
        success: true,
        sessionId,
        stage: 'analyst',
        slideAnalyses: result.data,
        uncertainties,
        confidence: result.confidence,
        message: uncertainties.length > 0
          ? `检测到 ${uncertainties.length} 个不确定点，请确认后继续`
          : '内容分析完成，无不确定点，可以直接生成演讲稿'
      });
    } else {
      console.error(`[API] analyzeContent 返回错误：${result.error}`);
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    // 清理进度
    progressMap.delete(req.body.sessionId);
    console.error('内容分析失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '内容分析失败'
    });
  }
});

/**
 * 查询分析进度
 */
app.get('/api/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const progress = progressMap.get(sessionId);

  if (!progress) {
    return res.json({ exists: false });
  }

  res.json({
    exists: true,
    ...progress
  });
});

/**
 * 测试 API 连接（调试用）
 */
app.get('/api/test-analyze', async (req, res) => {
  try {
    console.log('[Test] 开始测试内容分析...');

    // 创建一个测试 session
    const testSessionId = `test_${Date.now()}`;
    const testSlides = [
      {
        slideNumber: 1,
        title: '测试页面',
        paragraphs: [{ text: '这是一个测试内容', level: 0 }],
        bulletPoints: ['要点 1', '要点 2'],
        notes: undefined
      }
    ];

    const testBrief = {
      coreTheme: '测试主题',
      narrativeArc: '测试叙事',
      tone: '轻松',
      audienceAnalysis: '测试受众',
      keyMessages: ['测试消息'],
      speechGoal: '测试目标',
      potentialChallenges: '测试挑战',
      confidence: 0.9
    };

    // 保存测试数据
    const session: any = {
      sessionId: testSessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      currentStage: 'analyst',
      pptContent: '测试内容',
      pptSlides: testSlides,
      confirmedDirectorBrief: testBrief,
      params: { style: 'training', durationMinutes: 5 }
    };

    // 使用 orchestrator 的内部 sessions（需要访问私有属性）
    // 这里我们直接调用 API 测试
    console.log('[Test] 调用内容分析 API...');

    res.json({
      message: '测试开始',
      sessionId: testSessionId,
      slides: testSlides.length,
      timestamp: new Date().toISOString()
    });

    // 实际测试
    const result = await orchestrator.analyzeContent(testSessionId, {
      sections: [],
      openingSlides: [],
      bodySlides: [1],
      closingSlides: []
    }, (c, t, s) => {
      console.log(`[Test Progress] ${c}/${t} - Slide ${s}`);
    });

    console.log('[Test] 结果:', result.success ? '成功' : '失败', result.error || '');
  } catch (error) {
    console.error('[Test] 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 确认内容分析（用户回答疑问）
 */
app.post('/api/generate/confirm-analysis', async (req, res) => {
  try {
    const { sessionId, answers } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    // 使用 orchestrator 来确认，这样 session 数据才会同步
    const result = orchestrator.confirmAnalysis(sessionId, answers || []);

    if (result.success) {
      res.json({
        success: true,
        message: '内容分析已确认，可以生成演讲稿',
        nextStage: 'writer'
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('确认内容分析失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '确认失败'
    });
  }
});

/**
 * 阶段 3：生成演讲稿
 */
app.post('/api/generate/phase3-writer', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }

    const result = await orchestrator.generateSpeech(sessionId);

    if (result.success) {
      res.json({
        success: true,
        sessionId,
        stage: 'completed',
        speech: result.data
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('演讲稿生成失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '演讲稿生成失败'
    });
  }
});

/**
 * 获取 Session 状态
 */
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = confirmationHandler.getSessionStatus(sessionId);

    if (!status || !status.exists) {
      return res.status(404).json({ error: 'Session 不存在或已过期' });
    }

    res.json(status);
  } catch (error) {
    console.error('获取 Session 状态失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取状态失败'
    });
  }
});

// ==================== 原有简单 API（保留兼容）====================

/**
 * 获取可用的演讲风格列表
 */
app.get('/api/styles', (req, res) => {
  const styles = getAvailableStyles().map(({ key, config }) => ({
    key,
    name: config.name,
    description: config.description,
    formalityLevel: config.formalityLevel,
    interactionLevel: config.interactionLevel
  }));
  res.json(styles);
});

/**
 * 上传文件（支持 PPTX 和 PDF）
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let doc;

    // 根据文件类型选择解析器
    if (ext === '.pdf') {
      doc = await pdfParser.parse(req.file.path);
    } else {
      doc = await pptParser.parse(req.file.path);
    }

    // 分析内容
    const structure = contentAnalyzer.analyzeStructure(doc);
    const textSummary = pptParser.toTextSummary(doc);

    res.json({
      fileName: doc.fileName,
      totalSlides: doc.totalSlides,
      metadata: doc.metadata,
      slides: doc.slides,  // 返回 slides
      structure: {
        sections: structure.sections,
        openingSlides: structure.openingSlides,
        bodySlides: structure.bodySlides,
        closingSlides: structure.closingSlides
      },
      summary: textSummary,
      filePath: req.file.path,
      fileType: ext === '.pdf' ? 'pdf' : 'pptx'
    });
  } catch (error) {
    console.error('上传处理失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '处理文件失败'
    });
  }
});

/**
 * 生成演讲稿
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { pptContent, structure, style, durationMinutes, audience, additionalContext } = req.body;

    if (!pptContent || !structure || !style || !durationMinutes) {
      return res.status(400).json({
        error: '缺少必要参数'
      });
    }

    const speech = await speechGenerator.generate(pptContent, structure, {
      style,
      durationMinutes,
      audience,
      additionalContext
    });

    res.json(speech);
  } catch (error) {
    console.error('生成演讲稿失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '生成演讲稿失败'
    });
  }
});

/**
 * 优化演讲稿
 */
app.post('/api/refine', async (req, res) => {
  try {
    const { originalSpeech, pptContent, feedback, style, durationMinutes } = req.body;

    if (!originalSpeech || !pptContent || !feedback) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const refinedSpeech = await speechGenerator.refine(
      originalSpeech,
      pptContent,
      feedback,
      { style, durationMinutes }
    );

    res.json(refinedSpeech);
  } catch (error) {
    console.error('优化演讲稿失败:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '优化演讲稿失败'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`\nAPI 端点:`);
  console.log(`\n--- 多智能体分阶段 API ---`);
  console.log(`  POST /api/generate/phase1-director  - 阶段 1：生成导演阐述`);
  console.log(`  POST /api/generate/confirm-director - 确认导演阐述`);
  console.log(`  POST /api/generate/phase2-analyst   - 阶段 2：分析内容`);
  console.log(`  POST /api/generate/confirm-analysis - 确认内容分析`);
  console.log(`  POST /api/generate/phase3-writer    - 阶段 3：生成演讲稿`);
  console.log(`  GET  /api/session/:sessionId        - 获取 Session 状态`);
  console.log(`\n--- 原有简单 API ---`);
  console.log(`  GET  /api/styles   - 获取演讲风格列表`);
  console.log(`  POST /api/upload   - 上传 PPT 文件`);
  console.log(`  POST /api/generate - 生成演讲稿（简单模式）`);
  console.log(`  POST /api/refine   - 优化演讲稿`);
});

export default app;
