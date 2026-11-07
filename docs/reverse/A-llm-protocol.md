# Marvis LLM 调用协议还原报告（A）

- 目标：`E:\新建文件夹\Marvis\MarvisAgent\1.60.3300.765\_internal\marvis_agent.pyd`（37,161,240 B，Cython/Nuitka cp311）
- Shell：Electron 1.60.3300.408；Agent：1.60.3300.765；内置 `openai==2.32.0`、`httpx2==2.3.0`
- 证据记号：
  - **S:行号** = `agent.str.txt:行号`（预提取的二进制字符串表，`_marvis/agent.str.txt`）（该表只保留 ASCII，中文全部丢失，故中文结论另用二进制偏移定位）
  - **C:行号** = 从二进制**解密出来的** `config_defaults.yaml`（本报告 `A-raw/config_defaults.yaml`，源文件 `_internal/CONFIG`）
  - **B:偏移** = `marvis_agent.pyd` 内的原始字节偏移（用于中文 docstring）
- 全文结论要么有 S/C 证据，要么显式标「未证实」。

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 对话补全 URL | `https://yybadaccess.3g.qq.com/v1/chat/completions`（OpenAI 兼容，**不是** `/v3/` 业务端点） |
| 是否直连 | 是：OpenAI SDK 直连该 host，无二次网关；`model_gateway` 仅在**重排**端点名里出现（`/v3/pcyyb_ai_assistant_model_gateway_rerank`） |
| 默认模型 | 配置 key `default` → `model: "deepseek-v4-pro-external"`（C:164）；实测实际在跑 `main-auto` / `hy3-preview-agent-real` |
| 请求体 | OpenAI chat.completions 标准字段 + `extra_body` 平铺到 body 根（`thinking_enabled`/`thinking`/`tool_stream`/`enable_enhancement`/`web_search_options`） |
| 流式 | `stream:true` + SSE `data: {...}` + `data: [DONE]`，`stream_options.include_usage`，思维链走 `delta.reasoning_content` |
| 鉴权 | `api_key="placeholder"` → `Authorization: Bearer placeholder`；真正鉴权是 `Ual-Access-*`（PC 登录态）或 `Marvis-*` AK/SK HMAC-SHA256 |
| 签名可复现 | 是。AK/SK：HMAC-SHA256(secret_key, nonce + "\n" + timestamp)；UAL 代理：HMAC-SHA256("fsgjhfgs45fd", openid + timestamp + nonce)；均输出小写十六进制 |
| 配置来源 | `<install>/_internal/CONFIG`，Fernet 加密的 `config_defaults.yaml`；**已解密并给出配方**（§6.2） |
| 可调模型数 | 25 个模型 key（含 1 个本地模板、1 个 warmup、1 个占位），全部 `yybadaccess` |

## 1. 对话补全端点

### 1.1 host 与路径

- 业务 host 只有一个：`https://yybadaccess.3g.qq.com`
  - S:137515（`FileFmtConvertService` 默认 base_url）、S:137496（doc：`` `config_defaults.yaml` `` → `` `tools.file_fmt_convert.base_url` `` 默认 `https://yybadaccess.3g.qq.com`）、S:197252（trag_search）
  - C:47 / C:136 / C:166（配置里 `base_url: "https://yybadaccess.3g.qq.com/v1"`）
- 全表里**没有**任何 `/chat/completions` 业务字面量，路径由 SDK 补全：
  - S:116567 `` ``https://host/v1/chat/completions`` ``，S:116576 `` ``https://host/v1`` ``，S:116581 `_strip_sdk_path_suffix`
  - 中文原文（B:34,351,868）：「对齐底层 SDK 的 base_url 契约：仅剥离 SDK 会自动补全的末段资源路径……上游可能把完整接口地址（如 `https://host/v1/chat/completions`）当作 base_url 传入，而 OpenAI/Anthropic SDK 会在 base_url 之后自行补全末段资源路径，导致重复拼接返回 404。这里只去掉 SDK 补全的那一段，保留 `/v1` 等业务层级」
- 因此最终 URL = `base_url`（去掉尾部 `/chat/completions`）+ `/chat/completions`：

```
https://yybadaccess.3g.qq.com/v1  +  /chat/completions
= https://yybadaccess.3g.qq.com/v1/chat/completions
```

- Anthropic provider 的两个模型（`claude-sonnet-4-6` / `claude-opus-4-6` / `claude-opus-4-6-thinking`）`base_url` 是**根路径** `https://yybadaccess.3g.qq.com/`（C:272），SDK 会补 `/v1/messages`（S:116581 同段中文提到 Anthropic）。
- `ai_agent.llm.custom_model_pool` 里还有一处 `/messages` 与 `/chat/completions`（S:116762-116763），同样只是剥离 SDK 资源后缀用。

### 1.2 为什么不走 `/v3/` 网关

`/v3/` 全部端点（S 全表 grep，去重）与对话无关：

- 钱包/额度 `/v3/marvis_get_wallet`（S:133667, S:135143）
- 向量 `/v3/marvis_embeddings`（bge-small-zh-v1.5, dim 512；S:58129, S:135302, C:1221）
- 重排 `/v3/pcyyb_ai_assistant_model_gateway_rerank`（`query`+`documents`；S:135405, S:135424）——**唯一带 `model_gateway` 字样的端点，只做重排**
- 审计 `/v3/aigc_audit`、`/v3/comment_audit`（S:135577, S:135644）；检索 `/v3/marvis_trag_search`、`/v3/marvis_web_search`（S:197272, S:223198）
- COS `/v3/marvis_get_temp_cred`、`_pre_sign_url`、`_delete_cos_objects`、`_add_watermark`（S:137277, S:137308, S:137230, S:137386）
- 文件转换 `/v3/marvis_create_file_convert_task`、`_get_file_convert_task_result`（S:137516-137517）
- 用户设置 `/v3/marvis_get(s)et_user_basic_settings`（S:143332, S:143370）；MCP 市场 `/v3/marvis_get_mcp_by_trag`、`_get_mcp_service_detail`（S:203661, S:203757）
- 定时任务租约 `/v3/marvis_scheduled_task_lease_acquire|_release`（S:230339-230341）；统计 `/v3/marvis_list_daily_agent_tag_stats`、`_list_conversation_token_stats`（S:135170, S:135231）；灰度 `/v3/marvis_query_beta_enroll`（S:229411）

结论：**LLM 调用与业务 `/v3/*` 是两条独立通道**，前者走 OpenAI SDK 的 `/v1/chat/completions`，后者走 `YybadAccessClient.post_json`（§4.5）。

## 2. 请求体 schema

构造点在 `OpenAIAdapter.astream`（S:115153-115180 常量序列：`model / messages / _prepare_messages / stream / include_stream_usage / include_usage / stream_options / enable_thinking / temperature / max_tokens / _is_max_completion_tokens_model / max_completion_tokens / tools / extra_body / response_format`）。

| 字段 | 类型 | 取值来源 | 证据 |
|---|---|---|---|
| `model` | str | `LLMClientConfig.model_id`（= C 里 `models.<key>.model`，**不是** key） | S:115100 附近 `amodel`, `amodel_id`；C:164 |
| `messages` | array[obj] | OpenAI 格式 dict 列表，先过 `_prepare_messages` | S:115153 `_prepare_messages` |
| `stream` | bool | 恒 `true`（`ainvoke` 也是 `astream` 聚合，S:115958-115963） | S:115108 |
| `stream_options` | obj | `{"include_usage": true}`，由 `config.include_stream_usage` 控制 | S:115156-115157 |
| `temperature` | float | C 里 `temperature`（多数为 `0`） | C:167 |
| `max_tokens` | int | C 里 `max_tokens`（默认 32000 / 8000 / 8192） | C:168 |
| `max_completion_tokens` | int | model_id 以 `gpt-4o` / `gpt-5` 开头时**替换** `max_tokens` | S:115460-115461 |
| `tools` | array[obj] | OpenAI function calling：`{"type":"function","function":{"name","description","parameters"}}` | S:84923 |
| `response_format` | obj | 仅 json 任务：`{"type":"json_schema","json_schema":{...}}` | S:119182-119192 |
| `extra_body.*` | any | 平铺进 body 根（见 2.2） | S:115164-115172 |

### 2.1 实际抓到的 body 形态（`default` / `main-auto`）

```json
{
  "model": "deepseek-v4-pro-external",
  "messages": [{"role": "user", "content": "..."}],
  "stream": true,
  "stream_options": {"include_usage": true},
  "temperature": 0,
  "max_tokens": 32000,
  "thinking_enabled": true
}
```

### 2.2 `extra_body` 约定（会平铺到 body 根，反代必须接受这些「非标」顶层键）

| key | 值 | 用在哪 | 证据 |
|---|---|---|---|
| `thinking_enabled` | bool | 绝大多数模型（C:171, C:181, C:202…） | C:171；中文说明 B:34,397,353「OpenAI 兼容走 `extra_body.thinking_enabled` 或 `extra_body.enable_thinking`」 |
| `enable_thinking` | bool | `local_model` 模板（Qwen 风格） | C:153 |
| `thinking` | `{"type":"enabled"}` | `app-auto`、`glm-5v-turbo-thinking`（GLM 风格） | C:190-192, C:359-361 |
| `tool_stream` | bool | 同上两个模型 | C:192 |
| `enable_enhancement` / `force_search_enhancement` / `web_search_options` | bool / obj | `hunyuan-2.0-instruct-20251111` | C:307-311 |
| `enable_thinking:false` | bool | `observation-compress-model` / `venus-vision-llm` | C:330, C:345 |

**保留字**：`extra_body` 里禁止出现 `model / messages / stream / tools / response_format / extra_body`，否则抛错（S:115171「Request extra_body contains reserved fields」；集合常量 6 项位于 S:115163-115171 区段）。

**官方 OpenAI 模型**会丢弃不兼容 key（`_OPENAI_INCOMPATIBLE_EXTRA_BODY_KEYS`，S:115346-115349，日志 S:115349）。

### 2.3 messages 细节

- 标准 `{"role","content"}`；assistant 消息可带 `tool_calls`；tool 消息带 `tool_call_id`。
- **`reasoning_content` 回填**：`_prepare_messages` 会把 `metadata["reasoning_content"]` 写回 assistant 消息（DeepSeek/Venus/Kimi 多轮 thinking 必需），空 content 用 `""` 兜底（S:115281-115289，中文 B:34,326,115）。
- 多模态：`content` 为数组，元素 `{"type":"text","text":...}` / `{"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}`（S:41768-41770, S:64904-64915）。

## 3. 响应体 / 流式格式

### 3.1 传输层

- 客户端是 `openai==2.32.0` 的 `AsyncOpenAI`（S:115112 `aAsyncOpenAI`，版本取自 `_internal/openai/_version.pyc`），因此线上就是**标准 OpenAI SSE**：
  - 每帧 `data: {json}\n\n`，结束帧 `data: [DONE]`（`[DONE]` 字面量在 `openai/_streaming.pyc` 内，不在 pyd）
  - `Content-Type: text/event-stream`
- 调用方式 `client.chat.completions.with_raw_response.create(..., stream=True)` 再 `.parse()`，目的是拿原始响应头（S:115175-115178 `completions / with_raw_response / create / headers / parse`）。

### 3.2 chunk → 内部字段映射（`_convert_chunk`，S:115184-115230）

| 线上字段 | 内部字段 | 证据 |
|---|---|---|
| `choices[].delta.content` | `text_delta` | S:115226 |
| `choices[].delta.reasoning_content` | `thinking_delta`（DeepSeek/Venus/Kimi 思维链） | S:115223-115224 |
| `choices[].delta.tool_calls[]`（`index/id/function.name/function.arguments`） | `tool_call_chunks` | S:115228-115240 |
| `choices[].finish_reason` | `finish_reason` + `raw_finish_reason` | S:115230 |
| `usage`（`stream_options.include_usage` 后的尾帧，`choices:[]`） | `TokenUsage` | S:115252-115265 |

`usage` 映射：`prompt_tokens→input_tokens`、`completion_tokens→output_tokens`、`completion_tokens_details.reasoning_tokens→thinking_tokens`、`prompt_tokens_details.cached_tokens→cached_tokens`（S:115252-115278）。

### 3.3 finish_reason 映射表（`_FINISH_REASON_MAPPING`，S:114881-114900）

| 线上值 | 内部 |
|---|---|
| `stop`, `end_turn` | `STOP` |
| `tool_calls`, `tool_use` | `TOOL_CALLS` |
| `length`, `max_tokens` | `MAX_TOKENS` |
| `content_filter` | `CONTENT_FILTER` |
| `error`/`network_error`/`server_error`/`rate_limit` | `ERROR` |
| 其它 | 记 warning「Unknown finish_reason '{}', defaulting to ERROR」→ `ERROR`（S:114882） |

流结束但没拿到 finish_reason → `LLMResponseError`（S:115745）；`finish_reason=stop` 且无内容无工具 → `LLMResponseError`（S:115749）。

### 3.4 响应头（网关回给客户端、会被读取的）

| 响应头 | 含义 | 证据 |
|---|---|---|
| `Marvis-Actual-Model` | 实际命中模型 | S:115683 |
| `Marvis-Routed` | 是否被路由 | S:115684 |
| `Marvis-Routed-Model` | 路由目标 | S:115685 |
| `Marvis-Model-Level` | 模型层级（int） | S:138586 |
| `Marvis-Experiment-Id` | 实验 id | S:138588 |
| `x-trace-id` | trace | S:114914-114915（`extract_business_headers`：只透传小写以 `marvis-` 开头 + `x-trace-id` 的头） |

### 3.5 错误结构

`ai_agent.llm.gateway_errors`（S:117513-117620）：

- 从 SDK 异常里解析：`_HTTP_STATUS_PATTERN = "Error code:\s*(\d+)"`、`_EMBEDDED_DICT_PATTERN = "\{.*\}"`（S:117560-117562）
- body 支持两种信封（S:117556-117559）：
  - OpenAI 风格 `{"error": {"code": "1113", "message": "..."}}`
  - 业务风格 `{"code": int, "msg": str}`
- 细分异常：`LLMWalletExhaustedError` / `LLMContextLengthExceededError` / `LLMRiskControlBlockedError`，各自按 `(http_status, gateway_code)` 命中（S:117516-117530）
  - 具体常量值（`_WALLET_EXHAUSTED_HTTP_STATUS` 等）：**未证实**（Nuitka 常量表里是变长编码整数，未能逐字节解出）
- `401` 会被单独转成 `LLMAuthenticationError`（S:115179-115180）

## 4. 鉴权与签名

### 4.1 三种模式

`YybadAccessAuthMode`: `UAL_ONLY` / `UAL_WITH_OPTIONAL_AKSK` / `UAL_WITH_REQUIRED_AKSK`（S:144396 `ual_only`、S:132466 `UAL_WITH_OPTIONAL_AKSK`、S:144352 `UAL_WITH_REQUIRED_AKSK`）。
`UAL_WITH_OPTIONAL_AKSK` 的中文说明直接写了「Ual-Access-* + MD5」（S:143291 区段 docstring）。

### 4.2 LLM 请求头全集（`build_llm_auth_headers` + `LLMHeaderService`）

| Header | 值 | 证据 |
|---|---|---|
| `Marvis-AgentTag` | agent 名（主循环 `main`，见 C 里 `MAIN_AGENT_NAME`） | S:138087, S:138303 |
| `Marvis-Conversation-ID` | 会话 id | S:138088 |
| `Marvis-Response-ID` | 单次响应 id | S:138089 |
| `Marvis-Scene` | 场景标识（随调用点变；主循环具体值**未证实**） | S:138090 |
| `Ual-Access-Openid` | 登录 openid | S:138101, S:133853 |
| `Ual-Access-Access-Token` | 登录 access_token（**PC 登录态分支**） | S:138093（日志「PC login, using login-state authentication」）, S:133855 |
| `Ual-Access-Login-Type` | 登录类型码；AK/SK 分支固定 `LOGIN_TYPE_MOBILE_CLOUD` | S:138103-138104, S:133857 |
| `Ual-Access-Guid` | 设备 guid | S:133859 |
| `Ual-Access-Nonce` | 随机 nonce（`generate_request_nonce`） | S:138100 |
| `Ual-Access-Timestamp` | **毫秒**时间戳 | S:138102；中文 B:34,832,779「timestamp: 时间戳（毫秒）」 |
| `Ual-Access-Requestid` | 请求 id | S:138113 |
| `Marvis-Auth-Type` | 鉴权模式标识（具体值**未证实**） | S:138105 |
| `Marvis-AccessKey` / `Marvis-Nonce` / `Marvis-Timestamp` / `Marvis-Signature` | AK/SK 分支 | S:138106-138110 |
| `Ual-Access-MarvisExt` | JSON 串（见 4.3） | S:64646, S:138824 |
| `Marvis-Protocol-Version` | 协议版本常量 `_MARVIS_PROTOCOL_VERSION`（值**未证实**） | S:138584 |
| `Marvis-Model-Level` / `Marvis-Experiment-Id` | agent 绑定的层级/实验 | S:138586, S:138588 |
| `X-Device-GUID` | 设备 guid（`_DEVICE_GUID_HEADER`） | S:138825 |
| `Authorization: Bearer <api_key>` | `api_key` 取自配置，值为字面量 `"placeholder"` | S:115112 附近（`_build_client` 常量序列 `api_key`/`placeholder`/`base_url`/`default_headers`/`max_retries`/`timeout`/`http_client` → `AsyncOpenAI`），C:135 |

> **关键**：`api_key` 是**业务标识符不是密钥**，配置注释原文 C:129-130：「api_key 是业务标识符（非真正密钥），实际鉴权通过用户登录态完成」。所以线上 Authorization 就是 `Bearer placeholder`。

### 4.3 `Ual-Access-MarvisExt`（camelCase JSON）

字段（`MarvisExtInfo`，S:134459-134480）：`clientIp`, `qimei36`, `phoneType`, `manufacturer`, `osVersion`, `originOpenID`, `uskey`, `nonce`, `reqScene`, `taskType`, `clientVersion`, `clientPlatform`, `clientPlatformVersion`, `subScene`, `extraParams`, `isIoa`。序列化 `json.dumps(..., ensure_ascii=False, separators=(",",":"))` 且去 None（S:134481-134483）。

- `reqScene` 取值常量：`_REQ_SCENE_USER_REQUEST` / `_REQ_SCENE_BACKGROUND`（S:138487-138489）；后处理类固定 BACKGROUND（B:34,841,039）
- `taskType`：`TaskType.USER` / `TaskType.SCHEDULED`（B:37,000,925 常量表 `user`/`USER`/`scheduled_task`/`SCHEDULED`）
- `subScene`：仅 memory 等子场景写（`mem_*`，S:67295-67310）
- `uskey`/`nonce`：`UskeyProvider` 生成，busiid `7800255`（C:1111, S:138495-138505）

### 4.4 两个 HMAC 签名（可 1:1 复现）

**(a) AK/SK 业务签名** —— 二进制中文 docstring（B:34,832,779）原文：
> 签名内容：HMAC-SHA256(secret_key, nonce + "\n" + timestamp)，与后端网关验签算法一致；nonce 与 timestamp 之间以 "\n" 分隔。… 返回十六进制签名字符串。

```python
hexdigest(hmac_sha256(secret_key.encode(), f"{nonce}\n{timestamp_ms}".encode()))
```

**(b) UAL 代理网关签名**（`is_need_proxy=True` 的 MCP 走这条）—— 二进制中文 docstring（B:34,833,246）原文：
> 待签名串 = `openid + timestamp + nonce`（直接字符串拼接，无分隔符）；使用约定密钥 `fsgjhfgs45fd` 走 HMAC-SHA256；输出小写十六进制字符串。

```python
_UAL_PROXY_SIGNING_KEY = "fsgjhfgs45fd"          # S:138234
hexdigest(hmac_sha256(b"fsgjhfgs45fd", (openid + timestamp_ms + nonce).encode()))
```

### 4.5 业务 `/v3/*` 的 UAL 头与 MD5 签名

`YybadAccessAuthSigner.build_headers`（S:144300-144330）固定追加：

```
Content-Type: application/json
Cache-Control: no-cache
Ual-Access-Businessid: <businessid>        # marvis_client
Ual-Access-Login-Appid: <appid>            # 102033112
Ual-Access-Requestid: uuid4
Ual-Access-Nonce: <4 位随机数>
Ual-Access-Timestamp: <ms>
Ual-Access-Signature: md5(...)
```

`md5` 参与量（`_calculate_ual_signature(body_str, timestamp, nonce)`，模块内只有 `hashlib + md5 + hexdigest`，S:144345-144347）：

```
sign = md5(body_str + timestamp + accesskey + nonce)
```

**注意**：拼接顺序在 Python 侧未逐字节证实（字符串表里只剩 `sign_content` 变量名，S:144454）。但同一业务名的 Web 端实现可直接对上：
`_$APPDATA\Tencent\Marvis\electron_data\OfflinePack\main\current\assets\treemap-*.js`：
`Edt = e => RQ(`${e.body}${e.timestamp}${e.accessKey}${e.nonce}`)`，且 `Vdt = {marvis_client: "fpzkeTlcGLVP37qiOWd29MyaOqaJYxMi"}` —— accesskey 与 C:53 完全一致。故顺序 = `body+timestamp+accesskey+nonce` 可信度极高（**顺序本身标：高置信推断**）。

客户端内置业务密钥：`fpzkeTlcGLVP37qiOWd29MyaOqaJYxMi`（C:53，同一串也出现在 Web 包里；属客户端内置，非用户凭据）。

### 4.6 签名可复现性

`Marvis-Signature`（AK/SK）**完全可复现**，secret_key 在本地 SQLite `data.db` 表 `aksks.secret_key`（本机该表为空 → 走 PC 登录态）；`Ual-Access-Signature`（proxy）**完全可复现**，密钥硬编码；`/v3/*` 的 MD5 签名可复现但**拼接顺序为高置信推断**（§4.5）。TLS 为标准 certifi/truststore，无 pinning（S:114780）。

## 5. 模型清单

全部来自解密后的配置（C:131-361）。`api_key` 一律 `"placeholder"`（C:129 注释已说明原因），下列不再重复。

| 配置 key | `model`（线上字段） | provider | base_url | 备注 | C 行 |
|---|---|---|---|---|---|
| `profile-request-placeholder` | `profile-request-placeholder` | openai | `.../v1` | 云端 Profile 占位，真实路由由云端决定 | 133 |
| `local_model` | `Qwen3.5-35B-A3B` | openai | `http://127.0.0.1:${LOCAL_LLM_PORT}/v1` | LOCAL 模式模板，`temperature 0.6` | 142 |
| `warmup_model` | `Qwen3.5-35B-A3B` | — | 继承 local_model | `max_tokens: 1` 预热 | 159 |
| **`default`** | **`deepseek-v4-pro-external`** | 默认 openai | `.../v1` | temp 0, max 32000, ctx 128000, `thinking_enabled` | 163 |
| `main-auto` | `main-auto` | 同上 | `.../v1` | 主 Agent 自动档 | 173 |
| `app-auto` | `app-auto` | 同上 | `.../v1` | max 8000/ctx 200000，`thinking{type:enabled}`+`tool_stream` | 183 |
| `file-auto` | `file-auto` | 同上 | `.../v1` | | 194 |
| `computer-auto` | `computer-auto` | 同上 | `.../v1` | | 204 |
| `browser-auto` | `browser-auto` | 同上 | `.../v1` | | 214 |
| `memory-default` | `deepseek-v4-pro-external` | 同上 | `.../v1` | 记忆模块默认 | 224 |
| `memory-compress` | `qwen-memory-compression-int8` | 同上 | `.../v1` | 记忆压缩 | 234 |
| `hy3-preview-agent` | `hy3-preview-agent` | 同上 | `.../v1` | | 242 |
| `ark_deepseek-v3-2-251201` | `deepseek-v4-pro-external` | 同上 | `.../v1` | key 名是 Ark 模型名，实际 model 已换 | 250 |
| `kimi-k2.5` | `kimi-k2.5` | 同上 | `.../v1` | `thinking_enabled` | 260 |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` | **anthropic** | `https://yybadaccess.3g.qq.com/` | 走 `/v1/messages` | 268 |
| `claude-opus-4-6` | `claude-opus-4-6` | **anthropic** | 同上 | | 276 |
| `gpt-5.4` | `gpt-5.4` | openai | `.../v1` | `max_completion_tokens` 分支 | 284 |
| `claude-opus-4-6-thinking` | `claude-opus-4-6` | **anthropic** | 同上 | `thinking{type:adaptive,effort:high}`, max 16000 | 290 |
| `hunyuan-2.0-instruct-20251111` | 同名 | openai | `.../v1` | `enable_enhancement`+`force_search_enhancement`+`web_search_options` | 301 |
| `hy3-preview-agent-real` | `hy3-preview-agent-real` | 同上 | `.../v1` | AI 生成物判定（json_schema strict）**实测调用最多** | 315 |
| `observation-compress-model` | 同名 | 同上 | `.../v1` | `thinking_enabled:false` | 322 |
| `hunyuan-turbos-vision` | 同名 | 同上 | `.../v1` | ctx 32000 | 332 |
| `venus-vision-llm` | 同名 | 同上 | `.../v1` | max 8192 | 338 |
| `grounder-model` | 同名 | 同上 | `.../v1` | GUI grounding | 347 |
| `glm-5v-turbo-thinking` | `glm-5v-turbo` | 同上 | `.../v1` | `thinking{type:enabled}`+`tool_stream` | 352 |

### 5.1 实测调用记录（本地 `data.db.llm_token_usage`）

| model_id | 次数 | 总 token |
|---|---|---|
| `hy3-preview-agent-real` | 77 | 113,332 |
| `main-auto` | 1 | 26,375 |
| `profile-request-placeholder` | 1 | 1,249 |

`aksks` 表为空 → 本机是 **PC 登录态分支**（只用 `Ual-Access-*`，没有 `Marvis-Signature`）。

### 5.2 `custom:<id>` 自定义模型（反代最省事的接入点）

- 工具 `create_custom_model`（S:183180-183230）：入参 `base_url` / `model_id` / `api_key`；`base_url` 必须 `http(s)://` 且**必须写到 `/chat/completions` 结尾**（S:183064-183076：`startswith http(s)://` + `endswith("/chat/completions")`，否则 `CODE_INVALID_FORMAT`）
- 提交给 Runner 的 IPC 工具名 `model_config.create`（S:183212），返回 `config_id`(`cfg_xxx`) / `display_name` / `provider` / `plan_name` / `api_key_fingerprint` / `status` / `advanced{max_context,max_output,tool_rounds}`（S:183336-183346）
- API Key 由 Runner 以 **AES-256-GCM** 落盘（S:183200 `AES-256-GCM`）
- 命名：内部 `model_name = "custom:qwen-plus-9a2f"`（S:112071, S:112206）
- **自定义/本地模型会被剥掉平台头**：`LLMClient.astream: strip platform headers for custom/local model {}`（S:115677）→ 指向自家反代时不会带 `Ual-Access-*` / `Marvis-*`
- UI 侧同款能力：供应商预设 `腾讯云/阿里云/Moonshot/智谱`，输入框 placeholder `https://api.example.com/v1/chat/completions`（离线包 `treemap-*.js`）——即**UI 里就能把 base_url 指到本地反代**

## 6. 本地配置来源

### 6.1 加载链

```
get_config_dir()
  ├─ 开发环境: <项目根>/config_defaults.yaml        （明文）
  └─ 部署环境: <install>/_internal/CONFIG            （Fernet 密文）
      ↓ AgentConfig.load(config_dir, work_mode)
      ↓ Pydantic 校验 → AgentConfig（models / tools / cloud_asset ...）
      → LLMClientFactory(models_config=config.models_config)
      → LLMClient(get_effective_config("default"))
```

证据：B:37,133,087（「部署环境：`<安装目录>/_internal`（`CONFIG` 加密文件所在位置）」）、B:37,136,745（目录树 `_internal/CONFIG` + `marvis_agent.pyd`）、B:36,961,991（「部署环境为 `_internal` 目录（含加密的 `CONFIG` 文件）」）、S:116987-116997（`config_defaults.yaml` → `models`）、S:117459（`LLMClientFactory.get_effective_config`）。

**没有**用户覆盖文件：B:36,961,721 后中文原文「注意：不再加载用户配置（config.yaml）」——即改配置必须改 `_internal/CONFIG` 本身（重加密）。

### 6.2 解密 `_internal/CONFIG`（已验证可跑）

算法（`ai_agent.utils.crypto_shared`，模块常量表 S:231760-232010，值在 B:37,014,900）：

```
_NUMBER_LIST = [3,6,8,0,3,4,6,8,9,7,5,0,7,2,8,9,8,3,4]     # B:37,014,900 常量表 'L\x13'
ENCRYPT_SALT = "gD4W8UXkq5"                                  # B:37,014,900 常量表
_PBKDF2_ITERATIONS = 100                                     # V1 兼容（中文 doc 明说「当前 PBKDF2 迭代次数（100）为 V1 兼容」）
password    = md5("".join(map(str, _NUMBER_LIST))).hexdigest()
fernet_key  = base64.urlsafe_b64encode(PBKDF2HMAC(SHA256, 32, salt=ENCRYPT_SALT, iterations=100).derive(password))
plaintext   = Fernet(fernet_key).decrypt(open("CONFIG","rb").read())
```

已解出 81,749 字节，即 `config_defaults.yaml`（1632 行）。脚本见 `A-raw/decrypt_config.py`，产物 `A-raw/config_defaults.yaml`。

一件事必须点明：这是 **obfuscation-grade**，不是保密级（源码 doc 自己写的：「本模块定位于：混淆级保护（obfuscation-grade）」，B:37,014,477）。

### 6.3 运行时还会被改写的部分
- **work_mode**：`--work_mode cloud|local|lite`（`--local_llm_port` 仅 LOCAL），S:33172-33180
- LOCAL 时把 `models.local_model.base_url` 里的 `${LOCAL_LLM_PORT}` 替换成实际端口（S:229651-229665）
- `debug_http`：`framework.debug_http`（C:10 = `false`），开了会打整条 curl（S:116960-116975）——**这是抓包最省事的开关**
- 远程动态配置：`common_config.group_id = marvis_client_config`（C:1620），内容走 Runner 的 `config.get` / `config.changed` IPC（S:135976-136170），本地缓存落在 `%APPDATA%\Tencent\Marvis\common-config.json`（本机实测只有 `model_show_desc` 一项，**不含 base_url/模型列表**）

## 7. 可直接跑的 curl

```bash
# 只需一个已登录会话（PC 登录态）
curl -N -X POST 'https://yybadaccess.3g.qq.com/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -H 'Authorization: Bearer placeholder' \
  -H "Ual-Access-Openid: $OPENID" \
  -H "Ual-Access-Access-Token: $TOKEN" \
  -H "Ual-Access-Login-Type: $LOGIN_TYPE" \
  -H "Ual-Access-Guid: $GUID" \
  -H "Marvis-AgentTag: main" \
  -H "Marvis-Conversation-ID: $CONVID" \
  -H "Marvis-Response-ID: $RESPID" \
  -H "Marvis-Scene: $SCENE" \
  -H "X-Device-GUID: $GUID" \
  -H 'Ual-Access-MarvisExt: {"reqScene":"user_request","taskType":"user","clientVersion":"1.60.3300.765","clientPlatform":"windows"}' \
  -d '{
        "model": "main-auto",
        "messages": [{"role":"user","content":"你好"}],
        "stream": true,
        "stream_options": {"include_usage": true},
        "temperature": 0,
        "max_tokens": 32000,
        "thinking_enabled": true
      }'
```

AK/SK 分支（无登录态）时：删掉第 6 行 `Ual-Access-Access-Token`，`Ual-Access-Openid` 保留，再追加下面 9 个（每个以 `-H` 加）：

```text
Ual-Access-Nonce: $NONCE
Ual-Access-Timestamp: $TS_MS
Ual-Access-Login-Type: $LOGIN_TYPE_CLOUD
Ual-Access-Requestid: $REQID
Marvis-Auth-Type: $AUTH_TYPE
Marvis-AccessKey: $AK
Marvis-Nonce: $NONCE
Marvis-Timestamp: $TS_MS
Marvis-Signature: $SIG        # hex(HMAC-SHA256($SK, nonce + 换行 + timestamp))
```

## 8. 反代实现伪代码

### 8.1 Python（FastAPI，接收 Marvis 的自定义模型流量）

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json, httpx

app = FastAPI()

@app.post("/v1/chat/completions")
async def chat(req: Request):
    body = await req.json()

    # Marvis 平铺在 body 根的私有字段，转发前摘掉
    for k in ("thinking_enabled", "enable_thinking", "thinking",
              "tool_stream", "enable_enhancement",
              "force_search_enhancement", "web_search_options"):
        body.pop(k, None)

    upstream = {"model": "deepseek-chat",          # 换成你的真实模型
                "messages": body["messages"],
                "stream": True,
                "temperature": body.get("temperature", 0),
                "max_tokens": body.get("max_tokens", 4096)}
    if body.get("tools"):
        upstream["tools"] = body["tools"]
        upstream["tool_choice"] = "auto"
    if body.get("response_format"):
        upstream["response_format"] = body["response_format"]
    if body.get("stream_options", {}).get("include_usage"):
        upstream["stream_options"] = {"include_usage": True}

    async def gen():
        async with httpx.AsyncClient(timeout=600) as cli:
            async with cli.stream("POST", UPSTREAM_URL, json=upstream,
                                  headers={"Authorization": f"Bearer {UP_KEY}"}) as r:
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    # 上游若是 OpenAI 兼容，直接透传；否则在这里把自家格式转成
                    # data: {"choices":[{"delta":{"content":...},"finish_reason":null}]}
                    yield line + "\n\n"
        # openai SDK 依赖 [DONE] 收尾；上游没给就自己补
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Marvis-Actual-Model": "deepseek-chat",
                                      "Marvis-Routed": "1",
                                      "Marvis-Routed-Model": "deepseek-chat"})
```

要点：
1. 必须吃下 `thinking_enabled` / `thinking` / `tool_stream` 等**非标顶层键**（SDK 把 `extra_body` 平铺了）。
2. `stream` 恒为 `true`；**不看 `stream` 字段也必须是 SSE**。
3. 首字延迟要自己控制（agent 有 600s read timeout，S:117326-117327）。
4. 工具调用增量：`delta.tool_calls[]` 必须带 `index`（0 基），`arguments` 允许分片。
5. 想省掉改造：把 `base_url` 直接指到你的 `/v1`，用 §5.2 的 custom model 注册。

### 8.2 Node（等价拼法）

```js
const body = { model: cfg.model, messages, stream: true,
               stream_options: { include_usage: true },
               temperature: 0, max_tokens: 32000,
               ...(cfg.extraBody || {}) };            // thinking_enabled / tool_stream / thinking
const headers = {
  'content-type': 'application/json',
  authorization: `Bearer ${cfg.apiKey || 'placeholder'}`,
  'ual-access-openid': openid, 'ual-access-access-token': token,
  'ual-access-login-type': loginType, 'ual-access-guid': guid,
  'marvis-agenttag': 'main', 'marvis-conversation-id': convId,
  'marvis-response-id': respId, 'marvis-scene': scene,
  'x-device-guid': guid, 'ual-access-marvisext': JSON.stringify(marvisExt),
};
const url = cfg.baseUrl.replace(/\/chat\/completions$/, '') + '/chat/completions';
const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
```

## 9. 未证实 / 卡点

| # | 事项 | 现状 | 下一步 |
|---|---|---|---|
| 1 | `Marvis-Scene` 主循环取值 | 只知道是调用点传入的 scene 串（`post_process`/`memory` 等有文档），主循环字面量没在常量表里定位到 | 反代里当不透明串透传即可；若要精确，抓一次真实请求头 |
| 2 | `Marvis-Auth-Type` 值、`Marvis-Protocol-Version` 值、`Ual-Access-Login-Type` 的数值码 | 常量表是变长整数编码，未解出 | 同上，一次真实抓包即可定值 |
| 3 | `/v3/*` MD5 的拼接顺序 | Python 侧只留 `sign_content` 变量名；Web 端同业务实现为 `body+ts+accesskey+nonce` | 若反代要校验，先用 Web 端顺序试；失败再用在线请求二分验证 |
| 4 | 网关错误码（`_WALLET_EXHAUSTED_GATEWAY_CODE` 等） | 只有名字，无值 | 触发一次 402/风控即可拿到 |
| 5 | `reqScene` / `taskType` 的字面量拼写 | 只有常量名（`_REQ_SCENE_USER_REQUEST` 等），未见字面量 | 抓包或按 `user_request`/`background`、`user`/`scheduled_task` 试 |
| 6 | `include_stream_usage` 默认值 | 配置里没写，代码常量表未解出 | 反代两种都兼容 |
| 7 | 服务端下发的 model 路由 | `profile-request-placeholder` 注释说「实际模型路由由云端 Profile 决定」 | 静态无法还原，需抓 `/v3/` 的 profile 响应 |
| 8 | `Ual-Access-Access-Token` 的实际来源 | 由 Electron Shell 的登录态签发（不在 Python 侧生成；本机 `aksks` 表为空，说明未走 AK/SK） | 抓一次 shell 发出的请求即可取到 |

## 10. 复现附录

```bash
# 1) 重提字符串（没有 strings 命令时）
python _marvis/str.py "E:/新建文件夹/Marvis/MarvisAgent/1.60.3300.765/_internal/marvis_agent.pyd" \
       _marvis/agent.str.txt

# 2) 解出真实配置
python _marvis/A-raw/decrypt_config.py
#   → _marvis/A-raw/config_defaults.yaml
```

对二进制直接取证的关键偏移（本报告用到）：
`34,351,868`（base_url 契约）、`34,830,450`（llm_auth 常量表）、`34,830,958`（LLM header 构建）、`34,832,779`/`34,833,246`（两个签名 doc）、`34,721,196`（gateway_errors）、`37,014,900`（crypto_shared 常量表）、`37,000,925`（TaskType）、`37,133,087`/`37,136,745`（目录约定）、`36,961,991`（AgentConfig.load）。
