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

type Step =
  | "connect-source"
  | "fetch-data"
  | "connect-target"
  | "migrate"
  | "complete";

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>("connect-source");
  const [sourceUser, setSourceUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const account = params.get("account");
    const status = params.get("status");
    const error = params.get("error");

    if (error) {
      setError(`Authentication error: ${error}`);
      return;
    }

    if (account && status === "connected") {
      if (account === "source") {
        fetchUser("source");
        setCurrentStep("fetch-data");
      } else if (account === "target") {
        fetchUser("target");
        setCurrentStep("migrate");
      }
    }
  }, []);

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

  const handleConnect = (account: "source" | "target") => {
    window.location.href = `/api/auth?account=${account}`;
  };

  const handleFetchData = async () => {
    setFetchingData(true);
    setError(null);

    try {
      const response = await fetch("/api/fetch-data", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        // Store the fetched data in local storage
        localStorage.setItem("migration_data", JSON.stringify(data.data));
        localStorage.setItem("migration_counts", JSON.stringify(data.counts));
        setCurrentStep("connect-target");
      } else {
        setError(data.error || "Failed to fetch data");
      }
    } catch {
      setError("Failed to fetch data");
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
        setCurrentStep("complete");
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

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-gray-800 px-4 py-8 sm:py-16">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-light text-gray-100 mb-2">
            Spotify Migrator
          </h1>
          <p className="text-sm text-gray-400">
            Transfer your music library in 3 easy steps
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === "connect-source" || currentStep === "fetch-data"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-gray-400"
            }`}
          >
            1
          </div>
          <div className="w-12 h-0.5 bg-white/20"></div>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === "connect-target"
                ? "bg-purple-500 text-white"
                : currentStep === "migrate" || currentStep === "complete"
                ? "bg-green-500 text-white"
                : "bg-white/10 text-gray-400"
            }`}
          >
            2
          </div>
          <div className="w-12 h-0.5 bg-white/20"></div>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === "migrate" || currentStep === "complete"
                ? "bg-green-500 text-white"
                : "bg-white/10 text-gray-400"
            }`}
          >
            3
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
            <p className="text-red-300 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Step 1: Connect Source & Fetch Data */}
        {(currentStep === "connect-source" || currentStep === "fetch-data") && (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
            <h2 className="text-lg font-medium text-gray-100 mb-4">
              Step 1: Source Account
            </h2>

            {!sourceUser ? (
              <div>
                <p className="text-sm text-gray-400 mb-4">
                  Connect the account you want to migrate FROM
                </p>
                <button
                  onClick={() => handleConnect("source")}
                  className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-2xl transition-all"
                >
                  Connect Source Account
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4 p-3 bg-black/20 rounded-xl">
                  {sourceUser.images?.[0] && (
                    <img
                      src={sourceUser.images[0].url}
                      alt="Profile"
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-100">
                      {sourceUser.displayName}
                    </p>
                    <p className="text-xs text-gray-400">{sourceUser.email}</p>
                  </div>
                </div>

                {currentStep === "fetch-data" && (
                  <button
                    onClick={handleFetchData}
                    disabled={fetchingData}
                    className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium rounded-2xl transition-all"
                  >
                    {fetchingData
                      ? "Fetching your data..."
                      : "Fetch My Music Data"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Connect Target */}
        {currentStep === "connect-target" && (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
            <h2 className="text-lg font-medium text-gray-100 mb-4">
              Step 2: Target Account
            </h2>

            {!targetUser ? (
              <div>
                <p className="text-sm text-gray-400 mb-4">
                  Connect the account you want to migrate TO
                </p>
                <button
                  onClick={() => handleConnect("target")}
                  className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-2xl transition-all"
                >
                  Connect Target Account
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                {targetUser.images?.[0] && (
                  <img
                    src={targetUser.images[0].url}
                    alt="Profile"
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-100">
                    {targetUser.displayName}
                  </p>
                  <p className="text-xs text-gray-400">{targetUser.email}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Migrate */}
        {currentStep === "migrate" && targetUser && (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
            <h2 className="text-lg font-medium text-gray-100 mb-4">
              Step 3: Start Migration
            </h2>

            <div className="mb-4 p-3 bg-black/20 rounded-xl">
              <p className="font-medium text-gray-100">
                {targetUser.displayName}
              </p>
              <p className="text-xs text-gray-400">{targetUser.email}</p>
            </div>

            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium rounded-2xl transition-all"
            >
              {migrating ? "Migrating..." : "Start Migration"}
            </button>
          </div>
        )}

        {/* Complete */}
        {currentStep === "complete" && migrationResult && (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-green-500/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">
                Migration Complete!
              </h2>
              <p className="text-gray-400 text-sm">
                Your library has been transferred
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">
                  {migrationResult.likedSongs}
                </p>
                <p className="text-xs text-gray-400">Liked Songs</p>
              </div>
              <div className="bg-black/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {migrationResult.playlists}
                </p>
                <p className="text-xs text-gray-400">Playlists</p>
              </div>
              <div className="bg-black/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {migrationResult.albums}
                </p>
                <p className="text-xs text-gray-400">Albums</p>
              </div>
              <div className="bg-black/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-pink-400">
                  {migrationResult.artists}
                </p>
                <p className="text-xs text-gray-400">Artists</p>
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "/")}
              className="w-full mt-6 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl transition-all"
            >
              Start New Migration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
