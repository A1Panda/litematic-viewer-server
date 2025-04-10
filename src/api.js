// Litematic Viewer API Service
const { vec3, mat4 } = glMatrix;

class LitematicViewerAPI {
    constructor() {
        this.structureLitematic = null;
        this.viewer = null;
        this.canvas = null;
        this.webglContext = null;
        this.cameraPos = vec3.create();
        this.cameraPitch = 0.8;
        this.cameraYaw = 0.5;
        this.isManualPosition = false; // 添加标记，用于判断是否手动设置过相机位置
    }

    /**
     * 从文件加载 Litematic 数据
     * @param {File} file - Litematic 文件
     * @returns {Promise<Object>} - 加载的 Litematic 数据
     */
    async loadFromFile(file) {
        if (!deepslateResources) {
            throw new Error('Deepslate resources not initialized');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const nbtData = deepslate.readNbt(new Uint8Array(event.target.result));
                    this.structureLitematic = readLitematicFromNBTData(nbtData);
                    resolve(this.structureLitematic);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 从 URL 加载 Litematic 数据
     * @param {string} url - Litematic 文件的 URL
     * @returns {Promise<Object>} - 加载的 Litematic 数据
     */
    async loadFromURL(url) {
        if (!deepslateResources) {
            throw new Error('Deepslate resources not initialized');
        }

        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch file from URL');
        }

        const blob = await response.blob();
        return this.loadFromFile(blob);
    }

    /**
     * 获取方块统计信息
     * @returns {Object} - 方块统计信息
     */
    getMaterialList() {
        if (!this.structureLitematic) {
            throw new Error('No litematic data loaded');
        }
        return getMaterialList(this.structureLitematic);
    }

    /**
     * 设置查看器视图范围
     * @param {number} yMin - Y轴最小值
     * @param {number} yMax - Y轴最大值
     */
    setViewRange(yMin, yMax) {
        if (!this.structureLitematic) {
            throw new Error('No litematic data loaded');
        }
        setStructure(structureFromLitematic(this.structureLitematic, yMin, yMax));
    }

    /**
     * 初始化查看器
     * @param {HTMLElement} container - 查看器容器元素
     */
    initViewer(container) {
        if (!deepslateResources) {
            throw new Error('Deepslate resources not initialized');
        }

        // 创建查看器容器
        const viewer = document.createElement('div');
        viewer.id = 'viewer';
        viewer.style.width = '100%';
        viewer.style.height = '100%';
        container.appendChild(viewer);

        // 创建渲染画布
        createRenderCanvas();

        return true;
    }

    /**
     * 导出材料列表为 CSV
     * @returns {string} - CSV 格式的材料列表
     */
    exportMaterialListCSV() {
        const blockCounts = this.getMaterialList();
        return Object.entries(blockCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([key, val]) => `${key},${val}`)
            .join('\n');
    }

    /**
     * 设置相机位置和角度
     * @param {Object} options - 相机选项
     * @param {Array<number>} options.position - 相机位置 [x, y, z]
     * @param {number} options.pitch - 俯仰角（弧度）
     * @param {number} options.yaw - 偏航角（弧度）
     */
    setCameraPosition(options = {}) {
        const { position, pitch, yaw } = options;
        
        // 更新实例状态
        if (position && position.length === 3) {
            vec3.set(this.cameraPos, position[0], position[1], position[2]);
            // 同步更新全局状态
            if (window.cameraPos) {
                vec3.set(window.cameraPos, position[0], position[1], position[2]);
            }
            this.isManualPosition = true; // 标记为手动设置位置
        }
        
        if (typeof pitch === 'number') {
            this.cameraPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            // 同步更新全局状态
            if (window.cameraPitch !== undefined) {
                window.cameraPitch = this.cameraPitch;
            }
        }
        
        if (typeof yaw === 'number') {
            this.cameraYaw = yaw % (Math.PI * 2);
            // 同步更新全局状态
            if (window.cameraYaw !== undefined) {
                window.cameraYaw = this.cameraYaw;
            }
        }

        // 触发重新渲染
        if (window.render && typeof window.render === 'function') {
            requestAnimationFrame(window.render);
        }
    }

    /**
     * 获取当前相机位置和角度
     * @returns {Object} 相机位置和角度信息
     */
    getCameraPosition() {
        return {
            position: [this.cameraPos[0], this.cameraPos[1], this.cameraPos[2]],
            pitch: this.cameraPitch,
            yaw: this.cameraYaw
        };
    }

    /**
     * 渲染结构并返回图片
     * @param {Object} options - 渲染选项
     * @param {number} [options.width=800] - 图片宽度
     * @param {number} [options.height=600] - 图片高度
     * @param {number} [options.cameraPitch=0.8] - 相机俯仰角
     * @param {number} [options.cameraYaw=0.5] - 相机偏航角
     * @param {boolean} [options.autoPosition=true] - 是否自动定位
     * @param {boolean} [options.antialias=true] - 是否启用多重采样抗锯齿
     * @param {string} [options.quality='high'] - 渲染质量选项
     * @returns {Promise<string>} - 返回 base64 格式的图片数据
     */
    async renderToImage(options = {}) {
        if (!this.structureLitematic) {
            throw new Error('No litematic data loaded');
        }

        const {
            width = 800,
            height = 600,
            cameraPitch = this.cameraPitch,
            cameraYaw = this.cameraYaw,
            autoPosition = true,
            antialias = true,
            quality = 'high' // 新增：渲染质量选项
        } = options;

        console.log('开始渲染，参数:', { width, height, cameraPitch, cameraYaw, autoPosition, antialias, quality });

        // 清理旧的画布
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        // 创建新的画布
        this.canvas = document.createElement('canvas');
        document.body.appendChild(this.canvas);
        
        // 根据质量设置调整实际渲染分辨率
        let renderWidth = width;
        let renderHeight = height;
        if (quality === 'high') {
            renderWidth = width * 2;
            renderHeight = height * 2;
        } else if (quality === 'ultra') {
            renderWidth = width * 4;
            renderHeight = height * 4;
        }
        
        this.canvas.width = renderWidth;
        this.canvas.height = renderHeight;
        
        // 创建 WebGL 上下文，增加更多质量相关选项
        this.webglContext = this.canvas.getContext('webgl', {
            antialias: antialias,
            depth: true,
            preserveDrawingBuffer: true,
            alpha: true,
            stencil: true,
            premultipliedAlpha: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: 'high-performance',  // 优先使用高性能模式
            desynchronized: false,                // 禁用异步渲染以确保最高质量
            xrCompatible: false,                  // 禁用XR兼容性以提高性能
            preserveDrawingBuffer: true,          // 保留绘图缓冲区
            alpha: true,                          // 启用alpha通道
            depth: true,                          // 启用深度测试
            stencil: true,                        // 启用模板测试
            antialias: true,                      // 启用抗锯齿
            premultipliedAlpha: true,             // 启用预乘alpha
            failIfMajorPerformanceCaveat: false   // 即使性能较低也继续
        });

        if (!this.webglContext) {
            throw new Error('无法创建 WebGL 上下文');
        }

        // 设置 WebGL 状态
        this.webglContext.viewport(0, 0, renderWidth, renderHeight);
        this.webglContext.clearColor(0.9, 0.9, 0.9, 1.0);
        this.webglContext.clear(this.webglContext.COLOR_BUFFER_BIT | this.webglContext.DEPTH_BUFFER_BIT);
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
        this.webglContext.enable(this.webglContext.CULL_FACE);
        
        // 启用多重采样抗锯齿
        if (antialias) {
            this.webglContext.enable(this.webglContext.SAMPLE_COVERAGE);
            this.webglContext.sampleCoverage(1.0, false);
        }

        // 设置纹理过滤质量
        this.webglContext.texParameteri(this.webglContext.TEXTURE_2D, this.webglContext.TEXTURE_MIN_FILTER, this.webglContext.LINEAR_MIPMAP_LINEAR);
        this.webglContext.texParameteri(this.webglContext.TEXTURE_2D, this.webglContext.TEXTURE_MAG_FILTER, this.webglContext.LINEAR);

        try {
            // 创建结构
            const structure = structureFromLitematic(this.structureLitematic);
            const size = structure.getSize();
            console.log('结构大小:', size);
            console.log('结构坐标范围:');
            console.log('X: 0 ->', size[0]);
            console.log('Y: 0 ->', size[1]);
            console.log('Z: 0 ->', size[2]);

            // 创建渲染器，增加更多渲染选项
            const renderer = new deepslate.StructureRenderer(
                this.webglContext, 
                structure,
                deepslateResources,
                {
                    // 基础渲染设置
                    chunkSize: 8,                       // 区块大小,影响渲染性能
                    
                    // 光照和阴影
                    enableShadows: true,                // 启用阴影渲染
                    enableAmbientOcclusion: true,       // 启用环境光遮蔽
                    
                    // 纹理和质量设置
                    textureQuality: quality,            // 纹理质量设置
                    
                    // 大气效果
                    enableFog: true,                    // 启用雾效果
                    fogDensity: 0.01,                   // 雾的密度
                    
                    // 后期处理效果
                    enableBloom: true,                  // 启用泛光效果
                    bloomIntensity: 0.5,                // 泛光强度
                    enableSSAO: true,                   // 启用屏幕空间环境光遮蔽
                    ssaoRadius: 0.5,                    // SSAO采样半径
                    enableFXAA: true,                   // 启用快速近似抗锯齿
                    enableTAA: true,                    // 启用时间性抗锯齿
                    enableMotionBlur: false,            // 禁用动态模糊
                    enableDepthOfField: false,          // 禁用景深效果
                    
                    // 透明材质优化
                    transparentSorting: true,           // 启用透明材质排序
                    transparentDepthWrite: false,       // 禁用透明材质的深度写入
                    transparentBlending: 'normal',      // 使用标准混合模式
                    transparentAlphaTest: 0.1,          // 设置透明测试阈值
                    transparentRefraction: true,        // 启用折射效果
                    transparentRefractionIndex: 1.5,    // 设置折射率（玻璃的折射率）
                    transparentReflection: true,        // 启用反射效果
                    transparentReflectionStrength: 0.8, // 设置反射强度
                    transparentFresnel: true,           // 启用菲涅尔效应
                    transparentFresnelBias: 0.1,        // 设置菲涅尔偏差
                    transparentFresnelScale: 1.0,       // 设置菲涅尔缩放
                    transparentFresnelPower: 2.0        // 设置菲涅尔幂次
                }
            );

            // 设置WebGL混合模式
            this.webglContext.enable(this.webglContext.BLEND);
            this.webglContext.blendFuncSeparate(
                this.webglContext.SRC_ALPHA,
                this.webglContext.ONE_MINUS_SRC_ALPHA,
                this.webglContext.ONE,
                this.webglContext.ONE_MINUS_SRC_ALPHA
            );

            // 更新全局相机状态
            if (window.cameraPitch !== undefined) {
                window.cameraPitch = cameraPitch;
            }
            if (window.cameraYaw !== undefined) {
                window.cameraYaw = cameraYaw;
            }
            
            // 如果是自动定位且未手动设置位置，计算最佳相机位置
            if (autoPosition && !this.isManualPosition) {
                // 计算相机位置
                // 使用参考结构 (9x9x16) 的比例来计算
                const refX = 9, refY = 9, refZ = 16;
                const refCamY = -15, refCamZ = -20;
                
                // 根据结构大小计算缩放比例
                const scaleY = size[1] / refY;
                const scaleZ = size[2] / refZ;
                
                // 计算相机位置
                const cameraX = 0;  // 保持在中心线上
                const cameraY = refCamY * scaleY;  // 根据高度缩放Y轴位置
                const cameraZ = refCamZ * scaleZ;  // 根据深度缩放Z轴位置
                
                if (window.cameraPos) {
                    vec3.set(window.cameraPos, cameraX, cameraY, cameraZ);
                    console.log('自动计算的相机位置:', [cameraX, cameraY, cameraZ]);
                }
                
                // 同时更新实例的相机位置
                vec3.set(this.cameraPos, cameraX, cameraY, cameraZ);
            } else {
                console.log('使用当前相机位置:', [this.cameraPos[0], this.cameraPos[1], this.cameraPos[2]]);
            }

            // 创建视图矩阵
            const view = mat4.create();
            
            // 应用相机变换
            mat4.rotateX(view, view, cameraPitch);
            mat4.rotateY(view, view, cameraYaw);
            mat4.translate(view, view, this.cameraPos);

            // 渲染结构和网格
            renderer.drawStructure(view);
            renderer.drawGrid(view);

            // 渲染完成后，如果使用了高质量渲染，需要将图像缩放到目标尺寸
            let finalImageData;
            if (quality !== 'normal') {
                // 创建临时画布用于缩放
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // 使用高质量缩放
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';
                tempCtx.drawImage(this.canvas, 0, 0, width, height);
                
                finalImageData = tempCanvas.toDataURL('image/png');
            } else {
                finalImageData = this.canvas.toDataURL('image/png');
            }
            
            // 清理资源
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
            this.canvas = null;
            this.webglContext = null;

            return finalImageData;

        } catch (error) {
            console.error('渲染错误:', error);
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
            this.canvas = null;
            this.webglContext = null;
            throw error;
        }
    }

    /**
     * 渲染三视图（正视图、侧视图、俯视图）
     * @param {Object} options - 渲染选项
     * @param {number} [options.width=800] - 单个视图的宽度
     * @param {number} [options.height=600] - 单个视图的高度
     * @returns {Promise<Object>} - 返回包含三个视图的 base64 图片数据
     */
    async renderThreeViews(options = {}) {
        if (!this.structureLitematic) {
            throw new Error('没有加载 litematic 数据');
        }

        const {
            width = 800,
            height = 600
        } = options;

        // 保存当前相机状态
        const originalPos = vec3.clone(this.cameraPos);
        const originalPitch = this.cameraPitch;
        const originalYaw = this.cameraYaw;

        try {
            // 创建结构
            const structure = structureFromLitematic(this.structureLitematic);
            const size = structure.getSize();
            console.log('结构大小:', size);

            // 计算结构中心点
            const centerX = size[0] / 2;
            const centerY = size[1] / 2;
            const centerZ = size[2] / 2;

            // 计算合适的观察距离
            const maxDimension = Math.max(size[0], size[1], size[2]);
            const distance = maxDimension * 2;  // 基础观察距离

            // 渲染正视图 (正面)
            this.cameraPitch = 0;
            this.cameraYaw = 0;
            vec3.set(this.cameraPos, 
                -centerX,           // X轴对齐中心
                -centerY,           // Y轴对齐中心
                -distance/1.8 - centerZ // Z轴在结构前方,距离减半使视角更近
            );
            const frontView = await this.renderToImage({
                width,
                height,
                cameraPitch: this.cameraPitch,
                cameraYaw: this.cameraYaw,
                autoPosition: false
            });

            // 渲染侧视图 (右侧)
            this.cameraPitch = 0;
            this.cameraYaw = -Math.PI / 2;
            vec3.set(this.cameraPos, 
                -distance/1.8 - centerX, // X轴在结构右侧,距离减半使视角更近
                -centerY,           // Y轴对齐中心
                -centerZ,           // Z轴对齐中心
            );
            const sideView = await this.renderToImage({
                width,
                height,
                cameraPitch: this.cameraPitch,
                cameraYaw: this.cameraYaw,
                autoPosition: false
            });

            // 渲染俯视图 (顶部)
            this.cameraPitch = Math.PI / 2; // 相机向下看
            this.cameraYaw = 0;
            vec3.set(this.cameraPos, 
                -centerX,                  // X轴对齐中心
                -distance/1.8 - centerY,   // Y轴在结构上方,距离减半使视角更近
                -centerZ                   // Z轴对齐中心
            );
            const topView = await this.renderToImage({
                width,
                height,
                cameraPitch: this.cameraPitch,
                cameraYaw: this.cameraYaw,
                autoPosition: false
            });

            // 恢复原始相机状态
            vec3.copy(this.cameraPos, originalPos);
            this.cameraPitch = originalPitch;
            this.cameraYaw = originalYaw;

            return {
                frontView,  // 正视图
                sideView,   // 侧视图
                topView     // 俯视图
            };

        } catch (error) {
            // 发生错误时也要恢复相机状态
            vec3.copy(this.cameraPos, originalPos);
            this.cameraPitch = originalPitch;
            this.cameraYaw = originalYaw;
            throw error;
        }
    }
}

// 创建并导出 API 实例
const litematicViewerAPI = new LitematicViewerAPI();
window.litematicViewerAPI = litematicViewerAPI; // 确保在全局作用域中可用 