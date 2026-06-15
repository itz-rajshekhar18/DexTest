# 🔐 Security Notice

## ⚠️ Important: API Keys

Your API keys and credentials have been removed from the repository for security.

### Setup Instructions:

1. **Create `.env.local` file** in the project root
2. **Add your API keys**:

```env
NEXT_PUBLIC_OPENROUTER_API_KEY=your_actual_api_key_here
```

3. **Never commit `.env.local`** - it's already in `.gitignore`

### Where to Get Keys:

- **OpenRouter API Key**: https://openrouter.ai/keys
- **Firebase Config**: Already in `lib/firebase.ts`

### What Was Removed:

- ❌ OpenRouter API key from `.env.local`
- ❌ API keys from documentation files
- ✅ Replaced with placeholders

### Safe to Commit:

- ✅ `.env.example` - Template without real keys
- ✅ Code files - No hardcoded secrets
- ✅ Documentation - Generic instructions

---

**Never commit real API keys to GitHub!** GitHub's secret scanning will block your push.
