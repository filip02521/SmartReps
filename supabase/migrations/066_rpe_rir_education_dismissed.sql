-- Add rpe_rir_education_dismissed column to profiles
-- Allows users to dismiss the RPE/RIR education hint; synced across devices.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rpe_rir_education_dismissed boolean DEFAULT false NOT NULL;
