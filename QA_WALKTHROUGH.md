# Manual QA Walkthrough — Pet Tracker v2

A step-by-step script for testing the app yourself on a simulator or device. Follow it in order — later phases assume earlier ones happened. Each step says what to do and what you should see; "Internal check" callouts are places to verify something beyond what's on screen (persistence, the database, or the Supabase dashboard).

Start the app yourself with `npx expo start --ios` (or scan the QR in Expo Go) — don't skip ahead to sync expecting it to do anything yet; see Phase 6.

---

## Phase 0 — True fresh install

The onboarding flag lives in `AsyncStorage`, separate from the SQLite pet data — to see onboarding again you need a genuinely clean slate, not just closing the app.

1. Simulator: **Device → Erase All Content and Settings** (or delete the Expo Go app and reinstall it) so both AsyncStorage and the local `pettracker.db` are gone.
2. Run `npx expo start --ios` and open the app.

## Phase 1 — Onboarding

3. App should land directly on the onboarding screen — headline "Welcome to PetTracker," four step cards (Add your pets / Log health records / Works fully offline / Sync when you want), "Get Started" button.
4. Tap **Get Started** → lands on the pet list (empty state: "No pets yet").
5. **Internal check:** force-quit the app and relaunch. You should go straight to the pet list, not back to onboarding — this proves the "seen" flag persisted in `AsyncStorage` rather than just in memory.

## Phase 2 — Add your first pet (free)

6. Tap **+ Add Pet** → should open the New Pet form directly (no paywall — you have zero pets so far).
7. Enter a name (e.g. "Milo"), pick a species pill (Dog/Cat/Other), optionally tap the photo circle (Take Photo / Choose from Library), optionally tap **Set date** for birthdate — confirm the native date picker opens, and that **Clear** removes the date again.
8. Tap **Save** → back on the pet list, Milo appears with an avatar initial, species, and age (if you set a birthdate).
9. **Internal check:** force-quit and relaunch. Milo should still be there — confirms it's really in SQLite, not just React state.

## Phase 3 — Paywall gate on pet #2

10. Tap **+ Add Pet** again → this time you should land on the **paywall screen**, not the New Pet form (you now have 1 pet and aren't unlocked).
11. Confirm the paywall shows: headline "Add another pet," three bullet points, **Unlock for $7.99** button, **Restore purchase** link, fine print about a one-time purchase.
12. Tap **Restore purchase** → expect a toast: "No purchases to restore." Nothing else happens — this button is intentionally not wired to anything real yet.
13. Tap the **✕** to close → back on the pet list, still locked.
14. Tap **+ Add Pet** once more, then tap **Unlock for $7.99** → expect a toast "Unlocked — add your pet" and it drops you straight into the New Pet form.
15. Add a second pet (e.g. "Bella," Cat) → Save → pet list now shows both Milo and Bella.
16. **Internal check:** open Settings — the "Unlock more pets" row should now be gone entirely (it only shows while locked). That's your confirmation the unlock flag actually flipped, not just the toast text.

## Phase 4 — Records: one of every type

17. Tap into Milo's profile → header (name/species/age), filter chips (All / Vaccine / Vet Visit / Medication / Weight / Note), empty state "No records yet."
18. Tap **+ Add Record** and log one of each type, saving each separately, then repeating step 18:
    - **Vaccine** — pick a date, type details (e.g. "Rabies, 3-year"), optionally add a photo, Save.
    - **Vet Visit** — same pattern.
    - **Medication**.
    - **Weight** — note this type replaces the Details field with a numeric input + kg/lb toggle. Try leaving the value blank and confirm **Save is disabled**; then enter e.g. "12.5," pick "kg," Save.
    - **Note**.
19. Back on Milo's profile, the timeline should group records by month, newest first, each row showing its icon/type/detail/date. Tap each filter chip and confirm it only shows that type; tap **All** to see everything again.
20. Tap one record to open it for editing — confirm it's pre-filled correctly (the Weight one should split back into the right number + kg/lb). Try **Delete Record** from there and confirm it disappears from the timeline.
21. **Internal check — photo cancel:** add a new record, attach a photo, then tap **Cancel** instead of Save. Reopen "+ Add Record" — there should be no trace of that photo anywhere (this was a fixed bug: photos used to get written to disk immediately on picking, even if you cancelled).

## Phase 5 — Pet menu, export, delete

22. From Milo's profile, tap the **•••** menu → **Edit Pet** / **Export Milo's records** / Cancel.
23. Tap **Export Milo's records** → toast "Preparing…" then the iOS share sheet appears with a JSON file. Save it to Files and open it — confirm it contains Milo's pet info and all his records.
24. Go to **Settings → Export all data** → share sheet again, this time combining both pets. Spot-check both Milo and Bella appear in the JSON.
25. Open Milo's **Edit Pet** screen → **Delete Pet** → confirm. Back on the pet list, Milo is gone and **Bella is still there** (confirms cascade delete only affected Milo's own records, and didn't touch Bella).

## Phase 6 — Account, login, and "Sync Now" (read this part carefully)

**Before you start: "Sync Now" is currently a UI-only stub.** Tapping it just shows a toast — it does not talk to Supabase at all yet. This phase is about confirming *that's* true, not about seeing your data appear in the cloud, because it doesn't yet.

26. Settings → **Log In or Sign Up** → Signup screen.
27. Try mismatched passwords first — confirm the inline "Passwords don't match" error appears and **Create Account** stays disabled.
28. Fix the password, tap **Create Account**. One of two things happens depending on your Supabase project's email-confirmation setting: either you land straight back on the pet list logged in, or you get "Check your email to confirm your account" and land on the Login screen instead.
29. Settings → the Account row should now read **Log Out** instead of "Log In or Sign Up."
30. Tap **Log Out** → toast "Logged out," row reverts.
31. Tap it again → **Login** screen this time (not Signup) → same credentials → **Log In** → back on the pet list, logged in again.
32. Try **Continue with Apple** on either screen → expect toast "Apple Sign In coming soon." That's expected — Apple sign-in isn't implemented yet, this isn't a bug.
33. While logged in, tap **Sync Now** in Settings → expect toast **"Nothing to sync yet"** and nothing else visibly happens.
34. **Internal check (the important one):** open your Supabase project dashboard → Table Editor → look at `pets` and `health_records`. They'll be **empty**, even though Bella exists locally and you're logged in. Now check `auth.users` — your new account **will** be there. This confirms exactly what the code review found: signup/login works and creates a real account, but nothing about your actual pet data is connected to it yet. That gap is tracked, not a surprise.

## Phase 7 — Offline sanity check

35. Turn on Airplane Mode (or disconnect Wi-Fi). Add a pet, add a record, browse, edit, delete, export — everything should keep working with no spinners, errors, or delay, since none of it touches the network.
36. Try logging in or signing up while offline → should fail with a plain toast ("Invalid email or password" / "Could not log in — please try again") rather than crashing or hanging.

---

## What "done" looks like right now

Phases 0–5 and 7 should all pass cleanly — that's the actual shipped functionality. Phase 6 is expected to "pass" in the sense of matching what's described above (auth works, sync is a no-op) — if `Sync Now` ever actually moves data to Supabase, or if data survives a delete-and-reinstall while logged into the same account, that means sync has been built and this document needs updating (and `CLAUDE.md`'s "Planned: cloud sync (v2)" section should move from planned to implemented).
