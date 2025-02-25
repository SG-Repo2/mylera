module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['@babel/preset-env', {modules: false}], 'babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      '@babel/plugin-transform-modules-commonjs'
    ],
  };
};
