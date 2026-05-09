App({
    globalData: {
        userInfo: null,
        openid: '',
        isBindAccount: false,
        /**
         * 后端 API 根地址（不要末尾斜杠）
         * - 真机请改成电脑局域网 IP，例如 http://192.168.1.100:8080
         * - 微信开发者工具：模拟器可继续使用 http://127.0.0.1:8080
         * - 外网：用 cloudflared/ngrok 等隧道地址替换
         */
        defaultApiBaseUrl: 'http://127.0.0.1:8080',
        apiBaseUrl: 'http://127.0.0.1:8080',
        /** 仓库内置默认局域网后端（换 Wi‑Fi 后请改成 ipconfig 里「WLAN」的 IPv4） */
        builtinLanApiBaseUrl: 'http://10.186.142.184:8080',
        localLanApiBaseUrl: 'http://10.186.142.184:8080',
        /** 已不再使用的旧默认 IP，启动时自动迁到 builtinLanApiBaseUrl */
        deprecatedLanIpv4s: ['10.18.102.19'],
        cloudEnv: 'smart-campus-prod',
        // AI 模型配置
        aiConfig: {
            modelName: 'smart-campus-v2',
            temperature: 0.7,
            maxTokens: 1000,
            stream: true
        },
        defaultCampusLocation: {
            latitude: 40.6205,
            longitude: 109.8309,
            name: '内蒙古科技大学（主校区）',
            address: '内蒙古自治区包头市昆都仑区阿尔丁大街7号'
        }
    },

    onLaunch() {
        this.loadApiBaseUrl();

        // 初始化云开发
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        } else {
            wx.cloud.init({
                env: this.globalData.cloudEnv,
                traceUser: true,
            });
        }

        // 检查登录状态
        this.checkLoginStatus();
    },

    normalizeApiBaseUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    },

    /** http://x.x.x.x 未写端口时默认补 :8080（与后端 uvicorn 一致） */
    ensureApiPortIfBareIpv4(url) {
        const u = this.normalizeApiBaseUrl(url);
        if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}$/i.test(u)) {
            return `${u}:8080`;
        }
        return u;
    },

    _extractIpv4FromHttpUrl(url) {
        const m = String(url).match(/^http:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?/i);
        return m ? m[1] : '';
    },

    /** 把缓存里已过时的演示局域网 IP 换成当前内置默认，避免一直连错误网段 */
    _migrateDeprecatedLanUrls(savedApiUrl, lanUrl) {
        const bad = this.globalData.deprecatedLanIpv4s || [];
        const builtin = this.ensureApiPortIfBareIpv4(
            this.normalizeApiBaseUrl(this.globalData.builtinLanApiBaseUrl || this.globalData.localLanApiBaseUrl)
        );
        let s = savedApiUrl;
        let l = lanUrl;
        const sip = this._extractIpv4FromHttpUrl(s);
        const lip = this._extractIpv4FromHttpUrl(l);
        let changed = false;
        if (sip && bad.indexOf(sip) !== -1) {
            s = builtin;
            wx.setStorageSync('apiBaseUrl', s);
            changed = true;
        }
        if (lip && bad.indexOf(lip) !== -1) {
            l = builtin;
            wx.setStorageSync('localLanApiBaseUrl', l);
            this.globalData.localLanApiBaseUrl = builtin;
            changed = true;
        }
        if (changed) {
            console.log('[Smart-Go] 已替换过时局域网 IP，请确认 builtin 与电脑 ipconfig 一致:', builtin);
        }
        return [s, l];
    },

    loadApiBaseUrl() {
        const savedUrl = wx.getStorageSync('apiBaseUrl');
        const savedLanUrl = wx.getStorageSync('localLanApiBaseUrl');
        let savedApiUrl = this.normalizeApiBaseUrl(savedUrl);
        let lanUrl = this.normalizeApiBaseUrl(savedLanUrl || this.globalData.localLanApiBaseUrl);
        const fixedSaved = this.ensureApiPortIfBareIpv4(savedApiUrl);
        const fixedLan = this.ensureApiPortIfBareIpv4(lanUrl);
        if (savedApiUrl && fixedSaved !== savedApiUrl) {
            wx.setStorageSync('apiBaseUrl', fixedSaved);
        }
        if (fixedLan !== lanUrl && (savedLanUrl || this.globalData.localLanApiBaseUrl)) {
            wx.setStorageSync('localLanApiBaseUrl', fixedLan);
            this.globalData.localLanApiBaseUrl = fixedLan;
        }
        savedApiUrl = fixedSaved;
        lanUrl = fixedLan;
        const migrated = this._migrateDeprecatedLanUrls(savedApiUrl, lanUrl);
        savedApiUrl = migrated[0];
        lanUrl = migrated[1];

        let sys = {};
        try {
            sys = wx.getSystemInfoSync();
        } catch (e) {}
        const isDevtools = sys.platform === 'devtools';
        const onPhone = sys.platform === 'ios' || sys.platform === 'android';
        const savedIsLocalhost = !savedApiUrl || /127\.0\.0\.1|localhost/i.test(savedApiUrl);

        let apiBaseUrl;
        if (!savedIsLocalhost) {
            // 用户保存过隧道或固定 IP：一律尊重该地址
            apiBaseUrl = savedApiUrl;
        } else if (onPhone && lanUrl) {
            // 真机不能使用 127.0.0.1（会指向手机自身），默认走电脑局域网地址
            apiBaseUrl = lanUrl;
        } else if (isDevtools && savedIsLocalhost) {
            // 开发者工具：本机调试优先环回地址
            apiBaseUrl = this.globalData.defaultApiBaseUrl;
        } else {
            apiBaseUrl = lanUrl || savedApiUrl || this.globalData.defaultApiBaseUrl;
        }

        apiBaseUrl = this.normalizeApiBaseUrl(apiBaseUrl) || this.globalData.defaultApiBaseUrl;
        if (lanUrl) {
            this.globalData.localLanApiBaseUrl = lanUrl;
        }
        this.globalData.apiBaseUrl = apiBaseUrl;
        console.log('[Smart-Go] apiBaseUrl=' + apiBaseUrl + (onPhone ? ' (真机)' : isDevtools ? ' (模拟器)' : ''));
        return apiBaseUrl;
    },

    getApiBaseUrl() {
        let sys = {};
        try {
            sys = wx.getSystemInfoSync();
        } catch (e) {}
        const onPhone = sys.platform === 'ios' || sys.platform === 'android';
        const cur = this.normalizeApiBaseUrl(this.globalData.apiBaseUrl);
        if (onPhone && /127\.0\.0\.1|localhost/i.test(cur)) {
            this.loadApiBaseUrl();
        }
        return this.normalizeApiBaseUrl(this.globalData.apiBaseUrl) || this.loadApiBaseUrl();
    },

    setApiBaseUrl(url) {
        const apiBaseUrl = this.normalizeApiBaseUrl(url);
        this.globalData.apiBaseUrl = apiBaseUrl || this.globalData.defaultApiBaseUrl;
        wx.setStorageSync('apiBaseUrl', this.globalData.apiBaseUrl);
        return this.globalData.apiBaseUrl;
    },

    setLocalLanApiBaseUrl(url) {
        const apiBaseUrl = this.normalizeApiBaseUrl(url);
        this.globalData.localLanApiBaseUrl = apiBaseUrl;
        wx.setStorageSync('localLanApiBaseUrl', apiBaseUrl);
        return apiBaseUrl;
    },

    getCampusLocation() {
        const saved = wx.getStorageSync('campusLocation');
        const fallback = this.globalData.defaultCampusLocation;
        if (!saved || typeof saved !== 'object') return fallback;
        const latitude = Number(saved.latitude);
        const longitude = Number(saved.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return fallback;
        const isOldBuiltInPoint =
            Math.abs(latitude - 40.6582) < 0.00001 &&
            Math.abs(longitude - 109.8404) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isPreviousAdjustedPoint =
            Math.abs(latitude - 40.635) < 0.00001 &&
            Math.abs(longitude - 109.835) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isSecondAdjustedPoint =
            Math.abs(latitude - 40.6318) < 0.00001 &&
            Math.abs(longitude - 109.8351) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isThirdAdjustedPoint =
            Math.abs(latitude - 40.6308) < 0.00001 &&
            Math.abs(longitude - 109.8351) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isFourthAdjustedPoint =
            Math.abs(latitude - 40.6263) < 0.00001 &&
            Math.abs(longitude - 109.8351) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isFifthAdjustedPoint =
            Math.abs(latitude - 40.5813) < 0.00001 &&
            Math.abs(longitude - 109.8351) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        const isSixthAdjustedPoint =
            Math.abs(latitude - 40.6173) < 0.00001 &&
            Math.abs(longitude - 109.8351) < 0.00001 &&
            String(saved.name || '').includes('内蒙古科技大学');
        if (isOldBuiltInPoint || isPreviousAdjustedPoint || isSecondAdjustedPoint || isThirdAdjustedPoint || isFourthAdjustedPoint || isFifthAdjustedPoint || isSixthAdjustedPoint) {
            wx.removeStorageSync('campusLocation');
            return fallback;
        }
        return {
            latitude,
            longitude,
            name: saved.name || fallback.name,
            address: saved.address || fallback.address
        };
    },

    setCampusLocation(location = {}) {
        const fallback = this.globalData.defaultCampusLocation;
        const latitude = Number(location.latitude);
        const longitude = Number(location.longitude);
        const normalized = {
            latitude: Number.isFinite(latitude) ? latitude : fallback.latitude,
            longitude: Number.isFinite(longitude) ? longitude : fallback.longitude,
            name: location.name || fallback.name,
            address: location.address || fallback.address
        };
        wx.setStorageSync('campusLocation', normalized);
        return normalized;
    },

    resetCampusLocation() {
        wx.removeStorageSync('campusLocation');
        return this.globalData.defaultCampusLocation;
    },

    // 通用请求头（cloudflare tunnel 不需要特殊 Header）
    withHeaders(headers = {}) {
        return headers;
    },

    checkLoginStatus() {
        const token = wx.getStorageSync('token');
        const userInfo = wx.getStorageSync('userInfo');
        const openid = wx.getStorageSync('openid');

        if (token && userInfo) {
            this.globalData.userInfo = userInfo;
            this.globalData.isBindAccount = true;
            this.globalData.openid = openid || '';
        }
    },

    // 统一请求封装
    async request(options) {
        const token = wx.getStorageSync('token');
        const requestUrl = `${this.getApiBaseUrl()}${options.url}`;

        return new Promise((resolve, reject) => {
            wx.request({
                url: requestUrl,
                method: options.method || 'GET',
                data: options.data || {},
                header: this.withHeaders({
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    ...options.header
                }),
                timeout: options.timeout ?? 60000,
                success: (res) => {
                    if (res.statusCode === 200) {
                        resolve(res.data);
                    } else if (res.statusCode === 401) {
                        wx.removeStorageSync('token');
                        wx.removeStorageSync('userInfo');
                        wx.redirectTo({
                            url: '/pages/bind-account/bind-account'
                        });
                        reject(new Error('未授权'));
                    } else {
                        reject(new Error(res.data.message || '请求失败'));
                    }
                },
                fail: (err) => {
                    reject(err);
                }
            });
        });
    },

    // 流式请求（用于 AI 对话）- HTTP POST 模式（已改用 WebSocket，见 wsAIChatConnect）
    streamRequest(options, onChunk, onComplete, onOpen) {
        const base = this.getApiBaseUrl();
        const url = `${base}${options.url}`;
        const token = wx.getStorageSync('token');
        console.log('[streamRequest] POST', url);
        if (onOpen) onOpen();

        wx.request({
            url,
            method: 'POST',
            data: options.data || {},
            header: this.withHeaders({
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
            }),
            timeout: 120000,

            success(res) {
                if (res.statusCode === 200 && res.data) {
                    // 后端返回完整 JSON，一次性交付给前端处理
                    onChunk(res.data);
                } else {
                    onComplete({
                        error: `请求失败 (${res.statusCode})`
                    });
                }
            },

            fail(err) {
                console.error('[streamRequest] fail', err);
                onComplete({
                    error: '网络请求失败: ' + (err.errMsg || '未知错误')
                });
            }
        });
    },

    // 中断当前流式请求
    abortStream(task) {
        if (task) {
            try {
                task.close();
            } catch (e) {}
        }
        this._currentStreamTask = null;
    },

    // 显示加载提示
    showLoading(title = '加载中...') {
        if (!wx.showLoading) return;
        wx.showLoading({
            title,
            mask: true
        });
    },

    // 隐藏加载提示
    hideLoading() {
        if (!wx.hideLoading) return;
        wx.hideLoading();
    },

    // 封装 wx.showToast
    toast(message, icon = 'none', duration = 2000) {
        wx.showToast({
            title: message,
            icon,
            duration
        });
    },

    // 错误处理
    handleError(error, showToast = true) {
        console.error('Error:', error);
        if (showToast) {
            this.toast(error.message || '操作失败', 'none');
        }
    },

    // HTTP 非流式 AI 对话：走主后端 /api/ai/chat（与 settings 里配置的 apiBaseUrl 一致）
    // 后端内部再决定是否调用本地 8001 模型服务；真机/隧道勿再写死 127.0.0.1:8001
    httpAIChat(params) {
        const base = this.getApiBaseUrl();
        const url = `${base}/api/ai/chat`;
        return new Promise((resolve, reject) => {
            wx.request({
                url,
                method: 'POST',
                timeout: 180000,
                header: Object.assign({
                        'Content-Type': 'application/json'
                    },
                    this.withHeaders({
                        'Authorization': wx.getStorageSync('token') ? `Bearer ${wx.getStorageSync('token')}` : '',
                    })
                ),
                data: {
                    conversationId: params.conversationId || '',
                    message: params.message || '',
                    history: params.history || [],
                },
                success: res => {
                    let body = res.data;
                    if (typeof body === 'string') {
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            reject(new Error(`服务器返回非 JSON（HTTP ${res.statusCode}），请检查后端是否在线`));
                            return;
                        }
                    }
                    if (res.statusCode !== 200) {
                        reject(new Error((body && body.message) || `HTTP ${res.statusCode}`));
                        return;
                    }
                    if (body && body.code === 0 && body.data) {
                        resolve({
                            content: body.data.content || '',
                            quickActions: body.data.quickActions || [],
                        });
                        return;
                    }
                    // 兼容旧版直连推理服务：{ answer } 或扁平 { content }
                    if (body && (body.answer != null || body.content != null)) {
                        resolve({
                            content: body.content != null ? body.content : (body.answer || ''),
                            quickActions: body.quickActions || [],
                        });
                        return;
                    }
                    reject(new Error((body && body.message) || 'AI 返回格式异常'));
                },
                fail: err => reject(new Error(err.errMsg || '网络请求失败')),
            });
        });
    },

    // WebSocket 流式 AI 对话（备用，需要 tunnel 支持 WebSocket）
    // 使用步骤:
    //   1. wsAIChatConnect(onMessage, onError, onClose) -> connectTask
    //   2. connectTask.send(JSON) 发送请求
    //   3. connectTask.close() 主动关闭
    wsAIChatConnect(onMessage, onError, onClose) {
        const base = this.getApiBaseUrl();
        const wsUrl = base.replace(/^http/, 'ws') + '/api/ai/stream/ws';

        const task = {
            closed: false,
            _pending: [],

            send(data) {
                if (this._pending !== null) {
                    this._pending.push(data);
                    return;
                }
                wx.sendSocketMessage({
                    data,
                    fail(err) {
                        console.error('[wsAI] send fail', err);
                    }
                });
            },

            close() {
                this.closed = true;
                this._pending = null;
                wx.closeSocket();
            }
        };

        wx.connectSocket({
            url: wsUrl,
            header: this.withHeaders({
                'Authorization': wx.getStorageSync('token') ? `Bearer ${wx.getStorageSync('token')}` : '',
            }),

            success() {
                console.log('[wsAI] connecting to', wsUrl);
            },

            fail(err) {
                console.error('[wsAI] connect fail', err);
                if (onError) onError('WebSocket 连接失败');
            }
        });

        wx.onSocketOpen(() => {
            console.log('[wsAI] connected');
            const pending = task._pending;
            task._pending = null;
            pending.forEach(data => {
                wx.sendSocketMessage({
                    data,
                    fail(err) {
                        console.error('[wsAI] send fail', err);
                    }
                });
            });
        });

        // SSE 行解析辅助函数
        function _processLine(line) {
            // 跳过 SSE 注释和结束标记
            if (line.startsWith(':') || line === 'data: [DONE]\n\n') return;
            const prefix = 'data: ';
            if (line.startsWith(prefix)) {
                const jsonStr = line.slice(prefix.length).trim();
                try {
                    const obj = JSON.parse(jsonStr);
                    if (obj.type === 'error') {
                        if (onError) onError(obj.message);
                    } else if (obj.type === 'quick_actions') {
                        if (onMessage) onMessage({
                            type: 'quick_actions',
                            actions: obj.actions
                        });
                    } else {
                        if (onMessage) onMessage({
                            type: 'content',
                            content: obj.content || ''
                        });
                    }
                } catch (e) {
                    console.warn('[wsAI] parse error', jsonStr, e);
                }
            }
        }

        wx.onSocketMessage(resp => {
            const data = resp.data;
            // 累积数据直到收到完整的 SSE 块
            const SSE_DELIMITER = '}\n\n';
            if (this._wsBuffer === undefined) this._wsBuffer = '';
            this._wsBuffer += data;

            while (this._wsBuffer.includes(SSE_DELIMITER)) {
                const idx = this._wsBuffer.indexOf(SSE_DELIMITER);
                const sseLine = this._wsBuffer.slice(0, idx + SSE_DELIMITER.length);
                this._wsBuffer = this._wsBuffer.slice(idx + SSE_DELIMITER.length);
                _processLine(sseLine);
            }
        });

        wx.onSocketError(err => {
            console.error('[wsAI] socket error', err);
            if (onError) onError('WebSocket 连接异常');
        });

        wx.onSocketClose(() => {
            console.log('[wsAI] closed');
            if (onClose) onClose();
        });

        return task;
    }
});