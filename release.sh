#!/bin/bash
# 打包发布脚本
# 使用方法：./release.sh

VERSION=${1:-$(date +%Y%m%d)}
PACKAGE_NAME="ppt-speech-generator-v${VERSION}"
DIST_DIR="./release/${PACKAGE_NAME}"

echo "======================================"
echo "  打包发布 v${VERSION}"
echo "======================================"

# 清理旧的发布包
rm -rf ./release/${PACKAGE_NAME}*

# 创建发布目录
mkdir -p ${DIST_DIR}

# 复制文件（排除不必要的）
echo "正在复制文件..."
rsync -av \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='uploads' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='release' \
  ./ ${DIST_DIR}/

# 创建 tar.gz 包
echo "正在创建压缩包..."
cd ./release
tar -czf ${PACKAGE_NAME}.tar.gz ${PACKAGE_NAME}
cd ..

echo ""
echo "======================================"
echo "  打包完成！"
echo "======================================"
echo ""
echo "发布包位置：./release/${PACKAGE_NAME}.tar.gz"
echo ""
echo "部署步骤："
echo "  1. 上传 ${PACKAGE_NAME}.tar.gz 到服务器"
echo "  2. 解压：tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "  3. 进入目录：cd ${PACKAGE_NAME}"
echo "  4. 安装依赖：npm install"
echo "  5. 配置环境：cp .env.example .env (编辑 API Key)"
echo "  6. 编译：npm run build"
echo "  7. 启动：pm2 start ecosystem.config.cjs"
echo ""
