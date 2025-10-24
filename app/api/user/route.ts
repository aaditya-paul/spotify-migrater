import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import SpotifyWebApi from "spotify-web-api-node";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const account = searchParams.get("account");

  if (!account || !["source", "target"].includes(account)) {
    return NextResponse.json(
      { error: "Invalid account parameter" },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(`${account}_access_token`)?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const spotify = new SpotifyWebApi();
    spotify.setAccessToken(accessToken);

    const userData = await spotify.getMe();

    return NextResponse.json({
      id: userData.body.id,
      displayName: userData.body.display_name,
      email: userData.body.email,
      images: userData.body.images,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
