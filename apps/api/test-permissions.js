const fetch = require('node-fetch');

async function testLogin() {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'devinecare4ever@gmail.com',
      password: 'your_password_here' // Replace with actual password
    })
  });
  
  const data = await response.json();
  console.log('Permissions returned:', data.data?.user?.permissions);
  console.log('Has payments.nigerian.record?', data.data?.user?.permissions?.includes('payments.nigerian.record'));
}

testLogin();
