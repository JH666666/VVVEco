/**
 * 服务端：获取项目方根地址
 * 优先级：ContractConfig DB（非 V1 地址）→ NEXT_PUBLIC_ROOT_REFERRER_ADDRESS env → ROOT_REFERRER_ADDRESS env → ""
 *
 * 此文件只在 API Routes (server) 中使用，不可在客户端组件 import。
 */
import { prisma } from "@/lib/prisma";

let _cachedRoot: string | null = null;

// 已知 V1 测试/旧地址，检测到时自动从 env 迁移
const V1_ROOT_ADDRESSES = new Set([
  "0x0a28a06fd56dde253cff723582374fbeb2cfa2c6", // Base Sepolia 测试 root
  "0xbd7928a836c9d7eaa5fbeeb0c1ba9f2fb4c852f3", // V1 被盗 owner（也被用作 root）
]);

function getEnvRootAddr(): string {
  // NEXT_PUBLIC_ROOT_REFERRER_ADDRESS 是服务器 .env 中实际使用的 key
  return (
    process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS ??
    process.env.ROOT_REFERRER_ADDRESS ??
    ""
  ).trim().toLowerCase();
}

export async function getRootReferrerAddress(): Promise<string> {
  // 1. 已缓存（进程级，重启后重新读）
  if (_cachedRoot) return _cachedRoot;

  const envAddr = getEnvRootAddr();

  // 2. ContractConfig DB（管理员可通过后台 API 修改）
  try {
    const config = await prisma.contractConfig.findFirst({ where: { id: 1 } });
    if (config?.rootReferrerAddress) {
      const dbAddr = config.rootReferrerAddress.trim().toLowerCase();

      if (/^0x[a-f0-9]{40}$/.test(dbAddr)) {
        // 检测到 V1 旧地址 + env 有有效 V2 地址 → 自动迁移
        if (V1_ROOT_ADDRESSES.has(dbAddr) && /^0x[a-f0-9]{40}$/.test(envAddr)) {
          await prisma.contractConfig.update({
            where: { id: 1 },
            data: { rootReferrerAddress: envAddr },
          }).catch(() => {}); // 迁移失败不阻塞
          console.log(`[get-root-referrer] V1→V2 auto-migrated: ${dbAddr} → ${envAddr}`);
          _cachedRoot = envAddr;
          return envAddr;
        }

        _cachedRoot = dbAddr;
        return dbAddr;
      }
    }
  } catch {
    // DB 不可用时走 env
  }

  // 3. env 兜底（NEXT_PUBLIC_ 或无前缀均支持）
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
