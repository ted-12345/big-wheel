# 🎯 随机大转盘 - 多人实时协作版

一个基于奥特曼主题的随机大转盘工具，支持真正的多人实时协作和WebSocket同步。

## ✨ 功能特性

- 🎲 动态转盘生成（2-20个项目）
- 👥 真正的多人实时协作
- 🔌 WebSocket实时同步
- 🦸‍♂️ 奥特曼主题ID系统
- 🔗 房间分享功能
- 📱 响应式设计
- 🎨 美观的UI界面
- 🔄 自动重连机制
- 📊 实时连接状态显示

## 🚀 快速部署

### 方法1：GitHub Pages（推荐）

1. **创建GitHub仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

2. **启用GitHub Pages**
   - 进入仓库设置 → Pages
   - Source选择 "Deploy from a branch"
   - Branch选择 "main"
   - 保存后获得访问地址

3. **分享链接**
   - 访问地址格式：`https://你的用户名.github.io/仓库名/`
   - 朋友点击即可正常访问

### 方法2：Netlify（拖拽部署）

1. 访问 [netlify.com](https://netlify.com)
2. 注册账号并登录
3. 将项目文件夹拖拽到部署区域
4. 自动获得可访问的域名

### 方法3：Vercel（自动部署）

1. 访问 [vercel.com](vercel.com)
2. 连接GitHub账号
3. 导入项目仓库
4. 自动部署获得域名

## 📁 项目结构

```
大转盘/
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # JavaScript逻辑（包含WebSocket）
├── server.js           # WebSocket服务器
├── package.json        # Node.js依赖配置
├── test.html           # WebSocket连接测试页面
├── deploy.md           # 详细部署指南
└── README.md           # 说明文档
```

## 🎮 使用方法

### 本地测试
1. **启动服务器**：运行 `npm start` 启动WebSocket服务器
2. **打开页面**：在浏览器中打开 `index.html`
3. **测试连接**：查看左上角的连接状态指示器
4. **多人测试**：打开多个浏览器窗口，复制房间链接测试同步

### 在线使用
1. **部署服务器**：按照 `deploy.md` 指南部署到在线平台
2. **分享链接**：将部署后的链接分享给朋友
3. **实时协作**：所有用户都能看到实时的转盘旋转和结果

## 🔧 技术实现

- 纯前端实现（HTML + CSS + JavaScript）
- WebSocket实时通信
- Node.js后端服务器
- 本地存储模拟数据同步
- SVG绘制转盘扇形
- 响应式设计，支持移动端

## 🌟 奥特曼角色

- **房主**：迪迦奥特曼（默认操作者）
- **参与者**：自动分配其他奥特曼名称
- **角色列表**：包含20个经典奥特曼

## 🔧 技术实现

- 纯前端实现（HTML + CSS + JavaScript）
- 本地存储模拟数据同步
- SVG绘制转盘扇形
- 响应式设计，支持移动端

## 📱 浏览器支持

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

---

**注意**：本地文件无法直接分享给朋友，需要部署到网络服务器才能实现真正的分享功能。 