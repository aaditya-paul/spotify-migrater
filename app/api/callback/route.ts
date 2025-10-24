import { NextRequest, NextResponse } from "next/server";
import { spotifyApi } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Use the configured redirect URI to determine the base URL
  const baseUrl =
    process.env.NEXT_PUBLIC_REDIRECT_URI?.replace("/api/callback", "") ||
    request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  try {
    // Extract account type from state
    const accountType = state.split("_")[0];

    if (!["source", "target"].includes(accountType)) {
      return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
    }

    // Exchange code for tokens
    const data = await spotifyApi.authorizationCodeGrant(code);

    const { access_token, refresh_token, expires_in } = data.body;

    // Calculate expiration time
    const expiresAt = Date.now() + expires_in * 1000;

    // Create redirect response
    const response = NextResponse.redirect(
      `${baseUrl}/?account=${accountType}&status=connected`
    );

    // Set cookies on the response
    response.cookies.set(`${accountType}_access_token`, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expires_in,
      path: "/",
    });

    response.cookies.set(`${accountType}_refresh_token`, refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    response.cookies.set(`${accountType}_expires_at`, expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expires_in,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error getting tokens:", error);
    const baseUrl =
      process.env.NEXT_PUBLIC_REDIRECT_URI?.replace("/api/callback", "") ||
      request.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/?error=auth_failed`);
  }
}
