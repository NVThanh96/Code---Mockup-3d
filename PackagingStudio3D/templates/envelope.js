/**
 * Mẫu: Phong bì thư văn phòng / Bì thư tài liệu (Commercial & Catalog Envelope)
 * Chuẩn 12x22cm hoặc 25x34cm:
 *   - Mặt trước (Front Base): kích thước L x W
 *   - 2 Tai dán hông (Side Glue Flaps): gập vào 178° tạo khe túi
 *   - Cánh đáy (Bottom Pocket Flap): gập lên 179° phủ lên 2 tai hông
 *   - Nắp niêm phong (Top Seal Flap): vát hình thang/chóp tam giác bo tròn gập úp 175°
 */
PS3D.registerTemplate({
    id: 'envelope',
    name: 'Bì thư / Phong bì',
    nameEn: 'Commercial & Catalog Envelope',
    group: 'Túi giấy',
    closedRotX: 90, // Nằm phẳng trên bàn/sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 220 },
        { key: 'W', label: 'Rộng (W)', def: 120 },
        { key: 'sealH', label: 'Cao nắp dán', def: 42 }
    ],
    build: function (p) {
        var L = p.L, W = p.W;
        var sealH = p.sealH || Math.min(45, W * 0.45);
        var sideG = Math.min(18, L * 0.1);
        var botH = Math.min(W * 0.88, W - 10);
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Profile nắp niêm phong vát xéo bo tròn ở đỉnh (Classic V-flap / Trapezoid seal)
        function makeSealFlap(len, h) {
            var inset = Math.min(len * 0.25, 40);
            var r = Math.min(15, h * 0.4);
            var pts = [[0, 0]];
            pts.push([inset, h - r]);
            PS3D.arc(pts, len / 2, h - r, len / 2 - inset, Math.PI, 0, 8);
            pts.push([len, 0]);
            return pts;
        }

        // Profile cánh đáy phủ túi (Bottom pocket flap)
        function makeBottomFlap(len, h) {
            var inset = Math.min(12, len * 0.06);
            return [
                [0, 0],
                [inset, h - 3],
                [len - inset, h - 3],
                [len, 0]
            ];
        }

        var sealProf = makeSealFlap(L, sealH);
        var botProf = makeBottomFlap(L, botH);

        var panels = [
            // Mặt trước bì thư (Front Base)
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'front' },

            // Tai dán hông trái: gập vào 178°
            pn('sideL', 'base', [0, W], [0, 0], [-1, 0], P.glue(W, sideG, 10), 178, [0.0, 0.35]),

            // Tai dán hông phải: gập vào 178°
            pn('sideR', 'base', [L, 0], [L, W], [1, 0], P.glue(W, sideG, 10), 178, [0.0, 0.35]),

            // Cánh đáy tạo lưng túi: gập lên 179°
            pn('bottom', 'base', [0, 0], [L, 0], [0, -1], botProf, 179, [0.35, 0.70]),

            // Nắp niêm phong trên: gập xuống 175°
            pn('seal', 'base', [L, W], [0, W], [0, 1], sealProf, 175, [0.70, 1.0])
        ];

        return {
            panels: panels,
            meta: { L: L, W: W, sealH: sealH, templateId: 'envelope' }
        };
    }
});
