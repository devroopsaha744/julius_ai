/**
 * Simple WebSocket Connection Test
 * Run this to test if the WebSocket server is working properly
 */

const WebSocket = require('ws');

async function testConnection() {
    console.log('🧪 Testing WebSocket Connection...\n');

    try {
        const ws = new WebSocket('ws://localhost:8080');
        
        let connected = false;
        let sessionReceived = false;

        ws.on('open', () => {
            console.log('✅ WebSocket connection opened');
            connected = true;
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('📨 Received message:', message);
                
                if (message.type === 'connected' && message.sessionId) {
                    console.log('✅ Session ID received:', message.sessionId);
                    sessionReceived = true;
                    
                    // Close connection after successful test
                    setTimeout(() => {
                        ws.close();
                        console.log('\n🎉 Test completed successfully!');
                        console.log('- WebSocket server is running');
                        console.log('- Connection established');
                        console.log('- Session ID received');
                        process.exit(0);
                    }, 1000);
                }
            } catch (error) {
                console.error('❌ Failed to parse message:', error);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            console.log('\n💡 Troubleshooting:');
            console.log('1. Ensure WebSocket server is running: npm run ws-server');
            console.log('2. Check if port 8080 is available');
            console.log('3. Verify .env.local file exists with required variables');
            process.exit(1);
        });

        ws.on('close', (code, reason) => {
            if (!sessionReceived) {
                console.log(`❌ Connection closed before session received (Code: ${code})`);
                process.exit(1);
            }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!connected || !sessionReceived) {
                console.error('❌ Connection test timed out');
                console.log('\n💡 The WebSocket server may not be running.');
                console.log('Run: npm run ws-server');
                ws.close();
                process.exit(1);
            }
        }, 10000);

    } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error.message);
        process.exit(1);
    }
}

testConnection();
