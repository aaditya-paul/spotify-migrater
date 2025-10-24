import { NextRequest, NextResponse } from "next/server";
import { spotifyApi } from "@/lib/spotify";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${request.nextUrl.origin}/?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/?error=missing_params`
    );
  }

  try {
    // Extract account type from state
    const accountType = state.split("_")[0];

    if (!["source", "target"].includes(accountType)) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const data = await spotifyApi.authorizationCodeGrant(code);

    const { access_token, refresh_token, expires_in } = data.body;

    // Calculate expiration time
    const expiresAt = Date.now() + expires_in * 1000;

    // Store tokens in cookies (in production, use secure session storage)
    const cookieStore = await cookies();
    cookieStore.set(`${accountType}_access_token`, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expires_in,
    });

    cookieStore.set(`${accountType}_refresh_token`, refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    cookieStore.set(`${accountType}_expires_at`, expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expires_in,
    });

    // Redirect back to home with success
    return NextResponse.redirect(
      `${request.nextUrl.origin}/?account=${accountType}&status=connected`
    );
  } catch (error) {
    console.error("Error getting tokens:", error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/?error=auth_failed`
    );
  }
}
