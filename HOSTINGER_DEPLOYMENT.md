# Manual Deployment Guide: Hostinger (Node.js)

Follow these steps to manually deploy **ImaGenie** to Hostinger. This guide assumes you have a **Hostinger VPS** or **Node.js Hosting** plan.

---

## Step 1: Build the Application Locally
Before uploading, you must generate the production-ready frontend files.
1. Open your terminal in the project root.
2. Run:
   ```bash
   npm run build
   ```
3. This will create a `dist/` folder. This folder contains your React frontend.

---

## Step 2: Prepare the Deployment Package
Collect only the files needed for production. Create a new folder on your computer and move these items into it:
- `dist/` (The folder created in Step 1)
- `server.ts` (The Express entry point)
- `package.json`
- `package-lock.json`
- `firebase-applet-config.json` (Your Firebase configuration)
- `tsconfig.json` (Needed for tsx to run)

---

## Step 3: Upload Files to Hostinger
1. Log in to your **Hostinger hPanel**.
2. Go to **Files** > **File Manager**.
3. Navigate to your domain's directory (usually `public_html`).
4. **Upload** the files/folders prepared in Step 2.
   *Tip: Zip them first, upload the zip, then extract it in the File Manager to save time.*

---

## Step 4: Configure the Node.js App
1. In hPanel, go to **Advanced** > **Node.js**.
2. Click **Create New Application** or edit your existing one:
   - **Node.js Version**: Select **Node.js 18** or **20**.
   - **App Directory**: Set this to the folder where you uploaded your files (e.g., `/public_html`).
   - **Main Application File**: Set this to `server.ts`.
   - **Environment Variables**: Click "Add" to enter your production secrets:
     - `GEMINI_API_KEY`: [Your Key]
     - `TWITTER_CLIENT_ID`: [Your Key]
     - `TWITTER_CLIENT_SECRET`: [Your Key]
     - `LINKEDIN_CLIENT_ID`: [Your Key]
     - `LINKEDIN_CLIENT_SECRET`: [Your Key]
     - `FACEBOOK_CLIENT_ID`: [Your Key]
     - `FACEBOOK_CLIENT_SECRET`: [Your Key]
     - `NODE_ENV`: `production`

---

## Step 5: Install Dependencies & Start
1. Once the app is created in hPanel, you will see buttons for the application.
2. Click **Install Dependencies** (this runs `npm install`).
3. Click **Start** to launch the server.
4. Check the **Logs** tab in the hPanel Node.js section to ensure the server started on port 3000 (Hostinger will map this automatically to your domain).

---

## Step 6: Final Domain Configuration (Firebase & OAuth)
Your app is now live, but login will fail unless you tell Firebase and the social platforms about your Hostinger domain.

1. **Firebase Console**:
   - Go to **Authentication** > **Settings** > **Authorized Domains**.
   - Add `isolutionindiaa.com`.
2. **Social Developer Dashboards**:
   - For all platforms (Twitter, LinkedIn, Facebook), update the **Redirect URIs** to:
     `https://isolutionindiaa.com/auth/callback/[PlatformName]`
3. **SSL (HTTPS)**:
   - Ensure you have an **SSL Certificate** activated in Hostinger for `isolutionindiaa.com`. Social login will NOT work without HTTPS.

---

### Troubleshooting
- **Error "tsx not found"**: Ensure you run `npm install` in the Hostinger panel so that the `dependencies` (including `tsx`) are installed.
- **Port Conflicts**: The `server.ts` is configured to port 3000. Hostinger's Node.js manager handles routing traffic from port 80/443 to your app.
