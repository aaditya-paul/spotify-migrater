import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const { account } = await request.json();

  if (!account || !["source", "target"].includes(account)) {
    return NextResponse.json(
      { error: "Invalid account parameter" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete(`${account}_access_token`);
  cookieStore.delete(`${account}_refresh_token`);
  cookieStore.delete(`${account}_expires_at`);

  return NextResponse.json({ success: true });
}
