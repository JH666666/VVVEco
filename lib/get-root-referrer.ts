/**
 * 服务端：获取项目方根地址
 * 优先级：ContractConfig DB → ROOT_REFERRER_ADDRESS env → ""
 *
 * 此文件只在 API Routes (server) 中使用，不可在客户端组件 import。
 */
import { prisma } from "@/lib/prisma";

let _cachedRoot: string | null = null;

export async function getRootReferrerAddress(): Promise<string> {
  // 1. 已缓存（进程级，重启后重新读）
  if (_cachedRoot) return _cachedRoot;

  // 2. ContractConfig DB（管理员可通过后台 API 修改）
  try {
    const config = await prisma.contractConfig.findFirst({ where: { id: 1 } });
    if (config?.rootReferrerAddress) {
      const addr = config.rootReferrerAddress.trim().toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(addr)) {
        _cachedRoot = addr;
        return addr;
      }
    }
  } catch {
    // DB 不可用时继续走 env
  }

  // 3. env 兜底
  const envAddr = (process.env.ROOT_REFERRER_ADDRESS ?? "").trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(envAddr)) {
    _cachedRoot = envAddr;
    return envAddr;
  }

  return "";
}

/** 当 rootReferrerAddress 被修改时调用此函数使缓存失效 */
export function invalidateRootReferrerCache() {
  _cachedRoot = null;
}
