# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.0 — 2026-11-06

**新增**

- 首个版本：接入腾讯 Marvis 模型网关（`/v1/chat/completions`），16 个槽位
- 登录：QQ / 微信 OAuth 授权码，另支持「从本机 Marvis 客户端导入」
- 内置 Beacon SDK（`native/` 4 个文件），uskey 每请求本地现签，**不需要安装 Marvis 客户端**
- 额度卡片接令牌钱包（`/v3/marvis_get_wallet`）
- 流式 / 工具调用 / 思考（`reasoning_content`）/ 系统提示词全部可用

**内置模型（槽位 → 实测路由）**

| 槽位 | 实际模型 |
|---|---|
| **`main-auto`** | **`deepseek-v4-1-flash-261017`**（DeepSeek V4.1 Flash，默认） |
| `deepseek-v4-pro-external` | `deepseek-v4-pro-202606` |
| `app-auto` | `deepseek-v4-flash-202605` |
| `file-auto` / `computer-auto` / `browser-auto` | `deepseek-v4-1-flash-261017` |
| `glm-5v-turbo-thinking` | `glm-5v-turbo` |
| `claude-sonnet-4-6` / `claude-opus-4-6` / `claude-opus-4-6-thinking` | 同名 |
| `gpt-5.4` | `gpt-5.4-2026-03-05` |
| `hunyuan-turbos-vision` / `venus-vision-llm` | 同名 |
| `hy3-preview-agent-real` | `hy3` |
| `hy3-preview-agent` | `hy3-preview-agent` |
| `memory-compress` | `qwen-memory-compression-int8` |

**已知边界**

- 只支持 Windows（Beacon SDK 只有 Windows 二进制）
- 真实模型 id 不能直接当 `model` 传（会 400 无效模型id），只能填槽位名
- 「按任务难度自动匹配」是披露文案：实测简单/中等/困难三种提示词，`main-auto` 路由结果完全一样
- token 30 天有效，`refresh` 会成对轮换
