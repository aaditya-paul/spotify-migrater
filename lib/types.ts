export interface UserSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface MigrationProgress {
  status: "idle" | "in-progress" | "completed" | "error";
  currentStep: string;
  likedSongs: { total: number; migrated: number };
  playlists: { total: number; migrated: number };
  albums: { total: number; migrated: number };
  artists: { total: number; migrated: number };
  error?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  isPublic: boolean;
}
