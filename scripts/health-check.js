#!/usr/bin/env node

/**
 * Server Health Check Script
 * Checks if both Next.js and WebSocket servers are running
 */

const http = require('http');

async function checkHTTPServer(port = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve({
        success: true,
        message: `Next.js server is running on port ${port}`,
        status: res.statusCode
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        message: `Next.js server is not running on port ${port}: ${error.message}`
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        message: `Timeout connecting to Next.js server on port ${port}`
      });
    });
  });
}

async function checkWebSocketServer(port = 8080) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({
        success: true,
        message: `WebSocket server is listening on port ${port}`
      });
    });

    socket.on('error', (error) => {
      resolve({
        success: false,
        message: `WebSocket server is not running on port ${port}: ${error.message}`
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        success: false,
        message: `WebSocket server connection timeout on port ${port}`
      });
    });

    socket.connect(port, 'localhost');
  });
}

async function main() {
  console.log('🔍 Julius AI Server Health Check\n');

  // Check Next.js server
  console.log('Checking Next.js server...');
  const httpResult = await checkHTTPServer();
  console.log(httpResult.success ? '✅' : '❌', httpResult.message);

  // Check WebSocket server
  console.log('\nChecking WebSocket server...');
  const wsResult = await checkWebSocketServer();
  console.log(wsResult.success ? '✅' : '❌', wsResult.message);

  // Summary
  console.log('\n📊 Summary:');
  const allRunning = httpResult.success && wsResult.success;
  
  if (allRunning) {
    console.log('✅ All servers are running correctly!');
    console.log('🌐 Application available at: http://localhost:3000');
  } else {
    console.log('❌ Some servers are not running:');
    
    if (!httpResult.success) {
      console.log('   • Start Next.js server: npm run dev');
    }
    
    if (!wsResult.success) {
      console.log('   • Start WebSocket server: npm run ws-server');
    }
    
    console.log('\n💡 You can start both servers together with: npm run dev:all');
  }

  process.exit(allRunning ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkHTTPServer, checkWebSocketServer };
