// 从本机 Marvis 客户端导入登录态
//
// 为什么需要它：Marvis 的 token 落在 `marvis-login-state.json` 里，是
// **AES-256-CBC + 运行期派生密钥**（conf v15 的 `IV[0:16] + ':' + CT`），
// 密钥攻不出来。但客户端跑着的时候，明文就在进程内存里 —— 直接读。
//
// ⚠ 只读，不写、不注入、不 hook。用 `ReadProcessMemory` 扫可读区段。
// ⚠ 只在 Windows 上有；其它平台返回「不可用」，让用户走浏览器登录。
// ⚠ **不需要管理员权限**（同用户进程即可）；跨用户会失败并给出明确错误。

import { execFileSync } from "node:child_process"
import { deviceGuid } from "./login.mjs"

/** 探查本机是否有 Marvis 客户端在跑 */
export async function desktopAvailable() {
  try {
    return Boolean(findPid())
  } catch {
    return false
  }
}

/** 找 MarvisAgent.exe 的 PID（真正持有登录态的那个进程） */
function findPid(name = "MarvisAgent.exe") {
  const out = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${name}`, "/FO", "CSV", "/NH"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  })
  const m = /"([^"]+)","(\d+)"/.exec(out)
  return m ? Number(m[2]) : 0
}

/**
 * 从进程内存里读出登录态。
 *
 * 内存里有两处：
 *   1. `openid=...; accesstoken=...; refreshtoken=...; logintype=QC; ...`（cookie 形态）
 *   2. 结构化对象 `{"openid":"...","accessToken":"...","refreshToken":"..."}`
 * 优先用 1（字段最全，带 logintype 和到期时刻）。
 *
 * @returns {Promise<{ openid: string, accessToken: string, refreshToken?: string, loginType: string, guid: string, nickname?: string, expiresAt?: number }>}
 */
export async function importFromDesktop() {
  if (process.platform !== "win32") {
    throw new Error("「从本机导入」只支持 Windows。请改用 QQ / 微信 登录。")
  }
  const pid = findPid()
  if (!pid) {
    throw new Error("没找到运行中的 MarvisAgent.exe。请先打开 Marvis 客户端并登录，或改用 QQ / 微信 登录。")
  }
  const text = await readProcessStrings(pid)
  const acct = parseLoginState(text)
  if (!acct) {
    throw new Error(
      "读到了 MarvisAgent 进程，但里面没有登录态。请在 Marvis 客户端里登录一次再试，或改用 QQ / 微信 登录。",
    )
  }
  return acct
}

/**
 * 扫进程可读内存，返回拼起来的文本。
 * 只取长度 < 64MiB 的已提交可读区段，避免爆内存。
 * @param {number} pid
 * @returns {Promise<string>}
 */
async function readProcessStrings(pid) {
  // 用 PowerShell 做（不引第三方依赖，也不需要编译）。C# 片段走 Add-Type。
  const script = `
$sig = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class MS {
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int a, bool b, int c);
  [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, int s, out IntPtr r);
  [DllImport("kernel32.dll")] public static extern int VirtualQueryEx(IntPtr h, IntPtr a, ref MBI m, int s);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [StructLayout(LayoutKind.Sequential)]
  public struct MBI {
    public IntPtr BaseAddress, AllocationBase;
    public uint AllocationProtect, __a1;
    public IntPtr RegionSize;
    public uint State, Protect, Type, __a2;
  }
  public static string Scan(int pid, string needle) {
    var h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) return "";
    var sb = new StringBuilder();
    long addr = 0; var mbi = new MBI();
    var nb = Encoding.UTF8.GetBytes(needle);
    while (VirtualQueryEx(h, (IntPtr)addr, ref mbi, Marshal.SizeOf(mbi)) != 0) {
      long size = (long)mbi.RegionSize;
      if (mbi.State == 0x1000 && size > 0 && size < 67108864 &&
          (mbi.Protect == 0x02 || mbi.Protect == 0x04 || mbi.Protect == 0x06 ||
           mbi.Protect == 0x08 || mbi.Protect == 0x20 || mbi.Protect == 0x40 ||
           mbi.Protect == 0x80 || mbi.Protect == 0x42 || mbi.Protect == 0x44 ||
           mbi.Protect == 0x60 || mbi.Protect == 0x62 || mbi.Protect == 0x64)) {
        var buf = new byte[size];
        IntPtr read;
        if (ReadProcessMemory(h, (IntPtr)addr, buf, (int)size, out read)) {
          var s = Encoding.UTF8.GetString(buf, 0, (int)read);
          if (s.Contains(needle)) sb.Append(s);
        }
      }
      addr += size;
      if (addr > 0x7fffffffffffL) break;
    }
    CloseHandle(h);
    return sb.ToString();
  }
}
"@
Add-Type -TypeDefinition $sig -Language CSharp
[MS]::Scan(${pid}, "accesstoken=")
[MS]::Scan(${pid}, "\\"accessToken\\":")
`;
  const out = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return out
}

/**
 * 从内存文本里抠登录态。
 * @param {string} text
 */
export function parseLoginState(text) {
  // 形态 1：cookie 串
  const cookie = /openid=([0-9A-Fa-f]{16,64});\s*accesstoken=([^;\s]+);\s*(?:refreshtoken=([^;\s]+);\s*)?logintype=([A-Za-z]+)/
  let m = cookie.exec(text)
  if (m) {
    const expire = /access_token_expire_time=(\d+)/.exec(text)
    return {
      openid: m[1],
      accessToken: m[2],
      refreshToken: m[3] || undefined,
      loginType: /^WX$/i.test(m[4]) ? "5" : "6",
      guid: deviceGuid(),
      expiresAt: expire ? Number(expire[1]) * 1000 : Date.now() + 30 * 24 * 3600_000,
    }
  }
  // 形态 2：JSON 对象
  const json = /"openid"\s*:\s*"([0-9A-Fa-f]{16,64})"[^}]{0,400}?"accessToken"\s*:\s*"([^"]+)"/
  m = json.exec(text)
  if (m) {
    const rt = /"refreshToken"\s*:\s*"([^"]+)"/.exec(text)
    return {
      openid: m[1],
      accessToken: m[2],
      refreshToken: rt?.[1],
      loginType: "6",
      guid: deviceGuid(),
      expiresAt: Date.now() + 30 * 24 * 3600_000,
    }
  }
  return null
}
