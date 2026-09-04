import { useNavigate, Link } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

export default function TermsPage() {
  const navigate = useNavigate()
  useSeo({ title: pl.seoTermsTitle, description: pl.seoTermsDescription, path: '/terms' })
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader title={pl.termsTitle} onBack={() => navigate('/')} />
      <div className="mt-2 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
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
          W katalogu społecznościowym możesz publikować własne plany (tytuł, opis, strukturę
          treningu) oraz importować plany innych użytkowników jako lokalną kopię. Publikując,
          udzielasz SmartReps niewyłącznej licencji na wyświetlanie planu w katalogu i umożliwienie
          importu kopii innym użytkownikom. Nie publikuj danych osobowych w opisach ani treści
          niebezpiecznych / niezgodnych z prawem. Możesz wycofać publikację (unpublish) oraz
          zgłosić cudzą treść. Zastrzegamy prawo do ukrycia lub usunięcia zgłoszonych publikacji.
        </p>
        <p>
          Możesz zaprzestać korzystania w dowolnym momencie i usunąć dane lokalne w Profilu.
          Kontynuując, potwierdzasz zapoznanie się z polityką prywatności.
        </p>
      </div>
      <p className="mt-8 text-sm">
        <Link to="/privacy" className="font-medium text-[var(--sr-brand-primary)] underline-offset-4 hover:underline">
          {pl.privacyLink}
        </Link>
      </p>
    </div>
  )
}
