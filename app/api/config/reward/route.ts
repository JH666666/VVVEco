import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// V2 correct defaults — single source of truth
const V2_DEFAULTS = {
  generationRates: "10,5,3",
  periodRates:     "0.7,0.8,0.9,1.0",
  periodDurations: "1,15,30,60",
  periodUnits:     "day,day,day,day",
} as const;

// Detect a row that still holds V1 values and auto-migrate to V2.
// V1 signatures: generationRates="15,10,5"  OR  periodDurations starts with "7,"
function isV1Row(row: { generationRates: string; periodDurations: string }) {
  return row.generationRates === "15,10,5" || row.periodDurations.startsWith("7,");
}

// GET /api/config/reward
export async function GET() {
  try {
    let config = await prisma.rewardConfig.findFirst({ where: { id: 1 } });

    if (!config) {
      config = await prisma.rewardConfig.create({ data: { id: 1, ...V2_DEFAULTS } });
    } else if (isV1Row(config)) {
      // Existing row has V1 defaults — silently migrate to V2
      config = await prisma.rewardConfig.update({
        where: { id: 1 },
        data: V2_DEFAULTS,
      });
      console.log("[config/reward] Auto-migrated V1 reward_config row to V2 defaults");
    }

    return NextResponse.json({
      generationRates: config.generationRates.split(",").map(Number),
      periodRates:     config.periodRates.split(",").map(Number),
      periodDurations: config.periodDurations.split(",").map(Number),
      periodUnits:     config.periodUnits.split(","),
    });
  } catch {
    return NextResponse.json(
      { generationRates: [10, 5, 3], periodRates: [0.7, 0.8, 0.9, 1.0], periodDurations: [1, 15, 30, 60], periodUnits: ["day", "day", "day", "day"] }
    );
  }
}

// PUT /api/config/reward
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const data: Record<string, string> = {};
    if (body.generationRates) data.generationRates = body.generationRates.join(",");
    if (body.periodRates) data.periodRates = body.periodRates.join(",");
    if (body.periodDurations) data.periodDurations = body.periodDurations.join(",");
    if (body.periodUnits) data.periodUnits = body.periodUnits.join(",");

    const config = await prisma.rewardConfig.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        generationRates: "10,5,3",
        periodRates: "0.7,0.8,0.9,1.0",
        periodDurations: "1,15,30,60",
        periodUnits: "day,day,day,day",
        ...data,
      },
    });

    return NextResponse.json({
      generationRates: config.generationRates.split(",").map(Number),
      periodRates: config.periodRates.split(",").map(Number),
      periodDurations: config.periodDurations.split(",").map(Number),
      periodUnits: config.periodUnits.split(","),
    });
  } catch {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
