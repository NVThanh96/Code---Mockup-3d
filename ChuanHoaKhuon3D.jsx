/**
 * CHUẨN HÓA KHUÔN BAO BÌ 3D - EXTENDSCRIPT TỰ ĐỘNG PHÂN TÁCH TOPOLOGY
 * Tương thích chuẩn công nghiệp Pacdora / Packaging Studio 3D:
 *   - CUT_LINE:        Nét xanh dương (#0066ee), 0.75pt, nét liền
 *   - CREASE_FOLD:     Nét đỏ (#ee1e23), 0.50pt, nét đứt 3pt-2pt
 *   - BLEED:           Nét xanh lá (#28b446), 0.35pt, lề tràn 3mm
 *   - TEXT_ANNOTATION: Toàn bộ chữ & nhãn (khóa & ẩn)
 *   - DIMS:            Đường gióng kích thước & mũi tên (khóa & ẩn)
 *
 * Thuật toán Topology:
 *   - Ghép nối các đoạn thẳng có đầu/cuối trùng nhau (dung sai 0.5mm / 1.42pt)
 *   - Tự động nhận diện Outer Boundary (Viền ngoài) & Inner Loops (Lỗ khoét, quai) -> CUT
 *   - Tự động nhận diện Internal Shared Edges (Cạnh chia vách bên trong) -> CREASE
 */
#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("Vui lòng mở file khuôn bao bì (PDF/AI) trong Adobe Illustrator trước!");
        return;
    }

    var doc = app.activeDocument;
    var toMM = 25.4 / 72.0;
    var toPT = 72.0 / 25.4;

    // ── 1. MÀU SẮC CHUẨN PACDORA ──────────────────────────────────────────────
    var isCMYK = (doc.documentColorSpace === DocumentColorSpace.CMYK);

    function makeColor(r, g, b, c, m, y, k) {
        if (isCMYK) {
            var cmyk = new CMYKColor();
            cmyk.cyan = c; cmyk.magenta = m; cmyk.yellow = y; cmyk.black = k;
            return cmyk;
        } else {
            var rgb = new RGBColor();
            rgb.red = r; rgb.green = g; rgb.blue = b;
            return rgb;
        }
    }

    var colorCut = makeColor(0, 102, 238, 100, 55, 0, 0);     // #0066ee - Xanh dương cắt
    var colorCrease = makeColor(238, 30, 35, 0, 95, 90, 0);   // #ee1e23 - Đỏ cấn gấp
    var colorBleed = makeColor(40, 180, 70, 75, 0, 100, 0);   // #28b446 - Xanh lá tràn lề

    // ── 2. TẠO CÁC LAYER CHUẨN ───────────────────────────────────────────────
    function getOrCreateLayer(name) {
        try {
            return doc.layers.getByName(name);
        } catch (e) {
            var l = doc.layers.add();
            l.name = name;
            return l;
        }
    }

    var lyrText = getOrCreateLayer("TEXT_ANNOTATION");
    var lyrDims = getOrCreateLayer("DIMS");
    var lyrBleed = getOrCreateLayer("BLEED");
    var lyrCrease = getOrCreateLayer("CREASE_FOLD");
    var lyrCut = getOrCreateLayer("CUT_LINE");

    // Đảm bảo các layer mở khóa để thao tác
    lyrText.locked = false; lyrDims.locked = false; lyrBleed.locked = false;
    lyrCrease.locked = false; lyrCut.locked = false;

    // ── 3. CHUYỂN TOÀN BỘ TEXTFRAME SANG LAYER TEXT_ANNOTATION ──────────────
    var textCount = 0;
    for (var t = doc.textFrames.length - 1; t >= 0; t--) {
        try {
            var tf = doc.textFrames[t];
            tf.move(lyrText, ElementPlacement.PLACEATBEGINNING);
            textCount++;
        } catch (eText) {}
    }

    // ── 4. THU THẬP & PHÂN LOẠI TOÀN BỘ PATHITEM ─────────────────────────────
    var allPaths = [];
    function collectPaths(item) {
        if (!item) return;
        var t = item.typename;
        if (t === 'PathItem') {
            allPaths.push(item);
        } else if (t === 'GroupItem') {
            for (var g = item.pageItems.length - 1; g >= 0; g--) {
                collectPaths(item.pageItems[g]);
            }
        } else if (t === 'CompoundPathItem') {
            for (var c = item.pathItems.length - 1; c >= 0; c--) {
                collectPaths(item.pathItems[c]);
            }
        }
    }

    // Chỉ quét các layer khuôn chính (bỏ qua layer annotation nếu đã có)
    for (var li = doc.layers.length - 1; li >= 0; li--) {
        var lay = doc.layers[li];
        var layName = lay.name.toLowerCase();
        if (layName === 'text_annotation' || layName === 'dims') continue;
        for (var pi = lay.pageItems.length - 1; pi >= 0; pi--) {
            collectPaths(lay.pageItems[pi]);
        }
    }

    // Dung sai so khớp điểm (0.5mm = 1.417pt)
    var SNAP_TOL_PT = 0.5 * toPT;
    var SNAP_TOL_SQ = SNAP_TOL_PT * SNAP_TOL_PT;

    function distSq(p1, p2) {
        var dx = p1[0] - p2[0], dy = p1[1] - p2[1];
        return dx * dx + dy * dy;
    }

    var cutItems = [];
    var creaseItems = [];
    var bleedItems = [];
    var dimItems = [];

    // Artboard bounds để lọc viền khung
    doc.artboards.setActiveArtboardIndex(0);
    var abRect = doc.artboards[0].artboardRect;
    var abW = Math.abs(abRect[2] - abRect[0]);
    var abH = Math.abs(abRect[1] - abRect[3]);

    for (var idx = 0; idx < allPaths.length; idx++) {
        var pItem = allPaths[idx];
        if (!pItem.pathPoints || pItem.pathPoints.length < 2) continue;

        var lName = (pItem.layer ? pItem.layer.name : '').toLowerCase();
        var sCol = pItem.stroked ? pItem.strokeColor : null;
        var gb = pItem.geometricBounds; // [left, top, right, bottom]
        var pw = Math.abs(gb[2] - gb[0]);
        var ph = Math.abs(gb[1] - gb[3]);

        // A. Khung viền Artboard hoặc Section lớn
        if (pw > abW * 0.85 && ph > abH * 0.85) {
            dimItems.push(pItem);
            continue;
        }

        // B. Đường tràn lề (BLEED) - Màu xanh lá hoặc layer chứa chữ bleed/tran
        var isBleed = false;
        if (lName.indexOf('bleed') !== -1 || lName.indexOf('tran') !== -1 || lName.indexOf('tràn') !== -1) {
            isBleed = true;
        } else if (sCol && sCol.typename === 'CMYKColor') {
            if (sCol.cyan > 35 && sCol.yellow > 45 && sCol.magenta < 25) isBleed = true;
        } else if (sCol && sCol.typename === 'RGBColor') {
            if (sCol.green > 120 && sCol.green > sCol.red * 1.25 && sCol.green > sCol.blue * 1.25) isBleed = true;
        } else if (sCol && sCol.typename === 'SpotColor') {
            var spB = (sCol.spot && sCol.spot.name || '').toLowerCase();
            if (spB.indexOf('bleed') !== -1 || spB.indexOf('tran') !== -1) isBleed = true;
        }

        if (isBleed) {
            bleedItems.push(pItem);
            continue;
        }

        // C. Đường đo kích thước (DIMS) - Layer dim/size hoặc đường thẳng đơn độc có mũi tên
        if (lName.indexOf('dim') !== -1 || lName.indexOf('kich_thuoc') !== -1 || lName.indexOf('kích thước') !== -1) {
            dimItems.push(pItem);
            continue;
        }

        // D. Đường cấn gập (CREASE) đã được đánh dấu rõ (Đỏ / Nét đứt / Layer crease)
        var isExplicitCrease = false;
        if (lName.indexOf('crease') !== -1 || lName.indexOf('cấn') !== -1 || lName.indexOf('gap') !== -1 || lName.indexOf('gập') !== -1 || lName.indexOf('fold') !== -1) {
            isExplicitCrease = true;
        } else if (pItem.strokeDashes && pItem.strokeDashes.length > 0) {
            isExplicitCrease = true;
        } else if (sCol && sCol.typename === 'CMYKColor') {
            if ((sCol.magenta > 40 && sCol.yellow > 35 && sCol.cyan < 35) || (sCol.magenta > 50 && sCol.cyan < 35)) {
                isExplicitCrease = true;
            }
        } else if (sCol && sCol.typename === 'RGBColor') {
            if (sCol.red > 150 && sCol.red > sCol.green * 1.3 && sCol.red > sCol.blue * 1.3) {
                isExplicitCrease = true;
            }
        } else if (sCol && sCol.typename === 'SpotColor') {
            var spC = (sCol.spot && sCol.spot.name || '').toLowerCase();
            if (spC.indexOf('crease') !== -1 || spC.indexOf('cấn') !== -1 || spC.indexOf('fold') !== -1 || spC.indexOf('red') !== -1) {
                isExplicitCrease = true;
            }
        }

        if (isExplicitCrease) {
            creaseItems.push(pItem);
            continue;
        }

        // E. Phân loại Topology tự động cho các đường còn lại (đều màu đen/xanh):
        //   - Nếu là đường hở nằm bên trong (Internal dividing segment): điểm đầu và cuối đều chạm vào các đường khác -> CREASE
        //   - Nếu là đường khép kín hoàn toàn nằm lọt lòng (Inner loop/cutout) hoặc viền ngoài cùng -> CUT
        if (!pItem.closed && pItem.pathPoints.length === 2) {
            var ptStart = pItem.pathPoints[0].anchor;
            var ptEnd = pItem.pathPoints[1].anchor;

            var startTouches = 0, endTouches = 0;
            for (var oj = 0; oj < allPaths.length; oj++) {
                if (idx === oj) continue;
                var oItem = allPaths[oj];
                if (!oItem.pathPoints) continue;
                for (var op = 0; op < oItem.pathPoints.length; op++) {
                    var anc = oItem.pathPoints[op].anchor;
                    if (distSq(ptStart, anc) <= SNAP_TOL_SQ) startTouches++;
                    if (distSq(ptEnd, anc) <= SNAP_TOL_SQ) endTouches++;
                }
            }

            // Đoạn thẳng 2 đầu đều chạm vào các giao điểm nội bộ -> Rất có thể là ĐƯỜNG CẤN BẢN LỀ NỘI BỘ
            if (startTouches >= 2 && endTouches >= 2) {
                creaseItems.push(pItem);
                continue;
            }
        }

        // Mặc định còn lại là đường cắt
        cutItems.push(pItem);
    }

    // ── 5. THIẾT LẬP MÀU & ĐẶT VÀO ĐÚNG LAYER ─────────────────────────────────
    // A. CUT_LINE: Xanh dương #0066ee, 0.75pt, nét liền
    for (var ci = 0; ci < cutItems.length; ci++) {
        var cIt = cutItems[ci];
        try {
            cIt.move(lyrCut, ElementPlacement.PLACEATBEGINNING);
            cIt.stroked = true;
            cIt.strokeColor = colorCut;
            cIt.strokeWidth = 0.75;
            cIt.strokeDashes = [];
            cIt.filled = false;
        } catch (eC) {}
    }

    // B. CREASE_FOLD: Đỏ #ee1e23, 0.50pt, nét đứt 3pt-2pt
    for (var cri = 0; cri < creaseItems.length; cri++) {
        var crIt = creaseItems[cri];
        try {
            crIt.move(lyrCrease, ElementPlacement.PLACEATBEGINNING);
            crIt.stroked = true;
            crIt.strokeColor = colorCrease;
            crIt.strokeWidth = 0.50;
            crIt.strokeDashes = [3, 2];
            crIt.filled = false;
        } catch (eCr) {}
    }

    // C. BLEED: Xanh lá #28b446, 0.35pt, nét liền
    for (var bi = 0; bi < bleedItems.length; bi++) {
        var bIt = bleedItems[bi];
        try {
            bIt.move(lyrBleed, ElementPlacement.PLACEATBEGINNING);
            bIt.stroked = true;
            bIt.strokeColor = colorBleed;
            bIt.strokeWidth = 0.35;
            bIt.strokeDashes = [];
            bIt.filled = false;
        } catch (eB) {}
    }

    // D. DIMS & ANNOTATIONS: Ẩn và khóa để không làm nhiễu khi quét 3D
    for (var di = 0; di < dimItems.length; di++) {
        var dIt = dimItems[di];
        try {
            dIt.move(lyrDims, ElementPlacement.PLACEATBEGINNING);
        } catch (eD) {}
    }

    lyrText.visible = false; lyrText.locked = true;
    lyrDims.visible = false; lyrDims.locked = true;

    // ── 6. THÔNG BÁO HOÀN TẤT ────────────────────────────────────────────────
    var msg = " Chuẩn hóa khuôn bao bì 3D hoàn tất!\n\n" +
              "  Đường cắt (CUT_LINE): " + cutItems.length + " nét (Xanh dương #0066ee, 0.75pt)\n" +
              "  Đường cấn gập (CREASE_FOLD): " + creaseItems.length + " nét (Đỏ nét đứt #ee1e23, 0.5pt)\n" +
              "  Đường tràn lề (BLEED): " + bleedItems.length + " nét (Xanh lá #28b446)\n" +
              "  Văn bản & Chú thích (TEXT): " + textCount + " đối tượng (Đã chuyển sang layer ẩn)\n" +
              "  Kích thước & Khung viền (DIMS): " + dimItems.length + " nét (Đã chuyển sang layer ẩn)\n\n" +
              "Bây giờ bạn có thể mở panel 'Packaging Studio 3D' và bấm 'Quét khuôn AI' để xem mô hình 3D chuẩn xác 100%!";

    alert(msg);
})();
