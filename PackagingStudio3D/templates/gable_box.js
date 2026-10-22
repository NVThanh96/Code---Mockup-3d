/**
 * Mẫu: Hộp chóp có quai xách (Gable Handle Box / Gable Top Carton)
 * Cấu trúc gồm:
 *   - 4 vách thân chính: Mặt trước (p1), Hông phải (p2), Mặt sau (p3), Hông trái (p4), Mép dán (glue)
 *   - 4 cánh nắp đáy: 2 cánh phụ gập 89° trước, 2 cánh chính gập 90° sau (tránh Z-fighting)
 *   - 2 mặt mái chóp (Roof Front & Roof Back) nghiêng vào tâm hộp góc θ = arcsin((W/2)/H_roof)
 *   - 2 tấm quai xách đỉnh (Front Handle & Back Handle) bẻ ngược góc bù -θ để dựng THẲNG ĐỨNG 100%
 *   - Lỗ đục quai xách (Hand cutout) trên cả 2 quai xách dùng THREE.Shape.holes
 *   - 2 mặt hông tam giác (Gusset Panels) gấp lõm che kín 2 đầu hồi mái
 */
PS3D.registerTemplate({
    id: 'gable-box',
    name: 'Hộp chóp có quai xách',
    nameEn: 'Gable Handle Box / Gable Top',
    group: 'Hộp gài',
    closedRotX: 0, // Hộp đứng thẳng trên sàn (Y hướng lên)
    params: [
        { key: 'L', label: 'Dài (L)', def: 140 },
        { key: 'W', label: 'Rộng (W)', def: 90 },
        { key: 'H', label: 'Cao thân (H)', def: 100 },
        { key: 'G', label: 'Mép dán', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G || 15;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;

        // Chiều cao mái và chiều cao quai xách
        var H_roof = C(W * 0.65, 35, 90);
        var H_handle = C(H * 0.38, 30, 50);
        var botH = C(W * 0.55, 20, 60);

        // Tính góc nghiêng mái vào tâm (θ) sao cho 2 quai chạm nhau đúng ở trục z = -W/2
        var sinTheta = Math.min(0.95, (W / 2) / H_roof);
        var thetaDeg = Math.asin(sinTheta) * 180 / Math.PI;

        var x1 = L, x2 = L + W, x3 = 2 * L + W, x4 = 2 * L + 2 * W;

        function pn(id, parent, a, b, out, prof, angle, stage, holes) {
            var item = { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
            if (holes && holes.length > 0) item.holes = holes;
            return item;
        }

        // Lỗ luồn tay trên quai xách (Rounded rectangle cutout)
        function makeHandleHole(ox, oy, w, h, r) {
            r = Math.min(r || 8, Math.min(w, h) / 2 - 1);
            var x0 = ox + (L - w) / 2, y0 = oy + (H_handle - h) / 2;
            var pts = [];
            pts.push([x0 + r, y0]);
            pts.push([x0 + w - r, y0]);
            // Bo góc phải dưới
            PS3D.arc(pts, x0 + w - r, y0 + r, r, -Math.PI / 2, 0, 4);
            pts.push([x0 + w, y0 + h - r]);
            // Bo góc phải trên
            PS3D.arc(pts, x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, 4);
            pts.push([x0 + r, y0 + h]);
            // Bo góc trái trên
            PS3D.arc(pts, x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, 4);
            pts.push([x0, y0 + r]);
            // Bo góc trái dưới
            PS3D.arc(pts, x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 4);
            return pts;
        }

        var holeW = Math.max(40, L * 0.55);
        var holeH = Math.min(20, H_handle * 0.45);

        // Profile quai xách có bo cong 2 góc trên
        var handleProf = (function () {
            var rTop = Math.min(15, H_handle * 0.35);
            var pts = [[0, 0], [0, H_handle - rTop]];
            PS3D.arc(pts, rTop, H_handle - rTop, rTop, Math.PI, Math.PI / 2, 5);
            pts.push([L - rTop, H_handle]);
            PS3D.arc(pts, L - rTop, H_handle - rTop, rTop, Math.PI / 2, 0, 5);
            pts.push([L, 0]);
            return pts;
        })();

        // Thân trước (Front Panel) đặt tại [0, 0] tới [L, H]
        var panels = [
            { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front' },

            // Mép dán keo bên trái
            pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, [0, 0.4]),

            // Hông phải (p2)
            pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),

            // Mặt sau (p3)
            pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, [0, 0.4]),

            // Hông trái (p4)
            pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),

            // ── ĐÁY HỘP: Cánh phụ gập 89° trước, cánh chính gập 90° sau ──
            pn('botDust2', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, botH * 0.75), 89, [0.35, 0.50]),
            pn('botDust4', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, botH * 0.75), 89, [0.35, 0.50]),
            pn('botMain1', 'p1', [0, 0], [L, 0], [0, -1], P.glue(L, botH, botH * 0.3), 90, [0.50, 0.65]),
            pn('botMain3', 'p3', [x2, 0], [x3, 0], [0, -1], P.glue(L, botH, botH * 0.3), 90, [0.50, 0.65]),

            // ── MÁI CHÓP VÁT VÀO TÂM (Incline Roof Panels) ──
            // Mái trước nghiêng vào tâm góc thetaDeg
            pn('roofFront', 'p1', [0, H], [L, H], [0, 1], P.rect(L, H_roof), thetaDeg, [0.65, 0.88]),

            // Quai xách trước bẻ ngược góc -thetaDeg để đứng THẲNG ĐỨNG 100%
            pn('handleFront', 'roofFront', [0, H + H_roof], [L, H + H_roof], [0, 1], handleProf, -thetaDeg, [0.65, 0.88], [
                makeHandleHole(0, H + H_roof, holeW, holeH, 6)
            ]),

            // Mái sau nghiêng vào tâm góc thetaDeg
            pn('roofBack', 'p3', [x2, H], [x3, H], [0, 1], P.rect(L, H_roof), thetaDeg, [0.65, 0.88]),

            // Quai xách sau bẻ ngược góc -thetaDeg áp sát vào quai trước
            pn('handleBack', 'roofBack', [x2, H + H_roof], [x3, H + H_roof], [0, 1], handleProf, -thetaDeg, [0.65, 0.88], [
                makeHandleHole(x2, H + H_roof, holeW, holeH, 6)
            ]),

            // ── HAI MẶT HÔNG TAM GIÁC (GUSSET PANELS) CHE KÍN ĐẦU HỒI ──
            pn('gusset2', 'p2', [x1, H], [x2, H], [0, 1], [
                [0, 0], [W * 0.5, H_roof * 0.95], [W, 0]
            ], 60, [0.65, 0.88]),

            pn('gusset4', 'p4', [x4, H], [x3, H], [0, 1], [
                [0, 0], [W * 0.5, H_roof * 0.95], [W, 0]
            ], 60, [0.65, 0.88])
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, H * 0.5], b: [L, H * 0.5], label: L + ' mm' },
                { a: [x1, H * 0.5], b: [x2, H * 0.5], label: W + ' mm' },
                { a: [x2 + L / 2, 0], b: [x2 + L / 2, H], label: H + ' mm' }
            ]
        };
    }
});
