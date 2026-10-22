# 📦 Packaging Studio 3D — Hướng dẫn sử dụng (v2)

Panel trong Adobe Illustrator (CC 2018 trở lên): **thư viện mẫu hộp → khuôn 2D trong AI → mô hình 3D gập/mở**, đồng bộ nhiều file cùng lúc.

## 1. Cài đặt (máy mới)
1. Copy **cả thư mục** dự án sang máy.
2. Tắt Illustrator → bấm đúp **`CAI_DAT.bat`**.
3. Mở Illustrator → **Window → Extensions → Packaging Studio 3D**.

## 2. Quy trình làm việc
| Bước | Thao tác |
|---|---|
| Chọn mẫu | Bấm thẻ mẫu trong **① Thư viện mẫu hộp** |
| Kích thước | Nhập ở **②** (3D cập nhật ngay) |
| Tạo file | **✚ Tạo file mới** → file AI có sẵn layer `CUT`, `CREASE`, `BLEED`, `DIMS` và `ARTWORK` |
| Thiết kế | Vẽ trên layer **ARTWORK (Thiết kế)** |
| Xem 3D có thiết kế | **🎨 Sync Artwork** (bấm lại sau mỗi lần sửa thiết kế) |
| Đổi kích thước / gắn mẫu cho file cũ | Sửa thông số → **↻ Áp vào file này** (không đụng tới ARTWORK) |
| Làm nhiều khách hàng | Mở nhiều file, bấm tên file trong **③ File đang mở** hoặc chuyển tab trong AI → 3D tự đổi theo file |

Thông tin mẫu + kích thước được lưu **trong chính file AI** (layer ẩn `PS3D_DATA`), nên mở lại file sau này hoặc trên máy khác panel vẫn nhận ra.

## 3. Mẫu có sẵn
- **Hộp gài so le** (Reverse Tuck End)
- **Hộp gài cùng chiều** (Straight Tuck End)
- **Khay / Hộp âm dương** — tạo 2 file: đáy và nắp (nắp lớn hơn đáy ~2 mm mỗi chiều, cao thấp hơn)

## 4. Thêm mẫu hộp mới
Tạo file `.js` trong `PackagingStudio3D/templates/` (sao chép một mẫu có sẵn để sửa), rồi chạy lại `CAI_DAT.bat`. Mỗi mặt khai báo:
- `poly`: đa giác trên khuôn trải (mm) — dùng `PS3D.flap(a, b, hướngRa, profile)` để tạo tai/nắp gắn vào bản lề `a→b`
- `parent`, `hinge`: mặt cha và đường gấp
- `angle`: góc gập (dương = gập vào trong; 92–94° cho tai bụi/lưỡi gài để nằm khít bên trong)
- `stage`: `[bắt đầu, kết thúc]` theo thanh trượt (0 = trải phẳng, 1 = đóng)

Khuôn 2D, đường gấp, bleed và mô hình 3D đều được sinh từ cùng định nghĩa này.

## 5. Lưu ý
- Bleed được tạo bằng Pathfinder + Offset Path của Illustrator; nếu thông báo "không tạo được bleed tự động", hãy tự Offset Path trên layer BLEED.
- Bản cũ `PackagingDieline_3D.jsx` (chạy qua File → Scripts) vẫn dùng được.
