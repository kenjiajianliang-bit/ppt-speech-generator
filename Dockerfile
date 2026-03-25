# 使用 Node.js 官方镜像
FROM node:20-alpine

# 安装必要的工具
RUN apk add --no-cache git

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装生产依赖
RUN npm install --production

# 复制源代码
COPY public/ ./public/
COPY dist/ ./dist/

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/styles || exit 1

# 启动应用
CMD ["node", "dist/server/index.js"]
