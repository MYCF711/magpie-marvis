# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.3 — 2026-11-06

**变更**

- 模型列表收成 **8 条、每条一个独立的真实模型**，不再重复：删除 `file-auto` / `computer-auto` / `browser-auto` / `app-auto` —— 前三个实测**全部**路由到 `deepseek-v4-1-flash-261017`，和 `main-auto` 完全一样
- 保留 `main-auto` 作为 DeepSeek V4.1 Flash 的唯一入口（连发 5 次、5 种难度提示词，路由 100% 稳定）

**最终模型表**

| 槽位 id | 显示名（= 真实模型） |
|---|---|
| `main-auto` | `deepseek-v4-1-flash-261017` |
| `deepseek-v4-pro-external` | `deepseek-v4-pro-202606` |
| `hy3-preview-agent` | `deepseek-v4-flash-ga-260731` |
| `hy3-preview-agent-real` | `hy3` |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` |
| `claude-opus-4-6` | `claude-opus-4-6` |
| `gpt-5.4` | `gpt-5.4-2026-03-05` |
| `hunyuan-turbos-vision` | `HY-Vision-2.0-instruct` |

