# 🎵 Spotify Migrater

A serverless Next.js application to migrate your entire Spotify library (playlists, liked songs, albums, and followed artists) between two user accounts using the Spotify Web API and OAuth 2.0.

## ✨ Features

- **Liked Songs Migration**: Transfer all your saved tracks
- **Playlist Migration**: Copy all your custom playlists with their tracks
- **Album Migration**: Migrate your saved album collection
- **Artist Migration**: Transfer followed artists
- **OAuth 2.0 Authentication**: Secure login for both source and target accounts
- **Serverless Architecture**: Built with Next.js API routes
- **Real-time Progress**: Visual feedback during migration
- **Dark Mode Support**: Beautiful UI that works in light and dark modes

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Spotify Developer account
- Two Spotify accounts (source and target)

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in the details:
   - **App name**: Spotify Migrater
   - **App description**: Migrate Spotify library between accounts
   - **Redirect URI**: `http://localhost:3000/api/callback`
   - **APIs used**: Web API
4. Save your **Client ID** and **Client Secret**

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/callback
SESSION_SECRET=your_random_session_secret_here
```

Replace the placeholder values with your actual Spotify app credentials.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 How to Use

1. **Connect Source Account**: Click "Connect Source Account" and log in with your source Spotify account
2. **Connect Target Account**: Click "Connect Target Account" and log in with your target Spotify account
3. **Start Migration**: Once both accounts are connected, click "🚀 Start Migration"
4. **Wait for Completion**: The migration will process all your data. This may take a few minutes depending on your library size
5. **View Results**: See the summary of migrated items (songs, playlists, albums, artists)

## 🏗️ Architecture

### Frontend

- **Next.js 16** with App Router
- **React 19** for UI components
- **Tailwind CSS 4** for styling
- **Axios** for API calls

### Backend (Serverless API Routes)

- `/api/auth` - Initiates OAuth flow
- `/api/callback` - Handles OAuth callback
- `/api/user` - Fetches user information
- `/api/migrate` - Performs the migration
- `/api/logout` - Disconnects accounts

### Authentication Flow

1. User clicks connect button
2. Redirected to Spotify OAuth page
3. User grants permissions
4. Callback receives authorization code
5. Exchange code for access/refresh tokens
6. Store tokens in HTTP-only cookies

### Migration Process

1. Fetch all items from source account (liked songs, playlists, albums, artists)
2. Create equivalent items in target account
3. Handle API rate limits with batching
4. Return migration summary

## 🔒 Security

- OAuth 2.0 authentication
- HTTP-only cookies for token storage
- Environment variables for sensitive data
- No passwords stored
- Tokens expire automatically

## 🌐 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Update Redirect URI in Spotify app settings to your production URL
5. Deploy!

### Update Spotify App Settings

After deployment, add your production callback URL:

- `https://your-domain.vercel.app/api/callback`

## 📝 API Permissions (Scopes)

The app requests the following Spotify scopes:

- `user-library-read` - Read saved tracks and albums
- `user-library-modify` - Save tracks and albums
- `playlist-read-private` - Read private playlists
- `playlist-read-collaborative` - Read collaborative playlists
- `playlist-modify-public` - Create and modify public playlists
- `playlist-modify-private` - Create and modify private playlists
- `user-follow-read` - Read followed artists
- `user-follow-modify` - Follow artists

## ⚠️ Limitations

- Spotify API rate limits apply (may need to wait between batches)
- Cannot migrate Spotify's own playlists (like Discover Weekly)
- Cannot migrate playlists you don't own (only followed)
- Podcast episodes are not included
- Play history is not migrated

## 🛠️ Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **API Client**: spotify-web-api-node
- **HTTP Client**: Axios
- **Deployment**: Vercel (recommended)

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💡 Support

If you encounter any issues:

1. Check that your Spotify app credentials are correct
2. Ensure both accounts are properly authenticated
3. Check the browser console for errors
4. Verify your redirect URI matches exactly

## 🎉 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Uses [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Powered by [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node)
