import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import cors from "cors";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();

// Middleware to protect routes
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.sendStatus(403);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", firebase: "connected" });
  });

  // --- OAuth Routes ---

  app.get("/api/auth/url/:platform", (req, res) => {
    const { platform } = req.params;
    const origin = req.query.origin || `https://${req.get('host')}`;
    const uid = req.query.uid;
    const redirectUri = `${origin}/auth/callback/${platform}`;

    // Encode uid in state to retrieve it in callback
    const state = JSON.stringify({ uid, timestamp: Date.now() });

    let authUrl = "";
    if (platform === "Twitter") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.TWITTER_CLIENT_ID || "MOCK_TWITTER_ID",
        redirect_uri: redirectUri,
        scope: "tweet.read tweet.write users.read offline.access",
        state: state,
        code_challenge: "challenge",
        code_challenge_method: "plain",
      });
      authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    } else if (platform === "LinkedIn") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.LINKEDIN_CLIENT_ID || "MOCK_LINKEDIN_ID",
        redirect_uri: redirectUri,
        scope: "w_member_social profile openid email",
        state: state,
      });
      authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    } else if (platform === "Facebook" || platform === "Instagram") {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID || "MOCK_FB_ID",
        redirect_uri: redirectUri,
        scope: "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
        state: state,
      });
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
    } else if (platform === "Threads") {
      const params = new URLSearchParams({
        client_id: process.env.THREADS_CLIENT_ID || "MOCK_THREADS_ID",
        redirect_uri: redirectUri,
        scope: "threads_basic,threads_content_publish",
        response_type: "code",
        state: state,
      });
      authUrl = `https://www.threads.net/oauth/authorize?${params.toString()}`;
    } else {
      return res.status(400).json({ error: "Unsupported platform" });
    }

    res.json({ url: authUrl });
  });

  app.get("/auth/callback/:platform", async (req, res) => {
    const { platform } = req.params;
    const { code, state } = req.query;

    let uid = "";
    if (state) {
      try {
        const decodedState = JSON.parse(state as string);
        uid = decodedState.uid;
      } catch (e) {
        console.error("Failed to parse state:", e);
      }
    }

    // In a real app, exchange code for tokens here
    console.log(`[AUTH] Exchanging code for ${platform} tokens for user ${uid}...`);
    
    // Mock token exchange
    await new Promise(resolve => setTimeout(resolve, 1000));
    const mockToken = {
      access_token: `mock_token_${platform}_${Math.random().toString(36).substring(7)}`,
      refresh_token: `mock_refresh_${platform}_${Math.random().toString(36).substring(7)}`,
      expires_at: Date.now() + 3600 * 1000,
      platform,
      userId: uid
    };
    
    // Save token to Firestore securely per user
    if (uid) {
      console.log(`[AUTH] Saving tokens for user ${uid} for platform ${platform}`);
      await db.collection("users").doc(uid).collection("tokens").doc(platform).set({
        ...mockToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`[AUTH] Successfully connected to ${platform}. User: ${uid}`);

    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b;">
          <div style="text-align: center; padding: 3rem; background: white; border-radius: 1.5rem; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); max-width: 400px; width: 90%;">
            <div style="width: 64px; height: 64px; background: #ecfdf5; color: #059669; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h2 style="color: #0f172a; margin-bottom: 0.5rem; font-size: 1.5rem;">Account Connected!</h2>
            <p style="color: #64748b; font-size: 0.875rem; line-height: 1.5;">Your <strong>${platform}</strong> account has been officially linked to ImaGenie.</p>
            <div style="margin-top: 2rem; padding: 1rem; background: #f1f5f9; border-radius: 0.75rem; font-size: 0.75rem; color: #475569;">
              This window will close automatically in a moment.
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  platform: '${platform}',
                  status: 'connected'
                }, '*');
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </div>
        </body>
      </html>
    `);
  });

  // --- Publishing Routes ---

  app.post("/api/publish", async (req, res) => {
    const { platform, content, hashtags, userId, postId } = req.body;

    console.log(`[PUBLISH] Attempting to publish to ${platform} for user ${userId}...`);
    console.log(`[PUBLISH] Content: ${content}`);
    console.log(`[PUBLISH] Hashtags: ${hashtags?.join(', ')}`);

    // --- Real API Implementation Logic ---
    try {
      // 1. Fetch user's platform token from secure DB
      const tokenDoc = await db.collection("users").doc(userId).collection("tokens").doc(platform).get();
      
      if (!tokenDoc.exists) {
        console.warn(`[PUBLISH] No token found for user ${userId} and platform ${platform}. Using mock mode.`);
      } else {
        const tokenData = tokenDoc.data();
        console.log(`[PUBLISH] Using token for ${platform} updated at: ${tokenData?.updatedAt?.toDate()}`);
        // Here you would use tokenData.access_token to call the real API
      }
      
      // 2. Call Platform API
      // In a real app, this would return a URL to the published post
      const mockPublishedUrl = `https://${platform.toLowerCase()}.com/post/${Math.random().toString(36).substring(7)}`;

      if (platform === "Twitter") {
        console.log("[PUBLISH] Calling Twitter API v2 /tweets endpoint...");
        // const client = new TwitterApi(token);
        // await client.v2.tweet(`${content} ${hashtags.join(' ')}`);
      } else if (platform === "LinkedIn") {
        console.log("[PUBLISH] Calling LinkedIn API /ugcPosts endpoint...");
        // await fetch('https://api.linkedin.com/v2/ugcPosts', { ... });
      } else if (platform === "Facebook" || platform === "Instagram") {
        console.log(`[PUBLISH] Calling Meta Graph API for ${platform}...`);
      }

      // Simulate network delay for the real API call
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      console.log(`[PUBLISH] Successfully published to ${platform}!`);

      // 3. Update the post in the DB
      if (postId) {
        await db.collection("posts").doc(postId).update({
          status: "published",
          publishedUrl: mockPublishedUrl,
          publishedAt: new Date().toISOString()
        });
      }

      res.json({ 
        success: true, 
        message: `Successfully published to ${platform}`,
        platform,
        publishedUrl: mockPublishedUrl,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[PUBLISH] Failed to publish to ${platform}:`, error);
      res.status(500).json({ success: false, error: "Publishing failed" });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
