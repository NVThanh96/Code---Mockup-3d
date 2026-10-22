/**
 * Mẫu: Đáy / Nắp hộp Âm Dương vách đôi (Rollover Double-Wall Tray)
 *
 * L × W × H là kích thước THÀNH PHẨM (vd Đáy 370×300×70, Nắp 375×305×40).
 * Mặt lớn trung tâm L×W là Root Panel nằm ngang trên sàn.
 * Mỗi cạnh gồm chuỗi gân gấp liên tiếp:
 *   1. Vách ngoài (cao H)        : +90° dựng đứng
 *   2. Gờ miệng (dày T)          : +90° gập ngang vào trong
 *   3. Vách lót trong (cao H−1)  : +90° chúc xuống, song song vách ngoài
 *   4. Chân khóa (foot)          : gập nằm áp sát mặt sàn, hướng vào tâm hộp
 * Tai góc trên vách trước/sau gập 92° kẹp vào GIỮA 2 lớp vách hông.
 * Gờ miệng vát 45° ở 2 đầu (mitre) để 4 góc khít, không chồng giấy.
 */
PS3D.registerTemplate({
    id: 'double-wall-tray',
    name: 'Đáy / Nắp hộp Âm Dương (vách đôi)',
    nameEn: 'Rollover Double-Wall Tray (Lid & Base)',
    group: 'Bộ hộp Âm Dương Kèm túi',
    closedRotX: 90,
    params: [
        { key: 'L', label: 'Dài (L)', def: 370 },
        { key: 'W', label: 'Rộng (W)', def: 300 },
        { key: 'H', label: 'Cao (H)', def: 70 },
        { key: 'T', label: 'Dày vách (T)', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H;
        var C = PS3D.clamp, F = PS3D.flap;
        var T = C(p.T || 15, 4, Math.min(L, W) * 0.15);
        var Hin = Math.max(5, H - 1);                     // vách lót thấp hơn 1mm để chân khóa không trùng mặt đáy
        var foot = C(T * 1.2, 8, 25);                     // chân khóa
        var fw = C(Math.min(W * 0.3, H * 0.8), 10, 45);   // bề rộng tai góc

        var S_FB = [0.0, 0.25], S_CORNER = [0.10, 0.30], S_SIDE = [0.28, 0.50];
        var S_RIM = [0.50, 0.66], S_INNER = [0.64, 0.85], S_FOOT = [0.84, 1.0];

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }
        function rect(len, h) { return [[0, 0], [0, h], [len, h], [len, 0]]; }
        function mitre(len, h) { return [[0, 0], [h, h], [len - h, h], [len, 0]]; }
        function footProf(len) { return [[0, 0], [3, foot], [len - 3, foot], [len, 0]]; }
        function cornerProf(len) { return [[0, 0], [3, fw], [len - 3, fw], [len, 0]]; }

        // Sinh chuỗi 4 tấm cho 1 cạnh. a0→b0 là bản lề với mặt đáy, n là pháp tuyến hướng ra ngoài.
        function side(tag, a0, b0, n, stOuter) {
            var len = Math.sqrt(Math.pow(b0[0] - a0[0], 2) + Math.pow(b0[1] - a0[1], 2));
            var ux = (b0[0] - a0[0]) / len, uy = (b0[1] - a0[1]) / len;
            function at(along, outDist) {
                return [a0[0] + ux * along + n[0] * outDist, a0[1] + uy * along + n[1] * outDist];
            }
            return [
                pn(tag + '_outer', 'base', a0, b0, n, rect(len, H), 90, stOuter),
                pn(tag + '_rim', tag + '_outer', at(0, H), at(len, H), n, mitre(len, T), 90, S_RIM),
                pn(tag + '_inner', tag + '_rim', at(T, H + T), at(len - T, H + T), n, rect(len - 2 * T, Hin), 90, S_INNER),
                pn(tag + '_foot', tag + '_inner', at(T, H + T + Hin), at(len - T, H + T + Hin), n, footProf(len - 2 * T), -90, S_FOOT)
            ];
        }

        var panels = [{ id: 'base', poly: PS3D.rect(0, 0, L, W), face: 'bottom' }];
        panels = panels
            .concat(side('front', [0, 0], [L, 0], [0, -1], S_FB))
            .concat(side('back', [L, W], [0, W], [0, 1], S_FB))
            .concat(side('left', [0, W], [0, 0], [-1, 0], S_SIDE))
            .concat(side('right', [L, 0], [L, W], [1, 0], S_SIDE));

        // Tai góc trên vách ngoài trước/sau → kẹp giữa 2 lớp vách hông
        panels.push(
            pn('cFL', 'front_outer', [0, -H], [0, 0], [-1, 0], cornerProf(H), 92, S_CORNER),
            pn('cFR', 'front_outer', [L, 0], [L, -H], [1, 0], cornerProf(H), 92, S_CORNER),
            pn('cBL', 'back_outer', [0, W], [0, W + H], [-1, 0], cornerProf(H), 92, S_CORNER),
            pn('cBR', 'back_outer', [L, W + H], [L, W], [1, 0], cornerProf(H), 92, S_CORNER)
        );

        return {
            panels: panels,
            meta: { L: L, W: W, H: H, T: T, templateId: 'double-wall-tray' },
            dims: [
                { a: [0, W / 2], b: [L, W / 2], label: L + ' mm' },
                { a: [L / 2, 0], b: [L / 2, W], label: W + ' mm' },
                { a: [L * 0.25, -H], b: [L * 0.25, 0], label: H + ' mm' }
            ]
        };
    }
});
