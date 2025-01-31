module.exports = {
  bracketSpacing: true,
  bracketSameLine: false,
  singleQuote: true,
  trailingComma: 'es5',
  arrowParens: 'avoid',
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  endOfLine: 'auto',
  importOrder: [
    '^react(-native)?$',
    '^@?expo',
    '<THIRD_PARTY_MODULES>',
    '^[./]'
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
