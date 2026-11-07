# Marvis 外壳层（Electron 主进程 / MarvisHost / WmpfRuntime）接口面梳理

> 采集时间：2026-11-06 16:14–16:30 (+08:00)
> 目标机：本机（Windows，安装目录 `E:\新建文件夹\Marvis`，版本 1.60.3300.408）
> 约束：全程只读探测。**没有杀进程、没有重启任何组件、没有改配置。**
> 证据形式：`netstat`/`curl` 原始输出、日志 `文件:行号`、二进制字符串偏移、SQLite schema。

---

## 0. 一句话结论（先看这个）

**有可复用的本地入口，但它不是「模型代理」，而是控制面 + 一个配置级注入点。**

| 问题 | 结论 | 可反代复用？ |
|---|---|---|
| 有没有本地 HTTP 服务在跑 | **有 7 个** Marvis 相关监听端口（下面实测） | — |
| 有没有一个「本地模型转发服务」 | **没有**。本机没有任何把模型请求转发到云端的中间层进程 | ❌ |
| 能不能直接调本地 gateway | **能，已实测打通**：`ws://127.0.0.1:10123?token=<token>`（AGUI WebSocket，31 个 action） | ✅ 控制面 |
| 能不能让 Marvis 的模型流量走我的反代 | **能，走「自定义模型」配置**：`base_url` 明文存本地 SQLite，`api_key` 本地加密存储，请求由**本地** AgentCore（内嵌 litellm）发出 | ✅ **这是真正的反代落点** |
| gateway 里那个 `proxy_manager` / `relay` 是不是中转 | 是**远控中继**（node + operator 双隧道连腾讯 `wss://43.180.137.205:20017/ws`），**入站式**、证书固定，**不能**用来代理模型请求 | ❌ |

> 如果你要的是「让 Marvis 的对话请求打到我的服务」，可行路径是 **第 6.2 节的 `model_configs.base_url`**，不是本地服务。
> 如果你要的是「用脚本驱动 Marvis 干活」，可行路径是 **第 6.1 节的 AGUI WebSocket**。

---

## 1. 本地监听（实测）

### 1.1 `netstat -ano` 原始行（只截 Marvis 相关 PID）

```
  TCP    127.0.0.1:5284         0.0.0.0:0              LISTENING       33052
  TCP    127.0.0.1:5285         0.0.0.0:0              LISTENING       38364
  TCP    127.0.0.1:5286         0.0.0.0:0              LISTENING       42536
  TCP    127.0.0.1:10123        0.0.0.0:0              LISTENING       42340
  TCP    127.0.0.1:39099        0.0.0.0:0              LISTENING       42340
  TCP    127.0.0.1:29157        0.0.0.0:0              LISTENING       15428
  TCP    [::1]:29157            [::]:0                 LISTENING       15428
  TCP    127.0.0.1:40217        0.0.0.0:0              LISTENING       32080
  TCP    [::1]:40217            [::]:0                 LISTENING       32080
```

PID → 进程（`tasklist /FI "PID eq <pid>" /FO CSV /NH` 逐条核对）：

| 端口 | PID | 进程 | 命令行（节选） |
|---|---|---|---|
| 5284 | 33052 | `Marvis.exe` | `Marvis.exe --from "1002" --pseudo-protocol "androws://client/windowActive?..."` |
| 5285 | 38364 | `MarvisSvr.exe` | `...\win32-native\MarvisSvr.exe` |
| 5286 | 42536 | `AndrowsMCP.exe` | `...\win32-native/AndrowsMCP.exe` |
| 10123 | 42340 | `MarvisHost.exe` | `MarvisHost.exe start --log-dir ... --home-dir ...` |
| 39099 | 42340 | `MarvisHost.exe`（同进程，**FFI 载入的文档服务**） | 见 §3.2 |
| 29157 | 15428 | `MarvisDlSvr.exe` | 下载服务（无命令行参数） |
| 40217 | 32080 | `MarvisDlSvr.exe` | 下载服务（第二个实例） |

> `MarvisMCP.exe`(15044)、`MarvisAgent.exe`(33908) **没有任何 TCP 监听**（净测，见 §4.3：它们走命名管道）。

补充：本机**不相关**的其它监听（已排除，避免误判）：`5283` 属 `QQ.exe`（PID 13984）、`11888` 是我们自己起的 `node.exe`（PID 36276，`D:\DeepSeek Harness\default-workspace\projects\device\mailbird-zh\translator\server.mjs`，其 `/health` 指向 `http://127.0.0.1:3425/v1/chat/completions`，与 Marvis 无关）、`3425` 是 magpie、`62773` 是 DSH。

### 1.2 命令能通 / 不能通的实测结果

| 端口 | 协议 | 探测 | 结果 |
|---|---|---|---|
| 5284 | **HTTPS**（环回自签） | `curl -k https://127.0.0.1:5284/` | `HTTP/1.1 200 OK` + `Connection: close`，**空 body** |
| 5285 | **HTTPS** | 同上 | `HTTP/1.1 200 OK`，空 body |
| 5286 | **HTTPS** | 同上 | `HTTP/1.1 200 OK`，`Server: sctun`，`Content-Type: application/json`，空 body |
| 10123 | **HTTP + WS** | `curl http://127.0.0.1:10123/` | `401 Unauthorized`（无 token）→ **有鉴权** |
| 39099 | **HTTP** | `curl http://127.0.0.1:39099/localapi/version` | `200` + JSON（**无鉴权**） |
| 29157 | **HTTP** | `curl http://127.0.0.1:29157/` | `404 Not Found`，`Content-Length: 0`，`Cache-Control: no-cache`（Poco 风格，未探到业务路由） |
| 40217 | **HTTP** | `curl http://127.0.0.1:40217/` | 同上，`404 Not Found` 空体 |

> `5284`/`5285` 对普通 HTTP 请求回的是 `HTTP/1.0 400 Bad Request` + `Client sent an HTTP request to an HTTPS server.`——即它们只讲 TLS。
> `5286` 对普通 HTTP **不回任何字节**（直接空响应），只在 TLS 下给 `200`。
> 三者 TLS 下都只回 `200` 空体，**探测不到任何业务路由**；5286 的 `Server: sctun` 表明是腾讯的本地安全通道组件。它们不是可用的 API 面。

### 1.3 **未在监听**、但代码里存在的端口（重要，别当它活着）

| 端口 | 声明方 | 实测 | 真实归属 |
|---|---|---|---|
| **5151** | `marvis_agent.pyd` | `curl` → `Connection refused`；`netstat` 无 | **知识库服务**（Knowledgebase） |
| **15823** | `marvis_agent.pyd` | 同上 | **知识库服务**（另一处 base_url） |
| **6161** | `agent_port.ini`（`[DEFAULT] port = 6161`） | `Connection refused`；`netstat` 无 | AgentCore **上报用的端口文件，非实际监听**（见 §4.3） |

**逐条证据：**

- 5151 / 15823 —— `marvis_agent.pyd` 里的 `KBServiceClient` docstring：
  ```
  Usage::
      client = KBServiceClient(
          base_url="http://127.0.0.1:5151",
          search_timeout=10,
          invoice_timeout=300,
      )
      result = await client.call_tool("file_search", query="…")
      invoices = await client.is_invoice(["<absolute-path-to-image>"])
      ocr = await client.invoice_ocr("<absolute-path-to-image>")
  ```
  15823 同文件另一处 docstring：`base_url  ``http://127.0.0.1:15823``（同为 knowledgebase）`。
  未启动原因有旁证：渲染层 `KnowledgeBase.GetInstallStatus` 返回 `{"authorized":false,"installed":false,"matched":true}`（`Marvis.log`）。**知识库没装，所以这两个端口不通。**

- 6161 —— `Marvis.log:597`：
  ```
  [agent-core:port-file] 端口文件就绪: C:\Users\Administrator\AppData\Roaming\Tencent\Marvis\agent_port.ini → port=6161
  [port-registry] 端口已登记: agent-core@127.0.0.1:6161
  ```
  但实际连通用的是 **NNG IPC**，见 §4.3。

**⚠️ 两处「假命中」必须点掉**（背景资料里的说法到此为止）：

- `15823` 在 `treemap-KZPCXAKY-Be4vNIxw.js` 里出现 2 次，是 SVG path 数据（`6.15823 9.5491`），**不是端口**。
- `5151` 在 `AndrowsMCP.exe` 里出现 2 次，是 C++ 符号名（`lambda_5151cdb5e2d0e967b0ff9b516f4dde5e`），**不是端口**。
- 真正含 `http://127.0.0.1:5151` 的文件只有 `MarvisAgent/1.60.3300.765/_internal/marvis_agent.pyd`。

---

## 2. Electron 主进程：**没有对外 HTTP 接口**

`Marvis.exe` 主进程自己的 `127.0.0.1:5284` 只回 `200 OK` 空体（§1.2），没有可调的 API。

`resources/app.asar` 里主进程逻辑 `out/main/index.cjsc`（3.2 MB V8 字节码）中：
- `"localapi"` 出现 **0** 次
- `"39099"` 出现 **0** 次
- `"15823"` / `"5151"` 出现 **0** 次
- 唯一与本地相关的常量是 `http://127.0.0.1:`（后面拼端口）和 `/jsonrpc`

实测在 10123 上**没有**观察到该 `/jsonrpc` 可用（见 §5.2），所以主进程的对外接口面**就是零个 HTTP 端点**——它全靠 JSB（`window.*` 预加载桥）+ NNG IPC 与子进程通信。

---

## 3. `index.cjsc` 里的 URL / 路径常量（按域名分组）

抽取命令与结果可复现：

```bash
grep -aoE "(https?|wss?)://[a-zA-Z0-9._~:/?#@!$&'()*+,;=%-]{4,120}" out/main/index.cjsc | sort -u
```

### 3.1 分组表

| 域名 | 常量路径 | 用途（依据） |
|---|---|---|
| **`yybadaccess.3g.qq.com`**（主 API，**生产**） | `/v3`、`/v3/marvis_get_component_info`、`/v3/marvis_get_install_source`、`/v3/marvis_intelli_boot_cond`、`/v3/marvis_report_task` | 组件信息、安装来源、智能启动条件、**任务上报**。base 是 `https://yybadaccess.3g.qq.com/v3` |
| 同上 | `/marvis_client_login/marvis_oauth`、`/marvis_client_login_test/marvis_oauth` | **登录 OAuth**（正式 + 测试两套） |
| `yybadaccess.sparta.html5.qq.com`（**灰度/测试**镜像） | 与上面 5 条同构 | 灰度环境，同一套命令 |
| `yybadaccesstest.3g.qq.com` | — | 测试环境域名常量 |
| **`marvis.qq.com`** | — | 官网/落地页 |
| **`down.marvis.qq.com`** | `/ping` | **下载/更新探测** |
| **`api.dcl.qq.com`** | — | 数据上报/配置 |
| **`galileotelemetry.tencent.com`** | `/collect` | **埋点上报**（Galileo 遥测） |
| **`yyb-ai-launcher-offline.qq.com`** | — | 离线包/CDN（同时是 39099 文档服务的 `cors_origin`，见 §3.2） |
| `www.baidu.com` | `/s?wd=` | 「搜索」兜底跳转 |
| `http://127.0.0.1:` | 拼端口 | 本地服务基址（具体端口在其它模块里给） |

> 注意：`marvis-client.yyb.qq.com`（真正的 UI 页面）**不在** `index.cjsc` 里，它是 `loadURL` 的远端页面，出现在日志里：`[window] [wc] did-finish-load: wc=1 url=https://marvis-client.yyb.qq.com/?first_launch=1`。

### 3.2 39099 的真实身份：**文档预览服务**，不是网关

日志（`MarvisHost.log:313-321`）：

```
[modules::document::mod.rs:84]   文档服务建议端口: 39099
[modules::document::loader.rs:153] 调用文档服务 StartServer(新版, port=39099)，HTTP 服务启动中...
[modules::document::loader.rs:154]   └ 入参 SdkServerConfigFFI: port=39099, static_dir=<null>,
                                     cors_origin="yyb-ai-launcher-offline.qq.com", log_dir="..."
[modules::document::loader.rs:99]  文档服务 StartServer 调用成功，实际监听端口: 39099
[store::mod.rs:424]               store: 文档服务端口变更 None -> 39099
```

即：**MarvisHost 进程内通过 FFI 加载 DocPreview 文档 SDK，由它自己监听 39099**（所以 netstat 归到 PID 42340）。实测：

```
GET http://127.0.0.1:39099/localapi/version
→ 200 {"build_time":"2026-07-16T04:08:44Z","channel":"common","code":0,
       "commit_id":"201f3379fdde24b82d779e7fbd09a2870c44192e","message":"ok","version":"0.0.0.248"}
```

**路由前缀是 `/localapi`，`/api` 是它的别名**（实测 `/api/version` → 200；而 `/api/foo` 的错误回包回显规范化为 `{"error":"Unknown endpoint: /localapi/foo"}`）。

探测到的路由只有 `/version` 一个；`/health`、`/status`、`/ping`、`/v1/*`、`/metrics` 全部 `404`。
**无鉴权，但只有文档能力，没有模型能力。**

---

## 4. MarvisHost 的角色

### 4.1 是什么

**Rust 写的本地网关**，crate 名 **`xiaobao_gateway`**，版本 `0.5.6`（build `202610292103`）：

```
MarvisHost.log:5  INFO xiaobao_gateway::bootstrap (src\bootstrap.rs:131) - Xiaobao Gateway started version="0.5.6" build="202610292103"
```

判定依据：二进制里 `rustc` 出现 174 次、`go1.` 仅 3 次（依赖带入）；模块路径全是 Rust 风格（`src\bootstrap.rs`、`src\infra\remote_config.rs`、`src\modules\proxy\...`）。

已启动的子模块（`MarvisHost.log` 逐条）：`infra::remote_config`、`infra::beacon`、`infra::logger`、`modules::file_proxy`、`modules::document`、`modules::skill`、`modules::schedule`、`modules::switch`、`modules::common_config`、`modules::push`、`modules::mcp`、`agent_runner`、`proxy`。

### 4.2 它对外暴露的两个口

| 口 | 鉴权 | 本体 |
|---|---|---|
| `http://127.0.0.1:10123`（HTTP + **WebSocket**） | **token（query 参数 `?token=`）** | **AGUI 事件网关**（`gateway` 模块） |
| `http://127.0.0.1:39099/localapi/*` | 无 | 文档预览 SDK（§3.2，FFI 载入） |

`MarvisHost.log:97`：
```
xiaobao_gateway::gateway (src\gateway\mod.rs:334) - 监听地址: http://127.0.0.1:10123
```

### 4.3 它和 Electron 怎么通信：**NNG IPC**（不是 HTTP、不是 stdin/stdout）

日志（`MarvisHost.log:197`）：

```
xiaobao_gateway::agent_runner::runner (src\agent_runner\runner\mod.rs:234)
  - dial agent core IPC 连接 endpoint=ipc:///tmp/marvisagent_k9Xm2P7vB4nQ8wLY runner_pid=42340
```

实测命名管道列表（`os.listdir(r'\\.\pipe\\')`，346 个管道中筛 Marvis 相关）：

```
796CE576-8533-4B76-A00B-E466B632BC87_1.60.3300.408     ← MarvisSvr
tmp\marvisagent_k9Xm2P7vB4nQ8wLY                        ← gateway ↔ AgentCore（NNG ipc）
marvis-codeagent-acc5717059bbaceb633fb699               ← CodeAgent 通道
marvis-viewer-tunnel-1f896a75bb9b15b1c17a6856           ← 预览隧道
tmp\marvisgateway_kb                                    ← gateway ↔ Knowledgebase
```

二进制侧印证（`MarvisHost.exe` 字符串）：`gateway-nng-ipc`、`gateway-nng-ipc-win32`、`gateway_nng_ipc__server_started`、`gateway_nng_ipc__base_init_received`、`gateway_nng_ipc__send_failed`、`gateway_nng_ipc__wait_init_timeout`。

**Electron 主进程 ↔ gateway** 走同一套 NNG IPC，协议帧形如（`MarvisHost.log:191`）：
```json
{"type":"send","protocalVersion":"1.0","callbackId":"notify-5d7ed905-...", ...}
```
（注意拼写就是 `protocalVersion`，不是笔误。）

**结论：`agent_port.ini` 里的 6161 只是「端口文件」这条旧通道的产物，实际 IPC 是管道，6161 从来没在监听。** 这一点很重要——按 6161 去连会直接 `Connection refused`。

### 4.4 内嵌的 `proxy_manager` / `relay`（**远控中继，不是模型中转**）

`MarvisHostStd.log` 完整启动链：

```
[proxy_manager] build_and_start_all: start, openId=4AC5C9…A65A, create_proxies=true
[proxy_manager] fetch_relay_info: start
[association]   create association success, guid=cc1fed…b441
[schedule]      relay_info: ip=43.180.137.205, port=20017, session_id=3022cc08-6edd-43c1-859b-ac682e8da98c
[proxy_manager] Proxy node created
[proxy_manager] Proxy operator created
[proxy] cert_pin: connecting to 43.180.137.205:20017
[proxy] node: WSS cert verify passed for wss://43.180.137.205:20017/ws
[proxy] node: local <-> proxy connected to WebSocket: wss://43.180.137.205:20017/ws
[proxy] operator: local <-> proxy connected to WebSocket: wss://43.180.137.205:20017/ws
[heartbeat] status=1(online), plugin_version=2026.6.9, token expire=1796544478
```

`netstat` 旁证（PID 42340 两条到同一 IP:端口的 ESTABLISHED）：
```
  TCP    192.168.1.3:53704      43.180.137.205:20017   ESTABLISHED     42340
  TCP    192.168.1.3:53708      43.180.137.205:20017   ESTABLISHED     42340
```

二进制里的协议名：`relay.send`（32 次）、`relay.respond`、`relay.event`、`relay_request_id`、`relay_handler.rs`、`cert_pin`。

**定性**：这是「手机/远端操作本机」的**入站**中继。本机主动外连腾讯中继服（证书固定 pinning），远端 operator 通过它下发指令。方向是**外面打进来**，且信任锚在服务端（`guid` 绑定 + certificate pinning），**无法改成代理模型请求**。

---

## 5. 实测：本地 gateway WebSocket 可直接调用（已打通）

### 5.1 token 从哪来

`Marvis.log:611`（渲染层日志直接把它打了出来）：

```
[AiStarter.GetGatewayToken][call] end code: 0 msg: "{\"token\":\"6e8a667b-e44e-4f69-8871-911c9ee519ea\",\"port\":10123}"
GatewayStore|fetched gateway token, port: 10123
```

同一 token 也出现在 WS 建连日志（`Marvis.log:524`）：
```
[Chat][useConnection] creating AGUIConnection #1, url=ws://127.0.0.1:10123?token=6e8a667b-e44e-4f69-8871-911c9ee519ea, deps=[...]
```

获取方式（任选）：
1. 读 `%LOCALAPPDATA%\Temp\Tencent\Marvis\logs\Marvis.log` 里 `GetGatewayToken` 那行；
2. 走 JSB `window.AiStarter.GetGatewayToken()`（渲染层可见，见 §5.4）。

### 5.2 WebSocket 握手（原始 socket 实测）

```
GET /?token=6e8a667b-e44e-4f69-8871-911c9ee519ea HTTP/1.1
Host: 127.0.0.1:10123
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <random>
Sec-WebSocket-Version: 13
Origin: https://marvis-client.yyb.qq.com
```

回包：

```
HTTP/1.1 101 Switching Protocols
connection: upgrade
upgrade: websocket
sec-websocket-accept: 49x2dgnLeyUk/ilMrINAEUh6p/A=
access-control-allow-origin: https://marvis-client.yyb.qq.com

\81U{"data":{"agentConnectionStatus":"Ready"},"event":"gateway.connected","type":"event"}
```

- 路径是**根 `/`**，token 必须在 query。
- **无 token → `HTTP/1.1 400 Bad Request`**（实测）。
- `/jsonrpc` 作为 **WS 路径**被拒（`400 Bad Request`）；作为 HTTP `POST` 在 10123 上恒为 `401`（鉴权先于路由，所以**无法证明**该 HTTP 路由是否存在）。
  `index.cjsc` 里的 `/jsonrpc` 常量在当前版本**未观察到可用入口**，按未验项处理（见 §9.4）。

### 5.3 协议帧格式（从渲染层 bundle 反推 + 实测确认）

出站请求（`treemap-KZPCXAKY-Be4vNIxw.js`，`send()` 实现）：

```js
const a = { event: t, requestId: i, payload: n }   // t=事件名, i=自增字符串, n=payload
```

入站三种：

| `type` | 含义 |
|---|---|
| `event` | 服务端主动推送，`{type:"event", event:"gateway.xxx", data:{}}` |
| `ack` | 请求成功，`{type:"ack", requestId, data:{ok:true,...,request_id,trace_id}}` |
| `error` | 请求失败，`{type:"error", requestId, message}` |

另有 v2 入站协议：`{protocol_version:"v2", action, request_id}`，客户端需回 `{protocol_version:"v2", request_id, type:"ack", action, ok}`。

已观测的推送事件名（渲染层 `onGatewayEvent` 分支）：`gateway.connected`、`gateway.agent_connect_status_change`、`gateway.tick`、`gateway.user_message`、`gateway.user_action`、`gateway.message_*`、`gateway.chat_*`、`gateway.settings_changed`、`gateway.schedule_changed`、`gateway.skill_changed`、`gateway.common_config_changed`、`gateway.markdown_changed`、`gateway.model_changed`、`gateway.push.dispatch`、`cli.auth.request`、`mcp.oauth.request`。

### 5.4 实测结果（每条都是真发出去的）

```
>>> {"event":"gateway.supports","requestId":"1","payload":{}}
<<< {"data":{"action":"gateway.supports","error":{"code":"invalid_action",
     "message":"Unknown action: 'gateway.supports'. Valid actions: [...]"}}}

>>> {"event":"feature.get","requestId":"2","payload":{}}
<<< {"data":{"action":"feature.get","data":{"features":{
       "conversation_pinning":true,"conversation_rename":true,
       "mcp_oauth_support_marvis_uri":true}},"ok":true,...},"type":"ack"}

>>> {"event":"conversations.list","requestId":"3","payload":{"limit":3,"offset":0}}
<<< {"data":{"action":"conversations.list","data":{"conversations":[{
       "conversation_id":"conv_e66607aedb1744339e47621dba9a73ee",
       "title":"查看模型提示词","status":"completed", ...}],
       "has_more":false,"total":1},"ok":true},"type":"ack"}

>>> {"event":"token.wallet","requestId":"5","payload":{}}
<<< {"data":{"action":"token.wallet","data":{"avail_tokens":"9985017",
       "used_tokens":"14983","total_tokens":"10000000",
       "openid":"4AC5C9…A65A","status":1},"ok":true},"type":"ack"}
```

### 5.5 权威动作清单（gateway 自己吐出来的 31 条）

`gateway.supports` 不是合法动作，但它的错误回包把**完整白名单**打了出来（原文 31 条，另 1 条是我发的 `__dump__` 被回显）：

```
blocking.resolve          browser.list                browser.login.open
browser.status            device.notify               feature.get
mcp.cancel                mcp.create                  mcp.delete
mcp.disable               mcp.enable                  mcp.get
mcp.list                  mcp.update                  persona.get
product.get               skills.notify               token.conversation_usage
token.conversations_usage token.usage_logs            token.wallet
tool_calls.approve        tool_calls.download_app     tool_calls.execute
tool_calls.get_app_status tool_calls.notify           tool_calls.pause_download
tool_calls.resume_download tool_calls.stop_download   tool_calls.update_app
user.get_credentials      user.login                  user.logout
```

**关键判断：这 31 条全是控制面（MCP 管理 / token 账目 / 工具调用审批 / 浏览器 / 用户 / 人格 / 商品）。`chat` 不在其中，也没有任何 `completion` / `message.send` 类动作。**
所以 **AGUI WebSocket 不能用来跑模型补全** —— 它只推事件、只调控制面。

（渲染层里 `U0n = new Set(["chat"])` 指的是**入站事件名** `chat`，用于日志降噪，不是可发起的 action。）

### 5.6 可直接复用的最小脚本

`C-raw/wsclient.py`（已落盘，纯标准库，无第三方依赖）：

```python
from wsclient import WS
w = WS()                                     # 自动握手 + 带 token
w.drain(2.0)                                 # 收 gateway.connected
w.send({"event": "conversations.list", "requestId": "1", "payload": {"limit": 5}})
w.drain(2.5)                                 # 打印 ack
```

`C-raw/valid_actions.txt`、`C-raw/valid_actions_raw.json` 是本次抓到的原始回包。

---

## 6. 「现成的本地中转」——逐条排查结论

### 6.1 排查表

| 候选 | 是不是本地中转 | 证据 | 能否反代复用 |
|---|---|---|---|
| `MarvisHost` gateway WS (10123) | 控制面网关 | §5 | ✅ 驱动控制面，❌ 不跑模型 |
| `MarvisHost` `proxy_manager` / `relay` | **远控中继**（外连 `43.180.137.205:20017`） | §4.4 | ❌ 入站、证书固定、服务端绑定 guid |
| `MarvisSvr.exe` (5285 + 命名管道) | 设备/会话保活服务，外连 `180.109.156.157:443`、`14.22.9.191:33555` | `netstat` ESTABLISHED | ❌ 无 HTTP 业务面 |
| 文档服务 (39099) | 文档预览 | §3.2 | ❌ 只有 `/version` 等文档路由 |
| 知识库服务 (5151 / 15823) | 知识库检索 | §1.3 | ❌ 未安装、端口不通 |
| `AndrowsMCP.exe` (5286, `sctun`) | 安卓/应用宝本地通道 | §1.2 | ❌ 200 空体，无路由 |
| `llama-server.exe`（本地推理） | **存在但未安装** | `index.cjsc` 有 `InferenceFrame\llama.cpp\llama-server.exe`；`LocalLLMManager.HasLocalModelServiceLaunched` → `{"launched":false}`；安装目录里 `find -iname "*llama*"` **无结果** | ❌ 未落地 |
| **AgentCore `model_configs`** | **本地发起的模型调用** | **§6.2** | ✅ **这才是落点** |

### 6.2 真正的反代落点：`model_configs.base_url`（本地 SQLite，明文）

AgentCore 的库：`%APPDATA%\Tencent\Marvis\User\<openid>\database\business.db`

实测 schema（`PRAGMA table_info(model_configs)`）：

```
config_id TEXT          display_name TEXT       provider_id INTEGER
provider TEXT           plan_id INTEGER         plan_name TEXT
base_url TEXT           model_id TEXT           salt BLOB
api_key_ciphertext BLOB api_key_fingerprint TEXT key_tail TEXT
advanced_json TEXT      status TEXT             unavail_reason TEXT
synced_at INTEGER       created_at INTEGER      updated_at INTEGER
```

旁证：
- `MarvisHost.exe` 里有完整 DML：`UPDATE model_configs SET base_url = ?, updated_at = ? WHERE config_id = ?`、`UPDATE model_configs SET model_id = ?...`、`UPDATE model_configs SET display_name = ?...`。→ **`base_url` 是可写字段。**
- `MarvisAgent/_internal/litellm/` 存在 → AgentCore 用 **litellm** 发模型请求（支持任意 `base_url` + `api_key` 的 OpenAI 兼容端）。
- 渲染层有「自定义模型」UI（`treemap-...js` @6675230：`{value:"custom",label:"自定义模型"}`），并带 `base_url` / `api_key` / `model_id` / `display_name` / `advanced` 表单（@6441214 的 mock 数据给出了确切形状）：
  ```js
  {config_id:"cfg_mock_glm", display_name:"GLM-5.1-Air", provider:"custom",
   base_url:"https://open.bigmodel.cn/api/paas/v4/chat/completions",
   model_id:"glm-4-air", api_key_fingerprint:"sk-...2c1d", status:"unavailable",
   unavail_reason:"invalid_key"}
  ```
  **`base_url` 是完整 URL（含 `/chat/completions`），可以填任意主机——包括 `http://127.0.0.1:<port>/v1/chat/completions`。**

**结论与限制（必须说清）：**

1. ✅ 自定义模型的请求由**本地 AgentCore（Python + litellm）**发出，`base_url` 明文、`api_key` 本地加密（`api_key_ciphertext` + `salt`）。所以指向本机反代**在链路上成立**。
2. ⚠️ 这只覆盖「**自定义模型**」。默认的「管家」模型（`model_show_desc` = `Hy4、Deepseek V4.1 flash`，见 `common-config.json`）走腾讯云端，并做 token 计费（`token.wallet` 的 `used_tokens=14983 / total 10000000`），**不读本地 `base_url`**。
3. ⚠️ 当前 `model_configs` **表内 0 行**——本机还没配过自定义模型，所以这是「可配置出来的入口」，不是「已在运行的入口」。
4. ❗ 我没有修改配置去实测（任务限定只读）。**「填 localhost 后 Marvis 是否接受（是否校验非环回地址）」属于未验项。**

### 6.3 直接回答验收问题

> **「外壳层有没有可复用的本地代理入口？」**

**分两种「代理」：**

- **模型代理（把补全请求转出去）——没有现成的。** 本机没有任何常驻进程在把模型请求转发到云端；`proxy_manager`/`relay` 是入站远控中继，`sctun`/文档服务/知识库都不是模型通道。
  → 想反代模型，**不要复用它的本地服务**，而是走 §6.2 的 `model_configs.base_url`，把 Marvis 接到你自己的反代上。

- **控制面代理（用脚本驱动 Marvis）——有，且已验证可用。**
  调用方式：
  ```
  1) 取 token：%LOCALAPPDATA%\Temp\Tencent\Marvis\logs\Marvis.log 里搜 "GetGatewayToken"
     （形如 {"token":"<uuid>","port":10123}）
  2) 连：ws://127.0.0.1:10123/?token=<uuid>   [Origin 建议 https://marvis-client.yyb.qq.com]
  3) 发：{"event":"<action>","requestId":"<n>","payload":{...}}
  4) 收：{"type":"ack","requestId":"<n>","data":{...}}
     action 白名单 = §5.5 那 31 条
  ```
  现成客户端：`C-raw/wsclient.py`。

---

## 7. WmpfRuntime：**微信小程序运行时，不是聊天 UI**

目录 `WmpfRuntime\1.60.3300.7\`：

```
host\      wmpf_host_export.dll (3.1 MB) / wmpf_host_export_x64.dll (3.7 MB)
runtime\   WeChatAppEx.exe (1.8 MB) / flue.dll (211 MB) / XNet.dll / ilink2.dll
           VoipEngine.dll / MSPSDK.dll / ConfSdk.dll / ComponentVerification.dll
           AndrowsInstaller.exe / WxgameDaemon.exe / env_detect.exe
           ffmpeg.dll / d3dcompiler_47.dll / dxcompiler.dll / icudtl.dat
```

`file_component.xml`：
```xml
<filter appClientId="UniWeChatWin" appClientVerMin="0xF2540001" sdkMin="240401"
        runtimeAbis="x64" deviceAbis="x64" version="20121" />
<depsPlugin name="XEditor" pluginMin="21000" />
<subPlugin name="WMPFDrm" pluginMin="1002" />
<subPlugin name="XFilesOfficeReader" pluginMin="6000" />
<subPlugin name="PcYybSdk" pluginMin="3000" />
```

判定：
- `wmpf` = **WeChat Mini Program Framework**；`appClientId="UniWeChatWin"` 直接说明它是**微信 Windows 端小程序运行时**的移植件。
- `flue.dll`（211 MB）是微信的 Flutter/渲染运行时；`XNet.dll` 是微信网络层；`ilink2.dll` 是微信 iLink 协议；`VoipEngine.dll` 是音视频。
- `PcYybSdk` + `AndrowsInstaller.exe` + `AndrowsMCP.exe` ⇒ 与**应用宝（yyb）安卓应用/小游戏**生态打通。

**是不是承载聊天 UI：不是。** 聊天 UI 是 Electron 渲染进程加载的**远端网页**：`https://marvis-client.yyb.qq.com/?first_launch=1`（`Marvis.log` 的 `did-finish-load`）。WmpfRuntime 属于**周边能力**（跑小程序/小游戏、文档阅读 XFilesOfficeReader、DRM），且当前**没有 Wmpf 相关进程在运行**（`tasklist` 里无 `WeChatAppEx.exe` / `WxgameDaemon.exe`）。

---

## 8. 完整进程/管道拓扑（本机实测）

```
Marvis.exe (33052, Electron main)
├─ Marvis.exe --type=gpu-process      (42856)
├─ Marvis.exe --type=utility network   (37772)
├─ Marvis.exe --type=renderer          (4200)  → loadURL https://marvis-client.yyb.qq.com/
├─ Marvis.exe --type=crashpad-handler  (28472)
└─ MarvisAgent.exe (33908)  ← AgentCore, PyInstaller(Python 3.11), --work_mode=cloud
                             IPC: ipc:///tmp/marvisagent_...  + pipe marvis-codeagent-...

MarvisHost.exe (42340)  ← xiaobao_gateway (Rust 0.5.6)
├─ HTTP/WS 127.0.0.1:10123  (AGUI, token)
├─ HTTP 127.0.0.1:39099     (文档服务, FFI in-process)
├─ NNG IPC ↔ Electron (tmp\marvisagent_*, MarvisHost 侧 dial)
├─ WSS → 43.180.137.205:20017/ws  ×2 (node + operator, cert pin, 远控中继)
└─ WSS → yybadaccess.3g.qq.com (推送/命令)

MarvisSvr.exe (38364)   ← pipe 796CE576-..._1.60.3300.408；HTTPS 127.0.0.1:5285
AndrowsMCP.exe (42536)  ← HTTPS 127.0.0.1:5286 (Server: sctun, 与 QQ.exe:5283 同族)
MarvisMCP.exe (15044)   --ai-launcher（无 TCP 监听）
MarvisDlSvr.exe (15428) ← HTTP 127.0.0.1:29157 + [::1]:29157
MarvisDlSvr.exe (32080) ← HTTP 127.0.0.1:40217 + [::1]:40217
```

> 更正记录：我在初稿里曾把 `29157`/`40217` 写成「未监听」，这是错的。复测
> `netstat -ano | grep LISTENING | grep -E "\s15428\s*$"` 明确给出
> `TCP 127.0.0.1:29157 0.0.0.0:0 LISTENING 15428`，两个 `MarvisDlSvr` 实例**都在监听**。
> 上表已按复测结果修正。

---

## 9. 未验项 / 需要你决定才能推进的

1. **`model_configs.base_url` 填 `127.0.0.1` 是否被接受**——需要写一次配置（会改 AgentCore 的 `business.db`）。任务限定只读，我没动。改前请备份 `business.db`。
2. **自定义模型的 key 是否也本地解密直发**——`api_key_ciphertext` + `salt` 在本地，但解密逻辑在 `marvis_agent.pyd`（编译产物）里，未逆。
3. **`relay.send` / `relay.respond` 的完整消息体**——只拿到协议名与方向，未抓到具体帧（需要抓 43.180.137.205:20017 的流量，涉及中间人证书，未做）。
4. **`/jsonrpc` 这条老通道**——`index.cjsc` 有常量，但 10123 上 WS 路径被拒、HTTP 恒 401（鉴权先于路由，无法判定路由存在性）；是否在别的端口/别的启动参数下启用，未找到入口。

---

## 10. 复现命令索引

```bash
# 端口
netstat -ano | grep LISTENING
tasklist //FI "PID eq 42340" //FO CSV //NH

# 端口定性
curl -s --noproxy '*' -i http://127.0.0.1:39099/localapi/version
curl -s --noproxy '*' -i http://127.0.0.1:10123/                    # 401
curl -sk --noproxy '*' -i https://127.0.0.1:5286/                   # sctun 200

# 二进制字符串
tr -c '[:print:]' '\n' < MarvisHost.exe > mh.str && grep -oE "gateway\.[a-z_.]+" mh.str | sort -u

# 日志
grep -an "GetGatewayToken\|ws://127.0.0.1:10123" \
  "%LOCALAPPDATA%/Temp/Tencent/Marvis/logs/Marvis.log"

# WS 实测
python C-raw/wsclient.py
```

**附：本次落盘的原始素材**（`D:\DeepSeek Harness\反代\_marvis\C-raw\`）

| 文件 | 内容 |
|---|---|
| `wsclient.py` | 可运行的 AGUI WebSocket 客户端（标准库） |
| `wsprobe.py` | 最简握手探测 |
| `valid_actions.txt` / `valid_actions_raw.json` | gateway 吐出的 31 条动作白名单原始回包 |
| `enum_actions.py` / `frame.py` | 从渲染层 bundle 抽 action / 帧格式的脚本 |
| `extract_treemap.py` | 渲染层 bundle 定点取上下文 |
| `pipes.py` | 命名管道枚举 |
