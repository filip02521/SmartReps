-- ═══════════════════════════════════════════════════════════════
-- 048: Fix starter exercises source and dedup duplicates
--
-- Problem: Migration 045 added `source` column with check constraint
-- allowing only ('user', 'ai'). Starter exercises (auto-seeded by
-- ensureDefaultExercises) were never marked as 'starter' because the
-- constraint didn't allow it. All 422 exercises in production had
-- source='user', falsely triggering the exercise_creator achievement.
--
-- Additionally, a race condition in ensureDefaultExercises (fixed in
-- app code) created duplicate starter exercises — one user had 177
-- exercises with 9 copies of "Deska".
--
-- This migration:
-- 1. Relaxes the check constraint to allow 'starter'
-- 2. Marks all exercises with starter names as source='starter'
-- 3. Archives duplicates (keeps oldest per user+name+metric)
-- ═══════════════════════════════════════════════════════════════

-- Step 0: Update check constraint to allow 'starter'
alter table public.user_exercises drop constraint if exists user_exercises_source_check;
alter table public.user_exercises add constraint user_exercises_source_check
  check (source in ('user', 'ai', 'starter'));

comment on column public.user_exercises.source is
  'Origin of the exercise: user (manually created), ai (AI plan generator), or starter (auto-seeded).';

-- Step 1: Mark all exercises with starter names as source='starter'
update public.user_exercises
set source = 'starter'
where name in (
  'Pompki', 'Podciąganie', 'Przysiady', 'Deska', 'Plank boczny', 'Wyciskanie',
  'Wyciskanie sztangi na ławce poziomej', 'Wyciskanie sztangi na ławce skośnej dodatniej',
  'Rozpiętki hantlami', 'Pompki na poręczach', 'Pompki szerokie',
  'Wiosłowanie sztangą w opadzie', 'Ściąganie drążka wyciągu górnego', 'Martwy ciąg',
  'Wiosłowanie na wyciągu siedząc', 'Face pull (wyciąg do twarzy)', 'Wyciskanie sztangi nad głowę stojąc',
  'Wznosy hantli bokiem', 'Wznosy hantli przodem', 'Odwrotne rozpiętki', 'Wyciskanie hantli Arnolda',
  'Uginanie ramion ze sztangą stojąc', 'Uginanie ramion z hantlami stojąc',
  'Uginanie ramion chwytem młotkowym', 'Prostowanie ramion na wyciągu', 'Wyciskanie francuskie hantlami',
  'Wyciskanie sztangi wąskim chwytem', 'Wypychanie nóg na suwnicy', 'Wykroki z hantlami',
  'Martwy ciąg na prostych nogach (RDL)', 'Prostowanie nóg na maszynie siedząc', 'Uginanie nóg na maszynie leżąc',
  'Wspięcia na palce stojąc', 'Przysiad goblet z hantlem', 'Thrust bioder ze sztangą',
  'Spięcia brzucha leżąc', 'Wznosy nóg w zwisie', 'Rotacje tułowia (Russian twist)',
  'Wspinaczka w podporze', 'Martwy robak (dead bug)', 'Burpees', 'Wyмахy odważnikiem (kettlebell swing)',
  'Thrusters (przysiad + wyciskanie)', 'Zarzut i wyciskanie (clean & press)'
);

-- Step 2: Deduplicate — for each (user_id, name, primary_metric) group with
-- multiple non-archived rows, keep the oldest one and archive the rest.
-- This prevents the exercise_creator achievement from counting duplicates
-- and keeps the exercise library clean.
update public.user_exercises
set archived = true,
    updated_at = now()
where id in (
  select dup.id
  from (
    select
      e.id,
      e.user_id,
      e.name,
      e.primary_metric,
      e.created_at,
      row_number() over (
        partition by e.user_id, lower(trim(e.name)), e.primary_metric
        order by e.created_at asc, e.id asc
      ) as rn
    from public.user_exercises e
    where e.archived = false
  ) dup
  where dup.rn > 1
);
