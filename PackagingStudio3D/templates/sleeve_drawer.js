/**
 * Mẫu: Hộp bao diêm / Ngăn kéo (Sleeve & Drawer Box)
 * Gồm vỏ bao dạng ống (sleeve) trượt bọc quanh khay ngăn kéo (drawer).
 * Ứng dụng phổ biến: Hộp đựng bánh kẹo, phụ kiện, mỹ phẩm cao cấp.
 */
PS3D.registerTemplate({
    id: 'sleeve-drawer',
    name: 'Hộp bao diêm / Ngăn kéo',
    nameEn: 'Sleeve & Drawer Box',
    group: 'Hộp kéo / Bao',
    closedRotX: 90,
    params: [
        { key: 'L', label: 'Dài (L)', def: 120 },
        { key: 'W', label: 'Rộng (W)', def: 80 },
        { key: 'H', label: 'Cao (H)', def: 35 },
        { key: 'G', label: 'Mép dán', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G;
        var P = PS3D.profiles, F = PS3D.flap;
        var B_WALL = [0.1, 0.5], B_SLEEVE = [0.4, 0.95];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Khay ngăn kéo đáy (Drawer Tray)
        var panels = [
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' },
            pn('dFront', 'base', [0, 0], [L, 0], [0, -1], P.rect(L, H), 90, B_WALL),
            pn('dBack', 'base', [L, W], [0, W], [0, 1], P.rect(L, H), 90, B_WALL),
            pn('dLeft', 'base', [0, W], [0, 0], [-1, 0], P.rect(W, H), 90, B_WALL),
            pn('dRight', 'base', [L, 0], [L, W], [1, 0], P.rect(W, H), 90, B_WALL),

            // Tai góc khay
            pn('cFL', 'dFront', [0, -H], [0, 0], [-1, 0], P.glue(H, 15, 2), 92, [0.05, 0.35]),
            pn('cFR', 'dFront', [L, 0], [L, -H], [1, 0], P.glue(H, 15, 2), 92, [0.05, 0.35]),
            pn('cBL', 'dBack', [0, W], [0, W + H], [-1, 0], P.glue(H, 15, 2), 92, [0.05, 0.35]),
            pn('cBR', 'dBack', [L, W + H], [L, W], [1, 0], P.glue(H, 15, 2), 92, [0.05, 0.35]),

            // Vỏ bao diêm ngoài (Outer Sleeve) nối liền cạnh hông với độ hở trượt
            // 4 mặt cuốn quanh: Mặt trên → Hông 1 → Mặt đáy vỏ → Hông 2 + mép dán
            pn('slTop', 'dRight', [L + H, 0], [L + H, W], [1, 0], P.rect(W, L + 1.5), 90, B_SLEEVE),
            pn('slSide1', 'slTop', [L + H, W], [L + H + (L + 1.5), W], [0, 1], P.rect(L + 1.5, H + 1.5), 90, B_SLEEVE),
            pn('slBottom', 'slSide1', [L + H, W + (H + 1.5)], [L + H + (L + 1.5), W + (H + 1.5)], [0, 1], P.rect(L + 1.5, W + 1.0), 90, B_SLEEVE),
            pn('slSide2', 'slBottom', [L + H, 2 * W + (H + 1.5)], [L + H + (L + 1.5), 2 * W + (H + 1.5)], [0, 1], P.rect(L + 1.5, H + 1.5), 90, B_SLEEVE),
            pn('slGlue', 'slSide2', [L + H, 2 * W + 2 * (H + 1.5)], [L + H + (L + 1.5), 2 * W + 2 * (H + 1.5)], [0, 1], P.glue(L + 1.5, G, 3), 90, [0.85, 1.0])
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.25, -H], b: [L * 0.25, 0], label: H + ' mm' }
            ]
        };
    }
});
