"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";

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

export default function Home() {
  const [sourceUser, setSourceUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
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
      fetchUser(account as "source" | "target");
    }
  }, []);

  const fetchUser = async (account: "source" | "target") => {
    try {
      const response = await axios.get(`/api/user?account=${account}`);
      if (account === "source") {
        setSourceUser(response.data);
      } else {
        setTargetUser(response.data);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  const handleConnect = (account: "source" | "target") => {
    window.location.href = `/api/auth?account=${account}`;
  };

  const handleDisconnect = async (account: "source" | "target") => {
    try {
      await axios.post("/api/logout", { account });
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

  const handleMigrate = async () => {
    if (!sourceUser || !targetUser) {
      setError("Both accounts must be connected");
      return;
    }

    setMigrating(true);
    setError(null);
    setMigrationResult(null);

    try {
      const response = await axios.post("/api/migrate");
      setMigrationResult(response.data.results);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.details || "Migration failed");
      } else {
        setError("Migration failed");
      }
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            🎵 Spotify Migrater
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Transfer your playlists, liked songs, albums, and followed artists
            between Spotify accounts
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Account Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Source Account */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-500">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Source Account
            </h2>
            {sourceUser ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  {sourceUser.images?.[0] && (
                    <Image
                      src={sourceUser.images[0].url}
                      alt="Profile"
                      className="w-16 h-16 rounded-full"
                      width={64}
                      height={64}
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {sourceUser.displayName}
                    </p>
                    {sourceUser.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {sourceUser.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect("source")}
                  className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("source")}
                className="w-full py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
              >
                Connect Source Account
              </button>
            )}
          </div>

          {/* Target Account */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-blue-500">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Target Account
            </h2>
            {targetUser ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  {targetUser.images?.[0] && (
                    <Image
                      src={targetUser.images[0].url}
                      alt="Profile"
                      className="w-16 h-16 rounded-full"
                      width={64}
                      height={64}
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {targetUser.displayName}
                    </p>
                    {targetUser.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {targetUser.email}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect("target")}
                  className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("target")}
                className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
              >
                Connect Target Account
              </button>
            )}
          </div>
        </div>

        {/* Migration Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleMigrate}
            disabled={!sourceUser || !targetUser || migrating}
            className={`py-4 px-8 text-xl font-bold text-white rounded-lg transition-all transform hover:scale-105 ${
              !sourceUser || !targetUser || migrating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-linear-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 shadow-xl"
            }`}
          >
            {migrating ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
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
              "🚀 Start Migration"
            )}
          </button>
        </div>

        {/* Migration Results */}
        {migrationResult && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">
              ✅ Migration Complete!
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {migrationResult.likedSongs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Liked Songs
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {migrationResult.playlists}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Playlists
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {migrationResult.albums}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Albums
                </p>
              </div>
              <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                <p className="text-4xl font-bold text-pink-600 dark:text-pink-400">
                  {migrationResult.artists}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Artists
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-md">
            <div className="text-4xl mb-3">💚</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Liked Songs
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Transfer all your saved tracks
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-md">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Playlists
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Copy all your custom playlists
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-md">
            <div className="text-4xl mb-3">💿</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Albums
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Migrate your album collection
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-md">
            <div className="text-4xl mb-3">🎤</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Artists
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Transfer followed artists
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
