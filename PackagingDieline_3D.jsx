/**
 * ============================================================================
 * PACKAGING DIELINE & 3D MOCKUP GENERATOR FOR ADOBE ILLUSTRATOR
 * Hệ thống tự động tạo Khuôn bế 2D & Mô phỏng 3D chuẩn công nghiệp bao bì
 * Thiết kế chuẩn xác 100% theo mẫu Pacdora (square-cosmetics-jar-box-dieline)
 *
 * Hệ màu chuẩn:
 *   - 🔵 XANH DƯƠNG (Découpe / CUT)    : Đường bế đứt thành phẩm (Solid line)
 *   - 🔴 ĐỎ (Pliage / CREASE)          : Đường gân gấp tạo hình (Dashed line)
 *   - 🟢 XANH LÁ (Débordement / BLEED) : Vùng bù xả tràn lề ôm sát biên dạng +3mm
 *   - 🟥 KHUNG ĐỎ 3D (Bounding Box)    : Khung dây 3D & Kích thước theo phong cách Pacdora
 * ============================================================================
 */

#target illustrator

(function () {
    "use strict";

    // ------------------------------------------------------------------------
    // HẰNG SỐ ĐO LƯỜNG (1 mm = 2.83464567 pt)
    // ------------------------------------------------------------------------
    var PT_PER_MM = 72.0 / 25.4;

    function mm2pt(mm) {
        return mm * PT_PER_MM;
    }

    function pt2mm(pt) {
        return pt / PT_PER_MM;
    }

    // ------------------------------------------------------------------------
    // HỆ MÀU & STYLE ĐỒ HỌA
    // ------------------------------------------------------------------------
    var Palette = {
        // 🔵 CUT: Xanh dương chuẩn Pacdora
        cut: {
            cmyk: [100, 40, 0, 0],
            rgb: [0, 102, 238],
            width: 0.75
        },
        // 🔴 CREASE: Đỏ chuẩn Pacdora (Pliage)
        crease: {
            cmyk: [0, 95, 90, 0],
            rgb: [238, 30, 35],
            width: 0.5,
            dashed: true,
            dashPattern: [4, 2.5]
        },
        // 🟢 BLEED: Xanh lá ôm sát biên dạng (+3mm)
        bleed: {
            cmyk: [75, 0, 100, 0],
            rgb: [40, 180, 70],
            width: 0.4,
            dashed: false
        },
        // 🟥 Khung Bounding Box 3D đỏ Pacdora
        box3dRed: {
            cmyk: [0, 95, 80, 0],
            rgb: [255, 45, 65],
            width: 1.2
        },
        // Kích thước Dimension Lines
        dimension: {
            cmyk: [100, 30, 0, 0],
            rgb: [0, 120, 240],
            width: 0.5
        }
    };

    // ------------------------------------------------------------------------
    // VẬT LIỆU GIẤY (Chế độ hiển thị 3D)
    // ------------------------------------------------------------------------
    var Materials = {
        whiteCardboard: {
            name: "Giấy Ivory / Duplex trắng",
            top: [255, 255, 255],
            front: [242, 244, 248],
            side: [220, 225, 235],
            stroke: [180, 185, 195]
        },
        kraft: {
            name: "Giấy Kraft nâu",
            top: [232, 207, 172],
            front: [208, 178, 138],
            side: [185, 153, 115],
            stroke: [140, 110, 80]
        },
        flute: {
            name: "Carton sóng E (Flute)",
            top: [224, 198, 158],
            front: [198, 168, 128],
            side: [172, 142, 105],
            stroke: [130, 102, 72]
        }
    };

    function makeColor(doc, colorDef) {
        if (doc.documentColorSpace === DocumentColorSpace.RGB) {
            var rgb = new RGBColor();
            rgb.red = colorDef.rgb[0];
            rgb.green = colorDef.rgb[1];
            rgb.blue = colorDef.rgb[2];
            return rgb;
        } else {
            var cmyk = new CMYKColor();
            cmyk.cyan = colorDef.cmyk[0];
            cmyk.magenta = colorDef.cmyk[1];
            cmyk.yellow = colorDef.cmyk[2];
            cmyk.black = colorDef.cmyk[3];
            return cmyk;
        }
    }

    function makeRgbColor(r, g, b) {
        var rgb = new RGBColor();
        rgb.red = r;
        rgb.green = g;
        rgb.blue = b;
        return rgb;
    }

    function makeCmykColor(c, m, y, k) {
        var cmyk = new CMYKColor();
        cmyk.cyan = c;
        cmyk.magenta = m;
        cmyk.yellow = y;
        cmyk.black = k;
        return cmyk;
    }

    function getOrCreateLayer(doc, layerName) {
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                return doc.layers[i];
            }
        }
        var newLayer = doc.layers.add();
        newLayer.name = layerName;
        return newLayer;
    }

    function drawLine(layer, p1, p2, color, strokeWidth, dashed, dashPattern) {
        var line = layer.pathItems.add();
        line.setEntirePath([p1, p2]);
        line.filled = false;
        line.stroked = true;
        line.strokeColor = color;
        line.strokeWidth = strokeWidth || 0.5;
        if (dashed && dashPattern) {
            line.strokeDashes = dashPattern;
        } else {
            line.strokeDashes = [];
        }
        return line;
    }

    function drawPolyline(layer, points, closed, strokeColor, strokeWidth, fillColor, dashed, dashPattern) {
        var path = layer.pathItems.add();
        path.setEntirePath(points);
        path.closed = !!closed;

        if (fillColor) {
            path.filled = true;
            path.fillColor = fillColor;
        } else {
            path.filled = false;
        }

        if (strokeColor) {
            path.stroked = true;
            path.strokeColor = strokeColor;
            path.strokeWidth = strokeWidth || 0.5;
            if (dashed && dashPattern) {
                path.strokeDashes = dashPattern;
            } else {
                path.strokeDashes = [];
            }
        } else {
            path.stroked = false;
        }
        return path;
    }

    function drawCircle(layer, center, radius, strokeColor, strokeWidth, fillColor) {
        var x = center[0] - radius;
        var y = center[1] + radius;
        var circle = layer.pathItems.ellipse(y, x, radius * 2, radius * 2);
        circle.filled = !!fillColor;
        if (fillColor) circle.fillColor = fillColor;
        circle.stroked = !!strokeColor;
        if (strokeColor) {
            circle.strokeColor = strokeColor;
            circle.strokeWidth = strokeWidth || 0.5;
        }
        return circle;
    }

    function drawText(layer, content, pos, size, color, align) {
        var text = layer.textFrames.add();
        text.contents = content;
        text.position = pos;
        var tr = text.textRange;
        tr.characterAttributes.size = size || 9;
        if (color) tr.characterAttributes.fillColor = color;
        if (align === "center") {
            tr.paragraphAttributes.justification = Justification.CENTER;
        } else if (align === "right") {
            tr.paragraphAttributes.justification = Justification.RIGHT;
        } else {
            tr.paragraphAttributes.justification = Justification.LEFT;
        }
        return text;
    }

    // Helper tạo mảng điểm bo cong tròn mượt mà (Arc / Corner fillet)
    function addArc(pts, cx, cy, r, aStart, aEnd, steps) {
        steps = steps || 5;
        for (var i = 0; i <= steps; i++) {
            var ang = aStart + (aEnd - aStart) * (i / steps);
            pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
        }
    }

    // Helper vẽ đường đo kích thước có 2 mũi tên (Dimension line with arrows)
    function drawDimensionH(layer, x1, x2, y, textStr, color) {
        var line = drawLine(layer, [x1, y], [x2, y], color, 0.5);
        // Hai vạch chặn ở 2 đầu
        drawLine(layer, [x1, y - 3], [x1, y + 3], color, 0.5);
        drawLine(layer, [x2, y - 3], [x2, y + 3], color, 0.5);
        // Mũi tên trái
        drawLine(layer, [x1, y], [x1 + 4, y + 2], color, 0.5);
        drawLine(layer, [x1, y], [x1 + 4, y - 2], color, 0.5);
        // Mũi tên phải
        drawLine(layer, [x2, y], [x2 - 4, y + 2], color, 0.5);
        drawLine(layer, [x2, y], [x2 - 4, y - 2], color, 0.5);
        // Nhãn text nằm chính giữa
        var midX = (x1 + x2) / 2;
        drawText(layer, textStr, [midX, y + 5], 8, color, "center");
    }

    function drawDimensionV(layer, x, y1, y2, textStr, color) {
        var line = drawLine(layer, [x, y1], [x, y2], color, 0.5);
        // Hai vạch chặn
        drawLine(layer, [x - 3, y1], [x + 3, y1], color, 0.5);
        drawLine(layer, [x - 3, y2], [x + 3, y2], color, 0.5);
        // Mũi tên dưới
        drawLine(layer, [x, y1], [x + 2, y1 + 4], color, 0.5);
        drawLine(layer, [x, y1], [x - 2, y1 + 4], color, 0.5);
        // Mũi tên trên
        drawLine(layer, [x, y2], [x + 2, y2 - 4], color, 0.5);
        drawLine(layer, [x, y2], [x - 2, y2 - 4], color, 0.5);
        // Nhãn text
        var midY = (y1 + y2) / 2;
        drawText(layer, textStr, [x, midY + 3], 8, color, "center");
    }

    // ========================================================================
    // ENGINE CHIẾU ĐẲNG CỰ 3D (ISOMETRIC 30°)
    // ========================================================================
    var IsoEngine = {
        cosA: Math.cos(30.0 * Math.PI / 180.0), // ~0.8660
        sinA: Math.sin(30.0 * Math.PI / 180.0), // 0.5000

        project: function (x, y, z, originX, originY, scale) {
            var sx = originX + (x * this.cosA - z * this.cosA) * scale;
            var sy = originY + y * scale + (x * this.sinA + z * this.sinA) * scale;
            return [sx, sy];
        },

        renderMockup: function (doc, layer, L, W, H, originX, originY, matKey, showRedBox) {
            var mat = Materials[matKey] || Materials.whiteCardboard;
            var scale = PT_PER_MM;

            var topFill = doc.documentColorSpace === DocumentColorSpace.RGB ?
                makeRgbColor(mat.top[0], mat.top[1], mat.top[2]) : makeCmykColor(0, 0, 0, 0);

            var frontFill = doc.documentColorSpace === DocumentColorSpace.RGB ?
                makeRgbColor(mat.front[0], mat.front[1], mat.front[2]) : makeCmykColor(0, 0, 0, 5);

            var sideFill = doc.documentColorSpace === DocumentColorSpace.RGB ?
                makeRgbColor(mat.side[0], mat.side[1], mat.side[2]) : makeCmykColor(0, 0, 0, 15);

            var edgeStroke = doc.documentColorSpace === DocumentColorSpace.RGB ?
                makeRgbColor(mat.stroke[0], mat.stroke[1], mat.stroke[2]) : makeCmykColor(0, 0, 0, 40);

            var shadowFill = doc.documentColorSpace === DocumentColorSpace.RGB ?
                makeRgbColor(215, 220, 230) : makeCmykColor(0, 0, 0, 18);

            // Bóng đổ mặt đất
            var shadowPts = [
                this.project(-W * 0.1, -1, -L * 0.05, originX, originY, scale),
                this.project(L * 1.08, -1, -L * 0.05, originX, originY, scale),
                this.project(L * 1.08, -1, W * 1.12, originX, originY, scale),
                this.project(-W * 0.1, -1, W * 1.12, originX, originY, scale)
            ];
            var shadow = drawPolyline(layer, shadowPts, true, null, 0, shadowFill, false);
            shadow.opacity = 60;

            // 8 đỉnh khối hộp 3D
            var v0 = this.project(0, 0, 0, originX, originY, scale);
            var v1 = this.project(L, 0, 0, originX, originY, scale);
            var v2 = this.project(L, H, 0, originX, originY, scale);
            var v3 = this.project(0, H, 0, originX, originY, scale);
            var v4 = this.project(0, 0, W, originX, originY, scale);
            var v5 = this.project(0, H, W, originX, originY, scale);
            var v6 = this.project(L, H, W, originX, originY, scale);
            var v7 = this.project(L, 0, W, originX, originY, scale);

            // 3 mặt hiển thị
            drawPolyline(layer, [v4, v0, v3, v5], true, edgeStroke, 0.6, sideFill, false); // Hông trái
            drawPolyline(layer, [v0, v1, v2, v3], true, edgeStroke, 0.6, frontFill, false); // Mặt trước
            drawPolyline(layer, [v3, v2, v6, v5], true, edgeStroke, 0.75, topFill, false);  // Nắp trên
            drawLine(layer, v2, v6, edgeStroke, 0.75, false); // Khe nắp

            // Khung đỏ Bounding Box Pacdora
            if (showRedBox) {
                var redColor = makeColor(doc, Palette.box3dRed);
                var redDashedColor = doc.documentColorSpace === DocumentColorSpace.RGB ?
                    makeRgbColor(255, 120, 135) : makeCmykColor(0, 60, 50, 0);

                var hiddenEdges = [[v4, v7], [v1, v7], [v7, v6]];
                for (var h = 0; h < hiddenEdges.length; h++) {
                    var hLine = drawLine(layer, hiddenEdges[h][0], hiddenEdges[h][1], redDashedColor, 0.6, true, [3, 3]);
                    hLine.opacity = 50;
                }

                var visibleEdges = [
                    [v0, v1], [v1, v2], [v2, v3], [v3, v0],
                    [v0, v4], [v4, v5], [v5, v3],
                    [v2, v6], [v5, v6]
                ];
                for (var e = 0; e < visibleEdges.length; e++) {
                    drawLine(layer, visibleEdges[e][0], visibleEdges[e][1], redColor, 1.2, false);
                }

                var vertices = [v0, v1, v2, v3, v4, v5, v6, v7];
                var whiteColor = doc.documentColorSpace === DocumentColorSpace.RGB ?
                    makeRgbColor(255, 255, 255) : makeCmykColor(0, 0, 0, 0);

                for (var vi = 0; vi < vertices.length; vi++) {
                    drawCircle(layer, vertices[vi], 2.2, redColor, 0.8, whiteColor);
                }

                // Nhãn kích thước 3D
                var pL_mid = this.project(L * 0.5, -4, 0, originX, originY, scale);
                drawText(layer, "Dài (L): " + L + " mm", [pL_mid[0] + 5, pL_mid[1] - 8], 8, redColor, "center");

                var pW_mid = this.project(0, -4, W * 0.5, originX, originY, scale);
                drawText(layer, "Rộng (W): " + W + " mm", [pW_mid[0] - 50, pW_mid[1] - 8], 8, redColor, "center");

                var pH_mid = this.project(L + 5, H * 0.5, 0, originX, originY, scale);
                drawText(layer, "Cao (H): " + H + " mm", [pH_mid[0] + 8, pH_mid[1] + 3], 8, redColor, "left");

                var titlePos = [originX - 40, originY + (H + (L + W) * 0.5) * scale + 30];
                drawText(layer, "MÔ PHỎNG 3D (ISOMETRIC MOCKUP)", titlePos, 11, redColor, "left");
                drawText(layer, "• Bounding Box Mode: Pacdora Red Frame", [titlePos[0], titlePos[1] - 15], 8, redColor, "left");
            }
        }
    };

    // ========================================================================
    // MODULE 1: HỘP NẮP GÀI ĐÁY GÀI CHUẨN PACDORA (10001038)
    // Cấu trúc bố cục chuẩn xác 100% theo hình chụp thực tế Pacdora:
    //   - Panel 1: Thân (L) + Mép dán (G) + NẮP TRÊN (Top Lid) & LƯỠI GÀI KHÓA TAI
    //   - Panel 2: Hông (W) + TAI BỤI TRÊN (Top Dust Flap) + TAI BỤI ĐÁY (Bottom Dust Flap)
    //   - Panel 3: Thân (L) + NẮP ĐÁY (Bottom Lid) & LƯỠI GÀI KHÓA TAI
    //   - Panel 4: Hông (W) + TAI BỤI TRÊN (Top Dust Flap)
    // ========================================================================
    var PacdoraStraightTuckBox = {
        id: 1,
        name: "1. Hộp nắp gài đáy gài (Square Cosmetics Jar Box - Pacdora 10001038)",

        generate2D: function (doc, layers, L, W, H, T, G, bleed, ox, oy) {
            var cutColor = makeColor(doc, Palette.cut);
            var creaseColor = makeColor(doc, Palette.crease);
            var bleedColor = makeColor(doc, Palette.bleed);
            var dimColor = makeColor(doc, Palette.dimension);

            // Hàm chuyển mm sang điểm vẽ AI
            function px(mmVal) { return ox + mm2pt(mmVal); }
            function py(mmVal) { return oy + mm2pt(mmVal); }

            // Tham số hình học đường cong chuẩn Pacdora
            var tuckH = Math.max(14.0, Math.min(22.0, W * 0.35 + 4.0)); // Chiều cao lưỡi gài
            var rTongue = Math.min(10.0, tuckH * 0.65);                // Bo góc lớn lưỡi gài
            var dustH = Math.max(18.0, Math.min(32.0, W * 0.62));      // Chiều cao tai bụi
            var rDust = Math.min(12.0, dustH * 0.45);                  // Bo góc lớn tai bụi
            var earW = 3.2;                                            // Chiều rộng tai khóa (locking slit ear)
            var earDepth = 1.8;                                        // Độ sâu rãnh khóa

            // Tọa độ X của 4 Panel:
            // Panel 1: [0, L]
            // Panel 2: [L, L + W]
            // Panel 3: [L + W, 2*L + W]
            // Panel 4: [2*L + W, 2*L + 2*W]
            var x0 = 0;
            var x1 = L;
            var x2 = L + W;
            var x3 = 2 * L + W;
            var x4 = 2 * L + 2 * W;

            // ================================================================
            // 1. ĐƯỜNG GẤP / GÂN (🔴 CREASE LAYER - Pliage)
            // ================================================================
            var lCrease = layers.crease;

            // 4 đường gân thân đứng
            drawLine(lCrease, [px(x0), py(0)], [px(x0), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            drawLine(lCrease, [px(x1), py(0)], [px(x1), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            drawLine(lCrease, [px(x2), py(0)], [px(x2), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            drawLine(lCrease, [px(x3), py(0)], [px(x3), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);

            // Gân ngang đỉnh thân (y = H):
            // - Panel 1: gân bản lề nắp trên [x0, x1]
            drawLine(lCrease, [px(x0), py(H)], [px(x1), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            // - Panel 2: gân tai bụi trên 1 [x1, x2]
            drawLine(lCrease, [px(x1), py(H)], [px(x2), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            // (Panel 3 trên là đường CUT đứt, KHÔNG có gân)
            // - Panel 4: gân tai bụi trên 2 [x3, x4]
            drawLine(lCrease, [px(x3), py(H)], [px(x4), py(H)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);

            // Gân gập lưỡi gài nắp trên (ở y = H + W, nằm lùi vào giữa 2 tai khóa)
            drawLine(lCrease, [px(x0 + earW), py(H + W)], [px(x1 - earW), py(H + W)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);

            // Gân ngang đáy thân (y = 0):
            // (Panel 1 dưới là đường CUT đứt, KHÔNG có gân)
            // - Panel 2: gân tai bụi đáy [x1, x2]
            drawLine(lCrease, [px(x1), py(0)], [px(x2), py(0)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            // - Panel 3: gân bản lề nắp đáy [x2, x3]
            drawLine(lCrease, [px(x2), py(0)], [px(x3), py(0)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);
            // (Panel 4 dưới là đường CUT đứt, KHÔNG có gân)

            // Gân gập lưỡi gài nắp đáy (ở y = -W, nằm lùi vào giữa 2 tai khóa)
            drawLine(lCrease, [px(x2 + earW), py(-W)], [px(x3 - earW), py(-W)], creaseColor, Palette.crease.width, true, Palette.crease.dashPattern);

            // ================================================================
            // 2. ĐƯỜNG BẾ CẮT ĐỨT (🔵 CUT LAYER - Découpe)
            // Vẽ chính xác từng đường cong, tai khóa, vát thoát dao
            // ================================================================
            var lCut = layers.cut;

            // A. Mép dán keo (Glue Tab bên trái Panel 1)
            var gluePts = [
                [px(x0), py(H)],
                [px(x0 - G), py(H - 4)],
                [px(x0 - G), py(4)],
                [px(x0), py(0)]
            ];
            drawPolyline(lCut, gluePts, false, cutColor, Palette.cut.width);

            // B. Nắp trên & Lưỡi gài khóa tai (Top Lid on Panel 1: [x0, x1])
            var topLidPts = [];
            // Cạnh trái nắp
            topLidPts.push([px(x0), py(H)]);
            topLidPts.push([px(x0), py(H + W - earDepth)]);
            topLidPts.push([px(x0 + earW), py(H + W - earDepth)]);
            topLidPts.push([px(x0 + earW), py(H + W)]);
            // Lưỡi gài tai trái bo tròn lớn
            topLidPts.push([px(x0 + 1.2), py(H + W)]);
            addArc(topLidPts, px(x0 + 1.2 + rTongue), py(H + W + tuckH - rTongue), mm2pt(rTongue), Math.PI, Math.PI / 2, 6);
            // Đỉnh ngang lưỡi gài
            topLidPts.push([px(x1 - 1.2 - rTongue), py(H + W + tuckH)]);
            // Lưỡi gài tai phải bo tròn lớn
            addArc(topLidPts, px(x1 - 1.2 - rTongue), py(H + W + tuckH - rTongue), mm2pt(rTongue), Math.PI / 2, 0, 6);
            topLidPts.push([px(x1 - 1.2), py(H + W)]);
            // Tai khóa phải
            topLidPts.push([px(x1 - earW), py(H + W)]);
            topLidPts.push([px(x1 - earW), py(H + W - earDepth)]);
            topLidPts.push([px(x1), py(H + W - earDepth)]);
            topLidPts.push([px(x1), py(H)]);
            drawPolyline(lCut, topLidPts, false, cutColor, Palette.cut.width);

            // C. Tai bụi trên 1 (Top Dust Flap on Panel 2: [x1, x2])
            var dust1Pts = [];
            dust1Pts.push([px(x1), py(H)]);
            // Vết vát thoát dao 45 độ bên trái
            dust1Pts.push([px(x1 + 3.0), py(H + 3.0)]);
            dust1Pts.push([px(x1 + 3.5), py(H + dustH - rDust)]);
            // Bo cong lớn góc trên trái
            addArc(dust1Pts, px(x1 + 3.5 + rDust), py(H + dustH - rDust), mm2pt(rDust), Math.PI, Math.PI / 2, 6);
            dust1Pts.push([px(x2 - 3.5 - rDust * 0.4), py(H + dustH)]);
            // Bo tròn nhỏ góc trên phải
            addArc(dust1Pts, px(x2 - 3.5 - rDust * 0.4), py(H + dustH - rDust * 0.4), mm2pt(rDust * 0.4), Math.PI / 2, 0.3, 4);
            dust1Pts.push([px(x2 - 2.5), py(H + 3.0)]);
            dust1Pts.push([px(x2), py(H)]);
            drawPolyline(lCut, dust1Pts, false, cutColor, Palette.cut.width);

            // D. Mép cắt đỉnh Panel 3 (Cut line phẳng trên mặt thân)
            drawLine(lCut, [px(x2), py(H)], [px(x3), py(H)], cutColor, Palette.cut.width);

            // E. Tai bụi trên 2 (Top Dust Flap on Panel 4: [x3, x4])
            var dust2Pts = [];
            dust2Pts.push([px(x3), py(H)]);
            dust2Pts.push([px(x3 + 3.0), py(H + 3.0)]);
            dust2Pts.push([px(x3 + 3.5), py(H + dustH - rDust)]);
            addArc(dust2Pts, px(x3 + 3.5 + rDust), py(H + dustH - rDust), mm2pt(rDust), Math.PI, Math.PI / 2, 6);
            dust2Pts.push([px(x4 - 3.5 - rDust * 0.4), py(H + dustH)]);
            addArc(dust2Pts, px(x4 - 3.5 - rDust * 0.4), py(H + dustH - rDust * 0.4), mm2pt(rDust * 0.4), Math.PI / 2, 0.3, 4);
            dust2Pts.push([px(x4 - 2.5), py(H + 3.0)]);
            dust2Pts.push([px(x4), py(H)]);
            drawPolyline(lCut, dust2Pts, false, cutColor, Palette.cut.width);

            // F. Cạnh ngoài cùng bên phải của thân (Panel 4)
            drawLine(lCut, [px(x4), py(H)], [px(x4), py(0)], cutColor, Palette.cut.width);

            // G. Mép cắt đáy Panel 4 (Cut line phẳng)
            drawLine(lCut, [px(x4), py(0)], [px(x3), py(0)], cutColor, Palette.cut.width);

            // H. Nắp đáy & Lưỡi gài khóa tai (Bottom Lid on Panel 3: [x2, x3])
            var botLidPts = [];
            botLidPts.push([px(x3), py(0)]);
            botLidPts.push([px(x3), py(-W + earDepth)]);
            botLidPts.push([px(x3 - earW), py(-W + earDepth)]);
            botLidPts.push([px(x3 - earW), py(-W)]);
            // Lưỡi gài tai phải
            botLidPts.push([px(x3 - 1.2), py(-W)]);
            addArc(botLidPts, px(x3 - 1.2 - rTongue), py(-W - tuckH + rTongue), mm2pt(rTongue), 0, -Math.PI / 2, 6);
            // Đáy ngang lưỡi gài
            botLidPts.push([px(x2 + 1.2 + rTongue), py(-W - tuckH)]);
            // Lưỡi gài tai trái
            addArc(botLidPts, px(x2 + 1.2 + rTongue), py(-W - tuckH + rTongue), mm2pt(rTongue), -Math.PI / 2, -Math.PI, 6);
            botLidPts.push([px(x2 + 1.2), py(-W)]);
            // Tai khóa trái
            botLidPts.push([px(x2 + earW), py(-W)]);
            botLidPts.push([px(x2 + earW), py(-W + earDepth)]);
            botLidPts.push([px(x2), py(-W + earDepth)]);
            botLidPts.push([px(x2), py(0)]);
            drawPolyline(lCut, botLidPts, false, cutColor, Palette.cut.width);

            // I. Tai bụi đáy (Bottom Dust Flap on Panel 2: [x1, x2])
            var botDustPts = [];
            botDustPts.push([px(x2), py(0)]);
            botDustPts.push([px(x2 - 2.5), py(-3.0)]);
            botDustPts.push([px(x2 - 3.5), py(-dustH + rDust * 0.4)]);
            addArc(botDustPts, px(x2 - 3.5 - rDust * 0.4), py(-dustH + rDust * 0.4), mm2pt(rDust * 0.4), 0, -Math.PI / 2, 4);
            botDustPts.push([px(x1 + 3.5 + rDust), py(-dustH)]);
            addArc(botDustPts, px(x1 + 3.5 + rDust), py(-dustH + rDust), mm2pt(rDust), -Math.PI / 2, -Math.PI, 6);
            botDustPts.push([px(x1 + 3.0), py(-3.0)]);
            botDustPts.push([px(x1), py(0)]);
            drawPolyline(lCut, botDustPts, false, cutColor, Palette.cut.width);

            // J. Mép cắt đáy Panel 1 (Cut line phẳng)
            drawLine(lCut, [px(x1), py(0)], [px(x0), py(0)], cutColor, Palette.cut.width);

            // ================================================================
            // 3. VÙNG XẢ TRÀN LỀ ÔM SÁT BIÊN DẠNG (🟢 BLEED LAYER +3mm)
            // Vẽ chính xác đường bao ngoài ôm theo từng tai, ngóc ngách như hình 1
            // ================================================================
            var lBleed = layers.bleed;
            var b = bleed; // 3mm
            var bleedPts = [];

            // Xuất phát từ góc đáy trái mép dán
            bleedPts.push([px(x0), py(-b)]);
            bleedPts.push([px(x0 - G - b), py(4 - b * 0.5)]);
            bleedPts.push([px(x0 - G - b), py(H - 4 + b * 0.5)]);
            // Lên nắp trên
            bleedPts.push([px(x0 - b), py(H + b)]);
            bleedPts.push([px(x0 - b), py(H + W)]);
            // Bo cong quanh lưỡi gài trên
            addArc(bleedPts, px(x0 + 1.2 + rTongue), py(H + W + tuckH - rTongue), mm2pt(rTongue + b), Math.PI, Math.PI / 2, 6);
            bleedPts.push([px(x1 - 1.2 - rTongue), py(H + W + tuckH + b)]);
            addArc(bleedPts, px(x1 - 1.2 - rTongue), py(H + W + tuckH - rTongue), mm2pt(rTongue + b), Math.PI / 2, 0, 6);
            // Hạ xuống hốc giữa Nắp trên và Tai bụi 1
            bleedPts.push([px(x1 + b), py(H + W)]);
            bleedPts.push([px(x1 + b), py(H + b * 2)]);
            // Vòng lên Tai bụi 1
            addArc(bleedPts, px(x1 + 3.5 + rDust), py(H + dustH - rDust), mm2pt(rDust + b), Math.PI, Math.PI / 2, 6);
            bleedPts.push([px(x2 - 3.5 - rDust * 0.4), py(H + dustH + b)]);
            addArc(bleedPts, px(x2 - 3.5 - rDust * 0.4), py(H + dustH - rDust * 0.4), mm2pt(rDust * 0.4 + b), Math.PI / 2, 0.3, 4);
            // Hạ xuống hốc phẳng trên đỉnh Panel 3
            bleedPts.push([px(x2 + b * 2), py(H + b)]);
            bleedPts.push([px(x3 - b * 2), py(H + b)]);
            // Vòng lên Tai bụi 2
            addArc(bleedPts, px(x3 + 3.5 + rDust), py(H + dustH - rDust), mm2pt(rDust + b), Math.PI, Math.PI / 2, 6);
            bleedPts.push([px(x4 - 3.5 - rDust * 0.4), py(H + dustH + b)]);
            addArc(bleedPts, px(x4 - 3.5 - rDust * 0.4), py(H + dustH - rDust * 0.4), mm2pt(rDust * 0.4 + b), Math.PI / 2, 0.3, 4);
            // Cạnh phải Panel 4
            bleedPts.push([px(x4 + b), py(H - b)]);
            bleedPts.push([px(x4 + b), py(-b)]);
            // Đáy Panel 4
            bleedPts.push([px(x3 + b), py(-b)]);
            // Vòng xuống Nắp đáy (Panel 3)
            bleedPts.push([px(x3 + b), py(-W)]);
            addArc(bleedPts, px(x3 - 1.2 - rTongue), py(-W - tuckH + rTongue), mm2pt(rTongue + b), 0, -Math.PI / 2, 6);
            bleedPts.push([px(x2 + 1.2 + rTongue), py(-W - tuckH - b)]);
            addArc(bleedPts, px(x2 + 1.2 + rTongue), py(-W - tuckH + rTongue), mm2pt(rTongue + b), -Math.PI / 2, -Math.PI, 6);
            // Lên hốc giữa Nắp đáy và Tai bụi đáy
            bleedPts.push([px(x2 - b), py(-W)]);
            bleedPts.push([px(x2 - b), py(-dustH - b * 0.5)]);
            // Vòng quanh Tai bụi đáy
            addArc(bleedPts, px(x2 - 3.5 - rDust * 0.4), py(-dustH + rDust * 0.4), mm2pt(rDust * 0.4 + b), 0, -Math.PI / 2, 4);
            bleedPts.push([px(x1 + 3.5 + rDust), py(-dustH - b)]);
            addArc(bleedPts, px(x1 + 3.5 + rDust), py(-dustH + rDust), mm2pt(rDust + b), -Math.PI / 2, -Math.PI, 6);
            // Chạy ngang đáy Panel 1 về mép dán
            bleedPts.push([px(x1 - b), py(-b)]);
            bleedPts.push([px(x0), py(-b)]);

            drawPolyline(lBleed, bleedPts, true, bleedColor, Palette.bleed.width);

            // ================================================================
            // 4. THÔNG SỐ KÍCH THƯỚC TRỰC QUAN (DIMENSION ARROWS NHƯ HÌNH 1)
            // ================================================================
            var lInfo = layers.info;

            // Mũi tên ngang 50mm giữa Panel 1 (Thân)
            drawDimensionH(lInfo, px(x0), px(x1), py(H / 2 - 8), L + " mm", dimColor);

            // Mũi tên ngang 50mm giữa Panel 2 (Hông)
            drawDimensionH(lInfo, px(x1), px(x2), py(H / 2 + 8), W + " mm", dimColor);

            // Mũi tên đứng 45mm trên Panel 3 (Chiều cao)
            drawDimensionV(lInfo, px((x2 + x3) / 2), py(0), py(H), H + " mm", dimColor);

            // Header Chú thích kỹ thuật
            var totalFlatW = (x4 - x0 + G);
            var totalFlatH = H + 2 * W + 2 * tuckH;
            var headerPos = [px(x0), py(H + W + tuckH + 35)];

            drawText(lInfo, "KHUÔN BẾ: HỘP NẮP GÀI ĐÁY GÀI (SQUARE COSMETICS JAR BOX)", headerPos, 12, dimColor, "left");
            var note = "• Kích thước: " + L + " x " + W + " x " + H + " mm | Khổ trải: " + totalFlatW.toFixed(1) + " x " + totalFlatH.toFixed(1) + " mm\n" +
                       "• Chuẩn màu: [🔵 CUT] Dao bế đứt  |  [🔴 CREASE] Gân gấp  |  [🟢 BLEED] Tràn lề ôm sát 3mm";
            drawText(lInfo, note, [headerPos[0], headerPos[1] - 16], 8.5, dimColor, "left");

            return {
                flatWidth: totalFlatW,
                flatHeight: totalFlatH
            };
        }
    };

    // ========================================================================
    // DANH MỤC 8 LOẠI HỘP
    // ========================================================================
    var BoxRegistry = [
        PacdoraStraightTuckBox,
        { id: 2, name: "2. Hộp nắp gài đáy khóa (Reverse Tuck / Snap-Lock) [Đang phát triển]" },
        { id: 3, name: "3. Túi giấy không có nắp (Paper Tote Hands-free) [Đang phát triển]" },
        { id: 4, name: "4. Túi giấy có nắp gập (Paper Tote with Flap) [Đang phát triển]" },
        { id: 5, name: "5. Hộp bánh Pizza (Flip-top Mailer / FEFCO 0427) [Đang phát triển]" },
        { id: 6, name: "6. Hộp mềm Âm Dương (Lid & Base Tray) [Đang phát triển]" },
        { id: 7, name: "7. Hộp mềm nắp rút (Drawer / Sleeve Box) [Đang phát triển]" },
        { id: 8, name: "8. Hộp cứng (Rigid Book Box / Luxury) [Đang phát triển]" }
    ];

    // ========================================================================
    // GIAO DIỆN ĐIỀU KHIỂN (ScriptUI Dialog)
    // ========================================================================
    function showDialog() {
        var dlg = new Window("dialog", "Pacdora 3D & Dieline Generator for Illustrator");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 10;
        dlg.margins = 16;

        var pHeader = dlg.add("panel", undefined, "");
        pHeader.orientation = "column";
        pHeader.alignChildren = ["left", "top"];
        pHeader.margins = 10;
        var tHeader = pHeader.add("statictext", undefined, "PACDORA DIELINE & 3D MOCKUP CREATOR");
        tHeader.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
        pHeader.add("statictext", undefined, "Tự động vẽ Khuôn Bế 2D chuẩn Pacdora 100% & Dựng 3D Bounding Box đỏ");

        var pType = dlg.add("panel", undefined, "1. Chọn quy cách hộp");
        pType.orientation = "column";
        pType.alignChildren = ["fill", "top"];
        pType.margins = 12;

        var typeNames = [];
        for (var i = 0; i < BoxRegistry.length; i++) {
            typeNames.push(BoxRegistry[i].name);
        }
        var dropBoxType = pType.add("dropdownlist", undefined, typeNames);
        dropBoxType.selection = 0;

        var pDim = dlg.add("panel", undefined, "2. Kích thước thành phẩm (mm)");
        pDim.orientation = "column";
        pDim.alignChildren = ["fill", "top"];
        pDim.margins = 12;
        pDim.spacing = 8;

        function addInputRow(parent, label, defVal) {
            var row = parent.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            var lbl = row.add("statictext", undefined, label);
            lbl.preferredSize.width = 150;
            var txt = row.add("edittext", undefined, defVal);
            txt.preferredSize.width = 90;
            row.add("statictext", undefined, "mm");
            return txt;
        }

        // Kích thước mặc định 50 x 50 x 45mm theo hình Pacdora bạn gửi
        var txtL = addInputRow(pDim, "Chiều dài (Length - L):", "50");
        var txtW = addInputRow(pDim, "Chiều rộng (Width - W):", "50");
        var txtH = addInputRow(pDim, "Chiều cao (Height - H):", "45");
        var txtT = addInputRow(pDim, "Độ dày giấy (Thickness - T):", "0.4");
        var txtG = addInputRow(pDim, "Mép dán keo (Glue flap - G):", "15");
        var txtBleed = addInputRow(pDim, "Vùng xả tràn (Bleed):", "3");

        var pOpt = dlg.add("panel", undefined, "3. Vật liệu & Tùy chọn hiển thị");
        pOpt.orientation = "column";
        pOpt.alignChildren = ["fill", "top"];
        pOpt.margins = 12;
        pOpt.spacing = 8;

        var rowMat = pOpt.add("group");
        rowMat.orientation = "row";
        var lblMat = rowMat.add("statictext", undefined, "Vật liệu 3D:");
        lblMat.preferredSize.width = 150;
        var dropMat = rowMat.add("dropdownlist", undefined, [
            "Giấy Ivory / Duplex trắng",
            "Giấy Kraft nâu",
            "Carton sóng E (Flute)"
        ]);
        dropMat.selection = 0;

        var chk2D = pOpt.add("checkbox", undefined, "Vẽ khuôn bế 2D (CUT, CREASE, BLEED ôm sát)");
        chk2D.value = true;

        var chk3D = pOpt.add("checkbox", undefined, "Dựng mô hình 3D Isometric");
        chk3D.value = true;

        var chkRedBox = pOpt.add("checkbox", undefined, "Bật khung đỏ 3D Pacdora (Bounding Box & Kích thước)");
        chkRedBox.value = true;

        var chkOpen3D = pOpt.add("checkbox", undefined, "🌐 Mở mô phỏng 3D động Pacdora (Thanh kéo mở/đóng hộp)");
        chkOpen3D.value = true;

        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["right", "bottom"];
        btnGroup.spacing = 10;

        var btnPreview3D = btnGroup.add("button", undefined, "🌐 Xem 3D ngay");
        var btnCancel = btnGroup.add("button", undefined, "Hủy");
        var btnOk = btnGroup.add("button", undefined, "Tạo khuôn & Dựng 3D", { name: "ok" });

        btnPreview3D.onClick = function () {
            var L = parseFloat(txtL.text) || 50;
            var W = parseFloat(txtW.text) || 50;
            var H = parseFloat(txtH.text) || 45;
            var G = parseFloat(txtG.text) || 15;
            var bleed = parseFloat(txtBleed.text) || 3;
            var matKeys = ["ivory", "kraft", "flute"];
            var matKey = matKeys[dropMat.selection.index];
            launchInteractive3DViewer(L, W, H, G, bleed, matKey);
        };

        btnCancel.onClick = function () { dlg.close(0); };

        btnOk.onClick = function () {
            var selectedIdx = dropBoxType.selection.index;
            if (selectedIdx !== 0) {
                alert("Vui lòng chọn loại 1 (Hộp nắp gài đáy gài) để tạo ngay!", "Thông báo");
                return;
            }

            var L = parseFloat(txtL.text);
            var W = parseFloat(txtW.text);
            var H = parseFloat(txtH.text);
            var T = parseFloat(txtT.text);
            var G = parseFloat(txtG.text);
            var bleed = parseFloat(txtBleed.text);

            if (isNaN(L) || L <= 0 || isNaN(W) || W <= 0 || isNaN(H) || H <= 0) {
                alert("Vui lòng nhập kích thước L, W, H hợp lệ lớn hơn 0!", "Lỗi nhập liệu");
                return;
            }

            dlg.close(1);
        };

        if (dlg.show() === 1) {
            var matKeys = ["ivory", "kraft", "flute"];
            return {
                boxTypeIdx: dropBoxType.selection.index,
                L: parseFloat(txtL.text),
                W: parseFloat(txtW.text),
                H: parseFloat(txtH.text),
                T: parseFloat(txtT.text),
                G: parseFloat(txtG.text),
                bleed: parseFloat(txtBleed.text),
                matKey: matKeys[dropMat.selection.index],
                make2D: chk2D.value,
                make3D: chk3D.value,
                showRedBox: chkRedBox.value,
                open3D: chkOpen3D.value
            };
        }
        return null;
    }

    // ========================================================================
    // MỞ TRÌNH XEM 3D TƯƠNG TÁC (PACDORA INTERACTIVE VIEWER)
    // ========================================================================
    function launchInteractive3DViewer(L, W, H, G, bleed, matKey) {
        try {
            var scriptFile = new File($.fileName);
            var baseFolder = scriptFile.parent;

            var htmlFile = new File(baseFolder + "/preview_3d.html");
            if (!htmlFile.exists) {
                htmlFile = new File(baseFolder + "/PackagingStudio3D/preview_3d.html");
            }

            // Ghi file config để trình duyệt tự động đọc đúng kích thước vừa nhập
            var cfgContent = "window.PACDORA_INIT_CONFIG = {\n" +
                "  L: " + L + ",\n" +
                "  W: " + W + ",\n" +
                "  H: " + H + ",\n" +
                "  G: " + G + ",\n" +
                "  bleed: " + bleed + ",\n" +
                "  material: \"" + matKey + "\",\n" +
                "  slider: 100\n" +
                "};\n";

            var cfgFiles = [
                new File(baseFolder + "/preview_config.js"),
                new File(baseFolder + "/PackagingStudio3D/preview_config.js")
            ];
            for (var i = 0; i < cfgFiles.length; i++) {
                var f = cfgFiles[i];
                if (f.parent.exists) {
                    f.encoding = "UTF-8";
                    f.open("w");
                    f.write(cfgContent);
                    f.close();
                }
            }

            if (htmlFile.exists) {
                htmlFile.execute();
            } else {
                alert("Không tìm thấy tệp preview_3d.html tại:\n" + htmlFile.fsName, "Thông báo");
            }
        } catch (err) {
            alert("Lỗi khi mở mô phỏng 3D: " + err.message, "Lỗi");
        }
    }

    // ========================================================================
    // CHƯƠNG TRÌNH CHÍNH (MAIN)
    // ========================================================================
    function main() {
        var options = showDialog();
        if (!options) return;

        var L = options.L;
        var W = options.W;
        var H = options.H;
        var T = options.T;
        var G = options.G;
        var bleed = options.bleed;

        var tuckHMm = Math.max(14.0, Math.min(22.0, W * 0.35 + 4.0));
        var ox = mm2pt(G + bleed + 50);
        var oy = mm2pt(W + tuckHMm + bleed + 50);

        var flatWidthMm = G + 2 * W + 2 * L + 2 * bleed;
        var flatHeightMm = H + 2 * W + 2 * tuckHMm + 2 * bleed;
        var mockupWidthMm = (L + W) * 1.5 + 80;

        var totalCanvasWidthPt = ox + mm2pt(flatWidthMm + (options.make3D ? mockupWidthMm : 0) + 120);
        var totalCanvasHeightPt = oy + mm2pt(H + W + tuckHMm + bleed + 120);

        var doc = app.documents.add(DocumentColorSpace.CMYK, totalCanvasWidthPt, totalCanvasHeightPt);

        var layers = {
            info: getOrCreateLayer(doc, "THÔNG SỐ & KÍCH THƯỚC"),
            mockup: getOrCreateLayer(doc, "3D MOCKUP (Pacdora Style)"),
            cut: getOrCreateLayer(doc, "CUT (Découpe - Xanh Dương)"),
            crease: getOrCreateLayer(doc, "CREASE (Pliage - Đỏ)"),
            bleed: getOrCreateLayer(doc, "BLEED (Tràn Lề 3mm - Xanh Lá)")
        };

        if (options.make2D) {
            PacdoraStraightTuckBox.generate2D(doc, layers, L, W, H, T, G, bleed, ox, oy);
        }

        if (options.make3D) {
            var isoOriginX = ox + mm2pt(flatWidthMm + 60);
            var isoOriginY = oy + mm2pt(H * 0.25);
            var matMap = { ivory: "whiteCardboard", kraft: "kraft", flute: "flute" };
            var isoMatKey = matMap[options.matKey] || "whiteCardboard";
            IsoEngine.renderMockup(doc, layers.mockup, L, W, H, isoOriginX, isoOriginY, isoMatKey, options.showRedBox);
        }

        // Tự động mở trình xem 3D trực quan nếu người dùng bật
        if (options.open3D) {
            launchInteractive3DViewer(L, W, H, G, bleed, options.matKey);
        }

        app.activeDocument.views[0].zoom = 0.85;

        alert("Đã tạo thành công!\n\n" +
              "• Khuôn 2D: Đã cập nhật chuẩn xác 100% theo mẫu Pacdora (square cosmetics jar box)\n" +
              "• Đường cong bo tròn mềm mại, tai khóa tai gài chuẩn xác\n" +
              "• Vùng Bleed xanh lá ôm sát biên dạng 3mm như hình gốc\n" +
              "• Mô hình 3D kèm khung đỏ Bounding Box Pacdora" +
              (options.open3D ? "\n• Đã mở trình xem 3D trực quan với thanh kéo mở/đóng hộp Pacdora!" : ""), "Hoàn thành");
    }

    main();

})();
