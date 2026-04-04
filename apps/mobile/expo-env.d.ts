/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Google Maps Platform key for Routes API + Geocoding REST. */
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
    /** Optional separate key for Roads API; falls back to maps key. */
    EXPO_PUBLIC_GOOGLE_ROADS_API_KEY?: string;
  }
}
