#!/bin/bash
# 一键部署脚本（适用于 Ubuntu/Debian）
# 使用方法：chmod +x deploy.sh && ./deploy.sh

set -e

echo "======================================"
echo "  PPT 演讲稿生成器 - 一键部署脚本"
echo "======================================"

# 检查是否已安装 Node.js
if ! command -v node &> /dev/null; then
    echo "正在安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 检查是否已安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "正在安装 PM2..."
    npm install -g pm2
fi

# 安装依赖
echo "正在安装依赖..."
npm install --production

# 创建上传目录
mkdir -p uploads

# 配置环境变量
if [ ! -f .env ]; then
    echo "正在创建.env 配置文件..."
    cp .env.example .env
    echo ""
    echo "请编辑 .env 文件，填写 API Key"
    echo "按回车键继续..."
    read
fi

# 编译 TypeScript
echo "正在编译..."
npm run build

# 启动服务
echo "正在启动服务..."
pm2 start ecosystem.config.cjs

# 设置 PM2 开机自启
pm2 startup
pm2 save

echo ""
echo "======================================"
echo "  部署完成！"
echo "======================================"
echo ""
echo "服务已启动：http://localhost:3000"
echo ""
echo "常用命令："
echo "  pm2 status           - 查看状态"
echo "  pm2 logs             - 查看日志"
echo "  pm2 restart          - 重启服务"
echo "  pm2 stop             - 停止服务"
echo ""
