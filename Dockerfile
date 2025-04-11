FROM node:18-slim

# 设置工作目录
WORKDIR /app

# 安装依赖项
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    fonts-wqy-zenhei \
    fonts-noto-cjk \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# 创建一个非root用户运行应用
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# 设置环境变量
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_ARGS="--no-sandbox --disable-dev-shm-usage --disable-gpu --disable-setuid-sandbox --no-zygote"

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm install --production

# 复制项目文件到工作目录
COPY . .

# 创建必要的目录
RUN mkdir -p src/uploads src/outputs dependencies \
    && chown -R pptruser:pptruser src/uploads \
    && chown -R pptruser:pptruser src/outputs \
    && chown -R pptruser:pptruser dependencies

# 下载依赖文件
RUN node download-dependencies.js

# 添加容器启动时的健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 暴露端口
EXPOSE 3000

# 切换到非root用户
USER pptruser

# 启动服务器
CMD ["node", "server.js"]
