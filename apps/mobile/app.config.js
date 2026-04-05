/**
 * Extends static `app.json` with Android Google Maps API key for `react-native-maps`
 * (same env var as Routes/Geocoding; enable "Maps SDK for Android" on the key).
 */
const path = require("path");

// Merge `apps/mobile/.env` into `process.env` for this config file. Metro also loads `.env` for
// `expo start`, but `eas build` / `expo prebuild` evaluate this file in Node — without this, the
// Android native Maps key stays empty locally. EAS-hosted builds: set EXPO_PUBLIC_* on expo.dev
// (`.env` is gitignored and is not uploaded).
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

module.exports = ({ config }) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey,
        },
      },
    },
  };
};
