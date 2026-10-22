/**
 * Mẫu: Thùng carton tiêu chuẩn (Regular Slotted Carton - RSC / FEFCO 0201)
 * Thùng carton đóng hàng phổ biến nhất trong công nghiệp:
 *   - 4 vách thân chính: Mặt trước (p1), Hông phải (p2), Mặt sau (p3), Hông trái (p4)
 *   - Mép dán (Glue Flap) 30mm kết nối thân thành ống chữ nhật
 *   - 4 cánh nắp đáy (Bottom Flaps): 2 cánh phụ gập 89° trước, 2 cánh chính gập 90° sau khép khít tâm W/2
 *   - 4 cánh nắp trên (Top Flaps): 2 cánh phụ gập 89° trước, 2 cánh chính gập 90° sau đóng kín miệng thùng
 */
PS3D.registerTemplate({
    id: 'rsc-carton',
    name: 'Thùng carton (RSC)',
    nameEn: 'Regular Slotted Carton (FEFCO 0201)',
    group: 'Hộp dẹp / Ship',
    closedRotX: 0, // Thùng đứng thẳng trên sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 250 },
        { key: 'W', label: 'Rộng (W)', def: 180 },
        { key: 'H', label: 'Cao (H)', def: 150 },
        { key: 'G', label: 'Mép dán', def: 30 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G || 30;
        var P = PS3D.profiles, F = PS3D.flap;
        var flapH = W / 2; // Chiều cao cánh nắp bằng nửa chiều rộng để 2 cánh chính chạm nhau ở giữa
        var x1 = L, x2 = L + W, x3 = 2 * L + W, x4 = 2 * L + 2 * W;

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        var panels = [
            { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front' },
            pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, [0, 0.4]),
            pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),
            pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, [0, 0.4]),
            pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),

            // ── 4 CÁNH NẮP ĐÁY: 2 cánh phụ 89° trước, 2 cánh chính 90° sau (không Z-fighting) ──
            pn('botSide2', 'p2', [x1, 0], [x2, 0], [0, -1], P.rect(W, flapH), 89, [0.35, 0.52]),
            pn('botSide4', 'p4', [x4, 0], [x3, 0], [0, -1], P.rect(W, flapH), 89, [0.35, 0.52]),
            pn('botMain1', 'p1', [0, 0], [L, 0], [0, -1], P.rect(L, flapH), 90, [0.52, 0.68]),
            pn('botMain3', 'p3', [x2, 0], [x3, 0], [0, -1], P.rect(L, flapH), 90, [0.52, 0.68]),

            // ── 4 CÁNH NẮP TRÊN: 2 cánh phụ 89° trước, 2 cánh chính 90° sau khép kín tâm ──
            pn('topSide2', 'p2', [x1, H], [x2, H], [0, 1], P.rect(W, flapH), 89, [0.70, 0.85]),
            pn('topSide4', 'p4', [x4, H], [x3, H], [0, 1], P.rect(W, flapH), 89, [0.70, 0.85]),
            pn('topMain1', 'p1', [0, H], [L, H], [0, 1], P.rect(L, flapH), 90, [0.85, 1.0]),
            pn('topMain3', 'p3', [x2, H], [x3, H], [0, 1], P.rect(L, flapH), 90, [0.85, 1.0])
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
