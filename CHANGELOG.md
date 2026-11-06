# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.0 — 2026-11-06

**新增**

- 首个版本：接入腾讯 Marvis 模型网关（`/v1/chat/completions`），支持 DeepSeek V4 Pro、Kimi K2.5、Claude Opus/Sonnet 4.6、GPT-5.4、混元 2.0、GLM 5V Turbo 等 18 个槽位
- 登录：QQ / 微信 OAuth 授权码，另支持「从本机 Marvis 客户端导入」
- 内置 Beacon SDK（`native/` 4 个文件），uskey 每请求本地现签，**不需要安装 Marvis 客户端**
- 额度卡片接令牌钱包（`/v3/marvis_get_wallet`）
- 流式 / 工具调用 / 思考（`reasoning_content`）/ 系统提示词全部可用
