# Quy chuẩn Phát triển Mobile (React Native + Expo)

Bạn đang hỗ trợ phát triển app di động cho hệ thống "Quản lý Thu rác" bằng React Native và Expo.

## 1. Quy tắc kết nối API NestJS
- Tuyệt đối KHÔNG dùng `localhost` hoặc `127.0.0.1` để gọi API từ Mobile.
- Bắt buộc cấu hình `BASE_URL` động theo IP mạng nội bộ của máy tính Dev (Ví dụ: `http://192.168.1.X:3000`) hoặc link Ngrok.
- Lưu trữ và mã hóa Token bảo mật bằng `expo-secure-store`.

## 2. Kiến trúc thư mục
- Toàn bộ giao diện và logic đặt trong thư mục `app/` (sử dụng Expo Router) hoặc thư mục `src/` tùy kiến trúc được định nghĩa.