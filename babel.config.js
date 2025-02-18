module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      '@babel/preset-flow'
    ],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': '.',
        },
      }],
      '@babel/plugin-transform-flow-strip-types'
    ],
    env: {
      test: {
        plugins: [
          '@babel/plugin-transform-flow-strip-types'
        ]
      }
    }
  };
};
