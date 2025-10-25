import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const account = searchParams.get("account"); // 'source' or 'target'
  const mode = searchParams.get("mode"); // 'full-migration' or 'mega-playlist'

  if (!account || !["source", "target"].includes(account)) {
    return NextResponse.json(
      { error: "Invalid account parameter" },
      { status: 400 }
    );
  }

  // Include mode in state so we can restore it after OAuth
  const state = `${account}_${mode || "none"}_${Date.now()}`;
  const authUrl = getAuthUrl(state, true); // Force showing the dialog

  return NextResponse.redirect(authUrl);
}
