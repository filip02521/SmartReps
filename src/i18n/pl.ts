import { getActiveDict } from './i18n-runtime'

const plDict = {
  appName: 'SmartReps',
  tagline: 'Twój inteligentny trener powtórzeń',
  splashTagline: 'Trening, który mierzy postęp',

  // Dashboard
  ready: 'Gotowy do treningu',
  dashboardSubtitle: 'Wybierz program i zacznij dzień',
  homeChooseTraining: 'Wybierz trening',
  homeChooseTrainingHint: 'Dotknij karty programu, aby rozpocząć.',
  homeYourPrograms: 'Twoje programy',
  homeAddSecondProgram: 'Dodaj drugi program',
  homeSessions14d: 'Treningi',
  homeSessions14dHint: '14 dni',
  homeReps14d: 'Powtórzenia',
  homeReps14dHint: '14 dni',
  homeGoal3in14: '3 treningi w 14 dni',
  homeActivityTitle: 'Twoja aktywność',
  homeStreakWeeksHint: 'obecna seria',
  homeInsightNoActivity: 'Brak treningów od miesiąca — czas wrócić do planu.',
  homeRepsChangeUp: 'Robisz postęp — więcej powtórzeń',
  homeRepsChangeDown: 'Mniej powtórzeń niż wcześniej',
  homeRepsChangeSame: 'Stabilnie — tyle samo powtórzeń',
  homeRepsChangeNew: (reps: number) => `${reps} powt. — wracasz po przerwie`,
  homeRepsBadgeUp: (pct: number) => `+${pct}% powt.`,
  homeRepsBadgeDown: (pct: number) => `−${pct}% powt.`,
  homeRepsBadgeSame: 'Bez zmian',
  homeRepsBadgeNew: 'Powrót po przerwie',
  homeActivityRepsEarlier: (previous: number) => `wcześniej ${previous} powt.`,
  homeActivitySessionsEarlier: (previous: number) => {
    const label =
      previous === 1
        ? '1 trening'
        : previous >= 2 && previous <= 4
          ? `${previous} treningi`
          : `${previous} treningów`
    return `wcześniej ${label}`
  },
  /** @deprecated Prefer homeActivityRepsEarlier — kept for any residual imports */
  homeActivityRepsCompare: (current: number, previous: number) =>
    `${current} powt. · wcześniej ${previous}`,
  homeActivitySessionsCompare: (current: number, previous: number) => {
    const label = (n: number) =>
      n === 1 ? '1 trening' : n >= 2 && n <= 4 ? `${n} treningi` : `${n} treningów`
    return `${label(current)} · wcześniej ${previous}`
  },
  homeBestStreakRecord: (n: number) =>
    n === 1 ? 'Twój rekord: 1 tydzień z treningiem' : `Twój rekord: ${n} tygodni z treningiem`,
  homeActivityInsightsAria: 'Trend aktywności',
  homeProgramsQuickTitle: 'Skrót programów',
  homeProgramsQuickHint: 'Dotknij, aby przejść do pełnej karty programu.',
  homeStatusResume: 'Dokończ rozpoczęty trening',
  homeStatusResumeStale: 'Masz niedokończony trening — sprawdź kartę poniżej',
  homeStatusResumeAndReady: 'Dokończ trening albo wybierz inny program',
  homeStatusTestReady: 'Czas na test maksymalny',
  homeStatusTestRest: (when: string) => `Test po odpoczynku — ${when}`,
  homeStatusReady: 'Możesz trenować dziś',
  homeStatusRestHeadline: 'Dziś odpoczynek',
  homeStatusRestSubtitle: (when: string) => `Następny trening: ${when}`,
  homeStatusAllPaused: 'Programy wstrzymane — wznów, gdy będziesz gotowy',
  homeStatusSetup: 'Programy czekają na konfigurację — gdy będziesz gotowy',
  homeStatusSetupMixed: 'Wznów program lub dokończ konfigurację',
  homeStatusFallback: 'Twój plan treningowy',
  homeProgramLevelDay: (level: string, day: number, total: number) =>
    level ? `Poziom ${level} · Dzień ${day} z ${total}` : `Dzień ${day} z ${total}`,
  homeCycleRestart: (n: number) => `${n}. podejście do cyklu`,
  homeTodaySession: 'Plan na dziś',
  homeCustomTodaySession: 'Dzisiejszy trening',
  homeInProgressSets: (set: number, total: number, day: number) =>
    `Seria ${set}/${total} · Dzień ${day}`,
  homeNowDay: (n: number) => `Teraz: dzień ${n}`,
  homeProgramPaused: 'Program wstrzymany',
  homeTipTestRest: (when: string, other = '') =>
    `Będzie dostępny ${when}. Dziś odpocznij${other}.`,
  homeTipTestRestOther: ' albo trenuj drugi program',
  homeCardTestRestHint: (when: string) => `Test będzie dostępny ${when}.`,
  homeTipTestReady: 'Zakończ cykl — zmierz 1RM i ustaw nowe ciężary.',
  homeTipHabitZeroFirst: 'Zacznij od karty poniżej — aplikacja poprowadzi Cię dalej.',
  homeTipHabitZero: 'Brak treningu w ostatnich 14 dniach.',
  homeTipHabitMet: '3 treningi w 14 dniach — dobry rytm.',
  homeTipReturnAfterBreak: (days: number) =>
    `${days} dni przerwy. Wróć lekkim treningiem.`,
  homeTipHabitAlmost: (remaining: number) =>
    `Zostało ${remaining} do 3 treningów w 14 dniach.`,
  homeTipDualProgram: 'Drugi program czeka na test max i poziom — zrób to, gdy będziesz gotowy.',
  homeTipDualCta: 'Skonfiguruj',
  homeTipLoginBackup:
    'Trenujesz lokalnie — zaloguj się, aby mieć kopię postępu w chmurze na innych urządzeniach.',
  homeTipShowCard: 'Pokaż kartę',
  homeTipTitleDefault: 'Wskazówka',
  homeTipTitleStale: 'Niedokończona sesja',
  homeTipTitleTestReady: 'Czas na test max',
  homeTipTitleTestRest: 'Test max wkrótce',
  homeTipTitleLevel: 'Rozważ niższy poziom',
  homeTipTitleReturnAfterBreak: 'Dawno Cię nie było',
  homeTipTitleHabitAlmost: 'Blisko celu',
  homeTipTitleDualProgram: 'Skonfiguruj drugi program',
  homeTipTitleLoginBackup: 'Backup w chmurze',
  homeTipTitleHabitZero: 'Czas wrócić',
  homeTipTitleHabitZeroFirst: 'Pierwszy trening',
  homeTipTitleHabitMet: 'Cel zaliczony',
  trainAnywayNew: 'Trenuję mimo to',
  abandonResumeTrainAnywayTitle: 'Porzucić niedokończoną sesję?',
  abandonResumeTrainAnywayBody:
    'Zaczniesz Dzień od nowa mimo przerwy. Rest odliczy się od dziś po tym treningu.',
  abandonOrTrainAnywayTitle: 'Niedokończona sesja',
  abandonOrTrainAnywayBody: 'Możesz porzucić sesję albo od razu trenować mimo przerwy.',
  abandonOnly: 'Porzuć sesję',
  abandonAndTrain: 'Porzuć i trenuj mimo to',
  forceRestRestartHint: 'Rest odliczy się od dziś po tym treningu.',
  testPendingRestLabel: (when: string) => `Test za ${when}`,
  cycleDoneTestLabel: 'Cykl ukończony — test',
  statusInProgress: 'W toku',
  continueSession: 'Kontynuuj sesję',
  resumeDespiteRestHint:
    'Masz niedokończony trening — możesz go dokończyć mimo zalecanej przerwy.',
  noProgramsTitle: 'Twój trening, Twoje zasady',
  noProgramsDesc: 'Zacznij od własnego planu — albo włącz pompki / podciąganie w profilu.',
  noProgramsCreatePlan: 'Stwórz plan',
  noProgramsGoProfile: 'Włącz program treningowy',
  goToProfile: 'Przejdź do profilu',
  rest: 'Przerwa',
  test: 'Wykonaj test',
  restart: 'Restart cyklu',
  startDay: (n: number) => `Rozpocznij Dzień ${n}`,
  continueWorkout: (day: number, set: number, total: number) =>
    `Kontynuuj Dzień ${day} — seria ${set}/${total}`,
  resumePromptTitle: 'Masz nieukończony trening',
  resumePromptBodyBuiltin: (day: number, set: number, total: number) =>
    `Dzień ${day} · seria ${set}/${total}. Wznowić?`,
  resumePromptBodyCustom: (planName: string, day: number) =>
    `${planName} · Dzień ${day}. Wznowić?`,
  resumePromptResume: 'Wznów',
  resumePromptSkip: 'Pomiń',
  restIn: (days: number) =>
    days === 0 ? 'dziś' : days === 1 ? 'jutro' : `za ${days} dni`,
  restBlocked: (when: string) => `Jeszcze za wcześnie · trening dostępny ${when}`,
  trainAnyway: 'Trenuję mimo to',
  crossTraining: 'Możesz robić pompki w dni przerwy',
  crossTrainingCta: 'Przejdź do Pompki',
  lastWorkout: 'Ostatni trening',
  nextWorkout: 'Następny',
  maxSetTrend: 'Seria max (ostatnia)',
  menuChangeLevel: 'Zmień poziom',
  menuFullCycle: 'Cały cykl',
  menuCycleMap: 'Mapa cyklu',
  menuPlanMap: 'Mapa planu',
  menuHistory: 'Historia',
  menuSkipRest: 'Pomiń odpoczynek (trenuj dziś)',
  restDaySkipped: 'Odpoczynek pominięty — możesz trenować.',
  warmupTitle: 'Rozgrzewka',
  warmupHint: 'Sugerowane serie rozgrzewkowe przed pierwszą serią roboczą.',
  warmupSetRepsWeight: (reps: number, weight: number, unit: string) => `${reps} powt. × ${weight} ${unit}`,
  warmupSetReps: (reps: number) => `${reps} powt. (lżej)`,
  warmupSetDuration: (sec: number) => `${sec} s (lżej)`,
  menuRetest: 'Wykonaj test',
  staleSession: 'Sesja sprzed ponad 24 godzin — kontynuuj lub zacznij od nowa.',
  staleSessionShort: 'Sesja sprzed 24h',
  startFresh: 'Zacznij od nowa',
  notConfigured: 'Do skonfigurowania',
  notConfiguredHint: 'Test max i poziom — gdy będziesz gotowy.',
  startSetup: 'Rozpocznij konfigurację',
  setupNextProgram: (name: string) => `Skonfiguruj ${name}`,

  // Workout
  done: 'Zrobione',
  retry: 'Spróbuj jeszcze raz',
  finishDay: 'Zakończ dzień',
  cancelWorkout: 'Anuluj trening',
  cancelWorkoutConfirm: 'Postęp tej sesji zostanie utracony. Anulować trening?',
  cancelWorkoutConfirmEmpty: 'Anulować trening bez zapisanej serii?',
  cancelWorkoutConfirmAction: 'Porzuć sesję',
  leaveWorkoutMenu: 'Wyjdź (zapisz)',
  sessionNoteLabel: 'Notatka',
  sessionNotePlaceholder: 'Jak się czułeś? Co poprawić następnym razem?',
  sessionNoteHint: 'Opcjonalnie — zapamiętaj kontekst tego treningu.',
  sessionNoteSave: 'Zapisz notatkę',
  sessionNoteEdit: 'Edytuj notatkę',
  sessionNoteEmpty: 'Brak notatki',
  sessionNoteInMenu: 'Dodaj notatkę',
  leaveWorkoutConfirm: 'Trening jest w toku. Wyjść? Postęp sesji zostanie zapisany.',
  leaveWorkoutTitle: 'Wyjść z treningu?',
  leaveWorkoutConfirmAction: 'Wyjdź i zapisz',
  lastTime: (actual: number, target: number) => `Ostatnio: ${actual}/${target}`,
  lastTimeOnly: (actual: number | string) => `Ostatnio: ${actual}`,
  setDeltaUp: (delta: number) => `+${delta} ▲`,
  setDeltaDown: (delta: number) => `−${delta} ▼`,
  setDeltaEqual: '= ▬',
  restLabel: 'Przerwa',
  nextSet: (n: number, reps: number, unit: string) =>
    `Następnie: Seria ${n} · ${reps} ${unit}`,
  nextSetWithPrevious: (n: number, reps: number, unit: string, prev: number) =>
    `Następnie: Seria ${n} · ${reps} ${unit} · Ostatnio: ${prev} ${unit}`,
  workoutHint:
    'Ustaw liczbę powtórzeń, potem naciśnij Zrobione. Cel = sukces; mniej niż cel = nieudana seria. Serie „równo N” wymagają dokładnie N.',
  workoutFailBanner: (actual: number, target: number) =>
    `Cel ${target}, zrobione ${actual} — seria nieudana`,
  workoutFailExactBanner: (actual: number, target: number) =>
    `Wymagane dokładnie ${target}, zrobione ${actual} — seria nieudana`,
  exactLiveHint: (n: number) => `Wymagane dokładnie ${n} — nie więcej, nie mniej`,
  restInProgress: 'Trwa przerwa — poczekaj lub otwórz timer.',
  skipRestConfirm: 'Pominąć przerwę i przejść do następnej serii?',
  restPresetAria: (sec: number) => `Ustaw czas odpoczynku na ${sec} sekund`,
  previewDayPlan: 'Ćwiczenia dnia',
  previewDayPlanHint: 'Dotknij ćwiczenia, żeby przejść — gdy maszyna jest zajęta.',
  previewWorkoutTitle: 'Podgląd treningu',
  previewStartWorkout: 'Rozpocznij trening',
  previewChooseDay: 'Wybierz dzień',
  previewCurrentDay: 'Bieżący',
  previewSetsLabel: 'Serie',
  previewCustomSummary: (exercises: number, sets: number) => {
    const exLabel = exercises === 1 ? '1 ćwiczenie' : `${exercises} ćwiczeń`
    const mod10 = sets % 10
    const mod100 = sets % 100
    const setsLabel =
      sets === 1
        ? '1 seria'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? `${sets} serie`
          : `${sets} serii`
    return `${exLabel} · ${setsLabel}`
  },
  previewRounds: (n: number) =>
    n === 1 ? '1 runda' : n >= 2 && n <= 4 ? `${n} rundy` : `${n} rund`,
  previewAddSet: 'Dodaj serię',
  previewRemoveSet: 'Usuń serię',
  previewEdited: 'zmieniono',
  previewChangesNote: 'Zmiany dotyczą tylko tego treningu — plan nie zostanie nadpisany.',
  restBetweenSetsLabel: 'Przerwa między seriami',
  setsShort: 'ser.',
  customWorkoutSwitchTo: (name: string) => `Przejdź do: ${name}`,
  customWorkoutSwitchExerciseMenu: 'Przejdź do ćwiczenia',
  helpTechnique: 'Wskazówki techniki',
  negativeCountdown: (sec: number) => `Przygotuj opuszczanie · ${sec}s`,
  negativeBanner: 'Opuszczaj powoli (3–5 s). Liczy się pełna kontrola ruchu.',
  restBetweenSets: (sec: number) => `Przerwa między seriami: ${sec}s`,
  setColumn: 'Seria',
  targetColumn: 'Cel',
  youColumn: 'Ty',
  editPreviousSet: 'Popraw poprzednią serię',
  editPreviousSetHint: 'Wróć do ostatniej serii, żeby zmienić liczbę powtórzeń.',
  editShort: 'Zmień',

  // Test
  testPushups: 'Test pompek',
  testPullups: 'Test podciągania',
  testPrompt: 'Ile powtórzeń zrobisz za jednym razem na pełnej amplitudzie?',
  testHonesty: 'Nie oszukuj — lepiej zacząć niżej.',
  testPullupRules:
    'Licz tylko pełne powtórzenia — broda nad drążkiem. Niepełnych nie wliczaj.',
  cantPullup: 'Nie umiem się podciągnąć',
  warmup: 'Rozgrzewka (wymagana)',
  warmupRequired: 'Zaznacz wszystkie punkty rozgrzewki przed testem.',
  warmupItemsPushups: ['Wymachy ramion', 'Skręty tułowia', '10 lekkich pompek'],
  warmupItemsPullups: ['Wymachy i krążenia barków', 'Aktywacja łopatek (scapular pull)', '10–15 s zwisu na drążku'],
  nextPickCycle: 'Dalej — wybierz cykl',
  testBlockedRest: 'Poczekaj co najmniej 2 dni przerwy przed i po teście max.',
  setupProgress: 'Postęp konfiguracji',
  setupStepTest: 'Test',
  setupStepCycle: 'Poziom',
  setupStepStart: 'Start',
  setupStepLogin: 'Konto',
  setupStepCurrent: 'aktualny krok',
  restoringSetup: 'Przywracam konfigurację…',
  lessReps: 'Mniej',
  moreReps: 'Więcej',
  back: 'Wstecz',
  next: 'Dalej',
  ok: 'OK',
  repsUnit: 'powtórzeń',
  failedShort: 'nieudana',
  passedShort: 'udana',
  incompleteShort: 'niedokończona',
  abandonedShort: 'anulowana',
  filterEmptyHistory: 'Brak sesji dla wybranych filtrów.',
  filterEmptyHistoryHint: 'Zmień filtry albo wyczyść je.',
  progressCustomHistoryEmptyHint: 'Historia pojawi się po pierwszym ukończonym treningu.',
  sessionSummaryMissingTitle: 'Brak podsumowania',
  clearFilters: 'Wyczyść filtry',
  statusReady: 'Gotowy',
  statusRest: 'Odpoczynek',
  statusTest: 'Test',
  statusRestart: 'Restart',
  statusPaused: 'Wstrzymany',
  heatmapSummary: (n: number, weeks: number) =>
    n === 1
      ? `1 trening w ostatnich ${weeks} tyg.`
      : `${n} treningów w ostatnich ${weeks} tyg.`,
  loginTitle: 'Zapisz postęp w chmurze',
  loginTitleReturning: 'Przywróć postęp z chmury',
  loginSubtitle: 'Opcjonalnie — możesz pominąć i trenować bez konta na tym urządzeniu.',
  loginSubtitleReturning:
    'Zaloguj się tym samym adresem e-mail co na innych urządzeniach — postęp i programy wrócą automatycznie.',
  loginEmailLabel: 'E-mail',
  loginEmailPlaceholder: 'jan@example.com',
  loginSendCode: 'Wyślij kod na e-mail',
  loginSendLink: 'Wyślij kod na e-mail',
  loginSent: 'Sprawdź skrzynkę — wpisz poniżej kod z wiadomości.',
  loginSentCode: 'Kod wysłany. Wpisz go poniżej, aby się zalogować.',
  loginSentTo: (email: string) => `Wysłano na adres ${email}`,
  loginOtpLabel: 'Kod z e-maila',
  loginOtpAriaGroup: 'Kod weryfikacyjny',
  loginOtpAriaDigit: (n: number) => `Cyfra ${n}`,
  loginOtpPlaceholder: '000000',
  loginOtpHint: '6-cyfrowy kod z wiadomości od SmartReps (SR@ontime.mikran.pl).',
  loginVerifyCode: 'Zaloguj się kodem',
  loginVerifying: 'Weryfikacja...',
  loginSending: 'Wysyłanie...',
  loginOtpInvalid: 'Nieprawidłowy lub wygasły kod. Sprawdź e-mail i spróbuj ponownie.',
  loginResendCode: 'Wyślij kod ponownie',
  loginResendWait: (seconds: number) => `Wyślij ponownie za ${seconds} s`,
  loginOtpRateLimited: (seconds: number) =>
    `Kod już wysłany — poczekaj ${seconds} s i spróbuj ponownie (albo sprawdź skrzynkę).`,
  loginPwaCodeHint:
    'Wpisz tutaj 6-cyfrowy kod z e-maila — tak logujesz się po dodaniu SmartReps do ekranu głównego.',
  loginBrowserLinkHint:
    'Jeśli nie widzisz wiadomości, sprawdź folder Spam / Oferty. Nadawca: SmartReps (SR@ontime.mikran.pl).',
  loginSkip: 'Pomiń — trenuję bez konta',
  loginInvalidEmail: 'Podaj poprawny adres e-mail.',
  loginPwaHint:
    'W aplikacji z ekranu głównego loguj się 6-cyfrowym kodem z e-maila.',
  loginAlreadySignedIn: 'Jesteś zalogowany jako',
  loginContinue: 'Kontynuuj',
  loginLogoutToSwitch: 'Wyloguj, aby użyć innego konta',
  loginLogoutToSwitchHint: 'Najpierw się wyloguj, a potem wyślij kod na inny adres e-mail.',
  loginLogoutToSwitchDone: 'Wylogowano. Możesz zalogować się innym kontem.',
  backToOnboarding: 'Wróć do konfiguracji',
  accountSwitchCleared:
    'Zalogowano innym kontem — dane lokalne na tym urządzeniu zostały wyczyszczone przed synchronizacją.',
  accountSwitchConfirmTitle: 'Inne konto',
  accountSwitchConfirmMessage:
    'Na tym urządzeniu są zapisane postępy innego użytkownika. Wyczyść dane lokalne, aby zsynchronizować to konto, albo anuluj i zaloguj się na właściwe konto.',
  accountSwitchClearLocal: 'Wyczyść lokalne i kontynuuj',
  accountSwitchCancel: 'Anuluj — wyloguj',
  accountSwitchWrongAccount: 'To nie moje konto',
  accountSwitchWrongAccountToast:
    'Wylogowano. Zaloguj się właściwym adresem e-mail, aby zsynchronizować swoje dane.',
  onboardingWelcome: 'Witaj w SmartReps',
  onboardingWelcomeBody:
    'Prowadzimy Cię przez gotowe cykle pompek i podciągania. Możesz też ułożyć własne plany treningowe — na siłownię, maszyny albo trening w domu — albo zaimportować gotowy z katalogu. Działa offline — logowanie e-mail OTP, bez kont Google czy Facebook.',
  onboardingNewUser: 'Zaczynam',
  onboardingHaveAccount: 'Mam już konto',
  onboardingInterestTitle: 'Co chcesz trenować?',
  onboardingInterestHint: 'Zaznacz jedną opcję albo obie.',
  onboardingInterestStrongTitle: 'Pompki i podciąganie',
  onboardingInterestStrongBody:
    'Gotowe programy: test maksymalnej liczby powtórzeń, dobór poziomu, dni treningowe i przerwy między seriami.',
  onboardingInterestCustomTitle: 'Własne plany',
  onboardingInterestCustomBody:
    'Sam układasz ćwiczenia — na siłownię, maszyny albo trening w domu.',
  onboardingPickProgram: 'Który program włączyć?',
  onboardingPickProgramHint:
    'Test maksymalnej liczby powtórzeń i wybór poziomu zrobisz później na ekranie Trening — kiedy będziesz gotowy.',
  onboardingNextTitle: 'Co dalej?',
  onboardingNextHome:
    'Wejdziesz na ekran Trening. Nic nie wymuszamy — sam wybierasz, kiedy zacząć.',
  onboardingNextStrong:
    'Program uruchomisz z karty na ekranie Trening. Przy dwóch programach zrób testy osobno i zostaw sobie przerwę między nimi. Możesz też stworzyć własny plan w zakładce Plany.',
  onboardingNextCustom:
    'Własne plany dodasz w zakładce Plany albo w sekcji na ekranie Trening.',
  onboardingEnterApp: 'Przejdź do Treningu',
  onboardingIllustStrong: 'Programy',
  onboardingIllustCustom: 'Własne',
  onboardingIllustNext: 'Trening — kiedy Ty chcesz',
  restGateHint: (days: number) =>
    days === 1 ? '1 dzień przerwy między treningami' : `${days} dni przerwy między treningami`,
  totalRepsLastSession: (n: number) => `${n} powtórzeń łącznie (ostatni trening)`,
  cycleDoneDays: (done: number, total: number) => `Cykl ukończony · ${done}/${total} dni`,
  dayOfTotal: (day: number, total: number) => `Dzień ${day}/${total}`,
  attemptLabel: (n: number) => `Próba ${n}`,
  pickLevelCta: 'Wybierz ten poziom',
  menuProgram: 'Menu programu',
  menuCustomPlan: 'Menu planu',
  menuWorkout: 'Menu treningu',
  errorSaveSet: 'Nie udało się zapisać serii. Spróbuj ponownie.',
  errorLoadProgram: 'Nie udało się wczytać programu. Spróbuj ponownie.',
  errorLoadProgress: 'Nie udało się wczytać postępów. Spróbuj ponownie.',
  errorLoadHome: 'Nie udało się wczytać ekranu głównego. Spróbuj ponownie.',
  errorLoadPlans: 'Nie udało się wczytać planów. Spróbuj ponownie.',
  errorLoadSummary: 'Nie udało się wczytać podsumowania. Spróbuj ponownie.',
  errorStartWorkout: 'Nie udało się rozpocząć treningu. Spróbuj ponownie.',
  errorFinishDay: 'Nie udało się zakończyć dnia. Spróbuj ponownie.',
  errorNoPlan: 'Nie znaleziono planu treningowego dla tego programu.',
  errorNoWorkoutData: 'Brak danych treningu. Wróć do ekranu Trening i spróbuj ponownie.',
  errorSendLink: 'Nie udało się wysłać kodu. Spróbuj ponownie.',
  errorProgramPaused: 'Ten program jest wstrzymany. Wznów go w profilu, aby trenować.',
  notFoundTitle: 'Nie znaleziono strony',
  notFoundBody: 'Ten adres nie istnieje w SmartReps. Wróć do ekranu Trening.',
  chartTestOverTime: 'Test max w czasie',
  cycleMapTitle: (name: string) => `Mapa cyklu — ${name}`,
  techniqueTitle: 'Technika — pompki na kolanach',
  techniqueStep1: 'Ustaw dłonie na szerokość barków, ciało w linii prostej od kolan do głowy.',
  techniqueStep2: 'Opuszczaj się powoli, łokcie blisko tułowia.',
  techniqueStep3: 'Wypchnij się do pozycji startowej — pełna amplituda.',
  retestSubtitle: 'Sprawdź postęp i wybierz kolejny cykl po teście.',
  howToPushup: 'Jak robić pompkę?',
  howToPullup: 'Technika podciągania',
  techniquePullupsTitle: 'Technika podciągania',
  techniquePullupsStep1:
    'Chwyt na szerokość barków, aktywne łopatki — „schowaj” je w dół przed startem.',
  techniquePullupsStep2:
    'Podciągnij się tak, by broda znalazła się nad drążkiem. Unikaj „kangurzych” ruchów.',
  techniquePullupsStep3:
    'Opuszczaj się kontrolowanie — pełna amplituda buduje siłę na kolejne powtórzenia.',
  techniquePullupsPoseHang: 'Zwis',
  techniquePullupsPoseTop: 'Góra',
  techniquePullupsPoseBottom: 'Opusz.',
  helpTechniquePullups: 'Technika podciągania',
  plansAttribution: 'SmartReps implementuje plany z 100pompek.pl i podciaganie.pl',
  noPlans: 'Brak planów treningowych.',
  dayFailedRestart: (attempt: number) =>
    `Po przerwie wrócisz do dnia 1 tego cyklu (próba ${attempt}).`,
  healthTitle: 'Zdrowie i bezpieczeństwo',
  tryAgain: 'Spróbuj ponownie',
  sessionInProgress: 'w toku',
  helpTechniquePushups: 'Technika pompek',
  retestAfterCycle: (program: string) => `Test po cyklu — ${program}`,
  mainNav: 'Główna nawigacja',
  skipToMain: 'Przejdź do treści',

  // SEO — dynamic per-route metadata
  seoDefaultDescription:
    'SmartReps — planuj i śledź treningi w domu i na siłowni. Gotowe programy pompek i podciągania oraz własne plany treningowe. Działa offline.',
  seoDashboardTitle: 'Trening',
  seoDashboardDescription:
    'Twój pulpit treningowy — następny trening, aktywność, serie i postępy. Start treningu wbudowanego lub własnego planu.',
  seoProgressTitle: 'Postępy',
  seoProgressDescription:
    'Statystyki treningowe, wykresy objętości, kalendarz aktywności, rekordy i odznaki. Śledź swoje postępy krok po kroku.',
  seoPlansTitle: 'Plany treningowe',
  seoPlansDescription:
    'Własne plany treningowe, gotowe programy pompek i podciągania, biblioteka ćwiczeń oraz katalog planów społecznościowych.',
  seoProfileTitle: 'Profil',
  seoProfileDescription:
    'Ustawienia konta, wygląd, powiadomienia, waga ciała, odznaki oraz zarządzanie danymi i synchronizacją.',
  seoPrivacyTitle: 'Polityka prywatności',
  seoPrivacyDescription:
    'Polityka prywatności SmartReps — jakie dane zbieramy, jak je chronimy i jak możesz nimi zarządzać.',
  seoTermsTitle: 'Regulamin',
  seoTermsDescription:
    'Regulamin korzystania z aplikacji SmartReps — zasady używania treningów, planów i konta użytkownika.',
  seoOnboardingTitle: 'Konfiguracja',
  seoOnboardingDescription:
    'Konfiguracja SmartReps — wybór programu treningowego, pompki, podciąganie lub własne plany.',
  seoLoginTitle: 'Logowanie',
  seoLoginDescription:
    'Zaloguj się do SmartReps kodem e-mail OTP. Bez kont Google ani Facebook.',
  seoTechniquePushupsTitle: 'Technika pompek',
  seoTechniquePushupsDescription:
    'Prawidłowa technika pompek — pozycja dłoni, łokcie, tempo i najczęstsze błędy. Poradnik dla początkujących.',
  seoTechniquePullupsTitle: 'Technika podciągania',
  seoTechniquePullupsDescription:
    'Prawidłowa technika podciągania na drążku — chwyt, łokcie, pełny zakres ruchu. Poradnik dla początkujących.',
  seoNotFoundTitle: 'Nie znaleziono strony',
  seoNotFoundDescription: 'Strona, której szukasz, nie istnieje. Wróć do SmartReps.',

  // Disclaimer
  healthDisclaimer:
    'Przed rozpoczęciem programu skonsultuj się z lekarzem, jeśli masz problemy zdrowotne, urazy stawów lub kręgosłupa.',
  healthAccept: 'Rozumiem i chcę kontynuować',

  // Cycle picker
  pickLevel: 'Wybierz swój poziom',
  levelChangeTitle: 'Zmień poziom',
  levelChangeSubtitle:
    'Wybierz inny przedział bez ponownego testu. Jeśli wolisz najpierw zmierzyć max — użyj testu poniżej.',
  levelChangeHint: 'Nowy cykl zaczyna się od dnia 1. Historia poprzednich treningów pozostaje.',
  levelChangeCurrent: 'Aktualny',
  levelChangeRestart: 'Zrestartuj od dnia 1',
  levelChangeDoTest: 'Wolę zrobić test max',
  levelChangeReady: 'Poziom zmieniony',
  levelChangeRestHint:
    'Masz jeszcze przerwę po ostatnim treningu — nowy cykl będzie dostępny po jej zakończeniu.',
  levelChangeLastTest: (reps: number, unit: string, recommended: string) =>
    `Ostatni test: ${reps} ${unit} · wg wyniku pasuje: ${recommended}`,
  recommended: 'Dla Ciebie',
  saferStart: 'Bezpieczniejszy start',
  higherLevelWarningTitle: 'Wyższy poziom',
  higherLevelWarning:
    'Twój wynik testu sugeruje niższy poziom. Zbyt wczesne przeskoczenie może prowadzić do niepowodzeń i restartów. Kontynuować?',
  backToRecommended: 'Wróć do rekomendacji',
  understandHigher: 'Rozumiem, zaczynam wyżej',
  previewPlan: 'Podgląd planu',
  previewDay1: 'Podgląd dnia 1',
  previewFullCycle: 'Zobacz pełny cykl',
  recordBestMaxSet: 'Najlepsza seria max',
  recordBestSession: 'Najwięcej powtórzeń w sesji',
  recordHighestCycle: 'Najwyższy osiągnięty cykl',
  postTestRest: 'Po teście zalecana 2-dniowa przerwa przed pierwszym treningiem nowego cyklu.',
  firstTestReadyHint: 'Po pierwszym teście możesz od razu zacząć Dzień 1 — przerwa 2 dni obowiązuje przy retestach.',
  staleSessionTitle: 'Stara sesja treningowa',
  staleSessionConfirm: 'Kontynuować przerwaną sesję sprzed ponad 24 godzin?',
  showAllCycles: 'Pokaż wszystkie poziomy',
  hideOtherCycles: 'Ukryj inne poziomy',
  moreFilters: 'Więcej filtrów',
  lessFilters: 'Mniej filtrów',
  retestTitle: 'Wynik testu — wybierz następny cykl',
  repeatCycle: 'Powtórz poprzedni cykl',
  repeatPowyzej40: 'Powtórz cykl powyżej-40',
  retestRecommend: (name: string) => `Rekomendowany: ${name}`,

  // Program start
  programReady: 'Gotowe!',
  firstTraining: 'Twój pierwszy trening:',
  startDay1: 'Rozpocznij Dzień 1',
  backToPicker: 'Wróć do wyboru poziomu',

  // Summary
  dayComplete: (n: number) => `Dzień ${n} ukończony`,
  dayFailed: 'Dzień nieudany',
  summarySectionStats: 'Wyniki',
  summarySectionSets: 'Serie',
  summarySectionNotes: 'Notatka',
  summarySectionAchievements: 'Osiągnięcia',
  // PR (Personal Record) celebration
  prCelebrationTitle: 'Nowy rekord!',
  prCelebrationSubtitle: 'Pobił(a)eś swój rekord',
  prCelebrationBestSession: 'Najwięcej powtórzeń w sesji',
  prCelebrationBestMaxSet: 'Najlepsza seria max',
  prCelebrationMaxReps: (exercise: string) => `Najwięcej powtórzeń: ${exercise}`,
  prCelebrationMaxWeight: (exercise: string) => `Największy ciężar: ${exercise}`,
  prCelebrationMaxDuration: (exercise: string) => `Najdłuższy czas: ${exercise}`,
  prCelebrationPrevious: (prev: number | string) => `Poprzedni: ${prev}`,
  prCelebrationMore: (count: number) => `+${count} więcej`,
  prCelebrationRepsUnit: 'powt.',
  prCelebrationWeightUnit: 'kg',
  prCelebrationDurationUnit: 's',
  prCelebrationDismiss: 'OK',

  // Workout celebration overlay — full-screen reward on session summary
  celebrationHeadlineDefault: 'Trening ukończony!',
  celebrationHeadlinePr: 'Nowy rekord!',
  celebrationHeadlineAchievement: 'Osiągnięcie odblokowane!',
  celebrationSubtitle: 'Świetna robota — tak trzymaj!',
  celebrationPrBadge: 'Nowy rekord osobisty',
  celebrationAchievementBadge: 'Nowe osiągnięcie',
  celebrationTapToContinue: 'Dotknij, aby kontynuować',
  celebrationShare: 'Udostępnij',
  celebrationDayContext: (day: number, total: number) => `Dzień ${day} z ${total}`,
  celebrationStatReps: 'powtórzenia',
  celebrationStatSets: 'serie',
  celebrationStatExercises: 'ćwiczenia',
  celebrationStatDuration: 'minuty',
  celebrationStatVolume: 'objętość',

  summaryHeroSuccess: 'Trening zaliczony',
  summaryHeroFail: 'Spróbuj ponownie',
  cycleComplete: 'Cykl ukończony!',
  cycleCompleteHint: 'Po przerwie wykonaj test max, aby wybrać kolejny poziom.',
  goalAchieved: 'Cel osiągnięty!',
  totalReps: 'Łącznie',
  nextWorkoutIn: (days: number) =>
    days <= 0
      ? 'Następny trening: dziś'
      : days === 1
        ? 'Następny trening: jutro'
        : `Następny trening: za ${days} dni`,
  backHome: 'Wróć do SmartReps',
  continueSetup: 'Kontynuuj konfigurację',
  techniqueContinueTest: 'Rozumiem — kontynuuj test',
  techniqueContinueWorkout: 'Rozumiem — wróć do treningu',
  retestNow: 'Wykonaj test max',
  login: 'Zaloguj się',
  addProgram: 'Dodaj program',
  addProgramPushups: 'Dodaj pompki',
  addProgramPullups: 'Dodaj podciąganie',
  changeLevelActiveWarning:
    'Masz niedokończoną sesję treningu. Zmiana poziomu usunie tę sesję. Kontynuować?',
  prevColumn: 'Poprz.',

  // Units
  pushups: 'pompek',
  pullups: 'podciągnięć',
  negatives: 'opuszczeń',
  pushupsProgram: 'Pompki',
  pullupsProgram: 'Podciąganie',

  dayLabel: (n: number) => `Dzień ${n}`,
  dayDoneCheck: (n: number) => `Dzień ${n} ✓`,
  testResultSubtitle: (reps: number, unit: string) => `Test: ${reps} ${unit}`,
  programReadySubtitle: (program: string, cycle: string) => `${program} · Cykl ${cycle}`,
  restSecAndSets: (sec: number) => `Przerwa: ${sec}s · Serie:`,
  attemptShort: (n: number) => `Próba ${n}`,
  cycleNotConfigured: 'Skonfiguruj program, aby zobaczyć mapę cyklu',
  configureProgram: 'Skonfiguruj program',
  missingSession: 'Brak danych sesji — wróć do ekranu Trening',
  workoutHeader: (program: string, day: number, set: number, total: number) =>
    `${program} · Dzień ${day} · Seria ${set}/${total}`,
  workoutElapsedAria: (time: string) => `Czas treningu ${time}`,
  workoutDuration: 'Czas treningu',
  customWorkoutSetTimeSec: 'Czas ćwiczeń',
  customSessionDurationTotalHint: 'Suma czasu z serii (np. plank)',

  // Empty
  firstWorkout: 'Twój pierwszy trening czeka',
  startFirstWorkout: 'Rozpocznij trening',

  // Offline
  offline: 'Brak sieci · zapiszesz po połączeniu',

  // Timer
  skipRest: 'Pomiń',
  add15s: '+15s',
  add30s: '+30s',
  collapseTimer: 'Zwiń',

  // Progress
  recordTest: 'Rekord testu',
  cycleDays: 'Dni ukończone',
  sessionsTotal: 'Sesje',
  totalRepsLabel: 'Powtórzenia łącznie',
  streakWeeks: 'Tygodnie z rzędu',
  streakWeeksHint: 'obecna seria',
  // Streak heatmap (GitHub-style contribution graph)
  streakHeatmapTitle: 'Seria treningowa',
  streakHeatmapHint: 'Ostatnie 12 tyg. — każdy kwadracik to 1 tydzień',
  streakHeatmapWeekLabel: (weekStart: string) => `Tydzień ${weekStart}`,
  streakHeatmapCellAria: (sessions: number, reps: number, weekStart: string) =>
    `Tydzień ${weekStart}: ${sessions} treningów, ${reps} powtórzeń`,
  streakHeatmapCurrentWeek: 'Obecny tydzień',
  streakHeatmapLegendNone: 'Brak',
  streakHeatmapLegendLow: '1–3',
  streakHeatmapLegendMid: '4–6',
  streakHeatmapLegendHigh: '7+',
  streakHeatmapWeeksStreak: (weeks: number) => `${weeks} tyg. z rzędu`,
  streakHeatmapMiniAria: (weeks: number) => `Mapa serii treningowej, ${weeks} tygodni z rzędu`,
  streakHeatmapEmpty: 'Brak treningów w ostatnich 12 tyg.',
  // Muscle group balance heatmap
  muscleBalanceTitle: 'Balans mięśniowy',
  muscleBalanceHint: 'Serie tygodniowo w ostatnich 4 tyg.',
  muscleBalanceOptimal: 'Optymalna',
  muscleBalanceLow: 'Niska',
  muscleBalanceMinimal: 'Minimalna',
  muscleBalanceNone: 'Brak',
  muscleBalanceWeeklySets: (sets: number) => `${sets} serii/tyg.`,
  muscleBalanceWarning: 'Niektóre grupy mięśniowe są niedotrenowane — zadbaj o zrównoważony plan.',
  muscleBalanceAria: 'Mapa balansu grup mięśniowych',
  muscleBalanceNoData: 'Brak treningów w ostatnich 4 tyg. — wykonaj sesję, aby zobaczyć balans.',
  tabOverview: 'Przegląd',
  tabHistory: 'Historia',
  tabCycle: 'Cykl',
  progressSectionNav: 'Sekcja postępów',
  achievementsStatusCount: (n: number, total: number) => `${n} z ${total}`,
  // Unified Progress — new keys
  progressSourceAll: 'Wszystkie',
  progressSourceBuiltin: 'Programy',
  progressSourceCustom: 'Własne',
  progressRecordsPrograms: 'Programy wbudowane',
  progressRecordsExercises: 'Własne ćwiczenia',
  exportAll: 'Eksport CSV',
  maxSetPerDay: 'Seria max (ostatnia) na dzień',
  sessionDetails: 'Szczegóły sesji',
  filterAll: 'Wszystkie',
  filterPassed: 'Udane',
  filterFailed: 'Nieudane',
  filterCycleAll: 'Wszystkie cykle',
  filterCycleCurrent: 'Bieżący cykl',
  filterDateAll: 'Cała historia',
  filterDate30: '30 dni',
  filterDate90: '90 dni',
  newRecord: 'Rekord!',
  activityHeatmap: 'Aktywność (12 tyg.)',
  exportCsv: 'Eksport CSV',
  exportThisProgram: 'Eksport CSV tego programu',
  exportAllPrograms: 'Eksport CSV wszystkich programów',
  exportJsonBackup: 'Eksport backupu (JSON)',
  exportBackupJson: 'Eksport backupu (JSON)',
  importBackup: 'Importuj backup',
  importBackupTitle: 'Import backupu',
  importBackupHint: 'Wybierz plik CSV (sesje) lub JSON (pełny backup). Duplikaty można pominąć lub nadpisać.',
  importChooseFile: 'Wybierz plik',
  importMergeSkipDuplicates: 'Importuj (pomiń duplikaty)',
  importReplaceDuplicates: 'Nadpisz duplikaty',
  importReplaceConfirmTitle: 'Nadpisać istniejące dane?',
  importReplaceConfirmBody:
    'Istniejące sesje lub nowszy postęp lokalny mogą zostać zastąpione danymi z pliku. Tej operacji nie da się cofnąć.',
  importFileTooLarge: 'Plik jest za duży (max 5 MB).',
  importInvalidFile: 'Nie rozpoznano formatu backupu.',
  importSuccess: 'Backup zaimportowany.',
  importCsvDuplicatesHint: 'Duplikaty (ten sam identyfikator sesji) zostaną pominięte.',
  importProgressConflictHint: 'Postęp programów zostanie scalony — nowszy wpis wygrywa.',
  importProgressConflictTitle: 'Scal postęp programów?',
  importActiveWorkoutSkipped:
    'Trwający trening lokalnie — stan aktywnego treningu z pliku zostanie pominięty.',
  importActiveWorkoutConfirmTitle: 'Przerwać bieżący trening?',
  importActiveWorkoutConfirmBody:
    'Na urządzeniu trwa trening. Import zastąpi go stanem z pliku backupu. Tej operacji nie da się cofnąć.',
  importCsv: 'Importuj sesje (CSV)',
  importJson: 'Przywróć z JSON',
  importConfirmTitle: 'Potwierdź import',
  importConfirm: 'Importuj',
  importCsvPreview: (add: number, skip: number) =>
    `Dodamy ${add} sesji${skip ? `, pominę ${skip} duplikatów` : ''}.`,
  importJsonPreview: (sessions: number, skipped: number, progress: number, tests: number) =>
    `Nowe sesje: ${sessions}, pominięte: ${skipped}, aktualizacje postępu: ${progress}, testy: ${tests}.`,
  importJsonCustomPreview: (plans: number, exercises: number, customProgress: number) =>
    `Plany: ${plans}, ćwiczenia: ${exercises}, postęp planów: ${customProgress}.`,
  progressCustomPrEmpty: 'Brak rekordów — ukończ trening własnym planem.',
  planImportJson: 'Importuj plan JSON',
  planImportDone: 'Plan zaimportowany jako szkic.',
  planPause: 'Wstrzymaj plan',
  planResume: 'Wznów plan',
  planPaused: 'Wstrzymany',
  planEditBlockedActive: 'Zakończ lub anuluj trwający trening tego planu przed edycją.',
  customSummaryBackToPlan: 'Wróć do planu',
  customSummaryViewProgress: 'Zobacz postępy',
  customSummaryRecSuccess: 'Zrób zaplanowaną przerwę — wróć, gdy będziesz gotowy.',
  customSummaryBelowTarget:
    'W niektórych seriach zrobiono mniej niż w planie — to w porządku.',
  /** @deprecated Custom days no longer fail; kept for residual imports */
  customSummaryRecFail: 'Trening zapisany — wróć, gdy będziesz gotowy.',
  /** @deprecated */
  customSummaryFailPolicy: '',
  customFailEndLabel: 'Zapisz i kontynuuj',
  customFailBannerHint: 'Poniżej celu — możesz poprawić albo zapisać wynik i iść dalej.',
  customWorkoutAddSet: 'Dodaj serię',
  customWorkoutRemoveSet: 'Usuń serię',
  customWorkoutSetsCount: (n: number) => `${n}`,
  customWorkoutSetsAdjustHint: 'Tylko ten trening — zapis w planie na końcu.',
  customWorkoutSetExtraBadge: 'dodana',
  customWorkoutAddSetHint: 'Tylko na ten trening — na końcu zdecydujesz, czy zapisać w planie.',
  customWorkoutRestAdjustLabel: 'Przerwa między seriami',
  customSummaryUpdatePlanTitle: 'Zaktualizować plan?',
  customSummaryUpdatePlanBody:
    'Zmiany z tego treningu możesz zapisać w planie albo odrzucić.',
  customSummaryUpdatePlanSets: (name: string, from: number, to: number) =>
    `${name}: serie ${from} → ${to}`,
  customSummaryUpdatePlanRest: (name: string, from: number, to: number) =>
    `${name}: przerwa ${from}s → ${to}s`,
  customSummaryUpdatePlanSwap: (from: string, to: string) =>
    `Ćwiczenie: ${from} → ${to}`,
  customSummaryUpdatePlanAdded: (name: string) =>
    `Dodano ćwiczenie: ${name}`,
  customSummaryUpdatePlanValues: (name: string, summary: string) =>
    `${name}: ${summary}`,
  customSummaryValueSet: (setNumber: number, detail: string) =>
    `S${setNumber}: ${detail}`,
  customSummaryValueReps: (from: number, to: number) =>
    `${from} → ${to} powt.`,
  customSummaryValueWeight: (from: number, to: number) =>
    `${from} → ${to} kg`,
  customSummaryValueDuration: (from: number, to: number) =>
    `${from}s → ${to}s`,
  customSummaryUpdatePlanTargetsNote:
    'Cele serii zostaną ustawione według wyników z tego treningu.',
  customSummaryUpdatePlanConfirm: 'Zapisz w planie',
  customSummaryUpdatePlanDiscard: 'Nie zmieniaj planu',
  customSummaryUpdatePlanGroupValues: 'Wartości serii (reps, ciężar, przerwy)',
  customSummaryUpdatePlanGroupValuesHint: 'Zaktualizuj cele według wyników z tego treningu',
  customSummaryUpdatePlanGroupExercises: 'Zmiany ćwiczeń (dodane, zamienione)',
  customSummaryUpdatePlanGroupExercisesHint: 'Zachowaj zmiany ćwiczeń w planie na stałe',
  customSummaryUpdatePlanSaveSelected: 'Zapisz zaznaczone',
  customSummaryUpdatePlanSaveAll: 'Zapisz wszystko',
  customSummaryUpdatePlanDone: 'Plan zaktualizowany.',
  customSummaryUpdatePlanFailed: 'Nie udało się zapisać zmian w planie.',
  customWorkoutProblemTitle: 'Nie można rozpocząć treningu',
  missingSessionHint: 'Sesja wygasła lub nie istała na tym urządzeniu.',
  customHomeEmptyTitle: 'Brak planów na starcie',
  customHomeEmptyCta: 'Włącz plany w profilu',
  customProgressionAppliedTitle: 'Nowe cele na kolejny cykl',
  customProgressionAppliedHint: 'Progresja zaktualizowała serie w planie.',
  customProgressionDiffLine: (day: number, exerciseName: string, before: string, after: string) =>
    `${exerciseName} · ${pl.planDayLabel(day)}: ${before} → ${after}`,
  customProgressionDiffMore: (n: number) =>
    n === 1 ? '… i 1 zmiana więcej' : `… i ${n} zmian więcej`,
  customShareStatLine: (exercises: number, sets: number) =>
    `${exercises} ćw. · ${sets} serii`,
  shareCardPrCount: (n: number) => (n === 1 ? '1 rekord PR' : `${n} rekordy PR`),
  shareCardStreak: (n: number) => (n === 1 ? '1 dzień z rzędu' : `${n} dni z rzędu`),
  shareCardVolume: (kg: number) => `Tonaż: ${kg} kg`,
  shareCardBestSet: (reps: number) => `Najlepsza seria: ${reps}`,
  customPreviousRepsWeight: (reps: number, kg: number) => `Wcześniej: ${reps} × ${kg} kg`,
  customPreviousLabel: 'Ostatnio',
  customPreviousFromDay: (day: number) => `D${day}`,
  customPreviousFromAttempt: (attempt: number) => `Próba ${attempt}`,
  customPreviousRepsValue: (reps: number) => `${reps} powt.`,
  customPreviousRepsWeightValue: (reps: number, kg: number) => `${reps} × ${kg} kg`,
  customPreviousDuration: (sec: number) => `${sec} s`,
  customPreviousAria: (context: string | null, value: string) =>
    context ? `Ostatnio ${context}: ${value}` : `Ostatnio: ${value}`,
  customMinDurationHint: (sec: number) => `Minimum ${sec} s — dłużej też OK`,
  customMinRepsHint: (reps: number) => `Minimum ${reps} — więcej też OK`,
  customWorkoutEditPlan: 'Edytuj plan',
  customWorkoutSkipExercise: 'Pomiń ćwiczenie',
  customWorkoutSkipExerciseHint: 'Tylko na ten trening — plan w Plany pozostaje bez zmian.',
  customWorkoutReplaceExercise: 'Zastąp ćwiczenie',
  customWorkoutReplaceExerciseHint: 'Wybierz ćwiczenie z biblioteki — plan zostanie zaktualizowany.',
  customWorkoutSwapExercise: 'Zamień na inne ćwiczenie',
  customWorkoutSwapExerciseHint: 'Wybierz ćwiczenie z biblioteki. Plan pozostaje bez zmian — decyzję podejmiesz na koniec treningu.',
  customWorkoutAddExercise: 'Dodaj ćwiczenie',
  customWorkoutAddExerciseHint: 'Dodaj ćwiczenie na koniec treningu. Tylko na tę sesję — o zapisie do planu zdecydujesz po treningu.',
  customWorkoutSwapConfirmTitle: 'Zamienić ćwiczenie?',
  customWorkoutSwapConfirmBody: (name: string) =>
    `Masz zalogowane serie dla „${name}”. Zamiana wyzeruje te logi.`,
  customWorkoutSwapConfirmAction: 'Zamień i wyzeruj',
  customEditBlockedActiveDay: 'Ten dzień jest w trakcie treningu — edytuj inne dni.',
  customHomeMorePlans: (n: number) =>
    n === 1 ? '+1 plan więcej w Plany' : `+${n} plany więcej w Plany`,
  customHomePinPrompt: 'W Profilu możesz wybrać, które plany widzisz na ekranie głównym.',
  customHomeEmptyHint: 'Włącz plany w Profilu → Aktywne plany.',
  customLastWorkoutInsight: (planName: string, when: string) =>
    `Ostatni własny trening: ${planName} · ${when}`,
  customCycleRailTitle: 'Mapa cyklu',
  customCycleDayPassed: 'Ukończony',
  customCycleDayFailed: 'Niezaliczony',
  customCycleDayCurrent: 'Bieżący',
  customCycleDayUpcoming: 'Zaplanowany',
  customCycleDayRest: 'Przerwa',
  customExerciseNoteLabel: 'Notatka (opcjonalnie)',
  customExerciseNotePlaceholder: 'Krótka wskazówka na trening…',
  customTargetKindFixed: 'Stały cel',
  customTargetKindMin: 'Minimum',
  customTargetKindMax: 'Max',
  customTargetKindExact: 'Dokładnie',
  customTargetKindFixedShort: 'Stały',
  customTargetKindMinShort: 'Min.',
  customTargetKindMaxShort: 'Max',
  customTargetKindExactShort: 'Dokł.',
  customSetEditorTitle: (n: number) => `Seria ${n}`,
  customSetRepsLabel: 'Powtórzenia',
  customHistoryFilterPlan: 'Plan',
  customHistoryFilterResult: 'Wynik',
  customHistoryFilterDay: 'Dzień',
  customHistoryEmptyFiltered: 'Brak sesji dla wybranych filtrów.',
  progressionAfterCycle: 'Po ukończeniu cyklu',
  importInProgress: 'Importuję…',
  importTooLarge: 'Plik jest za duży (max 5 MB).',
  importInvalid: 'Nie rozpoznano formatu backupu.',
  importFailed: 'Import nieudany — sprawdź plik i spróbuj ponownie.',
  importDone: (n: number) =>
    n === 1 ? 'Zaimportowano 1 sesję.' : `Zaimportowano ${n} sesji.`,
  deleteAccount: 'Usuń konto w chmurze',
  deleteAccountHint:
    'Trwale usuwa konto, postęp i dane synchronizacji z serwera SmartReps. Tej operacji nie da się cofnąć.',
  deleteAccountWarning:
    'Zalecamy wcześniej pobrać backup JSON. Lokalne dane na telefonie zostaną wyczyszczone po sukcesie.',
  deleteAccountConfirmWord: 'USUŃ',
  deleteAccountTypeConfirm: (word: string) => `Wpisz ${word}, aby potwierdzić`,
  deleteAccountConfirm: 'Usuń konto na zawsze',
  deleteAccountInProgress: 'Usuwanie konta…',
  deleteAccountDone: 'Konto w chmurze zostało usunięte.',
  deleteAccountFailed: 'Nie udało się usunąć konta. Spróbuj ponownie lub napisz przez GitHub.',
  deleteAccountSessionExpired: 'Sesja wygasła — zaloguj się ponownie, aby usunąć konto.',
  summaryShare: 'Udostępnij wynik',
  summaryShareDone: 'Karta wyniku gotowa do udostępnienia.',
  summaryShareFailed: 'Nie udało się utworzyć karty wyniku.',
  shareCardAlt: 'Karta wyniku SmartReps',
  pwaUpdateTitle: 'Nowa wersja SmartReps',
  pwaUpdateBody: 'Dostępna jest aktualizacja aplikacji. Odśwież, aby wczytać najnowsze zmiany.',
  pwaUpdateReload: 'Odśwież teraz',
  pwaUpdateLater: 'Później',
  progressTabHistoryHint: 'Lista treningów — dotknij wpis, aby zobaczyć serie.',
  progressHistorySectionTitle: 'Historia treningów',
  progressSummaryTitle: 'Podsumowanie',
  range14d: '14 dni',
  range30d: '30 dni',
  range90d: '90 dni',
  rangeYear: 'Rok',
  rangeSessions: 'Sesje',
  rangeTotalReps: 'Powtórzenia',
  rangeDaysLabel: (days: number) => days >= 365 ? 'ostatni rok' : `ostatnie ${days} dni`,
  bodyWeightTitle: 'Waga ciała',
  bodyWeightEmpty: 'Brak wpisów. Dodaj pierwszy pomiar.',
  bodyWeightAddMoreForTrend: 'Dodaj kolejny pomiar, aby zobaczyć trend.',
  bodyWeightAdd: 'Dodaj pomiar',
  bodyWeightAddTitle: 'Nowy pomiar wagi',
  bodyWeightLabel: 'Waga',
  bodyWeightNotePlaceholder: 'Opcjonalna notatka',
  bodyWeightSave: 'Zapisz',
  bodyWeightSaved: 'Pomiar zapisany.',
  bodyWeightInvalid: 'Podaj prawidłową wagę.',
  bodyWeightOutOfRange: 'Waga musi być w zakresie 20–300 kg.',
  bodyWeightDelete: 'Usuń pomiar',
  muscleGroup_chest: 'Klatka',
  muscleGroup_back: 'Plecy',
  muscleGroup_shoulders: 'Barki',
  muscleGroup_arms: 'Ramiona',
  muscleGroup_legs: 'Nogi',
  muscleGroup_core: 'Core',
  muscleGroup_full_body: 'Całe ciało',
  muscleGroup_cardio: 'Cardio',
  muscleGroup_other: 'Inne',
  exerciseMuscleGroup: 'Grupa mięśniowa',
  exerciseMuscleGroupHint: 'Pomaga sugerować podobne ćwiczenia przy zamianie.',
  exerciseSwapSuggestions: 'Sugerowane zamiany',
  exerciseSwapSuggestionsHint: 'Ćwiczenia z tej samej grupy mięśniowej.',
  progressRecordTestHint: 'test max',
  progressCycleDaysHint: 'w cyklu',
  progressSessionsHint: 'sesje',
  progressActivityAria: 'Trend 14 dni w programie',
  progressWeekdayLabels: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'],
  progressLastSetTrend: (current: number, previous: number) =>
    `Ostatnia seria max (ten sam dzień): ${current} · wcześniej ${previous}`,
  progressOpenFullSummary: 'Pełne podsumowanie',
  progressCustomSessions14d: 'Treningi 14d',
  progressCustomExercisesTrained: 'Ćwiczenia',
  progressCustomVolumeTotal: 'Objętość',
  progressCustomVolumePerSession: 'Objętość/sesja',
  progressCustomStatsTitle: 'Plany własne',
  progressCustomStatsHint: 'Wszystkie plany',
  progressProgramSwitcher: 'Wybór programu',
  progressRangeLabel: 'Zakres czasu',
  progressCustomActivePlans: 'Plany',
  progressCustomRecordsTitle: 'Rekordy',
  progressCustomRecordsHint: 'Tapnij ćwiczenie, żeby zobaczyć szczegóły.',
  progressCustomPlanEmpty: 'Brak aktywnego planu',
  progressCustomPlanEmptyHint: 'Stwórz plan, aby zobaczyć mapę dni i postęp.',
  progressCustomPlanDayProgress: (current: number, total: number) =>
    `Dzień ${current} z ${total}`,
  progressCustomOpenPlan: 'Lista planów',
  progressCustomPlanMapTitle: 'Mapa dni',
  progressCustomPlanMapHint: 'Kolor = status. Liczba pod dniem = ćwiczenia. Tapnij dzień.',
  progressCustomDayExercises: (n: number) => (n === 1 ? '1 ćw.' : `${n} ćw.`),
  progressCustomDaySets: (n: number) => (n === 1 ? '1 seria' : `${n} serii`),
  progressCustomDayEmpty: 'Ten dzień nie ma jeszcze ćwiczeń.',
  progressCustomSeeDayHistory: 'Historia tego dnia',
  progressCustomExerciseFallback: 'Ćwiczenie',
  progressTestChartHint: 'Ostatnie testy maksymalne',
  progressHeatmapHint: 'Zielony = udany trening, czerwony = nieudany dzień',
  progressHeatmapEmpty: 'Mapa wypełni się po pierwszych treningach.',
  progressEmptyTitle: 'Na start',
  progressEmptyHint: 'Po pierwszym treningu zobaczysz tu wykresy i mapę aktywności.',
  progressRecordsSectionTitle: 'Rekordy',
  progressHistoryCount: (n: number) =>
    n === 1 ? '1 sesja' : n >= 2 && n <= 4 ? `${n} sesje` : `${n} sesji`,
  progressSetCount: (n: number) =>
    n === 1 ? '1 seria' : n >= 2 && n <= 4 ? `${n} serie` : `${n} serii`,
  progressLoadMore: (n: number) =>
    n === 1 ? 'Pokaż jeszcze 1' : n >= 2 && n <= 4 ? `Pokaż jeszcze ${n}` : `Pokaż jeszcze ${n}`,
  progressFilterResult: 'Wynik',
  progressFilterCycle: 'Cykl',
  progressFilterDate: 'Okres',
  progressFiltersApply: 'Gotowe',
  progressCycleProgress: (done: number, total: number) =>
    total > 0 ? `Ukończono ${done} z ${total} dni w cyklu` : '',
  progressRecordsEmpty: 'Po treningach i teście max pojawią się tu rekordy.',
  progressRecordDate: (date: string) => `z ${date}`,
  progressVolumeTitle: 'Objętość i częstotliwość',
  progressVolume14d: 'Objętość 14 dni',
  progressVolumePrev14d: 'Poprzednie 14 dni',
  progressVolumeTrendUp: (pct: number) => `+${pct}% vs poprzednie 14 dni`,
  progressVolumeTrendDown: (pct: number) => `−${pct}% vs poprzednie 14 dni`,
  progressVolumeTrendFlat: 'Stabilnie vs poprzednie 14 dni',
  progressAvgPerSession: 'Śr. na sesję',
  progressAvgSessionsPerWeek: 'Śr. na tydzień',
  progressSessions30d: 'Treningi 30 dni',
  progressSessionChartTitle: 'Najlepsza seria w treningu',
  progressSessionChartHint: 'Ostatnia seria max w każdej ukończonej sesji',
  progressSessionChartTooltip: 'Seria max',
  progressSessionChartAria: (count: number) => `Wykres najlepszej serii, ${count} punktów`,
  // Weekly volume chart (replaces max-set chart in overview)
  progressWeeklyVolumeTitle: 'Objętość tygodniowa',
  progressWeeklyVolumeHint: 'Całkowita objętość (powt. × serie) w ostatnich 12 tyg.',
  progressWeeklyVolumeAxisLabel: 'Objętość',
  progressWeeklyVolumeAria: (count: number) => `Wykres objętości tygodniowej, ${count} tyg.`,
  progressWeeklyVolumeTooltip: 'Objętość',
  progressWeeklyVolumeEmpty: 'Brak ukończonych treningów w tym okresie.',
  progressTestChartAria: (count: number) => `Wykres testów maksymalnych, ${count} punktów`,
  progressMaxSetChartAria: (count: number) => `Wykres najlepszej serii na dzień, ${count} dni`,
  progressCustomVolumeChartAria: (count: number) => `Wykres objętości na sesję, ${count} punktów`,
  bodyWeightChartAria: (count: number, latest: number | string, unit: string) =>
    `Wykres wagi ciała, ${count} pomiarów, ostatni: ${latest} ${unit}`,
  // Body weight × performance correlation
  bodyWeightCorrelationTitle: 'Waga vs siła',
  bodyWeightCorrelationHint: 'Korelacja zmian wagi z wynikami treningowymi',
  bodyWeightCorrelationPositive: (r: number) => `Przyrost wagi koreluje ze wzrostem siły (r=${r})`,
  bodyWeightCorrelationNegative: (r: number) => `Spadek wagi koreluje ze spadkiem siły (r=${r})`,
  bodyWeightCorrelationNeutral: (r: number) => `Brak wyraźnej korelacji (r=${r})`,
  bodyWeightCorrelationInsufficientData: 'Dodaj min. 3 pomiary wagi i wykonaj 3 treningi, aby zobaczyć korelację.',
  bodyWeightCorrelationChartAria: (count: number) => `Wykres korelacji wagi i siły, ${count} punktów`,
  bodyWeightAxisLabel: 'Waga',
  performanceAxisLabel: 'Siła',
  exerciseDetailChartAria: (count: number, name: string) => `Wykres postępu ćwiczenia ${name}, ${count} punktów`,
  exerciseDetailLoadChartAria: (count: number, name: string) => `Wykres obciążenia ćwiczenia ${name}, ${count} punktów`,
  dateColumn: 'Data',
  dayLabelShort: 'Dzień',
  progressCycleTrendTitle: 'Trend w cyklu',
  progressCycleTrendHint: 'Ostatnia seria max: obecna vs poprzednia próba cyklu',
  progressCycleTrendCurrent: 'Obecna',
  progressCycleTrendPrevious: 'Poprzednia',
  progressCycleTrendDelta: (d: number) => (d > 0 ? `+${d}` : String(d)),
  progressCycleTrendNoPrevious: 'Brak poprzedniej próby cyklu',
  progressCustomVolumeTitle: 'Objętość własna 14 dni',
  progressCustomVolumeHint: 'Suma powtórzeń i obciążenia we własnych planach',
  progressCustomTotalReps14d: 'Powtórzenia 14 dni',
  progressCustomTotalVolume14d: 'Obciążenie 14 dni',
  progressCustomAvgPerSession: 'Śr. na sesję',
  progressCustomSessions30d: 'Treningi 30 dni',
  progressSessionNoSets: 'Brak zapisanych serii w tej sesji.',
  progressStatusEmpty: 'Brak sesji — czas na pierwszy trening.',
  progressStatusStreak: (n: number) =>
    n === 1 ? 'Seria: 1 tydzień z treningiem.' : `Seria: ${n} tyg. z treningiem.`,
  progressStatusSessions: (n: number) =>
    n === 1 ? '1 ukończona sesja w tym programie.' : `${n} ukończonych sesji w tym programie.`,
  progressFilters: 'Filtry',
  progressFullCyclePlan: 'Pełny plan cyklu',
  progressChartEmpty: 'Wykres pojawi się po pierwszym teście max.',
  toastExportDone: 'Historia została wyeksportowana do pliku CSV',
  toastSyncDone: 'Zsynchronizowano — postęp bezpieczny w chmurze',
  toastSyncFailed: 'Synchronizacja nieudana — sprawdź połączenie i spróbuj ponownie.',
  continueToLogin: 'Kontynuuj — zapisz postęp',
  testPendingBlocked: 'Cykl ukończony — wykonaj test max, aby wybrać kolejny poziom.',
  totalRepsDelta: (n: number) => `${n > 0 ? '+' : ''}${n} względem poprzedniej sesji`,

  // Plans — resistance bands
  plansMinePageHint: 'Własne plany treningowe — edycja i start.',
  plansLibraryPageHint: 'Ćwiczenia do użycia w planach.',
  plansProgramsPageHint: 'Programy pompki i podciąganie — rozwiń cykl, aby zobaczyć cele.',
  plansProgramHint: 'Rozwiń cykl, aby zobaczyć cele serii w kolejnych dniach.',
  plansTabAriaLabel: 'Zakładki planów',
  plansYourCycle: 'Twój cykl',
  plansDayCount: (n: number) => (n === 1 ? '1 dzień' : `${n} dni`),
  plansPeakDay: (day: number, reps: number) => `szczyt D${day} · ~${reps} powt.`,
  plansDayReps: (sets: number, total: number) =>
    sets === 1 ? `1 seria · ~${total}` : `${sets} serie · ~${total}`,
  cycleDayStatusCompleted: 'ukończony',
  cycleDayStatusCurrent: 'bieżący',
  cycleDayStatusFuture: 'nadchodzący',
  resistanceBandsTitle: 'Gumy oporowe (podciąganie)',
  resistanceBandsIntro:
    'Jeśli nie podciągasz się jeszcze samodzielnie, możesz zacząć od wariantu z gumą — tak sugeruje program podciąganie.pl.',
  resistanceBandsTip1: 'Zacznij od grubszej gumy i stopniowo przechodź na cieńszą.',
  resistanceBandsTip2: 'Ustaw stopę/kolano w gumie tak, by wspomagała ruch w górę, ale nie robiła za Ciebie całej pracy.',
  resistanceBandsTip3: 'Licz tylko pełne powtórzenia — broda nad drążkiem, kontrolowane opuszczanie.',
  resistanceBandsNote:
    'SmartReps śledzi cykle z podciaganie.pl. Wariant z gumą traktuj jako trening techniczny uzupełniający.',

  // Profile
  appearance: 'Wygląd',
  themeSystem: 'System',
  themeDark: 'Ciemny',
  themeLight: 'Jasny',
  highContrast: 'Wysoki kontrast',
  trainingSettings: 'Ustawienia treningu',
  weightUnitLabel: 'Jednostka wagi',
  weightUnitKg: 'kg',
  weightUnitLb: 'lb',
  languageLabel: 'Język',
  languagePl: 'Polski',
  languageEn: 'Angielski',
  remindersSection: 'Przypomnienia',
  profileDangerZone: 'Niebezpieczne',
  profileUnconfiguredHint: 'Jeszcze bez poziomu — skonfigurujesz na ekranie Trening.',
  profileSetupOnTraining: 'Skonfiguruj na Treningu',
  profileProgramsEmpty: 'Brak włączonych programów treningowych.',
  profileCustomPlansSubhead: 'Własne plany',
  profileCustomOnTraining: 'Widoczny na ekranie Trening',
  timerSound: 'Dźwięki treningu',
  timerSoundHint: 'Seria, przerwa, odliczanie 3-2-1, AMRAP i cel czasu',
  timerVibration: 'Wibracja',
  timerVibrationHint: 'Potwierdzenia serii, przerwy i odliczania',
  keepScreenOn: 'Nie gaś ekranu podczas treningu',
  keepScreenOnHint: 'Ekran nie gaśnie podczas treningu (najlepiej w zainstalowanej PWA).',
  workoutReminders: 'Przypomnienie przy otwartej aplikacji',
  workoutRemindersHint: 'Działa tylko przy otwartej aplikacji (gdy push jest wyłączony).',
  workoutRemindersDenied:
    'Powiadomienia są zablokowane w ustawieniach systemu / przeglądarki. Włącz je, aby korzystać z przypomnień.',
  pushNotifications: 'Powiadomienia push',
  pushNotificationsHint:
    'Przypomnienie w wybranej godzinie w dniu, gdy trening jest dostępny (po odpoczynku). Wymaga PWA i konta.',
  pushNeedsLogin: 'Zaloguj się, aby włączyć powiadomienia push.',
  pushUnavailable: 'Push niedostępny na tym urządzeniu / w tej przeglądarce (brak VAPID lub Web Push).',
  pushSubscribeFailed: 'Nie udało się włączyć powiadomień push.',
  pushOsSettingsHint:
    'Jeśli nie dostajesz powiadomień, sprawdź uprawnienia w ustawieniach systemu.',
  toastPushEnabled: 'Powiadomienia push włączone.',
  accountLoggedIn: (email: string) => `Zalogowany jako ${email}`,
  accountLocalOnly: 'Trenujesz lokalnie na tym urządzeniu — zaloguj się, aby syncować.',
  sessionLostReLogin:
    'Sesja logowania wygasła lub została wyczyszczona przez system — treningi na telefonie są bezpieczne.',
  sessionLostReLoginAction: 'Zaloguj się ponownie',
  logoutFailed: 'Nie udało się wylogować. Spróbuj ponownie.',
  dataSection: 'Dane',
  profileProgramsLoading: 'Ładowanie programów…',
  reminderHourLabel: 'Godzina przypomnienia',
  reminderHourOption: (h: number) => `${String(h).padStart(2, '0')}:00`,
  reminderNotificationTitle: 'SmartReps',
  reminderNotificationBody: 'Czas na trening — sprawdź swój plan na dziś.',
  syncNow: 'Synchronizuj teraz',
  syncNowOffline: 'Brak sieci — synchronizacja niedostępna',
  syncLastAt: (when: string) => `Ostatnia synchronizacja: ${when}`,
  syncNever: 'Jeszcze nie synchronizowano z tego urządzenia',
  syncInProgress: 'Synchronizacja…',
  exportHistory: 'Eksportuj historię treningów',
  exportFailed: 'Nie udało się wyeksportować historii',
  privacyLink: 'Polityka prywatności',
  termsLink: 'Regulamin',
  privacyTitle: 'Polityka prywatności',
  termsTitle: 'Regulamin',
  legalBack: 'Wróć',
  appVersion: (v: string) => `SmartReps v${v}`,
  restPrimaryLabel: (when: string) => `Trening ${when}`,
  considerLowerLevel: 'Kilka restartów z rzędu — rozważ niższy poziom.',
  summaryRecSuccess: 'Zrób zaplanowaną przerwę — wróć, gdy będziesz gotowy.',
  summaryRecFail: 'Po przerwie wrócisz do dnia 1 tego cyklu. Możesz też zmienić poziom w menu programu.',
  summaryRecCycleDone: 'Cykl ukończony — wykonaj test max, żeby dobrać kolejny poziom.',
  summaryCtaProgress: 'Zobacz postępy',
  summaryCtaLevelChange: 'Zmień poziom',
  summaryCtaRetest: 'Wykonaj test',
  summaryCtaLater: 'Później',
  summaryLoginBackup:
    'Zaloguj się, aby kopia zapasowa postępu trafiła do chmury i wracała na innych urządzeniach.',
  installPromptTitle: 'Dodaj SmartReps do ekranu głównego',
  installPromptBody: 'Szybszy start jak z aplikacji. Na iPhonie: Udostępnij → Do ekranu początkowego.',
  installPromptCta: 'Zainstaluj',
  installPromptDismiss: 'Nie teraz',
  installIosHint: 'Na iPhonie: przycisk Udostępnij, potem „Do ekranu początkowego”.',
  standaloneLoginCoachTitle: 'Zaloguj się kodem e-mail',
  standaloneLoginCoachBody:
    'Żeby postęp wracał na innych urządzeniach, zaloguj się tym samym e-mailem (kod z wiadomości, nie link).',
  standaloneLoginCoachCta: 'Zaloguj się',
  standaloneLoginCoachDismiss: 'Później',
  programs: 'Programy',
  disableProgram: 'Wyłącz program',
  disableProgramConfirm:
    'Program zniknie z ekranu Trening. Historia pozostanie na urządzeniu. Kontynuować?',
  disableProgramConfirmLast:
    'To ostatni włączony program — ekran Trening przejdzie na własne plany. Historia treningów zostanie na urządzeniu. Kontynuować?',
  pauseProgram: 'Wstrzymaj program',
  resumeProgram: 'Wznów program',
  clearLocalData: 'Wyczyść lokalne dane',
  clearLocalDataConfirm:
    'Usunie postęp, sesje i ustawienia z tego urządzenia. Nie usuwa konta w chmurze. Tej operacji nie da się cofnąć.',
  logoutConfirmMessage:
    'Wybierz sposób wylogowania: wyczyść dane lokalne (zalecane na współdzielonym telefonie) albo zostaw postęp na tym urządzeniu.',
  logoutKeepData: 'Wyloguj — zostaw dane',
  logoutAndClear: 'Wyloguj i wyczyść',
  syncDeadLetter: (n: number) =>
    n === 1
      ? '1 element czeka na ponowną synchronizację'
      : `${n} elementów czeka na ponowną synchronizację`,
  syncRetryDead: 'Ponów synchronizację',
  syncStatusLocalOnly: 'Tylko na tym urządzeniu',
  syncStatusLoggedIn: 'Połączono z chmurą',
  syncStatusLoggedOutLocally: 'Wylogowano — dane zostają lokalnie',
  syncStatusSessionExpired: 'Sesja wygasła — zaloguj ponownie',
  syncStatusSyncing: 'Synchronizacja…',
  syncStatusSyncError: 'Problem z synchronizacją',
  syncQueuePending: (n: number) =>
    n === 1 ? '1 zmiana czeka na sync' : `${n} zmian czeka na sync`,
  syncErrorReason: (reason: string) => {
    const labels: Record<string, string> = {
      offline: 'Brak sieci',
      no_session: 'Brak aktywnej sesji',
      auth_expired: 'Sesja wygasła',
      remote_error: 'Błąd serwera',
      dead_letter: 'Nieudane zmiany w kolejce',
      unknown: 'Nieznany błąd',
    }
    return labels[reason] ?? labels.unknown
  },
  syncFaqTitle: 'Jak działa synchronizacja?',
  syncFaqLocal: 'Możesz trenować bez logowania — postęp zostaje na telefonie.',
  syncFaqLogin:
    'Logowanie kodem e-mail tworzy kopię w chmurze i pozwala wrócić na innym urządzeniu.',
  syncFaqWhat:
    'Sync obejmuje postęp programów, sesje treningowe, testy max i ustawienia (motyw, programy).',
  syncFaqMidWorkout:
    'Trening w trakcie synchronizuje się dopiero po zakończeniu dnia — nie w czasie serii.',
  syncCtaLoginBackup: 'Zaloguj się, aby backupować postęp',
  syncCtaLoginAgain: 'Zaloguj ponownie',
  syncCtaSessionExpired: 'Zaloguj się ponownie',
  toastSyncFailedOffline: 'Brak sieci — synchronizacja wznowi się po połączeniu',
  toastSyncFailedSession: 'Sesja wygasła — zaloguj się ponownie, aby syncować',
  toastSyncFailedDeadLetter:
    'Część zmian nie poszła do chmury — sprawdź panel synchronizacji w Profilu',
  toastSyncFailedRemote: 'Synchronizacja nie powiodła się — spróbuj ponownie',
  changeLevelPushups: 'Zmień poziom — Pompki',
  changeLevelPullups: 'Zmień poziom — Podciąganie',
  retestPushups: 'Test pompek',
  retestPullups: 'Test podciągania',
  about: 'O aplikacji',
  logout: 'Wyloguj',
  account: 'Konto',
  settingsTitle: 'Ustawienia',
  profileStatsSessions: 'Sesje',
  profileStatsStreak: 'Seria',
  profileStatsStreakWeeks: (n: number) => `${n} tyg.`,
  profileStatsReps: 'Powtórzenia',
  profileStatsRepsValue: (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n),
  profileStatsBestStreak: 'Najlepsza seria',
  profileStatsEmpty: '—',
  notLoggedIn: 'Nie jesteś zalogowany — dane tylko na tym urządzeniu',

  // Nav
  navWorkout: 'Trening',
  navProgress: 'Postępy',
  navPlans: 'Plany',
  navProfile: 'Profil',

  // Common
  loading: 'Ładowanie…',
  cancel: 'Anuluj',
  confirm: 'Potwierdź',
  close: 'Zamknij',
  yes: 'Tak',
  no: 'Nie',

  errorCrash: 'Wystąpił nieoczekiwany błąd. Odśwież aplikację i spróbuj ponownie.',

  today: 'Dziś',
  tomorrow: 'Jutro',
  inDays: (n: number) => `Za ${n} dni`,
  techniquePoseStart: 'Start',
  techniquePoseBottom: 'Dół',
  techniquePoseTop: 'Góra',

  formatSetMax: (min: number) => `MAX · min ${min}`,
  formatSetMaxShort: (min: number) => `MAX≥${min}`,
  formatSetExact: (reps: number) => `Równo ${reps}`,
  formatSetExactShort: (reps: number) => `=${reps}`,
  summarySetsPassed: 'zaliczone serie',
  summaryUnchanged: 'bez zmian',
  summaryBestSet: 'Najlepsza seria',
  summaryAvgReps: 'Śr. na serię',
  summaryTargetAchievement: 'Realizacja celu',
  summaryTargetAchieved: 'cel zrealizowany',
  summaryFailedSets: (n: number) =>
    n === 1 ? '1 niezaliczona seria' : `${n} niezaliczone serie`,
  summaryTotalVolume: 'Objętość',
  summaryExerciseCount: 'Ćwiczenia',
  summaryTotalSets: 'Serie łącznie',
  summaryAvgVolume: 'Śr. objętość/serię',
  summaryHighlightsTitle: 'Postęp w tym treningu',
  summaryHighlightsPrCount: (n: number) =>
    n === 1 ? '1 rekord' : n < 5 ? `${n} rekordy` : `${n} rekordów`,
  summaryHighlightsProgressCount: (n: number) =>
    n === 1 ? '1 postęp' : n < 5 ? `${n} postępy` : `${n} postępów`,
  summaryHighlightSessionTotalPr: 'Rekord powtórzeń w sesji',
  summaryHighlightBestSetPr: (setNumber: number) => `Rekord serii ${setNumber}`,
  summaryHighlightExercisePr: (name: string) => `Rekord · ${name}`,
  summaryHighlightVolumePr: (name: string) => `Objętość · ${name}`,
  summarySetBadgePr: 'PR',
  summarySetBadgeImproved: (n: number) => `+${n}`,
  summarySetBadgeDown: (n: number) => `${n}`,
  summarySetInsightPr: (value: string) => `Rekord: ${value}`,
  summarySetInsightImproved: (value: string, delta: number) =>
    `Postęp: ${value} (+${delta} względem poprzedniej sesji)`,
  summarySetInsightDown: (value: string, delta: number) =>
    `${value} (${delta} względem poprzedniej sesji)`,
  summarySetInsightFailed: (value: string) => `Niezaliczone: ${value}`,
  setLabelFixed: (reps: number, unit: string) => `Zrób ${reps} ${unit}`,
  setLabelMax: (min: number) => `MAX — minimum ${min}`,
  setLabelExact: (reps: number) => `Wykonaj dokładnie ${reps} opuszczeń`,

  celebrationPushups100: 'Cel 100 pompek osiągnięty!',
  celebrationPullupsMain: 'Cel główny osiągnięty!',
  celebrationPullupsAmbition: 'Cel ambicji osiągnięty!',

  // Custom plans & exercises
  plansTabBuiltin: 'Programy',
  plansTabPrograms: 'Programy',
  plansTabMine: 'Moje',
  plansTabLibrary: 'Biblioteka',
  myPlansTitle: 'Moje plany',
  myPlansHint: 'Ułóż własny trening z kilkoma ćwiczeniami.',
  myPlansEmpty: 'Nie masz jeszcze własnego planu.',
  myPlansEmptyCta: 'Stwórz plan',
  myExercisesSectionTitle: 'Moje ćwiczenia',
  myExercisesSectionHint: 'Biblioteka ćwiczeń do budowania planów.',
  myExercisesSectionCta: 'Otwórz bibliotekę',
  myExercisesCount: (n: number) => `${n} ${n === 1 ? 'ćwiczenie' : n < 5 ? 'ćwiczenia' : 'ćwiczeń'}`,
  newCustomPlan: 'Nowy plan',
  planSectionInfo: 'Informacje',
  planSectionDays: 'Dni treningowe',
  planSectionProgression: 'Progresja i deload',
  planSectionSets: 'Serie',
  planSectionRest: 'Przerwy',
  planSectionNote: 'Notatka',
  planSectionProgressPerExercise: 'Progresja ćwiczenia',
  planExerciseMetricReps: 'Powtórzenia',
  planExerciseMetricRepsWeight: 'Powtórzenia + ciężar',
  planExerciseMetricDuration: 'Czas',
  planDayExercisesCount: (n: number) => (n === 1 ? '1 ćwiczenie' : `${n} ćwiczeń`),
  planDayTotalSets: (n: number) => (n === 1 ? '1 seria' : `${n} serii`),
  planAddExerciseDashed: 'Dodaj ćwiczenie',
  planSummaryDays: (n: number) => (n === 1 ? '1 dzień' : `${n} dni`),
  planSummaryExercises: (n: number) => (n === 1 ? '1 ćwiczenie' : `${n} ćwiczeń`),
  planSummarySets: (n: number) => (n === 1 ? '1 seria' : `${n} serii`),
  planSectionRestDay: 'Przerwa po dniu',
  // ─── AI Plan Generator ───
  aiGeneratePlan: 'Generuj z AI',
  aiGeneratePlanHint: 'Opisz swój cel, a AI ułoży plan na podstawie badań naukowych.',
  aiSettingsTitle: 'AI — konfiguracja',
  aiSettingsHint: 'Klucz API jest przechowywany lokalnie na urządzeniu. Nie jest synchronizowany do chmury.',
  aiProviderLabel: 'Dostawca AI',
  aiProviderOpenai: 'OpenAI',
  aiProviderGemini: 'Google Gemini',
  aiProviderGroq: 'Groq',
  aiProviderCustom: 'Własny endpoint',
  aiApiKeyLabel: 'Klucz API',
  aiApiKeyPlaceholder: 'sk-... lub AIza...',
  aiModelLabel: 'Model',
  aiModelHint: 'Najtańszy i najszybszy model wystarczy. Dla Gemini: „gemini-2.5-flash-lite" (darmowy) lub „gemini-2.5-flash".',
  aiBaseUrlLabel: 'Adres API (Base URL)',
  aiBaseUrlHint: 'Pole automatyczne — edytuj tylko przy własnym endpoincie.',
  aiReasoningEffortLabel: 'Poziom rozumowania',
  aiReasoningEffortHint: '„Auto" wyłącza myślenie (najszybsze). Wyższe poziomy dają lepszą jakość, ale wolniej i drożej. Tylko Gemini.',
  aiReasoningEffortAuto: 'Auto',
  aiReasoningEffortLow: 'Niski',
  aiReasoningEffortMedium: 'Średni',
  aiReasoningEffortHigh: 'Wysoki',
  aiProviderHintOpenai: 'Klucz z platform.openai.com. Model gpt-4o-mini kosztuje ~$0.15/M tokenów.',
  aiProviderHintGemini: 'Klucz z aistudio.google.com. Gemini 2.5 Flash-Lite ma darmowy limit (15 req/min, 1000 req/dzień).',
  aiProviderHintGroq: 'Klucz z console.groq.com. Darmowe, bardzo szybkie (Llama 3.3).',
  aiProviderHintCustom: 'Wpisz endpoint kompatybilny z OpenAI API.',
  aiNoApiKey: 'Ustaw klucz API w profilu, aby korzystać z generatora AI.',
  aiGenerating: 'Generowanie planu...',
  aiAnalyzing: 'Analiza treningów...',
  aiGenerate: 'Generuj',
  aiAnalyze: 'Przeanalizuj treningi',
  aiAnalyzeAgain: 'Przeanalizuj ponownie',
  aiAnalysisTitle: 'Analiza AI treningów',
  aiAnalysisHint: 'AI przeanalizuje Twoją historię treningów i da sugestie oparte na badaniach.',
  aiAnalysisEmpty: 'Ukończ kilka treningów, aby AI mogło przeanalizować Twoją historię.',
  aiDescriptionLabel: 'Opis celu',
  aiDescriptionPlaceholder: 'np. Chcę trenować 4x w tygodniu push/pull/legs w domu z hantlami, budować masę mięśniową',
  aiDaysLabel: 'Dni w tygodniu',
  aiExperienceLabel: 'Poziom doświadczenia',
  aiExperienceBeginner: 'Początkujący',
  aiExperienceIntermediate: 'Średniozaawansowany',
  aiExperienceAdvanced: 'Zaawansowany',
  aiEquipmentLabel: 'Sprzęt',
  aiEquipmentBodyweight: 'Masa ciała',
  aiEquipmentDumbbells: 'Hantle',
  aiEquipmentBarbell: 'Sztanga',
  aiEquipmentFullGym: 'Pełna siłownia',
  aiEquipmentKettlebell: 'Odwążki',
  aiGoalLabel: 'Cel',
  aiGoalHypertrophy: 'Hipertrofia (masa)',
  aiGoalStrength: 'Siła',
  aiGoalEndurance: 'Wytrzymałość',
  aiGoalGeneral: 'Ogólna sprawność',
  aiGoalFatLoss: 'Redukcja',
  aiDurationLabel: 'Czas treningu (min, opcjonalnie)',
  aiDurationPlaceholder: 'np. 60',
  aiDurationInvalid: 'Czas treningu musi być między 10 a 300 minut.',
  aiRationaleTitle: 'Dlaczego ten plan?',
  aiNewExercises: (n: number) => (n === 1 ? '1 nowe ćwiczenie zostanie dodane do biblioteki' : `${n} nowych ćwiczeń zostanie dodanych do biblioteki`),
  aiImportPlan: 'Importuj plan',
  aiImporting: 'Importowanie...',
  aiImported: 'Plan zaimportowany. Możesz go edytować w „Moje plany".',
  aiImportWarning: 'Plan zostanie zapisany jako szkic. Możesz go edytować przed aktywacją. Nowe ćwiczenia zostaną dodane do biblioteki.',
  aiDiscard: 'Odrzuć i wróć do formularza',
  aiErrorOffline: 'Brak połączenia z internetem. Generator AI wymaga połączenia.',
  aiErrorAuth: 'Nieprawidłowy klucz API. Sprawdź klucz w ustawieniach profilu.',
  aiErrorRateLimit: 'Zbyt wiele zapytań do API. Poczekaj chwilę.',
  aiErrorGeneric: 'Błąd generatora AI. Spróbuj ponownie.',
  aiErrorNoHistory: 'Brak ukończonych treningów do analizy.',
  aiSummary: 'Podsumowanie',
  aiStrengths: 'Mocne strony',
  aiWeaknesses: 'Słabe strony',
  aiSuggestions: 'Sugestie',
  aiPriorityHigh: 'Wysoki priorytet',
  aiPriorityMedium: 'Średni priorytet',
  aiPriorityLow: 'Niski priorytet',
  aiVolumeAssessment: 'Objętość na grupę mięśniową',
  aiStatusOptimal: 'Optymalna',
  aiStatusBelowMev: 'Poniżej minimum (MEV)',
  aiStatusAboveMrv: 'Powyżej maksimum (MRV)',
  aiStatusLow: 'Niska',
  aiStatusHigh: 'Wysoka',
  // ── AI Coach persona ──
  aiCoachName: 'Trener SmartReps',
  aiCoachTagline: 'Twój wewnętrzny trener oparty na badaniach',
  aiCoachThinking: 'Myślę…',
  aiCoachAnalyzing: 'Analizuję Twoje treningi…',
  aiCoachGenerating: 'Układam Twój plan…',
  aiCoachReady: 'Gotowy do pomocy',
  aiCoachGreeting: 'Cześć! Jestem Twoim trenerem AI. Przeanalizuję Twoje treningi i pomogę Ci trenować mądrzej — na podstawie badań naukowych o objętości, częstotliwości i progresji.',
  aiCoachGreetingPlan: 'Opisz mi swój cel, a ułożę plan treningowy dopasowany do Twojego poziomu, sprzętu i czasu. Stosuję zasady objętości (MEV–MRV), częstotliwości 2x/tyg i progresywnego obciążenia.',
  aiCoachNoApiKey: 'Abyśmy mogli pracować, ustaw klucz API w Profilu. Klucz zostaje na Twoim urządzeniu — nie trafia do chmury.',
  aiCoachErrorRetry: 'Spróbujmy jeszcze raz — sprawdź klucz API lub połączenie.',
  aiCoachAnalysisDone: 'Gotowe! Oto co widzę w Twoich treningach.',
  aiCoachPlanReady: 'Plan gotowy! Sprawdź poniżej i zimportuj, jeśli Ci pasuje.',
  aiCoachDiscard: 'Nie trafiło? Opisz cel inaczej i spróbujmy ponownie.',
  aiCoachConfigTitle: 'Trener AI — połączenie',
  aiCoachConfigHint: 'Wybierz dostawcę AI i wpisz klucz API. Klucz jest przechowywany lokalnie na urządzeniu — nie jest synchronizowany do chmury.',
  aiCoachConfigConnected: 'Połączenie aktywne',
  aiCoachConfigDisconnected: 'Brak klucza — trener offline',
  aiCoachConfigSave: 'Zapisz połączenie',
  aiCoachConfigSaved: 'Ustawienia trenera zapisane',
  aiBaseUrlInvalid: 'Adres API musi być poprawnym URL (np. https://api.openai.com/v1)',
  aiCoachConfigTest: 'Testuj połączenie',
  aiCoachConfigTesting: 'Testuję…',
  aiCoachConfigTestOk: 'Połączenie działa — trener gotowy',
  aiCoachConfigTestFail: 'Nie udało się połączyć — sprawdź klucz i model',
  // ── Proactive Coach: smart rest suggestions ──
  coachRestSuggestionFirstTime: 'Pierwsza seria tego ćwiczenia — zrób solidnie, jakość nad ilość.',
  coachRestSuggestionNewCombination: 'Nowa kombinacja dnia i serii — zrób solidnie, poczuj ruch.',
  coachRestSuggestionImproved: (prev: number) => `Ostatnio zrobiłeś ${prev} powt. w tej serii — spróbuj przebić.`,
  coachRestSuggestionImprovedTime: (prev: number) => `Ostatnio wytrzymałeś ${prev}s — spróbuj przebić.`,
  coachRestSuggestionUnchanged: 'Ostatnio tyle samo — czas na progres o 1 powtórzenie.',
  coachRestSuggestionChallenge: (target: number, diff: number) => `Cel: ${target} powt. (o ${diff} więcej niż ostatnio). Skup się na tempie — dasz radę.`,
  coachRestSuggestionChallengeTime: (target: number, diff: number) => `Cel: ${target}s (o ${diff}s dłużej niż ostatnio). Trzymaj pozycję — dasz radę.`,
  // ── Proactive Coach: post-workout auto-insight ──
  coachPostWorkoutTitle: 'Trener po treningu',
  coachPostWorkoutLocalPr: 'Nowy rekord — super forma! Zrób 2 dni przerwy przed następnym treningiem.',
  coachPostWorkoutLocalPrMulti: (count: number) => `${count} nowe rekordy w jednej sesji — wyjątkowa forma! Zrób 2 dni przerwy.`,
  coachPostWorkoutLocalProgress: (delta: number) => `Progres o ${delta} powt. — dobra progresja. Utrzymaj tempo.`,
  coachPostWorkoutLocalProgressAll: (delta: number, sets: number) => `Progres we wszystkich ${sets} seriach (do +${delta} powt.) — świetna sesja!`,
  coachPostWorkoutLocalDown: (delta: number) => `Spadek o ${delta} powt. — może gorszy dzień. Zobacz, czy nie skracać przerw.`,
  coachPostWorkoutLocalUnchanged: 'Bez zmian vs poprzednia sesja — rozważ +1 powtórzenie lub dodatkową serię.',
  coachPostWorkoutLocalFailed: 'Nieudana sesja — to normalne. Skup się na czystej formie i spróbuj ponownie po przerwie.',
  coachPostWorkoutGenerating: 'Trener analizuje sesję…',
  coachPostWorkoutDismiss: 'Odrzuć',
  coachPostWorkoutDismissed: 'Insight odrzucony',
  coachPostWorkoutError: 'Nie udało się wygenerować insightu',
  // ── Proactive Coach: plateau detector ──
  coachPlateauTitle: 'Plateau wykryte',
  coachPlateauBody: (programLabel: string, sessionCount: number, lastValue: number, bestValue: number, sessionsSinceBest: number) =>
    `${programLabel}: ${sessionCount} sesje bez progresu (ostatni: ${lastValue}, najlepszy: ${bestValue}, ${sessionsSinceBest} sesje temu). Rozważ deload (−40% objętości) lub zmianę cyklu — badania Israetel sugerują tydzień lighter po 3-4 tyg. stagnacji.`,
  coachPlateauCta: 'Zobacz rekomendację trenera',
  coachPlateauTip: (programLabel: string) => `${programLabel}: 3 sesje bez progresu. Rozważ deload (−40% objętości) lub zmianę cyklu.`,
  // ── Proactive Coach: weekly report ──
  coachWeeklyReportTitle: 'Podsumowanie tygodnia',
  coachWeeklyReportEmpty: 'Brak treningów w tym tygodniu. Zaplanuj sesję na jutro — mały krok buduje nawyk.',
  coachWeeklyReportSessions: (count: number, reps: number) => `${count} sesje, ${reps} powt. łącznie.`,
  coachWeeklyReportStreak: (weeks: number) => `Seria ${weeks} tyg. — tak trzymaj!`,
  coachWeeklyReportUp: (pct: number) => `+${pct}% objętości vs poprzedni tydzień.`,
  coachWeeklyReportDown: (pct: number) => `−${pct}% objętości vs poprzedni tydzień — rozważ dodatkową sesję.`,
  coachWeeklyReportCta: 'Otwórz pełną analizę',
  coachWeeklyReportGenerating: 'Trener przygotowuje raport…',
  coachWeeklyReportDeloadSuggest: '4+ sesje/tyg. przez 4+ tyg. — rozważ tydzień deload (−40% objętości) dla regeneracji.',
  coachWeeklyReportLowFreq: '1 sesja/tyg. to poniżej MEV (10 serii/grupę) — dodaj 1-2 sesje dla optymalnej hipertrofii.',
  coachWeeklyReportFatigue: 'Spadek objętości >10% — możliwe zmęczenie. Rozważ dodatkowy dzień przerwy.',
  coachWeeklyReportGreat: 'Świetny tydzień — objętość i progres w normie. Tak trzymaj!',
  coachWeeklyReportFirstWeek: 'Pierwszy tydzień z treningami — brak danych do porównania.',
  coachWeeklyReportConnectAiHint: 'Podłącz AI, aby uzyskać szczegółową analizę trenera',
  coachWeeklyMetricSessions: 'Sesje',
  coachWeeklyMetricReps: 'Powt.',
  coachWeeklyMetricStreak: 'Seria',
  coachWeeklyMetricChange: 'Zmiana',
  coachSourceAi: 'AI',
  coachSourceLocal: 'Lokalne',
  // ── Proactive Coach: settings ──
  coachSettingsProactive: 'Proaktywny trener',
  coachSettingsProactiveDesc: 'Automatyczne insights po treningu, tygodniowe raporty i wykrywanie plateau. Używa Twojego klucza AI.',
  // ── Profile hero & about redesign ──
  profileHeroLocal: 'Trenujesz lokalnie',
  profileHeroLocalHint: 'Zaloguj się, aby zapisać postęp w chmurze',
  profileHeroConnected: 'Konto aktywne',
  profileHeroConnectedHint: 'Postęp synchronizowany z chmurą',
  profileHeroSyncNow: 'Synchronizuj',
  profileHeroLogin: 'Zaloguj się',
  profileHeroSettings: 'Ustawienia',
  profileCoachCardTitle: 'Trener AI',
  profileCoachCardHint: 'Analiza treningów i plany AI',
  profileCoachCardConnected: 'Połączony',
  profileCoachCardOffline: 'Niepołączony',
  profileCoachCardConfigure: 'Konfiguruj',
  profileAboutTitle: 'O aplikacji',
  profileAboutHint: 'SmartReps — trening, który mierzy postęp',
  profileAboutPrivacy: 'Polityka prywatności',
  profileAboutTerms: 'Regulamin',
  profileAboutSources: 'Źródła programów',
  profileAboutDisclaimer: 'Zastrzeżenie zdrowotne',
  profileAboutVersion: 'Wersja',
  profileSettingsGroupAccount: 'Konto i synchronizacja',
  profileSettingsGroupPreferences: 'Preferencje',
  profileSettingsGroupTraining: 'Trening',
  profileSettingsGroupReminders: 'Przypomnienia',
  profileSettingsGroupData: 'Dane i backup',
  // ── Audit fixes: i18n leaks ──
  chartDataSummary: 'Dane wykresu',
  weightUnitShort: 'kg',
  setLabel: 'S',
  homeStartTraining: 'Zacznij trening',
  exerciseLibrary: 'Biblioteka ćwiczeń',
  exerciseLibraryHint: 'Ćwiczenia do użycia w planach.',
  exerciseLibraryPickHint: 'Wybierz ćwiczenie do planu lub zobacz statystyki.',
  exerciseLibraryEmpty: 'Brak ćwiczeń',
  exerciseLibraryEmptyHint: 'Stwórz własne ćwiczenie lub dodaj gotowe z pakietu startowego.',
  exerciseSearchPlaceholder: 'Szukaj ćwiczenia…',
  exerciseSearchNoResults: 'Brak ćwiczeń pasujących do wyszukiwania.',
  exerciseFilterAll: 'Wszystkie',
  calendarPrevMonth: 'Poprzedni miesiąc',
  calendarNextMonth: 'Następny miesiąc',
  calendarTitle: 'Kalendarz treningów',
  calendarHint: 'Dotknij dzień, aby zobaczyć sesje.',
  calendarSessionCustom: 'Plan własny',
  calendarSessionBuiltin: 'Program wbudowany',
  calendarLegendPassed: 'Zaliczony',
  calendarLegendFailed: 'Niezaliczony',
  calendarMonthStats: (total: number, passed: number) =>
    `${total} ${total === 1 ? 'trening' : total < 5 ? 'treningi' : 'treningów'} · ${passed} zaliczone`,
  calendarMoreSessions: (n: number) => `+${n} więcej`,
  calendarNoSessions: 'Brak treningów w tym miesiącu.',
  calendarToday: 'Dziś',
  repUnit: 'powt.',
  addExercise: 'Dodaj ćwiczenie',
  editExercise: 'Edytuj ćwiczenie',
  archiveExercise: 'Archiwizuj',
  exerciseName: 'Nazwa',
  exerciseMetric: 'Metryka',
  exerciseMetricReps: 'Powtórzenia',
  exerciseMetricDuration: 'Czas (s)',
  exerciseMetricRepsWeight: 'Powtórzenia + kg',
  exerciseRestDefault: 'Domyślna przerwa (s)',
  exerciseUsedInPlans: (n: number) =>
    n === 1 ? 'Używane w 1 planie — archiwizuj zamiast usuwać' : `Używane w ${n} planach`,
  exerciseTemplatesTitle: 'Szybki start',
  exerciseStarterPack: 'Dodaj zestaw startowy',
  exerciseStarterPackDone: 'Dodano ćwiczenia startowe',
  exerciseStarterPushups: 'Pompki',
  exerciseStarterPullups: 'Podciąganie',
  exerciseStarterSquats: 'Przysiady',
  exerciseStarterPlank: 'Deska',
  exerciseStarterSidePlank: 'Plank boczny',
  exerciseStarterPress: 'Wyciskanie',
  // Klatka piersiowa
  exerciseStarterBenchPress: 'Wyciskanie sztangi na ławce poziomej',
  exerciseStarterInclineBenchPress: 'Wyciskanie sztangi na ławce skośnej dodatniej',
  exerciseStarterDumbbellFlyes: 'Rozpiętki hantlami',
  exerciseStarterDips: 'Pompki na poręczach',
  exerciseStarterPushupWide: 'Pompki szerokie',
  // Plecy
  exerciseStarterBarbellRow: 'Wiosłowanie sztangą w opadzie',
  exerciseStarterLatPulldown: 'Ściąganie drążka wyciągu górnego',
  exerciseStarterDeadlift: 'Martwy ciąg',
  exerciseStarterSeatedRow: 'Wiosłowanie na wyciągu siedząc',
  exerciseStarterFacePulls: 'Face pull (wyciąg do twarzy)',
  // Barki
  exerciseStarterOverheadPress: 'Wyciskanie sztangi nad głowę stojąc',
  exerciseStarterLateralRaise: 'Wznosy hantli bokiem',
  exerciseStarterFrontRaise: 'Wznosy hantli przodem',
  exerciseStarterRearDeltFlyes: 'Odwrotne rozpiętki',
  exerciseStarterArnoldPress: 'Wyciskanie hantli Arnolda',
  // Ramiona
  exerciseStarterBarbellCurl: 'Uginanie ramion ze sztangą stojąc',
  exerciseStarterDumbbellCurl: 'Uginanie ramion z hantlami stojąc',
  exerciseStarterHammerCurl: 'Uginanie ramion chwytem młotkowym',
  exerciseStarterTricepPushdown: 'Prostowanie ramion na wyciągu',
  exerciseStarterSkullCrusher: 'Wyciskanie francuskie hantlami',
  exerciseStarterCloseGripBench: 'Wyciskanie sztangi wąskim chwytem',
  // Nogi
  exerciseStarterLegPress: 'Wypychanie nóg na suwnicy',
  exerciseStarterLunges: 'Wykroki z hantlami',
  exerciseStarterRomanianDeadlift: 'Martwy ciąg na prostych nogach (RDL)',
  exerciseStarterLegExtension: 'Prostowanie nóg na maszynie siedząc',
  exerciseStarterLegCurl: 'Uginanie nóg na maszynie leżąc',
  exerciseStarterCalfRaise: 'Wspięcia na palce stojąc',
  exerciseStarterGobletSquat: 'Przysiad goblet z hantlem',
  exerciseStarterHipThrust: 'Thrust bioder ze sztangą',
  // Core
  exerciseStarterCrunches: 'Spięcia brzucha leżąc',
  exerciseStarterHangingLegRaise: 'Wznosy nóg w zwisie',
  exerciseStarterRussianTwist: 'Rotacje tułowia (Russian twist)',
  exerciseStarterMountainClimbers: 'Wspinaczka w podporze',
  exerciseStarterDeadBug: 'Martwy robak (dead bug)',
  // Całe ciało
  exerciseStarterBurpees: 'Burpees',
  exerciseStarterKettlebellSwing: 'Wyмахy odważnikiem (kettlebell swing)',
  exerciseStarterThrusters: 'Thrusters (przysiad + wyciskanie)',
  exerciseStarterCleanAndPress: 'Zarzut i wyciskanie (clean & press)',
  exerciseArchiveConfirm: 'Zarchiwizować to ćwiczenie? Zniknie z biblioteki.',
  exerciseDetailTitle: 'Szczegóły ćwiczenia',
  exerciseDetailOpen: 'Statystyki ćwiczenia',
  exerciseDetailOpenFor: (name: string) => `Statystyki: ${name}`,
  exerciseDetailEmpty: 'Brak historii — użyj ćwiczenia w treningu własnym planu.',
  exerciseDetailSessions: 'Treningi',
  exerciseDetailSets: 'Serie',
  exerciseDetailPassRate: 'Skuteczność',
  exerciseDetailPassHint: (passed: number, total: number) =>
    `${passed} z ${total} serii zaliczonych`,
  exerciseDetailLastTrained: 'Ostatnio',
  exerciseDetailSince: (date: string) => `Pierwszy raz: ${date}`,
  exerciseDetailRestDefault: (sec: number) => `Domyślna przerwa: ${sec}s`,
  exerciseDetailChartTitle: 'Postęp w czasie',
  exerciseDetailChartHint: 'Najlepsza seria w każdym treningu',
  exerciseDetailChartDuration: 's',
  exerciseDetailChartReps: 'powt.',
  exerciseDetailChartTooltip: 'Najlepsza seria',
  exerciseDetailChartSingle: (value: number, unit: string) =>
    `Jeden trening — najlepsza seria: ${value} ${unit}. Wykres pojawi się po kolejnym treningu.`,
  exerciseDetailTrendUp: (pct: number) =>
    pct > 0 ? `Trend w górę — ostatnie treningi +${pct}%` : 'Trend w górę',
  exerciseDetailTrendDown: (pct: number) =>
    pct > 0 ? `Trend w dół — ostatnie treningi −${pct}%` : 'Trend w dół',
  exerciseDetailTrendFlat: 'Stabilnie — bez wyraźnej zmiany',
  exerciseDetailRecentTitle: 'Ostatnie treningi',
  exerciseDetailRecentHint: 'Najlepsza seria w danym dniu planu',
  exerciseDetailBestInSession: 'Najlepsza seria',
  exerciseDetailSetsPassed: (passed: number, total: number) => `${passed}/${total}`,
  exerciseDetailVolumeShort: (kg: number) => `obj. ${kg} kg`,
  exerciseDetailClose: 'Zamknij',
  exerciseDetailViewProgress: 'Zobacz w Postępach',
  exerciseDetailPrSessionContext: (plan: string, day: number) => `${plan} · ${pl.planDayLabel(day)}`,
  exerciseDetailPrTestLabel: 'Test max',
  exerciseDetailPrHint: (date: string, context: string) => `Rekord z ${date} · ${context}`,
  exerciseDetailPrHintRepsWeight: (date: string, context: string) =>
    `Najwięcej powtórzeń: ${date} · ${context}`,
  exerciseDetailPrHintDuration: (date: string, context: string) =>
    `Najdłuższa seria: ${date} · ${context}`,
  exerciseDetailLoadTitle: 'Obciążenie i częstotliwość',
  exerciseDetailTotalReps: 'Suma powtórzeń',
  exerciseDetailTotalVolume: 'Suma obciążenia',
  exerciseDetailTotalVolumeUnit: 'kg',
  exerciseDetailTotalDuration: 'Suma czasu',
  exerciseDetailAvgBest: 'Śr. najlepsza seria',
  exerciseDetailSessions30d: 'Treningi 30 dni',
  exerciseDetailAvgPerWeek: 'Śr. na tydzień',
  exerciseDetailAvgPerWeekUnit: (n: number) => `${n}/tydz.`,
  exerciseDetailLoadChartTitle: 'Obciążenie w czasie',
  exerciseDetailLoadChartHint: 'Całkowite obciążenie w każdym treningu',
  exerciseDetailLoadChartVolume: 'kg',
  exerciseDetailLoadChartReps: 'powt.',
  exerciseDetailLoadChartDuration: 's',
  exerciseDetailLoadChartTooltip: 'Obciążenie',
  exerciseDetailLastSessionTitle: 'Ostatni trening — serie',
  exerciseDetailLastSessionHint: 'Wynik wobec celu w każdej serii',
  exerciseDetailTargetShort: 'cel',
  exerciseDetailActualShort: 'wynik',
  exerciseDetailSetShort: (n: number) => `S${n}`,
  exerciseListRowMeta: (sessions: number, pr: string) =>
    sessions === 1
      ? `1 trening · PR ${pr}`
      : `${sessions} treningów · PR ${pr}`,
  progressCustomSessionCount: (sessions: number) =>
    sessions === 1 ? '1 trening' : `${sessions} treningów`,
  customWorkoutHeaderSetLine: (day: number, set: number, total: number) =>
    `Dzień ${day} · Seria ${set}/${total}`,
  exercisePickTitle: 'Wybierz ćwiczenie',
  exercisePickHint: 'Wybierz z biblioteki lub utwórz nowe. Po dodaniu możesz ustawić serie i przerwy.',
  exerciseReplaceTitle: 'Zmień ćwiczenie',
  exerciseReplace: 'Zmień ćwiczenie',
  exerciseReplaceHint: (name: string) =>
    name ? `Wybierz nowe ćwiczenie zamiast „${name}”. Serie, przerwy i notatka zostaną zachowane.` : 'Wybierz nowe ćwiczenie. Serie, przerwy i notatka zostaną zachowane.',
  exerciseNameLabel: 'Nazwa ćwiczenia',
  exerciseNameHint: 'Zmiana nazwy aktualizuje ćwiczenie w bibliotece dla wszystkich planów.',
  exerciseNameSaved: 'Nazwa ćwiczenia zaktualizowana',
  saveExercise: 'Zapisz ćwiczenie',
  planName: 'Nazwa planu',
  planDescription: 'Opis (opcjonalnie)',
  planAddDay: 'Dodaj dzień',
  planDuplicateDay: 'Duplikuj',
  planDeleteDay: 'Usuń dzień',
  planDeleteDayConfirm: 'Usunąć ten dzień wraz z ćwiczeniami?',
  planCannotDeleteLastDay: 'Plan musi mieć co najmniej jeden dzień.',
  planDayLabel: (n: number) => `Dzień ${n}`,
  planAddExercise: 'Dodaj ćwiczenie',
  planDayEmptyTitle: 'Brak ćwiczeń',
  planDayEmptyHint: 'Dodaj pierwsze ćwiczenie, aby ułożyć trening tego dnia.',
  planDayEmpty: 'Pusty dzień — dodaj ćwiczenia',
  planRemoveExercise: 'Usuń ćwiczenie',
  planDuplicateExercise: 'Duplikuj ćwiczenie',
  planMoveUp: 'W górę',
  planMoveDown: 'W dół',
  planExerciseActions: 'Akcje ćwiczenia',
  planMoveDayUp: 'Przesuń dzień w górę',
  planMoveDayDown: 'Przesuń dzień w dół',
  planSetsCount: 'Serie',
  planTargetValue: 'Cel',
  planRestBetweenSets: 'Przerwa między seriami',
  planRestAfterExercise: 'Przerwa po ćwiczeniu',
  planRestAfterDay: 'Odpoczynek po dniu',
  planRestDay1: '1 dzień',
  planRestDay2: '2 dni',
  planRestChipCustom: 'Własne',
  planSaveDraft: 'Zapisz szkic',
  planPublish: 'Zapisz i aktywuj',
  planSaveActive: 'Zapisz plan',
  planTrain: 'Trenuj',
  planDuplicate: 'Duplikuj plan',
  planDuplicateCopySuffix: ' (kopia)',
  planDelete: 'Usuń plan',
  planDeleteConfirm: (name: string) =>
    name.trim() ? `Usunąć plan „${name}”?` : 'Usunąć ten plan?',
  planExportJson: 'Eksportuj JSON',
  planMoreActions: 'Więcej',
  planStatusDraft: 'Szkic',
  planStatusActive: 'Aktywny',
  planBack: 'Wstecz',
  planValidationFix: 'Uzupełnij plan',
  planEllipsis: '…',
  planDash: '—',
  planTotalExercises: (n: number) => (n === 1 ? '1 ćwiczenie' : `${n} ćwiczeń`),
  planDayRestShort: (n: number) => (n === 1 ? '1d przerwy' : `${n}d przerwy`),
  customWorkoutExerciseOf: (cur: number, total: number) => `Ćw. ${cur}/${total}`,
  customWorkoutSetOf: (cur: number, total: number) => `Seria ${cur}/${total}`,
  customWorkoutHeaderExercise: (exercise: string, day: number, set: number, total: number) =>
    `${exercise} · Dzień ${day} · Seria ${set}/${total}`,
  customWorkoutHeaderSub: (plan: string, exerciseCur: number, exerciseTotal: number) =>
    exerciseTotal > 1 ? `${plan} · Ćw. ${exerciseCur}/${exerciseTotal}` : plan,
  customWorkoutHeaderSubAttempt: (
    plan: string,
    attempt: number,
    exerciseCur: number,
    exerciseTotal: number,
  ) =>
    exerciseTotal > 1
      ? `${plan} · Próba ${attempt} · Ćw. ${exerciseCur}/${exerciseTotal}`
      : `${plan} · Próba ${attempt}`,
  customWorkoutHeader: (
    plan: string,
    day: number,
    set: number,
    totalSets: number,
  ) => `${plan} · Dzień ${day} · Seria ${set}/${totalSets}`,
  customWorkoutHeaderAria: (
    plan: string,
    day: number,
    exercise: number,
    exerciseTotal: number,
    set: number,
    totalSets: number,
  ) =>
    `${plan}, dzień ${day}, ćwiczenie ${exercise} z ${exerciseTotal}, seria ${set} z ${totalSets}`,
  customSetLabelReps: (reps: number, name: string) => `Zrób ${reps} · ${name}`,
  customSetLabelRepsWeight: (reps: number, weight: number, unit: string, name: string) =>
    `Zrób ${reps} × ${weight} ${unit} · ${name}`,
  customSetLabelDuration: (sec: number, name: string) => `Trzymaj ${sec}s · ${name}`,
  customWorkoutHint:
    'Ustaw wynik (lub uruchom timer), potem naciśnij Zrobione. Cel = sukces; poniżej celu = nieudana seria.',
  customWorkoutSetsSection: 'Serie',
  customWorkoutRestChip: (sec: number) => `Przerwa ${sec}s między seriami`,
  customWorkoutExerciseDone: (done: number, total: number) => `${done}/${total} serii`,
  customWorkoutRestAfterExercise: (sec: number) => `Przerwa po ćwiczeniu: ${sec}s`,
  customWorkoutExerciseNote: 'Notatka trenera',
  customMaxLiveHint: (min: number) => `Minimum ${min} — więcej też się liczy`,
  customDurationUnit: 'sek',
  customWorkoutTargetWeight: (weight: number, unit: string) => `Cel ciężaru: ${weight} ${unit}`,
  customWorkoutWeightShort: 'kg',
  customWorkoutLessSec: 'Sekunda mniej',
  customWorkoutMoreSec: 'Sekunda więcej',
  customNextSet: (set: number, label: string) => `Następnie: Seria ${set} · ${label}`,
  customWorkoutMissingDay: 'Ten dzień planu jest pusty — dokończ edycję w Plany → Moje.',
  customWorkoutMissingExercise: 'Ćwiczenie z planu zostało usunięte lub zarchiwizowane.',
  exerciseMetricLocked: 'Nie można zmienić typu ćwiczenia używanego w planie.',
  exerciseMetricLockedHint: 'Typ ćwiczenia jest zablokowany — używane w planie.',
  exerciseMetricChangeWarn: (n: number) =>
    `To ćwiczenie jest używane w ${n} ${n === 1 ? 'planie' : 'planach'}. Zmiana metryki może wpłynąć na istniejące serie — sprawdź plany po zapisaniu.`,
  progressCustomHistory: 'Historia treningów',
  progressCustomHistoryEmpty: 'Ukończ pierwszy trening własnym planem.',
  progressCustomSessionMeta: (planName: string, day: number) => `${planName} · Dzień ${day}`,
  planDaysCount: (n: number) => (n === 1 ? '1 dzień' : `${n} dni`),
  planExercisesShort: (n: number) => `${n} ćw.`,
  planSetsShort: (n: number) => {
    if (n === 1) return '1 seria'
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} serie`
    return `${n} serii`
  },
  progressionPreviewCount: (n: number) => `Podgląd zmian: ${n} pozycji`,
  editPlan: 'Edytuj plan',
  durationMinus1s: '−1s',
  durationPlus1s: '+1s',
  customWorkoutNextExercise: (name: string) => `Następne: ${name}`,
  customWorkoutWeightKg: 'Ciężar',
  customWorkoutLessWeight: 'Lżej',
  customWorkoutMoreWeight: 'Ciężej',
  customWorkoutDurationSec: 'Czas (s)',
  customWorkoutStartTimer: 'Start',
  customWorkoutStopTimer: 'Stop',
  customDayPassed: 'Dzień zaliczony',
  customDayFailed: 'Dzień niezaliczony',
  customFailRetryDay: 'Powtórz dzień',
  homeCustomPlans: 'Moje plany',
  homeCustomPlansHint: 'Aktywne plany — dzień, ćwiczenia i status.',
  homeCustomEmptyDiscoverHint:
    'Tu pojawią się Twoje plany. Stwórz plan albo dodaj ćwiczenia do biblioteki.',
  homeCustomEmptyCreate: 'Stwórz plan',
  homeCustomEmptyLibrary: 'Biblioteka ćwiczeń',
  homeSeeAllCustom: 'Zobacz wszystkie',
  homeCustomDayOf: (current: number, total: number) =>
    total > 0 ? `Dzień ${current} z ${total}` : pl.dayLabel(current),
  homeCustomTodayPreview: (names: string, exercises: number, sets: number) => {
    const parts = [names]
    if (exercises > 0) parts.push(pl.planExercisesShort(exercises))
    if (sets > 0) parts.push(pl.planSetsShort(sets))
    return parts.join(' · ')
  },
  homeCustomResumeHint: (set: number, total: number) =>
    `Do dokończenia: seria ${set}/${total}`,
  homeCustomStatusCycleComplete: 'Cykl ukończony',
  homeCustomCycleRestartHint: 'Po przerwie zaczniesz od dnia 1.',
  customCycleCompleteHint: 'Ukończyłeś wszystkie dni planu. Możesz zacząć nowy cykl od dnia 1.',
  customCycleCompleteCta: 'Rozpocznij nowy cykl',
  noValue: '—',
  weightUnit: 'kg',
  durationUnitShort: 's',
  chartDayShort: (day: number) => `D${day}`,
  progressCustomPr: 'Rekord',
  activeWorkoutsTitle: 'Aktywne treningi',
  activeWorkoutsHint: 'Które własne plany pokazywać na ekranie Trening.',
  progressionTitle: 'Auto-progresja',
  progressionHint: 'Po ukończeniu cyklu podnieś cele.',
  progressionEnable: 'Włącz auto-progresję',
  progressionReps: '+ powtórzenia',
  progressionKg: '+ kg',
  progressionSec: '+ sekundy',
  progressionPreview: 'Podgląd zmian',

  validationMetricNonNegative: 'Wartość musi być liczbą ≥ 0',
  validationExactPositive: 'Cel exact musi być > 0',
  validationMissingReps: 'Brak celu powtórzeń',
  validationMissingDuration: 'Brak celu czasu',
  validationMissingId: 'Brak id',
  validationExerciseName: 'Podaj nazwę ćwiczenia',
  validationNameTooLong: 'Nazwa max 80 znaków',
  validationBadMetric: 'Nieprawidłowa metryka',
  validationRestNonNegative: 'Przerwa musi być ≥ 0',
  validationPlanName: 'Podaj nazwę planu',
  validationNoDays: 'Dodaj co najmniej jeden dzień',
  validationMaxDays: 'Max 14 dni w planie',
  validationDuplicateDay: 'Zduplikowany numer dnia',
  validationDayNoExercises: 'Dzień bez ćwiczeń',
  validationRestAfterDay: 'Odpoczynek po dniu: 1 lub 2 dni',
  validationExerciseUnavailable: 'Ćwiczenie niedostępne',
  validationNoSets: 'Dodaj co najmniej jedną serię',
  validationMaxSets: 'Max 30 serii',
  validationGroupMissing: 'Grupa nie istnieje w tym dniu',
  validationGroupEmpty: 'Pusta grupa ćwiczeń',
  validationGroupMinTwo: 'Superset/obwód wymaga min. 2 ćwiczeń',
  validationCircuitRounds: 'Obwód: 1–30 rund',
  validationAmrapDuration: 'AMRAP: 30–3600 sek',
  validationDeloadCycles: 'Deload: co 2–52 cykle',
  progressionPerExercise: 'Własna progresja tego ćwiczenia',
  progressionPerExerciseHint: 'Nadpisuje ustawienia planu.',
  deloadTitle: 'Deload co N cykli',
  deloadHint: 'Co kilka cykli lekko obniż cele zamiast podnosić.',
  deloadEnable: 'Włącz deload',
  deloadEveryNCycles: 'Co ile cykli',
  deloadReps: 'Powtórzenia',
  deloadKg: 'Kg',
  deloadSec: 'Sekundy',
  groupSuperset: 'Superset',
  groupCircuit: 'Obwód',
  groupAmrap: 'AMRAP',
  groupLinkNext: 'Połącz z następnym',
  groupUnlink: 'Rozgrupuj',
  groupEdit: 'Ustawienia grupy',
  groupRounds: 'Rundy obwodu',
  groupAmrapDuration: 'Czas AMRAP (sek)',
  groupRestAfterRound: 'Przerwa po rundzie (sek)',
  groupMemberCount: (n: number) => `${n} ćwiczenia w grupie`,
  customWorkoutGroupSuperset: 'Superset',
  customWorkoutGroupCircuit: 'Obwód',
  customWorkoutGroupAmrap: 'AMRAP',
  customWorkoutRoundLine: (round: number, total?: number) =>
    total != null ? `Runda ${round}/${total}` : `Runda ${round}`,
  customWorkoutAmrapRemaining: (sec: number) => `AMRAP · ${sec} s`,

  heatmapDayPassed: (day: number, reps: number) => `Dzień ${day} · ${reps} powt.`,
  heatmapDayFailed: 'Dzień nieudany',
  heatmapRest: 'Przerwa',

  // Community catalog
  plansTabCommunity: 'Katalog',
  plansCommunityPageHint: 'Gotowe plany od innych — zaimportuj i trenuj.',
  communitySortPopular: 'Popularne',
  communitySortNewest: 'Najnowsze',
  communitySortImports: 'Importy',
  communityEmpty: 'Tu pojawią się plany od innych.',
  communityEmptyHint: 'Możesz opublikować własny z zakładki Moje.',
  communityEmptyCta: 'Moje plany',
  communityOffline: 'Brak internetu — społeczność niedostępna.',
  communityCachedOffline: 'Jesteś offline — pokazuję ostatnio wczytane.',
  communityLoadError: 'Nie udało się wczytać katalogu.',
  communityRetry: 'Spróbuj ponownie',
  communityLikes: (n: number) => (n === 1 ? '1 polubienie' : `${n} polubień`),
  communityImports: (n: number) => (n === 1 ? '1 import' : `${n} importów`),
  communityDaysExercises: (days: number, exercises: number) =>
    `${days} ${days === 1 ? 'dzień' : 'dni'} · ${exercises} ćw.`,
  communityByAuthor: (name: string) => name,
  communityImport: 'Importuj plan',
  communityImporting: 'Importuję…',
  communityImportDone: 'Zaimportowano jako szkic — aktywuj, żeby trenować.',
  communityActivateHint: 'Aktywuj i trenuj',
  communityLike: 'Polub',
  communityUnlike: 'Polubione',
  communityLikeOwnForbidden: 'Nie możesz polubić własnego planu.',
  communityLikeDone: 'Polubiono',
  communityUnlikeDone: 'Cofnięto polubienie',
  communityLoginToLike: 'Zaloguj się, aby polubić',
  communityYourPlan: 'Twój plan',
  communityRepublish: 'Opublikuj ponownie',
  communityRepublishMissingPlan: 'Brak lokalnego planu źródłowego — otwórz Moje plany.',
  communityAlreadyImported: 'Masz już import tego planu. Dodać kolejną kopię?',
  communityImportAgain: 'Dodaj kopię',
  communityPublishUpdated: 'Publikacja zaktualizowana',
  communityPublishInvalidPlan: 'Plan ma błędy — popraw go przed publikacją.',
  communityPublishMissingExercise: 'Brakuje ćwiczenia w bibliotece — uzupełnij plan.',
  communityOfflineDetail: 'Jesteś offline — pokazuję zapisaną wersję.',
  communityOfflineUnavailable: 'Brak internetu i brak zapisanej kopii tego planu.',
  communitySelfReportForbidden: 'Nie możesz zgłosić własnego planu.',
  communityPublishOfflineHint: 'Publikacja wymaga internetu.',
  communityShare: 'Udostępnij',
  communityShareCopied: 'Link skopiowany',
  communityReport: 'Zgłoś',
  communityReportSpam: 'Spam',
  communityReportUnsafe: 'Niebezpieczne',
  communityReportOther: 'Inne',
  communityReportDone: 'Dziękujemy za zgłoszenie',
  communityUnavailable: 'Plan niedostępny',
  communityUnavailableHint: 'Publikacja została wycofana lub usunięta.',
  communityLoginRequired: 'Zaloguj się, żeby kontynuować',
  communityLoginToImport: 'Zaloguj się, aby zaimportować',
  communityNeedOnline: 'Wymaga połączenia z internetem',
  communityPublish: 'Opublikuj w katalogu',
  communityPublishUpdate: 'Zaktualizuj publikację',
  communityUnpublish: 'Wycofaj z katalogu',
  communityUnpublishConfirm: 'Wycofać plan z katalogu? Link przestanie działać dla innych.',
  communityUnpublishDone: 'Publikacja wycofana',
  communityPublishTitle: 'Tytuł',
  communityPublishDescription: 'Opis',
  communityPublishTags: 'Tagi',
  communityPublishTagsHint: 'Max 3 — pomagają w filtrowaniu.',
  communityPublishSubmit: 'Opublikuj',
  communityPublishDone: 'Plan opublikowany',
  communityPublishNeedActive: 'Najpierw aktywuj plan.',
  communityPublishNeedName: 'Podaj podpis autora.',
  communityPublishNeedTitle: 'Podaj tytuł publikacji.',
  communityPublishHint: 'Do katalogu idzie aktualna struktura planu (dni, serie, przerwy).',
  communityDisplayName: 'Podpis w katalogu',
  communityDisplayNameHint: 'Widoczny przy Twoich publikacjach.',
  communityDisplayNameSave: 'Zapisz podpis',
  communityDisplayNameSaved: 'Podpis zapisany',
  communitySelfImportHint: 'Importujesz własny plan jako lokalną kopię.',
  communityMyPublications: 'Moje publikacje',
  communityMyPublicationsEmpty: 'Nie masz jeszcze publikacji.',
  communityMyPublicationsEmptyHint: 'Opublikuj aktywny plan z zakładki Moje.',
  communityStatusPublished: 'W katalogu',
  communityStatusUnpublished: 'Wycofany',
  communityTagHome: 'Dom',
  communityTagGym: 'Siłownia',
  communityTagBodyweight: 'Masa ciała',
  communityTagWeights: 'Ciężary',
  communityTagShortCycle: 'Krótki cykl',
  communityTagLongCycle: 'Długi cykl',
  communityFilterAll: 'Wszystkie',
  communityTeaserTitle: 'Z katalogu',
  communityTeaserHint: 'Gotowe plany do importu.',
  communityTeaserCta: 'Zobacz więcej',
  communityDetailDays: 'Plan dnia po dniu',
  communityDetailMeta: (likes: number, imports: number) =>
    `${likes === 1 ? '1 polubienie' : `${likes} polubień`} · ${imports === 1 ? '1 import' : `${imports} importów`}`,
  communityManage: 'Zarządzaj',
  communityAccountSwitchPending: 'Najpierw rozstrzygnij zmianę konta.',
  communityRateLimited: 'Limit publikacji — spróbuj jutro.',
  communityErrorGeneric: 'Coś poszło nie tak. Spróbuj ponownie.',
  communityCharCount: (n: number, max: number) => `${n}/${max}`,
  communityTrainedBadge: 'Trenowany',
  communityImpactTitle: 'Twój wpływ',
  communityImpactLikes: 'Polubienia',
  communityImpactImports: 'Importy',
  communityImpactTrained: 'Treningi z planów',
  communityImpactNext: 'Następna odznaka',

  tabAchievements: 'Odznaki',
  achievementsTitle: 'Odznaki',
  achievementsEmpty: 'Tu pojawią się Twoje odznaki.',
  achievementsEmptyHint: 'Trenuj — pierwsze przyjdą same.',
  achievementsEmptyUnlocked: 'Brak zdobytych w tym filtrze.',
  achievementsEmptyUnlockedHint: 'Trenuj dalej — odznaki przychodzą same.',
  achievementsFilterAll: 'Wszystkie',
  achievementsFilterUnlocked: 'Zdobyte',
  achievementsTrackTraining: 'Trening',
  achievementsTrackHabit: 'Nawyk',
  achievementsTrackCatalog: 'Katalog',
  achievementsTrackLegend: 'Legendy',
  achievementsRarityCommon: 'Zwykła',
  achievementsRarityRare: 'Rzadka',
  achievementsRarityLegendary: 'Legendarna',
  achievementsUnlockedOn: (date: string) => `Zdobyta ${date}`,
  achievementsLockedHint: 'Jeszcze przed Tobą.',
  achievementsSecretLocked: '???',
  achievementsSecretLockedHint: 'Sekret — odkryjesz w trakcie.',
  achievementsInProgress: 'W toku',
  achievementsProgress: (current: number, target: number) => `${current} / ${target}`,
  achievementsUnlockTitle: 'Nowa odznaka',
  achievementsBackfillTitle: 'Odznaki z historii',
  achievementsBackfillBody: (n: number) =>
    n === 1 ? 'Odkryto 1 odznakę z Twojej historii treningów.' : `Odkryto ${n} odznak z Twojej historii treningów.`,
  achievementsBackfillCta: 'Zobacz odznaki',
  achievementsProfileTitle: 'Odznaki',
  achievementsProfileSeeAll: 'Wszystkie',
  achievementsShowcaseOverline: 'Gablotka',
  achievementsShowcaseAria: 'Gablotka odznak',
  achievementsShowcaseSlotsAria: 'Wybrane miejsca w gablotce',
  achievementsShowcaseEmptyHint: 'Tu pokażesz zdobyte odznaki.',
  achievementsShowcaseAutoHint: 'Najmocniejsze z Twoich — możesz wybrać własne.',
  achievementsShowcasePinnedHint: 'Twoje wybrane odznaki.',
  achievementsShowcaseEdit: 'Wybierz',
  achievementsShowcaseAddSlot: 'Dodaj',
  achievementsShowcaseEmptySlot: 'Puste',
  achievementsShowcasePickTitle: 'Gablotka',
  achievementsShowcasePickHint: (n: number) =>
    `Wybierz do ${n} odznak albo zostaw automatyczny dobór.`,
  achievementsShowcaseSelectedCount: (selected: number, max: number) =>
    `${selected} / ${max} wybranych`,
  achievementsShowcaseAuto: 'Automatycznie',
  achievementsShowcaseAutoBadge: 'AUTO',
  achievementsShowcaseClear: 'Wyczyść',
  achievementsShowcaseSave: 'Zapisz gablotkę',
  achievementsShowcaseNoUnlocks: 'Najpierw zdobądź odznakę — wtedy wybierzesz ją tutaj.',
  achievementsHomeTipTitle: 'Nowa odznaka',
  achievementsHomeTipTitleMany: (n: number) => `Nowe odznaki (${n})`,
  achievementsHomeTipBody: 'Zobacz, co właśnie zdobyłeś.',
  achievementsHomeTipCta: 'Odznaki',

  achievement_first_session_title: 'Pierwszy dzień',
  achievement_first_session_desc: 'Ukończyłeś pierwszą sesję. Tak się zaczyna.',
  achievement_habit_3_in_14_title: 'Rozruch',
  achievement_habit_3_in_14_desc: 'Trzy treningi w 14 dniach — rytm złapany.',
  achievement_first_custom_session_title: 'Własna ścieżka',
  achievement_first_custom_session_desc: 'Pierwszy trening na własnym planie.',
  achievement_cycle_closed_strong_title: 'Domknięty cykl',
  achievement_cycle_closed_strong_desc: 'Przeszedłeś cały cykl treningowy do końca.',
  achievement_goal_pushups_100_title: 'Setka pod rząd',
  achievement_goal_pushups_100_desc: '100 pompek w teście max.',
  achievement_goal_pullups_50_title: 'Pół setki na drążku',
  achievement_goal_pullups_50_desc: '50 podciągnięć w teście max.',
  achievement_goal_pullups_30_title: 'Cel drążka',
  achievement_goal_pullups_30_desc: '30 podciągnięć w teście max.',
  achievement_workshop_custom_title: 'Warsztat',
  achievement_workshop_custom_desc: 'Własny plan z kilkoma ćwiczeniami — i kilka sesji na nim.',
  achievement_pr_repeat_3_title: 'Powtórzony PR',
  achievement_pr_repeat_3_desc: 'Rekord w tym samym dniu cyklu w trzech sesjach.',
  achievement_sessions_100_title: 'Maraton sesji',
  achievement_sessions_100_desc: 'Sto ukończonych treningów.',
  achievement_streak_1_title: 'Tydzień z rzędu',
  achievement_streak_1_desc: 'Trening w bieżącym tygodniu — seria ruszyła.',
  achievement_streak_4_title: 'Miesiąc rytmu',
  achievement_streak_4_desc: 'Cztery tygodnie z rzędu w rekordzie.',
  achievement_streak_12_title: 'Kwartał',
  achievement_streak_12_desc: 'Dwanaście tygodni serii w rekordzie.',
  achievement_streak_52_title: 'Rok bez zerwania',
  achievement_streak_52_desc: 'Pięćdziesiąt dwa tygodnie w najlepszej serii.',
  achievement_comeback_stronger_title: 'Powrót silniejszy',
  achievement_comeback_stronger_desc: 'Po dłuższej przerwie wróciłeś i złapałeś rytm.',
  achievement_first_publish_title: 'W katalogu',
  achievement_first_publish_desc: 'Twój plan jest dostępny dla innych.',
  achievement_first_like_title: 'Pierwsze polubienie',
  achievement_first_like_desc: 'Ktoś docenił Twój plan.',
  achievement_first_import_title: 'Ktoś wziął plan',
  achievement_first_import_desc: 'Twój plan trafił do czyjejś biblioteki.',
  achievement_first_trained_title: 'Ktoś już trenował',
  achievement_first_trained_desc: 'Import to dopiero start — ktoś zrobił na nim sesję.',
  achievement_plan_with_legs_title: 'Plan z nogami',
  achievement_plan_with_legs_desc: 'Kilka importów i realny trening na jednym planie.',
  achievement_trainer_25_title: 'Trener domowy',
  achievement_trainer_25_desc: 'Dwadzieścia pięć treningów na Twoich planach.',
  achievement_poly_publisher_title: 'Wielogłos',
  achievement_poly_publisher_desc: 'Kilka publikacji i solidna liczba importów.',
  achievement_legend_full_circle_title: 'Pełny krąg',
  achievement_legend_full_circle_desc: 'Cel siłowy, długa seria i wpływ w katalogu.',
  achievement_legend_quiet_master_title: 'Cichy mistrz',
  achievement_legend_quiet_master_desc: 'Setki sesji i półroczna seria — bez fanfar.',
  achievement_secret_night_title: 'Po godzinie',
  achievement_secret_night_desc: 'Nocne treningi — spokój, gdy inni śpią.',
  achievement_secret_precision_title: 'Dokładność',
  achievement_secret_precision_desc: 'Wiele dni custom domkniętych w celu, nie „jakoś”.',

  // ── Progressive tier copy ──
  achievementsTierLevel: (level: number, max: number) => `Poziom ${level} z ${max}`,
  achievementsTierNext: (current: number, next: number) =>
    `Od ${current} → następny poziom: ${next}`,
  achievementsTierMaxed: () => `Maksymalny poziom osiągnięty`,
  achievementsTierUpgradeTitle: 'Nowy poziom odznaki!',
  achievementsNextTier: 'Następny poziom',
  achievementsSummaryIcon: '🏆',
  achievementsSummaryTitle: 'Nowa odznaka!',
  achievementsSummaryTitleMulti: (n: number) => `${n} nowe odznaki!`,
  achievementsSummarySubtitle: 'Gratulacje — tak trzymaj!',
  achievementsSummarySeeAll: 'Zobacz wszystkie odznaki',

  // ── New long-distance achievements ──
  achievement_streak_26_title: 'Pół roku rytmu',
  achievement_streak_26_desc: 'Dwadzieścia sześć tygodni serii w rekordzie.',
  achievement_volume_10k_title: 'Dziesięć tysięcy powtórzeń',
  achievement_volume_10k_desc: 'Suma wszystkich powtórzeń w historii treningów.',
  achievement_cycles_5_title: 'Pięć cykli',
  achievement_cycles_5_desc: 'Pięć domkniętych cykli treningowych do końca.',
  achievement_legend_grandmaster_title: 'Wielki Mistrz',
  achievement_legend_grandmaster_desc:
    'Tysiąc sesji i dwa lata serii — absolutny szczyt konsekwencji.',

  // ── Custom sessions volume ──
  achievement_custom_sessions_25_title: 'Architekt sylwetki',
  achievement_custom_sessions_25_desc: 'Sesje na własnych planach — konsekwencja w budowaniu ciała.',
  // ── PR master ──
  achievement_pr_master_title: 'Mistrz PR',
  achievement_pr_master_desc: 'Powtarzalne rekordy w tym samym kontekście — siła rośnie.',
  // ── Habit builder ──
  achievement_habit_builder_title: 'Budowniczy nawyku',
  achievement_habit_builder_desc: 'Coraz więcej sesji w 14 dni — nawyk się zakorzenia.',
  // ── Community impact ──
  achievement_liked_author_title: 'Lubiany autor',
  achievement_liked_author_desc: 'Twoje plany zbierają polubienia — społeczność docenia.',
  achievement_imported_author_title: 'Importowany autor',
  achievement_imported_author_desc: 'Twoje plany są importowane — realny zasięg.',
  achievement_community_pillar_title: 'Filar społeczności',
  achievement_community_pillar_desc: 'Coraz więcej opublikowanych planów — tworzysz społeczność.',
  // ── Custom plan creator ──
  achievement_custom_creator_title: 'Twórca planów',
  achievement_custom_creator_desc: 'Coraz więcej własnych planów — Twoja biblioteka treningowa.',
  // ── Both programs ──
  achievement_both_programs_title: 'Wszechstronność',
  achievement_both_programs_desc: 'Pompki i podciągnięcia — oba programy opanowane.',
  // ── Secret dawn ──
  achievement_secret_dawn_title: 'Ranne ptaszko',
  achievement_secret_dawn_desc: 'Treningi o świcie — gdy światło budzi się z Tobą.',
  // ── Secret marathon ──
  achievement_secret_marathon_title: 'Maraton treningowy',
  achievement_secret_marathon_desc: 'Sesje trwające ponad godzinę — cierpliwość i objętość.',

  // ── Builtin exercise names (used in plan-resolver, workout-analyzer) ──
  builtinExercisePushups: 'Pompki',
  builtinExercisePullups: 'Podciąganie',
  builtinExerciseUnknown: 'Nieznane ćwiczenie',
  builtinWorkoutFallback: 'Trening',
  exerciseFallbackName: 'Ćwiczenie',

  // ── Full muscle group labels (for AI analysis) ──
  muscleGroupFull_chest: 'Klatka piersiowa',
  muscleGroupFull_back: 'Plecy',
  muscleGroupFull_shoulders: 'Barki',
  muscleGroupFull_arms: 'Ramię',
  muscleGroupFull_legs: 'Nogi',
  muscleGroupFull_core: 'Core',
  muscleGroupFull_full_body: 'Całe ciało',
  muscleGroupFull_cardio: 'Cardio',
  muscleGroupFull_other: 'Inne',

  // ── AI client error messages (shown via e.message) ──
  aiErrorOfflineConnection: 'Brak połączenia z internetem.',
  aiErrorNoApiKey: 'Brak klucza API.',
  aiErrorConnection: 'Nie udało się połączyć z API. Sprawdź połączenie internetowe.',
  aiErrorInvalidKey: (detail: string) => `Nieprawidłowy klucz API. ${detail}`.trim(),
  aiErrorRateLimited: 'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.',
  aiErrorModelNotFound: (model: string) =>
    `Model „${model}" nie istnieje lub jest niedostępny. Sprawdź nazwę modelu w ustawieniach AI.`,
  aiErrorBadRequest: (detail: string) =>
    `Nieprawidłowe zapytanie do API. ${detail}`.trim(),
  aiErrorLoopDetected: 'Model AI wpadł w pętlę. Spróbuj ponownie lub użyj innego modelu.',
  aiErrorServiceUnavailable: 'Serwer AI jest tymczasowo niedostępny. Spróbuj ponownie za chwilę.',
  aiErrorGenericStatus: (status: number, detail: string) =>
    `Błąd API (${status}). ${detail}`.trim(),
  aiErrorInvalidResponse: 'Nieprawidłowa odpowiedź API.',
  aiErrorParseJson: 'AI zwrócił nieprawidłowy JSON. Spróbuj ponownie.',
  aiErrorParseAnalysis: 'AI nie zwróciło prawidłowej analizy.',
  aiErrorParsePlan: 'AI nie zwróciło prawidłowego planu.',
  aiPlanFallbackName: 'Plan AI',

  // ── AI rate limiting ──
  aiRateLimitCooldown: (retryIn: string) =>
    `Poczekaj ${retryIn} przed kolejnym zapytaniem do AI.`,
  aiRateLimitQuota: (remaining: number, quota: number) =>
    `Dzienny limit AI wyczerpany (${quota} zapytań/dzień). Pozostało: ${remaining}. Spróbuj jutro.`,
  aiRateLimitInflight: 'AI już pracuje nad innym zapytaniem. Poczekaj na zakończenie.',
  aiAnalysisCacheFresh: (age: string) =>
    `Analiza z ${age} temu. Odśwież za chwilę, aby wygenerować nową.`,
  aiAnalysisCacheStale: 'Analiza może być nieaktualna. Kliknij, aby odświeżyć.',

  // ── Plans toast ──
  plansRepairedToast: (plans: number, sets: number) =>
    `Naprawiono ${plans} plan(ów): ${sets} serii.`,

  // ── Cycle names and descriptions (builtin programs) ──
  // Keys map cycle.id with hyphens → underscores
  cycleName_pushups_ponizej_5: 'Poniżej 5 pompek',
  cycleDesc_pushups_ponizej_5:
    'Program startowy dla osób wykonujących mniej niż 5 pompek w teście. Buduje podstawową siłę i wytrzymałość.',
  cycleName_pushups_6_10: '6–10 pompek',
  cycleDesc_pushups_6_10:
    'Dla osób wykonujących 6–10 pompek w teście. Rozwija siłę i objętość.',
  cycleName_pushups_11_20: '11–20 pompek',
  cycleDesc_pushups_11_20:
    'Dla osób wykonujących 11–20 pompek w teście. Buduje wytrzymałość siłową.',
  cycleName_pushups_21_25: '21–25 pompek',
  cycleDesc_pushups_21_25:
    'Dla osób wykonujących 21–25 pompek w teście. Zwiększa objętość i wytrzymałość.',
  cycleName_pushups_26_30: '26–30 pompek',
  cycleDesc_pushups_26_30:
    'Dla osób wykonujących 26–30 pompek w teście. Rozwija moc i wytrzymałość.',
  cycleName_pushups_31_35: '31–35 pompek',
  cycleDesc_pushups_31_35:
    'Dla osób wykonujących 31–35 pompek w teście. Zaawansowana wytrzymałość.',
  cycleName_pushups_36_40: '36–40 pompek',
  cycleDesc_pushups_36_40:
    'Dla osób wykonujących 36–40 pompek w teście. Wysoka wytrzymałość siłowa.',
  cycleName_pushups_41_45: '41–45 pompek',
  cycleDesc_pushups_41_45:
    'Dla osób wykonujących 41–45 pompek w teście. Elita wytrzymałości.',
  cycleName_pushups_46_50: '46–50 pompek',
  cycleDesc_pushups_46_50:
    'Dla osób wykonujących 46–50 pompek w teście. Mistrzowska wytrzymałość.',
  cycleName_pushups_51_55: '51–55 pompek',
  cycleDesc_pushups_51_55:
    'Dla osób wykonujących 51–55 pompek w teście. Ekspert poziomu elitarnego.',
  cycleName_pushups_56_60: '56–60 pompek',
  cycleDesc_pushups_56_60:
    'Dla osób wykonujących 56–60 pompek w teście. Wysoka powtarzalność.',
  cycleName_pushups_powyzej_60: 'Powyżej 60 pompek',
  cycleDesc_pushups_powyzej_60:
    'Dla osób wykonujących powyżej 60 pompek w teście. Poziom mistrzowski.',

  cycleName_pullups_ponizej_4: 'Poniżej 4 podciągnięć',
  cycleDesc_pullups_ponizej_4:
    'Program startowy dla osób wykonujących mniej niż 4 podciągnięcia. Buduje siłę bazową z negatywami.',
  cycleName_pullups_4_5: '4–5 podciągnięć',
  cycleDesc_pullups_4_5:
    'Dla osób wykonujących 4–5 podciągnięć. Rozwija siłę i objętość.',
  cycleName_pullups_6_8: '6–8 podciągnięć',
  cycleDesc_pullups_6_8:
    'Dla osób wykonujących 6–8 podciągnięć. Zwiększa objętość.',
  cycleName_pullups_9_11: '9–11 podciągnięć',
  cycleDesc_pullups_9_11:
    'Dla osób wykonujących 9–11 podciągnięć. Rozwija wytrzymałość siłową.',
  cycleName_pullups_12_15: '12–15 podciągnięć',
  cycleDesc_pullups_12_15:
    'Dla osób wykonujących 12–15 podciągnięć. Zaawansowana objętość.',
  cycleName_pullups_16_20: '16–20 podciągnięć',
  cycleDesc_pullups_16_20:
    'Dla osób wykonujących 16–20 podciągnięć. Wysoka wytrzymałość.',
  cycleName_pullups_21_25: '21–25 podciągnięć',
  cycleDesc_pullups_21_25:
    'Dla osób wykonujących 21–25 podciągnięć. Elita wytrzymałości.',
  cycleName_pullups_26_30: '26–30 podciągnięć',
  cycleDesc_pullups_26_30:
    'Dla osób wykonujących 26–30 podciągnięć. Mistrzowska wytrzymałość.',
  cycleName_pullups_31_35: '31–35 podciągnięć',
  cycleDesc_pullups_31_35:
    'Dla osób wykonujących 31–35 podciągnięć. Poziom elitarny.',
  cycleName_pullups_36_40: '36–40 podciągnięć',
  cycleDesc_pullups_36_40:
    'Dla osób wykonujących 36–40 podciągnięć. Zaawansowany poziom.',
  cycleName_pullups_powyzej_40: 'Powyżej 40 podciągnięć',
  cycleDesc_pullups_powyzej_40:
    'Dla osób wykonujących powyżej 40 podciągnięć. Ekspert poziomu mistrzowskiego.',

  // ── Legal pages ──
  privacyBody1:
    'SmartReps to aplikacja treningowa działająca przede wszystkim lokalnie na Twoim urządzeniu (IndexedDB / Dexie). Postęp, sesje i ustawienia są zapisywane u Ciebie.',
  privacyBody2:
    'Opcjonalnie możesz podać adres e-mail i zalogować się przez Supabase (kod OTP), aby synchronizować postęp między urządzeniami. Wówczas przetwarzamy identyfikator konta, e-mail oraz dane treningowe niezbędne do synchronizacji.',
  privacyBody3:
    'Nie sprzedajemy danych. Nie budujemy profili reklamowych. Przypomnienia możesz włączyć w dwóch trybach: (1) lokalnie przy otwartej aplikacji lub (2) opcjonalnie jako Web Push po instalacji PWA i zalogowaniu — wtedy powiadomienie może dotrzeć także po zamknięciu aplikacji. Endpoint subskrypcji push jest powiązany z Twoim kontem.',
  privacyBodyExport: 'Eksport danych:',
  privacyBodyExportDetail:
    'w Profilu → sekcja „Dane” możesz pobrać historię treningów (CSV) lub pełny backup (JSON) z postępem i ustawieniami na tym urządzeniu.',
  privacyBodyCommunity: 'Katalog społecznościowy:',
  privacyBodyCommunityDetail:
    'przy publikacji planu zapisujemy w chmurze snapshot treningu, podpis autora (wyświetlana nazwa), tagi oraz metadane (np. liczba polubień i importów). Import i polubienie wymagają konta. Katalog nie udostępnia Twojego e-maila ani prywatnych draftów.',
  privacyBodyDelete: 'Usunięcie konta:',
  privacyBodyDeleteDetail:
    'zalogowany użytkownik może w Profilu trwale usunąć konto w chmurze (postęp, sesje, subskrypcje push, publikacje społecznościowe, polubienia, importy i zgłoszenia powiązane z kontem). Usunięcie konta nie kasuje automatycznie danych lokalnych — możesz je wyczyścić osobno. Przed usunięciem zalecamy pobrać backup.',
  privacyBodyLocal:
    'Możesz w każdej chwili wyczyścić dane lokalne w Profilu oraz wylogować się bez usuwania konta w chmurze.',
  privacyBodyContact:
    'Kontakt w sprawach prywatności: poprzez issues w repozytorium SmartReps na GitHubie.',

  termsBody1:
    'Korzystając ze SmartReps akceptujesz, że aplikacja służy do śledzenia treningu siłowego (pompki, podciąganie) według planów inspirowanych publicznymi programami progresji.',
  termsBody2:
    'Trening siłowy wiąże się z ryzykiem urazu. Przed rozpoczęciem skonsultuj się z lekarzem, jeśli masz problemy zdrowotne. SmartReps nie zastępuje porady medycznej.',
  termsBody3:
    'Aplikacja jest dostarczana „tak jak jest”. Dokładamy starań, by działała offline i synchronicznie z chmurą, ale nie gwarantujemy nieprzerwanej dostępności usług zewnętrznych (np. dostawy e-mail OTP).',
  termsBody4:
    'Plany treningowe odwołują się do materiałów z 100pompek.pl i podciaganie.pl — prawa do oryginalnych programów należą do ich autorów; SmartReps implementuje śledzenie postępu.',
  termsBody5:
    'W katalogu społecznościowym możesz publikować własne plany (tytuł, opis, strukturę treningu) oraz importować plany innych użytkowników jako lokalną kopię. Publikując, udzielasz SmartReps niewyłącznej licencji na wyświetlanie planu w katalogu i umożliwienie importu kopii innym użytkownikom. Nie publikuj danych osobowych w opisach ani treści niebezpiecznych / niezgodnych z prawem. Możesz wycofać publikację (unpublish) oraz zgłosić cudzą treść. Zastrzegamy prawo do ukrycia lub usunięcia zgłoszonych publikacji.',
  termsBody6:
    'Możesz zaprzestać korzystania w dowolnym momencie i usunąć dane lokalne w Profilu. Kontynuując, potwierdzasz zapoznanie się z polityką prywatności.',

  // ── AI prompts (research context + plan generation) ──
  aiPromptResearchContext: `Jesteś ekspertem ds. treningu siłowego z wiedzą opartą na badaniach naukowych.

Kluczowe zasady, którymi się kierujesz:

1. OBJĘTOŚĆ (Volume Landmarks — Israetel & Hoffmann):
   - MEV (Minimum Effective Volume): 10 serii na grupę mięśniową na tydzień (początkujący)
   - MAV (Maximum Adaptive Volume): 15-25 serii na grupę mięśniową na tydzień (średniozaawansowani)
   - MRV (Maximum Recoverable Volume): 20-30+ serii na grupę mięśniową na tydzień (zaawansowani)
   - Każda grupa mięśniowa powinna otrzymać objętość w zakresie MEV-MAV

2. CZĘSTOTLIWOŚĆ (Schoenfeld et al. 2016):
   - Każda grupa mięśniowa 2x w tygodniu (optymalne dla hipertrofii)
   - 1x w tygodniu akceptowalne dla początkujących lub przy niskiej częstotliwości treningowej
   - 3x+ w tygodniu dla małych grup (core, łydki) lub gdy objętość jest niska

3. PROGRESJA (Progressive Overload):
   - Zwiększaj obciążenie o 2.5-5% lub 1-2 powtórzenia gdy wszystkie serie są w zakresie RPE 7-8
   - RPE 7 = zostawiasz 3 powtórzenia w rezerwie (RIR=3)
   - RPE 8 = zostawiasz 2 powtórzenia w rezerwie (RIR=2)
   - RPE 9 = zostawiasz 1 powtórzenie w rezerwie (RIR=1)
   - Nie trenuj do upadku mięśniowego regularnie (RPE 10) — zwiększa ryzyko kontuzji i zmęczenie

4. WYBÓR ĆWICZEŃ:
   - Priorytetyzuj ćwiczenia wielostawowe (przysiady, martwy ciąg, wyciskanie, wiosłowanie)
   - 60-70% objętości z ćwiczeń wielostawowych, 30-40% z izolacji
   - Na każdą grupę mięśniową: 1 ćwiczenie wielostawowe + 1-2 izolacje

5. PRZERWY (Rest intervals):
   - Ćwiczenia siłowe (1-6 rep): 3-5 min
   - Hipertrofia (6-12 rep): 60-90 sek
   - Wytrzymałość (12+ rep): 30-60 sek
   - Core/izolacje: 45-60 sek

6. DELOAD:
   - Co 4-6 tygodni zmniejsz objętość o 40-50% przy zachowaniu intensywności
   - Deload po 3-4 tygodniach przy wysokim RPE (8-9)

7. BEZPIECZEŃSTWO:
   - Nigdy nie proponuj ćwiczeń z dużym ryzykiem kontuzji bez odpowiedniego przygotowania
   - Uwzględniaj poziom doświadczenia i dostępny sprzęt
   - Zawsze zaczynaj od rozgrzewki (5-10 min) — nie wliczaj w objętość`,

  aiPromptPlanSystem: 'Jesteś ekspertem ds. treningu siłowego. Generujesz plany treningowe w formacie JSON.',
  aiPromptPlanUser: (desc: string, days: number, experience: string, equipment: string, goal: string, duration?: string) =>
    `Ułóż plan treningowy na ${days} dni w tygodniu.\n\nOpis celu: ${desc}\nPoziom: ${experience}\nSprzęt: ${equipment}\nCel: ${goal}${duration ? `\nCzas treningu: ${duration} min` : ''}\n\nZwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem. Nie dodawaj komentarzy ani tekstu poza JSON.`,
  aiPromptPlanExample: 'Przykład poprawnego planu:',
  aiPromptPlanExampleJson:
    '{"name":"Plan na hipertrofię z hantlami, 4 dni w tygodniu","description":"Push/Pull/Legs/Upper","days":[{"dayNumber":1,"restAfterDays":1,"exercises":[{"exerciseName":"Wyciskanie hantli na ławce","sets":3,"targetReps":"8-12","restSeconds":90,"note":"Kontroluj opuszczanie"}]}]}',
  aiPromptPlanRules: `Zasady:
1. Każde ćwiczenie musi mieć nazwę, serie, cel powtórzeń (lub zakres), przerwę w sekundach.
2. Uwzględnij przerwę po dniu treningowym (1 lub 2 dni).
3. Rozgrzewka nie wlicza się w serie robocze.
4. Nie używaj ćwiczeń z dużym ryzykiem kontuzji.
5. Zwróć tylko JSON — bez markdown, bez komentarzy.`,

  aiPromptAnalysisSystem: 'Jesteś ekspertem ds. treningu siłowego. Analizujesz historię treningów użytkownika i dajesz sugestie oparte na badaniach.',
  aiPromptAnalysisUser: (sessions: string) =>
    `Przeanalizuj moją historię treningów (ostatnie ${sessions} sesji) i podaj sugestie. Zwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem.`,
  aiPromptAnalysisRules: `Zasady analizy:
1. Oceń objętość na grupę mięśniową (optymalna / poniżej MEV / powyżej MRV).
2. Wskazaj mocne i słabe strony.
3. Podaj konkretne sugestie z priorytetem (high/medium/low).
4. Zwróć tylko JSON — bez markdown, bez komentarzy.`,

  // ── Service worker push fallback ──
  swPushBody: 'Czas na trening — sprawdź swój plan na dziś.',

  // ── AI prompt maps (equipment/goal/experience for prompt construction) ──
  aiPromptEquipmentBodyweight: 'tylko masa ciała (bez sprzętu)',
  aiPromptEquipmentDumbbells: 'hantle',
  aiPromptEquipmentBarbell: 'sztanga',
  aiPromptEquipmentFullGym: 'pełna siłownia',
  aiPromptEquipmentKettlebell: 'odwążki (kettlebell)',
  aiPromptGoalHypertrophy: 'hipertrofia (budowa masy mięśniowej)',
  aiPromptGoalStrength: 'siła',
  aiPromptGoalEndurance: 'wytrzymałość mięśniowa',
  aiPromptGoalGeneral: 'ogólna sprawność',
  aiPromptGoalFatLoss: 'redukcja tkanki tłuszczowej',
  aiPromptExperienceBeginner: 'początkujący (0-6 miesięcy doświadczenia)',
  aiPromptExperienceIntermediate: 'średniozaawansowany (6 miesięcy - 2 lata)',
  aiPromptExperienceAdvanced: 'zaawansowany (2+ lata)',

  // ── AI plan generation full prompt ──
  aiPromptPlanBuild: (
    desc: string,
    days: number,
    experience: string,
    equipment: string,
    goal: string,
    duration: string,
    libraryList: string,
  ) => `Ułóż plan treningowy na podstawie:
- Opis użytkownika: "${desc}"
- Dni w tygodniu: ${days}
- Poziom: ${experience}
- Sprzęt: ${equipment}
- Cel: ${goal}
${duration}

BIBLIOTEKA ĆWICZEŃ (używaj tych gdy pasują, ale możesz proponować nowe):
${libraryList}

ZASADY:
1. Używaj ćwiczeń z biblioteki gdy pasują do celu i sprzętu. Jeśli używasz ćwiczenia z biblioteki, zachowaj jego primaryMetric.
2. Możesz proponować NOWE ćwiczenia — zostaną dodane do biblioteki. Podaj realistyczną nazwę po polsku.
3. Każde ćwiczenie musi mieć metrykę: "reps" (powtórzenia), "reps_weight" (powtórzenia + ciężar), lub "duration_sec" (czas w sekundach). Dla ćwiczeń z ciężarem używaj "reps_weight" i ustaw weightKg w seriach.
4. Dobierz serie, powtórzenia i przerwy zgodnie z badaniami (patrz kontekst systemowy).
5. Rozłóż grupy mięśniowe na dni tak, aby każda była trenowana 2x w tygodniu (lub 1x dla początkujących).
6. Uwzględnij przerwę po dniu treningowym (1 lub 2 dni).
7. Dodaj progresję (zwiększaj o 1-2 powtórzenia lub 2.5kg po pełnym cyklu).
8. Zwróć DOKŁADNIE ${days} dni treningowych (tyle ile użytkownik wybrał).
9. Maksymalnie 10 ćwiczeń na dzień, maksymalnie 5 serii na ćwiczenie.
10. Nazwa planu po polsku, krótka i opisowa (np. "Push/Pull/Legs 4x tyg.").
11. Używaj TYLKO kind: "fixed", "max", "min", lub "exact". NIE używaj "range" ani innych.

DOZWOLONE wartości muscleGroup: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".
DOZWOLONE wartości primaryMetric: "reps", "reps_weight", "duration_sec".
DOZWOLONE wartości kind w MetricTarget: "fixed", "max", "min", "exact".

Zwróć JSON w tym formacie (to jest przykład, podmień wartości):
{
  "plan": {
    "name": "Push/Pull/Legs 4x tyg.",
    "description": "Plan na hipertrofię z hantlami, 4 dni w tygodniu.",
    "days": [
      {
        "dayNumber": 1,
        "restAfterDay": 1,
        "exercises": [
          {
            "exerciseName": "Pompki",
            "primaryMetric": "reps",
            "muscleGroup": "chest",
            "sets": [
              { "reps": { "kind": "fixed", "value": 10 } },
              { "reps": { "kind": "fixed", "value": 10 } },
              { "reps": { "kind": "max", "value": 8 } }
            ],
            "restBetweenSetsSec": 90,
            "restAfterExerciseSec": 120,
            "note": "RPE 7-8"
          }
        ]
      }
    ],
    "progression": {
      "enabled": true,
      "repsDelta": 1,
      "weightKgDelta": 2.5,
      "afterCycleComplete": true
    },
    "rationale": "Plan rozkłada objętość 12-16 serii na główne grupy, 2x w tygodniu."
  }
}`,
  aiPromptLibraryEmpty: '  (pusta biblioteka)',
  aiPromptLibraryEntry: (id: string, name: string, metric: string, group: string) =>
    `  - id: "${id}", nazwa: "${name}", metryka: "${metric}", grupa: "${group}"`,

  // ── AI analysis full prompt ──
  aiPromptAnalysisBuild: (
    totalSessions: number,
    totalSets: number,
    totalReps: number,
    dateRange: string,
    sessionsPerWeek: string,
    activePlan: string,
    volumeTable: string,
    recentTable: string,
  ) => `Przeanalizuj historię treningów użytkownika i daj konkretne sugestie.

DANE:
- Liczba sesji: ${totalSessions}
- Liczba serii łącznie: ${totalSets}
- Liczba powtórzeń łącznie: ${totalReps}
- Okres: ${dateRange}
- Sesji na tydzień: ${sessionsPerWeek}
${activePlan}

OBJĘTOŚĆ NA GRUPĘ MIĘŚNIOWĄ (serie/tydzień):
${volumeTable}

OSTATNIE SESJE:
${recentTable}

Zasady analizy:
1. Porównaj objętość z zakresami MEV/MAV/MRV (patrz kontekst systemowy).
2. Sprawdź czy częstotliwość treningowa jest optymalna.
3. Zidentyfikuj grupy mięśniowe z niedostateczną lub nadmierną objętością.
4. Sprawdź czy progresja jest odpowiednia.
5. Daj 3-5 konkretnych, praktycznych sugestii (po polsku).

Zwróć JSON w tym formacie (to jest przykład, podmień wartości):
{
  "analysis": {
    "summary": "Ogólna ocena treningów (2-3 zdania po polsku)",
    "strengths": ["Mocna strona 1", "Mocna strona 2"],
    "weaknesses": ["Słaba strona 1", "Słaba strona 2"],
    "suggestions": [
      {
        "title": "Zwiększ objętość na plecy",
        "description": "Trenujesz plecy 1x w tygodniu z 6 seriami. Dodaj drugi dzień lub ćwiczenie.",
        "priority": "high"
      }
    ],
    "volumeAssessment": [
      {
        "muscleGroup": "chest",
        "weeklySets": 12,
        "status": "optimal",
        "recommendation": "Objętość w zakresie MAV, utrzymaj."
      }
    ]
  }
}

DOZWOLONE wartości priority: "high", "medium", "low".
DOZWOLONE wartości status: "optimal", "below_mev", "above_mrv", "low", "high".
DOZWOLONE wartości muscleGroup: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".`,
  aiPromptVolumeEntry: (group: string, sets: number) => `  ${group}: ${sets} serii/tydzień`,
  aiPromptVolumeEmpty: '  (brak danych)',
  aiPromptRecentEmpty: '  (brak sesji)',
  aiPromptDateRangeNone: 'brak danych',
  aiPromptNoActivePlan: '',
  aiPromptLanguageHint: 'Polish',

  // ── AI post-workout prompt building blocks ──
  aiPromptPostWorkoutDaySummary: (day: number, totalReps: number, logs: string) =>
    `Dzień ${day}, ${totalReps} powtórzeń łącznie:\n${logs}`,
  aiPromptPostWorkoutDayBrief: (day: number, totalReps: number, sets: string) =>
    sets ? `Dzień ${day}, ${totalReps} powtórzeń łącznie. ${sets}` : `Dzień ${day}, ${totalReps} powtórzeń łącznie`,
  aiPromptPostWorkoutSetResult: (setNumber: number, actual: number, target: string) =>
    `Seria ${setNumber}: ${actual} powt. (cel: ${target})`,
  aiPromptPostWorkoutPrevExercise: (name: string, totalReps: number) =>
    `  ${name}: ${totalReps} powt.`,
  aiPromptPostWorkoutTrendEntry: (date: string, totalReps: number, day: number) =>
    `${date}: ${totalReps} powt. (dzień ${day})`,
  aiPromptPostWorkoutPrSet: (setNumber: number, actual: number, prevBest: number) =>
    `Seria ${setNumber}: ${actual} powt. (poprzedni rekord: ${prevBest})`,
  aiPromptPostWorkoutPrHeader: (entries: string) =>
    `\nREKORDY ŻYCIOWE w tej sesji:\n${entries}`,
  aiPromptPostWorkoutFirstSession: 'Pierwsza sesja',

  // ── AI post-workout full prompt ──
  aiPromptPostWorkoutBuild: (
    currentSummary: string,
    prInfo: string,
    previousSummary: string,
    recentTrend: string,
  ) => `Przeanalizuj tę ukończoną sesję treningową i daj JEDNĄ konkretną sugestię (max 2 zdania).

AKTUALNA SESJA:
${currentSummary}
${prInfo}

POPRZEDNIA SESJA (ten sam dzień):
${previousSummary}

OSTATNI TREND:
${recentTrend}

Wytyczne dla sugestii:
- Jeśli użytkownik pobił rekord, celebruj to konkretnie z liczbą
- Jeśli postęp stagnuje (te same powt. przez 2-3 sesje), zaproponuj konkretną zmianę: +1 powt., nieco dłuższa przerwa, lub tydzień deloadu
- Odnoś się do RIR (powt. w rezerwie) gdy istotne — jeśli wszystkie serie były łatwe (RIR 3+), zaproponuj progresję; jeśli serie były na maksa (RIR 0-1), zaproponuj regenerację
- Bądź konkretny z liczbami z sesji, nie ogólnik

Odpowiedz w JSON: {"insight": "twoja 1-2 zdaniowa sugestia"}
Napisz po ${pl.aiPromptLanguageHint}.`,

  // ── AI weekly report prompt building blocks ──
  aiPromptWeeklySessionEntry: (date: string, totalReps: number, exerciseNames: string) =>
    `${date}: ${totalReps} powt. (${exerciseNames})`,
  aiPromptWeeklySessionEntryBuiltin: (date: string, totalReps: number, day: number) =>
    `${date}: ${totalReps} powt. (dzień ${day})`,
  aiPromptWeeklyVolumeEntry: (mg: string, sets: number) => `  ${mg}: ${sets} serii`,
  aiPromptWeeklyNoSessions: 'Brak sesji w tym tygodniu.',
  aiPromptWeeklyNoData: 'Brak danych',

  // ── AI weekly report full prompt ──
  aiPromptWeeklyReportBuild: (
    weekCount: number,
    weekSummary: string,
    totalReps: number,
    streakWeeks: number,
    repsChangePct: string | number,
    volumeByMuscle: string,
  ) => `Stwórz cotygodniowy raport treningowy dla użytkownika.

SESIONJE W TYM TYGODNIU (${weekCount}):
${weekSummary}

POWTÓRZENIA łącznie W TYM TYGODNIU: ${totalReps}
SERIA: ${streakWeeks} tygodni
ZMIANA POWT. TYGODNIOWO %: ${repsChangePct}

SERIE TYGODNIOWO WG GRUPY MIĘŚNIOWEJ:
${volumeByMuscle}

Punkty odniesienia objętości (Israetel & Hoffmann):
- MEV (Minimalna Efektywna Objętość): 10 serii/grupę mięśniową/tydzień
- MAV (Maksymalna Adaptacyjna Objętość): 15-25 serii/grupę mięśniową/tydzień
- MRV (Maksymalna Odzyskiwalna Objętość): 20-30+ serii/grupę mięśniową/tydzień

Wytyczne:
- W "improvements" oznacz grupy mięśniowe poniżej MEV (10 serii) jako niedotrenowane
- W "improvements" oznacz grupy mięśniowe powyżej MRV (30 serii) jako potencjalne przetrenowanie
- W "recommendation" zaproponuj konkretną korektę na następny tydzień na podstawie objętości vs punkty odniesienia
- Jeśli seria wynosi 0, zachęć do konsekwencji; jeśli seria to 4+ tygodni, rozważ deload

Odpowiedz w JSON:
{
  "summary": "1 zdanie podsumowania",
  "strengths": ["1-2 pozytywne obserwacje"],
  "improvements": ["1-2 obszary do poprawy"],
  "recommendation": "1 konkretna rekomendacja na następny tydzień"
}

Napisz po ${pl.aiPromptLanguageHint}. Bądź konkretny i zachęcający.`,

  // ── Delete session from history ──
  sessionDelete: 'Usuń trening',
  sessionDeleteConfirm: 'Usunąć ten trening z historii? Tej operacji nie można cofnąć.',
  sessionDeleteConfirmTitle: 'Usunąć trening?',
  sessionDeletedToast: 'Trening usunięty z historii.',
  sessionDeleteError: 'Nie udało się usunąć treningu.',
}

export type Translation = typeof plDict

/**
 * Proxy that reads from the active dictionary (PL or EN based on user setting).
 * All 123+ files importing { pl } from '@/i18n/pl' get localized strings
 * without any refactor. When no active dict is set (e.g. before store hydration),
 * falls back to the Polish dictionary.
 */
export const pl = new Proxy(plDict, {
  get(_target, prop, receiver) {
    const active = getActiveDict()
    if (active) {
      return Reflect.get(active, prop, receiver)
    }
    return Reflect.get(plDict, prop, receiver)
  },
})
