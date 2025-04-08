const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const formidable = require('formidable');
const LitematicProcessor = require('./src/headless-processor');

const processor = new LitematicProcessor();
let isInitialized = false;

// 初始化处理器
async function initialize() {
    if (!isInitialized) {
        await processor.initialize();
        isInitialized = true;
    }
}

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
        const processId = url.pathname.split('/')[3];
        const filename = url.pathname.split('/')[4];
        const filePath = path.join(processor.outputDir, processId, filename);

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': stat.size,
                'Content-Disposition': `attachment; filename=${filename}`
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'File not found' }));
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

// 清理函数
process.on('SIGINT', async () => {
    await processor.cleanup();
    process.exit();
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}/`);
}); 