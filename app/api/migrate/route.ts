import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import SpotifyWebApi from "spotify-web-api-node";

async function getAllItems<T>(
  fetchFunction: (options: { limit: number; offset: number }) => Promise<{
    body: { items: T[]; total: number };
  }>,
  limit = 50
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  let total = 0;

  do {
    const response = await fetchFunction({ limit, offset });
    items.push(...response.body.items);
    total = response.body.total;
    offset += limit;
  } while (offset < total);

  return items;
}

async function migrateLikedSongs(
  sourceApi: SpotifyWebApi,
  targetApi: SpotifyWebApi
) {
  console.log("Migrating liked songs...");

  const likedTracks = await getAllItems<SpotifyApi.SavedTrackObject>(
    (options) => sourceApi.getMySavedTracks(options)
  );

  const trackIds = likedTracks.map((item) => item.track.id);

  // Spotify API allows max 50 tracks per request
  for (let i = 0; i < trackIds.length; i += 50) {
    const batch = trackIds.slice(i, i + 50);
    await targetApi.addToMySavedTracks(batch);
  }

  return likedTracks.length;
}

async function migratePlaylists(
  sourceApi: SpotifyWebApi,
  targetApi: SpotifyWebApi,
  sourceUserId: string
) {
  console.log("Migrating playlists...");

  const playlists = await getAllItems<SpotifyApi.PlaylistObjectSimplified>(
    (options) => sourceApi.getUserPlaylists(sourceUserId, options)
  );

  // Filter out playlists not owned by the user
  const ownedPlaylists = playlists.filter((p) => p.owner.id === sourceUserId);

  let migratedCount = 0;

  for (const playlist of ownedPlaylists) {
    // Get all tracks from the playlist
    const playlistTracks = await getAllItems<SpotifyApi.PlaylistTrackObject>(
      (options) => sourceApi.getPlaylistTracks(playlist.id, options)
    );

    const trackUris = playlistTracks
      .filter((item) => item.track && item.track.uri)
      .map((item) => item.track!.uri);

    if (trackUris.length === 0) continue;

    // Create new playlist in target account
    const newPlaylist = await targetApi.createPlaylist(playlist.name, {
      description: playlist.description || "",
      public: playlist.public ?? false,
    });

    // Add tracks in batches of 100
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);
      await targetApi.addTracksToPlaylist(newPlaylist.body.id, batch);
    }

    migratedCount++;
  }

  return migratedCount;
}

async function migrateAlbums(
  sourceApi: SpotifyWebApi,
  targetApi: SpotifyWebApi
) {
  console.log("Migrating saved albums...");

  const albums = await getAllItems<SpotifyApi.SavedAlbumObject>((options) =>
    sourceApi.getMySavedAlbums(options)
  );

  const albumIds = albums.map((item) => item.album.id);

  for (let i = 0; i < albumIds.length; i += 50) {
    const batch = albumIds.slice(i, i + 50);
    await targetApi.addToMySavedAlbums(batch);
  }

  return albums.length;
}

async function migrateArtists(
  sourceApi: SpotifyWebApi,
  targetApi: SpotifyWebApi
) {
  console.log("Migrating followed artists...");

  const artists: SpotifyApi.ArtistObjectFull[] = [];
  let after: string | undefined;

  do {
    const response = await sourceApi.getFollowedArtists({ limit: 50, after });
    artists.push(...response.body.artists.items);
    after = response.body.artists.cursors?.after;
  } while (after);

  const artistIds = artists.map((artist) => artist.id);

  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    await targetApi.followArtists(batch);
  }

  return artists.length;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sourceToken = cookieStore.get("source_access_token")?.value;
    const targetToken = cookieStore.get("target_access_token")?.value;

    if (!sourceToken || !targetToken) {
      return NextResponse.json(
        { error: "Both accounts must be authenticated" },
        { status: 401 }
      );
    }

    const sourceApi = new SpotifyWebApi();
    sourceApi.setAccessToken(sourceToken);

    const targetApi = new SpotifyWebApi();
    targetApi.setAccessToken(targetToken);

    // Get source user ID
    const sourceUser = await sourceApi.getMe();
    const sourceUserId = sourceUser.body.id;

    const results = {
      likedSongs: 0,
      playlists: 0,
      albums: 0,
      artists: 0,
    };

    // Migrate everything
    results.likedSongs = await migrateLikedSongs(sourceApi, targetApi);
    results.playlists = await migratePlaylists(
      sourceApi,
      targetApi,
      sourceUserId
    );
    results.albums = await migrateAlbums(sourceApi, targetApi);
    results.artists = await migrateArtists(sourceApi, targetApi);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
