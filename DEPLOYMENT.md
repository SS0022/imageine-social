# ImaGenie Deployment Guide

ImaGenie is a modern AI-powered social media assistant. It uses **Firebase** for Authentication and Database (Firestore), and **Google Gemini** for AI content generation.

---

## 1. Firebase Setup (Mandatory)

The application relies entirely on Firebase. You MUST configure your Firebase project for the app to function.

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project named **ImaGenie**.

### Step 2: Enable Authentication
1. Navigate to **Build > Authentication**.
2. Click **Get Started**.
3. Enable **Google** as a sign-in provider.
4. **Authorized Domains**: Add your production domain (e.g., `isolutionindiaa.com`) and any preview URLs provided by your hosting environment.

### Step 3: Enable Firestore Database
1. Navigate to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location and start in **Production Mode**.
4. Apply the security rules found in the `firestore.rules` file in this repository.

### Step 4: Configuration File
1. The app expects a `firebase-applet-config.json` file in the root.
2. If you are using the AI Studio deployment, this is managed for you.
3. For manual deployments, ensure your Firebase web config is correctly mapped in `src/lib/firebase.ts`.

---

## 2. API Keys & Secrets

Ensure the following environment variables are set in your deployment environment (e.g., Cloud Run, Vercel, or local `.env`):

- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`: For X/Twitter integration.
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`: For LinkedIn integration.
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`: For Facebook/Instagram integration.

---

## 3. Local Development

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)

### Run the App
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open **`http://localhost:3000`** in your browser.

---

## 4. Android Version (Capacitor)

ImaGenie comes with a native Android wrapper using Capacitor.

### Update Android Project
If you make changes to the web app, sync them to Android:
```bash
npm run build
npx cap sync android
```

### Build APK
1. Open the `android` folder in **Android Studio**.
2. Build the project and generate a signed APK/Bundle.
3. The package name is `com.imagenie.app`.

---

## 5. Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Motion.
- **Backend**: Node.js (Express) - handles OAuth proxies and SSR.
- **AI**: Google Gemini Pro (Text & Vision).
- **Database**: Firebase Firestore (NoSQL).
- **Auth**: Firebase Auth (Google).
- **Mobile**: Capacitor (Native Android).
