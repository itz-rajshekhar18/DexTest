# 🔧 Development Checklist

## 🚀 Before You Start

- [x] Node.js 20+ installed
- [x] Firebase project created (dextest-b6346)
- [x] OpenRouter API key obtained
- [x] All packages installed
- [ ] Firebase CLI installed: `npm install -g firebase-tools`
- [ ] Firebase logged in: `firebase login`

---

## 📦 Installation Verification

```bash
# Check if these commands work:
npm --version          # Should be 9+
node --version         # Should be 20+
firebase --version     # Should be 12+
```

Run this to verify all packages:
```bash
npm list three @react-three/fiber zustand axios firebase framer-motion
```

Expected output:
```
dextest@0.1.0
├── three@0.184.0
├── @react-three/fiber@9.6.1
├── zustand@5.0.14
├── axios@1.18.0
├── firebase@12.14.0
└── framer-motion@12.40.0
```

---

## 🔥 Firebase Setup Steps

### 1. Initialize Firebase (if not done)
```bash
firebase init
```

Select:
- [x] Firestore
- [x] Choose existing project: dextest-b6346

### 2. Deploy Rules
```bash
firebase deploy --only firestore:rules
```

Expected output:
```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

### 3. Verify in Console
1. Go to: https://console.firebase.google.com/
2. Select project: dextest-b6346
3. Navigate to Firestore Database → Rules
4. Should see rules from `firebase.rules` file

---

## 🧪 Testing Checklist

### Phase 1: Basic Setup ✅
- [ ] Run `npm install` → no errors
- [ ] Run `npm run dev` → server starts
- [ ] Visit `http://localhost:3000` → registration page loads
- [ ] Check browser console → no errors
- [ ] Check terminal → no errors

### Phase 2: Registration Flow ✅
- [ ] Fill registration form
- [ ] Use code: `TEST123`
- [ ] Submit form
- [ ] See success screen
- [ ] Code is displayed
- [ ] Check Firebase Console → new document in `users` collection

### Phase 3: Login Flow ✅
- [ ] Go to `/login`
- [ ] Enter code: `TEST123`
- [ ] Click login
- [ ] Redirect to `/test`
- [ ] See three test type cards

### Phase 4: Text Test ✅
- [ ] Click "Text-Based Test"
- [ ] Wait for questions (5-10 seconds)
- [ ] Questions load from Claude API
- [ ] Timer starts counting down
- [ ] Can select options (A, B, C, D)
- [ ] Submit answer
- [ ] See explanation
- [ ] Click "Next Question"
- [ ] Complete all 10 questions
- [ ] Redirect to `/test/results`
- [ ] See IQ score
- [ ] See AI analysis
- [ ] Check Firebase → results saved in user document

### Phase 5: Voice Test ✅
- [ ] Return to `/test`
- [ ] Click "Voice-Based Test"
- [ ] Questions load
- [ ] Click "Repeat Question" → hears question
- [ ] Click "Answer by Voice" → mic icon turns red
- [ ] Say "Option A" → transcript appears
- [ ] Answer recorded
- [ ] Complete test
- [ ] Results display

**Note**: Voice may not work on Safari or without microphone

### Phase 6: Games ✅
- [ ] Return to `/test`
- [ ] Click "Game-Based Test"
- [ ] See two game options

**Temple Run:**
- [ ] Click "Temple Run"
- [ ] See 3D scene loads
- [ ] Press arrow keys → player moves
- [ ] Obstacles move toward player
- [ ] Score increases
- [ ] Game over screen appears
- [ ] Score saved to Zustand

**Reflex Challenge:**
- [ ] Back to game selection
- [ ] Click "Reflex Challenge"
- [ ] 3D spheres appear
- [ ] Click sphere → disappears, score +10
- [ ] Timer counts down from 30
- [ ] Game ends
- [ ] Score saved

### Phase 7: Camera Monitor ✅
- [ ] During any test, look for camera button (top-right)
- [ ] Click "Enable Camera"
- [ ] Grant permission
- [ ] See webcam feed in corner
- [ ] Red recording dot visible
- [ ] Click "Stop Monitoring" → camera stops

### Phase 8: Results Page ✅
- [ ] After completing a test, see results page
- [ ] IQ score displayed (70-150)
- [ ] Accuracy percentage shown
- [ ] Average reaction time shown
- [ ] Attention score shown
- [ ] Question breakdown visible (✓/✗)
- [ ] AI analysis loading → then displays
- [ ] Game scores shown (if played)
- [ ] Click "Take Another Test" → goes to `/test`
- [ ] Click "Home" → goes to `/`

---

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot find module 'three'"
```bash
# Fix:
npm install three @types/three
```

### Issue 2: Firebase permission denied
```bash
# Fix:
firebase deploy --only firestore:rules
```

### Issue 3: Questions not generating
**Cause**: OpenRouter API issue
**Check**:
1. `.env.local` file exists
2. API key is correct
3. Check browser Network tab for 401 errors
4. Check OpenRouter dashboard for usage/limits

### Issue 4: Voice not working
**Causes**:
- Browser doesn't support Web Speech API
- No microphone connected
- Permission denied

**Fix**:
- Use Chrome or Edge
- Grant microphone permission
- Check browser settings

### Issue 5: Games showing black screen
**Causes**:
- WebGL not supported
- GPU driver issues
- Dynamic import issue

**Fix**:
- Hard refresh (Ctrl+Shift+R)
- Check browser console
- Enable WebGL in browser settings
- Update GPU drivers

### Issue 6: TypeScript errors
```bash
# Fix:
npm install --save-dev @types/react @types/node
```

### Issue 7: Build errors
```bash
# Clean and rebuild:
rm -rf .next
npm run build
```

---

## 📊 Monitoring During Development

### What to Watch:

#### 1. Browser Console
- No red errors
- No CORS issues
- API calls successful (200 status)

#### 2. Terminal Output
- No TypeScript errors
- No module resolution errors
- Hot reload working

#### 3. Network Tab
- OpenRouter API calls succeed
- Firebase reads/writes succeed
- No 401/403 errors

#### 4. Firebase Console
- Documents created in `users` collection
- `lastTestResults` updated after tests
- No security rule violations

---

## 🎯 Feature Testing Matrix

| Feature | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| Registration | [ ] | [ ] | [ ] | [ ] |
| Login | [ ] | [ ] | [ ] | [ ] |
| Text Test | [ ] | [ ] | [ ] | [ ] |
| Voice Test | [ ] | [ ] | [ ] | ⚠️ |
| Temple Run | [ ] | [ ] | [ ] | [ ] |
| Reflex Game | [ ] | [ ] | [ ] | [ ] |
| Camera | [ ] | [ ] | [ ] | [ ] |
| Results | [ ] | [ ] | [ ] | [ ] |

⚠️ = Limited support

---

## 🔐 Security Checklist

- [ ] `.env.local` in `.gitignore`
- [ ] Firebase rules deployed
- [ ] API key not committed to Git
- [ ] No console.log with sensitive data
- [ ] CORS configured properly
- [ ] Rate limiting considered (future)

---

## 📈 Performance Checklist

- [ ] Images optimized
- [ ] Components lazy-loaded where needed
- [ ] No unnecessary re-renders
- [ ] Zustand state minimal
- [ ] Firebase queries optimized
- [ ] Three.js scenes performant (60 FPS)

---

## 🚀 Pre-Deployment Checklist

### Code Quality
- [ ] No TypeScript errors: `npm run build`
- [ ] No ESLint warnings: `npm run lint`
- [ ] All components typed
- [ ] Error boundaries added (optional)

### Environment
- [ ] `.env.local` → `.env.production`
- [ ] API keys secured
- [ ] Firebase production rules
- [ ] CORS configured

### Testing
- [ ] All features tested
- [ ] Mobile responsive checked
- [ ] Cross-browser tested
- [ ] Edge cases handled

### Documentation
- [ ] README updated
- [ ] API docs current
- [ ] Setup guide accurate
- [ ] Architecture doc complete

### Deployment
- [ ] Build succeeds: `npm run build`
- [ ] Preview build locally: `npm start`
- [ ] Environment variables set in Vercel/Netlify
- [ ] Domain configured (optional)
- [ ] SSL enabled
- [ ] Analytics added (optional)

---

## 🎓 User Acceptance Testing (UAT)

### Teacher Perspective:
- [ ] Can register multiple students
- [ ] Can guide students through test
- [ ] Can access Firebase Console
- [ ] Can view student results
- [ ] Can export data (Firebase tools)

### Student Perspective:
- [ ] Easy registration flow
- [ ] Simple login process
- [ ] Clear test instructions
- [ ] Intuitive game controls
- [ ] Understandable results

### Admin Perspective:
- [ ] Can monitor Firebase usage
- [ ] Can check API usage (OpenRouter)
- [ ] Can update questions
- [ ] Can modify rules
- [ ] Can export analytics

---

## 📊 Load Testing (Future)

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 http://localhost:3000/
```

Check:
- [ ] Response time < 2s
- [ ] No errors at scale
- [ ] Firebase limits not exceeded
- [ ] OpenRouter rate limits handled

---

## ✅ Final Sign-Off

Before considering project complete:

- [ ] All features working
- [ ] All browsers tested
- [ ] Firebase deployed
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Performance optimized
- [ ] Security verified
- [ ] User feedback collected
- [ ] Bug fixes implemented
- [ ] Ready for production

---

## 📝 Notes

Track issues here:
```
Date | Issue | Status | Fix
-----|-------|--------|----
     |       |        |
```

---

**Status**: 🟢 Ready for Development Testing

Start with: `npm run dev` and follow Phase 1-8 checklist above!
