/**
 * Extends static `app.json` with Android Google Maps API key for `react-native-maps`
 * (same env var as Routes/Geocoding; enable "Maps SDK for Android" on the key).
 */
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
