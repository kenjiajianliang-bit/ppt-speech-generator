# Railway Dockerfile
FROM node:20-bookworm

WORKDIR /app

# 复制 package 文件和 tsconfig.json
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm install

# 构建
RUN npm run build

# 复制源代码
COPY src/ ./src/
COPY public/ ./public/

# 暴露端口
EXPOSE 3000

# 启动
CMD ["node", "dist/server/index.js"]
