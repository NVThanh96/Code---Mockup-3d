/**
 * Mẫu: Hộp gập đáy khóa gài / FEFCO 0427 / Hộp Pizza / Mailer Box
 * (Roll End Tuck Top / Mailer Box with Dust Flaps)
 * Thân hộp gồm: Đáy (base), nắp gập liền (lid), 2 tai khóa nắp (lid wings/flaps),
 * 2 vách hông đôi (roll-over double sidewalls), vách trước có khe gài.
 */
PS3D.registerTemplate({
    id: 'mailer-box',
    name: 'Hộp Mailer / Hộp Pizza',
    nameEn: 'Mailer Box (FEFCO 0427)',
    group: 'Hộp dẹp / Ship',
    closedRotX: 90, // Đáy nằm phẳng trên sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 180 },
        { key: 'W', label: 'Rộng (W)', def: 120 },
        { key: 'H', label: 'Cao (H)', def: 50 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;
        var tuckH = C(H * 0.75, 15, 35);
        var dustW = C(H * 0.85, 15, W * 0.45);
        var B_WALL = [0.1, 0.45], B_ROLL = [0.45, 0.75], B_LID = [0.75, 0.95], B_TUCK = [0.90, 1.0];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Base đặt tại x ∈ [0, L], y ∈ [0, W]
        var panels = [
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' },

            // Vách trước (front wall) gắn tại y = 0
            pn('front', 'base', [0, 0], [L, 0], [0, -1], P.rect(L, H), 90, B_WALL),
            // Mép gập cuộn trong của vách trước
            pn('frontRoll', 'front', [0, -H], [L, -H], [0, -1], P.rect(L, H * 0.85), 90, B_ROLL),

            // Vách sau (back wall) gắn tại y = W
            pn('back', 'base', [L, W], [0, W], [0, 1], P.rect(L, H), 90, B_WALL),
            // Tai góc vách sau gập vào hông
            pn('backDustL', 'back', [0, W], [0, W + H], [-1, 0], P.dust(H, dustW), 92, [0.35, 0.6]),
            pn('backDustR', 'back', [L, W + H], [L, W], [1, 0], P.dust(H, dustW), 92, [0.35, 0.6]),

            // Nắp hộp (lid) gắn tiếp vào đỉnh vách sau tại y = W + H
            pn('lid', 'back', [L, W + H], [0, W + H], [0, 1], P.rect(L, W), 90, B_LID),
            // Lưỡi gài trước của nắp
            pn('lidTuck', 'lid', [0, 2 * W + H], [L, 2 * W + H], [0, 1], P.tuck(L, tuckH, 10), 92, B_TUCK),
            // 2 tai gập hông của nắp (lid side flaps)
            pn('lidFlapL', 'lid', [0, W + H], [0, 2 * W + H], [-1, 0], P.dust(W, H * 0.85), 90, [0.78, 0.94]),
            pn('lidFlapR', 'lid', [L, 2 * W + H], [L, W + H], [1, 0], P.dust(W, H * 0.85), 90, [0.78, 0.94]),

            // Vách hông trái (outer left) gắn tại x = 0 của base
            pn('sideL', 'base', [0, W], [0, 0], [-1, 0], P.rect(W, H), 90, B_WALL),
            // Vách cuộn trong hông trái (roll-over inner flap)
            pn('sideLRoll', 'sideL', [-H, W], [-H, 0], [-1, 0], P.rect(W, H * 0.95), 90, B_ROLL),

            // Vách hông phải (outer right) gắn tại x = L của base
            pn('sideR', 'base', [L, 0], [L, W], [1, 0], P.rect(W, H), 90, B_WALL),
            // Vách cuộn trong hông phải
            pn('sideRRoll', 'sideR', [L + H, 0], [L + H, W], [1, 0], P.rect(W, H * 0.95), 90, B_ROLL)
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.2, -H], b: [L * 0.2, 0], label: H + ' mm' }
            ]
        };
    }
});
