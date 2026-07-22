# 🗑️ Hệ Thống Quản Lý Thu Rác & Hóa Đơn Điện Tử

Dự án tích hợp gồm 3 thành phần chính:
1. **Backend (NestJS)**: API Server kết nối PostgreSQL qua Prisma.
2. **Frontend Web (ReactJS + Vite)**: Trang quản trị dành cho Admin/Kế toán.
3. **Mobile App (React Native + Expo)**: Ứng dụng di động dành cho nhân viên thu rác.

---

## 🚀 Hướng Dẫn Cài Đặt Từ Đầu

### 1. Cài đặt thư viện (Dependencies)
Chạy các lệnh sau để cài đặt đầy đủ thư viện cho cả 3 phân hệ:

```bash
# 1. Cài đặt tại thư mục gốc (Backend)
npm install

# 2. Cài đặt cho Frontend Web
npm install --prefix admin-frontend

# 3. Cài đặt cho Mobile App
cd mobile
npm install --legacy-peer-deps
cd ..
```

### 2. Cấu hình Môi trường & Cơ sở dữ liệu
1. Tạo file `.env` ở thư mục gốc (nếu chưa có) và cấu hình kết nối PostgreSQL:
   ```env
   DATABASE_URL=postgresql://postgres:admin123@localhost:5432/qlrac?schema=public
   ```
2. Khởi tạo Cơ sở dữ liệu (chạy Migrations & Seed dữ liệu mẫu):
   ```bash
   npm run db:setup
   ```
   *Lệnh này sẽ tự động chạy các file migration và nạp sẵn dữ liệu mẫu (Khu vực, Tuyến thu, Hộ dân, Tài khoản mẫu).*

#### Các tài khoản mặc định (Mật khẩu: `123456`):
- **Admin cấp cao:** `admin01`
- **Admin cấp 2:** `adminlv2`
- **Nhân viên thu rác:** `staff01`
- **Kế toán:** `account01`

---

## 💻 Hướng Dẫn Chạy Hệ Thống

### 1. Chạy Backend & Frontend Web (Đồng thời)
Tại thư mục gốc của dự án, chạy lệnh:
```bash
npm run dev:all
```
*   **Backend NestJS** sẽ khởi động tại: `http://localhost:3000`
*   **Frontend Web** sẽ khởi động tại: `http://localhost:5173` (hoặc cổng Vite hiển thị trên terminal)

### 2. Chạy Mobile App (React Native + Expo)
Di chuyển vào thư mục `mobile` và khởi chạy Expo Metro Bundler:
```bash
cd mobile

# Chạy sạch cache và kết nối qua dải mạng LAN
# Lệnh mở cổng 3000 cho Backend NestJS
New-NetFirewallRule -DisplayName "Allow NestJS Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Lệnh mở cổng 8081 cho Server Expo Metro
New-NetFirewallRule -DisplayName "Allow Expo Port 8081" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
npx expo start --lan --clear
```

> 💡 **Mẹo chạy thử Mobile:**
> *   **Trên máy tính (Web):** Nhấn phím `w` để mở giao diện mobile dạng web tại `http://localhost:8081`.
> *   **Trên điện thoại thật (Expo Go):** Quét mã QR hiển thị ở terminal (Đảm bảo điện thoại và máy tính kết nối chung mạng Wi-Fi).
> *   **Nếu Wi-Fi không thông nhau (khác dải mạng):** Sử dụng chế độ đường hầm (tunnel):
>     ```bash
>     npx expo start -c --tunnel
>     ```

---

## 📦 Đóng Gói Ứng Dụng Mobile (Build APK)
Để tạo file `.apk` cài đặt trực tiếp lên điện thoại Android qua EAS Build:
```bash
cd mobile
# Đăng nhập tài khoản Expo (chỉ làm lần đầu)
npx eas-cli login

# Tạo file APK (bản preview)
npx eas-cli build --platform android --profile preview
```

---

## 🛠️ Một Số Lệnh Hữu Ích Khác
*   **Cập nhật cấu hình Database (Prisma Migration):**
    ```bash
    npx prisma migrate deploy
    ```
*   **Chạy lại Seed dữ liệu:**
    ```bash
    npm run db:seed
    ```
*   **Khắc phục lỗi xung đột phiên bản Expo:**
    ```bash
    npx expo install --fix -- --legacy-peer-deps
    ```

    DEBUG APP npx expo run:android
