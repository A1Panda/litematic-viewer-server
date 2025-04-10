const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const formidable = require('formidable');
const LitematicProcessor = require('./src/headless-processor');

const processor = new LitematicProcessor();
let isInitialized = false;

// 清理目录
function cleanupDirectory(dirPath) {
    console.log(`清理目录: ${dirPath}`);
    
    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                // 删除目录及其内容
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log(`已删除目录: ${filePath}`);
            } else {
                // 删除文件
                fs.unlinkSync(filePath);
                console.log(`已删除文件: ${filePath}`);
            }
        }
    }
}

// 清理所有临时目录
function cleanupAll() {
    cleanupDirectory(processor.uploadDir);
    cleanupDirectory(processor.outputDir);
}

// 初始化处理器
async function initialize() {
    if (!isInitialized) {
        await processor.initialize();
        isInitialized = true;
    }
}

// 在服务器启动时清理所有临时目录
cleanupAll();

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API路由
    if (url.pathname === '/api/upload' && req.method === 'POST') {
        try {
            await initialize();

            const form = new formidable.IncomingForm();
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                    return;
                }

                const file = files.file;
                if (!file) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No file uploaded' }));
                    return;
                }

                const fileBuffer = fs.readFileSync(file.filepath);
                const result = await processor.processLitematic(fileBuffer, file.originalFilename);

                // 清理临时文件
                fs.unlinkSync(file.filepath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            });
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    } 
    // 文件下载路由
    else if (url.pathname.startsWith('/api/download/')) {
        try {
            const parts = url.pathname.split('/');
            const processId = parts[3];
            const filename = decodeURIComponent(parts[4]);
            
            // 构建正确的文件路径
            const filePath = path.join(processor.outputDir, processId, filename);

            console.log(`尝试下载文件: ${filePath}`);

            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                const contentType = getContentType(path.extname(filename));
                
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Content-Disposition': `attachment; filename=${encodeURIComponent(filename)}`
                });
                
                const fileStream = fs.createReadStream(filePath);
                fileStream.pipe(res);
                
                fileStream.on('error', (error) => {
                    console.error('文件流错误:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File stream error' }));
                });
            } else {
                console.error('文件不存在:', filePath);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'File not found' }));
            }
        } catch (error) {
            console.error('下载处理错误:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    }
    // 静态文件服务
    else {
        let filePath = '.' + url.pathname;
        if (filePath === './') {
            filePath = './api-debug.html';
        }

        const extname = path.extname(filePath);
        let contentType = 'text/html';
        
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.json':
                contentType = 'application/json';
                break;
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if(error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('文件未找到');
                } else {
                    res.writeHead(500);
                    res.end('服务器错误: ' + error.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

// 获取文件内容类型
function getContentType(extname) {
    switch (extname.toLowerCase()) {
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.json':
            return 'application/json';
        case '.litematic':
            return 'application/octet-stream';
        default:
            return 'application/octet-stream';
    }
}

// 清理函数
process.on('SIGINT', async () => {
    await processor.cleanup();
    process.exit();
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}/`);
}); 