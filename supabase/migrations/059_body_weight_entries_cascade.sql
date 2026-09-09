-- Naprawia FK w body_weight_entries — dodaje ON DELETE CASCADE.
-- Bez tego usuwanie konta zostawia wpisy wagi (ryzyko RODO/GDPR).
-- Edge Function delete-account usuwa body_weight_entries ręcznie,
-- ale cascade zapewnia spójność nawet przy bezpośrednim usunięciu profilu.

alter table public.body_weight_entries
  drop constraint if exists body_weight_entries_user_id_fkey;

alter table public.body_weight_entries
  add constraint body_weight_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
