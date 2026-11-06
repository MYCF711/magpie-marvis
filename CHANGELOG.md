# 更新记录

> 每个版本一节，**一条一行**，说用户能感知的变化。
> 格式与规矩见 [UPDATING.md](./UPDATING.md)。

## 0.1.6 — 2026-11-06

**修复**

- **图标顶不满边框**：官方 `icon.png` 四周有 10% 透明留白（内容只占 81.2%）。
  按 alpha 包围盒裁切后再补成方形，现在铺满 128×128
- **本机导入还是失败**（`AmbiguousParameterSet`）：`Add-Type -Path` 与 `-Language`
  属于不同参数集，同时给必然报错 —— 去掉 `-Language`，`-Path` 自己按扩展名推断
- **本机导入扫错进程**：只扫了 `MarvisAgent.exe`，但 Chromium 的 `accesstoken=`
  cookie 在 **`Marvis.exe`** 里（本机有 3 个实例）。现在两个进程都扫
- **浏览器登录报「授权码已被使用过」**：轮询 `document.body` 会读到回调页**第二次**
  加载的响应 —— 那时 code 已被第一次消耗。改成监听 `Network.responseReceived`
  取**第一个**响应体（`Network.getResponseBody`）

