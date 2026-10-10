# ESCP Room Finder

Find any room, office or service across ESCP Berlin's Buildings B, C and D, see it
marked on the right floor plan, and get turn-by-turn directions — including a
step-free route.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # validates the route graph, typechecks, then builds
npm run validate # graph checks + golden route tests on their own
```

The app works with **no backend at all**: room data and floor plans are compiled
into the bundle, so it paints instantly and stays fully usable offline. Supabase
is only needed for editing.

## How it fits together

```
src/data/graph.ts    the campus route graph — 40 nodes, 53 edges, hand-authored
src/data/rooms.ts    126 rooms transcribed from the official floor plans
src/data/maps.ts     the seven plan sheets and their framing
src/lib/directions.ts  graph assembly + Dijkstra
src/lib/steps.ts       turns a node path into readable steps
src/lib/route.ts       the public routing API, incl. step-free handling
```

Directions are **generated**, not stored. Each room names an `accessNode` (the
corridor it opens off) plus an optional `localHint`; rooms are attached to the
graph as leaves at load time, so correcting a room's access node takes effect
without a deploy.

`stepFree` is a hard filter rather than a cost penalty — there is no such thing
as a route that is slightly stairs. Where no step-free route exists the app says
so, shows how far it *can* get you step-free, and points at Reception.

## Known constraint: Building D, 2nd floor

Building D has no lift on any floor, so its entire second floor — 24 rooms,
including Post-Study Affairs and Recruiting & Admissions — cannot be reached
without stairs. `npm run validate` asserts this set is exactly Building D level 2
and **fails the build if it changes**, so the day a lift is added (or another
floor loses access) someone has to look at it deliberately.

## Floor plans

Seven sheets in `public/maps/`, all 2000×1120. Two notes on the source files:

- The school's `Building B Second Floor.png` actually depicts **Building D's**
  second floor. It is published here as `d-second.png`.
- There is therefore **no plan for Building B or C level 2**. B-221, the IT
  Office and the Building C professors' offices are listed and routable, but
  show a "no floor plan available" placeholder.

Pin positions are normalized 0–1 against the sheet. `geometry_version` on a room
is compared against `image_version` on its sheet: if a plan image is replaced,
rooms whose coordinates predate it are **hidden rather than drawn in the wrong
place**, and flagged for review in the admin's "Verify pins" view.

## Setting up editing (optional)

1. Create a Supabase project and run `supabase/schema.sql` against it.
2. **Authentication → Providers → Email: turn OFF "Allow new users to sign up".**
   The anon key is public by design, so row-level security is the only wall — and
   a policy keyed on `authenticated` alone would let any stranger who signed up
   write to the campus data. Policies additionally require a row in `admins`.
3. Invite yourself, then:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@escp.eu';
   ```
4. Seed the tables:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run seed
   ```
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel. Optionally set
   `VITE_DEPLOY_HOOK_URL` to a Vercel deploy hook so the admin's **Publish**
   button can rebuild the bundled snapshot.

Edits are live for anyone whose browser refetches. Publishing rebuilds the
snapshot so the change also reaches people who never complete a network request.
