# PPT 演讲稿生成器

基于多智能体协同的演讲稿生成系统，根据 PPT 内容自动生成专业演讲稿。

## 功能特点

- 🎯 **多智能体协同**：导演→内容分析师→演讲稿撰写师，三步打造专业演讲稿
- 🔄 **人机交互确认**：关键节点支持用户确认和修改，确保内容符合预期
- 📊 **进度可视化**：实时显示分析进度，不再无谓等待
- 🎨 **渲染优化**：Markdown 自动渲染为 HTML，阅读体验更佳
- ⏱️ **智能时长控制**：根据演讲时长自动调整内容长度

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 百炼 API Key（必填）
ANTHROPIC_API_KEY=sk-your-key-here

# 模型配置
DASHSCOPE_MODEL=qwen3.5-plus
DASHSCOPE_BASE_URL=https://coding.dashscope.aliyuncs.com/v1

# 服务器配置
PORT=3000
```

### 3. 启动服务

**开发模式**（热重载）：

```bash
npm run dev
```

**生产模式**：

```bash
# 编译
npm run build

# 启动
npm start
```

访问 http://localhost:3000

## 部署到云服务器

### 方案一：直接部署

1. **上传代码到服务器**

```bash
# 打包上传（排除 node_modules）
tar --exclude='node_modules' -czf ppt-speech-generator.tar.gz .
scp ppt-speech-generator.tar.gz user@your-server:/opt/
```

2. **服务器配置**

```bash
cd /opt
tar -xzf ppt-speech-generator.tar.gz
cd ppt-speech-generator

# 安装依赖
npm install --production

# 配置环境变量
cp .env.example .env
vim .env  # 编辑 API Key

# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start npm --name "ppt-speech" -- start

# 设置开机自启
pm2 startup
pm2 save
```

3. **配置 Nginx 反向代理**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 方案二：Docker 部署

```bash
# 构建镜像
docker build -t ppt-speech-generator .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  -e DASHSCOPE_MODEL=qwen3.5-plus \
  -v $(pwd)/uploads:/app/uploads \
  --name ppt-speech \
  ppt-speech-generator
```

## API 接口

### 多智能体分阶段 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate/phase1-director` | POST | 阶段 1：生成导演阐述 |
| `/api/generate/confirm-director` | POST | 确认导演阐述 |
| `/api/generate/phase2-analyst` | POST | 阶段 2：分析内容 |
| `/api/generate/confirm-analysis` | POST | 确认内容分析 |
| `/api/generate/phase3-writer` | POST | 阶段 3：生成演讲稿 |
| `/api/progress/:sessionId` | GET | 查询分析进度 |
| `/api/session/:sessionId` | GET | 获取 Session 状态 |

### 其他 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/styles` | GET | 获取演讲风格列表 |
| `/api/upload` | POST | 上传 PPT 文件 |
| `/api/generate` | POST | 生成演讲稿（简单模式） |
| `/api/refine` | POST | 优化演讲稿 |

## 项目结构

```
ppt-speech-generator/
├── public/              # 前端静态文件
│   └── index.html       # 主页面
├── src/
│   ├── agents/          # 智能体
│   │   ├── director-agent.ts      # 导演智能体
│   │   ├── content-analyst-agent.ts # 内容分析师
│   │   ├── speech-writer-agent.ts # 演讲稿撰写师
│   │   └── orchestrator.ts        # 协同引擎
│   ├── parsers/         # 文件解析器
│   ├── analyzers/       # 内容分析器
│   ├── config/          # 配置
│   ├── server/          # 服务器
│   └── types/           # 类型定义
├── uploads/             # 上传文件存储
├── .env.example         # 环境变量模板
└── package.json
```

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: 原生 HTML + CSS + JavaScript
- **AI**: 通义千问 qwen3.5-plus（百炼 API）
- **文件解析**: pdf-parse, jszip

## 常见问题

### 1. API Key 在哪里获取？

访问 [阿里云百炼控制台](https://dashscope.console.aliyun.com/) 创建 API Key。

### 2. 上传 PDF 后显示无法看到内容？

当前版本只支持包含文本层的 PDF。如果是图片转成的 PDF（扫描件），需要：
- 使用原始 PPTX 文件，或
- 等待后续 OCR 功能支持

### 3. 如何修改演讲时长？

在前端界面选择时长（分钟），系统会自动调整演讲稿字数。

### 4. 内容分析超时怎么办？

增加 `.env` 中的 `ANALYSIS_TIMEOUT_MS` 值（默认 300000ms = 5 分钟）。

## 更新日志

### v1.1.0 (2025-03-25)
- ✅ 优化演讲稿内容，跳过不重要元素（日期、logo、Thank You 等）
- ✅ Markdown 自动渲染为 HTML，阅读更清晰
- ✅ 添加分析进度条，实时显示处理进度
- ✅ 添加超时处理和错误提示

### v1.0.0
- 初始版本发布
- 多智能体协同系统
- 人机交互确认功能

## License

MIT
