# KeyDock

Local-First Password Vault cho macOS và Windows. Dữ liệu nằm trên máy, mã hóa bằng AES-256-GCM. Mật khẩu chính không được ghi xuống đĩa.

## Chạy

```bash
npm install
npm test
npm start
```

`better-sqlite3` là module native. `npm install` sẽ biên dịch lại đúng ABI của Electron. Trên macOS cần Xcode Command Line Tools. Trên Windows cần công cụ build của Node (Visual Studio Build Tools).

## Đóng gói

```bash
npm run dist:mac   # dist/KeyDock-1.0.0.dmg
npm run dist:win   # dist/KeyDock Setup 1.0.0.exe
```

Bản macOS trong cấu hình này không ký chứng chỉ Developer ID. Bản Windows là bộ cài NSIS (file `.exe`).

## Cài từ file phát hành

Máy Mac nào tải file DMG rồi mở đều bị Gatekeeper chặn một lần, vì app chưa được Apple notarize. Kéo KeyDock vào Applications, rồi trong Terminal:

```bash
xattr -cr /Applications/KeyDock.app && open /Applications/KeyDock.app
```

Máy Windows không hiện hộp thoại đó. SmartScreen có thể hỏi vì file cài chưa có chứng chỉ. Chọn vẫn chạy là cài được.

## Dữ liệu

SQLite nằm tại:

- macOS: `~/Library/Application Support/KeyDock/keydock.db`
- Windows: `%APPDATA%\KeyDock\keydock.db`

Mỗi bản ghi gồm loại (Web, SSH, Server, Database), danh mục do bạn đặt trong loại đó (ví dụ Ngân hàng trong Web), tài khoản, mật khẩu và ghi chú. Tất cả được mã hóa trước khi ghi. Salt ngẫu nhiên và bộ xác thực khóa nằm trong bảng `meta`. Khóa AES được tạo bằng PBKDF2-SHA256, 600.000 vòng, rồi chỉ giữ trong bộ nhớ cho đến khi khóa vault. Mỗi lần sửa hoặc xóa, bản trước được giữ trong nhật ký để khôi phục.

Vault tự khóa sau 5 phút không thao tác. Nút sao chép ghi clipboard và xóa lại sau 15 giây nếu nội dung clipboard chưa đổi.

## Xuất / nhập JSON

File sao lưu là JSON **không mã hóa**, mỗi phần tử có `title`, `username`, `password`, `host`, `category`, `note`. Có thể là một mảng, hoặc object `{ "entries": [ ... ] }`.

Nếu tiêu đề trùng (không phân biệt hoa thường), hộp thoại hỏi ghi đè hoặc bỏ qua. Bản ghi thiếu tiêu đề bị bỏ qua.

Quên mật khẩu chính thì không mở lại bản ghi cũ. Khách bấm **Quên mật khẩu chính?** và nhập mã xóa được cấp. Không tự sinh mã trong app. Trên máy phát hành, `npm run wipe-codes` in 10 mã mới; mã cũ vẫn dùng được.
