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

export async function POST() {
  console.log("=== CREATE MEGA PLAYLIST STARTED ===");

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

      console.log("Fetching all music data...");
      await sendEvent({ stage: "Starting...", count: 0 });

      // Collect all unique track IDs
      const allTrackIds = new Set<string>();

      // 1. Get liked songs
      console.log("Fetching liked songs...");
      await sendEvent({ stage: "Fetching liked songs...", count: 0 });
      let offset = 0;
      while (true) {
        const data = await retryWithBackoff(() =>
          spotify.getMySavedTracks({ limit: 50, offset })
        );
        data.body.items.forEach((item) => {
          if (item.track?.id) allTrackIds.add(item.track.id);
        });
        if (data.body.items.length < 50) break;
        offset += 50;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log(`✓ Found ${allTrackIds.size} liked songs`);
      await sendEvent({
        stage: "Liked songs fetched",
        count: allTrackIds.size,
      });

      // 2. Get all playlists and their tracks
      console.log("Fetching playlists...");
      await sendEvent({
        stage: "Fetching playlists...",
        count: allTrackIds.size,
      });
      offset = 0;
      const playlists = [];
      while (true) {
        const data = await retryWithBackoff(() =>
          spotify.getUserPlaylists({ limit: 50, offset })
        );
        playlists.push(...data.body.items);
        if (data.body.items.length < 50) break;
        offset += 50;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`Found ${playlists.length} playlists, fetching tracks...`);
      await sendEvent({
        stage: `Fetching tracks from ${playlists.length} playlists...`,
        count: allTrackIds.size,
      });

      for (let i = 0; i < playlists.length; i++) {
        const playlist = playlists[i];
        await sendEvent({
          stage: `Playlist: ${playlist.name}`,
          count: allTrackIds.size,
          total: playlists.length,
        });

        let playlistOffset = 0;
        while (true) {
          const data = await retryWithBackoff(() =>
            spotify.getPlaylistTracks(playlist.id, {
              limit: 100,
              offset: playlistOffset,
            })
          );
          data.body.items.forEach((item) => {
            if (item.track?.id) allTrackIds.add(item.track.id);
          });
          if (data.body.items.length < 100) break;
          playlistOffset += 100;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      console.log(`✓ Total unique tracks after playlists: ${allTrackIds.size}`);
      await sendEvent({
        stage: "All playlists processed",
        count: allTrackIds.size,
      });

      // 3. Get saved albums and their tracks
      console.log("Fetching albums...");
      await sendEvent({ stage: "Fetching albums...", count: allTrackIds.size });
      offset = 0;
      const albums = [];
      while (true) {
        const data = await retryWithBackoff(() =>
          spotify.getMySavedAlbums({ limit: 50, offset })
        );
        albums.push(...data.body.items);
        if (data.body.items.length < 50) break;
        offset += 50;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      for (let i = 0; i < albums.length; i++) {
        const item = albums[i];
        await sendEvent({
          stage: `Album: ${item.album.name}`,
          count: allTrackIds.size,
        });
        const albumTracks = await retryWithBackoff(() =>
          spotify.getAlbumTracks(item.album.id)
        );
        albumTracks.body.items.forEach((track) => {
          if (track.id) allTrackIds.add(track.id);
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log(`✓ Total unique tracks after albums: ${allTrackIds.size}`);
      await sendEvent({
        stage: "All albums processed",
        count: allTrackIds.size,
      });

      // Create the mega playlist
      console.log("Creating mega playlist...");
      await sendEvent({
        stage: "Creating playlist...",
        count: allTrackIds.size,
      });
      const playlistName = `🎵 My Complete Library - ${new Date().toLocaleDateString()}`;
      const playlistDescription = `All songs from liked songs, playlists, and albums. Created on ${new Date().toLocaleString()}. Total: ${
        allTrackIds.size
      } unique tracks.`;

      const newPlaylist = await retryWithBackoff(() =>
        spotify.createPlaylist(playlistName, {
          description: playlistDescription,
          public: true,
        })
      );

      console.log(
        `✓ Playlist created: ${newPlaylist.body.name} (${newPlaylist.body.id})`
      );
      await sendEvent({
        stage: "Playlist created, adding tracks...",
        count: allTrackIds.size,
      });

      // Add tracks to playlist in batches of 100
      const trackUris = Array.from(allTrackIds).map(
        (id) => `spotify:track:${id}`
      );
      console.log(`Adding ${trackUris.length} tracks to playlist...`);

      const totalBatches = Math.ceil(trackUris.length / 100);
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await retryWithBackoff(() =>
          spotify.addTracksToPlaylist(newPlaylist.body.id, batch)
        );
        const batchNum = Math.floor(i / 100) + 1;
        console.log(`  Added batch ${batchNum}/${totalBatches}`);
        await sendEvent({
          stage: `Adding tracks...`,
          count: Math.min(i + 100, trackUris.length),
          total: trackUris.length,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("=== MEGA PLAYLIST CREATED SUCCESSFULLY ===");
      console.log(`Total tracks: ${allTrackIds.size}`);
      console.log(`Playlist URL: ${newPlaylist.body.external_urls.spotify}`);

      // Send final success event
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            stage: "COMPLETE",
            playlistUrl: newPlaylist.body.external_urls.spotify,
            playlistId: newPlaylist.body.id,
            totalTracks: allTrackIds.size,
          })}\n\n`
        )
      );

      await writer.close();
    } catch (error) {
      console.error("=== ERROR CREATING MEGA PLAYLIST ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      await sendEvent({
        stage: `Error: ${
          error instanceof Error ? error.message : "Failed to create playlist"
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
