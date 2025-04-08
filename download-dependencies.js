const axios = require('axios');
const fs = require('fs');
const path = require('path');

const dependencies = {
    'deepslate.js': 'https://cdn.jsdelivr.net/npm/deepslate@0.10.1/dist/deepslate.umd.js',
    'gl-matrix-min.js': 'https://unpkg.com/gl-matrix@3.4.3/gl-matrix-min.js'
};

const dependenciesDir = path.join(__dirname, 'dependencies');

if (!fs.existsSync(dependenciesDir)) {
    fs.mkdirSync(dependenciesDir, { recursive: true });
}

async function downloadFile(url, filename) {
    try {
        console.log(`开始下载: ${filename} (${url})`);
        const response = await axios.get(url, {
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        fs.writeFileSync(path.join(dependenciesDir, filename), response.data);
        console.log(`下载完成: ${filename}`);
    } catch (error) {
        console.error(`下载 ${filename} 失败:`, error.message);
        throw error;
    }
}

async function downloadAll() {
    console.log('开始下载依赖文件...');
    for (const [filename, url] of Object.entries(dependencies)) {
        try {
            await downloadFile(url, filename);
        } catch (error) {
            console.error(`下载 ${filename} 失败:`, error);
        }
    }
    console.log('所有依赖文件下载完成！');
}

downloadAll(); 