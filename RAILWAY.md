# PPT 演讲稿生成器 - Railway 部署指南

## 快速部署

### 1. 在 Railway 上创建项目

访问 https://railway.app

1. 点击 **New Project**
2. 选择 **Deploy from GitHub repo**
3. 选择 `ppt-speech-generator` 仓库

### 2. 添加环境变量

在 Railway 项目页面，点击 **Variables**，添加：

```
ANTHROPIC_API_KEY=sk-sp-2184ff998e9b49d197c3f5995a566be1
DASHSCOPE_MODEL=qwen3.5-plus
DASHSCOPE_BASE_URL=https://coding.dashscope.aliyuncs.com/v1
NODE_VERSION=20
```

### 3. 配置构建

在 **Settings** 标签页：

- **Build Command**: `npm install && npm run build`
- **Deploy Command**: `node dist/server/index.js`
- **Root Directory**: 留空

### 4. 部署

点击 **Deploy** 开始构建。

---

## 故障排查

### 构建失败

1. 检查 **Build Logs** 查看具体错误
2. 确保环境变量已正确设置
3. 尝试删除服务后重新部署

### 运行时错误

1. 检查 **Deploy Logs** 查看启动日志
2. 确认 API Key 有效
3. 检查是否有足够的内存（建议至少 512MB）

### 文件上传问题

Railway 重启后文件系统会重置，建议：
- 配置持久化存储：添加 Volume
- 或使用云存储（S3/OSS）

---

## 访问应用

部署完成后：

1. 点击 **Settings** → **Networking**
2. 点击 **Generate Domain** 获取公网 URL
3. 访问该 URL 即可使用
