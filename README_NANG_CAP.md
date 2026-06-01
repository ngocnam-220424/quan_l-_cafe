# Bản nâng cấp chức năng Cafe POS

Bản này nâng cấp dự án React/Vite/Firebase để thao tác gần giống dự án Cafe POS trước đó.

## Chức năng chính

- Đăng nhập bằng Firebase Authentication.
- Quản lý bàn, trạng thái bàn và đơn hiện tại.
- Gọi món tại quầy.
- Khách gọi món bằng QR theo bàn.
- Quản lý menu: thêm, sửa, xóa, upload ảnh từ thiết bị hoặc nhập URL ảnh.
- Quản lý thanh toán: xem bàn có đơn, kiểm tra hóa đơn, in hóa đơn, xác nhận thanh toán.
- Lịch sử thanh toán: xem lại hóa đơn, in lại hóa đơn, xóa lịch sử cục bộ.
- Quản lý kho: thêm/sửa/xóa hàng kho, nhập/xuất kho, cảnh báo tồn thấp.
- Tự động trừ kho sau khi thanh toán đúng theo số lượng món đã bán.
- Thống kê: doanh thu hôm nay, tổng doanh thu, số hóa đơn, món bán chạy, cảnh báo kho.

## Cách chạy

```bash
npm install
npm run dev
```

Mở trình duyệt tại link Vite hiển thị, thường là:

```txt
http://localhost:5173
```

## Kiểm tra build

```bash
npm run lint
npm run build
```

## Lưu ý Firebase

Sau khi đổi `firestore.rules`, cần deploy lại rules lên Firebase để thao tác menu/kho đúng quyền:

```bash
firebase deploy --only firestore:rules
```

Nếu chưa deploy rules, ứng dụng vẫn fallback localStorage trong một số thao tác, nhưng dữ liệu có thể chưa đồng bộ giữa nhiều máy.
