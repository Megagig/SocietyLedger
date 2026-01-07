// Run this in the browser console when logged in
// This will show you exactly what permissions the user has

const authStorage = localStorage.getItem('auth-storage');
if (!authStorage) {
  console.error('❌ No auth-storage found! User not logged in?');
} else {
  const parsed = JSON.parse(authStorage);
  const user = parsed?.state?.user;
  
  if (!user) {
    console.error('❌ No user found in auth-storage!');
  } else {
    console.log('=================================');
    console.log('USER DETAILS:');
    console.log('=================================');
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Platform Role:', user.platformRole);
    console.log('Association ID:', user.associationId);
    console.log('');
    console.log('=================================');
    console.log('PERMISSIONS (' + (user.permissions?.length || 0) + ' total):');
    console.log('=================================');
    
    if (!user.permissions || user.permissions.length === 0) {
      console.error('❌ NO PERMISSIONS FOUND!');
      console.log('This is the problem! User has no permissions array.');
    } else {
      // Sort and log all permissions
      user.permissions.sort().forEach((p, i) => {
        console.log((i + 1) + '.', p);
      });
      
      console.log('');
      console.log('=================================');
      console.log('CHECKING NEW PERMISSIONS:');
      console.log('=================================');
      
      const newPerms = [
        'payments.nigerian.view',
        'payments.nigerian.record',
        'payments.nigerian.verify',
        'payments.nigerian.reconcile',
        'payments.nigerian.import',
        'communication.sms.view',
        'communication.sms.send',
        'communication.sms.campaign',
        'communication.sms.template',
        'notifications.view',
        'notifications.send',
        'exports.financial',
        'exports.members',
        'exports.view_history',
        'system.cron.view',
        'system.cron.trigger',
      ];
      
      newPerms.forEach(perm => {
        const has = user.permissions.includes(perm);
        console.log(has ? '✅' : '❌', perm);
      });
    }
  }
}
