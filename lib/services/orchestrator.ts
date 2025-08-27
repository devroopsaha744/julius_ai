import { GreetingAgent } from './greet';
import { ProjectAgent } from './project';
import { CodingAgent } from './coding';
import { CSAgent } from './cs';
import { BehaviouralAgent } from './behave';
import { WrapUpAgent } from './wrapup';
import { ScoringAgent } from './score';
import { InterviewStep, InterviewScoring } from '../models/models';

export enum InterviewStage {
  GREET = 'greet',
  RESUME = 'resume', 
  CODING = 'coding',
  CS = 'cs',
  BEHAVIORAL = 'behavioral',
  WRAPUP = 'wrapup',
  COMPLETED = 'completed'
}

export class InterviewOrchestrator {
  private sessionId: string;
  private currentStage: InterviewStage;
  
  // Service instances
  private greetingAgent: GreetingAgent;
  private projectAgent: ProjectAgent;
  private codingAgent: CodingAgent;
  private csAgent: CSAgent;
  private behavioralAgent: BehaviouralAgent;
  private wrapUpAgent: WrapUpAgent;
  private scoringAgent: ScoringAgent;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.currentStage = InterviewStage.GREET;
    
    // Initialize all service agents
    this.greetingAgent = new GreetingAgent(sessionId);
    this.projectAgent = new ProjectAgent(sessionId);
    this.codingAgent = new CodingAgent(sessionId);
    this.csAgent = new CSAgent(sessionId);
    this.behavioralAgent = new BehaviouralAgent(sessionId);
    this.wrapUpAgent = new WrapUpAgent(sessionId);
    this.scoringAgent = new ScoringAgent(sessionId);
  }

  async processMessage(userMessage: string, resumeFilePath?: string, userCode?: string): Promise<{
    response: InterviewStep;
    currentStage: InterviewStage;
    stageChanged: boolean;
    scoringResult?: InterviewScoring;
  }> {
    const previousStage = this.currentStage;
    let response: InterviewStep;
    let scoringResult: InterviewScoring | undefined;

    switch (this.currentStage) {
      case InterviewStage.GREET:
        response = await this.greetingAgent.run(userMessage);
        if (this.shouldMoveToNextStage(response)) {
          this.currentStage = InterviewStage.RESUME;
        }
        break;

      case InterviewStage.RESUME:
        if (!resumeFilePath) {
          throw new Error('Resume file path is required for resume stage');
        }
        response = await this.projectAgent.run(userMessage, resumeFilePath);
        if (this.shouldMoveToNextStage(response)) {
          this.currentStage = InterviewStage.CODING;
        }
        break;

      case InterviewStage.CODING:
        response = await this.codingAgent.run(userMessage, userCode);
        if (this.shouldMoveToNextStage(response)) {
          this.currentStage = InterviewStage.CS;
        }
        break;

      case InterviewStage.CS:
        response = await this.csAgent.run(userMessage);
        if (this.shouldMoveToNextStage(response)) {
          this.currentStage = InterviewStage.BEHAVIORAL;
        }
        break;

      case InterviewStage.BEHAVIORAL:
        response = await this.behavioralAgent.run(userMessage);
        if (this.shouldMoveToNextStage(response)) {
          this.currentStage = InterviewStage.WRAPUP;
        }
        break;

      case InterviewStage.WRAPUP:
        response = await this.wrapUpAgent.run(userMessage);
        if (this.shouldMoveToNextStage(response)) {
          // Activate scoring at the end of wrap up
          scoringResult = await this.activateScoring() || undefined;
          this.currentStage = InterviewStage.COMPLETED;
        }
        break;

      case InterviewStage.COMPLETED:
        response = {
          assistant_message: "The interview has been completed. Thank you for your time!",
          current_substate: "completed"
        };
        break;

      default:
        throw new Error(`Unknown interview stage: ${this.currentStage}`);
    }

    return {
      response,
      currentStage: this.currentStage,
      stageChanged: previousStage !== this.currentStage,
      ...(scoringResult && { scoringResult })
    };
  }

  private shouldMoveToNextStage(response: InterviewStep): boolean {
    // Check if the substate indicates readiness to move to next stage
    return response.current_substate === "ready_to_move";
  }

  private async activateScoring(): Promise<InterviewScoring | null> {
    try {
      const scoringResult = await this.scoringAgent.generateScore();
      console.log(`Interview completed for candidate: ${scoringResult.candidate_id}`);
      console.log(`Final Score: ${scoringResult.overall.final_score}/100`);
      console.log(`Recommendation: ${scoringResult.overall.recommendation}`);
      console.log(`Strengths: ${scoringResult.overall.strengths.join(', ')}`);
      console.log(`Areas for Improvement: ${scoringResult.overall.weaknesses.join(', ')}`);
      return scoringResult;
    } catch (error) {
      console.error('Error generating score:', error);
      return null;
    }
  }

  // Utility methods
  getCurrentStage(): InterviewStage {
    return this.currentStage;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // Method to reset the interview to start over
  resetInterview(): void {
    this.currentStage = InterviewStage.GREET;
  }

  // Method to manually set stage (useful for testing or special cases)
  setStage(stage: InterviewStage): void {
    this.currentStage = stage;
  }

  // Check if interview is completed
  isCompleted(): boolean {
    return this.currentStage === InterviewStage.COMPLETED;
  }

  // Get the next expected stage
  getNextStage(): InterviewStage | null {
    const stageOrder = [
      InterviewStage.GREET,
      InterviewStage.RESUME,
      InterviewStage.CODING,
      InterviewStage.CS,
      InterviewStage.BEHAVIORAL,
      InterviewStage.WRAPUP,
      InterviewStage.COMPLETED
    ];

    const currentIndex = stageOrder.indexOf(this.currentStage);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      return stageOrder[currentIndex + 1];
    }
    return null;
  }

  // Get scoring result manually (can be called after interview completion)
  async generateScoringReport(): Promise<InterviewScoring> {
    return await this.scoringAgent.generateScore();
  }
}
