# Litematic Viewer Server

这是一个基于 Node.js 的服务器端 Litematic 文件查看器，可以处理和预览 Minecraft Litematic 文件。它提供了文件上传、预览图生成、材料列表导出等功能。

## 功能特性

- 支持上传和预览 Litematic 文件
- 自动生成三视图（正视图、侧视图、俯视图）
- 导出材料列表（JSON 格式）
- 提供原始文件下载
- 支持大文件处理
- 基于 DeepSlate 的渲染引擎

## 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/A1Panda/litematic-viewer-server.git
cd litematic-viewer-server
```

2. 安装依赖
```bash
npm install
```

3. 调整目录权限
```bash
# 确保上传和输出目录有正确的权限
sudo chmod -R 777 ./src/uploads ./src/outputs
```

4. 启动服务器
```bash
npm start
```

## Docker 部署

提供了使用 Docker 快速部署 Litematic Viewer Server 的方法

### 前提条件

- 安装 [Docker](https://docs.docker.com/get-docker/)
- 安装 [Docker Compose](https://docs.docker.com/compose/install/)（可选，用于更简单的部署）

### 构建 Docker 镜像

在项目根目录执行以下命令构建 Docker 镜像：

```bash
docker build -t litematic-viewer-server .
```

### 运行 Docker 容器

#### 使用 Docker 命令运行

```bash
docker run -d --name litematic-viewer -p 3000:3000 litematic-viewer-server
```

#### 使用 Docker Compose 运行（推荐）

创建 `docker-compose.yml` 文件：

```yaml
version: '3'
services:
  litematic-viewer:
    build: .
    container_name: litematic-viewer
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

然后运行：

```bash
docker-compose up -d
```

## 访问服务

服务启动后，可以通过以下地址访问：

- 网页界面：http://localhost:3000/
- API调试页面：http://localhost:3000/api-debug.html
- API示例页面：http://localhost:3000/api-example.html

### 注意事项

1. Docker 容器内使用了非 root 用户 `pptruser` 来运行 Chromium，这是出于安全考虑。
2. 如果遇到权限问题，可能需要调整容器内文件的所有权。
3. 该应用程序在容器内使用 Chromium 无头浏览器进行渲染，确保服务器有足够的资源。

### 疑难解答

#### 容器无法启动
  
  检查日志：
  ```bash
  docker logs litematic-viewer
  ```

#### Chromium 无法启动

  可能原因是资源限制或权限问题。尝试增加容器资源限制：
  ```bash
  docker run -d --name litematic-viewer -p 3000:3000 --shm-size=1gb litematic-viewer-server
  ```

#### 文件上传失败

  检查容器内的权限：
  ```bash
  docker exec -it litematic-viewer bash
  ls -la src/uploads
  ``` 

服务器将在 http://localhost:3000 启动。

## API 使用说明

### 1. 上传并处理 Litematic 文件

**请求**
- 方法：`POST`
- 路径：`/api/upload`
- 内容类型：`multipart/form-data`
- 参数：
  - `file`: Litematic 文件

**响应**
```json
{
    "success": true,
    "processId": "uuid-string",
    "views": [
        "filename_frontView.png",
        "filename_sideView.png",
        "filename_topView.png"
    ],
    "materials": "filename_materials.json",
    "original": "filename.litematic"
}
```

### 2. 下载处理结果

**请求**
- 方法：`GET`
- 路径：`/api/download/{processId}/{filename}`
- 参数：
  - `processId`: 处理ID
  - `filename`: 文件名（包括扩展名）

## 使用示例

### 1. 使用 Fetch API 上传文件

```javascript
async function uploadLitematic(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('处理成功:', result);
        } else {
            console.error('处理失败:', result.error);
        }
    } catch (error) {
        console.error('上传失败:', error);
    }
}
```

### 2. 下载处理结果

```javascript
async function downloadFile(processId, filename) {
    try {
        const response = await fetch(`http://localhost:3000/api/download/${processId}/${filename}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
        }
    } catch (error) {
        console.error('下载失败:', error);
    }
}
```

## 注意事项

1. 文件大小限制：
   - 服务器默认没有设置文件大小限制
   - 建议上传的文件大小不要超过 100MB

2. 处理时间：
   - 处理时间取决于文件大小和复杂度
   - 大型文件可能需要较长时间处理

3. 文件命名：
   - 所有生成的文件都会包含原始文件名
   - 文件名格式：`{原始文件名}_{类型}.{扩展名}`

4. 浏览器兼容性：
   - 需要支持 Fetch API
   - 需要支持 FormData
   - 需要支持 Blob 和 URL.createObjectURL

## 已知限制

- 不支持多区域 Litematic 文件
- 不渲染实体
- 部分方块可能显示不正确
- 某些设置可能尚未实现

## 贡献

欢迎提交问题和改进建议！你可以：
- 在 GitHub 上创建 Issue
- 提交 Pull Request
- 创建自己的分支进行开发

## 致谢

- 感谢 [DeepSlate](https://github.com/misode/deepslate) 项目提供的渲染引擎
- 感谢所有贡献者和用户的支持

## 许可证

[MIT License](LICENSE)