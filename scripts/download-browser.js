const { install } = require('@puppeteer/browsers');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getPlatformInfo() {
    const platform = os.platform();
    const arch = os.arch();
    
    // 确定平台类型
    let browserPlatform;
    let executableName;
    
    switch (platform) {
        case 'win32':
            browserPlatform = arch === 'x64' ? 'win64' : 'win32';
            executableName = 'chrome.exe';
            break;
        case 'linux':
            browserPlatform = arch === 'x64' ? 'linux' : 'linux-arm64';
            executableName = 'chrome';
            break;
        case 'darwin': // macOS
            browserPlatform = arch === 'x64' ? 'mac' : 'mac-arm64';
            executableName = 'chrome';
            break;
        default:
            throw new Error(`不支持的操作系统: ${platform}`);
    }
    
    return { browserPlatform, executableName };
}

async function downloadBrowser() {
    console.log('开始下载Chrome浏览器...');
    console.log('系统信息:', {
        平台: os.platform(),
        架构: os.arch(),
        版本: os.release()
    });
    
    // 获取平台信息
    const { browserPlatform, executableName } = getPlatformInfo();
    console.log('目标平台:', browserPlatform);
    
    // 确保目录存在
    const browserDir = path.join(__dirname, '..', 'browsers', 'chrome');
    if (!fs.existsSync(browserDir)) {
        fs.mkdirSync(browserDir, { recursive: true });
    }

    try {
        // 下载浏览器
        const result = await install({
            cacheDir: browserDir,
            browser: 'chrome',
            buildId: '135.0.7049.42',
            platform: browserPlatform
        });

        console.log('浏览器下载完成:', result);
        
        // 复制浏览器到目标目录
        console.log('复制浏览器到目标目录...');
        const targetDir = path.join(__dirname, '..', 'browsers', 'chrome');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 在Linux上，我们需要复制整个chrome-linux64目录
        if (os.platform() === 'linux') {
            const chromeDir = path.join(browserDir, 'chrome', 'linux-135.0.7049.42', 'chrome-linux64');
            const targetDir = path.join(browserDir, 'chrome-linux64');
            
            // 如果目标目录已存在，先删除
            if (fs.existsSync(targetDir)) {
                console.log('删除旧的浏览器目录...');
                fs.rmSync(targetDir, { recursive: true, force: true });
            }
            
            // 复制整个目录
            console.log(`复制Chrome目录从 ${chromeDir} 到 ${targetDir}`);
            fs.cpSync(chromeDir, targetDir, { recursive: true });
            
            // 设置可执行权限
            const chromePath = path.join(targetDir, 'chrome');
            fs.chmodSync(chromePath, '755');
            
            // 设置所有文件的权限
            const setPermissions = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        setPermissions(filePath);
                    } else {
                        fs.chmodSync(filePath, '644');
                    }
                }
            };
            
            setPermissions(targetDir);
            
            console.log('Chrome安装完成');
            console.log('可执行文件路径:', chromePath);
            
            // 验证文件是否存在和可访问
            try {
                const stats = fs.statSync(chromePath);
                console.log('Chrome可执行文件状态:', {
                    大小: stats.size,
                    权限: stats.mode,
                    创建时间: stats.birthtime,
                    修改时间: stats.mtime
                });
            } catch (error) {
                console.error('无法访问Chrome可执行文件:', error);
                throw error;
            }
        } else {
            // Windows/macOS的处理保持不变
            const targetPath = path.join(targetDir, executableName);
            fs.copyFileSync(result.executablePath, targetPath);
            console.log('浏览器已复制到:', targetPath);
        }
        
    } catch (error) {
        console.error('下载浏览器失败:', error);
        process.exit(1);
    }
}

downloadBrowser(); 