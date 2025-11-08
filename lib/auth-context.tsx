'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle OAuth callback - check for hash fragments
    const handleOAuthCallback = async () => {
      if (typeof window !== 'undefined') {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('[Auth] OAuth callback error:', error, errorDescription);
        }
        
        // If we have an access token in the hash, Supabase will handle it
        // But we should also check for error parameters in the query string
        const urlParams = new URLSearchParams(window.location.search);
        const queryError = urlParams.get('error');
        if (queryError) {
          console.error('[Auth] OAuth query error:', queryError, urlParams.get('error_description'));
        }
      }
    };

    handleOAuthCallback();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session, error } }) => {
      if (error) {
        console.error('[Auth] Error getting session:', error);
      }
      console.log('[Auth] Initial session:', session ? 'Found' : 'None', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, session ? 'Session found' : 'No session', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    // Try to sign in first
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If user doesn't exist, sign them up
    if (error && error.message.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/creator`,
        },
      });

      if (signUpError) {
        console.error('Error signing up:', signUpError);
        throw signUpError;
      }

      data = signUpData as any;
      error = null;
    }

    if (error) {
      console.error('Error signing in:', error);
      throw error;
    }

    return data;
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/creator`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error);
      // Provide more helpful error message
      if (error.message?.includes('not enabled') || error.message?.includes('Unsupported provider')) {
        throw new Error('Google OAuth is not enabled in Supabase. Please enable it in your Supabase dashboard (Authentication → Providers → Google).');
      }
      throw error;
    }

    // OAuth redirect happens automatically, no need to return data
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithEmail, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
