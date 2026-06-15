# AI IQ Test Platform 🧠✨

Advanced AI-powered IQ testing platform with voice, text, and game-based assessments featuring stunning 3D animations.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your API keys:
```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual keys.

### 3. Deploy Firebase Rules
```bash
firebase deploy --only firestore:rules
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

## 🔐 Security

**Never commit API keys!** See [SECURITY_NOTE.md](./SECURITY_NOTE.md)

## 📚 Documentation

- [Quick Start](./QUICK_START.md)
- [Setup Guide](./SETUP_GUIDE.md)
- [Architecture](./PROJECT_ARCHITECTURE.md)
- [3D Effects](./3D_EFFECTS_GUIDE.md)

## 🛠️ Tech Stack

- Next.js 16.2.9 + React 19
- Three.js + React Three Fiber
- OpenRouter AI (NVIDIA Llama)
- Firebase Firestore
- Framer Motion + GSAP
- Tailwind CSS

---

**Built for education 🎓**
