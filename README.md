# Marathon Skills Web

Рабочий сайт: https://marathon-skills-web.vercel.app

Веб-версия Marathon Skills с Google OAuth, Vercel API, Supabase и Telegram webhook.

## Что реализовано

- вход только через Google через Firebase Auth;
- отображение имени и фото Google-пользователя в шапке;
- защищенные разделы: регистрация, кабинет бегуна и кабинет организатора требуют входа;
- API в папке `api/` для участников, чек-листа организатора и Telegram webhook;
- все запросы к Supabase идут только через Vercel Functions с проверкой Firebase ID token;
- Supabase хранит участников и админ-чек-лист;
- Telegram-бот ищет участника по фамилии через то же представление Supabase `marathon_bot_lookup`.

## Переменные окружения Vercel

Скопируйте список из `.env.example` и заполните значения в Vercel Project Settings → Environment Variables.

Обязательные переменные:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `ADMIN_EMAILS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`

`ADMIN_EMAILS` можно указать через запятую, например:

```text
rodion@example.com,teacher@example.com
```

## Supabase

1. Создайте бесплатный проект Supabase.
2. Откройте SQL Editor.
3. Выполните файл `supabase-schema.sql`.
4. В Vercel добавьте `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.

## Telegram webhook

После деплоя и добавления `TELEGRAM_BOT_TOKEN` выполните:

```powershell
$token = "ВАШ_TELEGRAM_BOT_TOKEN"
$url = "https://marathon-skills-web.vercel.app/api/telegram-webhook"
Invoke-RestMethod "https://api.telegram.org/bot$token/setWebhook?url=$url"
```

Бот принимает фамилию и отвечает:

```text
Фамилия Иванов → значение: номер MS-12345, дистанция 10 км, статус допущен
```

Если фамилии нет:

```text
Фамилия «Иванов» не найдена в базе
```

## Локальная проверка

```powershell
npm install
npm run check
py -m http.server 4173 --directory .
```

Локально Google/Supabase работают только при наличии настоящих переменных окружения в Vercel или локальной серверной среды Vercel CLI.
