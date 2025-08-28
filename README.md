# Julius AI - Intelligent Interview Platform

Julius AI is a comprehensive, AI-powered technical interview platform that conducts full-stack interviews with real-time voice interaction, coding challenges, and detailed performance analytics.

## 🚀 Features

### Core Capabilities
- **Multi-Stage Interview Flow**: Greeting → Resume Review → Coding Challenges → Computer Science → Behavioral Questions → Wrap-up
- **Real-time Voice Interaction**: Speech-to-text and text-to-speech powered by AWS Transcribe and Polly
- **Code Submission & Evaluation**: Live code editor with syntax highlighting and AI-powered code analysis
- **Intelligent Scoring**: Comprehensive evaluation across technical skills, communication, and behavioral aspects
- **Performance Analytics**: Detailed reports with strengths, improvement areas, and actionable recommendations

### Technical Architecture
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Node.js with WebSocket real-time communication
- **AI Integration**: Groq API for natural language processing
- **Voice Services**: AWS Transcribe (STT) and AWS Polly (TTS)
- **Session Management**: Redis for persistent conversation storage
- **Code Analysis**: Advanced AI-powered code evaluation

## 🛠 Installation

### Prerequisites
- Node.js 18+ 
- Redis instance (or Redis Cloud)
- AWS Account with Transcribe/Polly access
- Groq API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd julis-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file with the following variables:
   ```bash
   # AWS Credentials
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=us-east-1

   # Groq API
   GROQ_API_KEY=your_groq_api_key

   # Redis Configuration
   HOST=your_redis_host
   PASSWORD=your_redis_password
   USERNAME=default
   PORT=your_redis_port

   # Google Services (Optional)
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_APPLICATION_CREDENTIALS=path_to_service_account.json
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Start the WebSocket server**
   ```bash
   npm run ws-server
   ```

## 📱 Usage

### Starting an Interview

1. **Landing Page**: Navigate to `http://localhost:3000`
2. **Upload Resume**: Click "Start Interview" and upload your resume (PDF/DOCX)
3. **Voice Setup**: Allow microphone access for real-time interaction
4. **Begin Interview**: Follow Julius AI through each interview stage

### Demo Mode

Visit `/demo` to explore the platform features:
- **Overview**: Interview flow and key features
- **Conversation**: Sample interview dialogue
- **Code Editor**: Coding challenge interface
- **Analytics**: Performance metrics and feedback

### Interview Stages

1. **Greeting** (2-3 minutes): Initial conversation and rapport building
2. **Resume Review** (5-7 minutes): Discussion of background and experiences
3. **Coding Challenge** (15-20 minutes): Technical problem-solving with code submission
4. **Computer Science** (10-15 minutes): Fundamental CS concepts and system design
5. **Behavioral** (10-15 minutes): Situational and cultural fit questions
6. **Wrap-up** (3-5 minutes): Closing questions and next steps

## 🏗 Architecture

### File Structure
```
julis-ai/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── interview/         # Main interview interface
│   ├── demo/             # Demo showcase
│   └── reports/          # Analytics dashboard
├── lib/
│   ├── services/         # AI agents and orchestrator
│   ├── models/           # Zod schemas and types
│   ├── prompts/          # AI prompt templates
│   └── utils/            # Utility functions
├── ws-server/            # WebSocket server
└── types/                # TypeScript definitions
```

### Key Components

#### Orchestrator (`lib/services/orchestrator.ts`)
Central controller managing interview flow and stage transitions.

#### AI Agents
- **GreetingAgent**: Initial conversation and rapport building
- **ProjectAgent**: Resume review and experience discussion
- **CodingAgent**: Technical problem-solving challenges
- **CSAgent**: Computer science fundamentals
- **BehavioralAgent**: Situational and cultural questions
- **WrapUpAgent**: Interview conclusion
- **ScoringAgent**: Performance evaluation
- **RecommendationAgent**: Feedback generation

#### WebSocket Server (`ws-server/server.ts`)
Real-time communication handler for voice transcription and responses.

## 🔧 API Reference

### REST Endpoints

#### Upload Resume
```http
POST /api/upload-resume
Content-Type: multipart/form-data

Body: { file: File }
Response: { filename: string, path: string }
```

#### Interview Stage Management
```http
GET /api/interview-stage?sessionId={id}
Response: { stage: string, subState: string }

POST /api/interview-stage
Body: { sessionId: string, stage: string, subState?: string }
```

#### Generate Report
```http
POST /api/generate-report
Body: { sessionId: string }
Response: { report: object, recommendations: object }
```

### WebSocket Events

#### Client → Server
```typescript
// Audio chunk for transcription
{
  type: 'audio_chunk',
  audio: string, // base64
  sessionId: string
}

// Text message
{
  type: 'text_message', 
  message: string,
  sessionId: string
}

// Code submission
{
  type: 'code_input',
  code: string,
  language: string,
  explanation: string,
  sessionId: string
}
```

#### Server → Client
```typescript
// Transcription result
{
  type: 'transcription',
  text: string,
  isFinal: boolean
}

// AI response
{
  type: 'ai_response',
  message: string,
  audioUrl?: string,
  stage: string
}

// Stage change
{
  type: 'stage_change',
  newStage: string,
  message?: string
}
```

## 🧪 Testing

### Run Unit Tests
```bash
npm test
```

### Manual Testing
1. Start both servers (`npm run dev` and `npm run ws-server`)
2. Upload a sample resume
3. Test voice interaction in each stage
4. Submit code during coding round
5. Verify report generation

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Ensure all production environment variables are set:
- AWS credentials with proper permissions
- Redis instance accessible from production
- Groq API key with sufficient quota

### WebSocket Server
Deploy the WebSocket server separately or use a process manager:
```bash
pm2 start ws-server/server.ts --name julius-ws
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Open an issue on GitHub
- Check the demo at `/demo` for feature examples
- Review the API documentation above

## 🏆 Acknowledgments

- OpenAI for inspiration in conversational AI
- AWS for speech services
- Groq for fast inference
- Next.js team for the excellent framework
