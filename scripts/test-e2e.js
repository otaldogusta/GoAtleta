const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Starting E2E Tests...');

try {
  if (!process.argv.includes('--skip-reset')) {
    console.log('📦 Resetting local database...');
    execSync('npx supabase db reset', { stdio: 'inherit' });
  }

  console.log('🧪 Running E2E Test Suite...');
  
  const env = {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:54321'
  };

  execSync('npx jest supabase/tests/e2e/workflow.test.ts --runInBand --testMatch="**/*.test.ts"', { 
    stdio: 'inherit',
    env
  });

  console.log('✅ E2E Tests completed successfully!');

} catch (error) {
  console.error('❌ E2E Tests failed.');
  process.exit(1);
}
