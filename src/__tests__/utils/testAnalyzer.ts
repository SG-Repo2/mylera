import { act } from '@testing-library/react-native';

export const analyzeTestOutput = (testResults: any) => {
  console.log('\n🔍 Test Analysis:');
  
  // Count total tests
  const totalTests = testResults.numTotalTests;
  const passedTests = testResults.numPassedTests;
  const failedTests = testResults.numFailedTests;
  
  console.log(`
📊 Test Summary:
- Total Tests: ${totalTests}
- Passed: ${passedTests} ✅
- Failed: ${failedTests} ❌
  `);

  // Analyze failed tests
  if (failedTests > 0) {
    console.log('❌ Failed Tests:');
    testResults.testResults.forEach((suite: any) => {
      suite.testResults
        .filter((test: any) => test.status === 'failed')
        .forEach((test: any) => {
          console.log(`
- ${test.title}
  Error: ${test.failureMessages[0]}
          `);
        });
    });
  }

  // Performance analysis
  const slowTests = testResults.testResults
    .flatMap((suite: any) => suite.testResults)
    .filter((test: any) => test.duration > 100);

  if (slowTests.length > 0) {
    console.log('⚠️ Slow Tests (>100ms):');
    slowTests.forEach((test: any) => {
      console.log(`- ${test.title}: ${test.duration}ms`);
    });
  }
}; 