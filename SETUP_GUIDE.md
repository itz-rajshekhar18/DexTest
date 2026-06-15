# 🚀 AI IQ Test Platform - Setup & Usage Guide

## 📋 Prerequisites

- Node.js 20+ installed
- Firebase account with Firestore enabled
- OpenRouter API account (already configured)

---

## 🔧 Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
The `.env.local` file is already created with:
```env
NEXT_PUBLIC_OPENROUTER_API_KEY=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
NEXT_PUBLIC_TTS_MODEL=google/gemini-flash-1.5-8b
NEXT_PUBLIC_IQ_MODEL=anthropic/claude-3.5-sonnet
```

### 3. Firebase Configuration
Your Firebase config is already set up in `lib/firebase.ts`:
- Project ID: `dextest-b6346`
- Firestore is initialized and ready

### 4. Deploy Firebase Rules
```bash
firebase login
firebase init firestore  # Select your project
firebase deploy --only firestore:rules
```

### 5. Run Development Server
```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## 🎯 User Journey

### Step 1: Student Registration (/)
1. Student fills out registration form:
   - Full Name
   - Email
   - Father's Name
   - Mother's Name
   - Age
   - Class (6-12)
   - Phone Number
   - **Unique Signup Code** (this is their login credential)

2. Click "Submit Registration"
3. Success screen shows:
   - Confirmation message
   - Display of signup code
   - Student details summary
4. Copy the signup code and save it securely

### Step 2: Login (/login)
1. Enter the unique signup code
2. Click "Login to Test Platform"
3. System validates code from Firestore
4. Redirects to test selection

### Step 3: Test Selection (/test)
Choose from three test types:

#### 🔤 Text-Based Test
- 10 AI-generated IQ questions
- Multiple choice (A, B, C, D)
- Timed responses (60s per question)
- Instant feedback with explanations
- Click answers or use keyboard

#### 🎤 Voice-Based Test
- Same questions as text test
- Questions read aloud by browser TTS
- Answer by voice: "Option A", "Option B", etc.
- Visual display of transcript
- Can repeat questions
- Audio feedback

#### 🎮 Game-Based Test
Two 3D games to measure reflexes:

**Temple Run**
- Use arrow keys: ← → (move), ↑ (jump)
- Dodge red obstacles
- Score +10 per obstacle passed
- Measures reaction time per input

**Reflex Challenge**
- Click glowing 3D spheres
- 30-second time limit
- Score +10 per hit
- Tracks click speed and accuracy

### Step 4: During Test
- **Camera monitoring** (optional): Enable webcam to track attention
- **Timer**: Countdown visible at top
- **Progress bar**: Shows completion percentage
- **Score tracker**: Real-time score updates

### Step 5: View Results (/test/results)
Comprehensive analysis including:

1. **IQ Score Estimation**
   - Calculated from accuracy + reaction time
   - Range: 70-150

2. **Performance Metrics**
   - Accuracy percentage
   - Average reaction time
   - Attention score

3. **Question Breakdown**
   - ✓/✗ for each question
   - Individual reaction times

4. **AI Analysis** (by Claude Sonnet 3.5)
   - Cognitive strengths/weaknesses
   - Personalized recommendations
   - Improvement suggestions

5. **Game Scores** (if played)
   - Temple Run score + avg reaction
   - Reflex Challenge score + avg reaction

6. **Actions**
   - Take another test
   - Return home

---

## 🎮 Game Controls

### Temple Run
```
← (Left Arrow)  : Move left lane
→ (Right Arrow) : Move right lane
↑ (Up Arrow)    : Jump over obstacle
```

### Reflex Challenge
```
🖱️ Click: Click on glowing 3D spheres
```

---

## 🎤 Voice Commands (Voice-Based Test)

Supported phrases:
- "Option A" / "A"
- "Option B" / "B"
- "Option C" / "C"
- "Option D" / "D"
- "Option 1" / "1" (maps to A)
- "Option 2" / "2" (maps to B)
- "Option 3" / "3" (maps to C)
- "Option 4" / "4" (maps to D)

**Tips:**
- Speak clearly near microphone
- Wait for microphone icon to turn red (listening)
- Browser will show transcript of what you said
- Can click options manually if voice fails

---

## 📊 How IQ Score is Calculated

```
Base IQ: 100

Adjustments:
+ Accuracy bonus: (Score% - 50) × 0.5
  Example: 80% accuracy → +15 points

- Reaction time penalty: (AvgTime - 5000ms) / 1000
  Example: 7000ms avg → -2 points

Final Range: 70-150
```

---

## 🔐 Security & Privacy

### Firebase Rules (Currently):
```javascript
// Allows registration & login checks
match /users/{userId} {
  allow read: if true;    // Anyone can check if code exists
  allow create: if true;  // Anyone can register
  allow update, delete: if false; // No modifications allowed
}
```

### API Key Security:
⚠️ **IMPORTANT**: The OpenRouter API key is currently in `.env.local` for development. For production:
1. Move API calls to API routes (`app/api/`)
2. Keep key in server-side environment variables
3. Never expose in client-side code

### Camera Access:
- Camera is **optional**
- User must grant permission
- No video is recorded or uploaded
- Only used for attention tracking simulation

---

## 🐛 Troubleshooting

### "Missing or insufficient permissions" Error
**Solution**: Deploy Firebase rules
```bash
firebase deploy --only firestore:rules
```

### Voice Recognition Not Working
**Causes**:
- Browser doesn't support Web Speech API (Safari has limited support)
- Microphone not permitted
- No microphone connected

**Solution**:
- Use Chrome or Edge (best support)
- Grant microphone permission when prompted
- Check browser settings → Site Settings → Microphone

### Games Not Loading / Black Screen
**Causes**:
- Three.js not loaded (SSR issue)
- GPU/WebGL not available

**Solution**:
- Hard refresh (Ctrl+Shift+R)
- Check browser console for errors
- Ensure WebGL is enabled in browser

### OpenRouter API Errors
**Common Issues**:
- Rate limiting
- Invalid model name
- API key issues

**Check**:
```bash
# Test API key
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🚀 Production Deployment

### Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_OPENROUTER_API_KEY=your_key
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables in Netlify dashboard
```

### Important for Production:
1. Move OpenRouter API calls to backend (`/api` routes)
2. Add rate limiting
3. Enable Firebase Authentication
4. Update Firebase security rules
5. Add CSP headers
6. Configure CORS properly

---

## 📈 Monitoring & Analytics

### Add Google Analytics (Optional)
```bash
npm install @next/third-parties
```

Update `app/layout.tsx`:
```typescript
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId="G-YOUR_ID" />
      </body>
    </html>
  )
}
```

---

## 🧪 Testing

### Test User Registration:
1. Go to `http://localhost:3000`
2. Fill form with test data
3. Use code: `TEST123`
4. Check Firestore console for new document

### Test Login:
1. Go to `http://localhost:3000/login`
2. Enter code: `TEST123`
3. Should redirect to `/test`

### Test Text-Based Test:
1. Login and select "Text-Based Test"
2. Wait for questions to generate (5-10 seconds)
3. Answer questions
4. Check results page

### Test Voice-Based Test:
1. Select "Voice-Based Test"
2. Grant microphone permission
3. Click "Answer by Voice"
4. Say "Option A" when microphone is listening

### Test Games:
1. Select "Game-Based Test"
2. Choose Temple Run or Reflex Challenge
3. Play game
4. Check score tracking

---

## 📞 Support

### Common Questions:

**Q: Can I change my signup code?**
A: No, signup codes are permanent. Create a new registration if needed.

**Q: How many times can I take the test?**
A: Unlimited. Results are saved each time.

**Q: What browsers are supported?**
A: Chrome, Edge, Firefox (latest versions). Safari has limited voice support.

**Q: Is camera required?**
A: No, camera monitoring is optional.

**Q: How long does the test take?**
A: Text/Voice: ~10-15 minutes, Games: 5-10 minutes each

---

## 📝 Admin Tasks

### View All Registrations (Firebase Console):
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Click on `users` collection
4. See all registered students

### Check Test Results:
Each user document contains:
```javascript
{
  name: "Student Name",
  email: "email@example.com",
  // ... registration data ...
  lastTestDate: Timestamp,
  lastTestResults: {
    score: 85,
    correctAnswers: 8,
    totalQuestions: 10,
    avgReactionTime: 5234,
    gameScores: { ... },
    analysis: "AI-generated analysis..."
  }
}
```

---

## 🎓 For Teachers

### How to Use This Platform:

1. **Student Registration**
   - Have students register before class
   - Students save their unique codes
   - No passwords needed

2. **Conducting Tests**
   - Students login with their codes
   - Choose test type based on lesson plan
   - Monitor time: 15-20 minutes per test

3. **Reviewing Results**
   - Access Firebase Console
   - Check `lastTestResults` in each student document
   - Export data using Firebase tools

4. **Interpreting IQ Scores**
   - 70-85: Below average
   - 85-100: Average
   - 100-115: Above average
   - 115-130: Superior
   - 130+: Very superior

---

## 🔒 Security Best Practices

1. **Never share** the OpenRouter API key publicly
2. **Regularly rotate** Firebase credentials
3. **Enable** Firebase App Check for production
4. **Use** environment variables for all secrets
5. **Implement** rate limiting on API calls
6. **Add** CAPTCHA for registration (optional)

---

## 📦 Package Dependencies Explained

| Package | Purpose |
|---------|---------|
| `three` | 3D graphics engine |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | Helpers for React Three Fiber |
| `framer-motion` | Smooth animations |
| `gsap` | Advanced animations |
| `zustand` | Lightweight state management |
| `axios` | HTTP client for API calls |
| `firebase` | Database & auth |
| `react-webcam` | Camera access |
| `openai` | (Used for OpenRouter API) |

---

## ✅ Final Checklist

Before going live:
- [ ] Firebase rules deployed
- [ ] Environment variables set
- [ ] API key secured (moved to backend)
- [ ] Test all three test types
- [ ] Test on mobile devices
- [ ] Verify camera permissions work
- [ ] Check voice recognition on different browsers
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Verify results are saved to Firebase
- [ ] Check AI analysis generation
- [ ] Test games performance

---

**Happy Testing! 🎉**

For questions or issues, refer to the `PROJECT_ARCHITECTURE.md` file.
