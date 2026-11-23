// Russian UI dictionary — keys are the exact English source strings used
// with t(). Untranslated keys fall back to English automatically.
// Brand names, person names, RESET, format hints and CSS values are
// intentionally left untranslated (absent here = English fallback).
export const RU: Record<string, string> = {
  // ---- Navigation / Sidebar ----
  'Words': 'Слова',
  'Quiz': 'Тест',
  'Statistics': 'Статистика',
  'Notes': 'Заметки',
  'Decks': 'Колоды',
  'Deck': 'Колода',
  'Languages': 'Языки',
  'Language': 'Язык',
  'Study language': 'Язык обучения',
  'Interface language': 'Язык интерфейса',
  'Switch language': 'Сменить язык',
  'Switch the active language — decks, words, and study sessions follow your selection.':
    'Переключает язык обучения — колоды, слова и занятия следуют за выбором.',
  'Interface text language for menus, buttons, and labels.':
    'Язык текста интерфейса: меню, кнопки и подписи.',
  'Open a language workspace or add a custom language to start building decks.':
    'Откройте язык или добавьте свой, чтобы начать создавать колоды.',
  'Select a Language': 'Выберите язык',
  'Add Custom Language': 'Добавить свой язык',
  'Add Language': 'Добавить язык',
  'Add French, Japanese, Italian, or any language you want to study.':
    'Добавьте французский, японский, итальянский или любой другой язык для изучения.',
  'Language Name': 'Название языка',
  'Native name': 'Название на языке оригинала',
  'Code Badge': 'Код языка',
  'Edit Language': 'Изменить язык',
  'Delete Language': 'Удалить язык',
  'You must keep at least one language': 'Должен остаться хотя бы один язык',
  'Pin to top': 'Закрепить сверху',
  'Unpin': 'Открепить',
  'Unpin language': 'Открепить язык',
  'Pinned': 'Закреплён',

  // ---- Common actions ----
  'Save': 'Сохранить',
  'Cancel': 'Отмена',
  'Close': 'Закрыть',
  'Delete': 'Удалить',
  'Edit': 'Изменить',
  'Add': 'Добавить',
  'Search': 'Поиск',
  'Back': 'Назад',
  'Next': 'Далее',
  'Prev': 'Назад',
  'Previous': 'Предыдущий',
  'Done': 'Готово',
  'Loading…': 'Загрузка…',
  'No results': 'Нет результатов',
  'Clear': 'Очистить',
  'Clear search': 'Очистить поиск',
  'Select': 'Выбрать',
  'Select All': 'Выбрать все',
  'All': 'Все',
  'None / Disable Voice': 'Нет / Отключить голос',
  'Off': 'Выкл',
  'On': 'Вкл',
  'Skip': 'Пропустить',
  'Undo': 'Отменить',
  'Restore': 'Восстановить',
  'Rename': 'Переименовать',
  'Rename note': 'Переименовать заметку',
  
  'Archive': 'В архив',
  'Archived': 'В архиве',
  'Hide archived': 'Скрыть архивные',
  'More': 'Ещё',
  'Actions': 'Действия',
  'Mode': 'Режим',
  'Order': 'Порядок',
  'Recent': 'Недавние',
  'Older': 'Старые',
  'Today': 'Сегодня',
  'Day': 'День',
  'Days': 'Дней',
  'Total': 'Всего',
  'Name': 'Название',
  'Word': 'Слово',
  'Translation': 'Перевод',
  'Difficulty': 'Сложность',
  'Direction': 'Направление',
  'Mixed': 'Смешанный',
  'New': 'Новые',
  'New word': 'Новое слово',
  'New Word': 'Новое слово',
  'New Deck': 'Новая колода',
  'New Note': 'Новая заметка',
  'New Setup': 'Новая сессия',
  'New Smart Deck': 'Новая умная колода',
  'New Deck Name': 'Название новой колоды',
  'Create Deck': 'Создать колоду',
  'Create First Deck': 'Создать первую колоду',
  'Create Smart Deck': 'Создать умную колоду',
  'Smart Deck': 'Умная колода',
  'Practice Deck': 'Тренировочная колода',
  'Edit Deck': 'Изменить колоду',
  'Delete Deck': 'Удалить колоду',
  'Deck Name': 'Название колоды',
  'Deck actions': 'Действия с колодой',
  'All decks': 'Все колоды',
  'All difficulties': 'Все уровни сложности',
  'All tags': 'Все теги',
  'Reset filters': 'Сбросить фильтры',
  'Coming soon': 'Скоро',
  'Soon': 'Скоро',

  // ---- Header ----
  'Sound effects muted': 'Звуковые эффекты выключены',
  'Sound effects on': 'Звуковые эффекты включены',
  'Unmute sound effects': 'Включить звуковые эффекты',
  'Mute sound effects': 'Выключить звуковые эффекты',
  'Pronunciation audio off': 'Аудио произношения выключено',
  'Pronunciation audio on': 'Аудио произношения включено',
  'Enable pronunciation audio': 'Включить аудио произношения',
  'Disable pronunciation audio': 'Выключить аудио произношения',
  'Keyboard shortcuts (?)': 'Горячие клавиши (?)',
  'Keyboard shortcuts': 'Горячие клавиши',
  'Keyboard Shortcuts': 'Горячие клавиши',
  'Command palette (Ctrl+K)': 'Палитра команд (Ctrl+K)',
  'Command palette': 'Палитра команд',
  'Command palette search': 'Поиск в палитре команд',
  
  'Search decks, words, notes, or actions…': 'Поиск по колодам, словам, заметкам и действиям…',
  'Search words...': 'Поиск слов…',
  'Open navigation': 'Открыть навигацию',
  'Collapse': 'Свернуть',
  'Collapse sidebar': 'Свернуть панель',
  'Expand sidebar': 'Развернуть панель',
  'Switch to dark mode': 'Тёмная тема',
  'Switch to light mode': 'Светлая тема',
  'Switch to system theme': 'Системная тема',

  // ---- Settings ----
  'Settings': 'Настройки',
  'Appearance': 'Внешний вид',
  'Theme': 'Тема',
  'Light': 'Светлая',
  'Dark': 'Тёмная',
  'System': 'Системная',
  'Preferences are saved automatically on this device.':
    'Настройки автоматически сохраняются на этом устройстве.',
  'Notifications': 'Уведомления',
  'Toast notifications': 'Всплывающие уведомления',
  'Show success and info toasts. Errors and Undo actions always appear.':
    'Показывать уведомления об успехе и информации. Ошибки и отмена всегда отображаются.',
  'Review reminders': 'Напоминания о повторении',
  'Browser notification (once a day) when cards are due for review. Requires notification permission.':
    'Уведомление браузера (раз в день), когда карточки ждут повторения. Требуется разрешение на уведомления.',
  'Dismiss notification': 'Скрыть уведомление',
  'Dismiss due review reminder': 'Скрыть напоминание о повторении',
  'Audio': 'Аудио',
  'Sound effects': 'Звуковые эффекты',
  'Correct/incorrect chimes and quiz completion sounds.':
    'Звуки правильных/неправильных ответов и завершения теста.',
  'Pronunciation voice': 'Голос произношения',
  'Pronunciation Voice': 'Голос произношения',
  'Speak words aloud in decks, flashcards, and quizzes when a native voice exists.':
    'Озвучивать слова в колодах, карточках и тестах при наличии подходящего голоса.',
  'Voice is disabled': 'Голос отключён',
  'Voice off': 'Голос выкл',
  'Voice set': 'Голос задан',
  'Voice not supported for this language': 'Голос не поддерживается для этого языка',
  'No browser voice': 'Нет голоса браузера',
  'No voice': 'Нет голоса',
  'No native browser voice found for this language — pronunciation is disabled':
    'Для этого языка не найден системный голос — произношение отключено.',
  'Pronunciation will be disabled for this language.':
    'Для этого языка произношение будет отключено.',
  'Loading available voices…': 'Загрузка голосов…',
  'Preview selected voice': 'Прослушать выбранный голос',
  'Preview voice': 'Прослушать голос',
  'Auto-detect best match': 'Автоматический подбор',
  'Auto-speak prompts': 'Автоозвучка вопросов',
  'Automatically pronounce the target word when a new flashcard or quiz question appears.':
    'Автоматически озвучивать слово при появлении новой карточки или вопроса.',
  'Auto-speak answers': 'Автоозвучка ответов',
  'Automatically pronounce the word or example sentence when an answer is revealed.':
    'Автоматически озвучивать слово или пример при раскрытии ответа.',
  'Study': 'Занятия',
  'Auto-advance questions': 'Автопереход к следующему вопросу',
  'Move to the next quiz question automatically about 1.5s after answering.':
    'Автоматически переходить к следующему вопросу примерно через 1,5 с после ответа.',
  'Default quiz timer': 'Таймер теста по умолчанию',
  '5. Timer': '5. Таймер',
  
  'Auto-save notes': 'Автосохранение заметок',
  'Automatically persist your notepad while you type. When off, use the Save button.':
    'Автоматически сохранять заметки во время ввода. Если выключено — используйте кнопку «Сохранить».',
  'Auto-save interval': 'Интервал автосохранения',
  'How often unsaved changes are written while you type.':
    'Как часто несохранённые изменения записываются во время ввода.',
  'App': 'Приложение',
  'Install': 'Установить',
  'Install Noor Language Studio': 'Установить Noor Language Studio',
  'Add to your home screen or desktop for offline access and a dedicated window.':
    'Добавьте на главный экран или рабочий стол для офлайн-доступа и отдельного окна.',
  'Danger Zone': 'Опасная зона',
  'Reset statistics': 'Сбросить статистику',
  
  'Reset all study statistics?': 'Сбросить всю статистику занятий?',
  'Permanently erase study streaks, quiz totals, daily activity history, and every card\'s review progress. Your languages, decks, and words are kept.':
    'Безвозвратно удалить серии занятий, результаты тестов, дневную активность и прогресс повторения всех карточек. Языки, колоды и слова сохранятся.',
  'Study streaks, quiz totals, and best streak':
    'Серии занятий, результаты тестов и лучшая серия',
  'Daily activity history and review forecast':
    'Дневная история активности и прогноз повторений',
  'Every card\'s SRS box, due dates, lapses, and review counts':
    'SRS-боксы, даты повторения, сбои и счётчики всех карточек',
  'permanent, irreversible, and cannot be undone':
    'постоянно, необратимо и не может быть отменено',
  'Your languages, decks, words, difficulty ratings, and settings are':
    'Ваши языки, колоды, слова, уровни сложности и настройки',
  'not affected.': 'не затрагиваются.',
  'Type': 'Введите',
  'to confirm': 'для подтверждения',
  'Resetting…': 'Сброс…',
  'Reset…': 'Сброс…',
  'Reset defaults': 'Сбросить настройки',
  'Settings reset to defaults': 'Настройки сброшены',
  'Study statistics reset — progress history cleared':
    'Статистика сброшена — история прогресса очищена',

  // ---- Deck workspace ----
  'Add Words': 'Добавить слова',
  'Add Word': 'Добавить слово',
  'Add words individually or paste a list in':
    'Добавляйте слова по одному или вставьте список в формате',
  'Bulk Import': 'Массовый импорт',
  'Bulk Import Words': 'Массовый импорт слов',
  'Import JSON': 'Импорт JSON',
  'Import Deck': 'Импорт колоды',
  'Import Deck from JSON': 'Импорт колоды из JSON',
  'Export JSON': 'Экспорт JSON',
  'Export CSV': 'Экспорт CSV',
  'Export All Data': 'Экспорт всех данных',
  'Export Backup': 'Экспорт резервной копии',
  'Export now': 'Экспортировать',
  'Backup exported as JSON': 'Резервная копия экспортирована в JSON',
  'Could not export the backup. Please try again.':
    'Не удалось экспортировать копию. Попробуйте ещё раз.',
  'Choose File': 'Выбрать файл',
  'That file appears to be empty.': 'Файл пуст.',
  'Could not read that file.': 'Не удалось прочитать файл.',
  'Could not read this backup file.': 'Не удалось прочитать файл резервной копии.',
  'Invalid Backup File': 'Недопустимый файл резервной копии',
  'Restore Backup': 'Восстановить копию',
  'Merge into current data': 'Объединить с текущими данными',
  'Replace all current data': 'Заменить все текущие данные',
  ', plus study stats and activity.': ', а также статистику и активность занятий.',
  ' decks, and ': ' колод и ',
  ' words': ' слов',
  'This backup contains': 'Резервная копия содержит',
  ' languages, ': ' языков, ',
  'Restore failed.': 'Восстановление не удалось.',
  'Could not import the deck. Please try again.':
    'Не удалось импортировать колоду. Попробуйте ещё раз.',
  'Could not import the words. Please try again.':
    'Не удалось импортировать слова. Попробуйте ещё раз.',
  'Could not save the deck. Please try again.':
    'Не удалось сохранить колоду. Попробуйте ещё раз.',
  'Could not save the word. Please try again.':
    'Не удалось сохранить слово. Попробуйте ещё раз.',
  'Could not delete the deck. Please try again.':
    'Не удалось удалить колоду. Попробуйте ещё раз.',
  'Could not delete the word. Please try again.':
    'Не удалось удалить слово. Попробуйте ещё раз.',
  'Could not delete the words. Please try again.':
    'Не удалось удалить слова. Попробуйте ещё раз.',
  'Could not delete the smart deck. Please try again.':
    'Не удалось удалить умную колоду. Попробуйте ещё раз.',
  'Could not create the smart deck. Please try again.':
    'Не удалось создать умную колоду. Попробуйте ещё раз.',
  'Could not move the words. Please try again.':
    'Не удалось переместить слова. Попробуйте ещё раз.',
  'Could not update difficulty. Please try again.':
    'Не удалось обновить сложность. Попробуйте ещё раз.',
  'Could not update the card. Please try again.':
    'Не удалось обновить карточку. Попробуйте ещё раз.',
  'Pick at least one filter for the smart deck.':
    'Выберите хотя бы один фильтр для умной колоды.',
  'The filter matches no cards at the moment — it will populate automatically as cards enter the matching SRS state.':
    'Фильтр пока не находит карточек — они появятся автоматически по мере попадания в нужное SRS-состояние.',
  'No words match this smart deck right now':
    'Сейчас ни одно слово не подходит под эту умную колоду',
  'What is this set for?': 'Для чего этот набор?',
  'e.g., Words to Review, Leech Squad': 'напр., Слова для повторения, Трудные',
  'Short note on what this vocabulary deck covers':
    'Краткое описание того, что входит в эту колоду',
  'Create a vocabulary deck': 'Создать колоду слов',
  'Create a deck for this language': 'Создать колоду для этого языка',
  'Edit Vocabulary Word': 'Изменить слово',
  'Save Word': 'Сохранить слово',
  'Save Changes': 'Сохранить изменения',
  
  
  'e.g., Labas rytas!': 'напр., Доброе утро!',
  'e.g., its meaning in your language': 'напр., его значение на вашем языке',
  'e.g., verbs, food, travel': 'напр., глаголы, еда, путешествия',
  'Comma-separated — used for filtering and smart decks.':
    'Через запятую — для фильтрации и умных колод.',
  'e.g., Sounds like \'labas\' — imagine a lab assistant':
    'напр., звучит как «лабас» — представьте лаборанта',
  'Memory tip:': 'Мнемоника:',
  'Send to notebook': 'Отправить в блокнот',
  'Open linked notebook note': 'Открыть связанную заметку',
  'Move to deck…': 'Переместить в колоду…',
  'Move selected words to deck': 'Переместить выбранные слова в колоду',
  'Tap the checkboxes next to words to select them':
    'Отметьте слова флажками для выбора',
  'Delete Smart Deck': 'Удалить умную колоду',
  'Include cards matching any of these': 'Включать карточки, подходящие под любой из фильтров',
  'No words match your current search or filter.':
    'По текущему поиску или фильтру слов не найдено.',
  'This deck has no words yet': 'В этой колоде пока нет слов',
  'Use the deck selector in Words to add one':
    'Используйте выбор колоды в разделе «Слова», чтобы добавить',
  'Press "+ New Word" or bulk-import a list':
    'Нажмите «+ Новое слово» или импортируйте список',
  'Add vocabulary words to unlock adaptive review.':
    'Добавьте слова, чтобы открыть адаптивное повторение.',
  'Add vocabulary entries before starting a flashcard session.':
    'Добавьте слова перед началом занятия с карточками.',
  'Selected decks contain no words yet.': 'В выбранных колодах пока нет слов.',
  'Selected decks have no example sentences containing the target word.':
    'В выбранных колодах нет примеров с изучаемым словом.',
  'Select at least one deck to begin.': 'Выберите хотя бы одну колоду для начала.',
  'No flashcards in this selection': 'В этом наборе нет карточек',
  'No cards marked Hard': 'Нет карточек с отметкой «Трудно»',
  'Great work — none of the selected cards are currently marked Hard.':
    'Отлично — ни одна из выбранных карточек не отмечена как «Трудно».',
  'No cards due for review': 'Нет карточек для повторения',
  'No words available for review': 'Нет слов для повторения',
  'No leech cards': 'Нет трудных карточек',
  'No leech cards right now — nice work': 'Сейчас нет трудных карточек — отлично',
  'Nothing due for review right now': 'Сейчас ничего не требует повторения',
  'Nothing due right now': 'Сейчас ничего не запланировано',
  'No quizzes completed yet': 'Тестов пока не было',
  'No practice recorded': 'Занятий пока не записано',
  'No missed words yet. Keep practicing!': 'Пока нет пропущенных слов — продолжайте!',
  'Missed words have been prioritized in your Leitner review queue.':
    'Пропущенные слова prioritизированы в очереди Leitner-повторения.',
  'All leech cards in this session graduated — great work.':
    'Все трудные карточки этой сессии выпущены — отличная работа.',
  'Strong recall across this session — intervals updated.':
    'Хорошее воспроизведение в этой сессии — интервалы обновлены.',
  'Weak Words Need Review': 'Слабые слова требуют повторения',
  'Most frequently missed words': 'Самые часто пропускаемые слова',
  'Targeted practice for problem words': 'Точечная практика проблемных слов',
  'Practice Hard Cards': 'Тренировка трудных карточек',
  'Practice This Deck': 'Тренировать эту колоду',
  'Practice Modes': 'Режимы тренировки',
  'Guided Sessions': 'Управляемые сессии',
  'Let the scheduler pick your next cards': 'Пусть планировщик выберет следующие карточки',
  'Leitner Smart Review': 'Умное повторение Leitner',
  'Due Reviews Only': 'Только просроченные',
  'Hard cards only · Show all': 'Только трудные · Показать все',
  'Hard-rated or low Leitner box': 'Отмеченные «Трудно» или низкий ящик Leitner',
  'Scheduled review is due now': 'Запланированное повторение наступило',
  'Never reviewed yet': 'Ещё не повторялись',
  'Self-rated Hard': 'Самостоятельно отмечено «Трудно»',
  'Repeatedly missed cards': 'Часто пропускаемые карточки',
  'Cards scheduled for review now': 'Карточки, запланированные на повторение',
  'Leech': 'Трудная',
  'Leech card — repeatedly missed. Prioritize or exclude it in quiz setup.':
    'Трудная карточка — часто пропускается. Приоритизируйте или исключите её в настройках теста.',
  'Leech cards': 'Трудные карточки',
  'Leeches': 'Трудные',
  'Hard-rated': 'Отмечено «Трудно»',
  'Weak words': 'Слабые слова',
  'New cards': 'Новые карточки',
  'Due for review': 'К повторению',

  // ---- Quiz setup / launcher ----
  'Choose a study or testing mode and customize your decks below.':
    'Выберите режим занятий или проверки и настройте колоды ниже.',
  'Choose a format, then pick decks and question count':
    'Выберите формат, затем колоды и количество вопросов',
  '1. Mode': '1. Режим',
  '2. Decks': '2. Колоды',
  '3. Difficulty': '3. Сложность',
  '4. Count': '4. Количество',
  'Flashcards': 'Карточки',
  '3D flip cards with Hard, Good, and Easy self-rating.':
    '3D-карточки с самопроверкой «Трудно / Хорошо / Легко».',
  'Flip through cards and self-grade': 'Листайте карточки и оценивайте себя',
  'True / False': 'Верно / Неверно',
  'True/False': 'Верно/Неверно',
  'Quickly verify whether a word and translation match.':
    'Быстро проверяйте, совпадает ли слово с переводом.',
  'Judge if the pair matches': 'Определите, совпадает ли пара',
  'Multiple Choice': 'Выбор ответа',
  'Pick the right answer from 4 dynamic options.':
    'Выберите правильный ответ из 4 вариантов.',
  'Pick the correct translation': 'Выберите правильный перевод',
  'Listening': 'Аудирование',
  'Listening Quiz': 'Аудирование',
  'Hear the word aloud, then choose its meaning.':
    'Прослушайте слово и выберите его значение.',
  'Hear the word, choose the meaning': 'Прослушайте слово и выберите значение',
  'Listening quiz requires a supported browser voice for this language.':
    'Для аудирования нужен поддерживаемый голос браузера для этого языка.',
  'Requires a supported browser voice for this language':
    'Требуется поддерживаемый голос браузера для этого языка',
  'Enable a compatible voice in Settings to use this mode.':
    'Включите подходящий голос в настройках, чтобы использовать этот режим.',
  'Written / Typing': 'Письмо / Ввод',
  'Type translations manually with 1-char typo tolerance.':
    'Вводите переводы вручную с допуском в 1 символ.',
  'Type the translation from memory': 'Введите перевод по памяти',
  'Fill-in-the-blanks': 'Вставка пропусков',
  'Fill in the Blank': 'Вставьте пропуск',
  'Fill Blank': 'Пропуск',
  'Complete missing words inside example sentences.':
    'Впишите пропущенные слова в примеры предложений.',
  'Complete the example sentence': 'Дополните пример предложения',
  'Speaking Practice': 'Практика речи',
  'Say the word out loud': 'Произнесите слово вслух',
  'Hear the meaning, then say the word aloud. Chrome/Edge only.':
    'Прослушайте значение, затем произнесите слово. Только Chrome/Edge.',
  'Speaking Practice is coming soon.': 'Практика речи скоро появится.',
  'Speech recognition practice is coming soon.':
    'Практика распознавания речи скоро появится.',
  'Speech recognition unavailable in this browser.':
    'Распознавание речи недоступно в этом браузере.',
  'Speaking practice requires Chrome or Edge (speech recognition).':
    'Практика речи требует Chrome или Edge (распознавание речи).',
  'Word → Meaning': 'Слово → Значение',
  'Meaning → Word': 'Значение → Слово',
  'Translate to meaning': 'Перевод на значение',
  'Translate to foreign word': 'Перевод на иностранное слово',
  'Same-Deck Options Only': 'Варианты только из той же колоды',
  'Weak words first, then what\'s due': 'Сначала слабые слова, затем просроченные',
  'Single Word': 'Одно слово',
  'Timed round': 'На время',
  'Timer paused': 'Таймер на паузе',
  'Is this translation accurate?': 'Этот перевод точный?',
  'Correct!': 'Верно!',
  'Incorrect': 'Неверно',
  'Time expired': 'Время вышло',
  'Next Question': 'Следующий вопрос',
  'Question time remaining': 'Осталось времени на вопрос',
  'Type your answer...': 'Введите ответ…',
  'Check Answer': 'Проверить',
  'Hear the word': 'Прослушать слово',
  'Hear the word pronounced': 'Прослушать произношение',
  'Replay pronunciation': 'Повторить произношение',
  'Pronounce': 'Произнести',
  'Start speaking': 'Начать говорить',
  'Say this word aloud': 'Произнесите это слово',
  'Listening…': 'Слушаю…',
  'Tap & Speak': 'Нажмите и говорите',
  'Reveal meaning': 'Показать значение',
  'Hide meaning': 'Скрыть значение',
  'Show memory tip': 'Показать мнемонику',
  'Flashcard prompt side. Click or press Space to reveal answer':
    'Сторона вопроса. Нажмите или пробел — покажется ответ',
  'Flashcard answer side. Click or press Space to flip back':
    'Сторона ответа. Нажмите или пробел — вернуться',
  'Card queue order': 'Порядок очереди карточек',
  'Change Mode': 'Сменить режим',
  'Try Another Mode': 'Другой режим',
  'Restart Cards': 'Начать заново',
  'Retake Quiz': 'Пройти ещё раз',
  'View Results': 'Результаты',
  'Session Complete': 'Сессия завершена',
  'Quiz Results': 'Результаты теста',
  'Answer Breakdown': 'Разбор ответов',
  'Answered': 'Отвечено',
  'Missed': 'Пропущено',
  'Complete the sentence': 'Дополните предложение',
  
  'Listen and pick the meaning': 'Слушайте и выбирайте значение',
  'Listen carefully — what does this word mean?':
    'Слушайте внимательно — что означает это слово?',
  'Flashcards are self-paced.': 'Карточки — в собственном темпе.',
  'Start a quiz or flashcard round from Quiz':
    'Начните тест или раунд карточек в разделе «Тест»',
  'Start Quiz': 'Начать тест',
  
  'Close setup modal': 'Закрыть настройки сессии',
  'Close modal': 'Закрыть окно',
  'Close settings': 'Закрыть настройки',

  // ---- Quiz center ----
  'True': 'Верно',
  'False': 'Неверно',
  'Rate: Easy': 'Оценка: Легко',
  'Rate: Good': 'Оценка: Хорошо',
  'Rate: Hard': 'Оценка: Трудно',
  'Easy': 'Легко',
  'Good': 'Хорошо',
  'Hard': 'Трудно',
  'Medium': 'Средне',
  
  'Select answer option': 'Выбрать вариант ответа',
  'Enter': 'Ввод',
  'Esc': 'Esc',
  'Space': 'Пробел',
  'Ctrl': 'Ctrl',
  'Flip card': 'Перевернуть карточку',
  '1': '1',
  '2': '2',
  '3': '3',
  '←': '←',
  '→': '→',
  'Go to Words': 'Перейти к словам',
  'Go to Quiz': 'Перейти к тесту',
  'Go to Statistics': 'Перейти к статистике',
  'Go to Notes': 'Перейти к заметкам',
  'Toggle this cheat-sheet': 'Показать/скрыть эту шпаргалку',
  'Press': 'Нажмите',
  'for shortcuts': 'для горячих клавиш',
  'anytime to toggle this panel.': 'в любой момент, чтобы открыть панель.',
  
  'Quizzes': 'Тесты',
  'Global': 'Общие',

  // ---- Flashcard study ----
  
  
  
  'Shuffle': 'Перемешать',
  'Saved': 'Сохранено',
  'Saving…': 'Сохранение…',
  'Save failed': 'Не удалось сохранить',
  'Unsaved changes': 'Несохранённые изменения',
  'Empty note': 'Пустая заметка',

  // ---- Notes ----
  'No notes yet — create your first sheet.': 'Заметок пока нет — создайте первый лист.',
  'Select or create a note to start writing.':
    'Выберите или создайте заметку, чтобы начать писать.',
  'Jot down grammar rules, example sentences, tricky words, or anything worth remembering…':
    'Записывайте правила грамматики, примеры предложений, сложные слова — всё, что стоит запомнить…',
  'Blacknotes sheet': 'Лист Blacknotes',
  'Note': 'Заметка',
  'Untitled note': 'Без названия',
  'wordCount': '{count} слов',
  '{count} words': '{count} слов',
  '{count} chars': '{count} симв.',
  'Print / export as PDF': 'Печать / экспорт в PDF',

  // ---- Overview strip / spotlight ----
  'Daily Spotlight': 'Слово дня',
  'Word of the day': 'Слово дня',
  'Word of the Day': 'Слово дня',
  'Show another spotlight word': 'Показать другое слово дня',
  'Cycle spotlight word': 'Следующее слово дня',
  'Next motivation quote': 'Следующая цитата',
  'Another quote': 'Другая цитата',
  'Add words to highlight one daily spotlight entry.':
    'Добавьте слова, чтобы появилось слово дня.',
  'Every new word is a new window to the world.':
    'Каждое новое слово — новое окно в мир.',
  'To have another language is to possess a second soul.':
    'Владеть другим языком — значит иметь вторую душу.',
  'Small daily practice turns unfamiliar sounds into fluent thought.':
    'Небольшая ежедневная практика превращает незнакомые звуки в свободную речь.',
  'Language is the road map of a culture.':
    'Язык — это карта культуры.',
  'Ten quiet minutes a day outweighs an occasional marathon.':
    'Десять спокойных минут в день важнее редких марафонов.',
  'Mistakes are proof that you are actively recalling, not passively reading.':
    'Ошибки — доказательство того, что вы активно вспоминаете, а не пассивно читаете.',
  'A different language is a different vision of life.':
    'Другой язык — другой взгляд на жизнь.',
  'Fluency grows one recalled word at a time.':
    'Свобода речи растёт с каждым вспомненным словом.',

  // ---- Activity / statistics ----
  'Stats, forecast and session history live under Statistics':
    'Статистика, прогноз и история сессий — в разделе «Статистика»',
  'Getting started progress': 'Прогресс начала',
  'Get started': 'Начать',
  'Dismiss getting started checklist': 'Скрыть чек-лист начала',
  'Check your progress': 'Проверьте прогресс',
  'Complete a study session': 'Завершите учебную сессию',
  
  'Add your first words': 'Добавьте первые слова',
  'Daily Review Goal': 'Дневная цель повторений',
  'Increase daily goal': 'Увеличить дневную цель',
  'Decrease daily goal': 'Уменьшить дневную цель',
  'Daily goal reached — nicely done.': 'Дневная цель достигнута — отлично.',
  'Activity': 'Активность',
  'Review Forecast': 'Прогноз повторений',
  'Upcoming Reviews': 'Предстоящие повторения',
  
  'Tmrw': 'Завтра',
  'Mastery': 'Усвоение',
  'Mastery Trend': 'Динамика усвоения',
  'Share of words at Leitner box 4+ — captured weekly':
    'Доля слов в ящике Leitner 4+ — фиксируется еженедельно',
  'Session History': 'История сессий',
  'Completed study sessions and accuracy trend':
    'Завершённые сессии и тренд точности',
  'Quiz accuracy trend over recent sessions':
    'Точность тестов по недавним сессиям',
  'Accuracy by deck': 'Точность по колодам',
  '— single-deck sessions': '— сессии с одной колодой',
  'Best Streak': 'Лучшая серия',
  'Total Words': 'Всего слов',
  'Weakness Radar': 'Радар слабых мест',
  
  
  
  
  

  // ---- Command palette ----
  'Start Smart Review': 'Начать умное повторение',
  'Due & weak cards first': 'Сначала просроченные и слабые карточки',
  'Everything due today': 'Всё, что просрочено сегодня',
  'New vocabulary entry': 'Новая словарная запись',
  
  'Download full JSON backup': 'Скачать полную JSON-копию',
  
  

  // ---- Language screen / backup ----
  
  'Import Backup': 'Импорт резервной копии',
  

  // ---- Diacritic bar ----
  'Quick-insert characters': 'Быстрая вставка символов',
  'Character set': 'Набор символов',
  'Shift': 'Shift',
  'Uppercase': 'Заглавные',

  // ---- Onboarding ----
  

  // ---- Misc UI ----
  'Loading Noor Language Studio...': 'Загрузка Noor Language Studio…',
  'Noor Language Studio': 'Noor Language Studio',
  'Noor Studio': 'Noor Studio',
  'Something went wrong': 'Что-то пошло не так',
  'View error details': 'Показать детали ошибки',
  'Try Again': 'Попробовать снова',
  'Go Back': 'Назад',
  'ErrorBoundary caught an error:': 'ErrorBoundary перехватил ошибку:',
  'Failed to initialize database:': 'Не удалось инициализировать базу данных:',
  
  'Vocabulary': 'Словарный запас',
  'Vocabulary Deck': 'Словарная колода',
  

  // ---- Months (heatmap) ----
  'Jan': 'Янв', 'Feb': 'Фев', 'Mar': 'Мар', 'Apr': 'Апр',
  'May': 'Май', 'Jun': 'Июн', 'Jul': 'Июл', 'Aug': 'Авг',
  'Sep': 'Сен', 'Oct': 'Окт', 'Nov': 'Ноя', 'Dec': 'Дек',

  // ---- Diacritic preset labels ----
  'Lithuanian': 'Литовский',
  'German': 'Немецкий',
  'French': 'Французский',
  'Spanish': 'Испанский',
  'Turkish': 'Турецкий',
  'Russian': 'Русский',

  // ---- Remaining keys ----
  '+ Custom Language': '+ Свой язык',
  '+1 Nice!': '+1 Отлично!',
  'A live view over your cards — membership updates as you study.':
    'Живой взгляд на ваши карточки — состав обновляется по мере занятий.',
  'Back to Decks': 'К колодам',
  'Could not create the note. Please try again.':
    'Не удалось создать заметку. Попробуйте ещё раз.',
  'Exclude': 'Исключить',
  'Filter words by confidence': 'Фильтр слов по уверенности',
  'Filter words by tag': 'Фильтр слов по тегу',
  'Hurry!': 'Скорее!',
  'Less': 'Меньше',
  'Only leeches': 'Только трудные',
  'Open note': 'Открыть заметку',
  'Resume': 'Продолжить',
  'Review Due Cards': 'Повторить просроченные',
  'Review Now': 'Повторить сейчас',
  'Smart': 'Умная',
  'Smart Review': 'Умное повторение',
  'Speaking': 'Говорение',
  'Study All Cards': 'Все карточки',
  'Typing': 'Ввод',
  'e.g., Japanese, French, Azerbaijani': 'напр., Japanese, French, Azerbaijani',
  'e.g., verbs — matches cards with this tag': 'напр., глаголы — совпадает с тегом карточек',
  'e.g., 日本語, Français': 'напр., 日本語, Français',
};
