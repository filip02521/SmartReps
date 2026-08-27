export const pl = {
  appName: 'SmartReps',
  tagline: 'Twój inteligentny trener powtórzeń',

  // Dashboard
  ready: 'Gotowy do treningu',
  rest: 'Przerwa',
  test: 'Wykonaj test',
  restart: 'Restart cyklu',
  startDay: (n: number) => `Rozpocznij Dzień ${n}`,
  continueWorkout: (day: number, set: number, total: number) =>
    `Kontynuuj Dzień ${day} — seria ${set}/${total}`,
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
  menuHistory: 'Historia',
  menuRetest: 'Wykonaj test',
  staleSession: 'Sesja sprzed ponad 24 h — kontynuuj lub zacznij od nowa.',
  startFresh: 'Zacznij od nowa',
  notConfigured: 'Nie skonfigurowano',
  startSetup: 'Rozpocznij setup',
  setupNextProgram: (name: string) => `Skonfiguruj ${name}`,

  // Workout
  done: 'Zrobione',
  retry: 'Spróbuj jeszcze raz',
  finishDay: 'Zakończ dzień',
  cancelWorkout: 'Anuluj trening',
  cancelWorkoutConfirm: 'Postęp tej sesji zostanie utracony. Anulować trening?',
  lastTime: (actual: number, target: number) => `Ostatnio: ${actual}/${target}`,
  restLabel: 'Przerwa',
  nextSet: (n: number, reps: number, unit: string) =>
    `Następnie: Seria ${n} · ${reps} ${unit}`,
  workoutHint: 'Tap Zrobione = osiągnąłeś cel',
  skipRestConfirm: 'Pominąć przerwę i przejść do następnej serii?',
  leaveWorkoutConfirm: 'Trening w toku. Wyjść? Postęp sesji zostanie zapisany.',
  previewDayPlan: 'Podgląd planu dnia',
  helpTechnique: 'Pomoc techniki',
  negativeCountdown: (sec: number) => `Opuszczanie · ${sec}s`,

  // Test
  testPushups: 'Test pompek',
  testPullups: 'Test podciągania',
  testPrompt: 'Ile powtórzeń zrobisz za jednym razem na pełnej amplitudzie?',
  testHonesty: 'Nie oszukuj — lepiej zacząć niżej.',
  testPullupRules:
    'Licz tylko pełne powtórzenia — broda nad drążkiem. Ostatnie niepełne nie wliczaj.',
  cantPullup: 'Nie umiem się podciągnąć',
  warmup: 'Rozgrzewka (wymagana)',
  warmupRequired: 'Zaznacz wszystkie punkty rozgrzewki przed testem.',
  warmupItems: ['Wymachy ramion', 'Skręty tułowia', '10 lekkich pompek'],
  nextPickCycle: 'Dalej — wybierz cykl',
  testBlockedRest: 'Poczekaj co najmniej 2 dni przerwy przed i po teście max.',

  // Disclaimer
  healthDisclaimer:
    'Przed rozpoczęciem programu skonsultuj się z lekarzem, jeśli masz problemy zdrowotne, urazy stawów lub kręgosłupa.',
  healthAccept: 'Rozumiem i chcę kontynuować',

  // Cycle picker
  pickLevel: 'Wybierz swój poziom',
  recommended: 'Dla Ciebie',
  saferStart: 'Bezpieczniejszy start',
  higherLevelWarning:
    'Twój test sugeruje niższy poziom. Przedwczesne przeskoczenie może prowadzić do niepowodzeń i restartów. Kontynuować?',
  backToRecommended: 'Wróć do rekomendacji',
  understandHigher: 'Rozumiem, zaczynam wyżej',
  previewPlan: 'Podgląd planu',
  previewDay1: 'Podgląd dnia 1',
  previewFullCycle: 'Zobacz pełny cykl',
  warmupRecommended: 'Rozgrzewka zalecana — możesz kontynuować bez zaznaczania.',
  tabRecords: 'Rekordy',
  recordBestTest: 'Najlepszy test',
  recordBestMaxSet: 'Najlepsza seria max',
  recordBestSession: 'Najwięcej reps (sesja)',
  recordHighestCycle: 'Najwyższy osiągnięty cykl',
  postTestRest: 'Po teście zalecana 2-dniowa przerwa przed pierwszym treningiem nowego cyklu.',
  staleSessionTitle: 'Stara sesja treningowa',
  staleSessionConfirm: 'Kontynuować przerwaną sesję sprzed ponad 24 h?',
  cycleDayPreview: 'Podgląd dnia',
  showAllCycles: 'Pokaż wszystkie poziomy',
  hideOtherCycles: 'Ukryj inne poziomy',
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
  cycleComplete: 'Cykl ukończony!',
  cycleCompleteHint: 'Po przerwie wykonaj test max, aby wybrać kolejny poziom.',
  goalAchieved: 'Cel osiągnięty!',
  totalReps: 'Łącznie',
  nextWorkoutIn: (days: number) =>
    days === 1 ? 'Następny trening: jutro' : `Następny trening: za ${days} dni`,
  backHome: 'Wróć do SmartReps',
  continueSetup: 'Kontynuuj konfigurację',
  techniqueContinueTest: 'Rozumiem — kontynuuj test',
  techniqueContinueWorkout: 'Rozumiem — wróć do treningu',
  retestNow: 'Wykonaj test max',
  login: 'Zaloguj się',
  addProgram: 'Dodaj program',
  addProgramPushups: 'Dodaj pompki',
  addProgramPullups: 'Dodaj podciąganie',
  prevColumn: 'Poprz.',

  // Units
  pushups: 'pompek',
  pullups: 'podciągnięć',
  pushupsProgram: 'Pompki',
  pullupsProgram: 'Podciąganie',

  // Empty
  firstWorkout: 'Twój pierwszy trening czeka',

  // Offline
  offline: 'Offline · zapiszesz po połączeniu',

  // Timer
  skipRest: 'Pomiń',
  add15s: '+15s',
  add30s: '+30s',
  collapseTimer: 'Zwiń',

  // Progress
  recordTest: 'Rekord testu',
  cycleDays: 'Dni ukończone',
  sessionsTotal: 'Sesje',
  totalRepsLabel: 'Reps łącznie',
  streakWeeks: 'Streak (tyg.)',
  tabOverview: 'Przegląd',
  tabHistory: 'Historia',
  tabCycle: 'Cykl',
  maxSetPerDay: 'Seria max (ostatnia) per dzień',
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
  toastDayComplete: 'Dzień ukończony — świetna robota!',
  toastExportDone: 'Historia wyeksportowana do CSV',
  toastSyncDone: 'Zsynchronizowano z chmurą',
  toastSyncFailed: 'Synchronizacja nie powiodła się — spróbuj ponownie online',
  continueToLogin: 'Kontynuuj — zapisz postęp',
  testPendingBlocked: 'Cykl ukończony — wykonaj test max, aby wybrać kolejny poziom.',
  totalRepsDelta: (n: number) => `${n > 0 ? '+' : ''}${n} vs poprzednia sesja`,

  // Plans — resistance bands
  resistanceBandsTitle: 'Gumy oporowe (podciąganie)',
  resistanceBandsIntro:
    'Jeśli nie podciągasz się jeszcze samodzielnie, możesz zacząć od wariantu z gumą — tak sugeruje program podciąganie.pl.',
  resistanceBandsTip1: 'Zacznij od grubszej gumy i stopniowo przechodź na cieńszą.',
  resistanceBandsTip2: 'Ustaw stopę/kolano w gumie tak, by wspomagała ruch w górę, ale nie robiła za Ciebie całej pracy.',
  resistanceBandsTip3: 'Licz tylko pełne powtórzenia — broda nad drążkiem, kontrolowane opuszczanie.',
  resistanceBandsNote: 'SmartReps śledzi cykle z podciaganie.pl; wariant z gumą traktuj jak trening techniczny uzupełniający.',

  // Profile
  appearance: 'Wygląd',
  themeSystem: 'System',
  themeDark: 'Ciemny',
  themeLight: 'Jasny',
  highContrast: 'Wysoki kontrast',
  trainingSettings: 'Trening',
  timerSound: 'Dźwięk timera',
  timerVibration: 'Wibracja',
  keepScreenOn: 'Podczas przerwy ekran nie gaśnie (gdy przeglądarka na to pozwala).',
  workoutReminders: 'Przypomnienia o treningu',
  workoutRemindersHint: 'Codzienne powiadomienie o 18:00 (wymaga zgody przeglądarki).',
  programs: 'Programy',
  changeLevelPushups: 'Zmień poziom — Pompki',
  changeLevelPullups: 'Zmień poziom — Podciąganie',
  retestPushups: 'Test pompek',
  retestPullups: 'Test podciągania',
  about: 'O aplikacji',
  logout: 'Wyloguj',
  account: 'Konto',
  notLoggedIn: 'Nie zalogowano — dane tylko na tym urządzeniu',

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
} as const
