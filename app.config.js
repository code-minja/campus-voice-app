const baseConfig = require("./app.json");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

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
        ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
      },
    },
    android: {
      ...merged.android,
      config: {
        ...(merged.android?.config ?? {}),
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                ...(merged.android?.config?.googleMaps ?? {}),
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
