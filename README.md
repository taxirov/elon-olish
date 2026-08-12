# Ko'chmas mulk e'lon boti

Telegram bot: foydalanuvchi 9 bosqichda ariza to'ldiradi (viloyat → tuman →
manzil → mulk turi → narx → telefon → tashqi rasmlar → ichki rasmlar →
hujjatlar) va tugagach ariza belgilangan guruhga (`-1002734287812`)
yuboriladi. Har bir ariza noyob ID bilan Neon Postgres bazasiga yoziladi.

## Tuzilma

```
api/webhook.js      Telegram webhook (asosiy endpoint)
api/set-webhook.js  Webhookni ro'yxatdan o'tkazish uchun bir martalik yordamchi
lib/bot.js           Bot logikasi (Telegraf Wizard scene, 11 bosqich)
lib/regions.js        Barcha viloyat/tuman ro'yxati
lib/store.js          Neon Postgres: session saqlash + arizalarni bazaga yozish
```

## 1. Vercel loyihasini sozlash

```bash
npm i -g vercel
cd telegram-mulk-bot
vercel link          # loyihani Vercel akkauntingizga bog'laydi
```

## 2. Ma'lumotlar bazasini ulash (Neon Postgres)

Ikki yo'l bor:

**A) To'g'ridan-to'g'ri Neon'da (tavsiya etiladi — karta so'ramaydi):**
1. [neon.tech](https://neon.tech) da ro'yxatdan o'ting, **Create Project**.
2. Loyiha yaratilgach, dashboard'da **Connection string** ni nusxalang
   (`postgresql://...`).
3. Buni Vercel loyihangizga `DATABASE_URL` nomi bilan environment variable
   sifatida qo'shing (pastga qarang).

**B) Vercel Marketplace orqali:**
Vercel dashboard → loyihangiz → **Storage** → **Create Database** → **Neon**
ni tanlang va shu loyihaga **Connect** qiling — `DATABASE_URL` avtomatik
qo'shiladi. (Ba'zida Marketplace to'lov usuli so'rashi mumkin — shu holda
yuqoridagi A variantidan foydalaning.)

Jadvallar (`bot_sessions`, `applications`) va ID hisoblagich birinchi
so'rovda o'zi avtomatik yaratiladi — qo'lda migration kerak emas.

## 3. Environment variable'lar

`.env.local` faylida tayyor qiymatlar bor (bot tokeni, guruh ID, webhook
secret). `DATABASE_URL`ni ustidan yozib qo'ying, so'ng hammasini Vercel'ga
qo'shing:

```bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add GROUP_CHAT_ID
vercel env add WEBHOOK_SECRET
vercel env add DATABASE_URL
```

(Yoki Vercel dashboard → Settings → Environment Variables orqali qo'lda
kiriting.)

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

## Murojaatlar ro'yxatini ko'rish (admin sahifa)

Brauzerda oching (bosh sahifa endi shu ro'yxatga yo'naltiriladi):

```
https://<loyiha-nomi>.vercel.app/?key=<WEBHOOK_SECRET yoki ADMIN_SECRET qiymati>
```

Jadval ko'rinishida barcha murojaatlar (manzil, narx, telefon, mijoz,
hujjat holati va rasmlar) chiqadi, 20 tadan sahifalab ko'rsatiladi. Alohida
kalit belgilamoqchi bo'lsangiz, `ADMIN_SECRET` environment variable
qo'shing — bo'lmasa `WEBHOOK_SECRET` ishlatiladi.

## Ma'lumotlar bazasi

Har bir ariza `applications` jadvalida `id` (masalan `M-000001`) bo'yicha
JSONB ustunida to'liq holda (barcha rasm file_id'lari, manzil, narx,
telefon va h.k.) saqlanadi. ID'lar `application_id_seq` ketma-ketligi
orqali generatsiya qilinadi. Kerak bo'lsa, arizalarni SQL orqali ko'rish
mumkin:

```sql
SELECT id, data->>'regionName', data->>'price', created_at
FROM applications
ORDER BY created_at DESC;
```

## Test qilish (lokal)

```bash
npm install
vercel dev
```

`vercel dev` `DATABASE_URL` kabi env variable'larni avtomatik ulaydi, lekin
webhookni lokal serverga ulash uchun ngrok kabi tunnel kerak bo'ladi.
Odatda eng qulayi — to'g'ridan-to'g'ri Vercel'ga deploy qilib sinash.
