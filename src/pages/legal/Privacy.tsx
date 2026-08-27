import { Link } from 'react-router-dom'
import { LogoFull } from '@/components/brand/Logo'
import { pl } from '@/i18n/pl'

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <LogoFull height={36} className="mx-auto" />
      <h1 className="mt-6 sr-text-h1">{pl.privacyTitle}</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        <p>
          SmartReps to aplikacja treningowa działająca przede wszystkim lokalnie na Twoim urządzeniu
          (IndexedDB / Dexie). Postęp, sesje i ustawienia są zapisywane u Ciebie.
        </p>
        <p>
          Opcjonalnie możesz podać adres e-mail i zalogować się przez Supabase (kod OTP), aby
          synchronizować postęp między urządzeniami. Wówczas przetwarzamy identyfikator konta,
          e-mail oraz dane treningowe niezbędne do synchronizacji.
        </p>
        <p>
          Nie sprzedajemy danych. Nie budujemy profili reklamowych. Przypomnienia możesz włączyć
          w dwóch trybach: (1) lokalnie przy otwartej aplikacji lub (2) opcjonalnie jako Web Push
          po instalacji PWA i zalogowaniu — wtedy powiadomienie może dotrzeć także po zamknięciu
          aplikacji. Endpoint subskrypcji push jest powiązany z Twoim kontem.
        </p>
        <p>
          Możesz w każdej chwili wyczyścić dane lokalne w Profilu oraz wylogować się. Usunięcie
          konta w chmurze: napisz na adres właściciela projektu (patrz repozytorium) z adresu
          użytego do logowania — usuniemy rekordy powiązane z kontem.
        </p>
        <p>Kontakt w sprawach prywatności: poprzez issues w repozytorium SmartReps na GitHubie.</p>
      </div>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-[var(--sr-brand-primary)]"
      >
        {pl.legalBack}
      </Link>
    </div>
  )
}
