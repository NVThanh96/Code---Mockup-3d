/**
 * Mẫu: Khay gấp 4 vách có tai góc — dùng làm ĐÁY hoặc NẮP của hộp âm dương
 * (làm nắp: tạo file thứ 2 với L, W lớn hơn đáy ~2 mm và H thấp hơn).
 * Đáy là mặt gốc; vách trước/sau mang tai góc gập vào trong vách hông.
 */
PS3D.registerTemplate({
    id: 'tray',
    name: 'Khay / Hộp âm dương',
    nameEn: 'Tray (Lid & Base)',
    group: 'Hộp 2 mảnh',
    closedRotX: 90, // đặt đáy nằm xuống sàn khi gập
    params: [
        { key: 'L', label: 'Dài (L)', def: 120 },
        { key: 'W', label: 'Rộng (W)', def: 80 },
        { key: 'H', label: 'Cao (H)', def: 40 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var P = PS3D.profiles, F = PS3D.flap;
        var fw = Math.min(W * 0.4, H * 0.9, 30); // bề rộng tai góc
        var WALL = [0.3, 0.9], CORNER = [0.1, 0.45];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        return {
            panels: [
                { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' },
                pn('front', 'base', [0, 0], [L, 0], [0, -1], P.rect(L, H), 90, WALL),
                pn('back', 'base', [L, W], [0, W], [0, 1], P.rect(L, H), 90, WALL),
                pn('left', 'base', [0, W], [0, 0], [-1, 0], P.rect(W, H), 90, [0.35, 0.95]),
                pn('right', 'base', [L, 0], [L, W], [1, 0], P.rect(W, H), 90, [0.35, 0.95]),

                pn('cFL', 'front', [0, -H], [0, 0], [-1, 0], P.glue(H, fw, 3), 92, CORNER),
                pn('cFR', 'front', [L, 0], [L, -H], [1, 0], P.glue(H, fw, 3), 92, CORNER),
                pn('cBL', 'back', [0, W], [0, W + H], [-1, 0], P.glue(H, fw, 3), 92, CORNER),
                pn('cBR', 'back', [L, W + H], [L, W], [1, 0], P.glue(H, fw, 3), 92, CORNER)
            ],
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.25, -H], b: [L * 0.25, 0], label: H + ' mm' }
            ]
        };
    }
});
