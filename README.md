<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Database setup (migrate + seed)

```bash
# run all migrations and seed sample data in one command
$ npm run db:setup
```

Command above will create sample data including:
- Roles: `ADMIN`, `ADMIN_LEVEL_2`, `STAFF`, `ACCOUNTANT`
- Dynamic menus + role-menu permissions
- Sample province/ward/locality/routes
- Sample service catalogs
- Sample households with service type and route
- Sample users and route assignment

Default login accounts (password: `123456`):
- `admin01`
- `adminlv2`
- `staff01`
- `account01`

If you only want to re-seed data:

```bash
$ npm run db:seed
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).




# 📝 CẨM NANG LỆNH DỰ ÁN QUẢN LÝ RÁC (2026)

Tài liệu tổng hợp toàn bộ các lệnh vận hành hệ thống từ Backend, Frontend Web cho đến Mobile App (React Native/Expo).

---

## 1. 🖥️ QUẢN LÝ BACKEND & WEB FRONTEND
*Chạy tại thư mục gốc của toàn dự án.*

* **Chạy đồng thời cả Backend (NestJS) và Frontend Web (ReactJS):**
    ```bash
    npm run dev:all
    ```

> ⚠️ **Lưu ý cấu hình CORS ở Backend (`backend/src/main.ts`):**
> Để Mobile App và Web ở cổng khác có thể gọi được API, file `main.ts` bắt buộc phải bật CORS và lắng nghe dải IP `0.0.0.0`:
> ```typescript
> app.enableCors({ origin: '*', credentials: true });
> await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
> ```

---

## 2. 📱 PHÁT TRIỂN MOBILE APP (DEV & TEST)
*Mở một Terminal riêng và di chuyển vào thư mục `mobile`:* `cd mobile`

* **Cách 1: Test nhanh trên Trình duyệt Web (Mượt, dễ F12 debug):**
    ```bash
    npx expo start -c
    ```
    *Nhấn phím **`w`** trên bàn phím để tự động mở giao diện app dưới dạng trang web tại địa chỉ `http://localhost:8081`.*

* **Cách 2: Test trên Điện thoại thật qua Expo Go (Khi máy tính cắm mạng dây / Wi-Fi lag):**
    ```bash
    npx expo start -c --tunnel
    ```
    *Bật mạng 3G/4G hoặc Wi-Fi trên điện thoại, mở ứng dụng **Expo Go** (Android) hoặc **Camera mặc định** (iPhone) để quét mã QR vừa sinh ra. Code sẽ được truyền qua đường hầm xuyên tường lửa.*

> 🚨 **Cấu hình `BASE_URL` trong App Mobile:**
> - Khi test trên Web (`localhost:8081`): Có thể dùng `http://localhost:3000`.
> - Khi test trên file APK hoặc Expo Go: **Bắt buộc** phải đổi thành IPv4 của máy tính (Ví dụ: `http://10.54.24.127:3000`).

---

## 3. 📦 ĐÓNG GÓI XUẤT FILE APK (BUILD TRÊN MÂY EAS)
*Thực hiện tại thư mục `mobile`. Phương pháp này đẩy code lên server Expo build hộ, không cần cài Android Studio.*

* **Bước 1: Đăng nhập tài khoản Expo (Chỉ làm lần đầu tiên):**
    ```bash
    npx eas-cli login
    ```
* **Bước 2: Khởi tạo cấu hình liên kết dự án (Chỉ làm lần đầu tiên):**
    ```bash
    npx eas-cli build:configure
    ```
    *(Chọn nền tảng hệ điều hành là `Android` hoặc `All`).*

* **Bước 3: Bắn lệnh Build ra file APK hoàn chỉnh:**
    ```bash
    npx eas-cli build --platform android --profile preview
    ```

> 🎁 **Nhận file APK:** Sau 3 - 5 phút build xong trên mây, Terminal sẽ trả về một **Mã QR** và một **Đường link**. Tiến hành quét mã để tải trực tiếp file `app-release.apk` về điện thoại để cài đặt và test tính năng Login thực tế.

---

## 🛠️ XỬ LÝ LỖI NHANH (TROUBLESHOOTING)

* **Lỗi xung đột thư viện (`ERESOLVE`) khi cài package mới bên Mobile:**
    ```bash
    npm install --legacy-peer-deps
    ```
* **Lỗi lệch pha phiên bản cấu hình giữa các gói Expo:**
    ```bash
    npx expo install --fix -- --legacy-peer-deps
    ```
* **Ép điện thoại tải lại giao diện (Reload) khi đang test app:**
    * Nhấn phím **`r`** tại Terminal đang chạy server Expo.
