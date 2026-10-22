/**
 * Mẫu: Hộp bánh Hamburger (Clamshell Burger Box) — gập liền thân, nắp úp song song đáy.
 *
 * Tham số L × W × H là KÍCH THƯỚC THÀNH PHẨM (không phải khổ trải).
 *   - Đáy vuông L×W là Root Panel nằm ngang trên sàn (y = 0).
 *   - 4 vách đáy là hình thang, gập lên α ≈ 78° (loe ra ngoài kiểu hộp burger).
 *   - Tai góc trên 2 vách hông gập ~90° ôm vào mặt trong vách trước/sau.
 *   - Vách lưng nắp nối từ mép trên vách lưng đáy, gập tiếp (180° − 2α) để thu vào trong,
 *     rồi Mặt đỉnh nắp gập tiếp α → tổng 180°: nắp úp ngang SONG SONG mặt đáy.
 *   - 3 vách nắp (trước, trái, phải) chúc xuống α, gặp vách đáy tại “eo” hộp.
 *   - Lưỡi gài phía trước cài vào trong vách trước của đáy.
 *
 * Hình học: chiều nghiêng mỗi nửa s = (H/2)/sin α ; độ loe d = s·cos α.
 */
PS3D.registerTemplate({
    id: 'burger-box',
    name: 'Hộp bánh Hamburger',
    nameEn: 'Burger Clamshell Box',
    group: 'Combo Đồ ăn nhanh',
    closedRotX: 90, // đáy nằm xuống sàn
    params: [
        { key: 'L', label: 'Dài (L)', def: 95 },
        { key: 'W', label: 'Rộng (W)', def: 95 },
        { key: 'H', label: 'Cao (H)', def: 70 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var F = PS3D.flap, C = PS3D.clamp;

        var ALPHA = 78;                                   // góc gập vách (độ)
        var aRad = ALPHA * Math.PI / 180;
        var s = (H / 2) / Math.sin(aRad);                 // chiều cao nghiêng 1 nửa hộp
        var d = s * Math.cos(aRad);                       // độ loe ngang
        var RELIEF = 180 - 2 * ALPHA;                     // góc gập vách lưng nắp (24°)
        var g = C(s * 0.42, 8, 18);                       // bề rộng tai góc
        var tuckH = C(s * 0.45, 10, 22);

        function pn(id, parent, a, b, out, prof, angle, stage, holes) {
            var o = { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
            if (holes) o.holes = holes;
            return o;
        }
        function trapOut(len) { return [[0, 0], [-d, s], [len + d, s], [len, 0]]; }   // loe rộng ra
        function trapIn(len) { return [[0, 0], [d, s], [len - d, s], [len, 0]]; }     // thu hẹp lại
        // Tai góc: điểm q0 = 0 nằm ở góc hộp, vát mạnh phía góc để không chồng lên vách kề trong khuôn 2D
        function cornerFlap(len) { return [[0, 0], [g * 0.75, g], [len - 2, g], [len, 0]]; }

        var edgeLen = Math.sqrt(s * s + d * d);
        var yLid = W + 2 * s;                             // mép dưới mặt đỉnh nắp
        var yLidTop = 2 * W + 2 * s;                      // mép trên mặt đỉnh nắp

        var S_FB = [0.0, 0.30], S_FLAP = [0.12, 0.32], S_SIDE = [0.25, 0.50];
        var S_LIDWALL = [0.30, 0.52], S_LIDFLAP = [0.30, 0.48], S_TAB = [0.40, 0.56];
        var S_LIDBACK = [0.55, 0.72], S_LIDTOP = [0.62, 1.0];

        var panels = [
            // ── ĐÁY (root) ──
            { id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' },

            // ── 4 vách đáy hình thang ──
            pn('front', 'base', [0, 0], [L, 0], [0, -1], trapOut(L), ALPHA, S_FB),
            pn('back', 'base', [L, W], [0, W], [0, 1], trapOut(L), ALPHA, S_FB),
            pn('sideL', 'base', [0, W], [0, 0], [-1, 0], trapOut(W), ALPHA, S_SIDE),
            pn('sideR', 'base', [L, 0], [L, W], [1, 0], trapOut(W), ALPHA, S_SIDE),

            // Tai góc trên vách hông (ôm vào trong vách trước/sau)
            pn('cFL', 'sideL', [0, 0], [-s, -d], [0, -1], cornerFlap(edgeLen), 90, S_FLAP),
            pn('cBL', 'sideL', [0, W], [-s, W + d], [0, 1], cornerFlap(edgeLen), 90, S_FLAP),
            pn('cFR', 'sideR', [L, 0], [L + s, -d], [0, -1], cornerFlap(edgeLen), 90, S_FLAP),
            pn('cBR', 'sideR', [L, W], [L + s, W + d], [0, 1], cornerFlap(edgeLen), 90, S_FLAP),

            // ── NẮP ──
            // Vách lưng nắp: nối mép trên vách lưng đáy, thu vào trong (180 − 2α)
            pn('lidBack', 'back', [L + d, W + s], [-d, W + s], [0, 1], trapIn(L + 2 * d), RELIEF, S_LIDBACK),
            // Mặt đỉnh nắp: gập tiếp α → song song mặt đáy
            pn('lidTop', 'lidBack', [L, yLid], [0, yLid], [0, 1], [[0, 0], [0, W], [L, W], [L, 0]], ALPHA, S_LIDTOP),
            // 3 vách nắp chúc xuống
            pn('lidFront', 'lidTop', [0, yLidTop], [L, yLidTop], [0, 1], trapOut(L), ALPHA, S_LIDWALL),
            pn('lidL', 'lidTop', [0, yLidTop], [0, yLid], [-1, 0], trapOut(W), ALPHA, S_LIDWALL),
            pn('lidR', 'lidTop', [L, yLid], [L, yLidTop], [1, 0], trapOut(W), ALPHA, S_LIDWALL),
            // Tai góc nắp phía trước
            pn('lcFL', 'lidL', [0, yLidTop], [-s, yLidTop + d], [0, 1], cornerFlap(edgeLen), 90, S_LIDFLAP),
            pn('lcFR', 'lidR', [L, yLidTop], [L + s, yLidTop + d], [0, 1], cornerFlap(edgeLen), 90, S_LIDFLAP),
            // Lưỡi gài: gập vào trong để cài sau vách trước của đáy
            pn('tab', 'lidFront', [L * 0.18, yLidTop + s], [L * 0.82, yLidTop + s], [0, 1],
                PS3D.profiles.tuck(L * 0.64, tuckH, 6, false), RELIEF + 8, S_TAB)
        ];

        return {
            panels: panels,
            meta: { L: L, W: W, H: H, templateId: 'burger-box', alpha: ALPHA },
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.25, -s], b: [L * 0.25, 0], label: (H / 2).toFixed(1) + ' mm (½H)' }
            ]
        };
    }
});
