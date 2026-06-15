# AI IQ Test Platform - Architecture Documentation

## 🏗️ System Architecture

### Tech Stack
- **Frontend Framework**: Next.js 16.2.9 with React 19
- **3D Graphics**: Three.js with @react-three/fiber & @react-three/drei
- **State Management**: Zustand
- **Animations**: Framer Motion & GSAP
- **Database**: Firebase Firestore
- **AI Models**: OpenRouter API
  - Claude Sonnet 3.5 for IQ questions
  - Gemini Flash 1.5 for voice/TTS
- **Styling**: Tailwind CSS 4
- **Camera**: react-webcam
- **TypeScript**: Full type safety

---

## 📂 Project Structure

```
dextest/
├── app/
│   ├── page.tsx                    # Student Registration
│   ├── login/page.tsx              # Student Login
│   ├── test/
│   │   ├── page.tsx                # Test Type Selection
│   │   ├── text-test/page.tsx     # Text-based IQ Test
│   │   ├── voice-test/page.tsx    # Voice-based IQ Test
│   │   ├── games/
│   │   │   ├── page.tsx           # Game Selection
│   │   │   ├── temple-run/page.tsx
│   │   │   └── reflex/page.tsx
│   │   └── results/page.tsx       # Test Results & AI Analysis
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── camera/
│   │   └── CameraMonitor.tsx      # Webcam monitoring & attention tracking
│   ├── games/
│   │   ├── TempleRunGame.tsx      # 3D Temple Run with Three.js
│   │   └── ReflexGame.tsx         # 3D Reflex game with Three.js
│   └── test/
│       ├── TextBasedTest.tsx      # Text-based question component
│       └── VoiceBasedTest.tsx     # Voice recognition test component
├── lib/
│   ├── firebase.ts                # Firebase configuration
│   ├── openrouter.ts              # OpenRouter API integration
│   └── store.ts                   # Zustand global state management
├── .env.local                     # Environment variables
└── firebase.rules                 # Firestore security rules
```

---

## 🔑 Key Features

### 1. **Student Registration & Authentication**
- Firebase Firestore for user data storage
- Unique signup code system (acts as username/password)
- No traditional auth - code-based login
- Stores: name, email, parents' names, age, class, phone

### 2. **Three Test Modes**

#### A. Text-Based Test
- 10 AI-generated IQ questions using Claude Sonnet 3.5
- Multiple choice format (A/B/C/D)
- Timed responses with countdown
- Instant feedback with explanations
- Reaction time tracking

#### B. Voice-Based Test
- Web Speech API for voice recognition
- Text-to-Speech for question delivery
- Voice command answers ("Option A", "B", etc.)
- Audio feedback for correctness
- Same question format as text test

#### C. Game-Based Test
**Temple Run (3D)**
- Dodge obstacles using arrow keys
- Measures reaction time per move
- Score tracking
- Three.js 3D graphics

**Reflex Challenge (3D)**
- Click 3D targets as they appear
- 30-second time limit
- Tracks click accuracy and speed
- Dynamic target spawning

### 3. **Camera Monitoring**
- Optional webcam access
- Simulated attention tracking (placeholder for ML models)
- Real-time attention score (80-100%)
- Visual feedback during test

### 4. **AI-Powered Analysis**
- Claude Sonnet 3.5 analyzes performance
- Generates:
  - Estimated IQ score
  - Strengths & weaknesses
  - Cognitive abilities assessment
  - Personalized recommendations
- Saves results to Firebase

---

## 🔐 Firebase Security Rules

Current rules in `firebase.rules`:
```javascript
match /users/{userId} {
  allow read: if true;           // Check if signup code exists
  allow create: if true;          // Register new students
  allow update, delete: if false; // Prevent modifications
}
```

---

## 🤖 OpenRouter API Integration

### Models Used:
1. **Claude Sonnet 3.5** (`anthropic/claude-3.5-sonnet`)
   - IQ question generation
   - Performance analysis
   - Cognitive assessment

2. **Gemini Flash 1.5** (`google/gemini-flash-1.5-8b`)
   - Text-to-speech processing (placeholder)

### API Key:
```
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
```

---

## 📊 Data Flow

### Registration Flow:
```
User → Registration Form → Validation → Firestore (create) → Success
```

### Login Flow:
```
User → Login Form → Firestore (read) → Zustand Store → Test Selection
```

### Test Flow:
```
Test Selection → AI Question Generation (Claude) → 
Test Execution (Text/Voice/Game) → Results Collection → 
AI Analysis (Claude) → Firestore (update) → Results Display
```

---

## 🎮 Game Mechanics

### Temple Run:
- **Controls**: Arrow Left/Right (move), Arrow Up (jump)
- **Scoring**: +10 points per obstacle passed
- **Metrics**: Average reaction time per input
- **3D Elements**: Player sphere, obstacles, track

### Reflex Challenge:
- **Controls**: Mouse click on 3D targets
- **Scoring**: +10 points per target hit
- **Duration**: 30 seconds
- **Metrics**: Click accuracy, reaction time per target

---

## 🧠 State Management (Zustand)

### Global State:
```typescript
{
  studentCode: string;
  studentClass: number;
  studentName: string;
  testType: 'text' | 'voice' | 'game' | null;
  questions: Question[];
  results: TestResult[];
  gameScores: {
    templeRun: { score, reactionTime };
    reflexGame: { score, reactionTime };
  };
  cameraEnabled: boolean;
  attentionScore: number;
}
```

---

## 🚀 Deployment Checklist

### Before Production:
1. ✅ Update Firebase security rules (add authentication if needed)
2. ✅ Secure OpenRouter API key (move to backend/serverless function)
3. ✅ Enable Firebase Authentication (optional)
4. ✅ Add rate limiting for API calls
5. ✅ Implement proper error boundaries
6. ✅ Add analytics (Google Analytics, Mixpanel)
7. ✅ Optimize Three.js performance
8. ✅ Add camera permission handling
9. ✅ Test across browsers (Chrome, Firefox, Safari, Edge)
10. ✅ Mobile responsiveness testing

---

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Deploy Firebase rules
firebase deploy --only firestore:rules
```

---

## 🎯 Future Enhancements

1. **Authentication**
   - Add Firebase Auth with email/password
   - Social login (Google, Facebook)
   - Session management

2. **Advanced ML**
   - Real face detection using TensorFlow.js
   - Eye tracking for attention analysis
   - Emotion detection during test

3. **More Games**
   - Memory card game
   - Pattern recognition game
   - Spatial reasoning puzzles

4. **Analytics Dashboard**
   - Admin panel for teachers
   - Student progress tracking
   - Class-wide performance metrics
   - Export reports (PDF, CSV)

5. **Accessibility**
   - Screen reader support
   - Keyboard navigation
   - High contrast mode
   - Font size adjustments

6. **Localization**
   - Multi-language support
   - Regional IQ score standards
   - Translated questions

---

## 📞 Support & Contact

For issues or questions, contact the development team.

**Created by**: SDE III Team
**Date**: June 2026
**Version**: 1.0.0
