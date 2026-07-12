import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db/database';
import * as Q from './db/queries';
import { hasSeenOnboarding, markOnboardingSeen } from './lib/onboarding';
import { RecordType } from './types';

// End-to-end simulation of the flow a real first-time user goes through,
// stitched across modules rather than re-testing each in isolation (those
// unit tests already live in db/queries.test.ts, lib/onboarding.test.ts,
// db/database.test.ts). This file follows one continuous story: fresh
// install -> onboarding -> first pet -> second pet -> records of every
// type -> export shape -> cascade delete.
//
// Everything below runs against the local SQLite mock + AsyncStorage mock —
// no network calls. The account/auth/sync leg of the same journey lives in
// supabaseAuth.live.test.ts, which does hit the real network and is opt-in
// (skipped by default) — see that file for why.
describe('first-time user journey (local, offline)', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    await AsyncStorage.clear();
    db = await initDatabase();
  });

  it('shows onboarding on a fresh install, and never again after it is marked seen', async () => {
    expect(await hasSeenOnboarding()).toBe(false);
    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);
  });

  it('lets a brand new user add their first pet for free', async () => {
    expect(await Q.listPets(db)).toHaveLength(0);

    const milo = await Q.createPet(db, { name: 'Milo', species: 'Dog', photo: null, birthdate: null });

    expect(await Q.listPets(db)).toHaveLength(1);
    expect(milo.name).toBe('Milo');
  });

  it('lets a user add a second pet freely', async () => {
    await Q.createPet(db, { name: 'Milo', species: 'Dog', photo: null, birthdate: null });
    await Q.createPet(db, { name: 'Bella', species: 'Cat', photo: null, birthdate: null });

    const pets = await Q.listPets(db);
    expect(pets).toHaveLength(2);
    expect(pets.map(p => p.name)).toEqual(['Milo', 'Bella']);
  });

  it('logs one of each record type against a pet and reads them back newest-first', async () => {
    const pet = await Q.createPet(db, { name: 'Milo', species: 'Dog', photo: null, birthdate: null });
    const entries: Array<{ type: RecordType; date: string }> = [
      { type: 'Vaccine', date: '2024-01-10' },
      { type: 'Vet Visit', date: '2024-03-05' },
      { type: 'Medication', date: '2024-03-06' },
      { type: 'Weight', date: '2024-04-01' },
      { type: 'Note', date: '2024-04-02' },
    ];
    for (const { type, date } of entries) {
      await Q.createRecord(db, { petId: pet.id, type, date, details: `${type} details`, photo: null });
    }

    const records = await Q.listRecordsForPet(db, pet.id);
    expect(records).toHaveLength(5);
    expect(records[0].date).toBe('2024-04-02'); // newest first
    expect(new Set(records.map(r => r.type))).toEqual(
      new Set<RecordType>(['Vaccine', 'Vet Visit', 'Medication', 'Weight', 'Note']),
    );
  });

  it('produces the same pets/records export shape settings.tsx hands to exportJson', async () => {
    const pet = await Q.createPet(db, { name: 'Milo', species: 'Dog', photo: null, birthdate: null });
    await Q.createRecord(db, { petId: pet.id, type: 'Note', date: '2024-01-01', details: 'first checkup', photo: null });

    const pets = await Q.listPets(db);
    const records = (await Promise.all(pets.map(p => Q.listRecordsForPet(db, p.id)))).flat();
    const payload = { pets, records };

    expect(payload.pets).toHaveLength(1);
    expect(payload.records).toHaveLength(1);
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it('deleting a pet cascades to its records, and leaves other pets untouched', async () => {
    const milo = await Q.createPet(db, { name: 'Milo', species: 'Dog', photo: null, birthdate: null });
    const bella = await Q.createPet(db, { name: 'Bella', species: 'Cat', photo: null, birthdate: null });
    const miloRecord = await Q.createRecord(db, { petId: milo.id, type: 'Note', date: '2024-01-01', details: 'x', photo: null });
    const bellaRecord = await Q.createRecord(db, { petId: bella.id, type: 'Note', date: '2024-01-01', details: 'y', photo: null });

    await Q.deletePet(db, milo.id);

    expect(await Q.getPet(db, milo.id)).toBeNull();
    expect(await Q.getRecord(db, miloRecord.id)).toBeNull();
    expect(await Q.getPet(db, bella.id)).not.toBeNull();
    expect(await Q.getRecord(db, bellaRecord.id)).not.toBeNull();
  });

  // --- Account + cloud sync leg of the journey ---
  //
  // The story this suite is built from ("create/log in to an account, then
  // Sync Now pushes data to Supabase") cannot be exercised past this point.
  // app/settings.tsx's onSyncNow() is a UI-only stub today (its own source
  // comment says so: "no Supabase push/pull wired up yet"), and neither
  // store/pets.tsx nor db/queries.ts reference the supabase client at all.
  // There is no dirty/updated_at tracking and nothing pushes or pulls.
  //
  // These are left as `.todo` so the gap shows up in test output as pending
  // rather than being silently absent, and so whoever implements Milestone
  // 3/4 (PRD §12) has a concrete checklist of what "done" needs to cover.
  describe('cloud sync (not implemented yet — see CLAUDE.md "Planned: cloud sync (v2)")', () => {
    it.todo('marks a newly-created/updated/deleted pet or record as dirty locally');
    it.todo('pushes dirty local pets/records to Supabase on Sync Now, scoped to the signed-in owner_id');
    it.todo('pulls remote changes since the last sync cursor into local SQLite');
    it.todo('resolves push/pull conflicts by last-write-wins on updated_at');
    it.todo('tombstones (deleted_at) a locally-deleted pet/record instead of hard-deleting, so deletes propagate on next sync');
    it.todo('syncs the entitlements.unlocked flag in both directions');
    it.todo('uploads/downloads photos via Supabase Storage on sync');
  });
});
