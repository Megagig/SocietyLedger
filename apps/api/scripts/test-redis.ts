/**
 * Redis Connection Test Script
 * Run with: npx tsx scripts/test-redis.ts
 */

import 'dotenv/config';
import { createClient } from 'redis';

async function testRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  
  console.log('🔍 Testing Redis Connection...\n');
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL not found in environment variables');
    process.exit(1);
  }

  // Mask the password for logging
  const maskedUrl = redisUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`📡 Connecting to: ${maskedUrl}\n`);

  try {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
      },
    });

    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    await client.connect();
    console.log('✅ Connected to Redis successfully!\n');

    // Test basic operations
    console.log('🧪 Running basic tests...\n');

    // Test SET
    await client.set('test:connection', 'SocietyLedger Redis Test');
    console.log('✅ SET operation successful');

    // Test GET
    const value = await client.get('test:connection');
    console.log(`✅ GET operation successful: "${value}"`);

    // Test SETEX (with expiry)
    await client.setEx('test:expiry', 60, 'This expires in 60 seconds');
    console.log('✅ SETEX operation successful');

    // Test DEL
    await client.del('test:connection');
    console.log('✅ DEL operation successful');

    // Test PING
    const pong = await client.ping();
    console.log(`✅ PING response: ${pong}`);

    // Get server info
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:(\S+)/);
    if (versionMatch) {
      console.log(`\n📊 Redis Version: ${versionMatch[1]}`);
    }

    // Cleanup
    await client.del('test:expiry');
    await client.quit();

    console.log('\n🎉 All Redis tests passed! Your Upstash connection is working correctly.\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Redis connection failed:', error.message);
    
    if (error.message.includes('WRONGPASS') || error.message.includes('AUTH')) {
      console.error('\n💡 Tip: Check your Redis password/token in the REDIS_URL');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: Check your Redis hostname in the REDIS_URL');
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      console.error('\n💡 Tip: Check your network connection or firewall settings');
    }
    
    process.exit(1);
  }
}

testRedisConnection();
