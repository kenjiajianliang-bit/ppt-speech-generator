# Railway Dockerfile
FROM node:20-bookworm

WORKDIR /app

# 复制所有文件
COPY . .

# 安装依赖
RUN npm install

# 暴露端口
EXPOSE 3000

# 使用 node 运行
CMD ["node", "--import", "tsx/esm", "src/server/index.ts"]
