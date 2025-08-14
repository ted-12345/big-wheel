const WebSocket = require('ws');
const http = require('http');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Server Running');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储房间信息（简单版）
// rooms: roomId -> Set<WebSocket>
const rooms = new Map();
const participants = new Map(); // WebSocket -> { name, roomId, isHost }

console.log('🚀 WebSocket服务器启动中...');

wss.on('connection', (ws) => {
    console.log('🔗 新连接建立');
    
    let currentRoom = null;
    let participantName = null;
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 收到消息:', data);
            
            switch (data.type) {
            case 'join_room': {
                currentRoom = data.roomId;
                participantName = data.participant && data.participant.name ? data.participant.name : '游客';

                if (!rooms.has(currentRoom)) {
                    rooms.set(currentRoom, new Set());
                    console.log(`🏠 创建房间: ${currentRoom}`);
                }
                rooms.get(currentRoom).add(ws);

                // 存储参与者信息
                participants.set(ws, { name: participantName, roomId: currentRoom, isHost: !!(data.participant && data.participant.isHost) });

                // 通知房间内其他用户
                broadcastToRoom(currentRoom, ws, {
                    type: 'participant_joined',
                    name: participantName,
                    timestamp: Date.now()
                });

                // 发送房间数据给新加入的用户
                const roomData = getRoomData(currentRoom);
                ws.send(JSON.stringify({
                    type: 'room_joined',
                    roomData,
                    timestamp: Date.now()
                }));

                console.log(`👋 ${participantName} 加入房间 ${currentRoom}`);
                break;
            }
                    
                case 'start_spin':
                    // 转发开始旋转消息
                    broadcastToRoom(currentRoom, ws, {
                        type: 'wheel_spin_started',
                        operator: data.operator,
                        timestamp: Date.now()
                    });
                    break;
                    
                case 'stop_spin':
                // 转发停止旋转消息
                broadcastToRoom(currentRoom, ws, {
                        type: 'wheel_spun',
                        rotation: data.rotation,
                        result: data.result,
                        operator: data.operator,
                        timestamp: Date.now()
                    });
                    
                    // 更新房间数据
                updateRoomData(currentRoom, {
                    currentRotation: data.rotation,
                    lastResult: data.result,
                    lastOperator: data.operator
                });
                    break;
                    
                case 'items_updated':
                // 转发项目更新消息
                broadcastToRoom(currentRoom, ws, {
                        type: 'items_updated',
                        items: data.items,
                        timestamp: Date.now()
                    });
                    
                    // 更新房间数据
                updateRoomData(currentRoom, { items: data.items });
                    break;
                    
                case 'operator_changed':
                    // 转发操作者变更消息
                    broadcastToRoom(currentRoom, ws, {
                        type: 'operator_changed',
                        operator: data.operator,
                        timestamp: Date.now()
                    });
                    
                    // 更新房间数据
                    updateRoomData(currentRoom, {
                        currentOperator: data.operator
                    });
                    break;
                case 'ping':
                    try {
                        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
                    } catch {}
                    break;
                    
                default:
                    console.log('❓ 未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('❌ 解析消息失败:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 连接断开');
        
        if (currentRoom && rooms.has(currentRoom)) {
            // 从房间中移除
            rooms.get(currentRoom).delete(ws);
            
            // 通知其他用户
            broadcastToRoom(currentRoom, ws, {
                type: 'participant_left',
                name: participantName,
                timestamp: Date.now()
            });
            
            // 如果房间空了，删除房间
            if (rooms.get(currentRoom).size === 0) {
                rooms.delete(currentRoom);
                console.log(`🏚️ 房间 ${currentRoom} 已关闭`);
            }
        }
        
        // 清理参与者信息
        participants.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket错误:', error);
    });
});

// 广播消息给房间内其他用户
function broadcastToRoom(roomId, excludeWs, message) {
    if (rooms.has(roomId)) {
        const clients = rooms.get(roomId);
        let sentCount = 0;
        clients.forEach((client) => {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                sentCount++;
            }
        });
        console.log(`📤 向房间 ${roomId} 广播消息，发送给 ${sentCount} 个用户`);
    }
}

// 获取房间数据
function getRoomData(roomId) {
    // 这里可以从数据库获取房间数据（简化）
    return {
        items: ['项目1', '项目2', '项目3', '项目4', '项目5', '项目6'],
        currentRotation: 0,
        currentOperator: '迪迦奥特曼',
        lastResult: null,
        lastOperator: null
    };
}

// 更新房间数据
function updateRoomData(roomId, data) {
    // 这里可以保存到数据库
    console.log(`💾 更新房间 ${roomId} 数据:`, data);
}

// 启动服务器
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🎉 WebSocket服务器运行在端口 ${PORT}`);
    console.log(`🌐 访问 http://localhost:${PORT} 查看服务器状态`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    wss.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});
