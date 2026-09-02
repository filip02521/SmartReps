import { useNavigate, Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'

export default function PrivacyPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader
        title={pl.privacyTitle}
        onBack={() => navigate('/')}
      />
      <div className="mt-2 space-y-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
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
          <strong>Eksport danych:</strong> w Profilu → sekcja „Dane” możesz pobrać historię treningów
          (CSV) lub pełny backup (JSON) z postępem i ustawieniami na tym urządzeniu.
        </p>
        <p>
          <strong>Katalog społecznościowy:</strong> przy publikacji planu zapisujemy w chmurze
          snapshot treningu, podpis autora (wyświetlana nazwa), tagi oraz metadane (np. liczba
          polubień i importów). Import i polubienie wymagają konta. Katalog nie udostępnia Twojego
          e-maila ani prywatnych draftów.
        </p>
        <p>
          <strong>Usunięcie konta:</strong> zalogowany użytkownik może w Profilu trwale usunąć konto
          w chmurze (postęp, sesje, subskrypcje push, publikacje społecznościowe, polubienia,
          importy i zgłoszenia powiązane z kontem). Usunięcie konta nie kasuje automatycznie danych
          lokalnych — możesz je wyczyścić osobno. Przed usunięciem zalecamy pobrać backup.
        </p>
        <p>
          Możesz w każdej chwili wyczyścić dane lokalne w Profilu oraz wylogować się bez usuwania
          konta w chmurze.
        </p>
        <p>Kontakt w sprawach prywatności: poprzez issues w repozytorium SmartReps na GitHubie.</p>
      </div>
      <p className="mt-8 text-sm">
        <Link to="/terms" className="font-medium text-[var(--sr-brand-primary)]">
          {pl.termsLink}
        </Link>
      </p>
    </div>
  )
}
