# Railway Dockerfile - 使用 tsx 运行
FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括 tsx）
RUN npm install

# 复制所有源代码
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig.json ./

# 暴露端口
EXPOSE 3000

# 使用 tsx 运行 TypeScript 源码
CMD ["tsx", "src/server/index.ts"]
