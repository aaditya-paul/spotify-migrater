"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  displayName: string;
  email?: string;
  images?: { url: string }[];
}

interface MigrationResult {
  likedSongs: number;
  playlists: number;
  albums: number;
  artists: number;
}

type Mode = "full-migration" | "mega-playlist" | "liked-songs-playlist";

interface FetchProgress {
  stage: string;
  count: number;
  total?: number;
}

interface FetchedData {
  likedSongs: number;
  playlists: number;
  albums: number;
  artists: number;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<string>("select-mode");
  const [sourceUser, setSourceUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(
    null
  );
  const [fetchedData, setFetchedData] = useState<FetchedData | null>(null);
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read URL parameters and set mode/step
  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode") as Mode | null;
    const urlStep = params.get("step");
    const account = params.get("account");
    const status = params.get("status");
    const error = params.get("error");

    if (error) {
      setError(`Authentication error: ${error}`);
      return;
    }

    if (urlMode) {
      setMode(urlMode);
      setStep(urlStep || "fetch-data");
    }

    if (account && status === "connected") {
      if (account === "source") {
        fetchUser("source");
      } else if (account === "target") {
        fetchUser("target");
      }
    }
  }, [mounted]);

  const fetchUser = async (account: "source" | "target") => {
    try {
      const response = await fetch(`/api/user?account=${account}`);
      const data = await response.json();

      if (!response.ok) {
        setError(
          `Failed to load ${account} user: ${data.error || "Unknown error"}`
        );
        return;
      }

      if (account === "source") {
        setSourceUser(data);
      } else {
        setTargetUser(data);
      }
      setError(null);
    } catch {
      setError(`Failed to load ${account} user data`);
    }
  };

  const navigateTo = (newStep: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("step", newStep);
    if (mode) params.set("mode", mode);
    window.history.pushState({}, "", `?${params.toString()}`);
    setStep(newStep);
  };

  const selectMode = (selectedMode: Mode) => {
    setMode(selectedMode);
    window.location.href = `?mode=${selectedMode}&step=connect-source`;
  };

  const handleConnect = (account: "source" | "target") => {
    const modeParam = mode ? `&mode=${mode}` : "";
    window.location.href = `/api/auth?account=${account}${modeParam}`;
  };

  const handleFetchData = async () => {
    setFetchingData(true);
    setError(null);
    setFetchProgress({ stage: "Starting...", count: 0 });

    try {
      const response = await fetch("/api/fetch-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok || !response.body) {
        setError("Failed to fetch data");
        setFetchProgress(null);
        setFetchingData(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.stage === "COMPLETE") {
              // Store the fetched data in local storage
              localStorage.setItem("migration_data", JSON.stringify(data.data));
              localStorage.setItem(
                "migration_counts",
                JSON.stringify(data.counts)
              );
              finalData = data;
            } else {
              // Update progress
              setFetchProgress({
                stage: data.stage,
                count: data.count || 0,
                total: data.total,
              });
            }
          }
        }
      }

      if (finalData) {
        setFetchedData(finalData.counts);
        setFetchProgress(null);

        setTimeout(() => {
          if (mode === "mega-playlist" || mode === "liked-songs-playlist") {
            navigateTo("create-playlist");
          } else {
            navigateTo("connect-target");
          }
        }, 500);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to fetch data");
      setFetchProgress(null);
    } finally {
      setFetchingData(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    setMigrationResult(null);

    try {
      // Get migration data from local storage
      const migrationDataStr = localStorage.getItem("migration_data");

      console.log("=== CLIENT-SIDE MIGRATION DEBUG ===");
      console.log("LocalStorage migration_data exists:", !!migrationDataStr);

      if (!migrationDataStr) {
        setError(
          "No migration data found. Please fetch data from source account first."
        );
        setMigrating(false);
        return;
      }

      const migrationData = JSON.parse(migrationDataStr);
      console.log("Parsed migration data:", {
        savedTracks: migrationData.savedTracks?.length || 0,
        playlists: migrationData.playlists?.length || 0,
        savedAlbums: migrationData.savedAlbums?.length || 0,
        followedArtists: migrationData.followedArtists?.length || 0,
      });
      console.log("First 3 track IDs:", migrationData.savedTracks?.slice(0, 3));
      console.log("First 3 album IDs:", migrationData.savedAlbums?.slice(0, 3));

      const response = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ migrationData }),
      });

      const data = await response.json();
      if (response.ok) {
        setMigrationResult(data.results);
        navigateTo("complete");
        // Clear local storage after successful migration
        localStorage.removeItem("migration_data");
        localStorage.removeItem("migration_counts");
      } else {
        setError(data.error || "Migration failed");
      }
    } catch (err) {
      console.error("Migration error on client:", err);
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  const handleCreateMegaPlaylist = async () => {
    setCreatingPlaylist(true);
    setError(null);
    setFetchProgress({ stage: "Starting...", count: 0 });

    try {
      // Use different API endpoint based on mode
      const endpoint =
        mode === "liked-songs-playlist"
          ? "/api/create-liked-songs-playlist"
          : "/api/create-mega-playlist";

      const response = await fetch(endpoint, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        setError("Failed to create playlist");
        setFetchProgress(null);
        setCreatingPlaylist(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.stage === "COMPLETE") {
              setPlaylistUrl(data.playlistUrl);
              setFetchProgress(null);
              setTimeout(() => {
                navigateTo("complete");
              }, 1000);
            } else {
              // Update progress
              setFetchProgress({
                stage: data.stage,
                count: data.count || 0,
                total: data.total,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Playlist creation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create playlist"
      );
      setFetchProgress(null);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] px-4 py-6 sm:py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#9b87f5]/20 to-[#7e69d6]/20 border border-[#9b87f5]/20 mb-4 sm:mb-6">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-[#b4a0ff] animate-pulse"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] px-4 py-6 sm:py-12">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#9b87f5]/20 to-[#7e69d6]/20 border border-[#9b87f5]/20 mb-4 sm:mb-6">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-[#b4a0ff]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-light text-white/95 mb-2 tracking-tight">
            Spotify Migrator
          </h1>
          <p className="text-sm sm:text-base text-white/40 font-light">
            Seamlessly transfer your music library
          </p>
        </div>

        {/* Step Indicator - Only show for full migration mode */}
        {mode === "full-migration" && (
          <div className="mb-8 sm:mb-10 flex items-center justify-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 ${
                  step === "connect-source" || step === "fetch-data"
                    ? "bg-gradient-to-br from-[#9b87f5] to-[#7e69d6] text-white shadow-lg shadow-[#9b87f5]/20"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}
              >
                1
              </div>
              <span className="text-[10px] sm:text-xs text-white/40 font-light">
                Source
              </span>
            </div>
            <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-white/10 to-white/5"></div>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 ${
                  step === "connect-target"
                    ? "bg-gradient-to-br from-[#9b87f5] to-[#7e69d6] text-white shadow-lg shadow-[#9b87f5]/20"
                    : step === "migrate" || step === "complete"
                    ? "bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] text-[#0a0a0f] shadow-lg shadow-[#a8d5ba]/20"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}
              >
                2
              </div>
              <span className="text-[10px] sm:text-xs text-white/40 font-light">
                Target
              </span>
            </div>
            <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-white/10 to-white/5"></div>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 ${
                  step === "migrate" || step === "complete"
                    ? "bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] text-[#0a0a0f] shadow-lg shadow-[#a8d5ba]/20"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}
              >
                3
              </div>
              <span className="text-[10px] sm:text-xs text-white/40 font-light">
                Migrate
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-[#ff6b6b]/10 rounded-xl border border-[#ff6b6b]/20 backdrop-blur-sm">
            <p className="text-[#ff9999] text-sm text-center font-light">
              {error}
            </p>
          </div>
        )}

        {/* Mode Selection */}
        {step === "select-mode" && (
          <div className="space-y-4">
            <div
              onClick={() => selectMode("full-migration")}
              className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl cursor-pointer hover:bg-white/[0.04] hover:border-[#9b87f5]/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9b87f5]/20 to-[#7e69d6]/20 border border-[#9b87f5]/20 flex items-center justify-center flex-shrink-0 group-hover:from-[#9b87f5]/30 group-hover:to-[#7e69d6]/30 transition-all">
                  <svg
                    className="w-6 h-6 text-[#b4a0ff]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    ></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-white/90 mb-2">
                    Full Migration
                  </h3>
                  <p className="text-sm text-white/50 font-light leading-relaxed">
                    Transfer all your music, playlists, albums, and followed
                    artists to another account
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={() => selectMode("mega-playlist")}
              className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl cursor-pointer hover:bg-white/[0.04] hover:border-[#a8d5ba]/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a8d5ba]/20 to-[#8bc9a3]/20 border border-[#a8d5ba]/20 flex items-center justify-center flex-shrink-0 group-hover:from-[#a8d5ba]/30 group-hover:to-[#8bc9a3]/30 transition-all">
                  <svg
                    className="w-6 h-6 text-[#a8d5ba]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    ></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-white/90 mb-2">
                    Create Mega Playlist
                  </h3>
                  <p className="text-sm text-white/50 font-light leading-relaxed">
                    Combine all songs from your liked songs, playlists, and
                    albums into one shareable playlist
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={() => selectMode("liked-songs-playlist")}
              className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl cursor-pointer hover:bg-white/[0.04] hover:border-[#87ceeb]/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#87ceeb]/20 to-[#6bb6d9]/20 border border-[#87ceeb]/20 flex items-center justify-center flex-shrink-0 group-hover:from-[#87ceeb]/30 group-hover:to-[#6bb6d9]/30 transition-all">
                  <svg
                    className="w-6 h-6 text-[#87ceeb]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    ></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-white/90 mb-2">
                    Liked Songs Playlist
                  </h3>
                  <p className="text-sm text-white/50 font-light leading-relaxed">
                    Export all your liked songs into a single shareable playlist
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Connect Source & Fetch Data */}
        {(step === "connect-source" || step === "fetch-data") && (
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1.5 h-8 bg-gradient-to-b from-[#9b87f5] to-[#7e69d6] rounded-full"></div>
              <h2 className="text-base sm:text-lg font-light text-white/90">
                Source Account
              </h2>
            </div>

            {!sourceUser ? (
              <div>
                <p className="text-sm text-white/50 mb-5 font-light leading-relaxed">
                  Connect the Spotify account you want to migrate from
                </p>
                <button
                  onClick={() => handleConnect("source")}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#9b87f5] to-[#7e69d6] hover:from-[#a694f7] hover:to-[#8d7dd8] text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#9b87f5]/25 hover:shadow-xl hover:shadow-[#9b87f5]/30"
                >
                  Connect Source Account
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-5 p-3.5 bg-white/[0.03] rounded-xl border border-white/5">
                  {sourceUser.images?.[0] ? (
                    <img
                      src={sourceUser.images[0].url}
                      alt="Profile"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-[#9b87f5]/20"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#9b87f5] to-[#7e69d6] flex items-center justify-center">
                      <span className="text-white text-lg font-medium">
                        {sourceUser.displayName?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white/90 text-sm sm:text-base truncate">
                      {sourceUser.displayName}
                    </p>
                    <p className="text-xs text-white/40 font-light truncate">
                      {sourceUser.email}
                    </p>
                  </div>
                </div>

                {step === "fetch-data" && (
                  <>
                    {fetchProgress && (
                      <div className="mb-5 p-4 bg-white/[0.03] rounded-xl border border-[#a8d5ba]/20">
                        <div className="flex items-center gap-3 mb-2">
                          <svg
                            className="animate-spin h-4 w-4 text-[#a8d5ba]"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span className="text-sm font-medium text-white/90">
                            {fetchProgress.stage}
                          </span>
                        </div>
                        {fetchProgress.count > 0 && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-light text-[#a8d5ba]">
                              {fetchProgress.count}
                            </span>
                            <span className="text-xs text-white/40">
                              items found
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleFetchData}
                      disabled={fetchingData}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-[#a8d5ba] to-[#8bc9a3] hover:from-[#b3dbc4] hover:to-[#96d0ab] disabled:from-white/5 disabled:to-white/5 disabled:text-white/30 text-[#0a0a0f] text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#a8d5ba]/25 hover:shadow-xl hover:shadow-[#a8d5ba]/30 disabled:shadow-none"
                    >
                      {fetchingData
                        ? "Fetching your data..."
                        : "Fetch My Music Data"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Connect Target */}
        {step === "connect-target" && (
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1.5 h-8 bg-gradient-to-b from-[#a8d5ba] to-[#8bc9a3] rounded-full"></div>
              <h2 className="text-base sm:text-lg font-light text-white/90">
                Target Account
              </h2>
            </div>

            {!targetUser ? (
              <div>
                <p className="text-sm text-white/50 mb-5 font-light leading-relaxed">
                  Connect the Spotify account you want to migrate to
                </p>
                <button
                  onClick={() => handleConnect("target")}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#a8d5ba] to-[#8bc9a3] hover:from-[#b3dbc4] hover:to-[#96d0ab] text-[#0a0a0f] text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#a8d5ba]/25 hover:shadow-xl hover:shadow-[#a8d5ba]/30"
                >
                  Connect Target Account
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 bg-white/[0.03] rounded-xl border border-white/5">
                {targetUser.images?.[0] ? (
                  <img
                    src={targetUser.images[0].url}
                    alt="Profile"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-[#a8d5ba]/20"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] flex items-center justify-center">
                    <span className="text-[#0a0a0f] text-lg font-medium">
                      {targetUser.displayName?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white/90 text-sm sm:text-base truncate">
                    {targetUser.displayName}
                  </p>
                  <p className="text-xs text-white/40 font-light truncate">
                    {targetUser.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Playlist - Mega Playlist Mode */}
        {step === "create-playlist" && sourceUser && fetchedData && (
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="p-2 hover:bg-white/5 rounded-lg transition-all"
              >
                <svg
                  className="w-5 h-5 text-white/40 hover:text-white/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  ></path>
                </svg>
              </button>
              <div className="w-1.5 h-8 bg-gradient-to-b from-[#a8d5ba] to-[#8bc9a3] rounded-full"></div>
              <h2 className="text-base sm:text-lg font-light text-white/90">
                Data Fetched Successfully
              </h2>
            </div>

            <div className="mb-5 p-3.5 bg-white/[0.03] rounded-xl border border-white/5 flex items-center gap-3">
              {sourceUser.images?.[0] ? (
                <img
                  src={sourceUser.images[0].url}
                  alt="Profile"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full ring-2 ring-[#a8d5ba]/20"
                />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] flex items-center justify-center">
                  <span className="text-[#0a0a0f] text-base font-medium">
                    {sourceUser.displayName?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white/90 text-sm truncate">
                  {sourceUser.displayName}
                </p>
                <p className="text-xs text-white/40 font-light truncate">
                  {sourceUser.email}
                </p>
              </div>
            </div>

            {/* Data Summary */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
              <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                <p className="text-3xl sm:text-4xl font-light text-[#a8d5ba] mb-1">
                  {fetchedData.likedSongs}
                </p>
                <p className="text-xs sm:text-sm text-white/40 font-light">
                  Liked Songs
                </p>
              </div>
              {mode !== "liked-songs-playlist" && (
                <>
                  <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                    <p className="text-3xl sm:text-4xl font-light text-[#b4a0ff] mb-1">
                      {fetchedData.playlists}
                    </p>
                    <p className="text-xs sm:text-sm text-white/40 font-light">
                      Playlists
                    </p>
                  </div>
                  <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                    <p className="text-3xl sm:text-4xl font-light text-[#87ceeb] mb-1">
                      {fetchedData.albums}
                    </p>
                    <p className="text-xs sm:text-sm text-white/40 font-light">
                      Albums
                    </p>
                  </div>
                  <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                    <p className="text-3xl sm:text-4xl font-light text-[#ffb4c8] mb-1">
                      {fetchedData.artists}
                    </p>
                    <p className="text-xs sm:text-sm text-white/40 font-light">
                      Artists
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="text-sm text-white/50 mb-5 font-light leading-relaxed">
              {mode === "liked-songs-playlist"
                ? "Ready to create a playlist with all your liked songs! This will create a single playlist with all your saved tracks."
                : "Ready to create a mega playlist with all your music! This will create a single playlist with all songs from your liked songs, playlists, and albums."}
            </p>

            {fetchProgress && (
              <div className="mb-5 p-4 bg-white/[0.03] rounded-xl border border-[#a8d5ba]/20">
                <div className="flex items-center gap-3 mb-2">
                  <svg
                    className="animate-spin h-4 w-4 text-[#a8d5ba]"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span className="text-sm font-medium text-white/90">
                    {fetchProgress.stage}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light text-[#a8d5ba]">
                    {fetchProgress.count}
                  </span>
                  <span className="text-xs text-white/40">
                    {fetchProgress.total ? `/ ${fetchProgress.total}` : "items"}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCreateMegaPlaylist}
              disabled={creatingPlaylist}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#a8d5ba] to-[#8bc9a3] hover:from-[#b3dbc4] hover:to-[#96d0ab] disabled:from-white/5 disabled:to-white/5 disabled:text-white/30 text-[#0a0a0f] text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#a8d5ba]/25 hover:shadow-xl hover:shadow-[#a8d5ba]/30 disabled:shadow-none"
            >
              {creatingPlaylist ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating playlist...
                </span>
              ) : mode === "liked-songs-playlist" ? (
                "Create Liked Songs Playlist"
              ) : (
                "Create Mega Playlist"
              )}
            </button>
          </div>
        )}

        {/* Step 3: Migrate */}
        {step === "migrate" && targetUser && (
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1.5 h-8 bg-gradient-to-b from-[#a8d5ba] to-[#8bc9a3] rounded-full"></div>
              <h2 className="text-base sm:text-lg font-light text-white/90">
                Ready to Migrate
              </h2>
            </div>

            <div className="mb-5 p-3.5 bg-white/[0.03] rounded-xl border border-white/5 flex items-center gap-3">
              {targetUser.images?.[0] ? (
                <img
                  src={targetUser.images[0].url}
                  alt="Profile"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full ring-2 ring-[#a8d5ba]/20"
                />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] flex items-center justify-center">
                  <span className="text-[#0a0a0f] text-base font-medium">
                    {targetUser.displayName?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white/90 text-sm truncate">
                  {targetUser.displayName}
                </p>
                <p className="text-xs text-white/40 font-light truncate">
                  {targetUser.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#a8d5ba] to-[#8bc9a3] hover:from-[#b3dbc4] hover:to-[#96d0ab] disabled:from-white/5 disabled:to-white/5 disabled:text-white/30 text-[#0a0a0f] text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#a8d5ba]/25 hover:shadow-xl hover:shadow-[#a8d5ba]/30 disabled:shadow-none"
            >
              {migrating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Migrating...
                </span>
              ) : (
                "Start Migration"
              )}
            </button>
          </div>
        )}

        {/* Complete */}
        {step === "complete" && (migrationResult || playlistUrl) && (
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-[#a8d5ba]/30 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#a8d5ba] to-[#8bc9a3] flex items-center justify-center shadow-lg shadow-[#a8d5ba]/30">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a0a0f]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-white/95 mb-2">
                {playlistUrl
                  ? mode === "liked-songs-playlist"
                    ? "Liked Songs Exported!"
                    : "Playlist Created!"
                  : "Migration Complete"}
              </h2>
              <p className="text-sm text-white/50 font-light">
                {playlistUrl
                  ? mode === "liked-songs-playlist"
                    ? "Your liked songs playlist is ready to share"
                    : "Your mega playlist is ready to share"
                  : "Your library has been successfully transferred"}
              </p>
            </div>

            {playlistUrl && (
              <div className="mb-6">
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 border border-white/5 mb-4">
                  <p className="text-xs text-white/40 font-light mb-2">
                    Playlist URL
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={playlistUrl}
                      readOnly
                      className="flex-1 bg-transparent text-[#a8d5ba] text-sm font-light truncate outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(playlistUrl);
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 px-4 bg-gradient-to-r from-[#a8d5ba] to-[#8bc9a3] hover:from-[#b3dbc4] hover:to-[#96d0ab] text-[#0a0a0f] text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#a8d5ba]/25 hover:shadow-xl hover:shadow-[#a8d5ba]/30 text-center"
                >
                  Open in Spotify
                </a>
              </div>
            )}

            {migrationResult && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                  <p className="text-3xl sm:text-4xl font-light text-[#a8d5ba] mb-1">
                    {migrationResult.likedSongs}
                  </p>
                  <p className="text-xs sm:text-sm text-white/40 font-light">
                    Liked Songs
                  </p>
                </div>
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                  <p className="text-3xl sm:text-4xl font-light text-[#b4a0ff] mb-1">
                    {migrationResult.playlists}
                  </p>
                  <p className="text-xs sm:text-sm text-white/40 font-light">
                    Playlists
                  </p>
                </div>
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                  <p className="text-3xl sm:text-4xl font-light text-[#87ceeb] mb-1">
                    {migrationResult.albums}
                  </p>
                  <p className="text-xs sm:text-sm text-white/40 font-light">
                    Albums
                  </p>
                </div>
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 sm:p-5 text-center border border-white/5">
                  <p className="text-3xl sm:text-4xl font-light text-[#ffb4c8] mb-1">
                    {migrationResult.artists}
                  </p>
                  <p className="text-xs sm:text-sm text-white/40 font-light">
                    Artists
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => (window.location.href = "/")}
              className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-light rounded-xl transition-all duration-200 border border-white/10"
            >
              Start New Migration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
