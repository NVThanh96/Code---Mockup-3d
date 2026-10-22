/**
 * Mẫu: Hộp Burger / Hộp Clamshell / Fast Food Box
 * (Burger Box Clamshell / Hộp bánh Burger gấp liền có khóa góc)
 * Cấu trúc gồm: Đáy (Bottom Tray), Vách trước/sau/trái/phải,
 * Nắp vòm (Top Lid), và Lưỡi khóa gài mặt trước (Front Tuck Tab).
 */
PS3D.registerTemplate({
    id: 'burger-box',
    name: 'Hộp Burger / Clamshell',
    nameEn: 'Burger Box / Clamshell Box',
    group: 'Hộp dẹp / Ship',
    closedRotX: 90,
    params: [
        { key: 'L', label: 'Dài (L)', def: 110 },
        { key: 'W', label: 'Rộng (W)', def: 110 },
        { key: 'H', label: 'Cao (H)', def: 70 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;
        
        // Hộp burger chia độ cao giữa đáy và nắp (đáy cao ~55%, nắp cao ~45%)
        var baseH = H * 0.55;
        var lidH = H * 0.45;
        var tuckH = C(lidH * 0.5, 12, 25);
        var dustW = C(baseH * 0.8, 15, W * 0.4);

        var B_WALL = [0.1, 0.4], B_LID = [0.4, 0.8], B_TUCK = [0.8, 1.0];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Đáy (Base Tray) đặt tại [0, 0] tới [L, W]
        var panels = [
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' },

            // Thành trước của đáy
            pn('front', 'base', [0, 0], [L, 0], [0, -1], P.rect(L, baseH), 88, B_WALL),

            // Thành trái của đáy
            pn('sideL', 'base', [0, W], [0, 0], [-1, 0], P.rect(W, baseH), 88, B_WALL),
            // Tai góc gài thành hông trái
            pn('dustFL', 'sideL', [-baseH, 0], [0, 0], [0, -1], P.dust(baseH, dustW), 88, [0.2, 0.45]),
            pn('dustBL', 'sideL', [0, W], [-baseH, W], [0, 1], P.dust(baseH, dustW), 88, [0.2, 0.45]),

            // Thành phải của đáy
            pn('sideR', 'base', [L, 0], [L, W], [1, 0], P.rect(W, baseH), 88, B_WALL),
            pn('dustFR', 'sideR', [L, 0], [L + baseH, 0], [0, -1], P.dust(baseH, dustW), 88, [0.2, 0.45]),
            pn('dustBR', 'sideR', [L + baseH, W], [L, W], [0, 1], P.dust(baseH, dustW), 88, [0.2, 0.45]),

            // Bản lề sau nối lên nắp (Hinge panel)
            pn('backHinge', 'base', [L, W], [0, W], [0, 1], P.rect(L, baseH), 88, B_WALL),

            // Nắp trên (Top Lid)
            pn('lidTop', 'backHinge', [L, W + baseH], [0, W + baseH], [0, 1], P.rect(L, W), 90, B_LID),

            // Vách trước của nắp
            pn('lidFront', 'lidTop', [0, W + baseH + W], [L, W + baseH + W], [0, 1], P.rect(L, lidH), 92, [0.65, 0.88]),
            // Lưỡi khóa gài vào thân trước
            pn('lidLockTab', 'lidFront', [0, W + baseH + W + lidH], [L, W + baseH + W + lidH], [0, 1], P.tuck(L, tuckH, 12), 85, B_TUCK),

            // 2 Vách hông của nắp úp xuống
            pn('lidSideL', 'lidTop', [0, W + baseH], [0, W + baseH + W], [-1, 0], P.dust(W, lidH), 92, [0.55, 0.85]),
            pn('lidSideR', 'lidTop', [L, W + baseH + W], [L, W + baseH], [1, 0], P.dust(W, lidH), 92, [0.55, 0.85])
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.2, -baseH], b: [L * 0.2, 0], label: H + ' mm' }
            ]
        };
    }
});
