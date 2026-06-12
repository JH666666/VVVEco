import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/config/reward
export async function GET() {
  try {
    let config = await prisma.rewardConfig.findFirst({ where: { id: 1 } });

    if (!config) {
      config = await prisma.rewardConfig.create({
        data: { id: 1 },
      });
    }

    return NextResponse.json({
      generationRates: config.generationRates.split(",").map(Number),
      periodRates: config.periodRates.split(",").map(Number),
      periodDurations: config.periodDurations.split(",").map(Number),
      periodUnits: config.periodUnits.split(","),
    });
  } catch {
    return NextResponse.json(
      { generationRates: [15, 10, 5], periodRates: [0.7, 0.8, 0.9, 1.0], periodDurations: [7, 15, 30, 60], periodUnits: ["day", "day", "day", "day"] }
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
        generationRates: "15,10,5",
        periodRates: "0.7,0.8,0.9,1.0",
        periodDurations: "7,15,30,60",
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
