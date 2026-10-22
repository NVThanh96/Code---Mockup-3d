/**
 * Mẫu: Hộp đựng khoai tây chiên / Gà nugget (French Fries Scoop Box)
 * Dạng khay xúc mở miệng:
 *   - Đáy hộp (base): kích thước L_base x W
 *   - Vách trước (Front): thấp, viền trên uốn cong lượn sóng
 *   - Vách sau (Back): cao vút, đỉnh uốn cong vát đặc trưng
 *   - 2 Vách hông (Sides): vát xéo nối từ vách trước thấp lên vách sau cao
 */
PS3D.registerTemplate({
    id: 'fries-box',
    name: 'Hộp đựng khoai tây chiên',
    nameEn: 'French Fries Scoop Box',
    group: 'Hộp dẹp / Ship',
    closedRotX: 90, // Đáy nằm phẳng trên sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 85 },
        { key: 'W', label: 'Rộng đáy (W)', def: 50 },
        { key: 'H', label: 'Cao lưng sau (H)', def: 110 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var F = PS3D.flap, C = PS3D.clamp;

        var frontH = H * 0.62; // Vách trước thấp hơn vách sau
        var baseL = L * 0.85; // Đáy hơi thon hơn miệng trên

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        // Profile vách trước có đường cong lượn sóng
        var frontProf = (function () {
            var pts = [[0, 0]];
            pts.push([-(L - baseL) / 2, frontH]);
            // Cong lượn võng ở giữa
            pts.push([baseL / 2, frontH - 12]);
            pts.push([baseL + (L - baseL) / 2, frontH]);
            pts.push([baseL, 0]);
            return pts;
        })();

        // Profile vách sau cao có đỉnh cong vòm
        var backProf = (function () {
            var pts = [[0, 0]];
            pts.push([baseL, 0]);
            pts.push([baseL + (L - baseL) / 2, H - 15]);
            PS3D.arc(pts, baseL / 2, H - 20, baseL * 0.5, 0.2, Math.PI - 0.2, 8);
            pts.push([-(L - baseL) / 2, H - 15]);
            return pts;
        })();

        // Profile 2 vách hông vát xéo nối từ frontH lên H
        var sideLProf = [
            [0, 0], [W, 0], [W, H - 15], [0, frontH]
        ];
        var sideRProf = [
            [0, 0], [0, frontH], [W, H - 15], [W, 0]
        ];

        var panels = [
            // Đáy hộp (Base)
            { id: 'base', poly: PS3D.rect(0, 0, baseL, W), face: 'bottom' },

            // Vách trước thấp
            pn('front', 'base', [0, 0], [baseL, 0], [0, -1], frontProf, 82, [0.1, 0.65]),

            // Vách sau cao
            pn('back', 'base', [baseL, W], [0, W], [0, 1], backProf, 84, [0.1, 0.65]),

            // Vách hông trái
            pn('sideL', 'base', [0, W], [0, 0], [-1, 0], sideLProf, 85, [0.2, 0.75]),

            // Vách hông phải
            pn('sideR', 'base', [baseL, 0], [baseL, W], [1, 0], sideRProf, 85, [0.2, 0.75])
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, W / 2], b: [baseL, W / 2], label: L + ' mm' },
                { a: [baseL / 2, 0], b: [baseL / 2, W], label: W + ' mm' },
                { a: [baseL / 2, W], b: [baseL / 2, W + H], label: H + ' mm' }
            ]
        };
    }
});
