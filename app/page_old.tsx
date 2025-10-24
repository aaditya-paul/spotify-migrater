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
        console.error("Error fetching user:", data.error);
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
    } catch (err) {
      console.error("Error fetching user:", err);
      setError(`Failed to load ${account} user data`);
    }
  };

  const handleConnect = (account: "source" | "target") => {
    window.location.href = `/api/auth?account=${account}`;
  };

  const handleDisconnect = async (account: "source" | "target") => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      if (account === "source") {
        setSourceUser(null);
      } else {
        setTargetUser(null);
      }
      setError(null);
    } catch {
      setError("Failed to disconnect");
    }
  };

  const handleFetchData = async () => {
    setFetchingData(true);
    setError(null);

    try {
      const response = await fetch("/api/fetch-data", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
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
      const response = await fetch("/api/migrate", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMigrationResult(data.results);
        setCurrentStep("complete");
      } else {
        setError(data.error || "Migration failed");
      }
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 px-4 py-8 sm:py-16">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-block mb-4 p-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <svg
              className="w-8 h-8 text-purple-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-light text-gray-100 mb-2 tracking-tight">
            Spotify Migrator
          </h1>
          <p className="text-sm text-gray-400 font-light">
            Transfer your music library seamlessly
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 backdrop-blur-sm rounded-2xl border border-red-500/20">
            <p className="text-red-300 text-sm text-center font-light">
              {error}
            </p>
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${currentStep === "connect-source" || currentStep === "fetch-data" ? "bg-purple-500 text-white" : "bg-white/10 text-gray-400"}`}>
            1
          </div>
          <div className="w-8 h-0.5 bg-white/10"></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${currentStep === "connect-target" ? "bg-purple-500 text-white" : currentStep === "migrate" || currentStep === "complete" ? "bg-green-500 text-white" : "bg-white/10 text-gray-400"}`}>
            2
          </div>
          <div className="w-8 h-0.5 bg-white/10"></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${currentStep === "migrate" || currentStep === "complete" ? "bg-green-500 text-white" : "bg-white/10 text-gray-400"}`}>
            3
          </div>
        </div>

        {/* Step 1: Connect Source & Fetch Data */}
        {(currentStep === "connect-source" || currentStep === "fetch-data") && (
          <div className="space-y-4 mb-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Step 1: Source Account
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              </div>

              {sourceUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {sourceUser.images?.[0] ? (
                    <img
                      src={sourceUser.images[0].url}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-purple-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 truncate text-sm">
                      {sourceUser.displayName}
                    </p>
                    {sourceUser.email && (
                      <p className="text-xs text-gray-500 truncate font-light">
                        {sourceUser.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect("source")}
                  className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("source")}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-purple-200 text-sm font-medium rounded-2xl transition-all"
              >
                Connect Account
              </button>
            )}
          </div>

          {/* Arrow Indicator */}
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </div>

          {/* Target Account */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                To Account
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
            </div>

            {targetUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {targetUser.images?.[0] ? (
                    <img
                      src={targetUser.images[0].url}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-blue-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 truncate text-sm">
                      {targetUser.displayName}
                    </p>
                    {targetUser.email && (
                      <p className="text-xs text-gray-500 truncate font-light">
                        {targetUser.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect("target")}
                  className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("target")}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 text-blue-200 text-sm font-medium rounded-2xl transition-all"
              >
                Connect Account
              </button>
            )}
          </div>
        </div>

        {/* Migration Button */}
        <div className="mb-8">
          <button
            onClick={handleMigrate}
            disabled={!sourceUser || !targetUser || migrating}
            className={`w-full py-4 px-6 font-medium text-sm rounded-3xl transition-all ${
              !sourceUser || !targetUser || migrating
                ? "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
                : "bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-blue-500/30 hover:from-purple-500/40 hover:via-pink-500/40 hover:to-blue-500/40 border border-purple-500/30 text-gray-100"
            }`}
          >
            {migrating ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
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

        {/* Migration Results */}
        {migrationResult && (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-green-500/20">
            <div className="text-center mb-6">
              <div className="inline-block mb-3 p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-gray-100 mb-1">
                Migration Complete
              </h2>
              <p className="text-xs text-gray-400 font-light">
                Your library has been transferred
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                <p className="text-2xl font-light text-green-300 mb-1">
                  {migrationResult.likedSongs}
                </p>
                <p className="text-xs text-gray-400 font-light">Liked Songs</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center">
                <p className="text-2xl font-light text-purple-300 mb-1">
                  {migrationResult.playlists}
                </p>
                <p className="text-xs text-gray-400 font-light">Playlists</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                <p className="text-2xl font-light text-blue-300 mb-1">
                  {migrationResult.albums}
                </p>
                <p className="text-xs text-gray-400 font-light">Albums</p>
              </div>
              <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 text-center">
                <p className="text-2xl font-light text-pink-300 mb-1">
                  {migrationResult.artists}
                </p>
                <p className="text-xs text-gray-400 font-light">Artists</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
