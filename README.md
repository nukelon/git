# Browser Git Demo for GitHub Pages

这是一个“浏览器伪装 git 客户端”的最小测试网页。

它运行在纯静态页面里，使用：

- `isomorphic-git`
- `LightningFS`
- 浏览器端 HTTPS Git 认证（用户名 + Personal Access Token）
- 可配置的 CORS proxy

> 这个 demo 只适合测试。不要把能写仓库的 token 长期放在公开前端里。

## 文件说明

- `index.html`：页面骨架
- `style.css`：样式
- `app.js`：浏览器端 git 逻辑

## 你需要准备什么

1. 一个 GitHub 仓库
2. 仓库的 **HTTPS** 地址，例如：
   - `https://github.com/your-name/your-repo.git`
3. 一个 GitHub Personal Access Token
   - 测试时把它当成 **HTTPS password** 使用
4. 你的 GitHub 用户名
5. 目标分支名，通常是 `main`

## 如何部署到 GitHub Pages

### 方案 A：直接放到一个仓库根目录

1. 新建一个公开仓库，例如 `browser-git-demo`
2. 把这 3 个文件上传到仓库根目录：
   - `index.html`
   - `style.css`
   - `app.js`
3. 进入仓库 Settings → Pages
4. Source 选择：Deploy from a branch
5. Branch 选择：`main` / `/root`
6. 保存后等待 Pages 发布
7. 打开 GitHub Pages 地址访问

### 方案 B：放到你现有 Pages 仓库里

把这几个文件放到 Pages 仓库的站点根目录，或单独放一个子目录，再按你的站点路由访问。

## 如何使用

1. 打开网页
2. 填写：
   - **仓库 HTTPS URL**：例如 `https://github.com/your-name/your-repo.git`
   - **分支**：例如 `main`
   - **本地目录名**：保持默认 `/demo-repo` 即可
   - **CORS Proxy**：默认是 `https://cors.isomorphic-git.org`
   - **GitHub 用户名**：你的 GitHub 用户名
   - **Personal Access Token**：测试 token
3. 点击 **Clone**
4. 左侧会出现文件列表
5. 点击文件名，或手动输入路径后点击 **加载文件**
6. 在编辑区修改内容，点击 **保存到工作区**
7. 点击 **Add 当前文件** 或 **Stage 所有变更**
8. 填写：
   - **Author Name**
   - **Author Email**
   - **Commit Message**
9. 点击 **Commit**
10. 点击 **Push**

## 页面支持的操作

- Clone
- Pull
- 刷新文件列表
- 查看 `statusMatrix`
- 查看最近提交
- 加载文件
- 保存文件到工作区
- 新建文件
- Stage 当前文件
- 删除并 stage 当前文件
- Stage 所有变更
- Commit
- Push
- 清空浏览器本地文件系统

## 常见问题

### 1. Clone / Pull / Push 报 CORS 或网络错误

这是浏览器端 git 的典型问题。你可能需要：

- 换一个可用的 CORS proxy
- 自己部署一个 `@isomorphic-git/cors-proxy`
- 改成“前端 + 后端/Actions”模式

### 2. Push 认证失败

检查：

- 仓库 URL 是否是 HTTPS，而不是 SSH
- 用户名是否正确
- token 是否有效
- token 是否对该仓库有写权限
- 如果仓库属于启用了 SSO 的组织，token 是否已被授权到该组织

### 3. 为什么不用 SSH key

这个 demo 是纯浏览器静态页，更容易测试的方式是 HTTPS + token。SSH key 更适合放在后端或 GitHub Actions，而不是公开前端。

### 4. 浏览器里改的文件存在哪

文件存在浏览器端的 `LightningFS` / IndexedDB 里，不在你的本地磁盘目录里。

## 更稳妥的正式方案

如果你以后不只是测试，建议改成：

- GitHub Pages 前端
- 你自己的后端或 Serverless
- 后端保存密钥
- 后端调用 GitHub API 或触发 GitHub Actions 完成写入


## 2026-03-06 修复

- 改成更接近官方文档的加载方式：`LightningFS` 与 `isomorphic-git` 通过全局 script 引入，`http/web` 单独作为 ES module 引入。
- 新增 `IndexedDB` 可用性检查；如果浏览器端文件系统初始化失败，会直接给出更明确的报错。
- 若你遇到 `null is not an object (evaluating 'new k.Store')`，优先改用这个修复版，并在最新版 Chrome / Edge 普通窗口测试。


## 本版修复

- 为浏览器环境注入 `Buffer` polyfill，用于修复 `Missing Buffer dependency`。
- `保存设置到浏览器` 现在会把 **Personal Access Token 一并保存到 localStorage**。
- 页面刷新后会自动回填 token，方便连续调试。

## 额外说明

如果 clone 仍失败，下一层通常是：

1. CORS proxy 不可用
2. Token 权限不足
3. 仓库分支名不是 `main`
4. 仓库受保护分支禁止直接 push
