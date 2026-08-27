import { Link } from 'react-router-dom'
import { LogoFull } from '@/components/brand/Logo'
import { pl } from '@/i18n/pl'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <LogoFull height={36} className="mx-auto" />
      <h1 className="mt-6 sr-text-h1">{pl.termsTitle}</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        <p>
          Korzystając ze SmartReps akceptujesz, że aplikacja służy do śledzenia treningu siłowego
          (pompki, podciąganie) według planów inspirowanych publicznymi programami progresji.
        </p>
        <p>
          Trening siłowy wiąże się z ryzykiem urazu. Przed rozpoczęciem skonsultuj się z lekarzem,
          jeśli masz problemy zdrowotne. SmartReps nie zastępuje porady medycznej.
        </p>
        <p>
          Aplikacja jest dostarczana „tak jak jest”. Dokładamy starań, by działała offline i
          synchronicznie z chmurą, ale nie gwarantujemy nieprzerwanej dostępności usług zewnętrznych
          (np. dostawy e-mail OTP).
        </p>
        <p>
          Plany treningowe odwołują się do materiałów z 100pompek.pl i podciaganie.pl — prawa do
          oryginalnych programów należą do ich autorów; SmartReps implementuje śledzenie postępu.
        </p>
        <p>
          Możesz zaprzestać korzystania w dowolnym momencie i usunąć dane lokalne w Profilu.
          Kontynuując, potwierdzasz zapoznanie się z polityką prywatności.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link to="/privacy" className="text-[var(--sr-brand-primary)]">
          {pl.privacyLink}
        </Link>
        <Link to="/" className="min-h-11 font-medium text-[var(--sr-brand-primary)]">
          {pl.legalBack}
        </Link>
      </div>
    </div>
  )
}
