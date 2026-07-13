import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Opt-in, network-hitting test against the REAL Supabase project configured
// in .env (not a mock, not a local emulator). Skipped by default so
// `npm test` stays fast, offline, and doesn't create a new throwaway
// auth.users row every run.
//
// Run it explicitly with:
//   RUN_LIVE_SUPABASE_TESTS=1 npm test -- supabaseAuth.live
// (or `npm run test:live`)
//
// Each run creates one real account in your Supabase project's auth.users
// table that this test cannot delete afterward — deleting a user requires
// the service-role key, which intentionally isn't used anywhere in this
// client-side app (see lib/supabaseClient.ts, which only ever uses the
// public anon/publishable key). These test accounts hold no real data and
// cost nothing, but are permanent until you remove them yourself from the
// Supabase dashboard (Authentication -> Users) if that bothers you.
//
// This file could not be executed from the sandbox this was written in —
// that environment has no outbound network access at all (not even to
// github.com), so this is unverified beyond a manual one-off run against
// the real project during development. Run it for real once on a machine
// with normal internet access before trusting it.

function loadDotEnvIfNeeded(): void {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) return;
  try {
    const envPath = path.resolve(__dirname, '../.env');
    const contents = readFileSync(envPath, 'utf8');
    for (const line of contents.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // .env not present — the beforeAll check below surfaces a clear error instead.
  }
}
loadDotEnvIfNeeded();

const RUN_LIVE = process.env.RUN_LIVE_SUPABASE_TESTS === '1';
const describeLive = RUN_LIVE ? describe : describe.skip;

describeLive('Supabase auth (live network — real project, opt-in)', () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;
  const testEmail = `pettracker-agent-test+${Date.now()}@example.com`;
  const testPassword = 'Test-Password-123!';

  beforeAll(() => {
    if (!url || !key) {
      throw new Error(
        'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — check .env exists at the project root.',
      );
    }
  });

  it('signs up a brand new account', async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signUp({ email: testEmail, password: testPassword });
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
  });

  it('logs in with the same credentials from a fresh client (simulates a second device)', async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  it('can write its own row, and RLS scopes reads to owner_id = auth.uid()', async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    expect(signInErr).toBeNull();
    const uid = signIn.session!.user.id;

    const { error: insertErr } = await supabase.from('pets').insert({ owner_id: uid, name: 'TestPet', species: 'Dog' });
    expect(insertErr).toBeNull();

    const { data: ownRows, error: readErr } = await supabase.from('pets').select('*');
    expect(readErr).toBeNull();
    expect(ownRows).not.toHaveLength(0);
    expect(ownRows?.every(r => r.owner_id === uid)).toBe(true);
  });

  it('logs out cleanly', async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });
});
