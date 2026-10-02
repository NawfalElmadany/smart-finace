# Smart Finance (Web-first)

Proyek ini sekarang difokuskan untuk **versi web** agar update lebih cepat dan mudah.
Saat ada perbaikan fitur/bug, cukup deploy ulang website tanpa rebuild APK.

## Jalankan Lokal (Web)

Prasyarat: Node.js

1. Install dependency:
   `npm install`
2. Jalankan mode development:
   `npm run web:dev`
3. Buka:
   `http://localhost:3000`

## Build Web

Untuk produksi:

1. Build:
   `npm run web:build`
2. Hasil build ada di folder:
   `dist`
3. Preview lokal hasil build:
   `npm run web:preview`

## Deploy Web (Static Hosting)

Kamu bisa deploy folder `dist` ke hosting static seperti:
- Vercel
- Netlify
- Cloudflare Pages
- Firebase Hosting

Dengan alur ini, setiap update cukup:
1. Perbaiki kode
2. `npm run web:build`
3. Deploy ulang `dist`

## Deploy Otomatis ke Vercel (Recommended)

Sudah disiapkan file konfigurasi:
- [vercel.json](C:/smart-finance/vercel.json)

Langkah setup sekali saja:

1. Push project ke GitHub.
2. Buka [Vercel](https://vercel.com/) lalu klik **Add New Project**.
3. Import repo GitHub kamu.
4. Build setting akan otomatis membaca:
   - Build Command: `npm run web:build`
   - Output Directory: `dist`
5. Klik **Deploy**.

Setelah itu setiap kali kamu push update ke branch utama, Vercel akan auto-build dan auto-deploy.

## Supabase Environment

Set di `.env.local`:

```env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxx"
VITE_SUPABASE_STATE_TABLE="finance_state"
```

## Catatan

- Script Android/APK tetap ada untuk kompatibilitas, tapi workflow utama sekarang **web-first**.
- Autentikasi dan data tetap memakai Supabase (multi-user).
