# 🗑️ Hệ Thống Quản Lý Thu Rác & Hóa Đơn Điện Tử

Dự án tích hợp đầy đủ gồm 3 thành phần chính:
1. **Backend (NestJS + Prisma + PostgreSQL)**: API Server xử lý nghiệp vụ, quản lý dữ liệu và xuất hóa đơn.
2. **Frontend Web (ReactJS + Vite + AntD)**: Trang quản trị dành cho Admin / Kế toán.
3. **Mobile App (React Native + Expo)**: Ứng dụng di động dành cho nhân viên thu gom rác tại hiện trường.

---

## 🚀 Hướng Dẫn Cài Đặt Từ Đầu

### 1. Cài đặt Thư viện (Dependencies)

```bash
# 1. Cài đặt Backend (thư mục gốc)
npm install

# 2. Cài đặt Frontend Web
npm install --prefix admin-frontend

# 3. Cài đặt Mobile App
cd mobile
npm install --legacy-peer-deps
cd ..
```

---

### 2. Cấu Hình Môi Trường & Cơ Sở Dữ Liệu Local

1. Tạo file `.env` ở thư mục gốc (nếu chưa có) và khai báo kết nối PostgreSQL Local:
   ```env
   DATABASE_URL="postgresql://postgres:admin123@localhost:5432/db_quanly_thurac?schema=public"
   JWT_SECRET="qltrac_super_secret_key_change_in_production"
   JWT_EXPIRES_IN="1d"
   JWT_ACCESS_EXPIRES_IN="1d"
   JWT_REFRESH_SECRET="qltrac_refresh_super_secret_key_change_in_production"
   JWT_REFRESH_EXPIRES_IN="7d"
   ```

2. Khởi tạo Cơ sở dữ liệu (Migration & Seed dữ liệu mẫu):
   ```bash
   npm run db:setup
   ```
   *(Lệnh này chạy migration và nạp dữ liệu mẫu: Tỉnh/Phường/Thôn xóm, Tuyến thu, Hộ dân, Dịch vụ & Tài khoản mặc định).*

#### Tài khoản mặc định (Mật khẩu: `123456`):
- **Admin Cấp Cao:** `admin01`
- **Admin Cấp 2:** `adminlv2`
- **Kế Toán:** `account01`
- **Nhân Viên Thu Rác:** `staff01`

---

## 💻 Hướng Dẫn Chạy Hệ Thống Ở Môi Trường Local

### 1. Chạy Backend & Frontend Web (Đồng thời)
Tại thư mục gốc của dự án:
```bash
npm run dev:all
```
- 🌐 **Backend NestJS**: `http://localhost:3000`
- 🖥️ **Frontend Web**: `http://localhost:5173` *(Tự động proxy `/api` sang `localhost:3000`)*

### 2. Chạy Mobile App (React Native + Expo)
Chuyển vào thư mục `mobile` và khởi chạy:

```bash
cd mobile

# Cách 1: Chạy Native Development Build trên Máy ảo / Máy thật Android (Tự động sinh lại thư mục native android)
npx expo run:android

# Cách 2: Chạy nhanh qua Expo Go (Quét mã QR trên điện thoại)
npx expo start
```

> 💡 **Mẹo:** Trong file `mobile/.env`, nếu đặt `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`, Expo sẽ tự động nhận diện IP WiFi máy tính của bạn khi dev!

---

## ⚙️ Quản Lý Biến Môi Trường (Local vs Deploy)

| Phân hệ | Local Dev | Production Deploy |
|---|---|---|
| **Backend** | `.env` ở thư mục gốc | Dashboard **Railway** (PostgreSQL Connection Reference) |
| **Frontend** | `admin-frontend/.env.development` (`VITE_API_BASE_URL=/api`) | `admin-frontend/.env.production` hoặc Dashboard **Vercel** (`VITE_API_BASE_URL=https://qlrac-production.up.railway.app`) |
| **Mobile** | `mobile/.env` (`EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` hoặc Railway URL) | Biến môi trường trên **EAS Cloud** (`EXPO_PUBLIC_API_BASE_URL=https://qlrac-production.up.railway.app`) |

---

## 🌐 Hướng Dẫn Deploy Production (Free Cloud)

### 1. Backend + Database → Railway
- Deploy từ GitHub repo (Railway tự chọn `Dockerfile`).
- Tạo service **PostgreSQL** trên Railway.
- Cấu hình Variable `DATABASE_URL` dạng Reference `${{PostgreSQL.DATABASE_URL}}`.
- URL Backend: `https://qlrac-production.up.railway.app`

### 2. Frontend Web → Vercel
- Root Directory: `admin-frontend`
- Build Command: `vite build` | Output Directory: `dist`
- Set Environment Variable: `VITE_API_BASE_URL` = `https://qlrac-production.up.railway.app`

### 3. Mobile App (Build file APK) → Expo EAS Build
Chạy các lệnh sau trong thư mục `mobile`:

```bash
cd mobile

# 1. Đăng nhập Expo (chỉ cần 1 lần)
npx eas-cli login

# 2. Cập nhật URL Railway trên EAS Cloud (chỉ cần 1 lần)
npx eas-cli env:update --variable-name EXPO_PUBLIC_API_BASE_URL --value "https://qlrac-production.up.railway.app" --environment preview

# 3. Kích hoạt Build file APK
npx eas-cli build --platform android --profile preview --non-interactive
```
*(Sau khi build xong, quét mã QR trên terminal hoặc truy cập liên kết Expo để tải file `.apk` cài lên thiết bị Android).*

---

## 🛠️ Một Số Lệnh Hữu Ích Khác
* **Chạy lại Migration Database:** `npx prisma migrate deploy`
* **Chạy lại Seed Dữ liệu mẫu:** `npm run db:seed`
* **Xuất / Nhập Backup dữ liệu DB:** `npm run db:export` / `npm run db:import`
