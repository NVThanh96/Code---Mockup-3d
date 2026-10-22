/**
 * Mẫu: Hộp bánh sinh nhật (Cake Box with Window & Interlocking Handle)
 * Cấu trúc gồm:
 *   - 4 vách thân chính: Mặt trước (p1 có cửa sổ kính / window cutout), Hông phải (p2), Mặt sau (p3), Hông trái (p4)
 *   - Cửa sổ kính mica/trong suốt (Window Hole) đục thật ở mặt trước bằng THREE.Shape.holes
 *   - Đáy hộp: 4 cánh nắp so le (2 cánh phụ 89°, 2 cánh chính 90°)
 *   - Mái & Quai xách đỉnh: 2 cánh mái nghiêng góc θ = arcsin((W/2)/H_roof), 2 quai xách bẻ ngược -θ đứng thẳng
 *   - Lỗ đục xỏ tay (Handle Cutout) trên cả 2 quai xách
 *   - 2 cánh tai bụi hông (Top Dust Flaps) gập chốt giữ bánh
 */
PS3D.registerTemplate({
    id: 'cake-box',
    name: 'Hộp bánh sinh nhật',
    nameEn: 'Birthday Cake Box with Window',
    group: 'Hộp gài',
    closedRotX: 0, // Hộp đứng thẳng Y hướng lên
    params: [
        { key: 'L', label: 'Dài (L)', def: 260 },
        { key: 'W', label: 'Rộng (W)', def: 260 },
        { key: 'H', label: 'Cao thân (H)', def: 180 },
        { key: 'G', label: 'Mép dán', def: 18 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G || 18;
        var P = PS3D.profiles, F = PS3D.flap, C = PS3D.clamp;

        // Chiều cao mái và chiều cao quai xách
        var H_roof = C(W * 0.62, 40, 150);
        var H_handle = C(H * 0.35, 35, 65);
        var botH = C(W * 0.52, 30, 140);

        // Tính góc nghiêng mái vào tâm (θ) sao cho 2 quai chạm nhau đúng ở tâm z = -W/2
        var sinTheta = Math.min(0.95, (W / 2) / H_roof);
        var thetaDeg = Math.asin(sinTheta) * 180 / Math.PI;

        var x1 = L, x2 = L + W, x3 = 2 * L + W, x4 = 2 * L + 2 * W;

        function pn(id, parent, a, b, out, prof, angle, stage, holes) {
            var item = { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
            if (holes && holes.length > 0) item.holes = holes;
            return item;
        }

        // Tạo lỗ tròn bo góc cho cửa sổ mặt trước
        function makeWindowHole(L_box, H_box) {
            var winW = Math.min(L_box - 40, L_box * 0.66);
            var winH = Math.min(H_box - 40, H_box * 0.60);
            var x0 = (L_box - winW) / 2;
            var y0 = (H_box - winH) / 2;
            var r = Math.min(18, Math.min(winW, winH) / 4);

            var pts = [];
            pts.push([x0 + r, y0]);
            pts.push([x0 + winW - r, y0]);
            PS3D.arc(pts, x0 + winW - r, y0 + r, r, -Math.PI / 2, 0, 5);
            pts.push([x0 + winW, y0 + winH - r]);
            PS3D.arc(pts, x0 + winW - r, y0 + winH - r, r, 0, Math.PI / 2, 5);
            pts.push([x0 + r, y0 + winH]);
            PS3D.arc(pts, x0 + r, y0 + winH - r, r, Math.PI / 2, Math.PI, 5);
            pts.push([x0, y0 + r]);
            PS3D.arc(pts, x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 5);
            return pts;
        }

        // Tạo lỗ luồn tay trên quai xách
        function makeHandleSlot(ox, oy, w, h, r) {
            r = Math.min(r || 8, Math.min(w, h) / 2 - 1);
            var x0 = ox + (L - w) / 2;
            var y0 = oy + (H_handle - h) / 2;
            var pts = [];
            pts.push([x0 + r, y0]);
            pts.push([x0 + w - r, y0]);
            PS3D.arc(pts, x0 + w - r, y0 + r, r, -Math.PI / 2, 0, 4);
            pts.push([x0 + w, y0 + h - r]);
            PS3D.arc(pts, x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, 4);
            pts.push([x0 + r, y0 + h]);
            PS3D.arc(pts, x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, 4);
            pts.push([x0, y0 + r]);
            PS3D.arc(pts, x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 4);
            return pts;
        }

        // Profile quai xách đỉnh bo góc
        function handleProfile(w, h, r) {
            r = r || 12;
            var pts = [[0, 0]];
            pts.push([0, h - r]);
            PS3D.arc(pts, r, h - r, r, Math.PI, Math.PI / 2, 4);
            pts.push([w - r, h]);
            PS3D.arc(pts, w - r, h - r, r, Math.PI / 2, 0, 4);
            pts.push([w, 0]);
            return pts;
        }

        // Cửa sổ kính mặt trước
        var winHole = makeWindowHole(L, H);

        var frontHandleProf = handleProfile(L, H_handle, 12);
        var backHandleProf = handleProfile(L, H_handle, 12);
        var handleHoleF = makeHandleSlot(0, H + H_roof, Math.min(100, L * 0.45), 24, 8);
        var handleHoleB = makeHandleSlot(0, H + H_roof, Math.min(100, L * 0.45), 24, 8);

        var panels = [
            // 1. Mặt trước (p1) — có lỗ cửa sổ
            { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front', holes: [winHole] },

            // Mép dán bên trái
            pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, [0.0, 0.4]),

            // 2. Hông phải (p2)
            pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, [0.0, 0.4]),

            // 3. Mặt sau (p3)
            pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, [0.0, 0.4]),

            // 4. Hông trái (p4)
            pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, [0.0, 0.4]),

            // ── CÁC CÁNH NẮP ĐÁY ──
            // Cánh phụ hông p2 & p4: gập 89° trước (tránh z-fighting)
            pn('bot_dust_r', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, botH * 0.85), 89, [0.35, 0.55]),
            pn('bot_dust_l', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, botH * 0.85), 89, [0.35, 0.55]),

            // Cánh chính p1 & p3: gập 90°
            pn('bot_f', 'p1', [0, 0], [x1, 0], [0, -1], P.rect(L, botH), 90, [0.55, 0.75]),
            pn('bot_b', 'p3', [x2, 0], [x3, 0], [0, -1], P.rect(L, botH), 90, [0.55, 0.75]),

            // ── CÁC TAI BỤI TRÊN CỦA 2 HÔNG (Dust Flaps) ──
            pn('top_dust_r', 'p2', [x2, H], [x1, H], [0, 1], P.dust(W, botH * 0.6), 88, [0.65, 0.85]),
            pn('top_dust_l', 'p4', [x4, H], [x3, H], [0, 1], P.dust(W, botH * 0.6), 88, [0.65, 0.85]),

            // ── MÁI CHÓP & QUAI XÁCH (Interlocking Roof & Handle) ──
            // Mái trước (Roof Front): nghiêng vào góc thetaDeg
            pn('roof_f', 'p1', [x1, H], [0, H], [0, 1], P.rect(L, H_roof), thetaDeg, [0.65, 0.88]),

            // Quai xách trước: gắn trên đỉnh mái trước, bẻ ngược -thetaDeg để đứng thẳng
            pn('handle_f', 'roof_f', [0, H + H_roof], [x1, H + H_roof], [0, 1], frontHandleProf, -thetaDeg, [0.65, 0.88], [handleHoleF]),

            // Mái sau (Roof Back): nghiêng vào góc thetaDeg
            pn('roof_b', 'p3', [x3, H], [x2, H], [0, 1], P.rect(L, H_roof), thetaDeg, [0.72, 0.95]),

            // Quai xách sau: gắn trên đỉnh mái sau, bẻ ngược -thetaDeg để đứng thẳng
            pn('handle_b', 'roof_b', [x2, H + H_roof], [x3, H + H_roof], [0, 1], backHandleProf, -thetaDeg, [0.72, 0.95], [handleHoleB])
        ];

        return {
            panels: panels,
            meta: { L: L, W: W, H: H, templateId: 'cake-box', H_roof: H_roof, H_handle: H_handle }
        };
    }
});
