import { prisma } from "@/lib/prisma";
import { invalidateRootReferrerCache } from "@/lib/get-root-referrer";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

// V1 staking 地址特征 — 检测到即认定整行 ContractConfig 为旧数据
const V1_STAKING_ADDRESSES = new Set([
  "0xc451ddcddbd9e8700e71960d190b55fe1ed57b34", // V1 Base Mainnet staking
  "0x6c3a3a5e93f01cb0b29162eb35b12be88f52bbc4", // V1 Base Sepolia staking (alt)
]);

// V2 合约地址（从 env 读取，env 是部署后权威来源）
function getV2ContractDefaults() {
  return {
    stakingContract:     process.env.NEXT_PUBLIC_VVECO_STAKING     ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64",
    payoutContract:      process.env.NEXT_PUBLIC_VVECO_PAYOUT      ?? "0x35FAac6Da16345A51437dE4b9a9D0571418fCA36",
    vvvToken:            process.env.NEXT_PUBLIC_VVV_TOKEN          ?? "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
    rootReferrerAddress: (process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS ?? "0x58940A90bc63E72F7F69ad62CA5C776D696b3F5e").toLowerCase(),
    projectWallet:       "0xa8c9118d6cf6164EBDC2aB99F19A9B36F599f191",
    feeWallet:           "0xb32134EA32276dD8cB7Ec689958d8cb9BaD60506",
    feePercent:          10,
    // priceRouter = AerodromeAdapter（不在 env 里，用常量）
    priceRouter:         "0x00A039F168B8B444175fC3bDdc1F3CA52e79a0fD",
  };
}

// GET /api/admin/contract-config
export async function GET() {
  try {
    let config = await prisma.contractConfig.findFirst({ where: { id: 1 } });

    if (!config) {
      // 空库 → 直接写入 V2 defaults
      const v2 = getV2ContractDefaults();
      config = await prisma.contractConfig.create({ data: { id: 1, ...v2 } });
      console.log("[contract-config] Created V2 contract_config row");
    } else {
      // 检测 V1 staking 地址 → 整行迁移
      const dbStaking = (config.stakingContract ?? "").toLowerCase();
      if (V1_STAKING_ADDRESSES.has(dbStaking)) {
        const v2 = getV2ContractDefaults();
        config = await prisma.contractConfig.update({ where: { id: 1 }, data: v2 });
        invalidateRootReferrerCache();
        console.log("[contract-config] Auto-migrated V1→V2 contract_config");
      }
    }

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 500 });
  }
}

// PUT /api/admin/contract-config
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["stakingContract", "payoutContract", "vvvToken", "priceRouter", "projectWallet", "feeWallet", "feePercent", "rootReferrerAddress"];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];

    const config = await prisma.contractConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    // 如果 rootReferrerAddress 被更新，使服务端缓存失效
    if (body.rootReferrerAddress !== undefined) {
      invalidateRootReferrerCache();
    }

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
