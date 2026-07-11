import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type UiSessionContextType = {
  session: Session | null;
  user: User | null;
  isLoggedIn: boolean;
  isInitializing: boolean;
  logOut: () => Promise<void>;
};

const UiSessionContext = createContext<UiSessionContextType | null>(null);

export function useUiSession(): UiSessionContextType {
  const ctx = useContext(UiSessionContext);
  if (!ctx) throw new Error('useUiSession must be used within UiSessionProvider');
  return ctx;
}

export function UiSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Sign-out failures are left to the caller to report — we don't touch
  // local state here, letting the SIGNED_OUT event (if it fires) be the
  // single source of truth instead of guessing at the outcome.
  const logOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <UiSessionContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoggedIn: session !== null,
        isInitializing,
        logOut,
      }}
    >
      {children}
    </UiSessionContext.Provider>
  );
}
