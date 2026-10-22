/**
 * Mẫu: Hộp gài cùng chiều — Straight Tuck End (STE)
 * Nắp trên và nắp đáy cùng gắn vào mặt 1; tai bụi trên/dưới gắn mặt 2 và 4.
 */
PS3D.registerTemplate({
    id: 'straight-tuck',
    name: 'Hộp gài cùng chiều',
    nameEn: 'Straight Tuck End',
    group: 'Hộp gài',
    params: [
        { key: 'L', label: 'Dài (L)', def: 60 },
        { key: 'W', label: 'Rộng (W)', def: 40 },
        { key: 'H', label: 'Cao (H)', def: 120 },
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

        return {
            panels: [
                { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front' },
                pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, BODY),
                pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, BODY),
                pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, BODY),
                pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, BODY),

                pn('botDust2', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, dustH), 92, [0.42, 0.54]),
                pn('botDust4', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, dustH), 92, [0.42, 0.54]),
                pn('botLid', 'p1', [0, 0], [L, 0], [0, -1], P.rect(L, W), 90, [0.5, 0.62]),
                pn('botTuck', 'botLid', [0, -W], [L, -W], [0, -1], P.tuck(L, tuckH, 8), 94, [0.6, 0.7]),

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
