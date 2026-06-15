"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useTestStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const [signupCode, setSignupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setStudentInfo } = useTestStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanCode = signupCode.trim();
      
      if (!cleanCode) {
        setError('Please enter your signup code');
        setLoading(false);
        return;
      }

      // Fetch user from Firestore
      const userDocRef = doc(db, 'users', cleanCode);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError('Invalid signup code. Please check and try again.');
        setLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      
      // Store student info in global state
      setStudentInfo(cleanCode, parseInt(userData.class.match(/\d+/)[0]), userData.name);
      
      // Navigate to test selection
      router.push('/test');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 text-white flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-[30rem] h-[30rem] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl p-8 sm:p-10">
          {/* Decorative border glow */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
              <LogIn className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-r from-indigo-200 via-white to-indigo-200 bg-clip-text text-transparent">
              Student Login
            </h1>
            <p className="mt-2.5 text-zinc-400 text-sm sm:text-base">
              Enter your unique signup code to access the IQ test platform
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-2xl flex items-start gap-3 text-red-200 text-sm animate-pulse">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="signupCode" className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
                Signup Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="signupCode"
                  name="signupCode"
                  type="text"
                  required
                  placeholder="Enter your unique code"
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-950/40 border border-zinc-800 focus:border-indigo-500 rounded-xl text-white placeholder-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-[0.99] transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login to Test Platform</span>
                  <LogIn className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-center text-sm text-zinc-500">
              Don't have an account?{' '}
              <a href="/" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Register here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
