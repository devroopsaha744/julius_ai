import { UnifiedInterviewAgent } from '../../lib/services/unified_agent';

describe('UnifiedInterviewAgent', () => {
  let agent: UnifiedInterviewAgent;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    agent = new UnifiedInterviewAgent(sessionId);
  });

  test('should handle code only during coding stage', async () => {
    // Test that code is processed during coding stage
    const codingResponse = await agent.run('Please review this code', 'console.log("test");', 'coding');
    expect(codingResponse).toBeDefined();
    expect(codingResponse.substate).toBe('coding');

    // Test that code is ignored during non-coding stages
    const greetResponse = await agent.run('Hello', 'console.log("test");', 'greet');
    expect(greetResponse).toBeDefined();
    expect(greetResponse.substate).toBe('greet');
  });

  test('should track question count per substate', async () => {
    // First question in greet substate
    await agent.run('Hello', undefined, 'greet');

    // Second question in greet substate
    await agent.run('How are you?', undefined, 'greet');

    // Third question in greet substate
    await agent.run('What is this interview about?', undefined, 'greet');

    // Fourth question should advance to next substate
    const response = await agent.run('Tell me more', undefined, 'greet');
    expect(response.substate).not.toBe('greet'); // Should have advanced
  });
});