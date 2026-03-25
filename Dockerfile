# Railway Dockerfile
FROM node:20-bookworm

WORKDIR /app

# 复制所有文件（除了 .gitignore 排除的）
COPY . .

# 安装依赖
RUN npm install

# 构建
RUN npm run build

# 暴露端口（使用环境变量 PORT）
EXPOSE 8080

# 启动服务器
CMD ["node", "dist/server/index.js"]
