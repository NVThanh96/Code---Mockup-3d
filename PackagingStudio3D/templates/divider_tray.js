/**
 * Mẫu: Khay định hình 4 ô đựng bánh trung thu (4-Cavity Divider Tray)
 * Cấu trúc gồm:
 *   - Mặt đáy/mặt sàn chính (base): kích thước L x W
 *   - 4 lỗ khoét định hình thật (4 Cavity Cutouts) đục qua THREE.Shape.holes sắp xếp lưới 2x2
 *   - 4 vách thành đứng (Front, Back, Left, Right) gập 90°
 *   - 4 tai góc dán/khóa (Corner flaps)
 *   - 2 nẹp gập cuộn gia cố thành đôi (Double rollover walls) gập 90° bên trong
 */
PS3D.registerTemplate({
    id: 'divider-tray',
    name: 'Khay định hình 4 ô',
    nameEn: '4-Cavity Mooncake Divider Tray',
    group: 'Hộp 2 mảnh',
    closedRotX: 90, // Đáy nằm phẳng trên sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 305 },
        { key: 'W', label: 'Rộng (W)', def: 240 },
        { key: 'H', label: 'Cao thành (H)', def: 45 },
        { key: 'holeSize', label: 'Cỡ ô (mm)', def: 72 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var holeSize = p.holeSize || 72;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;

        var fw = Math.min(W * 0.35, H * 0.9, 32);
        var WALL = [0.25, 0.85], CORNER = [0.1, 0.45], ROLL = [0.55, 0.95];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Tạo 1 lỗ khoét bo góc tại tâm (cx, cy)
        function makeCavityHole(cx, cy, size, r) {
            r = Math.min(r || 12, size / 2 - 2);
            var half = size / 2;
            var x0 = cx - half, y0 = cy - half;
            var pts = [];
            pts.push([x0 + r, y0]);
            pts.push([x0 + size - r, y0]);
            PS3D.arc(pts, x0 + size - r, y0 + r, r, -Math.PI / 2, 0, 5);
            pts.push([x0 + size, y0 + size - r]);
            PS3D.arc(pts, x0 + size - r, y0 + size - r, r, 0, Math.PI / 2, 5);
            pts.push([x0 + r, y0 + size]);
            PS3D.arc(pts, x0 + r, y0 + size - r, r, Math.PI / 2, Math.PI, 5);
            pts.push([x0, y0 + r]);
            PS3D.arc(pts, x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 5);
            return pts;
        }

        // 4 ô định hình lưới 2x2
        var s = Math.min(holeSize, Math.min(L * 0.38, W * 0.38));
        var cx1 = L * 0.28, cx2 = L * 0.72;
        var cy1 = W * 0.28, cy2 = W * 0.72;

        var holes = [
            makeCavityHole(cx1, cy1, s, 12),
            makeCavityHole(cx2, cy1, s, 12),
            makeCavityHole(cx1, cy2, s, 12),
            makeCavityHole(cx2, cy2, s, 12)
        ];

        var panels = [
            // Mặt sàn khay chứa 4 lỗ khoét bánh
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom', holes: holes },

            // 4 vách thành đứng
            pn('front', 'base', [0, 0], [L, 0], [0, -1], P.rect(L, H), 90, WALL),
            pn('back', 'base', [L, W], [0, W], [0, 1], P.rect(L, H), 90, WALL),
            pn('left', 'base', [0, W], [0, 0], [-1, 0], P.rect(W, H), 90, WALL),
            pn('right', 'base', [L, 0], [L, W], [1, 0], P.rect(W, H), 90, WALL),

            // Tai góc liên kết vách trước và sau
            pn('cFL', 'front', [0, -H], [0, 0], [-1, 0], P.glue(H, fw, 3), 92, CORNER),
            pn('cFR', 'front', [L, 0], [L, -H], [1, 0], P.glue(H, fw, 3), 92, CORNER),
            pn('cBL', 'back', [0, W], [0, W + H], [-1, 0], P.glue(H, fw, 3), 92, CORNER),
            pn('cBR', 'back', [L, W + H], [L, W], [1, 0], P.glue(H, fw, 3), 92, CORNER),

            // Nẹp gập cuộn gia cố thành bên trong (Double walls)
            pn('rollL', 'left', [-H, W], [-H, 0], [-1, 0], P.rect(W, H - 1), 90, ROLL),
            pn('rollR', 'right', [L + H, 0], [L + H, W], [1, 0], P.rect(W, H - 1), 90, ROLL)
        ];

        return {
            panels: panels,
            meta: { L: L, W: W, H: H, templateId: 'divider-tray', cavityCount: 4, cavitySize: s }
        };
    }
});
