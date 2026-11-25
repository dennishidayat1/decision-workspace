# Decision Workspace client

The Angular/Ionic client serves the web application and the local Capacitor Android/iOS projects.

## Web

Run commands from this directory:

```powershell
npm ci
npm start
npm test -- --watch=false
npm run build
```

Production browser assets are written to `dist/decision-workspace-web/browser`.

## Native development

The local application ID is `id.my.dennishidayat.decisionworkspace` on both platforms. Creating these project files does not register an identifier with Apple or Google.

```powershell
npm run native:sync:android
npm run native:open:android
```

Android requires Android Studio, a Gradle-compatible JDK (the Capacitor Android sources target Java 21), Android SDK Platform 36, build tools, and an emulator or USB-debugging-enabled device. Android Studio maintains the ignored `android/local.properties` SDK path. To build a debug APK after configuring the toolchain:

```powershell
cd android
.\gradlew.bat assembleDebug
```

On a Mac with Xcode 26 or newer:

```sh
npm ci
npm run native:sync:ios
npm run native:open:ios
```

The iOS project uses Swift Package Manager and targets iOS 15 or newer. Device signing, provisioning, and store accounts must be configured separately. Windows can generate/sync project files but cannot compile or run the iOS app.

## API access

Native sync scripts build the production client, using the existing HTTPS API. Assets are packaged locally; `server.url` and cleartext transport exceptions are not configured.

The backend supports `FrontendUrl` (legacy scalar), `FrontendUrls` (web allowlist), and `NativeFrontendUrls` (additional native allowlist). Native origins match the explicit Capacitor configuration: Android `https://localhost`, iOS `capacitor://localhost`. Backend source/config changes must be deployed separately before installed apps can use the hosted API; no deployment is performed by native sync.

A development API at `localhost:5207` is not reachable from a physical device as the host PC. Use a reachable HTTPS development API when device-specific development configuration is needed.

For Android emulator live reload at `http://10.0.2.2:4200`, the development build uses `http://10.0.2.2:5207/api` (the emulator's host bridge). Desktop development continues to use `http://localhost:5207/api`. Run the API with the Development environment to allow both exact live-reload origins; restart the API after changing its CORS configuration. The emulator needs its own Supabase sign-in because browser storage is scoped to each origin. Production builds and packaged native API access are unchanged.

## Release status

Generated icons/splash screens are development placeholders. Release signing, final branding, privacy disclosures, account/data deletion, real-device validation, and store submission remain separate milestones. Keep keystores, provisioning profiles, and credentials out of Git.
