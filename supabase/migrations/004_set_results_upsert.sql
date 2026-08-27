-- Unique set identity per session for safe upsert sync

create unique index if not exists set_results_session_set_number
  on set_results (session_id, set_number);
