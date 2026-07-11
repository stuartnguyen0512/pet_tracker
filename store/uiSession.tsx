import React, { createContext, useCallback, useContext, useState } from 'react';

// Placeholder, UI-only stand-in for a real Supabase auth session — in-memory
// only, not persisted, not backed by any account or token. It exists so the
// Login/Signup/Settings screens can agree on "logged in or not" while the
// real session wiring is built separately. Swap this out once real auth
// exists.
type UiSessionContextType = {
  isLoggedIn: boolean;
  logIn: () => void;
  logOut: () => void;
};

const UiSessionContext = createContext<UiSessionContextType | null>(null);

export function useUiSession(): UiSessionContextType {
  const ctx = useContext(UiSessionContext);
  if (!ctx) throw new Error('useUiSession must be used within UiSessionProvider');
  return ctx;
}

export function UiSessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const logIn = useCallback(() => setIsLoggedIn(true), []);
  const logOut = useCallback(() => setIsLoggedIn(false), []);

  return (
    <UiSessionContext.Provider value={{ isLoggedIn, logIn, logOut }}>
      {children}
    </UiSessionContext.Provider>
  );
}
