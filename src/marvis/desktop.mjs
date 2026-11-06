// 从本机 Marvis 客户端导入登录态
//
// 为什么需要它：Marvis 的 token 落在 `marvis-login-state.json` 里，是
// **AES-256-CBC + 运行期派生密钥**（conf v15 的 `IV[0:16] + ':' + CT`），
// 密钥攻不出来。但客户端跑着的时候，明文就在进程内存里 —— 直接读。
//
// ⚠ 只读，不写、不注入、不 hook。用 `ReadProcessMemory` 扫可读区段。
// ⚠ 只在 Windows 上有；其它平台抛「不可用」，让用户走浏览器登录。
// ⚠ **不需要管理员权限**（同用户进程即可）；跨用户会失败并给出明确错误。
//
// ⚠⚠ 为什么把 C# 和 PS 都落成临时文件：`powershell -Command <长脚本>` 会被
//   Windows 命令行参数解析吃掉引号（C# 里的 `""` 空字符串必然炸成
//   `MissingEndParenthesisInMethodCall`）。`-File` 走文件，不经过参数解析。

import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
    timeout: 10_000,
  })
  const m = /"([^"]+)","(\d+)"/.exec(out)
  return m ? Number(m[2]) : 0
}

/** C# 扫描器 —— 写成独立 .cs，由 Add-Type -Path 编译 */
const CS = String.raw`
using System;
using System.Text;
using System.Runtime.InteropServices;

public class MarvisMemScan
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(int access, bool inherit, int pid);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int size, out IntPtr read);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern int VirtualQueryEx(IntPtr h, IntPtr addr, ref MBI mbi, int size);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr h);

    [StructLayout(LayoutKind.Sequential)]
    public struct MBI
    {
        public IntPtr BaseAddress;
        public IntPtr AllocationBase;
        public uint AllocationProtect;
        public uint Pad1;
        public IntPtr RegionSize;
        public uint State;
        public uint Protect;
        public uint Type;
        public uint Pad2;
    }

    private static bool Readable(uint p)
    {
        switch (p)
        {
            case 0x02: case 0x04: case 0x06: case 0x08:
            case 0x20: case 0x40: case 0x80:
            case 0x42: case 0x44: case 0x60: case 0x62: case 0x64:
                return true;
            default:
                return false;
        }
    }

    /// 扫一遍，把命中 needle 的区段整段拼起来返回（供上层用正则抠字段）
    public static string Scan(int pid, string needle)
    {
        IntPtr h = OpenProcess(0x0410, false, pid);
        if (h == IntPtr.Zero) return string.Empty;

        StringBuilder sb = new StringBuilder();
        long addr = 0;
        MBI mbi = new MBI();
        const long MAX_REGION = 64L * 1024 * 1024;

        while (VirtualQueryEx(h, new IntPtr(addr), ref mbi, Marshal.SizeOf(typeof(MBI))) != 0)
        {
            long size = (long)mbi.RegionSize;
            if (mbi.State == 0x1000 && size > 0 && size < MAX_REGION && Readable(mbi.Protect))
            {
                byte[] buf = new byte[size];
                IntPtr read;
                if (ReadProcessMemory(h, new IntPtr(addr), buf, (int)size, out read))
                {
                    string s = Encoding.UTF8.GetString(buf, 0, (int)read);
                    if (s.IndexOf(needle, StringComparison.Ordinal) >= 0) sb.Append(s);
                }
            }
            addr += size;
            if (addr > 0x7FFFFFFFFFFFL) break;
        }
        CloseHandle(h);
        return sb.ToString();
    }
}
`

/**
 * 从进程内存里读出登录态。
 *
 * 内存里有两处：
 *   1. `openid=...; accesstoken=...; refreshtoken=...; logintype=QC; ...`（cookie 形态）
 *   2. 结构化对象 `{"openid":"...","accessToken":"...","refreshToken":"..."}`
 * 优先用 1（字段最全，带 logintype 和到期时刻）。
 *
 * @returns {Promise<{ openid: string, accessToken: string, refreshToken?: string, loginType: string, guid: string, expiresAt?: number }>}
 */
export async function importFromDesktop() {
  if (process.platform !== "win32") {
    throw new Error("「从本机导入」只支持 Windows。请改用 QQ / 微信 登录。")
  }
  const pid = findPid()
  if (!pid) {
    throw new Error("没找到运行中的 MarvisAgent.exe。请先打开 Marvis 客户端并登录，或改用 QQ / 微信 登录。")
  }

  const dir = mkdtempSync(join(tmpdir(), "magpie-marvis-scan-"))
  try {
    writeFileSync(join(dir, "Scan.cs"), CS, "utf8")
    // 只输出命中区段的 base64，避免编码/长度问题
    writeFileSync(
      join(dir, "run.ps1"),
      [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -Path (Join-Path $PSScriptRoot 'Scan.cs') -Language CSharp",
        `$text = [MarvisMemScan]::Scan(${pid}, 'accesstoken=')`,
        "if ([string]::IsNullOrEmpty($text)) { $text = [MarvisMemScan]::Scan(" + pid + ", 'accessToken') }",
        "$b = [System.Text.Encoding]::UTF8.GetBytes($text)",
        "[Console]::Out.Write([Convert]::ToBase64String($b))",
        "",
      ].join("\r\n"),
      "utf8",
    )

    const b64 = execFileSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(dir, "run.ps1")],
      { encoding: "utf8", windowsHide: true, timeout: 180_000, maxBuffer: 128 * 1024 * 1024 },
    ).trim()

    const text = b64 ? Buffer.from(b64, "base64").toString("utf8") : ""
    const acct = parseLoginState(text)
    if (!acct) {
      throw new Error(
        "读到了 MarvisAgent 进程，但里面没有登录态。请在 Marvis 客户端里登录一次再试，或改用 QQ / 微信 登录。",
      )
    }
    return acct
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 临时目录删不掉不影响主流程 */
    }
  }
}

/**
 * 从内存文本里抠登录态。
 * @param {string} text
 */
export function parseLoginState(text) {
  if (!text) return null
  const guid = deviceGuid()

  // 形态 1：cookie 串
  const cookie = /openid=([0-9A-Fa-f]{16,64});\s*accesstoken=([^;\s]+);\s*(?:refreshtoken=([^;\s]+);\s*)?(?:logintype=([A-Za-z]+))?/
  let m = cookie.exec(text)
  if (m) {
    const expire = /access_token_expire_time=(\d{10})/.exec(text)
    return {
      openid: m[1],
      accessToken: m[2],
      refreshToken: m[3] || undefined,
      loginType: /^WX$/i.test(m[4] ?? "") ? "5" : "6",
      guid,
      expiresAt: expire ? Number(expire[1]) * 1000 : Date.now() + 30 * 24 * 3600_000,
    }
  }

  // 形态 2：`"openid":"...","accessToken":"..."` 结构化串
  const json = /"openid"\s*:\s*"([0-9A-Fa-f]{16,64})"[\s\S]{0,600}?"accessToken"\s*:\s*"([^"]+)"/
  m = json.exec(text)
  if (m) {
    const rt = /"refreshToken"\s*:\s*"([^"]+)"/.exec(text)
    return {
      openid: m[1],
      accessToken: m[2],
      refreshToken: rt?.[1],
      loginType: "6",
      guid,
      expiresAt: Date.now() + 30 * 24 * 3600_000,
    }
  }
  return null
}
