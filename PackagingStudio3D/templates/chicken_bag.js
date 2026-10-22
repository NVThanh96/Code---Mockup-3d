/**
 * Mẫu: Túi giấy đựng gà rán / Fast Food Pinch Bag
 * Túi giấy kraft thấm dầu đáy xếp vuông vức:
 *   - 4 vách thân chính: Mặt trước (p1), Hông phải (p2), Mặt sau (p3), Hông trái (p4)
 *   - Mép dán bên sườn
 *   - Đáy túi gập dán phong bì (Envelope pinch bottom)
 *   - Miệng túi có mép gấp niêm phong
 */
PS3D.registerTemplate({
    id: 'chicken-bag',
    name: 'Túi đựng gà rán',
    nameEn: 'Fried Chicken Paper Bag',
    group: 'Túi giấy',
    closedRotX: 0, // Túi đứng thẳng trên sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 200 },
        { key: 'W', label: 'Rộng (W)', def: 100 },
        { key: 'H', label: 'Cao (H)', def: 280 },
        { key: 'G', label: 'Mép dán', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G || 15;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;
        var botH = W * 0.75;
        var topRimH = 25;
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

            // Đáy túi dán phong bì
            pn('botSide2', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, botH * 0.6), 89, [0.35, 0.55]),
            pn('botSide4', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, botH * 0.6), 89, [0.35, 0.55]),
            pn('botMain1', 'p1', [0, 0], [L, 0], [0, -1], P.glue(L, botH, botH * 0.4), 90, [0.55, 0.72]),
            pn('botMain3', 'p3', [x2, 0], [x3, 0], [0, -1], P.glue(L, botH, botH * 0.4), 90, [0.55, 0.72]),

            // Mép bẻ miệng túi niêm phong
            pn('topFold1', 'p1', [0, H], [L, H], [0, 1], P.rect(L, topRimH), 120, [0.75, 0.95]),
            pn('topFold3', 'p3', [x2, H], [x3, H], [0, 1], P.rect(L, topRimH), 120, [0.75, 0.95])
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
