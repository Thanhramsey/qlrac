# 🚀 Hướng Dẫn Deploy: Railway + Vercel

Dự án **Quản lý Thu Rác** gồm 2 phần cần deploy:
- **Backend (NestJS + PostgreSQL)** → Railway
- **Frontend (Vite + React)** → Vercel

---

## 📋 Chuẩn Bị Trước Khi Deploy

### Yêu cầu
- [ ] Tài khoản **GitHub** (để kết nối với Railway & Vercel)
- [ ] Code đã được push lên GitHub repo
- [ ] Tài khoản [railway.app](https://railway.app) (đăng ký miễn phí)
- [ ] Tài khoản [vercel.com](https://vercel.com) (đăng ký miễn phí)

### Push code lên GitHub (nếu chưa có)
```bash
# Tại thư mục gốc dự án
git add .
git commit -m "chore: add deployment configs"
git push origin main
```

> [!IMPORTANT]
> Đảm bảo file `.env` đã có trong `.gitignore` — **KHÔNG** push file `.env` lên GitHub!

---

## 🚂 PHẦN 1: Deploy Backend lên Railway

### Bước 1: Đăng ký & Tạo Project Railway

1. Truy cập [railway.app](https://railway.app) → **Login with GitHub**
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Chọn repo **quanlythurac**
4. Railway sẽ tự detect `Dockerfile` → Click **"Deploy Now"**

### Bước 2: Thêm Database PostgreSQL

1. Trong project Railway → Click **"+ New Service"**
2. Chọn **"Database"** → **"Add PostgreSQL"**
3. Railway tự tạo database, bạn sẽ thấy service PostgreSQL xuất hiện

### Bước 3: Cấu Hình Environment Variables

1. Click vào service **Backend** (NestJS)
2. Vào tab **"Variables"** → Click **"+ New Variable"**
3. Thêm từng biến sau:

| Tên Biến | Giá Trị |
|----------|---------|
| `DATABASE_URL` | Click "Add Reference" → chọn `PostgreSQL.DATABASE_URL` |
| `JWT_SECRET` | `qltrac_prod_super_secret_abc123xyz` (đặt chuỗi mạnh) |
| `JWT_EXPIRES_IN` | `1d` |
| `JWT_ACCESS_EXPIRES_IN` | `1d` |
| `JWT_REFRESH_SECRET` | `qltrac_refresh_prod_secret_xyz789abc` (đặt chuỗi mạnh) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |

> [!TIP]
> Với `DATABASE_URL`: Thay vì gõ tay, dùng **"Add Reference"** để Railway tự nối với PostgreSQL service.

### Bước 4: Chạy Migrate & Seed Database

Sau khi deploy thành công, vào tab **"Shell"** của service backend:

```bash
# Chạy migrations
npx prisma migrate deploy

# (Tùy chọn) Seed dữ liệu mẫu
node prisma/seed.mjs
```

> [!NOTE]
> Lần deploy đầu tiên Dockerfile đã tự chạy `prisma migrate deploy`, nên bước này chỉ cần khi muốn chạy lại hoặc seed.

### Bước 5: Lấy URL Backend

1. Vào tab **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Bạn nhận được URL dạng: `https://quanlythurac-production.up.railway.app`
4. **Lưu lại URL này** — cần dùng cho bước cấu hình Vercel!

### Kiểm tra Backend hoạt động

Mở trình duyệt, truy cập:
```
https://YOUR-RAILWAY-URL.up.railway.app/health
```
Kết quả mong đợi:
```json
{ "status": "ok", "timestamp": "2026-07-23T..." }
```

---

## ▲ PHẦN 2: Deploy Frontend lên Vercel

### Bước 1: Đăng ký & Import Project

1. Truy cập [vercel.com](https://vercel.com) → **Login with GitHub**
2. Click **"Add New..."** → **"Project"**
3. Import repo **quanlythurac**

### Bước 2: Cấu hình Build Settings

> [!IMPORTANT]
> Vì frontend nằm trong thư mục `admin-frontend/`, bạn cần cấu hình đúng!

Trong màn hình cấu hình Vercel:

| Setting | Giá Trị |
|---------|---------|
| **Root Directory** | `admin-frontend` |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Bước 3: Thêm Environment Variables

Ở phần **"Environment Variables"** (vẫn trong màn hình import):

| Tên Biến | Giá Trị |
|----------|---------|
| `VITE_API_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |

> [!WARNING]
> Thay `YOUR-RAILWAY-URL` bằng URL thực từ Railway ở Bước 5 trên.
> URL **KHÔNG** có dấu `/` ở cuối.

### Bước 4: Deploy

Click **"Deploy"** → Vercel sẽ tự động build và deploy.

Sau ~2 phút, bạn nhận URL dạng:
```
https://quanlythurac-admin.vercel.app
```

---

## 🔗 Kết Nối Frontend ↔ Backend

Frontend cần biết địa chỉ backend để gọi API. Kiểm tra trong code frontend xem axios/fetch đang dùng URL như thế nào.

Tìm file config axios (thường là `src/api.ts` hoặc `src/utils/axios.ts`):

```typescript
// Ví dụ cách đọc VITE_API_URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
})
```

> [!NOTE]
> Nếu frontend dùng `/api/...` với proxy local, cần kiểm tra lại cách gọi API trong production. Hãy hỏi nếu cần hỗ trợ thêm.

---

## 🔄 Tự Động Re-deploy

Sau khi setup xong, mỗi lần bạn `git push`:
- **Railway** tự động build & deploy backend mới
- **Vercel** tự động build & deploy frontend mới

---

## ❗ Xử Lý Lỗi Thường Gặp

### Lỗi 1: "Cannot find module" hoặc Prisma lỗi
```bash
# Trong Railway Shell
npx prisma generate
npx prisma migrate deploy
```

### Lỗi 2: CORS Error trên Frontend
Backend đang set `origin: '*'` nên không phải CORS. Kiểm tra `VITE_API_URL` có đúng không.

### Lỗi 3: Build Vercel thất bại - "TypeScript error"
```bash
# Thử build local trước
cd admin-frontend
npm run build
```

### Lỗi 4: Database connection failed
- Kiểm tra `DATABASE_URL` trong Railway Variables
- Đảm bảo đã dùng "Add Reference" để lấy đúng connection string

### Lỗi 5: Railway "Application failed to respond"
- Kiểm tra log trong tab "Deployments" → Click vào deployment → "View Logs"
- Kiểm tra healthcheck: `/health` endpoint có hoạt động không

---

## 📱 Bonus: Mobile App (React Native/Expo)

Sau khi có Railway URL, cập nhật API URL trong mobile app:

```bash
cd mobile
# Tìm file config API và đổi URL sang Railway URL
```

Để share demo mobile:
```bash
cd mobile
npx expo start --tunnel
# Scan QR bằng Expo Go app
```

---

## 📊 Tổng Quan Kiến Trúc Sau Deploy

```
[Mobile App - Expo Go]
        ↓
[Frontend - Vercel]          → vercel.app
        ↓ VITE_API_URL
[Backend - Railway]          → railway.app
        ↓ DATABASE_URL
[PostgreSQL - Railway]       → (nội bộ Railway)
        ↓
[Uploads - Railway Volume]   → (files tải lên)
```

> [!CAUTION]
> Railway free tier có giới hạn **$5 credit/tháng**. Đủ để demo nhưng nếu dùng lâu dài cần nâng cấp.
> Vercel free tier không giới hạn cho dự án cá nhân/team nhỏ.
