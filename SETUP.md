# 🚀 Quick Setup Guide

## Step 1: Get Spotify API Credentials

1. Visit [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the form:
   - **App name**: Spotify Migrater
   - **App description**: Migrate playlists and library between accounts
   - **Redirect URI**: `http://localhost:3000/api/callback`
   - **Which API/SDKs are you planning to use?**: Select "Web API"
5. Click **"Save"**
6. Click **"Settings"** button
7. Copy your **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

1. In the project root, you'll find `.env.local` file
2. Replace the placeholder values:

```env
SPOTIFY_CLIENT_ID=paste_your_client_id_here
SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/callback
SESSION_SECRET=any_random_string_here
```

💡 **Tip**: For `SESSION_SECRET`, you can use any random string. Example: `my_super_secret_key_12345`

## Step 3: Run the Application

```powershell
npm run dev
```

The app will be available at: **http://localhost:3000**

## Step 4: Use the Application

### Migration Process:

1. **Connect Source Account**

   - Click "Connect Source Account"
   - Log in with your **OLD** Spotify account
   - Grant permissions

2. **Connect Target Account**

   - Click "Connect Target Account"
   - Log in with your **NEW** Spotify account
   - Grant permissions

3. **Start Migration**
   - Click "🚀 Start Migration"
   - Wait for the process to complete (may take a few minutes)
   - View your migration results!

### What Gets Migrated:

✅ All liked/saved songs  
✅ All your playlists (with all tracks)  
✅ All saved albums  
✅ All followed artists

### What Doesn't Get Migrated:

❌ Spotify's generated playlists (Discover Weekly, etc.)  
❌ Playlists you follow but don't own  
❌ Podcasts and podcast episodes  
❌ Listening history

## Troubleshooting

### "Authentication Failed"

- Double-check your Client ID and Client Secret in `.env.local`
- Make sure the Redirect URI in Spotify Dashboard exactly matches: `http://localhost:3000/api/callback`
- Restart the dev server after changing `.env.local`

### "Migration Failed"

- Ensure both accounts are properly connected (you should see profile pictures)
- Check your internet connection
- The migration may take time for large libraries - be patient!
- Check the browser console (F12) for detailed error messages

### Port Already in Use

```powershell
# Use a different port
npm run dev -- -p 3001
```

Then update the Redirect URI in both:

- `.env.local`: `NEXT_PUBLIC_REDIRECT_URI=http://localhost:3001/api/callback`
- Spotify Dashboard: Add `http://localhost:3001/api/callback`

## Deployment to Production

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!
6. **Important**: Add your production callback URL in Spotify Dashboard:
   - Example: `https://your-app.vercel.app/api/callback`

## Security Notes

🔒 **Never commit `.env.local` to Git** - It contains your secret keys!  
🔒 **Use HTTPS in production** - HTTP-only cookies require secure connections  
🔒 **Tokens are stored in HTTP-only cookies** - Cannot be accessed by JavaScript  
🔒 **Tokens expire automatically** - You'll need to reconnect after expiration

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- Open an issue on GitHub if you encounter problems

---

**Happy migrating! 🎵**
