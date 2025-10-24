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

  let accessToken: string | undefined;

  try {
    const cookieStore = await cookies();
    accessToken = cookieStore.get(`${account}_access_token`)?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const spotify = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
    });
    spotify.setAccessToken(accessToken);

    const userData = await spotify.getMe();

    return NextResponse.json({
      id: userData.body.id,
      displayName: userData.body.display_name,
      email: userData.body.email,
      images: userData.body.images,
    });
  } catch (error: unknown) {
    const err = error as { body?: any; statusCode?: number; message?: string };
    console.error("Error fetching user:", error);
    console.error("Error body:", err.body);
    console.error("Error statusCode:", err.statusCode);
    console.error(
      "Access token (first 20 chars):",
      accessToken?.substring(0, 20)
    );

    const errorMessage = err.message || "Unknown error";
    const errorDetails = err.body ? JSON.stringify(err.body) : errorMessage;

    return NextResponse.json(
      {
        error: "Failed to fetch user data",
        details: errorDetails,
        statusCode: err.statusCode,
      },
      { status: 500 }
    );
  }
}
