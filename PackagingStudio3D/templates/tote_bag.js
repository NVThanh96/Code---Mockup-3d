/**
 * Mẫu: Túi giấy Kraft (Paper Tote Bag)
 * Đáy gấp vuông vắn, 2 mặt chính trước/sau, 2 hông có nếp gấp xếp sâu vào trong.
 * Đường link người dùng gửi: https://www.pacdora.com/fr/dielines-detail/custom-dimensions-tote-bags-craft-paper-tote-dieline-220010
 */
PS3D.registerTemplate({
    id: 'tote-bag',
    name: 'Túi giấy Kraft (Tote Bag)',
    nameEn: 'Kraft Paper Tote Bag',
    group: 'Túi giấy',
    params: [
        { key: 'L', label: 'Dài (L)', def: 150 },
        { key: 'W', label: 'Rộng (W)', def: 70 },
        { key: 'H', label: 'Cao (H)', def: 200 },
        { key: 'G', label: 'Mép dán', def: 15 }
    ],
    build: function (p) {
        var L = p.L, W = p.W, H = p.H, G = p.G;
        var P = PS3D.profiles, F = PS3D.flap;
        var x1 = L, x2 = L + W, x3 = 2 * L + W, x4 = 2 * L + 2 * W;
        var topFoldH = 20; // Mép gập miệng túi vào trong tạo độ cứng
        var botH = W * 0.75; // Đáy túi xếp

        function pn(id, parent, a, b, out, prof, angle, stage) {
            return { id: id, parent: parent, hinge: [a, b], poly: F(a, b, out, prof), angle: angle, stage: stage };
        }

        var panels = [
            { id: 'p1', poly: PS3D.rect(0, 0, L, H), face: 'front' },
            pn('glue', 'p1', [0, 0], [0, H], [-1, 0], P.glue(H, G), 92, [0, 0.4]),
            pn('p2', 'p1', [x1, 0], [x1, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),
            pn('p3', 'p2', [x2, 0], [x2, H], [1, 0], P.rect(H, L), 90, [0, 0.4]),
            pn('p4', 'p3', [x3, 0], [x3, H], [1, 0], P.rect(H, W), 90, [0, 0.4]),

            // Mép bẻ miệng túi (Top rim turn-over)
            pn('topRim1', 'p1', [0, H], [L, H], [0, 1], P.rect(L, topFoldH), 175, [0.1, 0.35]),
            pn('topRim2', 'p2', [x1, H], [x2, H], [0, 1], P.rect(W, topFoldH), 175, [0.1, 0.35]),
            pn('topRim3', 'p3', [x2, H], [x3, H], [0, 1], P.rect(L, topFoldH), 175, [0.1, 0.35]),
            pn('topRim4', 'p4', [x4, H], [x3, H], [0, 1], P.rect(W, topFoldH), 175, [0.1, 0.35]),

            // Đáy túi (Bottom envelope fold)
            pn('botBase1', 'p1', [0, 0], [L, 0], [0, -1], P.glue(L, botH, botH * 0.45), 90, [0.45, 0.75]),
            pn('botBase3', 'p3', [x2, 0], [x3, 0], [0, -1], P.glue(L, botH, botH * 0.45), 90, [0.45, 0.75]),
            pn('botSide2', 'p2', [x1, 0], [x2, 0], [0, -1], P.dust(W, botH * 0.6), 92, [0.4, 0.65]),
            pn('botSide4', 'p4', [x4, 0], [x3, 0], [0, -1], P.dust(W, botH * 0.6), 92, [0.4, 0.65])
        ];

        return {
            panels: panels,
            dims: [
                { a: [0, H * 0.5], b: [L, H * 0.5], label: L + ' mm' },
                { a: [x1, H * 0.5], b: [x2, H * 0.5], label: W + ' mm' },
                { a: [x2 + L / 2, 0], b: [x2 + L / 2, H], label: H + ' mm' }
            ],
            // Quai xách xoắn giấy chuẩn Pacdora model 220010
            extras: function (THREE, ctx) {
                var handleGroup = new THREE.Group();
                var handleMat = new THREE.MeshStandardMaterial({
                    color: 0x9b784a,
                    roughness: 0.85,
                    metalness: 0.05
                });

                var handleW = L * 0.44;
                var handleH = Math.min(H * 0.42, 90);
                var curveRadius = 2.4;

                // Quai trước (gắn vào mặt p1 ở Z ~ 0) & Quai sau (gắn vào mặt p3 ở Z ~ -W)
                var midX = L / 2;
                var frontZ = -0.6;
                var backZ = -W + 0.6;

                [frontZ, backZ].forEach(function (zPos, idx) {
                    var pts = [
                        new THREE.Vector3(midX - handleW / 2, H - 12, zPos),
                        new THREE.Vector3(midX - handleW / 2, H + handleH * 0.4, zPos),
                        new THREE.Vector3(midX - handleW * 0.35, H + handleH, zPos),
                        new THREE.Vector3(midX, H + handleH * 1.08, zPos),
                        new THREE.Vector3(midX + handleW * 0.35, H + handleH, zPos),
                        new THREE.Vector3(midX + handleW / 2, H + handleH * 0.4, zPos),
                        new THREE.Vector3(midX + handleW / 2, H - 12, zPos)
                    ];
                    var curve = new THREE.CatmullRomCurve3(pts);
                    var tubeGeo = new THREE.TubeGeometry(curve, 32, curveRadius, 8, false);
                    var mesh = new THREE.Mesh(tubeGeo, handleMat);
                    mesh.castShadow = true;
                    handleGroup.add(mesh);

                    // 2 miếng dán chân quai bên trong
                    [midX - handleW / 2, midX + handleW / 2].forEach(function (xPos) {
                        var patchGeo = new THREE.PlaneGeometry(16, 22);
                        var patch = new THREE.Mesh(patchGeo, handleMat);
                        patch.position.set(xPos, H - 8, zPos + (idx === 0 ? -0.4 : 0.4));
                        if (idx !== 0) patch.rotation.y = Math.PI;
                        handleGroup.add(patch);
                    });
                });

                return handleGroup;
            }
        };
    }
});
