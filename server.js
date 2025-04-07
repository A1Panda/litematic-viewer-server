const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // 获取请求的URL路径
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './api-debug.html';
    }

    // 获取文件扩展名
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    // 根据文件扩展名设置Content-Type
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

    // 读取文件
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                // 文件不存在
                res.writeHead(404);
                res.end('文件未找到');
            } else {
                // 服务器错误
                res.writeHead(500);
                res.end('服务器错误: ' + error.code);
            }
        } else {
            // 成功响应
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}/`);
}); 