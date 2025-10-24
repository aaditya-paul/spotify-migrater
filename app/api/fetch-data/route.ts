import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import SpotifyWebApi from "spotify-web-api-node";

export async function POST() {
  console.log("=== FETCH DATA STARTED ===");
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("source_access_token")?.value;

    console.log("Access token found:", accessToken ? "Yes" : "No");

    if (!accessToken) {
      console.log("ERROR: No access token found");
      return NextResponse.json(
        { error: "Source account not authenticated" },
        { status: 401 }
      );
    }

    const spotify = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
    });
    spotify.setAccessToken(accessToken);

    console.log("Starting to fetch data...");

    // Fetch all data from source account
    console.log("Fetching saved tracks...");
    const savedTracks = await fetchAllSavedTracks(spotify);
    console.log(`✓ Fetched ${savedTracks.length} saved tracks`);

    console.log("Fetching playlists...");
    const playlists = await fetchAllPlaylists(spotify);
    console.log(`✓ Fetched ${playlists.length} playlists`);

    console.log("Fetching saved albums...");
    const savedAlbums = await fetchAllSavedAlbums(spotify);
    console.log(`✓ Fetched ${savedAlbums.length} saved albums`);

    console.log("Fetching followed artists...");
    const followedArtists = await fetchAllFollowedArtists(spotify);
    console.log(`✓ Fetched ${followedArtists.length} followed artists`);

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

    // Return the data to be stored in local storage by the client
    return NextResponse.json({
      success: true,
      data: migrationData,
      counts: {
        likedSongs: savedTracks.length,
        playlists: playlists.length,
        albums: savedAlbums.length,
        artists: followedArtists.length,
      },
    });
  } catch (error) {
    console.error("=== ERROR FETCHING DATA ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function fetchAllSavedTracks(spotify: SpotifyWebApi) {
  const tracks: string[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await spotify.getMySavedTracks({ limit, offset });
    tracks.push(...data.body.items.map((item) => item.track.id));
    if (data.body.items.length < limit) break;
    offset += limit;
  }

  return tracks;
}

async function fetchAllPlaylists(spotify: SpotifyWebApi) {
  const playlists: Array<{
    name: string;
    description: string;
    tracks: string[];
    isPublic: boolean;
  }> = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await spotify.getUserPlaylists({ limit, offset });
    for (const playlist of data.body.items) {
      // Fetch all tracks in this playlist
      const tracks = await fetchPlaylistTracks(spotify, playlist.id);
      playlists.push({
        name: playlist.name,
        description: playlist.description || "",
        tracks,
        isPublic: playlist.public ?? false,
      });
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
    const data = await spotify.getPlaylistTracks(playlistId, { limit, offset });
    tracks.push(
      ...(data.body.items
        .map((item) => item.track?.id)
        .filter(Boolean) as string[])
    );
    if (data.body.items.length < limit) break;
    offset += limit;
  }

  return tracks;
}

async function fetchAllSavedAlbums(spotify: SpotifyWebApi) {
  const albums: string[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const data = await spotify.getMySavedAlbums({ limit, offset });
    albums.push(...data.body.items.map((item) => item.album.id));
    if (data.body.items.length < limit) break;
    offset += limit;
  }

  return albums;
}

async function fetchAllFollowedArtists(spotify: SpotifyWebApi) {
  const artists: string[] = [];
  let after: string | undefined;

  while (true) {
    const data = await spotify.getFollowedArtists({ limit: 50, after });
    artists.push(...data.body.artists.items.map((artist) => artist.id));
    if (!data.body.artists.next) break;
    after = data.body.artists.items[data.body.artists.items.length - 1].id;
  }

  return artists;
}
