import { cookies } from "next/headers";
import SpotifyWebApi from "spotify-web-api-node";

// Helper function to retry failed requests
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastRetry = i === maxRetries - 1;
      const isRetryable =
        error?.statusCode === 502 ||
        error?.statusCode === 429 ||
        error?.statusCode === 503;

      if (isLastRetry || !isRetryable) {
        throw error;
      }

      // Exponential backoff: wait longer after each retry
      const waitTime = delayMs * Math.pow(2, i);
      console.log(
        `Retry ${i + 1}/${maxRetries} after ${waitTime}ms (Error: ${
          error?.statusCode || "Unknown"
        })`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function POST(request: Request) {
  console.log("=== FETCH DATA STARTED ===");

  // Create a TransformStream for Server-Sent Events
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (data: {
    stage: string;
    count?: number;
    total?: number;
  }) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Start the async process
  (async () => {
    try {
      // Get mode from request body
      let mode: string | null = null;
      try {
        const body = await request.json();
        mode = body.mode || null;
      } catch {
        // If no body, mode will be null (fetch everything)
      }

      console.log("Mode:", mode);
      const isLikedSongsOnly = mode === "liked-songs-playlist";

      const cookieStore = await cookies();
      const accessToken = cookieStore.get("source_access_token")?.value;

      console.log("Access token found:", accessToken ? "Yes" : "No");

      if (!accessToken) {
        console.log("ERROR: No access token found");
        await sendEvent({ stage: "Error: Not authenticated", count: 0 });
        await writer.close();
        return;
      }

      const spotify = new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
      });
      spotify.setAccessToken(accessToken);

      console.log("Starting to fetch data...");
      await sendEvent({ stage: "Starting...", count: 0 });

      // Fetch all data from source account
      console.log("Fetching saved tracks...");
      await sendEvent({ stage: "Fetching liked songs...", count: 0 });
      const savedTracks = await fetchAllSavedTracks(spotify);
      console.log(`✓ Fetched ${savedTracks.length} saved tracks`);
      await sendEvent({
        stage: "Liked songs fetched",
        count: savedTracks.length,
      });

      let playlists: Array<{
        name: string;
        description: string;
        tracks: string[];
        isPublic: boolean;
      }> = [];
      let savedAlbums: string[] = [];
      let followedArtists: string[] = [];

      // Only fetch playlists, albums, and artists if NOT in liked-songs-only mode
      if (!isLikedSongsOnly) {
        console.log("Fetching playlists...");
        await sendEvent({ stage: "Fetching playlists...", count: 0 });
        playlists = await fetchAllPlaylists(spotify, sendEvent);
        console.log(`✓ Fetched ${playlists.length} playlists`);
        await sendEvent({ stage: "Playlists fetched", count: playlists.length });

        console.log("Fetching saved albums...");
        await sendEvent({ stage: "Fetching albums...", count: 0 });
        savedAlbums = await fetchAllSavedAlbums(spotify);
        console.log(`✓ Fetched ${savedAlbums.length} saved albums`);
        await sendEvent({ stage: "Albums fetched", count: savedAlbums.length });

        console.log("Fetching followed artists...");
        await sendEvent({ stage: "Fetching artists...", count: 0 });
        followedArtists = await fetchAllFollowedArtists(spotify);
        console.log(`✓ Fetched ${followedArtists.length} followed artists`);
        await sendEvent({
          stage: "Artists fetched",
          count: followedArtists.length,
        });
      }

      // Store in cookies (or you could use a database)
      const migrationData = {
        savedTracks,
        playlists,
        savedAlbums,
        followedArtists,
      };

      // Log the fetched data
      console.log("=== FETCHED DATA ===");
      console.log(`Liked Songs: ${savedTracks.length}`);
      console.log(`Track IDs (first 5):`, savedTracks.slice(0, 5));
      console.log(`\nPlaylists: ${playlists.length}`);
      playlists.forEach((pl, idx) => {
        console.log(
          `  ${idx + 1}. "${pl.name}" - ${pl.tracks.length} tracks (${
            pl.isPublic ? "Public" : "Private"
          })`
        );
      });
      console.log(`\nAlbums: ${savedAlbums.length}`);
      console.log(`Album IDs (first 5):`, savedAlbums.slice(0, 5));
      console.log(`\nFollowed Artists: ${followedArtists.length}`);
      console.log(`Artist IDs (first 5):`, followedArtists.slice(0, 5));
      console.log("===================\n");

      const totalItems =
        savedTracks.length +
        playlists.length +
        savedAlbums.length +
        followedArtists.length;
      await sendEvent({ stage: "Complete!", count: totalItems });

      // Send final data
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            stage: "COMPLETE",
            data: migrationData,
            counts: {
              likedSongs: savedTracks.length,
              playlists: playlists.length,
              albums: savedAlbums.length,
              artists: followedArtists.length,
            },
          })}\n\n`
        )
      );

      await writer.close();
    } catch (error) {
      console.error("=== ERROR FETCHING DATA ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      await sendEvent({
        stage: `Error: ${
          error instanceof Error ? error.message : "Failed to fetch data"
        }`,
        count: 0,
      });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function fetchAllSavedTracks(spotify: SpotifyWebApi) {
  const tracks: string[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await retryWithBackoff(() =>
      spotify.getMySavedTracks({ limit, offset })
    );
    tracks.push(...data.body.items.map((item) => item.track.id));
    if (data.body.items.length < limit) break;
    offset += limit;

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return tracks;
}

async function fetchAllPlaylists(
  spotify: SpotifyWebApi,
  sendEvent?: (data: { stage: string; count?: number }) => Promise<void>
) {
  const playlists: Array<{
    name: string;
    description: string;
    tracks: string[];
    isPublic: boolean;
  }> = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await retryWithBackoff(() =>
      spotify.getUserPlaylists({ limit, offset })
    );
    for (const playlist of data.body.items) {
      // Fetch all tracks in this playlist
      if (sendEvent) {
        await sendEvent({
          stage: `Fetching playlist: ${playlist.name}`,
          count: playlists.length,
        });
      }
      const tracks = await fetchPlaylistTracks(spotify, playlist.id);
      playlists.push({
        name: playlist.name,
        description: playlist.description || "",
        tracks,
        isPublic: playlist.public ?? false,
      });

      // Small delay between playlists
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (data.body.items.length < limit) break;
    offset += limit;
  }

  return playlists;
}

async function fetchPlaylistTracks(spotify: SpotifyWebApi, playlistId: string) {
  const tracks: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await retryWithBackoff(() =>
      spotify.getPlaylistTracks(playlistId, { limit, offset })
    );
    tracks.push(
      ...(data.body.items
        .map((item) => item.track?.id)
        .filter(Boolean) as string[])
    );
    if (data.body.items.length < limit) break;
    offset += limit;

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return tracks;
}

async function fetchAllSavedAlbums(spotify: SpotifyWebApi) {
  const albums: string[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await retryWithBackoff(() =>
      spotify.getMySavedAlbums({ limit, offset })
    );
    albums.push(...data.body.items.map((item) => item.album.id));
    if (data.body.items.length < limit) break;
    offset += limit;

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return albums;
}

async function fetchAllFollowedArtists(spotify: SpotifyWebApi) {
  const artists: string[] = [];
  let after: string | undefined;

  while (true) {
    const data = await retryWithBackoff(() =>
      spotify.getFollowedArtists({ limit: 50, after })
    );
    artists.push(...data.body.artists.items.map((artist) => artist.id));
    if (!data.body.artists.next) break;
    after = data.body.artists.items[data.body.artists.items.length - 1].id;

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return artists;
}
