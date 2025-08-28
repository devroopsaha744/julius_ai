/**
 * WebSocket Health Check Utility
 * Provides functions to test WebSocket server connectivity
 */

export async function testWebSocketConnection(url: string): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          ws.close();
          resolve({
            success: false,
            message: 'Connection timeout - WebSocket server may not be running'
          });
        }
      }, 5000);
      
      ws.onopen = () => {
        const latency = Date.now() - startTime;
        clearTimeout(timeout);
        ws?.close();
        resolve({
          success: true,
          message: 'WebSocket server is running and accessible',
          latency
        });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: 'Failed to connect to WebSocket server. Please ensure the server is running on port 8080'
        });
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code !== 1000) { // 1000 = normal closure
          resolve({
            success: false,
            message: `WebSocket connection closed unexpectedly (Code: ${event.code})`
          });
        }
      };
      
    } catch (error) {
      resolve({
        success: false,
        message: 'Failed to create WebSocket connection. Check if the server is running.'
      });
    }
  });
}

export function getWebSocketServerInstructions(): string {
  return `
To start the WebSocket server:
1. Open a terminal in the project directory
2. Run: npm run ws-server
3. Ensure port 8080 is available
4. Check that .env.local file contains all required environment variables
  `;
}

export function diagnoseConnectionIssue(error: any): string {
  if (typeof error === 'object' && error !== null) {
    if (error.maxAttemptsReached) {
      return 'Multiple connection attempts failed. The WebSocket server may not be running.';
    }
    if (error.message) {
      return error.message;
    }
  }
  
  return 'Unknown connection error occurred. Please check the WebSocket server status.';
}
