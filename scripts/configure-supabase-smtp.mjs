#!/usr/bin/env node
/**
 * Configure Supabase Auth custom SMTP (AWS SES) + email OTP templates.
 *
 * SmartReps logs in with a 6-digit code only (no magic-link buttons in email).
 * New users previously got the default "Confirm your email" link template when
 * mailer_autoconfirm was false — that broke PWA / first-run signup.
 *
 * Requires SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens
 * Loads optional `.env.smtp.local` from repo root (gitignored).
 *
 * Usage:
 *   node scripts/configure-supabase-smtp.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** Must match Login.tsx + i18n (6-cyfrowy kod). */
const OTP_LENGTH = 6
/** Matches template copy ("ważny przez godzinę"). */
const OTP_EXP_SECONDS = 3600

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function readOtpTemplate(fileName) {
  const templatePath = path.join(root, 'supabase/templates', fileName)
  const templateHtml = fs.readFileSync(templatePath, 'utf8')
  if (!templateHtml.includes('{{ .Token }}')) {
    console.error(`${fileName} must include {{ .Token }} for email OTP`)
    process.exit(1)
  }
  if (templateHtml.includes('{{ .ConfirmationURL }}')) {
    console.error(
      `${fileName} must NOT include {{ .ConfirmationURL }} — mail scanners auto-click links and break OTP login.`,
    )
    process.exit(1)
  }
  return templateHtml
}

loadEnvFile(path.join(root, '.env.smtp.local'))

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pwfymoxjrgnovzcmmfyn'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)')
  process.exit(1)
}

const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
if (!smtpUser || !smtpPass) {
  console.error('Missing SMTP_USER / SMTP_PASS')
  process.exit(1)
}

const magicLinkHtml = readOtpTemplate('magic_link.html')
const confirmationHtml = readOtpTemplate('confirmation.html')

const siteUrl = process.env.SITE_URL || 'https://smart-reps.vercel.app'
const uriAllowList =
  process.env.URI_ALLOW_LIST ||
  'https://smart-reps.vercel.app/**,http://localhost:5173/**'
const otpSubject = process.env.MAILER_SUBJECT || 'Kod logowania SmartReps'

const body = {
  external_email_enabled: true,
  // Confirm email via OTP entry in-app — never send a clickable confirm link.
  mailer_autoconfirm: true,
  site_url: siteUrl,
  uri_allow_list: uriAllowList,
  smtp_host: process.env.SMTP_HOST || 'email-smtp.eu-central-1.amazonaws.com',
  smtp_port: String(process.env.SMTP_PORT || '587'),
  smtp_user: smtpUser,
  smtp_pass: smtpPass,
  smtp_admin_email: process.env.SMTP_ADMIN_EMAIL || 'SR@ontime.mikran.pl',
  smtp_sender_name: process.env.SMTP_SENDER_NAME || 'SmartReps',
  mailer_subjects_magic_link: otpSubject,
  mailer_templates_magic_link_content: magicLinkHtml,
  // Safety net if Auth still emits a confirmation mail for an unconfirmed user.
  mailer_subjects_confirmation: otpSubject,
  mailer_templates_confirmation_content: confirmationHtml,
  mailer_otp_length: OTP_LENGTH,
  mailer_otp_exp: OTP_EXP_SECONDS,
  // Seconds between OTP emails to the same address (Supabase default is 60).
  smtp_max_frequency: Number(process.env.SMTP_MAX_FREQUENCY || 30),
  // Custom SMTP unlocks higher throughput vs built-in mailer (~2–4/h).
  rate_limit_email_sent: Number(process.env.RATE_LIMIT_EMAIL_SENT || 30),
}

// Templates are read from this repo (supabase/templates/*.html) and pushed to Supabase Auth.
// This is intentional — the script is run manually by an operator to configure SMTP/OTP.
// lgtm[js/file-access-to-http]
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
})

const text = await res.text()
if (!res.ok) {
  console.error('Failed:', res.status, text.slice(0, 800))
  process.exit(1)
}

let verified = {}
try {
  const check = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await check.json()
  const magic = String(j.mailer_templates_magic_link_content || '')
  const confirm = String(j.mailer_templates_confirmation_content || '')
  verified = {
    smtp_host: j.smtp_host,
    smtp_admin_email: j.smtp_admin_email,
    smtp_sender_name: j.smtp_sender_name,
    mailer_autoconfirm: j.mailer_autoconfirm,
    mailer_otp_length: j.mailer_otp_length,
    mailer_otp_exp: j.mailer_otp_exp,
    smtp_max_frequency: j.smtp_max_frequency,
    subject_magic: j.mailer_subjects_magic_link,
    subject_confirm: j.mailer_subjects_confirmation,
    magic_has_token: magic.includes('{{ .Token }}'),
    magic_has_link: magic.includes('{{ .ConfirmationURL }}'),
    confirm_has_token: confirm.includes('{{ .Token }}'),
    confirm_has_link: confirm.includes('{{ .ConfirmationURL }}'),
    site_url: j.site_url,
  }
} catch {
  verified = { verify: 'skipped' }
}

const ok =
  verified.mailer_autoconfirm === true &&
  verified.magic_has_token === true &&
  verified.magic_has_link === false &&
  verified.confirm_has_token === true &&
  verified.confirm_has_link === false &&
  verified.mailer_otp_length === OTP_LENGTH &&
  Number(verified.smtp_max_frequency) <= 30

console.log('OK — custom SMTP + OTP templates applied on', PROJECT_REF)
console.log('From:', body.smtp_sender_name, `<${body.smtp_admin_email}>`)
console.log('Host:', body.smtp_host + ':' + body.smtp_port)
console.log('Subject:', otpSubject)
console.log('OTP length/exp:', OTP_LENGTH, '/', OTP_EXP_SECONDS + 's')
console.log('SMTP max frequency:', body.smtp_max_frequency, 's')
console.log('Verified:', verified)
if (!ok) {
  console.error('Verification failed — auth email config is not OTP-only.')
  process.exit(1)
}
