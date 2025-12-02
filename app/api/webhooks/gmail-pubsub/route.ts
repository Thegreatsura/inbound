import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Accept all requests without processing
  return NextResponse.json({ success: true }, { status: 200 });
}
