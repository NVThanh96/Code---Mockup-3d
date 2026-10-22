/**
 * Mẫu: Hộp đáy gài khóa tự động (Auto-lock / Crash Lock Bottom Box)
 * Đáy được dán sẵn điểm chốt góc 45°, khi mở thân hộp đáy tự động bật vào khớp khóa.
 * Rất phổ biến cho dược phẩm, mỹ phẩm, thực phẩm đóng hộp cao cấp.
 */
PS3D.registerTemplate({
    id: 'crash-lock',
    name: 'Hộp nắp gài đáy khóa',
    nameEn: 'Auto-lock / Crash Lock Bottom',
    group: 'Hộp gài',
    params: [
        { key: 'L', label: 'Dài (L)', def: 60 },
        { key: 'W', label: 'Rộng (W)', def: 50 },
        { key: 'H', label: 'Cao (H)', def: 100 },
        { key: 'G', label: 'Mép dán', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;
        var tuckH = C(W * 0.35 + 4, 10, Math.max(10, H * 0.6));
        var dustH = C(W * 0.6, 8, L * 0.48);
        var x1 = L, x2 = L + W, x3 = 2 * L + W, x4 = 2 * L + 2 * W;
        var BODY = [0, 0.4];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Đáy khóa: 2 tai chốt chính (hình thang vát 45 độ) và 2 tai phụ
        var botH = Math.min(W * 0.75, 45);

        return {
            panels: [
                { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front' },
                pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, BODY),
                pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, BODY),
                pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, BODY),
                pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, BODY),

                // Đáy khóa tự động (Auto-bottom flaps)
                pn('lockBase1', 'p1', [0, 0], [L, 0], [0, -1], P.glue(L, botH, botH * 0.5), 90, [0.42, 0.62]),
                pn('lockBase3', 'p3', [x2, 0], [x3, 0], [0, -1], P.glue(L, botH, botH * 0.5), 90, [0.42, 0.62]),
                pn('lockSide2', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, botH * 0.8), 92, [0.38, 0.55]),
                pn('lockSide4', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, botH * 0.8), 92, [0.38, 0.55]),

                // Nắp trên (Tuck top)
                pn('topDust2', 'p2', [x1, H], [x2, H], [0, 1], P.dust(W, dustH), 92, [0.7, 0.8]),
                pn('topDust4', 'p4', [x4, H], [x3, H], [0, 1], P.dust(W, dustH), 92, [0.7, 0.8]),
                pn('topLid', 'p1', [0, H], [L, H], [0, 1], P.rect(L, W), 90, [0.78, 0.9]),
                pn('topTuck', 'topLid', [0, H + W], [L, H + W], [0, 1], P.tuck(L, tuckH, 8), 94, [0.88, 1])
            ],
            dims: [
                { a: [0, H * 0.3], b: [L, H * 0.3], label: L + ' mm' },
                { a: [x1, H * 0.6], b: [x2, H * 0.6], label: W + ' mm' },
                { a: [x2 + L / 2, 0], b: [x2 + L / 2, H], label: H + ' mm' }
            ]
        };
    }
});
