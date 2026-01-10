/**
 * Script: Clear Permission Cache
 * 
 * Clears the in-memory permission cache in RBACService.
 * Use this after updating role permissions to force immediate refresh.
 * 
 * Note: This only works if the API server is running and you can call an endpoint.
 * For development, users can simply log out and log back in.
 */

console.log('⚠️  Permission Cache Clearing');
console.log('');
console.log('The permission cache is stored in-memory in the API server.');
console.log('To clear it, you have two options:');
console.log('');
console.log('1. RESTART THE API SERVER (recommended)');
console.log('   - Stop the API server (Ctrl+C)');
console.log('   - Start it again (npm run dev)');
console.log('   - This clears all in-memory caches');
console.log('');
console.log('2. LOG OUT AND LOG BACK IN (user-specific)');
console.log('   - Users log out from the web app');
console.log('   - Log back in');
console.log('   - This creates a new cache entry with fresh permissions');
console.log('');
console.log('The cache automatically expires after 5 minutes, so waiting');
console.log('5 minutes will also resolve the issue.');
console.log('');
console.log('✨ For immediate effect: Restart the API server or have users re-login');
