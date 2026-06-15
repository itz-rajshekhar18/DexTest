# ⚡ Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install & Run
```bash
npm install
npm run dev
```

Visit: **http://localhost:3000**

---

## 📝 First Test Run

### A. Register a Test Student
1. Go to `http://localhost:3000`
2. Fill form:
   - Name: `Test Student`
   - Email: `test@example.com`
   - Father: `Test Father`
   - Mother: `Test Mother`
   - Age: `16`
   - Class: `Class 10`
   - Phone: `1234567890`
   - **Code: `TEST123`** ← Remember this!
3. Click "Submit Registration"
4. ✅ Success! Copy the code shown

### B. Login
1. Go to `http://localhost:3000/login`
2. Enter code: `TEST123`
3. Click "Login to Test Platform"

### C. Take a Test
1. Choose **Text-Based Test** (easiest to start)
2. Wait ~5 seconds for questions to generate
3. Answer 10 multiple-choice questions
4. See your results with AI analysis!

---

## 🎮 Try the Games

1. Login → Select **Game-Based Test**
2. Choose **Reflex Challenge** (click the spheres)
3. Play for 30 seconds
4. See your reaction time score!

---

## 🔐 Firebase Setup (Required)

### Deploy Security Rules:
```bash
firebase login
firebase deploy --only firestore:rules
```

This allows the app to read/write to your Firestore database.

---

## ✅ Verification Checklist

- [ ] Dev server running on http://localhost:3000
- [ ] Can see registration page
- [ ] Can register a student (code: TEST123)
- [ ] Can login with TEST123
- [ ] Can select a test type
- [ ] Questions load successfully
- [ ] Can complete a test
- [ ] Results page displays
- [ ] Firebase rules deployed

---

## 🆘 Quick Fixes

### ❌ "Missing permissions" error
**Fix:** Deploy Firebase rules
```bash
firebase deploy --only firestore:rules
```

### ❌ Questions not loading
**Check:** 
- OpenRouter API key in `.env.local`
- Internet connection
- Browser console for errors

### ❌ Voice not working
**Fix:** Use Chrome or Edge browser (best support)

### ❌ Games showing black screen
**Fix:** Hard refresh (Ctrl+Shift+R)

---

## 📚 Next Steps

1. ✅ Test all three test types
2. ✅ Enable camera monitoring
3. ✅ Try voice commands
4. ✅ Play both games
5. ✅ Check results in Firebase Console
6. 📖 Read `SETUP_GUIDE.md` for detailed info
7. 📖 Read `PROJECT_ARCHITECTURE.md` for technical details

---

## 🎯 Test Credentials

Use these for quick testing:
- Code 1: `TEST123`
- Code 2: `STUDENT456`
- Code 3: `DEMO789`

(Register these first!)

---

## 🔑 Important Files

- `📁 .env.local` - API keys (already configured)
- `📁 firebase.rules` - Database security rules
- `📁 lib/firebase.ts` - Firebase config
- `📁 lib/openrouter.ts` - AI integration
- `📁 lib/store.ts` - Global state

---

## 🎉 You're Ready!

Your AI IQ Test Platform is now running. Happy testing!

**Need help?** Check `SETUP_GUIDE.md` for detailed troubleshooting.
