declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
    EXPO_PUBLIC_GOOGLE_ROADS_API_KEY?: string;
    EXPO_PUBLIC_VISION_API_URL?: string;
    /** Optional; milliseconds for POST /analyze-frame (default 18000, clamped 8000–120000). */
    EXPO_PUBLIC_VISION_ANALYZE_TIMEOUT_MS?: string;
    EXPO_PUBLIC_FALLBACK_ORIGIN_LAT?: string;
    EXPO_PUBLIC_FALLBACK_ORIGIN_LNG?: string;
  }
}
