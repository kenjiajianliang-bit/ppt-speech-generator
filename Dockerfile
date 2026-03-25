# Railway Dockerfile - 简化版
FROM node:20-alpine

WORKDIR /app

# 复制所有文件（除了 .gitignore 排除的）
COPY . .

# 安装依赖并构建
RUN npm install && npm run build

# 暴露端口
EXPOSE 3000

# 启动
CMD ["node", "dist/server/index.js"]
