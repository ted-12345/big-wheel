# 🚀 大转盘实时同步部署指南

## 📋 部署前准备

### 1. 安装Node.js
确保你的系统已安装Node.js (版本 >= 14.0.0)

```bash
# 检查Node.js版本
node --version
npm --version
```

### 2. 安装依赖
在项目根目录运行：

```bash
npm install
```

## 🏃‍♂️ 本地运行

### 1. 启动WebSocket服务器
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:8080` 启动

### 2. 打开前端页面
在浏览器中打开 `index.html` 文件

## 🌐 在线部署

### 方案1：Railway（推荐，免费）

1. **注册Railway账号**
   - 访问 [railway.app](https://railway.app)
   - 使用GitHub账号登录

2. **部署项目**
   ```bash
   # 安装Railway CLI
   npm install -g @railway/cli
   
   # 登录Railway
   railway login
   
   # 初始化项目
   railway init
   
   # 部署
   railway up
   ```

3. **获取域名**
   - 部署完成后，Railway会提供一个域名
   - 例如：`https://your-app.railway.app`

4. **更新前端配置**
   - 将 `script.js` 中的 `serverUrl` 改为你的Railway域名
   - 将 `ws://localhost:8080` 改为 `wss://your-app.railway.app`

### 方案2：Heroku

1. **注册Heroku账号**
   - 访问 [heroku.com](https://heroku.com)

2. **安装Heroku CLI**
   ```bash
   # Windows
   # 下载安装包：https://devcenter.heroku.com/articles/heroku-cli
   
   # macOS
   brew tap heroku/brew && brew install heroku
   ```

3. **部署**
   ```bash
   # 登录
   heroku login
   
   # 创建应用
   heroku create your-app-name
   
   # 部署
   git add .
   git commit -m "Initial deployment"
   git push heroku main
   ```

### 方案3：Vercel

1. **注册Vercel账号**
   - 访问 [vercel.com](https://vercel.com)

2. **连接GitHub仓库**
   - 将代码推送到GitHub
   - 在Vercel中导入仓库

3. **配置部署**
   - 构建命令：`npm install`
   - 输出目录：`./`
   - 安装命令：`npm install`

## 🔧 配置说明

### 环境变量
可以在部署平台设置以下环境变量：

```bash
PORT=8080          # 服务器端口
NODE_ENV=production # 环境模式
```

### 前端配置
部署后需要更新 `script.js` 中的服务器地址：

```javascript
// 本地开发
this.serverUrl = 'ws://localhost:8080';

// 在线部署（使用你的域名）
this.serverUrl = 'wss://your-app.railway.app';
```

## 📱 测试多人同步

### 1. 本地测试
1. 启动服务器：`npm start`
2. 打开两个浏览器窗口
3. 分别访问 `index.html`
4. 复制房间链接，在另一个窗口打开
5. 测试转盘旋转同步

### 2. 在线测试
1. 部署完成后，分享你的应用链接
2. 朋友通过链接访问
3. 测试多人实时同步功能

## 🐛 常见问题

### Q: WebSocket连接失败
**A:** 检查以下几点：
- 服务器是否正常启动
- 防火墙是否阻止了端口8080
- 浏览器是否支持WebSocket

### Q: 多人同步不工作
**A:** 检查以下几点：
- 所有用户是否在同一个房间
- 网络连接是否正常
- 服务器日志是否有错误

### Q: 部署后无法访问
**A:** 检查以下几点：
- 域名配置是否正确
- SSL证书是否有效
- 服务器是否正常运行

## 📞 技术支持

如果遇到问题，可以：
1. 查看浏览器控制台错误信息
2. 查看服务器日志
3. 检查网络连接状态

## 🎉 部署成功

部署完成后，你的大转盘就支持真正的多人实时同步了！

- ✅ 实时转盘旋转同步
- ✅ 多人参与者管理
- ✅ 房间分享功能
- ✅ 操作者权限控制
- ✅ 自动重连机制


