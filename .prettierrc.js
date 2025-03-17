// .prettierrc.js
module.exports = {
  printWidth: 80, // Keeps lines at a manageable length for readability.
  tabWidth: 2, // Uses 2 spaces per indentation level, which is standard in the React Native community.
  useTabs: false, // Enforces the use of spaces instead of tabs.
  semi: true, // Always adds semicolons, which can help avoid ASI pitfalls.
  singleQuote: true, // Uses single quotes for strings for consistency with common JavaScript/TypeScript style.
  trailingComma: 'all', // Adds trailing commas wherever possible, which makes version control diffs cleaner.
  bracketSpacing: true, // Ensures spacing between brackets in object literals for clarity.
  arrowParens: 'always', // Always includes parentheses around arrow function parameters, enhancing readability.
  endOfLine: 'auto', // Maintains the existing line endings to avoid issues across different operating systems.
  jsxSingleQuote: false, // Uses double quotes in JSX attributes to follow common community conventions.
};