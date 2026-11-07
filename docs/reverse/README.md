# 逆向材料索引

这些文档是**腾讯 Marvis 上游协议**的实测记录，来自对官方客户端的逆向
（asar 解包 + 字节码字符串 + 进程内存 + 实发请求），不是官方文档。

**改 `src/` 之前先读这里** —— 很多结论看着反直觉，但都是实测出来的死码。

| 文件 | 管什么 | 什么时候读 |
|---|---|---|
| [MARVIS-PROTOCOL.md](./MARVIS-PROTOCOL.md) | **总纲**：端点、请求头、uskey 签名、凭据来源、模型槽位表、已知限制 | 第一次接触这个上游 |
| [A-llm-protocol.md](./A-llm-protocol.md) | **模型网关**（`/v1/chat/completions`）：OpenAI 兼容形状、UA、`Ual-Access-MarvisExt` 指纹、流式/工具调用实测 | 改 `loader.mjs` / `protocol.mjs` |
| [B-auth.md](./B-auth.md) | **登录与续期**：OAuth 两种登录、`-109`/`-107` 死码、token 落地位置、**续期端点是 `POST /marvis_client_login/marvis_refresh_token`**、轮换语义、错误码表 | 改 `login.mjs` / `refresh.mjs` / `methods.mjs` |
| [C-app-api.md](./C-app-api.md) | **业务接口**（`/v3/*`）：钱包、用户信息、签名算法 | 改 `usage.mjs` / `quota.mjs` / `profile.mjs` |

## ⚠ 四条最容易踩的结论

0. **magpie 的 `auth.refresh` 收的是 `(auth, provider)` —— 第一个参数是账号对象，不是 getter**。
   只有 `loader` / `usage` / `checkin` 收 `getAuth` 函数（`HOOKS.md` 第五节对照表）。
   写成 `getAuth()` 会让 magpie 报 `getAuth is not a function`，续期**一次都跑不起来**
   （0.2.13 及以前就是这样，见 CHANGELOG 0.2.14）。

1. **续期端点只有 `POST /marvis_client_login/marvis_refresh_token`**（`B-auth.md` §5.2 / §6.3）。
   `GET /v3/marvis_refresh_token` 恒定回 `-109 RefreshToken missing required param` ——
   0.2.13 及以前一直调的是这个，导致**续期从来没成功过**（见 CHANGELOG 0.2.14）。

2. **微信的 `expires_in` 只有 7200 秒（2 小时），QQ 是 ≈2591962 秒（30 天）**。
   两者差 360 倍，任何「统一按 30 天算」的地方都会让微信账号 2 小时后 401。

3. **`-109` / `-7` / `-5` 都不是登录失效**。只有 `-107`（`RC_NO_AUTH_ERR`）
   和 `-101`（会话不存在）才该标 `signIn: "expired"` ——
   标错了 magpie 会把好账号标成「需要重新登录」（AGENTS 坑 6 同类）。

## 原始材料在哪

完整抓包、asar 解包、字节码字符串（**约 1.3 GB，不进仓库**）留在：

```
D:\DeepSeek Harness\反代\_marvis\
├── asar\               # 客户端 asar 解包
├── lead\               # 字节码 / 运行时
├── *_str.txt           # 各模块的字符串常量（main/host/agent/beacon/bwrap/bnapi/pcyyb/llmsdk/native）
└── B-raw\              # 登录链路的原始探测脚本与命中记录
```

需要复现某条结论时去那里翻；本目录只放**结论**，不放证据原件。
