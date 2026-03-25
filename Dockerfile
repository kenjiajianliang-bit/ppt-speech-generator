# Railway Dockerfile
FROM node:20-bookworm

WORKDIR /app

# 复制所有文件（除了 .gitignore 排除的）
COPY . .

# 安装依赖
RUN npm install

# 构建 - 这会创建 dist 目录
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动服务器
CMD ["node", "dist/server/index.js"]
