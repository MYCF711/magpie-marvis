# 腾讯 Marvis 反代协议（已实测打通）

> 验证时间：2026-11-06 · 全部结论均为**实测 200**，非推断

## 1. 端点

```
POST https://yybadaccess.3g.qq.com/v1/chat/completions
```

标准 OpenAI Chat Completions。无需 UAL 签名（那是 `/v3/*` 业务接口的事）。

## 2. 请求头（缺一不可）

```
Accept: application/json
Content-Type: application/json
User-Agent: AsyncOpenAI/Python 2.32.0
X-Stainless-Lang: python
X-Stainless-Package-Version: 2.32.0
X-Stainless-OS: Windows
X-Stainless-Arch: other:amd64
X-Stainless-Runtime: CPython
X-Stainless-Runtime-Version: 3.11.9
X-Stainless-Async: async:asyncio
X-Stainless-Raw-Response: true
Authorization: Bearer placeholder
Ual-Access-Openid: <openid>
Ual-Access-Access-Token: <token>          # 30 天有效
Ual-Access-Login-Type: 6
Ual-Access-Guid: <32hex guid>
Marvis-AgentTag: auto_discovery
Marvis-Conversation-ID: <可空>
Marvis-Response-ID: <可空>
Marvis-Scene: preload_summary
Marvis-Protocol-Version: 1000
X-Device-GUID: <同 guid>
Ual-Access-MarvisExt: {"qimei36":"...","osVersion":"Windows-10-10.0.26200","guid":"...","uskey":"<每次现签>","nonce":"<uuid>","reqScene":1,"taskType":"user","clientVersion":"1.60.3300.765","isIoa":false}
```

**`Ual-Access-MarvisExt` 是风控的关键**：缺它 → 403 `4100404 请求被风控拦截`。

## 3. uskey：每请求现签，单 key 限 2 次

`uskey` 由 Beacon SDK 本地生成：

```js
const beacon = require('E:/新建文件夹/Marvis/Application/1.60.3300.408/win32-native/beacon_napi.node');
beacon.init({ appKey: '0WIN06Y06DKV1IUQ', appVersion: '1.60.3300.408' });
const uskey = String(beacon.getUskey('marvis_client', { reqScene: 1, taskType: 'user' }));
```

**同一个 uskey 只能成功 2 次**（第 3 次起 403，75 秒后仍 403 = 配额不是频率）。必须每次请求现签。

## 4. 凭据

| 字段 | 来源 |
|---|---|
| openid / accessToken / refreshToken | `%APPDATA%\Tencent\Marvis\electron_data\marvis-login-state.json`（AES-256-CBC，密钥运行期派生，**解不开**）<br>绕过：直读 `MarvisAgent.exe` 进程内存 |
| guid | 注册表 `HKCU\SOFTWARE\Tencent\Marvis\Env\svid` |
| qimei36 | `MarvisExt` 里，或 `beacon.getQimei()` |

token 30 天有效，**refresh 会成对轮换**（旧 token 立即失效）。

## 5. 实测响应

非流式：
```json
{"choices":[{"message":{"content":"收到","reasoning_content":"我们需要回答…","role":"assistant"},
 "finish_reason":"stop"}],"model":"deepseek-v4-pro-202606",
 "usage":{"completion_tokens":42,"reasoning_tokens":40,"total_tokens":130}}
```

- 流式：`stream: true` → SSE `data: {...}`，`delta.reasoning_content` 逐 token
- 工具：`tool_calls` + `finish_reason: "tool_calls"`，参数正确解析
- 系统提示词：`messages[0].role = "system"` 生效

## 6. 模型

`model` 字段填**槽位名**，服务端路由到真实模型：

| 槽位 | 真实模型 |
|---|---|
| `deepseek-v4-pro-external` | `deepseek-v4-pro-202606` |
| `main-auto` / `app-auto` / `file-auto` / `computer-auto` / `browser-auto` | 服务端自动路由 |
| `hy3-preview-agent-real` | Hy3 预览 |
| `hunyuan-2.0-instruct-20251111` | 混元 2.0 |

## 7. 已知限制

- `uskey` 需 `beacon_napi.node`（Marvis 安装目录），插件要能定位安装路径
- token 只能靠跑着的 Marvis 进程或解不开的登录态文件
- 每请求一次 `beacon.getUskey` 调用
