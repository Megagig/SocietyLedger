// Debug Script - Check Permissions in Browser Console
// Paste this in browser console (F12) while logged in

console.log('=== PERMISSION DEBUG ===');
console.log('');

// Check localStorage
const authStore = localStorage.getItem('auth-storage');
if (authStore) {
  const parsed = JSON.parse(authStore);
  console.log('User:', parsed.state.user?.email);
  console.log('Role:', parsed.state.user?.role);
  console.log('');
  console.log('Total Permissions:', parsed.state.user?.permissions?.length || 0);
  console.log('');
  
  const newPermissions = (parsed.state.user?.permissions || []).filter(p => 
    p.includes('nigerian') || 
    p.includes('communication.sms') || 
    p.includes('exports.') || 
    p.includes('cron') ||
    p.includes('notifications.')
  );
  
  console.log('NEW Permissions (should have 16):');
  console.log(newPermissions);
  console.log('');
  
  console.log('Has payments.nigerian.record?', parsed.state.user?.permissions?.includes('payments.nigerian.record'));
  console.log('Has communication.sms.send?', parsed.state.user?.permissions?.includes('communication.sms.send'));
  console.log('Has exports.financial?', parsed.state.user?.permissions?.includes('exports.financial'));
  console.log('Has system.cron.view?', parsed.state.user?.permissions?.includes('system.cron.view'));
} else {
  console.log('No auth-storage found in localStorage!');
}

console.log('');
console.log('=== END DEBUG ===');
console.log('');
console.log('IF NEW PERMISSIONS ARE MISSING:');
console.log('1. Clear localStorage: localStorage.clear()');
console.log('2. Refresh page');
console.log('3. Log in again');
