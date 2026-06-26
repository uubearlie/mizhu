# 🤖 Android 安装指南

## 系统要求

- Android 8.0 或更高版本
- Chrome 浏览器 90+ 或 Edge 浏览器

## 安装步骤

应用网址：**https://uubearlie.github.io/mizhu/**

### 方法一：添加到主屏幕（推荐）

1. 打开 **Chrome** 浏览器

2. 在地址栏输入 **https://uubearlie.github.io/mizhu/** 并访问

3. 点击右上角 **「⋮」菜单** 按钮

4. 选择 **「添加到主屏幕」** 或 **「安装应用」**

5. 在弹出确认框中点击 **「安装」**

6. 应用图标将出现在桌面，点击即可启动

### 方法二：直接安装 APK（离线部署）

如果你的应用部署在私有服务器或内网环境，可以使用以下方式生成 APK：

1. 在项目根目录执行构建：
   ```bash
   npm run build
   ```

2. 将 `dist/` 目录部署到 Web 服务器

3. 使用 [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) 或 [PWABuilder](https://www.pwabuilder.com/) 将 PWA 打包为 APK：
   ```bash
   npx @bubblewrap/cli init --manifest https://your-domain.com/manifest.webmanifest
   npx @bubblewrap/cli build
   ```

4. 生成的 `.apk` 文件可直接安装到 Android 设备

## 使用说明

- 从桌面启动时，应用以全屏模式运行
- 支持离线使用（首次加载后缓存所有资源）
- 数据存储在本地，卸载应用会清除数据
- 支持 Android 返回键导航

## 常见问题

**Q: 为什么没有弹出安装提示？**
A: 确保使用 Chrome 浏览器访问，并且已访问过该页面至少一次。也可以手动从菜单选择「添加到主屏幕」。

**Q: 更新后怎么生效？**
A: 应用会在后台自动更新（Workbox Service Worker）。下次打开即为最新版。如果没有更新，清除 Chrome 缓存后重试。

**Q: 华为/小米手机能用吗？**
A: 可以。使用系统自带的浏览器或 Chrome 均可安装。部分国产浏览器可能不支持 PWA，建议使用 Chrome。
