import type { Translation } from './pl'

export const en: Translation = {
  appName: 'SmartReps',
  tagline: 'Your smart rep trainer',
  splashTagline: 'Training that tracks progress',

  // Dashboard
  ready: 'Ready to train',
  dashboardSubtitle: 'Pick a program and start the day',
  homeChooseTraining: 'Choose a workout',
  homeChooseTrainingHint: 'Tap a program card to get started.',
  homeYourPrograms: 'Your programs',
  homeAddSecondProgram: 'Add a second program',
  homeSessions14d: 'Workouts',
  homeSessions14dHint: '14 days',
  homeReps14d: 'Reps',
  homeReps14dHint: '14 days',
  homeGoal3in14: '3 workouts in 14 days',
  homeActivityTitle: 'Your activity',
  homeStreakWeeksHint: 'current streak',
  homeInsightNoActivity: 'No workouts in a month — time to get back on track.',
  homeRepsChangeUp: 'Making progress — more reps',
  homeRepsChangeDown: 'Fewer reps than before',
  homeRepsChangeSame: 'Steady — same rep count',
  homeRepsChangeNew: (reps: number) => `${reps} reps — back after a break`,
  homeRepsBadgeUp: (pct: number) => `+${pct}% reps`,
  homeRepsBadgeDown: (pct: number) => `−${pct}% reps`,
  homeRepsBadgeSame: 'No change',
  homeRepsBadgeNew: 'Back after a break',
  homeActivityRepsEarlier: (previous: number) => `previously ${previous} reps`,
  homeActivitySessionsEarlier: (previous: number) => {
    const label = previous === 1 ? '1 workout' : `${previous} workouts`
    return `previously ${label}`
  },
  /** @deprecated Prefer homeActivityRepsEarlier — kept for any residual imports */
  homeActivityRepsCompare: (current: number, previous: number) =>
    `${current} reps · previously ${previous}`,
  homeActivitySessionsCompare: (current: number, previous: number) => {
    const label = (n: number) => (n === 1 ? '1 workout' : `${n} workouts`)
    return `${label(current)} · previously ${previous}`
  },
  homeBestStreakRecord: (n: number) =>
    n === 1 ? 'Your record: 1 week of training' : `Your record: ${n} weeks of training`,
  homeActivityInsightsAria: 'Activity trend',
  homeProgramsQuickTitle: 'Programs overview',
  homeProgramsQuickHint: 'Tap to jump to the full program card.',
  homeStatusResume: 'Finish your started workout',
  homeStatusResumeStale: 'You have an unfinished workout — check the card below',
  homeStatusResumeAndReady: 'Finish your workout or pick another program',
  homeStatusTestReady: 'Time for a max test',
  homeStatusTestRest: (when: string) => `Test after rest — ${when}`,
  homeStatusReady: 'You can train today',
  homeStatusRestHeadline: 'Rest day',
  homeStatusRestSubtitle: (when: string) => `Next workout: ${when}`,
  homeStatusAllPaused: 'Programs paused — resume when you\'re ready',
  homeStatusSetup: 'Programs waiting for setup — when you\'re ready',
  homeStatusSetupMixed: 'Resume a program or finish setup',
  homeStatusFallback: 'Your training plan',
  homeProgramLevelDay: (level: string, day: number, total: number) =>
    level ? `Level ${level} · Day ${day} of ${total}` : `Day ${day} of ${total}`,
  homeCycleRestart: (n: number) => `Cycle attempt ${n}`,
  homeTodaySession: 'Today\'s plan',
  homeCustomTodaySession: 'Today\'s workout',
  homeInProgressSets: (set: number, total: number, day: number) =>
    `Set ${set}/${total} · Day ${day}`,
  homeNowDay: (n: number) => `Now: day ${n}`,
  homeProgramPaused: 'Program paused',
  homeTipTestRest: (when: string, other = '') =>
    `Available ${when}. Rest today${other}.`,
  homeTipTestRestOther: ' or train your second program',
  homeCardTestRestHint: (when: string) => `Test will be available ${when}.`,
  homeTipTestReady: 'Finish the cycle — test your 1RM and set new weights.',
  homeTipHabitZeroFirst: 'Start with the card below — the app will guide you from there.',
  homeTipHabitZero: 'No workouts in the last 14 days.',
  homeTipHabitMet: '3 workouts in 14 days — good rhythm.',
  homeTipReturnAfterBreak: (days: number) =>
    `${days} days off. Ease back in with a light workout.`,
  homeTipHabitAlmost: (remaining: number) =>
    `${remaining} to go for 3 workouts in 14 days.`,
  homeTipDualProgram: 'Your second program needs a max test and level — set it up when you\'re ready.',
  homeTipDualCta: 'Set up',
  homeTipLoginBackup:
    'You\'re training locally — log in to back up your progress to the cloud across devices.',
  homeTipShowCard: 'Show card',
  homeTipTitleDefault: 'Tip',
  homeTipTitleStale: 'Unfinished session',
  homeTipTitleTestReady: 'Time for a max test',
  homeTipTitleTestRest: 'Max test coming soon',
  homeTipTitleLevel: 'Consider a lower level',
  homeTipTitleReturnAfterBreak: 'Long time no see',
  homeTipTitleHabitAlmost: 'Almost there',
  homeTipTitleDualProgram: 'Set up your second program',
  homeTipTitleLoginBackup: 'Cloud backup',
  homeTipTitleHabitZero: 'Time to come back',
  homeTipTitleHabitZeroFirst: 'First workout',
  homeTipTitleHabitMet: 'Goal met',
  trainAnywayNew: 'Train anyway',
  abandonResumeTrainAnywayTitle: 'Abandon unfinished session?',
  abandonResumeTrainAnywayBody:
    'You\'ll start the Day from scratch despite the break. Rest will count from today after this workout.',
  abandonOrTrainAnywayTitle: 'Unfinished session',
  abandonOrTrainAnywayBody: 'You can abandon the session or train right away despite the break.',
  abandonOnly: 'Abandon session',
  abandonAndTrain: 'Abandon and train anyway',
  forceRestRestartHint: 'Rest will count from today after this workout.',
  testPendingRestLabel: (when: string) => `Test in ${when}`,
  cycleDoneTestLabel: 'Cycle complete — test',
  statusInProgress: 'In progress',
  continueSession: 'Continue session',
  resumeDespiteRestHint:
    'You have an unfinished workout — you can complete it despite the recommended rest.',
  noProgramsTitle: 'Your workout, your rules',
  noProgramsDesc: 'Start with your own plan — or enable pushups / pull-ups in your profile.',
  noProgramsCreatePlan: 'Create a plan',
  noProgramsGoProfile: 'Enable a training program',
  goToProfile: 'Go to profile',
  rest: 'Rest',
  test: 'Take test',
  restart: 'Restart cycle',
  startDay: (n: number) => `Start Day ${n}`,
  continueWorkout: (day: number, set: number, total: number) =>
    `Continue Day ${day} — set ${set}/${total}`,
  resumePromptTitle: 'You have an unfinished workout',
  resumePromptBodyBuiltin: (day: number, set: number, total: number) =>
    `Day ${day} · set ${set}/${total}. Resume?`,
  resumePromptBodyCustom: (planName: string, day: number) =>
    `${planName} · Day ${day}. Resume?`,
  resumePromptResume: 'Resume',
  resumePromptSkip: 'Dismiss',
  restIn: (days: number) =>
    days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`,
  restBlocked: (when: string) => `Too soon · workout available ${when}`,
  trainAnyway: 'Train anyway',
  crossTraining: 'You can do pushups on rest days',
  crossTrainingCta: 'Go to Pushups',
  lastWorkout: 'Last workout',
  nextWorkout: 'Next',
  maxSetTrend: 'Max set (latest)',
  menuChangeLevel: 'Change level',
  menuFullCycle: 'Full cycle',
  menuCycleMap: 'Cycle map',
  menuPlanMap: 'Plan map',
  menuHistory: 'History',
  menuSkipRest: 'Skip rest (train today)',
  restDaySkipped: 'Rest skipped — you can train.',
  warmupTitle: 'Warm-up',
  warmupHint: 'Suggested warm-up sets before your first working set.',
  warmupSetRepsWeight: (reps: number, weight: number, unit: string) => `${reps} reps × ${weight} ${unit}`,
  warmupSetReps: (reps: number) => `${reps} reps (lighter)`,
  warmupSetDuration: (sec: number) => `${sec} s (lighter)`,
  menuRetest: 'Take test',
  staleSession: 'Session from over 24 hours ago — continue or start fresh.',
  staleSessionShort: 'Session 24h+ old',
  startFresh: 'Start fresh',
  notConfigured: 'Needs setup',
  notConfiguredHint: 'Max test and level — when you\'re ready.',
  startSetup: 'Start setup',
  setupNextProgram: (name: string) => `Set up ${name}`,

  // Workout
  done: 'Done',
  retry: 'Try again',
  finishDay: 'Finish day',
  cancelWorkout: 'Cancel workout',
  cancelWorkoutConfirm: 'Progress from this session will be lost. Cancel workout?',
  cancelWorkoutConfirmEmpty: 'Cancel workout with no saved sets?',
  cancelWorkoutConfirmAction: 'Abandon session',
  leaveWorkoutMenu: 'Leave (save)',
  sessionNoteLabel: 'Note',
  sessionNotePlaceholder: 'How did it feel? What to improve next time?',
  sessionNoteHint: 'Optional — remember the context of this workout.',
  sessionNoteSave: 'Save note',
  sessionNoteEdit: 'Edit note',
  sessionNoteEmpty: 'No note',
  sessionNoteInMenu: 'Add note',
  leaveWorkoutConfirm: 'Workout in progress. Leave? Session progress will be saved.',
  leaveWorkoutTitle: 'Leave workout?',
  leaveWorkoutConfirmAction: 'Leave and save',
  lastTime: (actual: number, target: number) => `Last time: ${actual}/${target}`,
  lastTimeOnly: (actual: number | string) => `Last time: ${actual}`,
  setDeltaUp: (delta: number) => `+${delta} ▲`,
  setDeltaDown: (delta: number) => `−${delta} ▼`,
  setDeltaEqual: '= ▬',
  restLabel: 'Rest',
  nextSet: (n: number, reps: number, unit: string) =>
    `Next: Set ${n} · ${reps} ${unit}`,
  nextSetWithPrevious: (n: number, reps: number, unit: string, prev: number) =>
    `Next: Set ${n} · ${reps} ${unit} · Last: ${prev} ${unit}`,
  workoutHint:
    'Set your rep count, then press Done. Target = success; below target = failed set. "Exactly N" sets require exactly N.',
  workoutFailBanner: (actual: number, target: number) =>
    `Target ${target}, done ${actual} — set failed`,
  workoutFailExactBanner: (actual: number, target: number) =>
    `Required exactly ${target}, done ${actual} — set failed`,
  exactLiveHint: (n: number) => `Required exactly ${n} — no more, no less`,
  restInProgress: 'Rest in progress — wait or open the timer.',
  skipRestConfirm: 'Skip rest and go to the next set?',
  restPresetAria: (sec: number) => `Set rest time to ${sec} seconds`,
  previewDayPlan: 'Day exercises',
  previewDayPlanHint: 'Tap an exercise to jump to it — when the machine is taken.',
  previewWorkoutTitle: 'Workout preview',
  previewStartWorkout: 'Start workout',
  previewChooseDay: 'Choose day',
  previewCurrentDay: 'Current',
  previewSetsLabel: 'Sets',
  previewCustomSummary: (exercises: number, sets: number) => {
    const exLabel = exercises === 1 ? '1 exercise' : `${exercises} exercises`
    const setsLabel = sets === 1 ? '1 set' : `${sets} sets`
    return `${exLabel} · ${setsLabel}`
  },
  previewRounds: (n: number) =>
    n === 1 ? '1 round' : `${n} rounds`,
  previewAddSet: 'Add set',
  previewRemoveSet: 'Remove set',
  previewEdited: 'edited',
  previewChangesNote: 'Changes apply to this workout only — the plan won\'t be overwritten.',
  restBetweenSetsLabel: 'Rest between sets',
  setsShort: 'sets',
  customWorkoutSwitchTo: (name: string) => `Switch to: ${name}`,
  customWorkoutSwitchExerciseMenu: 'Switch exercise',
  helpTechnique: 'Technique tips',
  negativeCountdown: (sec: number) => `Prepare to lower · ${sec}s`,
  negativeBanner: 'Lower slowly (3–5 s). Full range of motion is what counts.',
  restBetweenSets: (sec: number) => `Rest between sets: ${sec}s`,
  setColumn: 'Set',
  targetColumn: 'Target',
  youColumn: 'You',
  editPreviousSet: 'Edit previous set',
  editPreviousSetHint: 'Go back to the last set to change your rep count.',
  editShort: 'Edit',

  // Test
  testPushups: 'Pushup test',
  testPullups: 'Pull-up test',
  testPrompt: 'How many reps will you do in one go at full range of motion?',
  testHonesty: 'Don\'t cheat — better to start lower.',
  testPullupRules:
    'Count only full reps — chin above the bar. Don\'t count partials.',
  cantPullup: 'I can\'t do a pull-up',
  warmup: 'Warm-up (required)',
  warmupRequired: 'Check all warm-up items before the test.',
  warmupItemsPushups: ['Arm swings', 'Torso twists', '10 light pushups'],
  warmupItemsPullups: ['Arm swings and shoulder circles', 'Scapular pull-ups', '10–15 s dead hang'],
  nextPickCycle: 'Next — pick a cycle',
  testBlockedRest: 'Wait at least 2 days of rest before and after a max test.',
  setupProgress: 'Setup progress',
  setupStepTest: 'Test',
  setupStepCycle: 'Level',
  setupStepStart: 'Start',
  setupStepLogin: 'Account',
  setupStepCurrent: 'current step',
  restoringSetup: 'Restoring setup…',
  lessReps: 'Fewer',
  moreReps: 'More',
  back: 'Back',
  next: 'Next',
  ok: 'OK',
  repsUnit: 'reps',
  failedShort: 'failed',
  passedShort: 'passed',
  incompleteShort: 'incomplete',
  abandonedShort: 'abandoned',
  filterEmptyHistory: 'No sessions for the selected filters.',
  filterEmptyHistoryHint: 'Change the filters or clear them.',
  progressCustomHistoryEmptyHint: 'History will appear after your first completed workout.',
  sessionSummaryMissingTitle: 'No summary',
  clearFilters: 'Clear filters',
  statusReady: 'Ready',
  statusRest: 'Rest',
  statusTest: 'Test',
  statusRestart: 'Restart',
  statusPaused: 'Paused',
  heatmapSummary: (n: number, weeks: number) =>
    n === 1
      ? `1 workout in the last ${weeks} weeks`
      : `${n} workouts in the last ${weeks} weeks`,
  loginTitle: 'Save progress to the cloud',
  loginTitleReturning: 'Restore progress from the cloud',
  loginSubtitle: 'Optional — you can skip and train without an account on this device.',
  loginSubtitleReturning:
    'Log in with the same email as on other devices — your progress and programs will sync automatically.',
  loginEmailLabel: 'Email',
  loginEmailPlaceholder: 'jan@example.com',
  loginSendCode: 'Send code to email',
  loginSendLink: 'Send code to email',
  loginSent: 'Check your inbox — enter the code from the email below.',
  loginSentCode: 'Code sent. Enter it below to log in.',
  loginSentTo: (email: string) => `Sent to ${email}`,
  loginOtpLabel: 'Email code',
  loginOtpAriaGroup: 'Verification code',
  loginOtpAriaDigit: (n: number) => `Digit ${n}`,
  loginOtpPlaceholder: '000000',
  loginOtpHint: '6-digit code from the SmartReps email (SR@ontime.mikran.pl).',
  loginVerifyCode: 'Log in with code',
  loginVerifying: 'Verifying...',
  loginSending: 'Sending...',
  loginOtpInvalid: 'Invalid or expired code. Check your email and try again.',
  loginResendCode: 'Resend code',
  loginResendWait: (seconds: number) => `Resend in ${seconds} s`,
  loginOtpRateLimited: (seconds: number) =>
    `Code already sent — wait ${seconds} s and try again (or check your inbox).`,
  loginPwaCodeHint:
    'Enter the 6-digit code from the email here — that\'s how you log in after adding SmartReps to your home screen.',
  loginBrowserLinkHint:
    'If you don\'t see the message, check your Spam / Promotions folder. Sender: SmartReps (SR@ontime.mikran.pl).',
  loginSkip: 'Skip — train without an account',
  loginInvalidEmail: 'Enter a valid email address.',
  loginPwaHint:
    'In the home screen app, log in with the 6-digit code from the email.',
  loginAlreadySignedIn: 'You are logged in as',
  loginContinue: 'Continue',
  loginLogoutToSwitch: 'Log out to use a different account',
  loginLogoutToSwitchHint: 'Log out first, then send a code to a different email address.',
  loginLogoutToSwitchDone: 'Logged out. You can now log in with a different account.',
  backToOnboarding: 'Back to setup',
  accountSwitchCleared:
    'Logged in with a different account — local data on this device was cleared before syncing.',
  accountSwitchConfirmTitle: 'Different account',
  accountSwitchConfirmMessage:
    'This device has another user\'s progress saved. Clear local data to sync this account, or cancel and log in to the right account.',
  accountSwitchClearLocal: 'Clear local and continue',
  accountSwitchCancel: 'Cancel — log out',
  accountSwitchWrongAccount: 'This isn\'t my account',
  accountSwitchWrongAccountToast:
    'Logged out. Log in with the correct email address to sync your data.',
  onboardingWelcome: 'Welcome to SmartReps',
  onboardingNewUser: 'Let\'s start',
  onboardingHaveAccount: 'I already have an account',
  onboardingInterestTitle: 'What do you want to train?',
  onboardingInterestStrongTitle: 'Pushups and pull-ups',
  onboardingInterestStrongBody:
    'Ready-made cycles: max rep test, level selection, training days and rest between sets. From zero to 100 pushups and 20 pull-ups.',
  onboardingInterestCustomTitle: 'Custom plans',
  onboardingInterestCustomBody:
    'Build your own exercises — gym, machines, dumbbells, home workouts. Or import a ready-made plan from the catalog.',
  onboardingPickProgram: 'Which program to enable?',
  onboardingEnterApp: 'Go to Training',
  onboardingIllustReps: 'Set 2/5',
  onboardingIllustDone: 'Done',
  onboardingLanguageAria: 'Choose language',
  onboardingWelcomeTagline: 'Your personal coach in your pocket. Plan, analysis and progression — offline.',
  onboardingPushupsDesc: 'From a max test to 100 pushups — step by step',
  onboardingPullupsDesc: 'From your first pull-up to 20 and beyond — progressively',
  onboardingReadyLine: 'Your plan is ready. Shall we start?',
  onboardingIllustDay: 'D3',
  onboardingInterestHintStrong: 'Pick one, both, or neither — you can always change later',
  onboardingProgramsHint: 'Pick one or both — test and level come later',
  onboardingNextTitleReady: 'All set',
  onboardingNextSummary: (choices: string) => `You chose: ${choices}`,
  onboardingNextSummaryStrong: 'pushup & pull-up programs',
  onboardingNextSummaryCustom: 'custom plans',
  onboardingNextSummaryNone: 'browse only',
  onboardingNextBulletHome: 'Training screen — you decide when to work out',
  onboardingNextBulletStrong: 'Launch the program from its card. With two, test separately',
  onboardingNextBulletCustom: 'Add custom plans in the Plans tab',
  onboardingNextBulletCommunity: 'Import ready-made plans from the catalog',
  onboardingNextBulletAiProgress: 'AI Coach analyzes workouts; charts, records and badges track progress',
  onboardingSlide1Title: 'Ready-made training cycles',
  onboardingSlide1Desc: 'From a max test to 100 pushups — every day planned.',
  onboardingSlide2Title: 'AI Coach',
  onboardingSlide2Desc: 'Workout analysis, weekly reports and suggestions.',
  onboardingSlide3Title: 'Progress & badges',
  onboardingSlide3Desc: 'Charts, records and badges track every step.',
  onboardingAiPreviewWeek: 'Week 4',
  onboardingAiPreviewSuggestion: 'Suggestion: add 1 pull-up session for balance',
  onboardingAiPreviewCoachName: 'SmartReps Coach',
  onboardingAiPreviewSummary: 'Great week — volume and progress on track. Keep it up!',
  onboardingAiPreviewStrength: 'Pushup endurance growing 3 weeks in a row',
  onboardingAiPreviewStrengthLabel: 'Strengths',
  onboardingAiPreviewSuggestionLabel: 'Coach suggestion',
  onboardingAiPreviewStatSessions: 'Sessions',
  onboardingAiPreviewStatVolume: 'Volume',
  onboardingAiPreviewStatPr: 'PR',
  onboardingBadgeFirst100: 'First 100',
  onboardingBadgeStreak: 'Weekly streak',
  onboardingBadgePr: 'PR breaker',
  onboardingBadgeCycle: 'Cycle complete',
  onboardingChartLabel: '8 wks.',
  onboardingChartReps: 'reps',
  onboardingCarouselAria: 'Scroll slides — app features',
  onboardingSlideAria: (current: number, total: number) => `Slide ${current} of ${total}`,
  onboardingSwipeHint: 'Swipe to see more',
  restGateHint: (days: number) =>
    days === 1 ? '1 day of rest between workouts' : `${days} days of rest between workouts`,
  totalRepsLastSession: (n: number) => `${n} reps total (last workout)`,
  cycleDoneDays: (done: number, total: number) => `Cycle complete · ${done}/${total} days`,
  dayOfTotal: (day: number, total: number) => `Day ${day}/${total}`,
  attemptLabel: (n: number) => `Attempt ${n}`,
  pickLevelCta: 'Pick this level',
  menuProgram: 'Program menu',
  menuCustomPlan: 'Plan menu',
  menuWorkout: 'Workout menu',
  errorSaveSet: 'Failed to save the set. Try again.',
  errorLoadProgram: 'Failed to load the program. Try again.',
  errorLoadProgress: 'Failed to load progress. Try again.',
  errorLoadHome: 'Failed to load the home screen. Try again.',
  errorLoadPage: 'Failed to load the page. Try again.',
  errorLoadPlans: 'Failed to load plans. Try again.',
  errorLoadSummary: 'Failed to load the summary. Try again.',
  errorStartWorkout: 'Failed to start the workout. Try again.',
  errorFinishDay: 'Failed to finish the day. Try again.',
  errorNoPlan: 'No training plan found for this program.',
  errorNoWorkoutData: 'No workout data. Go back to the Training screen and try again.',
  errorSendLink: 'Failed to send the code. Try again.',
  errorProgramPaused: 'This program is paused. Resume it in your profile to train.',
  notFoundTitle: 'Page not found',
  notFoundBody: 'This URL doesn\'t exist in SmartReps. Go back to the Training screen.',
  chartTestOverTime: 'Max test over time',
  cycleMapTitle: (name: string) => `Cycle map — ${name}`,
  techniqueTitle: 'Technique — knee pushups',
  techniqueStep1: 'Place your hands shoulder-width apart, body in a straight line from knees to head.',
  techniqueStep2: 'Lower slowly, keeping your elbows close to your torso.',
  techniqueStep3: 'Push back up to the starting position — full range of motion.',
  retestSubtitle: 'Check your progress and pick the next cycle after the test.',
  howToPushup: 'How to do a pushup?',
  howToPullup: 'Pull-up technique',
  techniquePullupsTitle: 'Pull-up technique',
  techniquePullupsStep1:
    'Grip shoulder-width apart, active shoulder blades — "pull" them down before starting.',
  techniquePullupsStep2:
    'Pull up so your chin clears the bar. Avoid "kipping" movements.',
  techniquePullupsStep3:
    'Lower with control — full range of motion builds strength for the next rep.',
  techniquePullupsPoseHang: 'Hang',
  techniquePullupsPoseTop: 'Top',
  techniquePullupsPoseBottom: 'Bottom',
  helpTechniquePullups: 'Pull-up technique',
  plansAttribution: 'SmartReps implements plans from 100pompek.pl and podciaganie.pl',
  noPlans: 'No training plans.',
  dayFailedRestart: (attempt: number) =>
    `After rest you'll return to day 1 of this cycle (attempt ${attempt}).`,
  healthTitle: 'Health and safety',
  tryAgain: 'Try again',
  sessionInProgress: 'in progress',
  helpTechniquePushups: 'Pushup technique',
  retestAfterCycle: (program: string) => `Test after cycle — ${program}`,
  mainNav: 'Main navigation',
  skipToMain: 'Skip to content',

  // SEO — dynamic per-route metadata
  seoDefaultDescription:
    'SmartReps — plan and track workouts at home and in the gym. Ready-made pushup and pull-up programs plus custom training plans. Works offline.',
  seoDashboardTitle: 'Training',
  seoDashboardDescription:
    'Your training dashboard — next workout, activity, sets and progress. Start a built-in or custom plan.',
  seoProgressTitle: 'Progress',
  seoProgressDescription:
    'Training stats, volume charts, activity calendar, records and badges. Track your progress step by step.',
  seoPlansTitle: 'Training plans',
  seoPlansDescription:
    'Custom training plans, ready-made pushup and pull-up programs, exercise library and community plan catalog.',
  seoProfileTitle: 'Profile',
  seoProfileDescription:
    'Account settings, appearance, notifications, body weight, badges and data and sync management.',
  seoPrivacyTitle: 'Privacy policy',
  seoPrivacyDescription:
    'SmartReps privacy policy — what data we collect, how we protect it and how you can manage it.',
  seoTermsTitle: 'Terms of service',
  seoTermsDescription:
    'Terms of service for the SmartReps app — rules for using workouts, plans and user accounts.',
  seoOnboardingTitle: 'Setup',
  seoOnboardingDescription:
    'SmartReps setup — choose a training program, pushups, pull-ups or custom plans.',
  seoLoginTitle: 'Login',
  seoLoginDescription:
    'Log in to SmartReps with an email OTP code. No Google or Facebook accounts.',
  seoTechniquePushupsTitle: 'Pushup technique',
  seoTechniquePushupsDescription:
    'Proper pushup technique — hand placement, elbows, tempo and common mistakes. A guide for beginners.',
  seoTechniquePullupsTitle: 'Pull-up technique',
  seoTechniquePullupsDescription:
    'Proper pull-up technique on the bar — grip, elbows, full range of motion. A guide for beginners.',
  seoNotFoundTitle: 'Page not found',
  seoNotFoundDescription: 'The page you\'re looking for doesn\'t exist. Go back to SmartReps.',

  // Disclaimer
  healthDisclaimer:
    'Before starting a program, consult a doctor if you have health issues, joint injuries or back problems.',
  healthAccept: 'I understand and want to continue',

  // Cycle picker
  pickLevel: 'Choose your level',
  levelChangeTitle: 'Change level',
  levelChangeSubtitle:
    'Pick a different range without retesting. If you\'d rather test your max first — use the test below.',
  levelChangeHint: 'A new cycle starts from day 1. Your previous workout history stays.',
  levelChangeCurrent: 'Current',
  levelChangeRestart: 'Restart from day 1',
  levelChangeDoTest: 'I\'d rather do a max test',
  levelChangeReady: 'Level changed',
  levelChangeRestHint:
    'You still have rest after your last workout — the new cycle will be available after it ends.',
  levelChangeLastTest: (reps: number, unit: string, recommended: string) =>
    `Last test: ${reps} ${unit} · based on result, fits: ${recommended}`,
  recommended: 'For you',
  saferStart: 'Safer start',
  higherLevelWarningTitle: 'Higher level',
  higherLevelWarning:
    'Your test result suggests a lower level. Jumping ahead too early can lead to failures and restarts. Continue?',
  backToRecommended: 'Back to recommendation',
  understandHigher: 'I understand, starting higher',
  previewPlan: 'Plan preview',
  previewDay1: 'Day 1 preview',
  previewFullCycle: 'See full cycle',
  recordBestMaxSet: 'Best max set',
  recordBestSession: 'Most reps in a session',
  recordHighestCycle: 'Highest cycle reached',
  postTestRest: 'After the test, a 2-day rest is recommended before the first workout of the new cycle.',
  firstTestReadyHint: 'After your first test you can start Day 1 right away — the 2-day rest applies to retests.',
  staleSessionTitle: 'Old workout session',
  staleSessionConfirm: 'Continue a session from over 24 hours ago?',
  showAllCycles: 'Show all levels',
  hideOtherCycles: 'Hide other levels',
  moreFilters: 'More filters',
  lessFilters: 'Fewer filters',
  retestTitle: 'Test result — pick the next cycle',
  repeatCycle: 'Repeat previous cycle',
  repeatPowyzej40: 'Repeat above-40 cycle',
  retestRecommend: (name: string) => `Recommended: ${name}`,

  // Program start
  programReady: 'Ready!',
  firstTraining: 'Your first workout:',
  startDay1: 'Start Day 1',
  backToPicker: 'Back to level picker',

  // Summary
  dayComplete: (n: number) => `Day ${n} complete`,
  dayFailed: 'Day failed',
  summarySectionStats: 'Stats',
  summarySectionSets: 'Sets',
  summarySectionNotes: 'Note',
  summarySectionAchievements: 'Achievements',
  prCelebrationTitle: 'New record!',
  prCelebrationSubtitle: 'You beat your personal record',
  prCelebrationBestSession: 'Most reps in a session',
  prCelebrationBestMaxSet: 'Best max set',
  prCelebrationMaxReps: (exercise: string) => `Most reps: ${exercise}`,
  prCelebrationMaxWeight: (exercise: string) => `Heaviest weight: ${exercise}`,
  prCelebrationMaxDuration: (exercise: string) => `Longest time: ${exercise}`,
  prCelebrationPrevious: (prev: number | string) => `Previous: ${prev}`,
  prCelebrationMore: (count: number) => `+${count} more`,
  prCelebrationRepsUnit: 'reps',
  prCelebrationWeightUnit: 'kg',
  prCelebrationDurationUnit: 's',
  prCelebrationDismiss: 'OK',

  // Workout celebration overlay — full-screen reward on session summary
  celebrationHeadlineDefault: 'Workout complete!',
  celebrationHeadlinePr: 'New record!',
  celebrationHeadlineAchievement: 'Achievement unlocked!',
  celebrationSubtitle: 'Great job — keep it up!',
  celebrationPrBadge: 'New personal record',
  celebrationAchievementBadge: 'New achievement',
  celebrationStreakBadge: (weeks: number) => `${weeks} wks in a row!`,
  celebrationStreakMilestone: (weeks: number) => `${weeks} wks — milestone!`,
  celebrationTapToContinue: 'Tap to continue',
  celebrationShare: 'Share',
  celebrationDayContext: (day: number, total: number) => `Day ${day} of ${total}`,
  celebrationStatReps: 'reps',
  celebrationStatSets: 'sets',
  celebrationStatExercises: 'exercises',
  celebrationStatDuration: 'minutes',
  celebrationStatVolume: 'volume',

  summaryHeroSuccess: 'Workout passed',
  summaryHeroFail: 'Try again',
  cycleComplete: 'Cycle complete!',
  cycleCompleteHint: 'After rest, take a max test to pick the next level.',
  goalAchieved: 'Goal achieved!',
  totalReps: 'Total',
  nextWorkoutIn: (days: number) =>
    days <= 0
      ? 'Next workout: today'
      : days === 1
        ? 'Next workout: tomorrow'
        : `Next workout: in ${days} days`,
  backHome: 'Back to SmartReps',
  continueSetup: 'Continue setup',
  techniqueContinueTest: 'I understand — continue test',
  techniqueContinueWorkout: 'I understand — back to workout',
  retestNow: 'Take a max test',
  login: 'Log in',
  addProgram: 'Add program',
  addProgramPushups: 'Add pushups',
  addProgramPullups: 'Add pull-ups',
  changeLevelActiveWarning:
    'You have a workout session in progress. Changing the level will delete this session. Continue?',
  prevColumn: 'Prev.',

  // Units
  pushups: 'pushups',
  pullups: 'pull-ups',
  negatives: 'negatives',
  pushupsProgram: 'Pushups',
  pullupsProgram: 'Pull-ups',

  dayLabel: (n: number) => `Day ${n}`,
  dayDoneCheck: (n: number) => `Day ${n} ✓`,
  testResultSubtitle: (reps: number, unit: string) => `Test: ${reps} ${unit}`,
  programReadySubtitle: (program: string, cycle: string) => `${program} · Cycle ${cycle}`,
  restSecAndSets: (sec: number) => `Rest: ${sec}s · Sets:`,
  attemptShort: (n: number) => `Attempt ${n}`,
  cycleNotConfigured: 'Set up the program to see the cycle map',
  configureProgram: 'Set up program',
  missingSession: 'No session data — go back to the Training screen',
  workoutHeader: (program: string, day: number, set: number, total: number) =>
    `${program} · Day ${day} · Set ${set}/${total}`,
  workoutElapsedAria: (time: string) => `Workout time ${time}`,
  workoutDuration: 'Workout time',
  customWorkoutSetTimeSec: 'Exercise time',
  customSessionDurationTotalHint: 'Total time from sets (e.g. plank)',

  // Empty
  firstWorkout: 'Your first workout awaits',
  startFirstWorkout: 'Start workout',

  // Offline
  offline: 'No network · will save when connected',

  // Timer
  skipRest: 'Skip',
  add15s: '+15s',
  add30s: '+30s',
  collapseTimer: 'Collapse',

  // Progress
  recordTest: 'Test record',
  cycleDays: 'Days completed',
  sessionsTotal: 'Sessions',
  totalRepsLabel: 'Total reps',
  streakWeeks: 'Weeks in a row',
  streakWeeksHint: 'current streak',
  streakHeatmapTitle: 'Training streak',
  streakHeatmapHint: 'Last 12 weeks — each cell is 1 week',
  streakHeatmapWeekLabel: (weekStart: string) => `Week of ${weekStart}`,
  streakHeatmapCellAria: (sessions: number, reps: number, weekStart: string) =>
    `Week of ${weekStart}: ${sessions} workouts, ${reps} reps`,
  streakHeatmapCurrentWeek: 'Current week',
  streakHeatmapLegendNone: 'None',
  streakHeatmapLegendLow: '1–3',
  streakHeatmapLegendMid: '4–6',
  streakHeatmapLegendHigh: '7+',
  streakHeatmapWeeksStreak: (weeks: number) => `${weeks} wk streak`,
  streakHeatmapMiniAria: (weeks: number) => `Training streak heatmap, ${weeks} weeks in a row`,
  streakHeatmapEmpty: 'No workouts in the last 12 weeks.',
  streakChainTitle: 'Your streak',
  streakChainWeeks: (weeks: number) =>
    weeks === 1 ? '1 week in a row' : `${weeks} wks in a row`,
  streakChainBest: (weeks: number) => `Best: ${weeks} wks`,
  streakChainNewRecord: 'New record!',
  streakChainAtRisk: 'Train this week to keep your streak alive!',
  streakChainKeepGoing: (weeks: number) =>
    weeks === 1 ? '1 more week to your next milestone' : `${weeks} more wks to a milestone`,
  streakChainMilestone: (weeks: number) => `Goal: ${weeks} wks`,
  streakChainEmpty: 'Start training to build your streak!',
  streakChainThisWeek: 'This week',
  streakChainAria: (current: number, best: number) =>
    `Training streak: ${current} weeks in a row, best: ${best} weeks`,
  // Streak detail sheet
  streakSheetTitle: 'Your streak',
  streakSheetCurrent: 'Current',
  streakSheetBest: 'Best',
  streakSheetTotal: 'Workouts',
  streakSheetMilestones: 'Milestones',
  streakSheetWeeksShort: 'wks',
  streakSheetMilestoneProgress: (weeksLeft: number, target: number) =>
    weeksLeft > 0
      ? `${weeksLeft} wks to reach ${target} wks goal`
      : `${target} wks goal reached!`,
  streakSheetAllMilestones: 'All milestones achieved — legendary!',
  // Streak recap card (session summary)
  streakRecapMilestone: (weeks: number) => `Milestone: ${weeks} weeks!`,
  streakRecapNewRecord: 'New streak record!',
  muscleBalanceTitle: 'Muscle balance',
  muscleBalanceHint: 'Weekly sets in the last 4 weeks',
  muscleBalanceOptimal: 'Optimal',
  muscleBalanceLow: 'Low',
  muscleBalanceMinimal: 'Minimal',
  muscleBalanceNone: 'None',
  muscleBalanceWeeklySets: (sets: number) => `${sets} sets/wk`,
  muscleBalanceWarning: 'Some muscle groups are undertrained — aim for a balanced plan.',
  muscleBalanceAria: 'Muscle group balance heatmap',
  muscleBalanceNoData: 'No workouts in the last 4 weeks — complete a session to see balance.',
  tabOverview: 'Overview',
  tabHistory: 'History',
  tabCycle: 'Cycle',
  progressSectionNav: 'Progress section',
  achievementsStatusCount: (n: number, total: number) => `${n} of ${total}`,
  // Unified Progress — new keys
  progressSourceAll: 'All',
  progressSourceBuiltin: 'Programs',
  progressSourceCustom: 'Custom',
  progressRecordsPrograms: 'Built-in programs',
  progressRecordsExercises: 'Custom exercises',
  exportAll: 'Export CSV',
  maxSetPerDay: 'Max set (latest) per day',
  sessionDetails: 'Session details',
  filterAll: 'All',
  filterPassed: 'Passed',
  filterFailed: 'Failed',
  filterCycleAll: 'All cycles',
  filterCycleCurrent: 'Current cycle',
  filterDateAll: 'All history',
  filterDate30: '30 days',
  filterDate90: '90 days',
  newRecord: 'Record!',
  activityHeatmap: 'Activity (12 weeks)',
  exportCsv: 'Export CSV',
  exportThisProgram: 'Export CSV for this program',
  exportAllPrograms: 'Export CSV for all programs',
  exportJsonBackup: 'Export backup (JSON)',
  exportBackupJson: 'Export backup (JSON)',
  importBackup: 'Import backup',
  importBackupTitle: 'Import backup',
  importBackupHint: 'Select a CSV file (sessions) or JSON (full backup). Duplicates can be skipped or overwritten.',
  importChooseFile: 'Choose file',
  importMergeSkipDuplicates: 'Import (skip duplicates)',
  importReplaceDuplicates: 'Overwrite duplicates',
  importReplaceConfirmTitle: 'Overwrite existing data?',
  importReplaceConfirmBody:
    'Existing sessions or newer local progress may be replaced with data from the file. This operation cannot be undone.',
  importFileTooLarge: 'File is too large (max 5 MB).',
  importInvalidFile: 'Unrecognized backup format.',
  importSuccess: 'Backup imported.',
  importCsvDuplicatesHint: 'Duplicates (same session ID) will be skipped.',
  importProgressConflictHint: 'Program progress will be merged — the newer entry wins.',
  importProgressConflictTitle: 'Merge program progress?',
  importActiveWorkoutSkipped:
    'A workout is in progress locally — the active workout state from the file will be skipped.',
  importActiveWorkoutConfirmTitle: 'Cancel current workout?',
  importActiveWorkoutConfirmBody:
    'A workout is in progress on this device. Importing will replace it with the state from the backup file. This operation cannot be undone.',
  importCsv: 'Import sessions (CSV)',
  importJson: 'Restore from JSON',
  importConfirmTitle: 'Confirm import',
  importConfirm: 'Import',
  importCsvPreview: (add: number, skip: number) =>
    `Will add ${add} sessions${skip ? `, skip ${skip} duplicates` : ''}.`,
  importJsonPreview: (sessions: number, skipped: number, progress: number, tests: number) =>
    `New sessions: ${sessions}, skipped: ${skipped}, progress updates: ${progress}, tests: ${tests}.`,
  importJsonCustomPreview: (plans: number, exercises: number, customProgress: number) =>
    `Plans: ${plans}, exercises: ${exercises}, plan progress: ${customProgress}.`,
  progressCustomPrEmpty: 'No records — complete a workout with a custom plan.',
  planImportJson: 'Import plan JSON',
  planImportDone: 'Plan imported as a draft.',
  planPause: 'Pause plan',
  planResume: 'Resume plan',
  planPaused: 'Paused',
  planEditBlockedActive: 'Finish or cancel the active workout for this plan before editing.',
  customSummaryBackToPlan: 'Back to plan',
  customSummaryViewProgress: 'View progress',
  customSummaryRecSuccess: 'Take your planned rest — come back when you\'re ready.',
  customSummaryBelowTarget:
    'Some sets came in below the plan — that\'s fine.',
  /** @deprecated Custom days no longer fail; kept for residual imports */
  customSummaryRecFail: 'Workout saved — come back when you\'re ready.',
  /** @deprecated */
  customSummaryFailPolicy: '',
  customFailEndLabel: 'Save and continue',
  customFailBannerHint: 'Below target — you can fix it or save the result and move on.',
  customWorkoutAddSet: 'Add set',
  customWorkoutRemoveSet: 'Remove set',
  customWorkoutSetsCount: (n: number) => `${n}`,
  customWorkoutSetsAdjustHint: 'This workout only — plan save at the end.',
  customWorkoutSetExtraBadge: 'added',
  customWorkoutAddSetHint: 'This workout only — you\'ll decide whether to save to the plan at the end.',
  customWorkoutRestAdjustLabel: 'Rest between sets',
  customSummaryUpdatePlanTitle: 'Update plan?',
  customSummaryUpdatePlanBody:
    'You can save changes from this workout to the plan or discard them.',
  customSummaryUpdatePlanSets: (name: string, from: number, to: number) =>
    `${name}: sets ${from} → ${to}`,
  customSummaryUpdatePlanRest: (name: string, from: number, to: number) =>
    `${name}: rest ${from}s → ${to}s`,
  customSummaryUpdatePlanSwap: (from: string, to: string) =>
    `Exercise: ${from} → ${to}`,
  customSummaryUpdatePlanAdded: (name: string) =>
    `Added exercise: ${name}`,
  customSummaryUpdatePlanValues: (name: string, summary: string) =>
    `${name}: ${summary}`,
  customSummaryValueSet: (setNumber: number, detail: string) =>
    `S${setNumber}: ${detail}`,
  customSummaryValueReps: (from: number, to: number) =>
    `${from} → ${to} reps`,
  customSummaryValueWeight: (from: number, to: number) =>
    `${from} → ${to} kg`,
  customSummaryValueDuration: (from: number, to: number) =>
    `${from}s → ${to}s`,
  customSummaryUpdatePlanTargetsNote:
    'Set targets will be adjusted based on this workout\'s results.',
  customSummaryUpdatePlanConfirm: 'Save to plan',
  customSummaryUpdatePlanDiscard: 'Don\'t change the plan',
  customSummaryUpdatePlanGroupValues: 'Set values (reps, weight, rest)',
  customSummaryUpdatePlanGroupValuesHint: 'Update targets based on this workout\'s results',
  customSummaryUpdatePlanGroupExercises: 'Exercise changes (added, swapped)',
  customSummaryUpdatePlanGroupExercisesHint: 'Keep exercise changes in the plan permanently',
  customSummaryUpdatePlanSaveSelected: 'Save selected',
  customSummaryUpdatePlanSaveAll: 'Save all',
  customSummaryUpdatePlanDone: 'Plan updated.',
  customSummaryUpdatePlanFailed: 'Failed to save changes to the plan.',
  customWorkoutProblemTitle: 'Can\'t start the workout',
  missingSessionHint: 'The session expired or doesn\'t exist on this device.',
  customHomeEmptyTitle: 'No plans yet',
  customHomeEmptyCta: 'Enable plans in your profile',
  customProgressionAppliedTitle: 'New targets for the next cycle',
  customProgressionAppliedHint: 'Progression updated the sets in your plan.',
  customProgressionDiffLine: (day: number, exerciseName: string, before: string, after: string) =>
    `${exerciseName} · Day ${day}: ${before} → ${after}`,
  customProgressionDiffMore: (n: number) =>
    n === 1 ? '… and 1 more change' : `… and ${n} more changes`,
  customShareStatLine: (exercises: number, sets: number) =>
    `${exercises} ex. · ${sets} sets`,
  shareCardPrCount: (n: number) => (n === 1 ? '1 PR record' : `${n} PR records`),
  shareCardStreak: (n: number) => (n === 1 ? '1 day streak' : `${n} day streak`),
  shareCardVolume: (kg: number) => `Volume: ${kg} kg`,
  shareCardBestSet: (reps: number) => `Best set: ${reps}`,
  customPreviousRepsWeight: (reps: number, kg: number) => `Previously: ${reps} × ${kg} kg`,
  customPreviousLabel: 'Last time',
  customPreviousFromDay: (day: number) => `D${day}`,
  customPreviousFromAttempt: (attempt: number) => `Attempt ${attempt}`,
  customPreviousRepsValue: (reps: number) => `${reps} reps`,
  customPreviousRepsWeightValue: (reps: number, kg: number) => `${reps} × ${kg} kg`,
  customPreviousDuration: (sec: number) => `${sec} s`,
  customPreviousAria: (context: string | null, value: string) =>
    context ? `Last time ${context}: ${value}` : `Last time: ${value}`,
  customMinDurationHint: (sec: number) => `Minimum ${sec} s — longer is OK too`,
  customMinRepsHint: (reps: number) => `Minimum ${reps} — more is OK too`,
  customWorkoutEditPlan: 'Edit plan',
  customWorkoutSkipExercise: 'Skip exercise',
  customWorkoutSkipExerciseHint: 'This workout only — the plan in Plans stays unchanged.',
  customWorkoutReplaceExercise: 'Replace exercise',
  customWorkoutReplaceExerciseHint: 'Pick an exercise from the library — the plan will be updated.',
  customWorkoutSwapExercise: 'Swap for a different exercise',
  customWorkoutSwapExerciseHint: 'Pick an exercise from the library. The plan stays unchanged — you\'ll decide at the end of the workout.',
  customWorkoutAddExercise: 'Add exercise',
  customWorkoutAddExerciseHint: 'Add an exercise at the end of the workout. This session only — you\'ll decide whether to save to the plan after the workout.',
  customWorkoutSwapConfirmTitle: 'Swap exercise?',
  customWorkoutSwapConfirmBody: (name: string) =>
    `You have logged sets for "${name}". Swapping will reset those logs.`,
  customWorkoutSwapConfirmAction: 'Swap and reset',
  customEditBlockedActiveDay: 'This day has an active workout — edit other days.',
  customHomeMorePlans: (n: number) =>
    n === 1 ? '+1 more plan in Plans' : `+${n} more plans in Plans`,
  customHomePinPrompt: 'In your Profile you can choose which plans appear on the home screen.',
  customHomeEmptyHint: 'Enable plans in Profile → Active plans.',
  customLastWorkoutInsight: (planName: string, when: string) =>
    `Last custom workout: ${planName} · ${when}`,
  customCycleRailTitle: 'Cycle map',
  customCycleDayPassed: 'Completed',
  customCycleDayFailed: 'Failed',
  customCycleDayCurrent: 'Current',
  customCycleDayUpcoming: 'Upcoming',
  customCycleDayRest: 'Rest',
  customExerciseNoteLabel: 'Note (optional)',
  customExerciseNotePlaceholder: 'A quick tip for the workout…',
  customTargetKindFixed: 'Fixed target',
  customTargetKindMin: 'Minimum',
  customTargetKindMax: 'Max',
  customTargetKindExact: 'Exact',
  customTargetKindFixedShort: 'Fixed',
  customTargetKindMinShort: 'Min',
  customTargetKindMaxShort: 'Max',
  customTargetKindExactShort: 'Exact',
  customSetEditorTitle: (n: number) => `Set ${n}`,
  customSetRepsLabel: 'Reps',
  customHistoryFilterPlan: 'Plan',
  customHistoryFilterResult: 'Result',
  customHistoryFilterDay: 'Day',
  customHistoryEmptyFiltered: 'No sessions for the selected filters.',
  progressionAfterCycle: 'After completing the cycle',
  importInProgress: 'Importing…',
  importTooLarge: 'File is too large (max 5 MB).',
  importInvalid: 'Unrecognized backup format.',
  importFailed: 'Import failed — check the file and try again.',
  importDone: (n: number) =>
    n === 1 ? 'Imported 1 session.' : `Imported ${n} sessions.`,
  deleteAccount: 'Delete cloud account',
  deleteAccountHint:
    'Permanently deletes the account, progress and sync data from the SmartReps server. This operation cannot be undone.',
  deleteAccountWarning:
    'We recommend downloading a JSON backup first. Local data on your phone will be cleared after success.',
  deleteAccountConfirmWord: 'DELETE',
  deleteAccountTypeConfirm: (word: string) => `Type ${word} to confirm`,
  deleteAccountConfirm: 'Delete account permanently',
  deleteAccountInProgress: 'Deleting account…',
  deleteAccountDone: 'Cloud account has been deleted.',
  deleteAccountFailed: 'Failed to delete the account. Try again or reach out via GitHub.',
  deleteAccountSessionExpired: 'Session expired — log in again to delete the account.',
  summaryShare: 'Share result',
  summaryShareDone: 'Result card ready to share.',
  summaryShareFailed: 'Failed to create the result card.',
  shareCardAlt: 'SmartReps result card',
  pwaUpdateTitle: 'New SmartReps version',
  pwaUpdateBody: 'An app update is available. Refresh to load the latest changes.',
  pwaUpdateReload: 'Refresh now',
  pwaUpdateLater: 'Later',
  progressTabHistoryHint: 'List of workouts — tap an entry to see the sets.',
  progressHistorySectionTitle: 'Workout history',
  progressSummaryTitle: 'Summary',
  range14d: '14 days',
  range30d: '30 days',
  range90d: '90 days',
  rangeYear: 'Year',
  rangeSessions: 'Sessions',
  rangeTotalReps: 'Reps',
  rangeDaysLabel: (days: number) => (days >= 365 ? 'last year' : `last ${days} days`),
  bodyWeightTitle: 'Body weight',
  bodyWeightEmpty: 'No entries yet. Add your first measurement.',
  bodyWeightAddMoreForTrend: 'Add another measurement to see the trend.',
  bodyWeightAdd: 'Add measurement',
  bodyWeightAddTitle: 'New weight measurement',
  bodyWeightLabel: 'Weight',
  bodyWeightNotePlaceholder: 'Optional note',
  bodyWeightSave: 'Save',
  bodyWeightSaved: 'Measurement saved.',
  bodyWeightInvalid: 'Enter a valid weight.',
  bodyWeightOutOfRange: 'Weight must be between 20–300 kg.',
  bodyWeightDelete: 'Delete measurement',
  muscleGroup_chest: 'Chest',
  muscleGroup_back: 'Back',
  muscleGroup_shoulders: 'Shoulders',
  muscleGroup_arms: 'Arms',
  muscleGroup_legs: 'Legs',
  muscleGroup_core: 'Core',
  muscleGroup_full_body: 'Full body',
  muscleGroup_cardio: 'Cardio',
  muscleGroup_other: 'Other',
  exerciseMuscleGroup: 'Muscle group',
  exerciseMuscleGroupHint: 'Helps suggest similar exercises when swapping.',
  exerciseSwapSuggestions: 'Suggested swaps',
  exerciseSwapSuggestionsHint: 'Exercises from the same muscle group.',
  progressRecordTestHint: 'max test',
  progressCycleDaysHint: 'in cycle',
  progressSessionsHint: 'sessions',
  progressActivityAria: '14-day program trend',
  progressWeekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  progressLastSetTrend: (current: number, previous: number) =>
    `Last max set (same day): ${current} · previously ${previous}`,
  progressOpenFullSummary: 'Full summary',
  progressCustomSessions14d: 'Workouts 14d',
  progressCustomExercisesTrained: 'Exercises',
  progressCustomVolumeTotal: 'Volume',
  progressCustomVolumePerSession: 'Volume/session',
  progressCustomStatsTitle: 'Custom plans',
  progressCustomStatsHint: 'All plans',
  progressProgramSwitcher: 'Program selector',
  progressRangeLabel: 'Time range',
  progressCustomActivePlans: 'Plans',
  progressCustomRecordsTitle: 'Records',
  progressCustomRecordsHint: 'Tap an exercise to see details.',
  progressCustomPlanEmpty: 'No active plan',
  progressCustomPlanEmptyHint: 'Create a plan to see the day map and progress.',
  progressCustomPlanDayProgress: (current: number, total: number) =>
    `Day ${current} of ${total}`,
  progressCustomOpenPlan: 'Plan list',
  progressCustomPlanMapTitle: 'Day map',
  progressCustomPlanMapHint: 'Color = status. Number under a day = exercises. Tap a day.',
  progressCustomDayExercises: (n: number) => (n === 1 ? '1 ex.' : `${n} ex.`),
  progressCustomDaySets: (n: number) => (n === 1 ? '1 set' : `${n} sets`),
  progressCustomDayEmpty: 'This day has no exercises yet.',
  progressCustomSeeDayHistory: 'History for this day',
  progressCustomExerciseFallback: 'Exercise',
  progressTestChartHint: 'Latest max tests',
  progressHeatmapHint: 'Green = passed workout, red = failed day',
  progressHeatmapEmpty: 'The map will fill in after your first workouts.',
  progressEmptyTitle: 'Getting started',
  progressEmptyHint: 'After your first workout you\'ll see charts and an activity map here.',
  progressRecordsSectionTitle: 'Records',
  progressHistoryCount: (n: number) =>
    n === 1 ? '1 session' : `${n} sessions`,
  progressSetCount: (n: number) =>
    n === 1 ? '1 set' : `${n} sets`,
  progressLoadMore: (n: number) => `Show ${n} more`,
  progressFilterResult: 'Result',
  progressFilterCycle: 'Cycle',
  progressFilterDate: 'Period',
  progressFiltersApply: 'Done',
  progressCycleProgress: (done: number, total: number) =>
    total > 0 ? `Completed ${done} of ${total} days in the cycle` : '',
  progressRecordsEmpty: 'Records will appear here after workouts and a max test.',
  progressRecordDate: (date: string) => `from ${date}`,
  progressVolumeTitle: 'Volume and frequency',
  progressVolume14d: 'Volume 14 days',
  progressVolumePrev14d: 'Previous 14 days',
  progressVolumeTrendUp: (pct: number) => `+${pct}% vs previous 14 days`,
  progressVolumeTrendDown: (pct: number) => `−${pct}% vs previous 14 days`,
  progressVolumeTrendFlat: 'Steady vs previous 14 days',
  progressAvgPerSession: 'Avg per session',
  progressAvgSessionsPerWeek: 'Avg per week',
  progressSessions30d: 'Workouts 30 days',
  progressSessionChartTitle: 'Best set in workout',
  progressSessionChartHint: 'Last max set in each completed session',
  progressSessionChartTooltip: 'Max set',
  progressSessionChartAria: (count: number) => `Best set chart, ${count} points`,
  progressWeeklyVolumeTitle: 'Weekly volume',
  progressWeeklyVolumeHint: 'Total volume (reps × sets) in the last 12 weeks',
  progressWeeklyVolumeAxisLabel: 'Volume',
  progressWeeklyVolumeAria: (count: number) => `Weekly volume chart, ${count} weeks`,
  progressWeeklyVolumeTooltip: 'Volume',
  progressWeeklyVolumeEmpty: 'No completed workouts in this period.',
  progressTestChartAria: (count: number) => `Max test chart, ${count} points`,
  progressMaxSetChartAria: (count: number) => `Best set per day chart, ${count} days`,
  progressCustomVolumeChartAria: (count: number) => `Volume per session chart, ${count} points`,
  bodyWeightChartAria: (count: number, latest: number | string, unit: string) =>
    `Body weight chart, ${count} measurements, latest: ${latest} ${unit}`,
  bodyWeightCorrelationTitle: 'Weight vs strength',
  bodyWeightCorrelationHint: 'Correlation between weight changes and workout performance',
  bodyWeightCorrelationPositive: (r: number) => `Weight gain correlates with strength gain (r=${r})`,
  bodyWeightCorrelationNegative: (r: number) => `Weight loss correlates with strength loss (r=${r})`,
  bodyWeightCorrelationNeutral: (r: number) => `No clear correlation (r=${r})`,
  bodyWeightCorrelationInsufficientData: 'Add at least 3 weight measurements and complete 3 workouts to see correlation.',
  bodyWeightCorrelationChartAria: (count: number) => `Weight vs strength correlation chart, ${count} points`,
  bodyWeightAxisLabel: 'Weight',
  performanceAxisLabel: 'Strength',
  exerciseDetailChartAria: (count: number, name: string) => `Exercise progress chart for ${name}, ${count} points`,
  exerciseDetailLoadChartAria: (count: number, name: string) => `Exercise load chart for ${name}, ${count} points`,
  dateColumn: 'Date',
  dayLabelShort: 'Day',
  progressCycleTrendTitle: 'Cycle trend',
  progressCycleTrendHint: 'Last max set: current vs previous cycle attempt',
  progressCycleTrendCurrent: 'Current',
  progressCycleTrendPrevious: 'Previous',
  progressCycleTrendDelta: (d: number) => (d > 0 ? `+${d}` : String(d)),
  progressCycleTrendNoPrevious: 'No previous cycle attempt',
  progressCustomVolumeTitle: 'Custom volume 14 days',
  progressCustomVolumeHint: 'Total reps and load in custom plans',
  progressCustomTotalReps14d: 'Reps 14 days',
  progressCustomTotalVolume14d: 'Load 14 days',
  progressCustomAvgPerSession: 'Avg per session',
  progressCustomSessions30d: 'Workouts 30 days',
  progressSessionNoSets: 'No saved sets in this session.',
  progressStatusEmpty: 'No sessions — time for your first workout.',
  progressStatusStreak: (n: number) =>
    n === 1 ? 'Streak: 1 week of training.' : `Streak: ${n} weeks of training.`,
  progressStatusSessions: (n: number) =>
    n === 1 ? '1 completed session in this program.' : `${n} completed sessions in this program.`,
  progressFilters: 'Filters',
  progressFullCyclePlan: 'Full cycle plan',
  progressChartEmpty: 'The chart will appear after your first max test.',
  toastExportDone: 'History exported to a CSV file',
  toastSyncDone: 'Synced — progress safe in the cloud',
  toastSyncFailed: 'Sync failed — check your connection and try again.',
  continueToLogin: 'Continue — save progress',
  testPendingBlocked: 'Cycle complete — take a max test to pick the next level.',
  totalRepsDelta: (n: number) => `${n > 0 ? '+' : ''}${n} vs previous session`,

  // Plans — resistance bands
  plansMinePageHint: 'Custom training plans — edit and start.',
  plansLibraryPageHint: 'Exercises to use in plans.',
  plansProgramsPageHint: 'Pushup and pull-up programs — expand a cycle to see targets.',
  plansProgramHint: 'Expand a cycle to see set targets across days.',
  plansTabAriaLabel: 'Plan tabs',
  plansYourCycle: 'Your cycle',
  plansDayCount: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  plansPeakDay: (day: number, reps: number) => `peak D${day} · ~${reps} reps`,
  plansDayReps: (sets: number, total: number) =>
    sets === 1 ? `1 set · ~${total}` : `${sets} sets · ~${total}`,
  cycleDayStatusCompleted: 'completed',
  cycleDayStatusCurrent: 'current',
  cycleDayStatusFuture: 'upcoming',
  resistanceBandsTitle: 'Resistance bands (pull-ups)',
  resistanceBandsIntro:
    'If you can\'t do pull-ups on your own yet, you can start with a band-assisted variant — as suggested by the podciaganie.pl program.',
  resistanceBandsTip1: 'Start with a thicker band and gradually move to a thinner one.',
  resistanceBandsTip2: 'Place your foot/knee in the band so it assists the upward movement, but doesn\'t do all the work for you.',
  resistanceBandsTip3: 'Count only full reps — chin above the bar, controlled lowering.',
  resistanceBandsNote:
    'SmartReps tracks cycles from podciaganie.pl. Treat the band variant as supplementary technical training.',

  // Profile
  appearance: 'Appearance',
  themeSystem: 'System',
  themeDark: 'Dark',
  themeLight: 'Light',
  highContrast: 'High contrast',
  trainingSettings: 'Training settings',
  weightUnitLabel: 'Weight unit',
  weightUnitKg: 'kg',
  weightUnitLb: 'lb',
  languageLabel: 'Language',
  languagePl: 'Polish',
  languageEn: 'English',
  remindersSection: 'Reminders',
  profileDangerZone: 'Danger zone',
  profileUnconfiguredHint: 'No level yet — you\'ll set it up on the Training screen.',
  profileSetupOnTraining: 'Set up on Training',
  profileProgramsEmpty: 'No enabled training programs.',
  profileCustomPlansSubhead: 'Custom plans',
  profileCustomOnTraining: 'Visible on the Training screen',
  timerSound: 'Workout sounds',
  timerSoundHint: 'Set, rest, 3-2-1 countdown, AMRAP and time target',
  timerVibration: 'Vibration',
  timerVibrationHint: 'Set, rest and countdown confirmations',
  keepScreenOn: 'Keep screen on during workout',
  keepScreenOnHint: 'Screen won\'t dim during a workout (best in an installed PWA).',
  workoutReminders: 'In-app workout reminder',
  workoutRemindersHint: 'Works only when the app is open (when push is off).',
  workoutRemindersDenied:
    'Notifications are blocked in system / browser settings. Enable them to use reminders.',
  pushNotifications: 'Push notifications',
  pushNotificationsHint:
    'A reminder at your chosen time on days when a workout is available (after rest). Requires PWA and an account.',
  pushNeedsLogin: 'Log in to enable push notifications.',
  pushUnavailable: 'Push unavailable on this device / browser (no VAPID or Web Push).',
  pushSubscribeFailed: 'Failed to enable push notifications.',
  pushOsSettingsHint:
    'If you\'re not getting notifications, check permissions in your system settings.',
  toastPushEnabled: 'Push notifications enabled.',
  accountLoggedIn: (email: string) => `Logged in as ${email}`,
  accountLocalOnly: 'You\'re training locally on this device — log in to sync.',
  sessionLostReLogin:
    'Your login session expired or was cleared by the system — workouts on your phone are safe.',
  sessionLostReLoginAction: 'Log in again',
  logoutFailed: 'Failed to log out. Try again.',
  dataSection: 'Data',
  profileProgramsLoading: 'Loading programs…',
  reminderHourLabel: 'Reminder time',
  reminderHourOption: (h: number) => `${String(h).padStart(2, '0')}:00`,
  reminderNotificationTitle: 'SmartReps',
  reminderNotificationBody: 'Time to train — check your plan for today.',
  syncNow: 'Sync now',
  syncNowOffline: 'No network — sync unavailable',
  syncLastAt: (when: string) => `Last sync: ${when}`,
  syncNever: 'Not synced from this device yet',
  syncInProgress: 'Syncing…',
  exportHistory: 'Export workout history',
  exportFailed: 'Failed to export history',
  privacyLink: 'Privacy Policy',
  termsLink: 'Terms of Service',
  privacyTitle: 'Privacy Policy',
  termsTitle: 'Terms of Service',
  legalBack: 'Back',
  appVersion: (v: string) => `SmartReps v${v}`,
  restPrimaryLabel: (when: string) => `Workout ${when}`,
  considerLowerLevel: 'Several restarts in a row — consider a lower level.',
  summaryRecSuccess: 'Take your planned rest — come back when you\u2019re ready.',
  summaryRecFail:
    'After the rest you\u2019ll return to day 1 of this cycle. You can also change the level in the program menu.',
  summaryRecCycleDone: 'Cycle complete — run a max test to pick the next level.',
  summaryCtaProgress: 'View progress',
  summaryCtaLevelChange: 'Change level',
  summaryCtaRetest: 'Run test',
  summaryCtaLater: 'Later',
  summaryLoginBackup:
    'Log in to back up your progress to the cloud and restore it on other devices.',
  installPromptTitle: 'Add SmartReps to your home screen',
  installPromptBody: 'Faster start like a native app. On iPhone: Share \u2192 Add to Home Screen.',
  installPromptCta: 'Install',
  installPromptDismiss: 'Not now',
  installIosHint: 'On iPhone: tap the Share button, then \u201CAdd to Home Screen\u201D.',
  standaloneLoginCoachTitle: 'Log in with email code',
  standaloneLoginCoachBody:
    'To sync your progress across devices, log in with the same email (use the code from the email, not the link).',
  standaloneLoginCoachCta: 'Log in',
  standaloneLoginCoachDismiss: 'Later',
  programs: 'Programs',
  disableProgram: 'Disable program',
  disableProgramConfirm:
    'The program will disappear from the Workout screen. History stays on this device. Continue?',
  disableProgramConfirmLast:
    'This is the last enabled program — the Workout screen will switch to custom plans. Workout history stays on this device. Continue?',
  pauseProgram: 'Pause program',
  resumeProgram: 'Resume program',
  clearLocalData: 'Clear local data',
  clearLocalDataConfirm:
    'This will remove progress, sessions, and settings from this device. It does not delete your cloud account. This cannot be undone.',
  logoutConfirmMessage:
    'Choose how to log out: clear local data (recommended on a shared phone) or keep progress on this device.',
  logoutKeepData: 'Log out — keep data',
  logoutAndClear: 'Log out and clear',
  syncDeadLetter: (n: number) =>
    n === 1 ? '1 item waiting to re-sync' : `${n} items waiting to re-sync`,
  syncRetryDead: 'Retry sync',
  syncStatusLocalOnly: 'Local only',
  syncStatusLoggedIn: 'Connected to cloud',
  syncStatusLoggedOutLocally: 'Logged out — data stays local',
  syncStatusSessionExpired: 'Session expired — log in again',
  syncStatusSyncing: 'Syncing\u2026',
  syncStatusSyncError: 'Sync error',
  syncQueuePending: (n: number) =>
    n === 1 ? '1 change waiting to sync' : `${n} changes waiting to sync`,
  syncErrorReason: (reason: string) => {
    const labels: Record<string, string> = {
      offline: 'No network',
      no_session: 'No active session',
      auth_expired: 'Session expired',
      remote_error: 'Server error',
      dead_letter: 'Failed changes queued',
      unknown: 'Unknown error',
    }
    return labels[reason] ?? labels.unknown
  },
  syncFaqTitle: 'How does sync work?',
  syncFaqLocal: 'You can train without logging in — progress stays on your phone.',
  syncFaqLogin:
    'Logging in with email code creates a cloud backup and lets you restore on another device.',
  syncFaqWhat:
    'Sync covers program progress, workout sessions, max tests, and settings (theme, programs).',
  syncFaqMidWorkout:
    'A workout in progress syncs only after the day is completed — not between sets.',
  syncCtaLoginBackup: 'Log in to back up progress',
  syncCtaLoginAgain: 'Log in again',
  syncCtaSessionExpired: 'Log in again',
  toastSyncFailedOffline: 'No network — sync will resume when connected',
  toastSyncFailedSession: 'Session expired — log in again to sync',
  toastSyncFailedDeadLetter:
    'Some changes didn\u2019t reach the cloud — check the sync panel in Profile',
  toastSyncFailedRemote: 'Sync failed — try again',
  changeLevelPushups: 'Change level — Pushups',
  changeLevelPullups: 'Change level — Pullups',
  retestPushups: 'Pushup test',
  retestPullups: 'Pullup test',
  about: 'About',
  logout: 'Log out',
  account: 'Account',
  settingsTitle: 'Settings',
  profileStatsSessions: 'Sessions',
  profileStatsStreak: 'Streak',
  profileStatsStreakWeeks: (n: number) => `${n}w`,
  profileStatsReps: 'Reps',
  profileStatsRepsValue: (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n),
  profileStatsBestStreak: 'Best streak',
  profileStatsEmpty: '\u2014',
  notLoggedIn: 'Not logged in — data stays on this device only',

  // Nav
  navWorkout: 'Workout',
  navProgress: 'Progress',
  navPlans: 'Plans',
  navProfile: 'Profile',

  // Common
  loading: 'Loading\u2026',
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
  yes: 'Yes',
  no: 'No',

  errorCrash: 'An unexpected error occurred. Refresh the app and try again.',

  today: 'Today',
  tomorrow: 'Tomorrow',
  inDays: (n: number) => `In ${n} days`,
  techniquePoseStart: 'Start',
  techniquePoseBottom: 'Bottom',
  techniquePoseTop: 'Top',

  formatSetMax: (min: number) => `MAX \u00B7 min ${min}`,
  formatSetMaxShort: (min: number) => `MAX\u2265${min}`,
  formatSetExact: (reps: number) => `Exactly ${reps}`,
  formatSetExactShort: (reps: number) => `=${reps}`,
  summarySetsPassed: 'sets passed',
  summaryUnchanged: 'no change',
  summaryBestSet: 'Best set',
  summaryAvgReps: 'Avg per set',
  summaryTargetAchievement: 'Target achievement',
  summaryTargetAchieved: 'target achieved',
  summaryFailedSets: (n: number) =>
    n === 1 ? '1 failed set' : `${n} failed sets`,
  summaryTotalVolume: 'Volume',
  summaryExerciseCount: 'Exercises',
  summaryTotalSets: 'Total sets',
  summaryAvgVolume: 'Avg volume/set',
  summaryHighlightsTitle: 'Progress in this workout',
  summaryHighlightsPrCount: (n: number) =>
    n === 1 ? '1 PR' : `${n} PRs`,
  summaryHighlightsProgressCount: (n: number) =>
    n === 1 ? '1 progress' : `${n} progress marks`,
  summaryHighlightSessionTotalPr: 'Session rep PR',
  summaryHighlightBestSetPr: (setNumber: number) => `Set ${setNumber} PR`,
  summaryHighlightExercisePr: (name: string) => `PR \u00B7 ${name}`,
  summaryHighlightVolumePr: (name: string) => `Volume \u00B7 ${name}`,
  summarySetBadgePr: 'PR',
  summarySetBadgeImproved: (n: number) => `+${n}`,
  summarySetBadgeDown: (n: number) => `${n}`,
  summarySetInsightPr: (value: string) => `PR: ${value}`,
  summarySetInsightImproved: (value: string, delta: number) =>
    `Progress: ${value} (+${delta} vs last session)`,
  summarySetInsightDown: (value: string, delta: number) =>
    `${value} (${delta} vs last session)`,
  summarySetInsightFailed: (value: string) => `Failed: ${value}`,
  setLabelFixed: (reps: number, unit: string) => `Do ${reps} ${unit}`,
  setLabelMax: (min: number) => `MAX — minimum ${min}`,
  setLabelExact: (reps: number) => `Do exactly ${reps} reps`,

  celebrationPushups100: '100 pushups goal achieved!',
  celebrationPullupsMain: 'Main goal achieved!',
  celebrationPullupsAmbition: 'Ambition goal achieved!',

  // Custom plans & exercises
  plansTabBuiltin: 'Programs',
  plansTabPrograms: 'Programs',
  plansTabMine: 'Mine',
  plansTabLibrary: 'Library',
  myPlansTitle: 'My plans',
  myPlansHint: 'Build your own workout with a few exercises.',
  myPlansEmpty: 'You don\u2019t have a custom plan yet.',
  myPlansEmptyCta: 'Create plan',
  myExercisesSectionTitle: 'My exercises',
  myExercisesSectionHint: 'Exercise library for building plans.',
  myExercisesSectionCta: 'Open library',
  myExercisesCount: (n: number) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`,
  newCustomPlan: 'New plan',
  planSectionInfo: 'Info',
  planSectionDays: 'Training days',
  planSectionProgression: 'Progression & deload',
  planSectionSets: 'Sets',
  planSectionRest: 'Rest',
  planSectionNote: 'Note',
  planSectionProgressPerExercise: 'Exercise progression',
  planExerciseMetricReps: 'Reps',
  planExerciseMetricRepsWeight: 'Reps + weight',
  planExerciseMetricDuration: 'Duration',
  planDayExercisesCount: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
  planDayTotalSets: (n: number) => (n === 1 ? '1 set' : `${n} sets`),
  planAddExerciseDashed: 'Add exercise',
  planSummaryDays: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  planSummaryExercises: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
  planSummarySets: (n: number) => (n === 1 ? '1 set' : `${n} sets`),
  planSectionRestDay: 'Rest after day',
  // \u2500\u2500\u2500 AI Plan Generator \u2500\u2500\u2500
  aiGeneratePlan: 'Generate with AI',
  aiGeneratePlanHint: 'Describe your goal and AI will build a plan based on scientific research.',
  aiSettingsTitle: 'AI — setup',
  aiSettingsHint: 'The API key is stored locally on your device. It is not synced to the cloud.',
  aiProviderLabel: 'AI provider',
  aiProviderOpenai: 'OpenAI',
  aiProviderGemini: 'Google Gemini',
  aiProviderGroq: 'Groq',
  aiProviderCustom: 'Custom endpoint',
  aiApiKeyLabel: 'API key',
  aiApiKeyPlaceholder: 'sk-... or AIza...',
  aiApiKeySaved: 'API key saved',
  aiModelLabel: 'Model',
  aiModelHint: 'The cheapest and fastest model is enough. For Gemini: "gemini-2.5-flash-lite" (free) or "gemini-2.5-flash".',
  aiBaseUrlLabel: 'API base URL',
  aiBaseUrlHint: 'Auto-filled — edit only for a custom endpoint.',
  aiReasoningEffortLabel: 'Reasoning level',
  aiReasoningEffortHint: '"Auto" disables thinking (fastest). Higher levels give better quality but slower and costlier. Gemini only.',
  aiReasoningEffortAuto: 'Auto',
  aiReasoningEffortLow: 'Low',
  aiReasoningEffortMedium: 'Medium',
  aiReasoningEffortHigh: 'High',
  aiProviderHintOpenai: 'Key from platform.openai.com. The gpt-4o-mini model costs ~$0.15/M tokens.',
  aiProviderHintGemini: 'Key from aistudio.google.com. Gemini 2.5 Flash-Lite has a free tier (15 req/min, 1000 req/day).',
  aiProviderHintGroq: 'Key from console.groq.com. Free, very fast (Llama 3.3).',
  aiProviderHintCustom: 'Enter an OpenAI-compatible endpoint.',
  aiNoApiKey: 'Set an API key in Profile to use the AI generator.',
  aiGenerating: 'Generating plan...',
  aiAnalyzing: 'Analyzing workouts...',
  aiGenerate: 'Generate',
  aiAnalyze: 'Analyze workouts',
  aiAnalyzeAgain: 'Analyze again',
  aiAnalysisTitle: 'AI workout analysis',
  aiAnalysisHint: 'AI will analyze your workout history and give research-based suggestions.',
  aiAnalysisEmpty: 'Complete a few workouts so AI can analyze your history.',
  aiDescriptionLabel: 'Goal description',
  aiDescriptionPlaceholder: 'e.g. I want to train 4x a week push/pull/legs at home with dumbbells, build muscle mass',
  aiDaysLabel: 'Days per week',
  aiExperienceLabel: 'Experience level',
  aiExperienceBeginner: 'Beginner',
  aiExperienceIntermediate: 'Intermediate',
  aiExperienceAdvanced: 'Advanced',
  aiEquipmentLabel: 'Equipment',
  aiEquipmentBodyweight: 'Bodyweight',
  aiEquipmentDumbbells: 'Dumbbells',
  aiEquipmentBarbell: 'Barbell',
  aiEquipmentFullGym: 'Full gym',
  aiEquipmentKettlebell: 'Kettlebells',
  aiGoalLabel: 'Goal',
  aiGoalHypertrophy: 'Hypertrophy (mass)',
  aiGoalStrength: 'Strength',
  aiGoalEndurance: 'Endurance',
  aiGoalGeneral: 'General fitness',
  aiGoalFatLoss: 'Fat loss',
  aiDurationLabel: 'Workout duration (min, optional)',
  aiDurationPlaceholder: 'e.g. 60',
  aiDurationInvalid: 'Workout duration must be between 10 and 300 minutes.',
  aiRationaleTitle: 'Why this plan?',
  aiNewExercises: (n: number) => (n === 1 ? '1 new exercise will be added to the library' : `${n} new exercises will be added to the library`),
  aiImportPlan: 'Import plan',
  aiImporting: 'Importing...',
  aiImported: 'Plan imported. You can edit it in \u201CMy plans\u201D.',
  aiImportWarning: 'The plan will be saved as a draft. You can edit it before activating. New exercises will be added to the library.',
  aiDiscard: 'Discard and return to form',
  aiErrorOffline: 'No internet connection. The AI generator requires a connection.',
  aiErrorAuth: 'Invalid API key. Check the key in Profile settings.',
  aiErrorRateLimit: 'Too many API requests. Wait a moment.',
  aiErrorGeneric: 'AI generator error. Try again.',
  aiErrorNoHistory: 'No completed workouts to analyze.',
  aiSummary: 'Summary',
  aiStrengths: 'Strengths',
  aiWeaknesses: 'Weaknesses',
  aiSuggestions: 'Suggestions',
  aiPriorityHigh: 'High priority',
  aiPriorityMedium: 'Medium priority',
  aiPriorityLow: 'Low priority',
  aiVolumeAssessment: 'Volume per muscle group',
  aiStatusOptimal: 'Optimal',
  aiStatusBelowMev: 'Below minimum (MEV)',
  aiStatusAboveMrv: 'Above maximum (MRV)',
  aiStatusLow: 'Low',
  aiStatusHigh: 'High',
  // ── AI Coach persona ──
  aiCoachName: 'SmartReps Coach',
  aiCoachTagline: 'Your research-based internal coach',
  aiCoachThinking: 'Thinking…',
  aiCoachAnalyzing: 'Analyzing your workouts…',
  aiCoachGenerating: 'Building your plan…',
  aiCoachReady: 'Ready to help',
  aiCoachGreeting: 'Hi! I\'m your AI coach. I\'ll analyze your workouts and help you train smarter — based on research into volume, frequency, and progressive overload.',
  aiCoachGreetingPlan: 'Describe your goal and I\'ll build a training plan tailored to your level, equipment, and schedule. I apply volume landmarks (MEV–MRV), 2x/week frequency, and progressive overload.',
  aiCoachNoApiKey: 'To get started, set your API key in Profile. The key stays on your device — it never goes to the cloud.',
  aiCoachErrorRetry: 'Let\'s try again — check your API key or connection.',
  aiCoachAnalysisDone: 'Done! Here\'s what I see in your workouts.',
  aiCoachPlanReady: 'Plan ready! Review it below and import if it fits.',
  aiCoachDiscard: 'Didn\'t hit the mark? Describe your goal differently and let\'s try again.',
  aiCoachConfigTitle: 'AI Coach — connection',
  aiCoachConfigHint: 'Choose an AI provider and enter your API key. The key is stored locally on your device — it\'s never synced to the cloud.',
  aiCoachConfigConnected: 'Connection active',
  aiCoachConfigDisconnected: 'No key — coach offline',
  aiCoachConfigSave: 'Save connection',
  aiCoachConfigSaved: 'Coach settings saved',
  aiBaseUrlInvalid: 'API URL must be valid (e.g. https://api.openai.com/v1)',
  aiCoachConfigTest: 'Test connection',
  aiCoachConfigTesting: 'Testing…',
  aiCoachConfigTestOk: 'Connection works — coach ready',
  aiCoachConfigTestFail: 'Failed to connect — check key and model',
  // ── Proactive Coach: smart rest suggestions ──
  coachRestSuggestionFirstTime: 'First set of this exercise — do it solidly, quality over quantity.',
  coachRestSuggestionNewCombination: 'New day and set combination — do it solidly, feel the movement.',
  coachRestSuggestionImproved: (prev: number) => `Last time you hit ${prev} reps on this set — try to beat it.`,
  coachRestSuggestionImprovedTime: (prev: number) => `Last time you held ${prev}s — try to beat it.`,
  coachRestSuggestionUnchanged: 'Same as last time — time to progress by 1 rep.',
  coachRestSuggestionChallenge: (target: number, diff: number) => `Target: ${target} reps (${diff} more than last time). Focus on tempo — you've got this.`,
  coachRestSuggestionChallengeTime: (target: number, diff: number) => `Target: ${target}s (${diff}s longer than last time). Hold the position — you've got this.`,
  // ── Proactive Coach: post-workout auto-insight ──
  coachPostWorkoutTitle: 'Post-workout coach',
  coachPostWorkoutLocalPr: 'New record — great form! Take 2 days off before your next workout.',
  coachPostWorkoutLocalPrMulti: (count: number) => `${count} new records in one session — exceptional form! Take 2 days off.`,
  coachPostWorkoutLocalProgress: (delta: number) => `Progress by ${delta} reps — solid progression. Keep the pace.`,
  coachPostWorkoutLocalProgressAll: (delta: number, sets: number) => `Progress across all ${sets} sets (up to +${delta} reps) — excellent session!`,
  coachPostWorkoutLocalDown: (delta: number) => `Down by ${delta} reps — maybe an off day. Check if you're cutting rest short.`,
  coachPostWorkoutLocalUnchanged: 'No change vs last session — consider +1 rep or an extra set.',
  coachPostWorkoutLocalFailed: 'Failed session — it happens. Focus on clean form and try again after rest.',
  coachPostWorkoutGenerating: 'Coach is analyzing your session…',
  coachPostWorkoutDismiss: 'Dismiss',
  coachPostWorkoutDismissed: 'Insight dismissed',
  coachPostWorkoutError: 'Failed to generate insight',
  // ── Proactive Coach: plateau detector ──
  coachPlateauTitle: 'Plateau detected',
  coachPlateauBody: (programLabel: string, sessionCount: number, lastValue: number, bestValue: number, sessionsSinceBest: number) =>
    `${programLabel}: ${sessionCount} sessions without progress (last: ${lastValue}, best: ${bestValue}, ${sessionsSinceBest} sessions ago). Consider a deload (−40% volume) or cycle change — Israetel's research suggests a lighter week after 3-4 weeks of stagnation.`,
  coachPlateauCta: 'See coach recommendation',
  coachPlateauTip: (programLabel: string) => `${programLabel}: 3 sessions without progress. Consider a deload (−40% volume) or cycle change.`,
  // ── Proactive Coach: weekly report ──
  coachWeeklyReportTitle: 'Weekly summary',
  coachWeeklyReportEmpty: 'No workouts this week. Schedule a session for tomorrow — small steps build habits.',
  coachWeeklyReportSessions: (count: number, reps: number) => `${count} sessions, ${reps} total reps.`,
  coachWeeklyReportStreak: (weeks: number) => `${weeks}-week streak — keep it up!`,
  coachWeeklyReportUp: (pct: number) => `+${pct}% volume vs last week.`,
  coachWeeklyReportDown: (pct: number) => `−${pct}% volume vs last week — consider an extra session.`,
  coachWeeklyReportCta: 'Open full analysis',
  coachWeeklyReportGenerating: 'Coach is preparing the report…',
  coachWeeklyReportDeloadSuggest: '4+ sessions/week for 4+ weeks — consider a deload week (−40% volume) for recovery.',
  coachWeeklyReportLowFreq: '1 session/week is below MEV (10 sets/muscle group) — add 1-2 sessions for optimal hypertrophy.',
  coachWeeklyReportFatigue: 'Volume drop >10% — possible fatigue. Consider an extra rest day.',
  coachWeeklyReportGreat: 'Great week — volume and progress on track. Keep it up!',
  coachWeeklyReportFirstWeek: 'First week with workouts — no data to compare yet.',
  coachWeeklyReportConnectAiHint: 'Connect AI for a detailed coach analysis',
  coachWeeklyReportTrainingDays: (days: number) => `${days} training days.`,
  coachWeeklyReportPrs: (count: number) => count === 1 ? '1 new personal record!' : `${count} new personal records!`,
  coachWeeklyReportAvgDuration: (min: number) => `Avg ${min} min/session.`,
  coachWeeklyReportProgramEntry: (program: string, sessions: number, reps: number) => `${program}: ${sessions} sessions, ${reps} reps.`,
  coachWeeklyReportPrograms: (entries: string) => `Breakdown: ${entries}`,
  coachWeeklyReportRegenerate: 'Regenerate',
  coachWeeklyReportRegenerating: 'Coach is updating the report…',
  coachWeeklyReportUpdatedLabel: (when: string) => `Updated ${when}`,
  coachWeeklyReportNew: 'New',
  coachWeeklyReportNewAria: 'New weekly summary — tap to expand',
  coachWeeklyReportExpand: 'Expand summary',
  coachWeeklyReportCollapse: 'Collapse summary',
  coachWeeklyMetricSessions: 'Sessions',
  coachWeeklyMetricReps: 'Reps',
  coachWeeklyMetricStreak: 'Streak',
  coachWeeklyMetricChange: 'Change',
  coachSourceAi: 'AI',
  coachSourceLocal: 'Local',
  // ── Proactive Coach: settings ──
  coachSettingsProactive: 'Proactive coach',
  coachSettingsProactiveDesc: 'Automatic post-workout insights, weekly reports, and plateau detection. Uses your AI key.',
  // ── Profile hero & about redesign ──
  profileHeroLocal: 'Training locally',
  profileHeroConnected: 'Account active',
  profileHeroSyncNow: 'Sync now',
  profileHeroLogin: 'Log in',
  profileHeroSettings: 'Settings',
  profileHeroEditProfile: 'Edit profile',
  profileHeroPublic: 'Public profile',
  profileHeroPrivate: 'Private profile',
  profileHeroFollowers: 'Followers',
  profileHeroFollowing: 'Following',
  profileHeroFollowersAria: (n: number) => `Show followers (${n})`,
  profileHeroFollowingAria: (n: number) => `Show following (${n})`,
  profileHeroFollowHint: 'Make your profile public so others can follow you',
  profileCoachCardTitle: 'AI Coach',
  profileCoachCardHint: 'Workout analysis and AI plans',
  profileCoachCardConnected: 'Connected',
  profileCoachCardOffline: 'Not connected',
  profileCoachCardConfigure: 'Configure',
  profileAboutTitle: 'About',
  profileAboutHint: 'SmartReps — training that tracks progress',
  profileAboutPrivacy: 'Privacy policy',
  profileAboutTerms: 'Terms of service',
  profileAboutSources: 'Program sources',
  profileAboutDisclaimer: 'Health disclaimer',
  profileAboutVersion: 'Version',
  profileSettingsGroupAccount: 'Account & sync',
  profileSettingsGroupPreferences: 'Preferences',
  profileSettingsGroupTraining: 'Training',
  profileSettingsGroupReminders: 'Reminders',
  profileSettingsGroupData: 'Data & backup',
  // ── Audit fixes: i18n leaks ──
  chartDataSummary: 'Chart data',
  weightUnitShort: 'kg',
  setLabel: 'S',
  homeStartTraining: 'Start workout',
  exerciseLibrary: 'Exercise library',
  exerciseLibraryHint: 'Exercises to use in plans.',
  exerciseLibraryPickHint: 'Pick an exercise for a plan or view stats.',
  exerciseLibraryEmpty: 'No exercises',
  exerciseLibraryEmptyHint: 'Create your own exercise or add ready-made ones from the starter pack.',
  exerciseSearchPlaceholder: 'Search exercises\u2026',
  exerciseSearchNoResults: 'No exercises match your search.',
  exerciseFilterAll: 'All',
  calendarPrevMonth: 'Previous month',
  calendarNextMonth: 'Next month',
  calendarTitle: 'Workout calendar',
  calendarHint: 'Tap a day to see sessions.',
  calendarSessionCustom: 'Custom plan',
  calendarSessionBuiltin: 'Built-in program',
  calendarLegendPassed: 'Passed',
  calendarLegendFailed: 'Failed',
  calendarMonthStats: (total: number, passed: number) =>
    `${total} ${total === 1 ? 'workout' : 'workouts'} \u00B7 ${passed} passed`,
  calendarMoreSessions: (n: number) => `+${n} more`,
  calendarNoSessions: 'No workouts this month.',
  calendarToday: 'Today',
  repUnit: 'reps',
  addExercise: 'Add exercise',
  editExercise: 'Edit exercise',
  archiveExercise: 'Archive',
  exerciseArchiveFailed: 'Failed to archive exercise. Try again.',
  exerciseName: 'Name',
  exerciseMetric: 'Metric',
  exerciseMetricReps: 'Reps',
  exerciseMetricDuration: 'Duration (s)',
  exerciseMetricRepsWeight: 'Reps + kg',
  exerciseRestDefault: 'Default rest (s)',
  exerciseUsedInPlans: (n: number) =>
    n === 1 ? 'Used in 1 plan — archive instead of deleting' : `Used in ${n} plans`,
  exerciseTemplatesTitle: 'Quick start',
  exerciseStarterPack: 'Add starter pack',
  exerciseStarterPackDone: 'Starter exercises added',
  exerciseStarterPushups: 'Pushups',
  exerciseStarterPullups: 'Pullups',
  exerciseStarterSquats: 'Squats',
  exerciseStarterPlank: 'Plank',
  exerciseStarterSidePlank: 'Side plank',
  exerciseStarterPress: 'Press',
  // Chest
  exerciseStarterBenchPress: 'Barbell bench press',
  exerciseStarterInclineBenchPress: 'Incline barbell bench press',
  exerciseStarterDumbbellFlyes: 'Dumbbell flyes',
  exerciseStarterDips: 'Dips',
  exerciseStarterPushupWide: 'Wide pushups',
  // Back
  exerciseStarterBarbellRow: 'Bent-over barbell row',
  exerciseStarterLatPulldown: 'Lat pulldown',
  exerciseStarterDeadlift: 'Deadlift',
  exerciseStarterSeatedRow: 'Seated cable row',
  exerciseStarterFacePulls: 'Face pulls',
  // Shoulders
  exerciseStarterOverheadPress: 'Standing overhead press',
  exerciseStarterLateralRaise: 'Lateral raises',
  exerciseStarterFrontRaise: 'Front raises',
  exerciseStarterRearDeltFlyes: 'Rear delt flyes',
  exerciseStarterArnoldPress: 'Arnold press',
  // Arms
  exerciseStarterBarbellCurl: 'Standing barbell curl',
  exerciseStarterDumbbellCurl: 'Standing dumbbell curl',
  exerciseStarterHammerCurl: 'Hammer curl',
  exerciseStarterTricepPushdown: 'Tricep pushdown',
  exerciseStarterSkullCrusher: 'Skull crusher',
  exerciseStarterCloseGripBench: 'Close-grip bench press',
  // Legs
  exerciseStarterLegPress: 'Leg press',
  exerciseStarterLunges: 'Dumbbell lunges',
  exerciseStarterRomanianDeadlift: 'Romanian deadlift (RDL)',
  exerciseStarterLegExtension: 'Leg extension',
  exerciseStarterLegCurl: 'Lying leg curl',
  exerciseStarterCalfRaise: 'Standing calf raise',
  exerciseStarterGobletSquat: 'Goblet squat',
  exerciseStarterHipThrust: 'Barbell hip thrust',
  // Core
  exerciseStarterCrunches: 'Crunches',
  exerciseStarterHangingLegRaise: 'Hanging leg raises',
  exerciseStarterRussianTwist: 'Russian twist',
  exerciseStarterMountainClimbers: 'Mountain climbers',
  exerciseStarterDeadBug: 'Dead bug',
  // Full body
  exerciseStarterBurpees: 'Burpees',
  exerciseStarterKettlebellSwing: 'Kettlebell swing',
  exerciseStarterThrusters: 'Thrusters',
  exerciseStarterCleanAndPress: 'Clean & press',
  exerciseArchiveConfirm: 'Archive this exercise? It will disappear from the library.',
  exerciseDetailTitle: 'Exercise details',
  exerciseDetailOpen: 'Exercise stats',
  exerciseDetailOpenFor: (name: string) => `Stats: ${name}`,
  exerciseDetailEmpty: 'No history yet — use this exercise in a custom plan workout.',
  exerciseDetailSessions: 'Workouts',
  exerciseDetailSets: 'Sets',
  exerciseDetailPassRate: 'Pass rate',
  exerciseDetailPassHint: (passed: number, total: number) =>
    `${passed} of ${total} sets passed`,
  exerciseDetailLastTrained: 'Last trained',
  exerciseDetailSince: (date: string) => `First time: ${date}`,
  exerciseDetailRestDefault: (sec: number) => `Default rest: ${sec}s`,
  exerciseDetailChartTitle: 'Progress over time',
  exerciseDetailChartHint: 'Best set in each workout',
  exerciseDetailChartDuration: 's',
  exerciseDetailChartReps: 'reps',
  exerciseDetailChartTooltip: 'Best set',
  exerciseDetailChartSingle: (value: number, unit: string) =>
    `One workout — best set: ${value} ${unit}. Chart will appear after the next workout.`,
  exerciseDetailTrendUp: (pct: number) =>
    pct > 0 ? `Trending up — recent workouts +${pct}%` : 'Trending up',
  exerciseDetailTrendDown: (pct: number) =>
    pct > 0 ? `Trending down — recent workouts \u2212${pct}%` : 'Trending down',
  exerciseDetailTrendFlat: 'Stable — no clear change',
  exerciseDetailRecentTitle: 'Recent workouts',
  exerciseDetailRecentHint: 'Best set per plan day',
  exerciseDetailBestInSession: 'Best set',
  exerciseDetailSetsPassed: (passed: number, total: number) => `${passed}/${total}`,
  exerciseDetailVolumeShort: (kg: number) => `vol. ${kg} kg`,
  exerciseDetailClose: 'Close',
  exerciseDetailViewProgress: 'View in Progress',
  exerciseDetailPrSessionContext: (plan: string, day: number) => `${plan} \u00B7 Day ${day}`,
  exerciseDetailPrTestLabel: 'Max test',
  exerciseDetailPrHint: (date: string, context: string) => `PR from ${date} \u00B7 ${context}`,
  exerciseDetailPrHintRepsWeight: (date: string, context: string) =>
    `Most reps: ${date} \u00B7 ${context}`,
  exerciseDetailPrHintDuration: (date: string, context: string) =>
    `Longest set: ${date} \u00B7 ${context}`,
  exerciseDetailLoadTitle: 'Load & frequency',
  exerciseDetailTotalReps: 'Total reps',
  exerciseDetailTotalVolume: 'Total volume',
  exerciseDetailTotalVolumeUnit: 'kg',
  exerciseDetailTotalDuration: 'Total duration',
  exerciseDetailAvgBest: 'Avg best set',
  exerciseDetailSessions30d: 'Workouts 30d',
  exerciseDetailAvgPerWeek: 'Avg per week',
  exerciseDetailAvgPerWeekUnit: (n: number) => `${n}/wk`,
  exerciseDetailLoadChartTitle: 'Load over time',
  exerciseDetailLoadChartHint: 'Total load in each workout',
  exerciseDetailLoadChartVolume: 'kg',
  exerciseDetailLoadChartReps: 'reps',
  exerciseDetailLoadChartDuration: 's',
  exerciseDetailLoadChartTooltip: 'Load',
  exerciseDetailLastSessionTitle: 'Last workout — sets',
  exerciseDetailLastSessionHint: 'Result vs target in each set',
  exerciseDetailTargetShort: 'target',
  exerciseDetailActualShort: 'result',
  exerciseDetailSetShort: (n: number) => `S${n}`,
  exerciseListRowMeta: (sessions: number, pr: string) =>
    sessions === 1
      ? `1 workout \u00B7 PR ${pr}`
      : `${sessions} workouts \u00B7 PR ${pr}`,
  progressCustomSessionCount: (sessions: number) =>
    sessions === 1 ? '1 workout' : `${sessions} workouts`,
  customWorkoutHeaderSetLine: (day: number, set: number, total: number) =>
    `Day ${day} \u00B7 Set ${set}/${total}`,
  exercisePickTitle: 'Pick exercise',
  exercisePickHint: 'Pick from the library or create a new one. After adding, you can set sets and rest.',
  exerciseReplaceTitle: 'Replace exercise',
  exerciseReplace: 'Replace exercise',
  exerciseReplaceHint: (name: string) =>
    name ? `Pick a new exercise instead of \u201C${name}\u201D. Sets, rest, and notes will be kept.` : 'Pick a new exercise. Sets, rest, and notes will be kept.',
  exerciseNameLabel: 'Exercise name',
  exerciseNameHint: 'Changing the name updates the exercise in the library for all plans.',
  exerciseNameSaved: 'Exercise name updated',
  saveExercise: 'Save exercise',
  planName: 'Plan name',
  planDescription: 'Description (optional)',
  planAddDay: 'Add day',
  planDuplicateDay: 'Duplicate',
  planDeleteDay: 'Delete day',
  planDeleteDayConfirm: 'Delete this day and its exercises?',
  planCannotDeleteLastDay: 'A plan needs at least one day.',
  planDayLabel: (n: number) => `Day ${n}`,
  planAddExercise: 'Add exercise',
  planDayEmptyTitle: 'No exercises',
  planDayEmptyHint: 'Add the first exercise to build this day\u2019s workout.',
  planDayEmpty: 'Empty day — add exercises',
  planRemoveExercise: 'Remove exercise',
  planDuplicateExercise: 'Duplicate exercise',
  planMoveUp: 'Move up',
  planMoveDown: 'Move down',
  planExerciseActions: 'Exercise actions',
  planMoveDayUp: 'Move day up',
  planMoveDayDown: 'Move day down',
  planSetsCount: 'Sets',
  planTargetValue: 'Target',
  planRestBetweenSets: 'Rest between sets',
  planRestAfterExercise: 'Rest after exercise',
  planRestAfterDay: 'Rest after day',
  planRestDay1: '1 day',
  planRestDay2: '2 days',
  planRestChipCustom: 'Custom',
  planSaveDraft: 'Save draft',
  planPublish: 'Save & activate',
  planSaveActive: 'Save plan',
  planTrain: 'Train',
  planDuplicate: 'Duplicate plan',
  planDuplicateCopySuffix: ' (copy)',
  planDelete: 'Delete plan',
  planDeleteConfirm: (name: string) =>
    name.trim() ? `Delete plan \u201C${name}\u201D?` : 'Delete this plan?',
  planExportJson: 'Export JSON',
  planMoreActions: 'More',
  planStatusDraft: 'Draft',
  planStatusActive: 'Active',
  planBack: 'Back',
  planValidationFix: 'Fix plan',
  planEllipsis: '\u2026',
  planDash: '\u2014',
  planTotalExercises: (n: number) => (n === 1 ? '1 exercise' : `${n} exercises`),
  planDayRestShort: (n: number) => (n === 1 ? '1d rest' : `${n}d rest`),
  customWorkoutExerciseOf: (cur: number, total: number) => `Ex. ${cur}/${total}`,
  customWorkoutSetOf: (cur: number, total: number) => `Set ${cur}/${total}`,
  customWorkoutHeaderExercise: (exercise: string, day: number, set: number, total: number) =>
    `${exercise} \u00B7 Day ${day} \u00B7 Set ${set}/${total}`,
  customWorkoutHeaderSub: (plan: string, exerciseCur: number, exerciseTotal: number) =>
    exerciseTotal > 1 ? `${plan} \u00B7 Ex. ${exerciseCur}/${exerciseTotal}` : plan,
  customWorkoutHeaderSubAttempt: (
    plan: string,
    attempt: number,
    exerciseCur: number,
    exerciseTotal: number,
  ) =>
    exerciseTotal > 1
      ? `${plan} \u00B7 Attempt ${attempt} \u00B7 Ex. ${exerciseCur}/${exerciseTotal}`
      : `${plan} \u00B7 Attempt ${attempt}`,
  customWorkoutHeader: (
    plan: string,
    day: number,
    set: number,
    totalSets: number,
  ) => `${plan} \u00B7 Day ${day} \u00B7 Set ${set}/${totalSets}`,
  customWorkoutHeaderAria: (
    plan: string,
    day: number,
    exercise: number,
    exerciseTotal: number,
    set: number,
    totalSets: number,
  ) =>
    `${plan}, day ${day}, exercise ${exercise} of ${exerciseTotal}, set ${set} of ${totalSets}`,
  customSetLabelReps: (reps: number, name: string) => `Do ${reps} \u00B7 ${name}`,
  customSetLabelRepsWeight: (reps: number, weight: number, unit: string, name: string) =>
    `Do ${reps} \u00D7 ${weight} ${unit} \u00B7 ${name}`,
  customSetLabelDuration: (sec: number, name: string) => `Hold ${sec}s \u00B7 ${name}`,
  customWorkoutHint:
    'Enter your result (or start the timer), then tap Done. Target = success; below target = failed set.',
  customWorkoutSetsSection: 'Sets',
  customWorkoutRestChip: (sec: number) => `${sec}s rest between sets`,
  customWorkoutExerciseDone: (done: number, total: number) => `${done}/${total} sets`,
  customWorkoutRestAfterExercise: (sec: number) => `Rest after exercise: ${sec}s`,
  customWorkoutExerciseNote: 'Coach note',
  customMaxLiveHint: (min: number) => `Minimum ${min} — more also counts`,
  customDurationUnit: 'sec',
  customWorkoutTargetWeight: (weight: number, unit: string) => `Weight target: ${weight} ${unit}`,
  customWorkoutWeightShort: 'kg',
  customWorkoutLessSec: 'One second less',
  customWorkoutMoreSec: 'One second more',
  customNextSet: (set: number, label: string) => `Next: Set ${set} \u00B7 ${label}`,
  customWorkoutMissingDay: 'This plan day is empty — finish editing in Plans \u2192 Mine.',
  customWorkoutMissingExercise: 'The plan exercise has been removed or archived.',
  exerciseMetricLocked: 'Cannot change the exercise type when it\u2019s used in a plan.',
  exerciseMetricLockedHint: 'Exercise type is locked — used in a plan.',
  exerciseMetricChangeWarn: (n: number) =>
    `This exercise is used in ${n} ${n === 1 ? 'plan' : 'plans'}. Changing the metric may affect existing sets — check the plans after saving.`,
  progressCustomHistory: 'Workout history',
  progressCustomHistoryEmpty: 'Complete your first custom plan workout.',
  progressCustomSessionMeta: (planName: string, day: number) => `${planName} \u00B7 Day ${day}`,
  planDaysCount: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  planExercisesShort: (n: number) => `${n} ex.`,
  planSetsShort: (n: number) => (n === 1 ? '1 set' : `${n} sets`),
  progressionPreviewCount: (n: number) => `Preview changes: ${n} items`,
  editPlan: 'Edit plan',
  durationMinus1s: '\u22121s',
  durationPlus1s: '+1s',
  customWorkoutNextExercise: (name: string) => `Next: ${name}`,
  customWorkoutWeightKg: 'Weight',
  customWorkoutLessWeight: 'Lighter',
  customWorkoutMoreWeight: 'Heavier',
  customWorkoutDurationSec: 'Duration (s)',
  customWorkoutStartTimer: 'Start',
  customWorkoutStopTimer: 'Stop',
  customDayPassed: 'Day passed',
  customDayFailed: 'Day failed',
  customFailRetryDay: 'Retry day',
  homeCustomPlans: 'My plans',
  homeCustomPlansHint: 'Active plans — day, exercises, and status.',
  homeCustomEmptyDiscoverHint:
    'Your plans will appear here. Create a plan or add exercises to the library.',
  homeCustomEmptyCreate: 'Create plan',
  homeCustomEmptyLibrary: 'Exercise library',
  homeSeeAllCustom: 'See all',
  homeCustomDayOf: (current: number, total: number) =>
    total > 0 ? `Day ${current} of ${total}` : `Day ${current}`,
  homeCustomTodayPreview: (names: string, exercises: number, sets: number) => {
    const parts = [names]
    if (exercises > 0) parts.push(exercises === 1 ? '1 ex.' : `${exercises} ex.`)
    if (sets > 0) parts.push(sets === 1 ? '1 set' : `${sets} sets`)
    return parts.join(' \u00B7 ')
  },
  homeCustomResumeHint: (set: number, total: number) =>
    `To finish: set ${set}/${total}`,
  homeCustomStatusCycleComplete: 'Cycle complete',
  homeCustomCycleRestartHint: 'After rest you\u2019ll start from day 1.',
  customCycleCompleteHint: 'You completed all days of the plan. You can start a new cycle from day 1.',
  customCycleCompleteCta: 'Start new cycle',
  noValue: '\u2014',
  weightUnit: 'kg',
  durationUnitShort: 's',
  chartDayShort: (day: number) => `D${day}`,
  progressCustomPr: 'PR',
  activeWorkoutsTitle: 'Active workouts',
  activeWorkoutsHint: 'Which custom plans to show on the Workout screen.',
  progressionTitle: 'Auto-progression',
  progressionHint: 'After completing a cycle, raise targets.',
  progressionEnable: 'Enable auto-progression',
  progressionReps: '+ reps',
  progressionKg: '+ kg',
  progressionSec: '+ seconds',
  progressionPreview: 'Preview changes',

  validationMetricNonNegative: 'Value must be a number \u2265 0',
  validationExactPositive: 'Exact target must be > 0',
  validationMissingReps: 'Missing reps target',
  validationMissingDuration: 'Missing duration target',
  validationMissingId: 'Missing id',
  validationExerciseName: 'Enter exercise name',
  validationNameTooLong: 'Name max 80 characters',
  validationBadMetric: 'Invalid metric',
  validationRestNonNegative: 'Rest must be \u2265 0',
  validationPlanName: 'Enter plan name',
  validationNoDays: 'Add at least one day',
  validationMaxDays: 'Max 14 days per plan',
  validationDuplicateDay: 'Duplicate day number',
  validationDayNoExercises: 'Day with no exercises',
  validationRestAfterDay: 'Rest after day: 1 or 2 days',
  validationExerciseUnavailable: 'Exercise unavailable',
  validationNoSets: 'Add at least one set',
  validationMaxSets: 'Max 30 sets',
  validationGroupMissing: 'Group does not exist in this day',
  validationGroupEmpty: 'Empty exercise group',
  validationGroupMinTwo: 'Superset/circuit requires at least 2 exercises',
  validationCircuitRounds: 'Circuit: 1\u201330 rounds',
  validationAmrapDuration: 'AMRAP: 30\u20133600 sec',
  validationDeloadCycles: 'Deload: every 2\u201352 cycles',
  progressionPerExercise: 'Custom progression for this exercise',
  progressionPerExerciseHint: 'Overrides plan settings.',
  deloadTitle: 'Deload every N cycles',
  deloadHint: 'Every few cycles, slightly lower targets instead of raising them.',
  deloadEnable: 'Enable deload',
  deloadEveryNCycles: 'Every N cycles',
  deloadReps: 'Reps',
  deloadKg: 'Kg',
  deloadSec: 'Seconds',
  groupSuperset: 'Superset',
  groupCircuit: 'Circuit',
  groupAmrap: 'AMRAP',
  groupLinkNext: 'Link with next',
  groupUnlink: 'Ungroup',
  groupEdit: 'Group settings',
  groupRounds: 'Circuit rounds',
  groupAmrapDuration: 'AMRAP duration (sec)',
  groupRestAfterRound: 'Rest after round (sec)',
  groupMemberCount: (n: number) => `${n} exercises in group`,
  customWorkoutGroupSuperset: 'Superset',
  customWorkoutGroupCircuit: 'Circuit',
  customWorkoutGroupAmrap: 'AMRAP',
  customWorkoutRoundLine: (round: number, total?: number) =>
    total != null ? `Round ${round}/${total}` : `Round ${round}`,
  customWorkoutAmrapRemaining: (sec: number) => `AMRAP \u00B7 ${sec} s`,

  heatmapDayPassed: (day: number, reps: number) => `Day ${day} \u00B7 ${reps} reps`,
  heatmapDayFailed: 'Failed day',
  heatmapRest: 'Rest',

  // Community catalog
  plansTabCommunity: 'Catalog',
  plansCommunityPageHint: 'Ready-made plans from others — import and train.',
  communitySortPopular: 'Popular',
  communitySortNewest: 'Newest',
  communitySortImports: 'Imports',
  communityEmpty: 'Plans from others will appear here.',
  communityEmptyHint: 'You can publish your own from the Mine tab.',
  communityEmptyCta: 'My plans',
  communityOffline: 'No internet — community unavailable.',
  communityCachedOffline: 'You\u2019re offline — showing last loaded.',
  communityLoadError: 'Failed to load the catalog.',
  communityImports: (n: number) => (n === 1 ? '1 import' : `${n} imports`),
  communityDaysExercises: (days: number, exercises: number) =>
    `${days} ${days === 1 ? 'day' : 'days'} \u00B7 ${exercises} ex.`,
  communityByAuthor: (name: string) => name,
  communityImport: 'Import plan',
  communityImporting: 'Importing\u2026',
  communityImportDone: 'Imported as draft — activate to start training.',
  communityActivateHint: 'Activate and train',
  communityLike: 'Like',
  communityUnlike: 'Liked',
  communityLikeOwnForbidden: 'You can\u2019t like your own plan.',
  communityLikeDone: 'Liked',
  communityUnlikeDone: 'Like removed',
  communityLoginToLike: 'Log in to like',
  communityYourPlan: 'Your plan',
  communityRepublish: 'Republish',
  communityRepublishMissingPlan: 'Missing local source plan — open My plans.',
  communityAlreadyImported: 'You already have an import of this plan. Add another copy?',
  communityImportAgain: 'Add copy',
  communityPublishUpdated: 'Publication updated',
  communityPublishInvalidPlan: 'The plan has errors — fix them before publishing.',
  communityPublishMissingExercise: 'Missing exercise in library — fix the plan.',
  communityOfflineDetail: 'You\u2019re offline — showing saved version.',
  communityOfflineUnavailable: 'No internet and no saved copy of this plan.',
  communitySelfReportForbidden: 'You can\u2019t report your own plan.',
  communityPublishOfflineHint: 'Publishing requires internet.',
  communityShare: 'Share',
  communityShareCopied: 'Link copied',
  communityReport: 'Report',
  communityReportSpam: 'Spam',
  communityReportUnsafe: 'Unsafe',
  communityReportOther: 'Other',
  communityReportDone: 'Thanks for the report',
  // ── Plan reviews ──
  communityReviewsTitle: 'Reviews',
  communityReviewsCount: (n: number) => (n === 1 ? '1 review' : `${n} reviews`),
  communityReviewsEmpty: 'No reviews yet — be the first!',
  communityReviewAdd: 'Review plan',
  communityReviewEdit: 'Edit review',
  communityReviewDelete: 'Delete review',
  communityReviewDeleteConfirm: 'Delete your review?',
  communityReviewDeleteConfirmMessage: 'This action is irreversible. Your rating and comment will be permanently removed.',
  communityReviewRatingLabel: 'Rating (1-5 stars)',
  communityReviewCommentLabel: 'Comment (optional)',
  communityReviewCommentPlaceholder: 'E.g. good starter plan, but not enough volume…',
  communityReviewSubmit: 'Submit review',
  communityReviewUpdate: 'Update review',
  communityReviewDone: 'Review submitted',
  communityReviewDeleted: 'Review deleted',
  communityReviewSelfForbidden: 'You cannot review your own plan',
  communityReviewLoginRequired: 'Log in to review',
  communityReviewCommentTooLong: 'Comment can be max 500 characters',
  communityReviewYourReview: 'Your review',
  communityReviewAnonymous: 'Anonymous',
  communityReviewStars: (n: number) => `${n} of 5 stars`,
  // ── Weekly challenge ──
  challengeTitle: 'Weekly challenge',
  challengeTarget: (n: number) => `Goal: ${n} reps`,
  challengeEndsIn: (days: number) =>
    days <= 0 ? 'Ended' : days === 1 ? 'Ends in 1 day' : `Ends in ${days} days`,
  challengeParticipants: (n: number) => (n === 1 ? '1 participant' : `${n} participants`),
  challengeJoin: 'Join challenge',
  challengeSubmit: 'Submit result',
  challengeSubmitHint: 'Enter your best result from this week',
  challengeRepsLabel: 'Number of reps',
  challengeRepsPlaceholder: 'E.g. 85',
  challengeNewBest: 'New personal best!',
  challengeNotBest: 'Not your best result — kept the previous one',
  challengeLoginRequired: 'Log in to participate',
  challengeNotActive: 'Challenge is no longer active',
  challengeInvalidReps: 'Enter a valid number of reps',
  challengeLeaderboard: 'Leaderboard',
  challengeLeaderboardEmpty: 'No results yet — be the first!',
  challengeRank: 'Rank',
  challengeRankPosition: (n: number) => `Rank ${n}`,
  challengeYourResult: 'Your result',
  challengeAnonymous: 'Anonymous',
  challengeYouLabel: 'You',
  challengeWeekKey: (week: string) => `Week ${week}`,
  challengeProgressLabel: (current: number, target: number) => `${current} / ${target} reps`,
  challengeProgressAria: (current: number, target: number) =>
    `Progress: ${current} of ${target} reps, ${Math.round((current / target) * 100)} percent`,
  // ── Follow system ──
  followButton: 'Follow',
  followingButton: 'Following',
  unfollowButton: 'Unfollow',
  followDone: 'Following',
  unfollowDone: 'Stopped following',
  followErrorGeneric: 'An error occurred. Please try again.',
  followAnonymous: 'Anonymous',
  followDisplayNameRequired: 'Set a display name in settings to make your profile public',
  followUnfollowFromList: 'Unfollow',
  challengeEnded: 'Challenge ended',
  challengeEndedHint: 'Results are closed. Check the final leaderboard!',
  challengeCancel: 'Cancel',
  unfollowConfirm: 'Stop following this user?',
  unfollowConfirmMessage: 'You will no longer see their progress in your following section.',
  followFollowing: (n: number) => (n === 1 ? '1 following' : `${n} following`),
  followFollowers: (n: number) => (n === 1 ? '1 follower' : `${n} followers`),
  followFollowersList: 'People following you',
  followFollowersEmpty: 'Nobody is following you yet',
  followFollowersEmptyHint: 'Publish a plan in the community catalog or set your profile public so others can find you.',
  followFollowersSheetTitle: (n: number) => (n === 0 ? 'Followers' : n === 1 ? '1 follower' : `${n} followers`),
  followFollowingSheetTitle: (n: number) => (n === 0 ? 'Following' : n === 1 ? '1 following' : `${n} following`),
  followFollowsYou: 'Follows you',
  followStatsPullupMax: 'Pull-up max',
  followStatsTotalReps: 'Total reps',
  followStatsBestStreak: 'Best streak',
  followEmpty: 'You are not following anyone yet',
  followEmptyHint: 'Find plans in the community catalog and follow their authors.',
  followLoginRequired: 'Log in to follow',
  followCannotFollowSelf: 'You cannot follow yourself',
  followUserNotPublic: 'This user does not have a public profile',
  followPublicProfile: 'Public profile',
  followPublicProfileHint: 'Allow others to see your progress and follow you',
  followMakePublic: 'Make profile public',
  followMakePrivate: 'Make profile private',
  followDisplayName: 'Display name',
  followBio: 'Bio',
  followBioPlaceholder: 'A bit about you — training goal, experience…',
  followBioHint: 'Max 200 characters',
  followSaveProfile: 'Save profile',
  followProfileSaved: 'Profile saved',
  followStatsTotalSessions: 'Sessions',
  followStatsCurrentStreak: 'Week streak',
  followStatsPushupMax: 'Pushup max',
  followFollowingList: 'Following',
  communityUnavailable: 'Plan unavailable',
  communityUnavailableHint: 'The publication has been withdrawn or deleted.',
  communityLoginRequired: 'Log in to continue',
  communityLoginToImport: 'Log in to import',
  communityNeedOnline: 'Requires internet',
  communityPublish: 'Publish to catalog',
  communityPublishUpdate: 'Update publication',
  communityUnpublish: 'Remove from catalog',
  communityUnpublishConfirm: 'Remove plan from catalog? The link will stop working for others.',
  communityUnpublishDone: 'Publication removed',
  communityPublishTitle: 'Title',
  communityPublishDescription: 'Description',
  communityPublishTags: 'Tags',
  communityPublishTagsHint: 'Max 3 — help with filtering.',
  communityPublishSubmit: 'Publish',
  communityPublishDone: 'Plan published',
  communityPublishNeedActive: 'Activate the plan first.',
  communityPublishNeedName: 'Enter an author name.',
  communityPublishNeedTitle: 'Enter a publication title.',
  communityPublishNeedPublicProfile: 'Set your profile to public to publish a plan.',
  communityPublishNeedPublicProfileHint: 'Others need to know who creates plans. Go to Profile → Follow and make your profile public.',
  communityPublishGoToProfile: 'Go to profile',
  communityPublishHint: 'The current plan structure (days, sets, rest) goes to the catalog.',
  communityDisplayName: 'Catalog name',
  communityDisplayNameHint: 'Visible on your publications.',
  communitySelfImportHint: 'You\u2019re importing your own plan as a local copy.',
  communityMyPublications: 'My publications',
  communityMyPublicationsEmpty: 'No publications yet.',
  communityMyPublicationsEmptyHint: 'Publish an active plan from the Mine tab.',
  communityStatusPublished: 'In catalog',
  communityStatusUnpublished: 'Removed',
  communityTagHome: 'Home',
  communityTagGym: 'Gym',
  communityTagBodyweight: 'Bodyweight',
  communityTagWeights: 'Weights',
  communityTagShortCycle: 'Short cycle',
  communityTagLongCycle: 'Long cycle',
  communityFilterAll: 'All',
  communityTeaserTitle: 'From the catalog',
  communityTeaserHint: 'Ready-made plans to import.',
  communityTeaserCta: 'See more',
  communityDetailDays: 'Day by day plan',
  communityDetailMeta: (likes: number, imports: number) =>
    `${likes === 1 ? '1 like' : `${likes} likes`} \u00B7 ${imports === 1 ? '1 import' : `${imports} imports`}`,
  communityAccountSwitchPending: 'Resolve the account switch first.',
  communityRateLimited: 'Publish limit reached — try tomorrow.',
  communityErrorGeneric: 'Something went wrong. Try again.',
  communityCharCount: (n: number, max: number) => `${n}/${max}`,
  communityTrainedBadge: 'Trained',
  communityImpactTitle: 'Your impact',
  communityImpactLikes: 'Likes',
  communityImpactImports: 'Imports',
  communityImpactTrained: 'Workouts from plans',
  communityImpactNext: 'Next badge',

  tabAchievements: 'Badges',
  achievementsTitle: 'Badges',
  achievementsEmpty: 'Your badges will appear here.',
  achievementsEmptyHint: 'Train — the first ones will come on their own.',
  achievementsEmptyUnlocked: 'No unlocked badges in this filter.',
  achievementsEmptyUnlockedHint: 'Keep training — badges come on their own.',
  achievementsFilterAll: 'All',
  achievementsFilterUnlocked: 'Unlocked',
  achievementsTrackTraining: 'Training',
  achievementsTrackHabit: 'Habit',
  achievementsTrackCatalog: 'Catalog',
  achievementsTrackLegend: 'Legends',
  achievementsRarityCommon: 'Common',
  achievementsRarityRare: 'Rare',
  achievementsRarityLegendary: 'Legendary',
  /** Trophy material label — describes the trophy's metal, shown alongside rarity. */
  achievementsTrophyBronze: 'Bronze',
  achievementsTrophySilver: 'Silver',
  achievementsTrophyGold: 'Gold',
  achievementsTrophyDiamond: 'Diamond',
  /** Masculine material forms — agree with masculine shapes (cup, medal, gem). */
  achievementsTrophyBronzeM: 'Bronze',
  achievementsTrophySilverM: 'Silver',
  achievementsTrophyGoldM: 'Gold',
  achievementsTrophyDiamondM: 'Diamond',
  /** Plural material forms — for summary counts ("2 gold"). */
  achievementsTrophyBronzePl: 'bronze trophies',
  achievementsTrophySilverPl: 'silver trophies',
  achievementsTrophyGoldPl: 'gold trophies',
  achievementsTrophyDiamondPl: 'diamond trophies',
  /** Trophy shape labels — describes the trophy's silhouette. */
  achievementsTrophyShapeCup: 'cup',
  achievementsTrophyShapeShield: 'shield',
  achievementsTrophyShapeMedal: 'medal',
  achievementsTrophyShapeCrown: 'crown',
  achievementsTrophyShapeDiamond: 'gem',
  /** Combined trophy label — material + shape, e.g. "Gold cup". */
  achievementsTrophyFullLabel: (material: string, shape: string) => `${material} ${shape}`,
  /** Celebration badge with trophy — e.g. "Gold cup!". */
  celebrationAchievementTrophy: (label: string) => `${label}!`,
  /** Trophy summary counts — e.g. "2 diamond, 3 gold". */
  achievementsTrophySummary: (parts: string) => parts,
  achievementsDiamondProgress: 'Diamond collection',
  achievementsUnlockedOn: (date: string) => `Unlocked ${date}`,
  achievementsLockedHint: 'Still ahead of you.',
  achievementsSecretLocked: '???',
  achievementsSecretLockedHint: 'A secret — you\u2019ll discover it along the way.',
  achievementsInProgress: 'In progress',
  achievementsProgress: (current: number, target: number) => `${current} / ${target}`,
  achievementsUnlockTitle: 'New badge',
  achievementsBackfillTitle: 'Badges from history',
  achievementsBackfillBody: (n: number) =>
    n === 1 ? 'Discovered 1 badge from your workout history.' : `Discovered ${n} badges from your workout history.`,
  achievementsBackfillCta: 'See badges',
  achievementsProfileTitle: 'Badges',
  achievementsProfileSeeAll: 'All',
  achievementsShowcaseOverline: 'Showcase',
  achievementsShowcaseAria: 'Badge showcase',
  achievementsShowcaseSlotsAria: 'Selected showcase slots',
  achievementsShowcaseEmptyHint: 'Show your unlocked badges here.',
  achievementsShowcaseAutoHint: 'Your strongest — you can pick your own.',
  achievementsShowcasePinnedHint: 'Your selected badges.',
  achievementsShowcaseEdit: 'Select',
  achievementsShowcaseAddSlot: 'Add',
  achievementsShowcaseEmptySlot: 'Empty',
  achievementsShowcasePickTitle: 'Showcase',
  achievementsShowcasePickHint: (n: number) =>
    `Pick up to ${n} badges or leave it on auto.`,
  achievementsShowcaseSelectedCount: (selected: number, max: number) =>
    `${selected} / ${max} selected`,
  achievementsShowcaseAuto: 'Automatic',
  achievementsShowcaseAutoBadge: 'AUTO',
  achievementsShowcaseClear: 'Clear',
  achievementsShowcaseSave: 'Save showcase',
  achievementsShowcaseNoUnlocks: 'Unlock a badge first — then pick it here.',
  achievementsHomeTipTitle: 'New badge',
  achievementsHomeTipTitleMany: (n: number) => `New badges (${n})`,
  achievementsHomeTipBody: 'See what you just unlocked.',
  achievementsHomeTipCta: 'Badges',

  achievement_first_session_title: 'First day',
  achievement_first_session_desc: 'You completed your first session. That\u2019s how it starts.',
  achievement_habit_3_in_14_title: 'Getting started',
  achievement_habit_3_in_14_desc: 'Three workouts in 14 days — rhythm locked in.',
  achievement_first_custom_session_title: 'Your own path',
  achievement_first_custom_session_desc: 'First workout on a custom plan.',
  achievement_cycle_closed_strong_title: 'Closed cycle',
  achievement_cycle_closed_strong_desc: 'You completed an entire training cycle.',
  achievement_goal_pushups_100_title: 'Century club',
  achievement_goal_pushups_100_desc: '100 pushups in a max test.',
  achievement_goal_pullups_50_title: 'Half century on the bar',
  achievement_goal_pullups_50_desc: '50 pullups in a max test.',
  achievement_goal_pullups_30_title: 'Bar goal',
  achievement_goal_pullups_30_desc: '30 pullups in a max test.',
  achievement_workshop_custom_title: 'Workshop',
  achievement_workshop_custom_desc: 'A custom plan with a few exercises — and a few sessions on it.',
  achievement_pr_repeat_3_title: 'Repeated PR',
  achievement_pr_repeat_3_desc: 'A PR in the same cycle day across three sessions.',
  achievement_sessions_100_title: 'Session marathon',
  achievement_sessions_100_desc: 'One hundred completed workouts.',
  achievement_streak_1_title: 'One week streak',
  achievement_streak_1_desc: 'A workout this week — the streak has begun.',
  achievement_streak_4_title: 'Month of rhythm',
  achievement_streak_4_desc: 'Four weeks in a row at your best streak.',
  achievement_streak_12_title: 'The quarter',
  achievement_streak_12_desc: 'Twelve weeks of streak at your best.',
  achievement_streak_52_title: 'Unbroken year',
  achievement_streak_52_desc: 'Fifty-two weeks at your best streak.',
  achievement_comeback_stronger_title: 'Comeback stronger',
  achievement_comeback_stronger_desc: 'After a long break you came back and found your rhythm.',
  achievement_first_publish_title: 'In the catalog',
  achievement_first_publish_desc: 'Your plan is available to others.',
  achievement_first_like_title: 'First like',
  achievement_first_like_desc: 'Someone appreciated your plan.',
  achievement_first_import_title: 'Someone took the plan',
  achievement_first_import_desc: 'Your plan made it into someone\u2019s library.',
  achievement_first_trained_title: 'Someone trained',
  achievement_first_trained_desc: 'Import is just the start — someone did a session on it.',
  achievement_plan_with_legs_title: 'Plan with legs',
  achievement_plan_with_legs_desc: 'Several imports and real training on one plan.',
  achievement_trainer_25_title: 'Home trainer',
  achievement_trainer_25_desc: 'Twenty-five workouts on your plans.',
  achievement_poly_publisher_title: 'Many voices',
  achievement_poly_publisher_desc: 'Several publications and a solid number of imports.',
  achievement_legend_full_circle_title: 'Full circle',
  achievement_legend_full_circle_desc: 'Strength goal, long streak, and catalog impact.',
  achievement_legend_quiet_master_title: 'Quiet master',
  achievement_legend_quiet_master_desc: 'Hundreds of sessions and a six-month streak — no fanfare.',
  achievement_secret_night_title: 'After hours',
  achievement_secret_night_desc: 'Night workouts — peace when others sleep.',
  achievement_secret_precision_title: 'Precision',
  achievement_secret_precision_desc: 'Many custom days closed on target, not \u201Cclose enough\u201D.',

  // \u2500\u2500 Progressive tier copy \u2500\u2500
  achievementsTierLevel: (level: number, max: number) => `Level ${level} of ${max}`,
  achievementsTierNext: (current: number, next: number) =>
    `From ${current} \u2192 next level: ${next}`,
  achievementsTierMaxed: () => `Max level reached`,
  achievementsTierUpgradeTitle: 'New badge level!',
  achievementsNextTier: 'Next level',
  achievementsSummaryIcon: '\uD83C\uDFC6',
  achievementsSummaryTitle: 'New badge!',
  achievementsSummaryTitleMulti: (n: number) => `${n} new badges!`,
  achievementsSummarySubtitle: 'Congratulations — keep it up!',
  achievementsSummarySeeAll: 'See all badges',

  // \u2500\u2500 New long-distance achievements \u2500\u2500
  achievement_streak_26_title: 'Half a year of rhythm',
  achievement_streak_26_desc: 'Twenty-six weeks of streak at your best.',
  achievement_volume_10k_title: 'Ten thousand reps',
  achievement_volume_10k_desc: 'Total reps across your entire workout history.',
  achievement_cycles_5_title: 'Five cycles',
  achievement_cycles_5_desc: 'Five training cycles completed end to end.',
  achievement_legend_grandmaster_title: 'Grandmaster',
  achievement_legend_grandmaster_desc:
    'A thousand sessions and two years of streak — the absolute peak of consistency.',

  // \u2500\u2500 Custom sessions volume \u2500\u2500
  achievement_custom_sessions_25_title: 'Physique architect',
  achievement_custom_sessions_25_desc: 'Sessions on custom plans — consistency in building your body.',
  // \u2500\u2500 PR master \u2500\u2500
  achievement_pr_master_title: 'PR master',
  achievement_pr_master_desc: 'Repeated PRs in the same context — strength is growing.',
  // \u2500\u2500 Habit builder \u2500\u2500
  achievement_habit_builder_title: 'Habit builder',
  achievement_habit_builder_desc: 'More and more sessions in 14 days — the habit is taking root.',
  // \u2500\u2500 Community impact \u2500\u2500
  achievement_liked_author_title: 'Liked author',
  achievement_liked_author_desc: 'Your plans gather likes — the community appreciates them.',
  achievement_imported_author_title: 'Imported author',
  achievement_imported_author_desc: 'Your plans are imported — real reach.',
  achievement_community_pillar_title: 'Community pillar',
  achievement_community_pillar_desc: 'More and more published plans — you\u2019re building the community.',
  // \u2500\u2500 Custom plan creator \u2500\u2500
  achievement_custom_creator_title: 'Plan creator',
  achievement_custom_creator_desc: 'More and more custom plans — your training library.',
  // \u2500\u2500 Both programs \u2500\u2500
  achievement_both_programs_title: 'All-around',
  achievement_both_programs_desc: 'Pushups and pullups — both programs mastered.',
  // \u2500\u2500 Secret dawn \u2500\u2500
  achievement_secret_dawn_title: 'Early bird',
  achievement_secret_dawn_desc: 'Workouts at dawn — when the light wakes up with you.',
  // \u2500\u2500 Secret marathon \u2500\u2500
  achievement_secret_marathon_title: 'Training marathon',
  achievement_secret_marathon_desc: 'Sessions lasting over an hour — patience and volume.',

  // ── NEW: AI coach ──
  achievement_ai_first_insight_title: 'AI assistant',
  achievement_ai_first_insight_desc: 'First insight from AI — your coach is watching your training.',
  achievement_ai_coach_user_title: 'AI familiar',
  achievement_ai_coach_user_desc: 'More and more AI insights — your coach is always at hand.',

  // ── NEW: Custom exercises ──
  achievement_exercise_creator_title: 'Exercise creator',
  achievement_exercise_creator_desc: 'Custom exercises in your library — full personalization.',

  // ── NEW: Body weight tracking ──
  achievement_weight_tracker_title: 'Weight tracking',
  achievement_weight_tracker_desc: 'Regular weight entries — tracking your physique progress.',

  // ── NEW: Weekend warrior ──
  achievement_weekend_warrior_title: 'Weekend warrior',
  achievement_weekend_warrior_desc: 'Workouts on Saturdays and Sundays — the rhythm never stops.',

  // ── NEW: Follow system ──
  achievement_first_follower_title: 'First follower',
  achievement_first_follower_desc: 'Someone decided to follow you — the community is growing.',
  achievement_followed_by_25_title: 'Recognition',
  achievement_followed_by_25_desc: 'More and more followers — your training inspires others.',
  achievement_first_follow_title: 'First follow',
  achievement_first_follow_desc: 'You follow your first person — tracking someone else\'s progress.',

  // ── NEW: Community reviews ──
  achievement_first_review_title: 'First review',
  achievement_first_review_desc: 'You rated a plan in the catalog — helping others choose.',
  achievement_reviewer_10_title: 'Training critic',
  achievement_reviewer_10_desc: 'More and more reviews — your voice counts.',

  // ── NEW: Weekly challenge ──
  achievement_challenge_first_title: 'Contender',
  achievement_challenge_first_desc: 'You joined the weekly challenge — competition begins.',
  achievement_challenge_winner_title: 'Challenge champion',
  achievement_challenge_winner_desc: 'You won the weekly challenge — number one on the board.',
  achievement_challenge_5_title: 'Challenge veteran',
  achievement_challenge_5_desc: 'More and more challenges — competition is your nature.',

  // ── NEW: Legend — community ──
  achievement_legend_community_title: 'Community voice',
  achievement_legend_community_desc: 'Publications, followers, and reviews — your impact is real.',

  // ── NEW: Secret — weekend ──
  achievement_secret_weekend_title: 'Weekends only',
  achievement_secret_weekend_desc: 'Workouts only on weekends — while others rest, you work.',

  // ── Builtin exercise names (used in plan-resolver, workout-analyzer) ──
  builtinExercisePushups: 'Pushups',
  builtinExercisePullups: 'Pull-ups',
  builtinExerciseUnknown: 'Unknown exercise',
  builtinWorkoutFallback: 'Workout',
  exerciseFallbackName: 'Exercise',

  // ── Full muscle group labels (for AI analysis) ──
  muscleGroupFull_chest: 'Chest',
  muscleGroupFull_back: 'Back',
  muscleGroupFull_shoulders: 'Shoulders',
  muscleGroupFull_arms: 'Arms',
  muscleGroupFull_legs: 'Legs',
  muscleGroupFull_core: 'Core',
  muscleGroupFull_full_body: 'Full body',
  muscleGroupFull_cardio: 'Cardio',
  muscleGroupFull_other: 'Other',

  // ── AI client error messages (shown via e.message) ──
  aiErrorOfflineConnection: 'No internet connection.',
  aiErrorNoApiKey: 'Missing API key.',
  aiErrorConnection: 'Failed to connect to API. Check your internet connection.',
  aiErrorInvalidKey: (detail: string) => `Invalid API key. ${detail}`.trim(),
  aiErrorRateLimited: 'Too many requests. Wait a moment and try again.',
  aiErrorModelNotFound: (model: string) =>
    `Model "${model}" does not exist or is unavailable. Check the model name in AI settings.`,
  aiErrorBadRequest: (detail: string) =>
    `Invalid API request. ${detail}`.trim(),
  aiErrorLoopDetected: 'AI model entered a loop. Try again or use a different model.',
  aiErrorServiceUnavailable: 'AI server is temporarily unavailable. Try again in a moment.',
  aiErrorGenericStatus: (status: number, detail: string) =>
    `API error (${status}). ${detail}`.trim(),
  aiErrorInvalidResponse: 'Invalid API response.',
  aiErrorParseJson: 'AI returned invalid JSON. Try again.',
  aiErrorParseAnalysis: 'AI did not return a valid analysis.',
  aiErrorParsePlan: 'AI did not return a valid plan.',
  aiPlanFallbackName: 'AI Plan',

  // ── AI rate limiting ──
  aiRateLimitCooldown: (retryIn: string) =>
    `Wait ${retryIn} before another AI request.`,
  aiRateLimitQuota: (remaining: number, quota: number) =>
    `Daily AI limit reached (${quota} requests/day). Remaining: ${remaining}. Try tomorrow.`,
  aiRateLimitInflight: 'AI is already processing another request. Please wait.',
  aiAnalysisCacheFresh: (age: string) =>
    `Analysis from ${age} ago. Refresh soon to generate a new one.`,
  aiAnalysisCacheStale: 'Analysis may be outdated. Click to refresh.',

  // ── Plans toast ──
  plansRepairedToast: (plans: number, sets: number) =>
    `Repaired ${plans} plan(s): ${sets} sets.`,

  // ── Cycle names and descriptions (builtin programs) ──
  // Keys map cycle.id with hyphens → underscores
  cycleName_pushups_ponizej_5: 'Below 5 pushups',
  cycleDesc_pushups_ponizej_5:
    'Starter program for those doing fewer than 5 pushups in the test. Builds basic strength and endurance.',
  cycleName_pushups_6_10: '6–10 pushups',
  cycleDesc_pushups_6_10:
    'For those doing 6–10 pushups in the test. Develops strength and volume.',
  cycleName_pushups_11_20: '11–20 pushups',
  cycleDesc_pushups_11_20:
    'For those doing 11–20 pushups in the test. Builds strength endurance.',
  cycleName_pushups_21_25: '21–25 pushups',
  cycleDesc_pushups_21_25:
    'For those doing 21–25 pushups in the test. Increases volume and endurance.',
  cycleName_pushups_26_30: '26–30 pushups',
  cycleDesc_pushups_26_30:
    'For those doing 26–30 pushups in the test. Develops power and endurance.',
  cycleName_pushups_31_35: '31–35 pushups',
  cycleDesc_pushups_31_35:
    'For those doing 31–35 pushups in the test. Advanced endurance.',
  cycleName_pushups_36_40: '36–40 pushups',
  cycleDesc_pushups_36_40:
    'For those doing 36–40 pushups in the test. High strength endurance.',
  cycleName_pushups_41_45: '41–45 pushups',
  cycleDesc_pushups_41_45:
    'For those doing 41–45 pushups in the test. Elite endurance.',
  cycleName_pushups_46_50: '46–50 pushups',
  cycleDesc_pushups_46_50:
    'For those doing 46–50 pushups in the test. Master-level endurance.',
  cycleName_pushups_51_55: '51–55 pushups',
  cycleDesc_pushups_51_55:
    'For those doing 51–55 pushups in the test. Elite expert level.',
  cycleName_pushups_56_60: '56–60 pushups',
  cycleDesc_pushups_56_60:
    'For those doing 56–60 pushups in the test. High repeatability.',
  cycleName_pushups_powyzej_60: 'Above 60 pushups',
  cycleDesc_pushups_powyzej_60:
    'For those doing more than 60 pushups in the test. Master level.',

  cycleName_pullups_ponizej_4: 'Below 4 pull-ups',
  cycleDesc_pullups_ponizej_4:
    'Starter program for those doing fewer than 4 pull-ups. Builds base strength with negatives.',
  cycleName_pullups_4_5: '4–5 pull-ups',
  cycleDesc_pullups_4_5:
    'For those doing 4–5 pull-ups. Develops strength and volume.',
  cycleName_pullups_6_8: '6–8 pull-ups',
  cycleDesc_pullups_6_8:
    'For those doing 6–8 pull-ups. Increases volume.',
  cycleName_pullups_9_11: '9–11 pull-ups',
  cycleDesc_pullups_9_11:
    'For those doing 9–11 pull-ups. Develops strength endurance.',
  cycleName_pullups_12_15: '12–15 pull-ups',
  cycleDesc_pullups_12_15:
    'For those doing 12–15 pull-ups. Advanced volume.',
  cycleName_pullups_16_20: '16–20 pull-ups',
  cycleDesc_pullups_16_20:
    'For those doing 16–20 pull-ups. High endurance.',
  cycleName_pullups_21_25: '21–25 pull-ups',
  cycleDesc_pullups_21_25:
    'For those doing 21–25 pull-ups. Elite endurance.',
  cycleName_pullups_26_30: '26–30 pull-ups',
  cycleDesc_pullups_26_30:
    'For those doing 26–30 pull-ups. Master-level endurance.',
  cycleName_pullups_31_35: '31–35 pull-ups',
  cycleDesc_pullups_31_35:
    'For those doing 31–35 pull-ups. Elite level.',
  cycleName_pullups_36_40: '36–40 pull-ups',
  cycleDesc_pullups_36_40:
    'For those doing 36–40 pull-ups. Advanced level.',
  cycleName_pullups_powyzej_40: 'Above 40 pull-ups',
  cycleDesc_pullups_powyzej_40:
    'For those doing more than 40 pull-ups. Master expert level.',

  // ── Legal pages ──
  privacyBody1:
    'SmartReps is a workout app that runs primarily locally on your device (IndexedDB / Dexie). Your progress, sessions, and settings are stored on your device.',
  privacyBody2:
    'Optionally, you can provide an email address and log in via Supabase (OTP code) to sync progress across devices. We then process your account ID, email, and workout data necessary for synchronization.',
  privacyBody3:
    'We do not sell data. We do not build advertising profiles. You can enable reminders in two modes: (1) locally when the app is open, or (2) optionally as Web Push after installing the PWA and logging in — then notifications may arrive even when the app is closed. The push subscription endpoint is linked to your account.',
  privacyBodyExport: 'Data export:',
  privacyBodyExportDetail:
    'in Profile → "Data" section you can download workout history (CSV) or a full backup (JSON) with progress and settings from this device.',
  privacyBodyCommunity: 'Community catalog:',
  privacyBodyCommunityDetail:
    'when publishing a plan, we store a workout snapshot, author display name, tags, and metadata (e.g. likes and imports count) in the cloud. Importing and liking require an account. The catalog does not expose your email or private drafts.',
  privacyBodyDelete: 'Account deletion:',
  privacyBodyDeleteDetail:
    'a logged-in user can permanently delete their cloud account in Profile (progress, sessions, push subscriptions, community publications, likes, imports, and reports linked to the account). Account deletion does not automatically delete local data — you can clear it separately. We recommend downloading a backup before deletion.',
  privacyBodyLocal:
    'You can clear local data at any time in Profile and log out without deleting your cloud account.',
  privacyBodyContact:
    'Privacy contact: via issues in the SmartReps repository on GitHub.',

  termsBody1:
    'By using SmartReps you accept that the app is for tracking strength training (pushups, pull-ups) following plans inspired by public progression programs.',
  termsBody2:
    'Strength training carries injury risk. Consult a doctor before starting if you have health concerns. SmartReps does not replace medical advice.',
  termsBody3:
    'The app is provided "as is". We strive for offline and cloud sync functionality, but do not guarantee uninterrupted availability of external services (e.g. email OTP delivery).',
  termsBody4:
    'Workout plans reference materials from 100pompek.pl and podciaganie.pl — rights to the original programs belong to their authors; SmartReps implements progress tracking.',
  termsBody5:
    'In the community catalog you can publish your own plans (title, description, workout structure) and import other users\' plans as a local copy. By publishing, you grant SmartReps a non-exclusive license to display the plan in the catalog and allow other users to import a copy. Do not publish personal data in descriptions or unsafe / illegal content. You can unpublish and report others\' content. We reserve the right to hide or remove reported publications.',
  termsBody6:
    'You can stop using the app at any time and delete local data in Profile. By continuing, you confirm you have read the privacy policy.',

  // ── AI prompts (research context + plan generation) ──
  aiPromptResearchContext: `You are a strength training expert with research-based knowledge.

Key principles you follow:

1. VOLUME (Volume Landmarks — Israetel & Hoffmann):
   - MEV (Minimum Effective Volume): 10 sets per muscle group per week (beginners)
   - MAV (Maximum Adaptive Volume): 15-25 sets per muscle group per week (intermediate)
   - MRV (Maximum Recoverable Volume): 20-30+ sets per muscle group per week (advanced)
   - Each muscle group should receive volume in the MEV-MAV range

2. FREQUENCY (Schoenfeld et al. 2016):
   - Each muscle group 2x per week (optimal for hypertrophy)
   - 1x per week acceptable for beginners or low training frequency
   - 3x+ per week for small groups (core, calves) or when volume is low

3. PROGRESSION (Progressive Overload):
   - Increase load by 2.5-5% or 1-2 reps when all sets are in RPE 7-8 range
   - RPE 7 = 3 reps in reserve (RIR=3)
   - RPE 8 = 2 reps in reserve (RIR=2)
   - RPE 9 = 1 rep in reserve (RIR=1)
   - Do not train to muscular failure regularly (RPE 10) — increases injury risk and fatigue

4. EXERCISE SELECTION:
   - Prioritize compound exercises (squats, deadlifts, presses, rows)
   - 60-70% volume from compound exercises, 30-40% from isolation
   - For each muscle group: 1 compound exercise + 1-2 isolation

5. REST INTERVALS:
   - Strength exercises (1-6 rep): 3-5 min
   - Hypertrophy (6-12 rep): 60-90 sec
   - Endurance (12+ rep): 30-60 sec
   - Core/isolation: 45-60 sec

6. DELOAD:
   - Every 4-6 weeks reduce volume by 40-50% while maintaining intensity
   - Deload after 3-4 weeks at high RPE (8-9)

7. SAFETY:
   - Never suggest high-injury-risk exercises without proper preparation
   - Consider experience level and available equipment
   - Always start with a warm-up (5-10 min) — do not count toward volume`,

  aiPromptPlanSystem: 'You are a strength training expert. You generate workout plans in JSON format.',
  aiPromptPlanUser: (desc: string, days: number, experience: string, equipment: string, goal: string, duration?: string) =>
    `Create a workout plan for ${days} days per week.\n\nGoal description: ${desc}\nLevel: ${experience}\nEquipment: ${equipment}\nGoal: ${goal}${duration ? `\nWorkout duration: ${duration} min` : ''}\n\nReturn ONLY valid JSON matching the schema. No comments or text outside JSON.`,
  aiPromptPlanExample: 'Example of a valid plan:',
  aiPromptPlanExampleJson:
    '{"name":"Dumbbell hypertrophy plan, 4 days per week","description":"Push/Pull/Legs/Upper","days":[{"dayNumber":1,"restAfterDays":1,"exercises":[{"exerciseName":"Dumbbell bench press","sets":3,"targetReps":"8-12","restSeconds":90,"note":"Control the descent"}]}]}',
  aiPromptPlanRules: `Rules:
1. Each exercise must have a name, sets, rep target (or range), rest in seconds.
2. Include rest after training day (1 or 2 days).
3. Warm-up does not count toward working sets.
4. Do not use high-injury-risk exercises.
5. Return only JSON — no markdown, no comments.`,

  aiPromptAnalysisSystem: 'You are a strength training expert. You analyze the user\'s workout history and provide research-based suggestions.',
  aiPromptAnalysisUser: (sessions: string) =>
    `Analyze my workout history (last ${sessions} sessions) and provide suggestions. Return ONLY valid JSON matching the schema.`,
  aiPromptAnalysisRules: `Analysis rules:
1. Assess volume per muscle group (optimal / below MEV / above MRV).
2. Identify strengths and weaknesses.
3. Provide specific suggestions with priority (high/medium/low).
4. Return only JSON — no markdown, no comments.`,

  // ── Service worker push fallback ──
  swPushBody: 'Time to train — check your plan for today.',

  // ── AI prompt maps (equipment/goal/experience for prompt construction) ──
  aiPromptEquipmentBodyweight: 'bodyweight only (no equipment)',
  aiPromptEquipmentDumbbells: 'dumbbells',
  aiPromptEquipmentBarbell: 'barbell',
  aiPromptEquipmentFullGym: 'full gym',
  aiPromptEquipmentKettlebell: 'kettlebells',
  aiPromptGoalHypertrophy: 'hypertrophy (building muscle mass)',
  aiPromptGoalStrength: 'strength',
  aiPromptGoalEndurance: 'muscular endurance',
  aiPromptGoalGeneral: 'general fitness',
  aiPromptGoalFatLoss: 'fat loss',
  aiPromptExperienceBeginner: 'beginner (0-6 months experience)',
  aiPromptExperienceIntermediate: 'intermediate (6 months - 2 years)',
  aiPromptExperienceAdvanced: 'advanced (2+ years)',

  // ── AI plan generation full prompt ──
  aiPromptPlanBuild: (
    desc: string,
    days: number,
    experience: string,
    equipment: string,
    goal: string,
    duration: string,
    libraryList: string,
  ) => `Create a workout plan based on:
- User description: "${desc}"
- Days per week: ${days}
- Level: ${experience}
- Equipment: ${equipment}
- Goal: ${goal}
${duration}

EXERCISE LIBRARY (use these when they fit, but you can propose new ones):
${libraryList}

RULES:
1. Use exercises from the library when they fit the goal and equipment. If using a library exercise, keep its primaryMetric.
2. You can propose NEW exercises — they will be added to the library. Give a realistic name in English.
3. Each exercise must have a metric: "reps" (repetitions), "reps_weight" (reps + weight), or "duration_sec" (time in seconds). For weighted exercises use "reps_weight" and set weightKg in sets.
4. Choose sets, reps, and rest according to research (see system context).
5. Distribute muscle groups across days so each is trained 2x per week (or 1x for beginners).
6. Include rest after training day (1 or 2 days).
7. Add progression (increase by 1-2 reps or 2.5kg after a full cycle).
8. Return EXACTLY ${days} training days (as many as the user selected).
9. Maximum 10 exercises per day, maximum 5 sets per exercise.
10. Plan name in English, short and descriptive (e.g. "Push/Pull/Legs 4x week").
11. Use ONLY kind: "fixed", "max", "min", or "exact". Do NOT use "range" or others.

ALLOWED muscleGroup values: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".
ALLOWED primaryMetric values: "reps", "reps_weight", "duration_sec".
ALLOWED kind values in MetricTarget: "fixed", "max", "min", "exact".

Return JSON in this format (this is an example, replace values):
{
  "plan": {
    "name": "Push/Pull/Legs 4x week",
    "description": "Dumbbell hypertrophy plan, 4 days per week.",
    "days": [
      {
        "dayNumber": 1,
        "restAfterDay": 1,
        "exercises": [
          {
            "exerciseName": "Pushups",
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
    "rationale": "Plan distributes 12-16 sets across major muscle groups, 2x per week."
  }
}`,
  aiPromptLibraryEmpty: '  (empty library)',
  aiPromptLibraryEntry: (id: string, name: string, metric: string, group: string) =>
    `  - id: "${id}", name: "${name}", metric: "${metric}", group: "${group}"`,

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
  ) => `Analyze the user's workout history and provide specific suggestions.

DATA:
- Number of sessions: ${totalSessions}
- Total sets: ${totalSets}
- Total reps: ${totalReps}
- Period: ${dateRange}
- Sessions per week: ${sessionsPerWeek}
${activePlan}

VOLUME PER MUSCLE GROUP (sets/week):
${volumeTable}

RECENT SESSIONS:
${recentTable}

Analysis rules:
1. Compare volume with MEV/MAV/MRV ranges (see system context).
2. Check if training frequency is optimal.
3. Identify muscle groups with insufficient or excessive volume.
4. Check if progression is appropriate.
5. Give 3-5 specific, practical suggestions (in English).

Return JSON in this format (this is an example, replace values):
{
  "analysis": {
    "summary": "Overall assessment of workouts (2-3 sentences in English)",
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "suggestions": [
      {
        "title": "Increase back volume",
        "description": "You train back 1x per week with 6 sets. Add a second day or exercise.",
        "priority": "high"
      }
    ],
    "volumeAssessment": [
      {
        "muscleGroup": "chest",
        "weeklySets": 12,
        "status": "optimal",
        "recommendation": "Volume in MAV range, maintain."
      }
    ]
  }
}

ALLOWED priority values: "high", "medium", "low".
ALLOWED status values: "optimal", "below_mev", "above_mrv", "low", "high".
ALLOWED muscleGroup values: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".`,
  aiPromptVolumeEntry: (group: string, sets: number) => `  ${group}: ${sets} sets/week`,
  aiPromptVolumeEmpty: '  (no data)',
  aiPromptRecentEmpty: '  (no sessions)',
  aiPromptDateRangeNone: 'no data',
  aiPromptNoActivePlan: '',
  aiPromptLanguageHint: 'English',

  // ── AI post-workout prompt building blocks ──
  aiPromptPostWorkoutDaySummary: (day: number, totalReps: number, logs: string) =>
    `Day ${day}, ${totalReps} total reps:\n${logs}`,
  aiPromptPostWorkoutDayBrief: (day: number, totalReps: number, sets: string) =>
    sets ? `Day ${day}, ${totalReps} total reps. ${sets}` : `Day ${day}, ${totalReps} total reps`,
  aiPromptPostWorkoutSetResult: (setNumber: number, actual: number, target: string) =>
    `Set ${setNumber}: ${actual} reps (target: ${target})`,
  aiPromptPostWorkoutPrevExercise: (name: string, totalReps: number) =>
    `  ${name}: ${totalReps} reps`,
  aiPromptPostWorkoutTrendEntry: (date: string, totalReps: number, day: number) =>
    `${date}: ${totalReps} reps (day ${day})`,
  aiPromptPostWorkoutPrSet: (setNumber: number, actual: number, prevBest: number) =>
    `Set ${setNumber}: ${actual} reps (previous best: ${prevBest})`,
  aiPromptPostWorkoutPrHeader: (entries: string) =>
    `\nPERSONAL RECORDS this session:\n${entries}`,
  aiPromptPostWorkoutFirstSession: 'First session',

  // ── AI post-workout full prompt ──
  aiPromptPostWorkoutBuild: (
    currentSummary: string,
    prInfo: string,
    previousSummary: string,
    recentTrend: string,
  ) => `Analyze this completed workout session and give ONE actionable insight (max 2 sentences).

CURRENT SESSION:
${currentSummary}
${prInfo}

PREVIOUS SESSION (same day):
${previousSummary}

RECENT TREND:
${recentTrend}

Guidelines for the insight:
- If the user hit a PR, celebrate it specifically with the number
- If progress is stalling (same reps across 2-3 sessions), suggest a concrete change: +1 rep, slightly longer rest, or a deload week
- Reference RIR (reps in reserve) when relevant — if all sets felt easy (RIR 3+), suggest progression; if sets were grinded (RIR 0-1), suggest recovery
- Be specific with numbers from the session, not generic advice

Respond in JSON: {"insight": "your 1-2 sentence insight here"}
Write in English.`,

  // ── AI weekly report prompt building blocks ──
  aiPromptWeeklySessionEntry: (date: string, totalReps: number, exerciseNames: string) =>
    `${date}: ${totalReps} reps (${exerciseNames})`,
  aiPromptWeeklySessionEntryBuiltin: (date: string, totalReps: number, day: number) =>
    `${date}: ${totalReps} reps (day ${day})`,
  aiPromptWeeklyVolumeEntry: (mg: string, sets: number) => `  ${mg}: ${sets} sets`,
  aiPromptWeeklyNoSessions: 'No sessions this week.',
  aiPromptWeeklyNoData: 'No data',
  aiPromptWeeklyVolumeTotal: (volume: number) => `TOTAL VOLUME (reps×kg): ${volume}`,
  aiPromptWeeklyTrainingDays: (days: number) => `TRAINING DAYS: ${days}`,
  aiPromptWeeklyAvgDuration: (min: number) => `AVG SESSION DURATION: ${min} min`,
  aiPromptWeeklyPrCount: (count: number) => `PERSONAL RECORDS THIS WEEK: ${count}`,
  aiPromptWeeklyProgramEntry: (program: string, sessions: number, reps: number) =>
    `${program}: ${sessions} sessions, ${reps} reps`,
  aiPromptWeeklyPrograms: (entries: string) => `BY PROGRAM: ${entries}`,

  // ── AI weekly report full prompt ──
  aiPromptWeeklyReportBuild: (
    weekCount: number,
    weekSummary: string,
    totalReps: number,
    streakWeeks: number,
    repsChangePct: string | number,
    volumeByMuscle: string,
    enrichedContext: string,
  ) => `Create a weekly workout report for the user.

THIS WEEK'S SESSIONS (${weekCount}):
${weekSummary}

TOTAL REPS THIS WEEK: ${totalReps}
STREAK: ${streakWeeks} weeks
REPS WEEK CHANGE %: ${repsChangePct}
${enrichedContext ? `\n${enrichedContext}\n` : ''}
WEEKLY SETS BY MUSCLE GROUP:
${volumeByMuscle}

Volume landmarks for reference (Israetel & Hoffmann):
- MEV (Minimum Effective Volume): 10 sets/muscle group/week
- MAV (Maximum Adaptive Volume): 15-25 sets/muscle group/week
- MRV (Maximum Recoverable Volume): 20-30+ sets/muscle group/week

Guidelines:
- In "improvements", flag any muscle group below MEV (10 sets) as undertrained
- In "improvements", flag any muscle group above MRV (30 sets) as potential overtraining
- In "recommendation", suggest a concrete next-week adjustment based on volume vs landmarks
- If streak is 0, encourage consistency; if streak is 4+ weeks, consider a deload

Respond in JSON:
{
  "summary": "1 sentence overview",
  "strengths": ["1-2 positive observations"],
  "improvements": ["1-2 areas to improve"],
  "recommendation": "1 actionable recommendation for next week"
}

Write in English. Be specific and encouraging.`,

  // ── Delete session from history ──
  sessionDelete: 'Delete workout',
  sessionDeleteConfirm: 'Delete this workout from history? This cannot be undone.',
  sessionDeleteConfirmTitle: 'Delete workout?',
  sessionDeletedToast: 'Workout deleted from history.',
  sessionDeleteError: 'Failed to delete workout.',
}
