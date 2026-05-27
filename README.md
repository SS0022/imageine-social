<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ImaGenie - Your Vision, Our Magic

ImaGenie is an AI-powered social media assistant that generates content, creates visuals, and schedules posts across multiple platforms.

## Firebase Setup (Mandatory)

To fix the `auth/unauthorized-domain` and Firestore errors, you must:

1. **Authorize Domains**: Go to [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0871219618/authentication/settings) > Authentication > Settings > Authorized Domains and add:
   - `isolutionindiaa.com`
   - `ais-dev-cb6kmlkwf7ovv7riiuq7em-598054090778.asia-southeast1.run.app`

2. **Enable Google Sign-In**: Go to Authentication > Sign-in method and enable **Google**.

3. **Firestore**: Ensure the database is created in the console.

## Mobile App (Android)

This project includes a native Android wrapper using Capacitor.
1. Sync web changes: `npx cap sync android`
2. Build in Android Studio or using Gradle.
3. Package: `com.imagenie.app`

## Dependencies

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
