import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const account = searchParams.get("account"); // 'source' or 'target'

  if (!account || !["source", "target"].includes(account)) {
    return NextResponse.json(
      { error: "Invalid account parameter" },
      { status: 400 }
    );
  }

  const state = `${account}_${Date.now()}`;
  const authUrl = getAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
