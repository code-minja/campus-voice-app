const baseConfig = require("./app.json");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const googleMapsIosApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY?.trim() || googleMapsApiKey;
const googleMapsAndroidApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || googleMapsApiKey;

module.exports = ({ config }) => {
  const merged = {
    ...baseConfig.expo,
    ...config,
  };

  return {
    ...merged,
    ios: {
      ...merged.ios,
      config: {
        ...(merged.ios?.config ?? {}),
        ...(googleMapsIosApiKey
          ? { googleMapsApiKey: googleMapsIosApiKey }
          : {}),
      },
    },
    android: {
      ...merged.android,
      config: {
        ...(merged.android?.config ?? {}),
        ...(googleMapsAndroidApiKey
          ? {
              googleMaps: {
                ...(merged.android?.config?.googleMaps ?? {}),
                apiKey: googleMapsAndroidApiKey,
              },
            }
          : {}),
      },
    },
  };
};
