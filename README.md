# Ko'chmas mulk e'lon boti

Telegram bot: foydalanuvchi 9 bosqichda ariza to'ldiradi (viloyat → tuman →
manzil → mulk turi → narx → telefon → tashqi rasmlar → ichki rasmlar →
hujjatlar) va tugagach ariza belgilangan guruhga (`-1002734287812`)
yuboriladi. Har bir ariza noyob ID bilan Vercel KV bazasiga yoziladi.

## Tuzilma

```
api/webhook.js      Telegram webhook (asosiy endpoint)
api/set-webhook.js  Webhookni ro'yxatdan o'tkazish uchun bir martalik yordamchi
lib/bot.js           Bot logikasi (Telegraf Wizard scene, 11 bosqich)
lib/regions.js        Barcha viloyat/tuman ro'yxati
lib/store.js          Vercel KV: session saqlash + arizalarni bazaga yozish
```

## 1. Vercel loyihasini sozlash

```bash
npm i -g vercel
cd telegram-mulk-bot
vercel link          # loyihani Vercel akkauntingizga bog'laydi
```

## 2. Ma'lumotlar bazasini ulash (Vercel KV / Upstash Redis)

Eslatma: Vercel "KV" endi to'g'ridan-to'g'ri emas, **Upstash for Redis**
integratsiyasi orqali beriladi (lekin `@vercel/kv` paketi bilan to'liq
mos — kod o'zgarmaydi). Vercel dashboard → loyihangiz → **Storage** →
**Create Database** → **Upstash — Redis** ni tanlang va shu loyihaga
**Connect** qiling. Ulanganda Vercel avtomatik ravishda `KV_REST_API_URL`,
`KV_REST_API_TOKEN` kabi environment variable'larni qo'shib qo'yadi —
qo'lda hech narsa kiritish shart emas.

## 3. Environment variable'lar

`.env.local` faylida tayyor qiymatlar bor (bot tokeni, guruh ID, webhook
secret). Ularni Vercel loyihangizga qo'shing:

```bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add GROUP_CHAT_ID
vercel env add WEBHOOK_SECRET
```

(Yoki Vercel dashboard → Settings → Environment Variables orqali qo'lda
kiriting — qiymatlar `.env.local` faylida turibdi.)

## 4. Deploy qilish

```bash
vercel --prod
```

Deploydan keyin sizga `https://<loyiha-nomi>.vercel.app` domeni beriladi.

## 5. Webhookni ro'yxatdan o'tkazish

Brauzerda oching (yoki curl bilan chaqiring):

```
https://<loyiha-nomi>.vercel.app/api/set-webhook?setup=<WEBHOOK_SECRET qiymati>
```

Javobda `"ok": true` va webhook URL ko'rinishi kerak. Shu bilan bot ishga
tushadi — Telegram'da botingizga `/start` yozib sinab ko'ring.

Muqobil yo'l (curl orqali to'g'ridan-to'g'ri Telegram API'ga):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<loyiha-nomi>.vercel.app/api/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## 6. Botni guruhga ulash

Bot allaqachon `-1002734287812` guruhiga admin (xabar yozish huquqi bilan)
sifatida qo'shilgan bo'lishi kerak — aks holda arizalarni guruhga yubora
olmaydi.

## Ma'lumotlar bazasi

Har bir ariza `mulk:application:<ID>` kaliti ostida to'liq holda (barcha
rasm file_id'lari, manzil, narx, telefon va h.k.) Vercel KV'da saqlanadi.
`ID` formati: `M-000001`, `M-000002`, ... (`mulk:app_counter` orqali
ketma-ket generatsiya qilinadi). Barcha ID'lar ro'yxati `mulk:application_index`
kalitida turadi.

> Eslatma: so'rovda "Vercel KV/Postgres" aytilgan edi — bu loyiha oddiy
> key-by-id saqlash uchun qulayroq bo'lgani sababli **Vercel KV** dan
> foydalanadi. Agar SQL so'rovlar, filtrlash yoki admin panel kerak bo'lsa,
> keyinchalik Vercel Postgres'ga ham osongina ko'chirish mumkin.

## Test qilish (lokal)

```bash
npm install
vercel dev
```

`vercel dev` KV env variable'larini avtomatik ulaydi, lekin webhookni
lokal serverga ulash uchun ngrok kabi tunnel kerak bo'ladi. Odatda eng
qulayi — to'g'ridan-to'g'ri Vercel'ga deploy qilib sinash.
