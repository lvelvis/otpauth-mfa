# MFA 二维码密钥提取

一个纯前端工具，用于从 MFA 的 TOTP/HOTP 二维码图片中提取 Base32 密钥和
`otpauth://` URI。

## 安全设计

- 图片只在当前浏览器进程中解析，不会上传到服务器。
- QR 解码库随构建产物一起提供，不依赖在线二维码识别服务。
- 仅接受 `otpauth://totp/` 和 `otpauth://hotp/` 二维码。
- 默认隐藏密钥，并提供清除和本地复制功能。
- 页面设置了限制外部资源和表单提交的 Content Security Policy。

二维码、Base32 密钥和完整 `otpauth://` URI 都等同于 MFA 凭证。不要将它们
提交到 Git、工单、聊天或未加密文件中。曾经公开的二维码应立即在原系统中重置。

## 本地运行

需要 Node.js 18 或更高版本：

```bash
cd totp-pic
npm install
npm run dev
```

浏览器打开终端显示的本地地址，默认通常为：

```text
http://127.0.0.1:5173
```

## 测试与构建

```bash
npm test
npm run build
npm run preview
```

生产构建输出到 `dist/`。建议通过本机静态 Web 服务访问，不要把该工具部署到
不受信任的公共服务器。
