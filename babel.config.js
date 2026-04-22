module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Must be last — powers expo-router screen transitions.
      "react-native-reanimated/plugin",
    ],
  };
};
