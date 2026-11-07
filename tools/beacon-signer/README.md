# beacon-signer —— 让 Linux/macOS 上的 magpie 也能签 uskey

## 它解决什么

`native/` 里的 4 个文件是 **Windows 专有产物**：

```
beacon_napi.node    PE，不是 ELF —— Linux 上 require 直接报 invalid ELF header
beacon_sdk.dll      同目录动态加载（beacon_napi.node 的导入表里看不到）
beacon_wrapper.dll  同上
qimei.dll           缺了不报错，只是 getUskey()/getQimei() 静默返回 null
```

而 `Ual-Access-MarvisExt` 里的 uskey **必须每次请求现签**（同一个只给 2 次，第 3 次起 403）。
所以在 Linux 服务器上跑 magpie 时，要么让签名留在 Windows，要么在 Linux 上用 Wine 跑这 4 个文件。

这就是本目录的东西：一个 **HTTP 签名服务**，把 `init / getUskey / getQimei` 包成三个 GET。

插件侧只需一个环境变量：

```bash
MARVIS_BEACON_URL=http://<signer-host>:9024
```

设置后 `src/native.mjs` **不再 require 本地二进制**，`newUskey()` / `qimei36()` 改走 HTTP；
`qimei36` 在插件侧缓存 6 小时（同设备稳定，别把服务打爆）。

## 接口

| 路径 | 返回 | 说明 |
|---|---|---|
| `GET /health` | `{ ok, initRc, nativeDir, qimei, served, lastAt }` | `served` = 累计签发的 uskey 数，请求几次就涨几次 |
| `GET /uskey?business=marvis_client` | `{ uskey }` | 签一个 |
| `GET /uskeys?n=5&business=…` | `{ uskeys: [...] }` | 批量；`n` 上限 200 |
| `GET /qimei` | `{ qimei }` | 设备 qimei36 |

`business` 默认 `marvis_client`。

## 三种部署方式

### 1. 原生 Windows（最简单）

在任意一台常开的 Windows 上，把仓库 clone 下来：

```powershell
$env:SIGNER_HOST = "0.0.0.0"
$env:SIGNER_PORT = "9024"
node tools\beacon-signer\signer.js
```

`native/` 相对本文件（`tools/beacon-signer/../../native`）自动找到，不用配。

> ⚠ 签出来的 uskey 带着**那台机器的 qimei36**。别把 `SIGNER_HOST` 直接开到公网——它没有任何鉴权，
> 拿到的 uskey 就等于拿到你账号的请求能力。只绑内网 / 走隧道 / 用防火墙白名单。

### 2. Linux + Wine（无 Windows 机器时）

```bash
sudo apt-get install -y --no-install-recommends wine64    # 约 700 MB 依赖
./tools/beacon-signer/run-wine.sh                          # 首次自动下 node.exe + 建 wineprefix
```

`run-wine.sh` 做了三件容易漏的事：

1. node.exe 从 `registry.npmmirror.com` 取（`curl -L` 必须带，它是 302 到 cdn）；
2. `HKCU\Software\Wine` 的 `Version` 改成 `win10` —— wine 默认报 win7，node 会拒绝启动；
3. 日志只写文件 —— **Wine 下 node 的 stdout 会抛 `spawn EINVAL`**，任何 `console.log` 都写不出去。

常驻用 systemd：[`marvis-beacon.service`](./marvis-beacon.service)（改 `ExecStart` 里的路径即可）。

实测（Debian 12 x86_64 / wine 8.0 / node v22.20.0 win-x64）：
`init rc=0`，`getUskey` 返回 400+ 字符 base64 且每次不同，`getQimei()` 稳定不变。

### 3. 容器里跑 magpie

signer 在宿主机上，绑 docker 网关地址：

```yaml
# docker-compose.yml
environment:
  MARVIS_BEACON_URL: "http://172.17.0.1:9024"   # bridge 网关（不是 docker0 这个名字）
```

## 自检

```bash
# 不装 SDK 也能验链路（假签名，上游不认）
BEACON_STUB=1 SIGNER_PORT=9024 node tools/beacon-signer/signer.js
curl -s localhost:9024/health
curl -s "localhost:9024/uskeys?n=2"          # 两个不同的串
```

真机自检：连续调两次模型，`/health` 的 `served` 必须**跟着涨** —— 涨了才说明是每请求现签，
没涨就说明有缓存，第 3 次请求会上游 403。

## 它不是什么

- 不存账号、不存 token、不代理模型请求 —— 只签 uskey / 给 qimei36。
- 不解决「登录」：`desktop.mjs` 的「从本机导入」仍然只在 Windows 有意义；Linux 上走扫码登录。
- 不是安全边界：内网地址 + 防火墙，别做公网服务。
