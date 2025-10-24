import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import SpotifyWebApi from "spotify-web-api-node";

interface MigrationData {
  savedTracks: string[];
  playlists: Array<{
    name: string;
    description: string;
    tracks: string[];
    isPublic: boolean;
  }>;
  savedAlbums: string[];
  followedArtists: string[];
}

export async function POST(request: Request) {
  console.log("=== MIGRATION STARTED ===");
  try {
    const cookieStore = await cookies();
    const targetToken = cookieStore.get("target_access_token")?.value;

    // Get migration data from request body
    const body = await request.json();
    const migrationData: MigrationData = body.migrationData;

    console.log("Target token found:", targetToken ? "Yes" : "No");
    console.log("Migration data received:", migrationData ? "Yes" : "No");

    if (!targetToken) {
      console.log("ERROR: No target token");
      return NextResponse.json(
        { error: "Target account must be authenticated" },
        { status: 401 }
      );
    }

    if (!migrationData) {
      console.log("ERROR: No migration data");
      return NextResponse.json(
        {
          error:
            "No migration data found. Please fetch data from source account first",
        },
        { status: 400 }
      );
    }

    console.log("Migration data loaded:");
    console.log(`  - Liked songs: ${migrationData.savedTracks?.length || 0}`);
    console.log(`  - Playlists: ${migrationData.playlists?.length || 0}`);
    console.log(`  - Albums: ${migrationData.savedAlbums?.length || 0}`);
    console.log(`  - Artists: ${migrationData.followedArtists?.length || 0}`);
    console.log("First 3 track IDs:", migrationData.savedTracks?.slice(0, 3));
    console.log("First 3 album IDs:", migrationData.savedAlbums?.slice(0, 3));
    console.log(
      "Track IDs type check:",
      Array.isArray(migrationData.savedTracks)
    );
    console.log(
      "Album IDs type check:",
      Array.isArray(migrationData.savedAlbums)
    );

    const targetApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
    });
    targetApi.setAccessToken(targetToken);

    const results = {
      likedSongs: 0,
      playlists: 0,
      albums: 0,
      artists: 0,
    };

    // Migrate liked songs
    console.log("Migrating liked songs...");
    const validTracks = migrationData.savedTracks.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validTracks.length > 0) {
      for (let i = 0; i < validTracks.length; i += 50) {
        const batch = validTracks.slice(i, i + 50);
        console.log(
          `  Adding batch ${Math.floor(i / 50) + 1}: ${batch.length} tracks`
        );
        await targetApi.addToMySavedTracks(batch);
      }
      console.log(`✓ Migrated ${validTracks.length} liked songs`);
    } else {
      console.log("  No liked songs to migrate");
    }
    results.likedSongs = validTracks.length;

    // Migrate playlists
    console.log("Migrating playlists...");
    for (const playlist of migrationData.playlists) {
      const validPlaylistTracks = playlist.tracks.filter(
        (id) => id && typeof id === "string" && id.trim().length > 0
      );
      if (validPlaylistTracks.length === 0) continue;

      console.log(
        `  Creating playlist "${playlist.name}" with ${validPlaylistTracks.length} tracks`
      );
      const newPlaylist = await targetApi.createPlaylist(playlist.name, {
        description: playlist.description,
        public: playlist.isPublic,
      });

      // Add tracks in batches of 100
      const trackUris = validPlaylistTracks.map((id) => `spotify:track:${id}`);
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await targetApi.addTracksToPlaylist(newPlaylist.body.id, batch);
      }
      results.playlists++;
    }
    console.log(`✓ Created ${results.playlists} playlists`);

    // Migrate albums
    console.log("Migrating albums...");
    const validAlbums = migrationData.savedAlbums.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validAlbums.length > 0) {
      for (let i = 0; i < validAlbums.length; i += 20) {
        const batch = validAlbums.slice(i, i + 20);
        console.log(
          `  Adding batch ${Math.floor(i / 20) + 1}: ${batch.length} albums`
        );
        console.log(`  Album IDs in batch:`, batch);
        try {
          // Workaround: spotify-web-api-node has a bug where addToMySavedAlbums doesn't wrap ids
          // We need to make a direct API call with the correct format
          const response = await fetch(
            `https://api.spotify.com/v1/me/albums?ids=${batch.join(",")}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${targetToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            throw new Error(
              `Spotify API error: ${response.status} ${response.statusText}`
            );
          }

          console.log(`  ✓ Batch ${Math.floor(i / 20) + 1} added successfully`);
        } catch (err) {
          console.error(
            `  ✗ Error adding batch ${Math.floor(i / 20) + 1}:`,
            err
          );
          throw err;
        }
      }
      console.log(`✓ Migrated ${validAlbums.length} albums`);
    } else {
      console.log("  No albums to migrate");
    }
    results.albums = validAlbums.length;

    // Migrate artists
    console.log("Migrating artists...");
    const validArtists = migrationData.followedArtists.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validArtists.length > 0) {
      for (let i = 0; i < validArtists.length; i += 50) {
        const batch = validArtists.slice(i, i + 50);
        console.log(
          `  Following batch ${Math.floor(i / 50) + 1}: ${batch.length} artists`
        );
        await targetApi.followArtists(batch);
      }
      console.log(`✓ Followed ${validArtists.length} artists`);
    } else {
      console.log("  No artists to follow");
    }
    results.artists = validArtists.length;

    console.log("=== MIGRATION COMPLETE ===");
    console.log("Results:", results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("=== MIGRATION ERROR ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
