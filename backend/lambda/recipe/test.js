const { handler } = require('./index');

// Test event for keto recipe
const testEvent = {
  profile: {
    target: 'keto',
    healthConditions: ['diabetes'],
    allergies: ['nuts'],
    cookingLevel: 'beginner',
    budget: 30000,
    preferences: {
      cuisine: 'korean',
      spicyLevel: 'mild'
    }
  },
  constraints: {
    maxCalories: 600,
    maxCookingTime: 30
  }
};

async function runTest() {
  console.log('Testing Recipe Lambda...');
  console.log('Input:', JSON.stringify(testEvent, null, 2));
  
  try {
    const result = await handler(testEvent);
    console.log('\nOutput:', JSON.stringify(result, null, 2));
    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

if (require.main === module) {
  runTest();
}

module.exports = { runTest };
