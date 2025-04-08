const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pako = require('pako');

class LitematicProcessor {
    constructor() {
        console.log('初始化 LitematicProcessor...');
        this.browser = null;
        this.page = null;
        this.uploadDir = path.join(__dirname, 'uploads');
        this.outputDir = path.join(__dirname, 'outputs');
        this.dependenciesDir = path.join(__dirname, '..', 'dependencies');
        
        // 确保目录存在
        if (!fs.existsSync(this.uploadDir)) {
            console.log(`创建上传目录: ${this.uploadDir}`);
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
        if (!fs.existsSync(this.outputDir)) {
            console.log(`创建输出目录: ${this.outputDir}`);
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        if (!fs.existsSync(this.dependenciesDir)) {
            console.log(`创建依赖目录: ${this.dependenciesDir}`);
            fs.mkdirSync(this.dependenciesDir, { recursive: true });
        }
    }

    async initialize() {
        console.log('开始初始化浏览器...');
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('浏览器启动成功');
            
            this.page = await this.browser.newPage();
            console.log('新页面创建成功');
            
            // 加载必要的脚本
            console.log('开始加载依赖脚本...');
            
            // 首先加载核心依赖
            console.log('加载核心依赖...');
            try {
                await this.page.addScriptTag({ path: path.join(this.dependenciesDir, 'gl-matrix-min.js') });
                console.log('gl-matrix 加载完成');
                
                await this.page.addScriptTag({ path: path.join(this.dependenciesDir, 'deepslate.js') });
                console.log('deepslate 加载完成');

                // 加载 pako 库
                await this.page.addScriptTag({ path: path.join(__dirname, '..', 'node_modules', 'pako', 'dist', 'pako.min.js') });
                console.log('pako 加载完成');
                
                // 等待核心依赖初始化
                console.log('等待核心依赖初始化...');
                await this.page.evaluate(() => {
                    return new Promise((resolve, reject) => {
                        console.log('检查核心依赖状态...');
                        console.log('glMatrix:', !!window.glMatrix);
                        console.log('deepslate:', !!window.deepslate);
                        console.log('pako:', !!window.pako);
                        
                        if (window.glMatrix && window.deepslate && window.pako) {
                            console.log('核心依赖已初始化');
                            resolve();
                        } else {
                            let attempts = 0;
                            const maxAttempts = 50;
                            const checkInterval = setInterval(() => {
                                attempts++;
                                console.log(`检查核心依赖状态 (尝试 ${attempts}/${maxAttempts})...`);
                                console.log('glMatrix:', !!window.glMatrix);
                                console.log('deepslate:', !!window.deepslate);
                                console.log('pako:', !!window.pako);
                                
                                if (window.glMatrix && window.deepslate && window.pako) {
                                    console.log('核心依赖已初始化');
                                    clearInterval(checkInterval);
                                    resolve();
                                } else if (attempts >= maxAttempts) {
                                    console.log('核心依赖初始化超时');
                                    clearInterval(checkInterval);
                                    reject(new Error('核心依赖初始化超时'));
                                }
                            }, 100);
                        }
                    });
                });
                console.log('核心依赖初始化完成');
            } catch (error) {
                console.error('核心依赖加载失败:', error);
                throw error;
            }
            
            // 然后加载其他脚本
            console.log('加载其他脚本...');
            const scripts = [
                { name: 'assets.js', path: path.join(__dirname, '..', 'resource', 'assets.js') },
                { name: 'opaque.js', path: path.join(__dirname, '..', 'resource', 'opaque.js') },
                { name: 'deepslate-helpers.js', path: path.join(__dirname, 'deepslate-helpers.js') },
                { name: 'litematic-utils.js', path: path.join(__dirname, 'litematic-utils.js') },
                { name: 'api.js', path: path.join(__dirname, 'api.js') }
            ];

            for (const script of scripts) {
                console.log(`加载脚本: ${script.name}`);
                await this.page.addScriptTag({ path: script.path });
                console.log(`脚本加载完成: ${script.name}`);
            }

            // 等待 API 初始化
            console.log('等待 API 初始化...');
            await this.page.evaluate(() => {
                return new Promise((resolve, reject) => {
                    console.log('开始检查 API 状态...');
                    let attempts = 0;
                    const maxAttempts = 50; // 最多等待 5 秒
                    
                    const checkAPI = () => {
                        attempts++;
                        console.log(`检查 API 状态 (尝试 ${attempts}/${maxAttempts})...`);
                        console.log('当前全局对象:', {
                            glMatrix: !!window.glMatrix,
                            deepslate: !!window.deepslate,
                            pako: !!window.pako,
                            litematicViewerAPI: !!window.litematicViewerAPI
                        });
                        
                        if (window.litematicViewerAPI) {
                            console.log('API 已初始化完成');
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            console.log('API 初始化超时');
                            reject(new Error('API 初始化超时'));
                        } else {
                            setTimeout(checkAPI, 100);
                        }
                    };
                    
                    checkAPI();
                });
            });
            console.log('初始化完成');
        } catch (error) {
            console.error('核心依赖加载失败:', error);
            throw error;
        }
    }

    async processLitematic(fileBuffer, originalFilename) {
        console.log('开始处理 Litematic 文件...');
        try {
            // 生成唯一ID
            const processId = uuidv4();
            console.log(`生成处理ID: ${processId}`);
            
            // 使用原始文件名（不含扩展名）作为输出目录名
            const baseName = path.basename(originalFilename, '.litematic');
            const uploadPath = path.join(this.uploadDir, `${baseName}_${processId}.litematic`);
            const outputPath = path.join(this.outputDir, `${baseName}_${processId}`);
            
            // 保存上传的文件
            console.log(`保存上传文件到: ${uploadPath}`);
            fs.writeFileSync(uploadPath, fileBuffer);
            
            // 创建输出目录
            if (!fs.existsSync(outputPath)) {
                console.log(`创建输出目录: ${outputPath}`);
                fs.mkdirSync(outputPath, { recursive: true });
            }

            // 等待资源加载
            console.log('等待资源加载...');
            const atlasPath = path.join(__dirname, '..', 'resource', 'atlas.png');
            console.log(`纹理图集路径: ${atlasPath}`);
            
            // 读取纹理图集文件
            const atlasData = fs.readFileSync(atlasPath);
            const atlasBase64 = atlasData.toString('base64');
            const atlasDataUrl = `data:image/png;base64,${atlasBase64}`;
            
            await this.page.evaluate(async (dataUrl) => {
                return new Promise((resolve, reject) => {
                    console.log('开始加载纹理图集...');
                    const image = new Image();
                    let attempts = 0;
                    const maxAttempts = 50; // 最多等待 5 秒
                    
                    image.onload = () => {
                        console.log('纹理图集加载完成');
                        try {
                            loadDeepslateResources(image);
                            console.log('Deepslate 资源初始化完成');
                            resolve();
                        } catch (error) {
                            console.error('Deepslate 资源初始化失败:', error);
                            reject(error);
                        }
                    };
                    
                    image.onerror = (error) => {
                        console.error('纹理图集加载失败:', error);
                        reject(new Error('纹理图集加载失败'));
                    };
                    
                    // 设置超时检查
                    const checkTimeout = () => {
                        attempts++;
                        console.log(`检查资源加载状态 (尝试 ${attempts}/${maxAttempts})...`);
                        
                        if (attempts >= maxAttempts) {
                            console.log('资源加载超时');
                            reject(new Error('资源加载超时'));
                        } else {
                            setTimeout(checkTimeout, 100);
                        }
                    };
                    
                    console.log('设置纹理图集源为 base64 数据');
                    image.src = dataUrl;
                    checkTimeout();
                });
            }, atlasDataUrl);

            // 加载文件
            console.log('开始加载 Litematic 文件...');
            const arrayBuffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset,
                fileBuffer.byteOffset + fileBuffer.byteLength
            );
            console.log('文件大小:', arrayBuffer.byteLength);
            console.log('文件头:', Array.from(new Uint8Array(arrayBuffer, 0, 4)));
            
            await this.page.evaluate(async (bufferData) => {
                console.log('正在加载文件数据...');
                try {
                    // 将序列化的数据转换回 ArrayBuffer
                    const buffer = new Uint8Array(bufferData).buffer;
                    console.log('浏览器端文件大小:', buffer.byteLength);
                    console.log('浏览器端文件头:', Array.from(new Uint8Array(buffer, 0, 4)));
                    
                    // 验证文件大小
                    if (buffer.byteLength === 0) {
                        throw new Error('文件为空');
                    }

                    // 解压缩 gzip 数据
                    const compressedData = new Uint8Array(buffer);
                    console.log('压缩数据大小:', compressedData.length);
                    console.log('压缩数据头:', Array.from(compressedData.slice(0, 4)));
                    
                    const decompressed = pako.inflate(compressedData);
                    console.log('解压缩后数据大小:', decompressed.length);
                    console.log('解压缩后数据头:', Array.from(decompressed.slice(0, 4)));

                    // 验证解压缩后的文件头
                    const header = decompressed.slice(0, 4);
                    const validHeader = new Uint8Array([0x0A, 0x00, 0x00, 0x00]); // NBT 文件头
                    console.log('实际文件头:', Array.from(header));
                    console.log('期望文件头:', Array.from(validHeader));
                    
                    if (!header.every((byte, i) => byte === validHeader[i])) {
                        console.log('文件头不匹配，尝试直接加载...');
                        // 如果文件头不匹配，尝试直接加载
                        const file = new File([decompressed], 'input.litematic');
                        await litematicViewerAPI.loadFromFile(file);
                    } else {
                        const file = new File([decompressed], 'input.litematic');
                        await litematicViewerAPI.loadFromFile(file);
                    }
                    console.log('文件加载完成');
                } catch (error) {
                    console.error('文件加载失败:', error);
                    throw error;
                }
            }, Array.from(new Uint8Array(arrayBuffer)));

            // 生成三视图
            console.log('开始生成三视图...');
            const views = await this.page.evaluate(async () => {
                console.log('调用 renderThreeViews');
                const result = await litematicViewerAPI.renderThreeViews({
                    width: 1920,
                    height: 1080,
                    quality: 'high'
                });
                console.log('三视图生成完成');
                return result;
            });

            // 保存三视图
            console.log('保存三视图...');
            for (const [viewName, imageData] of Object.entries(views)) {
                const outputFile = path.join(outputPath, `${baseName}_${viewName}.png`);
                console.log(`保存视图: ${outputFile}`);
                const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(outputFile, Buffer.from(base64Data, 'base64'));
            }

            // 生成材料列表
            console.log('生成材料列表...');
            const materialList = await this.page.evaluate(() => {
                console.log('调用 getMaterialList');
                return litematicViewerAPI.getMaterialList();
            });

            // 保存材料列表
            const materialsFile = path.join(outputPath, `${baseName}_materials.json`);
            console.log(`保存材料列表到: ${materialsFile}`);
            fs.writeFileSync(materialsFile, JSON.stringify(materialList, null, 2));

            // 复制原始文件到输出目录
            const originalFile = path.join(outputPath, `${baseName}.litematic`);
            console.log(`复制原始文件到: ${originalFile}`);
            fs.copyFileSync(uploadPath, originalFile);

            console.log('处理完成');
            return {
                success: true,
                processId: processId,
                views: [`${baseName}_frontView.png`, `${baseName}_sideView.png`, `${baseName}_topView.png`],
                materials: `${baseName}_materials.json`,
                original: `${baseName}.litematic`
            };

        } catch (error) {
            console.error('处理过程中发生错误:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cleanup() {
        console.log('开始清理资源...');
        if (this.browser) {
            console.log('关闭浏览器...');
            await this.browser.close();
            console.log('浏览器已关闭');
        }
    }
}

module.exports = LitematicProcessor; 