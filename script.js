class LuckyWheel {
    constructor() {
        this.wheel = document.getElementById('wheel');
        this.itemCount = 6;
        this.items = [];
        this.isSpinning = false;
        this.currentRotation = 0;
        this.spinInterval = null;
        
        // 多人协作相关属性（统一链接：所有人进入同一房间）
        this.roomId = 'GLOBAL_ROOM';
        this.participants = new Map();
        this.currentOperator = null;
        this.isHost = false;
        this.syncInterval = null;
        this.myName = null;
        
        // WebSocket相关属性
        this.socket = null;
        this.isConnected = false;
        // Render 线上 WebSocket 服务地址
        this.serverUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'ws://localhost:8080'
            : 'wss://big-wheel.onrender.com';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // 奥特曼ID相关属性
        this.ultramanNames = [
            '迪迦奥特曼', '戴拿奥特曼', '盖亚奥特曼', '阿古茹奥特曼',
            '奈克瑟斯奥特曼', '麦克斯奥特曼', '梦比优斯奥特曼', '赛罗奥特曼',
            '银河奥特曼', '维克特利奥特曼', '艾克斯奥特曼', '欧布奥特曼',
            '捷德奥特曼', '罗布奥特曼', '泰迦奥特曼', '泽塔奥特曼',
            '特利迦奥特曼', '德凯奥特曼', '布莱泽奥特曼', '雷古洛斯奥特曼'
        ];
        this.usedUltramanNames = new Set();
        
        this.init();
    }

    // 发送消息到服务器（安全封装）
    sendMessage(type, payload = {}) {
        try {
            if (!this.socket || !this.isConnected || this.socket.readyState !== WebSocket.OPEN) {
                return;
            }
            const message = {
                type,
                roomId: this.roomId,
                timestamp: Date.now(),
                ...payload
            };
            this.socket.send(JSON.stringify(message));
        } catch (e) {
            console.error('发送消息失败:', e);
        }
    }

    // 同步转盘项目（观众端或全体刷新）
    syncWheelItems(items) {
        try {
            if (!Array.isArray(items)) return;
            this.items = items;
            this.updateWheelTexts();
            this.generateItemInputs();
        } catch (e) {
            console.error('同步项目失败:', e);
        }
    }

    // 同步房间数据（新加入用户获取快照）
    syncRoomData(roomData) {
        try {
            if (!roomData) return;
            this.items = roomData.items || this.items;
            this.currentRotation = roomData.currentRotation || 0;
            const op = roomData.currentOperator || '迪迦奥特曼';
            this.setCurrentOperator(op);
            this.generateWheel();
            this.generateItemInputs();
            this.updateWheelTexts();
            this.wheel.style.transform = `rotate(${this.currentRotation}deg)`;
        } catch (e) {
            console.error('同步房间数据失败:', e);
        }
    }

    init() {
        this.bindEvents();
        this.generateWheel();
        this.generateItemInputs();
        this.initCollaboration();
        // 启用WebSocket以支持跨设备实时同步
        this.initWebSocket();
        // 加入房间，等待服务端分配身份
        const joinWhenOpen = () => this.joinRoom(this.roomId);
        setTimeout(joinWhenOpen, 200);
    }

    // 生成房间ID
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // 初始化多人协作
    initCollaboration() {
        // 本地决定身份（恢复：首个为迪迦，后续随机），无需服务端分配
        const assigned = localStorage.getItem('my_ultraman_name');
        if (assigned) {
            this.myName = assigned;
        } else {
            const existingSnapshot = localStorage.getItem('global_room_snapshot');
            if (!existingSnapshot) {
                this.myName = '迪迦奥特曼';
                localStorage.setItem('global_room_snapshot', JSON.stringify({ owner: this.myName, createdAt: Date.now() }));
            } else {
                this.myName = this.generateUltramanId();
            }
            localStorage.setItem('my_ultraman_name', this.myName);
        }

        // 加入本地参与者列表
        this.addParticipant(this.myName, true);
        this.showSuccess(`${this.myName} 加入了房间`);

        // 设置操作者：首位为“迪迦奥特曼”
        this.setCurrentOperator('迪迦奥特曼');

        // 本地快照同步（避免刷新丢失）
        this.startSync();
    }

    // 初始化WebSocket连接
    initWebSocket() {
        try {
            this.socket = new WebSocket(this.serverUrl);
            
            this.socket.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.showSuccess('🟢 已连接到服务器，实时同步已开启');
                this.joinRoom(this.roomId);
                this.updateConnectionStatus();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const raw = event.data;
                    // 仅解析JSON格式的数据，忽略Render可能返回的文本帧（如 "Request served by ..."）
                    if (typeof raw === 'string') {
                        const trimmed = raw.trim();
                        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
                            return; // 非JSON消息忽略
                        }
                        const data = JSON.parse(trimmed);
                        this.handleServerMessage(data);
                    } else {
                        // 非字符串类型（如Blob/ArrayBuffer），直接忽略或后续扩展为二进制协议
                        return;
                    }
                } catch (error) {
                    // 忽略非JSON格式消息
                    // console.debug('忽略非JSON服务器消息');
                    return;
                }
            };
            
            this.socket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus();
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    this.showError(`🔴 连接已断开，${3}秒后重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => this.initWebSocket(), 3000);
                } else {
                    this.showError('🔴 连接失败，请刷新页面重试');
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.showError('🔴 连接错误');
            };
        } catch (error) {
            console.error('WebSocket初始化失败:', error);
            this.showError('🔴 无法连接到服务器，将使用本地模式');
        }
    }

    // 更新连接状态显示
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) {
            // 创建连接状态显示元素
            const statusDiv = document.createElement('div');
            statusDiv.id = 'connectionStatus';
            statusDiv.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                color: white;
                transition: all 0.3s;
            `;
            document.body.appendChild(statusDiv);
        }
        
        const statusDiv = document.getElementById('connectionStatus');
        if (this.isConnected) {
            statusDiv.textContent = '🟢 实时同步已连接';
            statusDiv.style.background = '#28a745';
        } else {
            statusDiv.textContent = '🔴 实时同步已断开';
            statusDiv.style.background = '#dc3545';
        }
    }

        // 处理服务器消息（如无后端，可忽略）
    handleServerMessage(data) {
        console.log('收到服务器消息:', data);
        
        switch (data.type) {
            case 'participant_joined':
                if (data.name !== '迪迦奥特曼') {
                    this.addParticipant(data.name, true);
                    this.showSuccess(`👋 ${data.name} 加入了房间`);
                }
                break;
                
            case 'participant_left':
                this.removeParticipant(data.name);
                this.showSuccess(`👋 ${data.name} 离开了房间`);
                break;
                
            case 'operator_changed':
                this.setCurrentOperator(data.operator);
                this.showSuccess(`🎮 ${data.operator} 成为当前操作者`);
                break;
                
            case 'wheel_spin_started':
                if (data.operator !== this.myName) {
                    document.getElementById('resultText').textContent = '旋转中...';
                }
                break;

            case 'wheel_spun':
                if (data.operator !== this.myName) {
                    // 观众端应用房主广播的旋转角度与结果
                    this.currentRotation = data.rotation;
                    this.wheel.style.transform = `rotate(${data.rotation}deg)`;
                    document.getElementById('resultText').textContent = data.result;
                    // 动画过渡
                    this.wheel.style.transition = 'transform 0.5s ease-out';
                    setTimeout(() => {
                        this.wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
                    }, 500);
                }
                break;
                
            case 'items_updated':
                this.syncWheelItems(data.items);
                this.showSuccess('📝 转盘项目已同步更新');
                break;
                
            case 'room_joined':
                // 简化：仅同步房间状态（身份由本地决定）
                if (data.roomData) {
                    this.syncRoomData(data.roomData);
                }
                break;
        }
    }

    // 生成随机奥特曼ID
    generateUltramanId() {
        const availableNames = this.ultramanNames.filter(name => !this.usedUltramanNames.has(name));
        
        if (availableNames.length === 0) {
            // 如果所有奥特曼名称都被使用了，重置已使用列表（除了迪迦奥特曼）
            this.usedUltramanNames.clear();
            this.usedUltramanNames.add('迪迦奥特曼');
            return this.generateUltramanId();
        }
        
        const randomIndex = Math.floor(Math.random() * availableNames.length);
        const selectedName = availableNames[randomIndex];
        this.usedUltramanNames.add(selectedName);
        
        return selectedName;
    }

    // 添加参与者
    addParticipant(name, isOnline = true) {
        this.participants.set(name, {
            name: name,
            isOnline: isOnline,
            lastSeen: Date.now()
        });
        this.updateParticipantList();
    }

    // 移除参与者
    removeParticipant(name) {
        this.participants.delete(name);
        this.updateParticipantList();
        
        // 如果移除的是当前操作者，重新分配
        if (this.currentOperator === name) {
            this.reassignOperator();
        }
    }

    // 更新参与者列表显示
    updateParticipantList() {
        const container = document.getElementById('participantList');
        const countElement = document.getElementById('participantCount');
        
        container.innerHTML = '';
        countElement.textContent = this.participants.size;
        
        this.participants.forEach((participant, name) => {
            const item = document.createElement('div');
            item.className = 'participant-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'participant-name';
            nameSpan.textContent = name;
            
            const statusSpan = document.createElement('span');
            statusSpan.className = `participant-status ${participant.isOnline ? 'online' : 'offline'}`;
            statusSpan.textContent = participant.isOnline ? '在线' : '离线';
            
            // 如果是当前操作者，添加特殊标识
            if (name === this.currentOperator) {
                statusSpan.className = 'participant-status operating';
                statusSpan.textContent = '操作中';
            }
            
            item.appendChild(nameSpan);
            item.appendChild(statusSpan);
            container.appendChild(item);
        });
    }

    // 设置当前操作者
    setCurrentOperator(name) {
        this.currentOperator = name;
        document.getElementById('currentOperator').textContent = name;
        
        // 更新按钮状态
        const spinBtn = document.getElementById('spinBtn');
        const stopBtn = document.getElementById('stopBtn');
        const waitingStatus = document.getElementById('waitingStatus');
        
        // 仅当前操作者可操作（由 currentOperator 与 myName 比较）
        const isOperator = name === this.myName;
        
        spinBtn.disabled = this.isSpinning ? true : false;
        stopBtn.disabled = this.isSpinning ? false : true;
        
        // 如果不是操作者且为多人模式，禁用按钮并显示等待
        if (!isOperator) {
            spinBtn.disabled = true;
            stopBtn.disabled = true;
            waitingStatus.style.display = 'block';
        } else {
            waitingStatus.style.display = 'none';
        }
        
        this.updateParticipantList();
    }

    // 重新分配操作者
    reassignOperator() {
        const onlineParticipants = Array.from(this.participants.entries())
            .filter(([name, participant]) => participant.isOnline)
            .map(([name]) => name);
        
        if (onlineParticipants.length > 0) {
            const newOperator = onlineParticipants[0];
            this.setCurrentOperator(newOperator);
        }
    }

    // 开始同步
    startSync() {
        // 模拟实时同步（实际项目中可以使用WebSocket）
        this.syncInterval = setInterval(() => {
            this.syncData();
        }, 2000);
    }

    // 同步数据
    syncData() {
        // 这里可以添加与服务器的数据同步逻辑
        // 目前使用本地存储模拟
        const syncData = {
            roomId: this.roomId,
            items: this.items,
            currentRotation: this.currentRotation,
            isSpinning: this.isSpinning,
            currentOperator: this.currentOperator,
            participants: Array.from(this.participants.entries()),
            timestamp: Date.now()
        };
        
        localStorage.setItem(`wheel_${this.roomId}`, JSON.stringify(syncData));
    }

    // 停止同步
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // 获取分享链接
    getShareLink() {
        // 统一链接：直接返回当前地址
        return window.location.href.split('?')[0];
    }

    // 复制房间链接
    copyRoomLink() {
        const shareLink = this.getShareLink();
        navigator.clipboard.writeText(shareLink).then(() => {
            this.showSuccess('房间链接已复制到剪贴板！');
        }).catch(() => {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = shareLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('房间链接已复制到剪贴板！');
        });
    }

    // 分享房间
    shareRoom() {
        const shareLink = this.getShareLink();
        
        if (navigator.share) {
            navigator.share({
                title: '随机大转盘 - 多人协作',
                text: `加入我的转盘房间：${this.roomId}`,
                url: shareLink
            });
        } else {
            // 降级方案：复制链接
            this.copyRoomLink();
        }
    }

    // 加入房间
    joinRoom(roomId) {
        if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'join_room',
                roomId: roomId || this.roomId,
                participant: {
                    name: this.myName,
                    isHost: this.myName === '迪迦奥特曼'
                }
            };
            this.socket.send(JSON.stringify(message));
            console.log('发送加入房间消息:', message);
        }
    }

    // 模拟加入房间
    simulateJoinRoom(roomId) {
        // 模拟从本地存储获取房间数据
        const roomData = localStorage.getItem(`wheel_${roomId}`);
        if (roomData) {
            try {
                const data = JSON.parse(roomData);
                this.items = data.items || this.items;
                this.currentRotation = data.currentRotation || 0;
                this.isSpinning = data.isSpinning || false;
                this.currentOperator = data.currentOperator || '迪迦奥特曼';
                
                // 更新显示
                this.generateWheel();
                this.generateItemInputs();
                this.updateWheelTexts();
                this.setCurrentOperator(this.currentOperator);
                
                // 应用当前旋转角度
                this.wheel.style.transform = `rotate(${this.currentRotation}deg)`;
            } catch (e) {
                console.error('解析房间数据失败:', e);
            }
        }
    }

    // 模拟参与者加入（演示用）
    simulateParticipants() {
        // 生成2个随机奥特曼ID
        const ultraman1 = this.generateUltramanId();
        const ultraman2 = this.generateUltramanId();
        
        // 模拟奥特曼加入房间
        setTimeout(() => {
            this.addParticipant(ultraman1, true);
            this.showSuccess(`${ultraman1} 加入了房间`);
        }, 1000);
        
        setTimeout(() => {
            this.addParticipant(ultraman2, true);
            this.showSuccess(`${ultraman2} 加入了房间`);
        }, 2000);
        
        // 模拟操作者轮换
        setTimeout(() => {
            if (this.participants.size > 1) {
                const participants = Array.from(this.participants.keys());
                const randomParticipant = participants[Math.floor(Math.random() * participants.length)];
                this.setCurrentOperator(randomParticipant);
                this.showSuccess(`${randomParticipant} 成为当前操作者`);
            }
        }, 5000);
    }

    // 切换演示模式
    toggleDemoMode() {
        const demoBtn = document.getElementById('demoModeBtn');
        const isActive = demoBtn.classList.contains('active');
        
        if (isActive) {
            // 关闭演示模式
            demoBtn.classList.remove('active');
            demoBtn.textContent = '开启演示模式';
            demoBtn.style.background = '#ff9800';
            
            // 移除所有模拟的参与者（保留房主）
            const participantsToRemove = [];
            this.participants.forEach((participant, name) => {
                if (name !== '迪迦奥特曼') {
                    participantsToRemove.push(name);
                }
            });
            
            participantsToRemove.forEach(name => {
                this.removeParticipant(name);
            });
            
            // 确保房主是当前操作者
            this.setCurrentOperator('迪迦奥特曼');
            
            this.showSuccess('演示模式已关闭');
        } else {
            // 开启演示模式
            demoBtn.classList.add('active');
            demoBtn.textContent = '关闭演示模式';
            demoBtn.style.background = '#4caf50';
            
            // 开始模拟参与者
            this.simulateParticipants();
            
            this.showSuccess('演示模式已开启');
        }
    }

    bindEvents() {
        document.getElementById('generateBtn').addEventListener('click', () => {
            const input = document.getElementById('itemCount');
            const value = input.value.trim();
            
            if (!value || isNaN(value)) {
                this.showError('请输入有效的数字！');
                input.focus();
                return;
            }
            
            this.itemCount = parseInt(value);
            if (this.itemCount >= 2 && this.itemCount <= 20) {
                this.generateWheel();
                this.generateItemInputs();
                this.showSuccess('转盘生成成功！');
            } else {
                this.showError('请输入2-20之间的数字！');
                input.focus();
            }
        });

        document.getElementById('spinBtn').addEventListener('click', () => {
            if (this.isSpinning) return;
            const isOperator = this.currentOperator === this.myName;
            if (isOperator) {
                this.startSpin();
                // 通知服务器开始旋转（用于观众端显示“旋转中”）
                this.sendMessage('start_spin', { operator: this.myName });
            } else {
                this.showError('当前为房主（迪迦奥特曼）操作，您为观众');
            }
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            if (!this.isSpinning) return;
            const isOperator = this.currentOperator === this.myName;
            if (isOperator) {
                this.stopSpin();
                // stopSpin 内部会计算结果，这里在stopSpin结束后发送
            }
        });

        document.getElementById('saveItemsBtn').addEventListener('click', () => {
            this.saveItems();
        });

        // 多人协作相关事件
        // copyRoomBtn / shareRoomBtn 已移除

        // 演示模式控制
        document.getElementById('demoModeBtn').addEventListener('click', () => {
            this.toggleDemoMode();
        });

        // 添加输入验证
        document.getElementById('itemCount').addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && (isNaN(value) || value < 2 || value < 20)) {
                e.target.style.borderColor = '#ff4757';
            } else {
                e.target.style.borderColor = '#ddd';
            }
        });

        // 添加防抖处理
        let saveTimeout;
        document.getElementById('saveItemsBtn').addEventListener('click', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveItems();
            }, 100);
        });
    }

    generateWheel() {
        this.wheel.innerHTML = '';
        this.items = [];
        
        const angleStep = 360 / this.itemCount;
        const radius = 200; // 转盘半径
        
        for (let i = 0; i < this.itemCount; i++) {
            const startAngle = i * angleStep;
            const endAngle = (i + 1) * angleStep;
            
            // 创建扇形项目
            const item = this.createWheelSector(startAngle, endAngle, radius, i);
            this.wheel.appendChild(item);
            
            this.items.push(`项目${i + 1}`);
        }
        
                // 添加中心圆点
        this.addCenterCircle();
    }

    // 创建转盘扇形
    createWheelSector(startAngle, endAngle, radius, index) {
        // 创建SVG扇形
        const svg = this.createSectorSVG(startAngle, endAngle, radius, index);
        
        // 创建项目容器
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 400px;
            height: 400px;
            z-index: 2;
        `;
        
        // 添加SVG
        item.appendChild(svg);
        
        // 添加文本
        const text = this.createSectorText(startAngle, endAngle, radius, index);
        item.appendChild(text);
        
        return item;
    }

    // 创建扇形SVG
    createSectorSVG(startAngle, endAngle, radius, index) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '400');
        svg.setAttribute('height', '400');
        svg.setAttribute('viewBox', '-200 -200 400 400');
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
        `;
        
        // 计算扇形的坐标
        const x1 = radius * Math.cos(startAngle * Math.PI / 180);
        const y1 = radius * Math.sin(startAngle * Math.PI / 180);
        const x2 = radius * Math.cos(endAngle * Math.PI / 180);
        const y2 = radius * Math.sin(endAngle * Math.PI / 180);
        
        // 创建扇形路径
        const angleStep = endAngle - startAngle;
        const largeArcFlag = angleStep > 180 ? 1 : 0;
        const path = `
            M 0 0
            L ${x1} ${y1}
            A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
            Z
        `;
        
        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttribute('d', path);
        pathElement.setAttribute('fill', this.getSectorColor(index));
        pathElement.setAttribute('stroke', '#fff');
        pathElement.setAttribute('stroke-width', '2');
        
        svg.appendChild(pathElement);
        return svg;
    }

    // 创建扇形文本
    createSectorText(startAngle, endAngle, radius, index) {
        const text = document.createElement('div');
        text.style.cssText = `
            position: absolute;
            color: white;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            white-space: nowrap;
            z-index: 3;
            pointer-events: none;
            font-size: 14px;
            text-align: center;
            width: 80px;
            height: 20px;
            line-height: 20px;
        `;
        
        text.textContent = `项目${index + 1}`;
        
        // 计算文本在扇形中心的位置
        const angleStep = endAngle - startAngle;
        const textRadius = radius * 0.7;
        const textAngle = startAngle + angleStep / 2;
        const textX = textRadius * Math.cos(textAngle * Math.PI / 180);
        const textY = textRadius * Math.sin(textAngle * Math.PI / 180);
        
        text.style.left = `${200 + textX}px`;
        text.style.top = `${200 + textY}px`;
        
        // 调整文本角度，让文本更容易阅读
        if (textAngle > 90 && textAngle < 270) {
            text.style.transform = 'translate(-50%, -50%) rotate(180deg)';
        } else {
            text.style.transform = 'translate(-50%, -50%)';
        }
        
        return text;
    }

    // 添加中心圆点
    addCenterCircle() {
        const centerCircle = document.createElement('div');
        centerCircle.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 30px;
            background-color: #333;
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            z-index: 10;
        `;
        
        this.wheel.appendChild(centerCircle);
    }

    



    generateItemInputs() {
        const container = document.getElementById('itemInputs');
        container.innerHTML = '';
        
        for (let i = 0; i < this.itemCount; i++) {
            const inputDiv = document.createElement('div');
            inputDiv.className = 'item-input';
            
            const label = document.createElement('label');
            label.textContent = `项目${i + 1}:`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = this.items[i] || `项目${i + 1}`;
            input.placeholder = `输入项目${i + 1}的内容`;
            
            inputDiv.appendChild(label);
            inputDiv.appendChild(input);
            container.appendChild(inputDiv);
        }
    }



    getSectorColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#F39C12', 
            '#9B59B6', '#E74C3C', '#1ABC9C', '#E67E22',
            '#3498DB', '#F1C40F', '#8E44AD', '#16A085',
            '#D35400', '#C0392B', '#27AE60', '#2980B9',
            '#F39C12', '#E74C3C', '#9B59B6', '#34495E'
        ];
        return colors[index % colors.length];
    }

    saveItems() {
        const inputs = document.querySelectorAll('#itemInputs input');
        this.items = [];
        
        // 验证输入
        let hasEmptyInput = false;
        inputs.forEach((input, index) => {
            const value = input.value.trim();
            if (!value) {
                hasEmptyInput = true;
                input.style.borderColor = '#ffc107';
                input.style.boxShadow = '0 0 5px rgba(255,193,7,0.3)';
            } else {
                input.style.borderColor = '#ddd';
                input.style.boxShadow = 'none';
            }
            this.items.push(value || `项目${index + 1}`);
        });
        
        if (hasEmptyInput) {
            this.showError('有项目为空，将使用默认名称');
        }
        
        // 发送项目更新消息到服务器
        this.sendMessage('items_updated', {
            items: this.items
        });
        
        // 更新转盘显示
        this.updateWheelTexts();
        
        // 显示保存成功提示
        this.showSuccess('项目保存成功！');
        
        // 更新按钮状态
        this.updateSaveButtonState();
    }

    // 更新转盘文本
    updateWheelTexts() {
        const wheelItems = this.wheel.querySelectorAll('.wheel-item');
        wheelItems.forEach((item, index) => {
            const textElement = item.querySelector('div');
            if (textElement && textElement.style.position === 'absolute') {
                textElement.textContent = this.items[index];
            }
        });
    }

    // 更新保存按钮状态
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveItemsBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '保存成功！';
        saveBtn.style.background = '#28a745';
        saveBtn.disabled = true;
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
            saveBtn.disabled = false;
        }, 1500);
    }

    startSpin() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        
        // 发送开始旋转消息到服务器
        this.sendMessage('start_spin', {
            operator: this.currentOperator
        });
        
        // 随机旋转角度 (至少转3圈)
        const minSpins = 3;
        const maxSpins = 8;
        const spins = Math.random() * (maxSpins - minSpins) + minSpins;
        const targetRotation = this.currentRotation + (spins * 360);
        
        // 随机选择最终停止的位置
        const finalAngle = Math.random() * 360;
        const finalRotation = targetRotation + finalAngle;
        
        this.currentRotation = finalRotation;
        
        // 应用旋转动画
        const wheelEl = this.wheel;
        // 确保过渡样式存在
        if (wheelEl && wheelEl.style) {
            wheelEl.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
            wheelEl.style.transform = `rotate(${finalRotation}deg)`;
        }
        
        // 4秒后自动停止（若仍在旋转）
        setTimeout(() => {
            if (this.isSpinning) {
                this.stopSpin();
            }
        }, 4000);
        
        // 更新结果显示
        document.getElementById('resultText').textContent = '旋转中...';
    }

    stopSpin() {
        if (!this.isSpinning) return;
        
        this.isSpinning = false;
        document.getElementById('spinBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        
        // 计算最终结果
        const result = this.calculateResult();
        document.getElementById('resultText').textContent = result;
        
        // 发送停止旋转消息到服务器（房主广播给观众）
        this.sendMessage('stop_spin', {
            rotation: this.currentRotation,
            result: result,
            operator: this.myName
        });
        
        // 添加结果高亮效果
        this.highlightResult(result);
    }

    calculateResult() {
        // 计算指针指向的项目
        const normalizedRotation = this.currentRotation % 360;
        const angleStep = 360 / this.itemCount;
        
        // 计算指针指向的角度
        // 指针在顶部（270度），转盘项目从右侧（0度）开始顺时针排列
        // 使用公式：(270 - 旋转角度 + 360) % 360 来计算指针实际指向的角度
        const pointerAngle = (270 - normalizedRotation + 360) % 360;
        
        // 计算项目索引
        let index = Math.floor(pointerAngle / angleStep);
        
        // 边界处理
        if (index >= this.itemCount) {
            index = 0;
        }
        
        return this.items[index] || `项目${index + 1}`;
    }

    highlightResult(result) {
        // 移除之前的高亮
        const wheelItems = this.wheel.querySelectorAll('.wheel-item');
        wheelItems.forEach(item => {
            item.style.filter = 'none';
            item.style.transform = 'scale(1)';
        });
        
        // 找到对应的项目并高亮
        const inputs = document.querySelectorAll('#itemInputs input');
        inputs.forEach((input, index) => {
            if (input.value.trim() === result || 
                (input.value.trim() === '' && `项目${index + 1}` === result)) {
                
                // 高亮转盘项目
                const wheelItem = wheelItems[index];
                wheelItem.style.filter = 'brightness(1.3) drop-shadow(0 0 15px rgba(255,255,255,0.9))';
                wheelItem.style.transform = 'scale(1.05)';
                
                // 高亮输入框
                input.style.borderColor = '#ff6b6b';
                input.style.boxShadow = '0 0 10px rgba(255,107,107,0.3)';
                
                // 显示调试信息
                this.showDebugInfo(index, result);
                
                // 3秒后移除高亮
                setTimeout(() => {
                    wheelItem.style.filter = 'none';
                    wheelItem.style.transform = 'scale(1)';
                    input.style.borderColor = '#ddd';
                    input.style.boxShadow = 'none';
                }, 3000);
            }
        });
    }

    // 显示调试信息
    showDebugInfo(index, result) {
        const normalizedRotation = this.currentRotation % 360;
        const angleStep = 360 / this.itemCount;
        // 使用与calculateResult方法一致的角度计算
        const pointerAngle = (270 - normalizedRotation + 360) % 360;
        const startAngle = index * angleStep;
        const endAngle = (index + 1) * angleStep;
        
        // 控制台输出
        console.log(`🎯 结果: ${result}`);
        console.log(`📊 项目索引: ${index}`);
        console.log(`🔄 转盘旋转角度: ${normalizedRotation.toFixed(1)}°`);
        console.log(`📍 指针指向角度: ${pointerAngle.toFixed(1)}°`);
        console.log(`📐 项目${index + 1}角度范围: ${startAngle}° - ${endAngle}°`);
        console.log(`✅ 指针是否在范围内: ${pointerAngle >= startAngle && pointerAngle < endAngle}`);
        
        // 页面显示调试信息
        const debugInfo = document.getElementById('debugInfo');
        const debugText = document.getElementById('debugText');
        
        if (debugInfo && debugText) {
            debugText.innerHTML = `
                <p><strong>项目索引:</strong> ${index}</p>
                <p><strong>转盘旋转角度:</strong> ${normalizedRotation.toFixed(1)}°</p>
                <p><strong>指针指向角度:</strong> ${pointerAngle.toFixed(1)}°</p>
                <p><strong>项目${index + 1}角度范围:</strong> ${startAngle}° - ${endAngle}°</p>
                <p><strong>指针是否在范围内:</strong> ${pointerAngle >= startAngle && pointerAngle < endAngle ? '✅ 是' : '❌ 否'}</p>
            `;
            debugInfo.style.display = 'block';
            
            // 5秒后隐藏调试信息
            setTimeout(() => {
                debugInfo.style.display = 'none';
            }, 5000);
        }
    }

    // 显示错误提示
    showError(message) {
        this.showNotification(message, 'error');
    }

    // 显示成功提示
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // 显示通知
    showNotification(message, type) {
        // 移除之前的通知
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 设置样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        if (type === 'error') {
            notification.style.background = '#ff4757';
        } else {
            notification.style.background = '#28a745';
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.luckyWheel = new LuckyWheel();
    
    // 检测URL参数，判断是否加入房间
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        // 模拟加入房间
        setTimeout(() => {
            const wheel = window.luckyWheel;
            if (wheel) {
                wheel.joinRoom(roomId);
            }
        }, 1000);
    }
    
    // 默认不自动模拟参与者加入（可以通过URL参数控制）
    const autoSimulate = urlParams.get('demo') === 'true';
    if (autoSimulate) {
        // 模拟其他参与者加入（演示用）
        setTimeout(() => {
            const wheel = window.luckyWheel;
            if (wheel) {
                wheel.simulateParticipants();
            }
        }, 3000);
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        const spinBtn = document.getElementById('spinBtn');
        if (!spinBtn.disabled) {
            spinBtn.click();
        }
    }
});