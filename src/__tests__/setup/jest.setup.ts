import { analyzeTestOutput } from '../utils/testAnalyzer';

// Add global test handlers
beforeAll(() => {
  console.log('\n🚀 Starting test suite...');
});

afterAll((testResults) => {
  analyzeTestOutput(testResults);
}); 