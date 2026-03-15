/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface UserProfile {
  id: string;
  email: string | null;
  subscription_active: boolean;
  subscription_tier: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('id, email, subscription_active, subscription_tier').eq('id', userId).single();

  if (error || !data) {
    return null;
  }

  return data as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    const p = await fetchProfile(userId);
    setProfile(p);
  }, []);

  useEffect(() => {
    let cancelled = false;

    console.log('[LoopVault Auth] getSession() called');
    void supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      console.log('[LoopVault Auth] getSession() result:', existingSession ? 'session exists' : 'no session', existingSession ? { user_id: existingSession.user?.id, expires_at: existingSession.expires_at } : null);
      if (cancelled) {
        return;
      }
      console.log('[AuthContext] getSession() result:', existingSession);
      setSession(existingSession);
      const resolvedUser = existingSession?.user ?? null;
      setUser(resolvedUser);
      console.log('[AuthContext] user after getSession():', resolvedUser);
      if (existingSession?.user) {
        console.log('[LoopVault Auth] User found, loading profile for:', existingSession.user.id);
        void loadProfile(existingSession.user.id).finally(() => {
          if (!cancelled) {
            console.log('[AuthContext] loading changed to false (after profile fetch)');
            setLoading(false);
          }
        });
      } else {
        console.log('[AuthContext] loading changed to false (no session)');
        console.log('[LoopVault Auth] No user session — setting loading=false, will redirect to /login');
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[LoopVault Auth] onAuthStateChange:', _event, newSession ? 'session exists' : 'no session');
      if (cancelled) {
        return;
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
