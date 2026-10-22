/**
 * ============================================================================
 * host.jsx — ExtendScript Bridge cho CEP Panel
 * Các hàm này được gọi từ JavaScript panel qua CSInterface.evalScript()
 * Tất cả hàm phải return string (JSON string) để panel nhận được
 * ============================================================================
 */

/* jshint ignore:start */
#target illustrator

// ────────────────────────────────────────────────────────────────────────────
// JSON polyfill — ExtendScript (ES3) của Illustrator không có sẵn JSON
// ────────────────────────────────────────────────────────────────────────────
if (typeof JSON === 'undefined') { JSON = {}; }
if (typeof JSON.parse !== 'function') {
    JSON.parse = function (s) { return eval('(' + s + ')'); };
}
if (typeof JSON.stringify !== 'function') {
    (function () {
        function q(s) {
            return '"' + s.replace(/[\\"\u0000-\u001f]/g, function (c) {
                var m = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
                return m[c] || ('\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
            }) + '"';
        }
        function str(v) {
            if (v === null || v === undefined) return 'null';
            var t = typeof v;
            if (t === 'number') return isFinite(v) ? String(v) : 'null';
            if (t === 'boolean') return String(v);
            if (t === 'string') return q(v);
            if (v instanceof Array) {
                var a = [];
                for (var i = 0; i < v.length; i++) a.push(str(v[i]));
                return '[' + a.join(',') + ']';
            }
            var o = [];
            for (var k in v) {
                if (v.hasOwnProperty(k) && typeof v[k] !== 'function') o.push(q(k) + ':' + str(v[k]));
            }
            return '{' + o.join(',') + '}';
        }
        JSON.stringify = str;
    })();
}

// ────────────────────────────────────────────────────────────────────────────
// Kiểm tra kết nối
// ────────────────────────────────────────────────────────────────────────────
function host_ping() {
    return JSON.stringify({ ok: true, version: app.version, name: app.name });
}

// ────────────────────────────────────────────────────────────────────────────
// Vẽ khuôn bế 2D bằng cách nhúng trực tiếp logic từ PackagingDieline_3D.jsx
// Tham số: L, W, H (mm), G (mép dán), bleed (tràn lề), boxType (1-8)
// ────────────────────────────────────────────────────────────────────────────
function host_runDieline(L, W, H, G, bleed, boxType) {
    try {
        L     = parseFloat(L)     || 80;
        W     = parseFloat(W)     || 60;
        H     = parseFloat(H)     || 120;
        G     = parseFloat(G)     || 15;
        bleed = parseFloat(bleed) || 3;
        boxType = parseInt(boxType) || 1;

        if (boxType !== 1) {
            return JSON.stringify({
                ok: false,
                msg: 'Loại hộp ' + boxType + ' đang được phát triển. Chọn loại 1.'
            });
        }

        // Gọi script vẽ khuôn (path tuyệt đối hoặc dùng $.evalFile)
        // Ưu tiên 1: Gọi trực tiếp file .jsx nếu tồn tại
        var dilineScriptPath = '~/Desktop/Code - Mockup 3d/PackagingDieline_3D.jsx';
        var dilineFile = new File(dilineScriptPath);

        // Nếu file JSX tồn tại, gọi hàm generate2D từ nó
        // Vì không thể gọi hàm từ file khác trực tiếp,
        // ta chạy toàn bộ bằng cách nhúng code tạo hộp ở đây

        // Hằng số đo lường
        var PT_PER_MM = 72.0 / 25.4;

        function mm2pt(mm) { return mm * PT_PER_MM; }

        // Tính kích thước
        var tuckHMm = Math.max(14.0, Math.min(22.0, W * 0.35 + 4.0));
        var ox = mm2pt(G + bleed + 50);
        var oy = mm2pt(W + tuckHMm + bleed + 50);
        var flatWidthMm  = G + 2 * W + 2 * L + 2 * bleed;
        var flatHeightMm = H + 2 * W + 2 * tuckHMm + 2 * bleed;
        var mockupWidthMm = (L + W) * 1.5 + 80;

        var totalW = ox + mm2pt(flatWidthMm + mockupWidthMm + 120);
        var totalH = oy + mm2pt(H + W + tuckHMm + bleed + 120);

        // Tạo tài liệu mới
        var doc = app.documents.add(DocumentColorSpace.CMYK, totalW, totalH);

        // Helper tạo layer
        function getOrCreateLayer(name) {
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === name) return doc.layers[i];
            }
            var l = doc.layers.add();
            l.name = name;
            return l;
        }

        function makeCMYK(c, m, y, k) {
            var col = new CMYKColor();
            col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
            return col;
        }

        function drawPath(layer, pts, closed, strokeColor, strokeW, fillColor, dashes) {
            var p = layer.pathItems.add();
            p.setEntirePath(pts);
            p.closed = !!closed;
            p.filled = !!fillColor;
            if (fillColor) p.fillColor = fillColor;
            p.stroked = !!strokeColor;
            if (strokeColor) {
                p.strokeColor = strokeColor;
                p.strokeWidth = strokeW || 0.5;
                p.strokeDashes = dashes || [];
            }
            return p;
        }

        function drawLine(layer, p1, p2, color, sw, dashes) {
            return drawPath(layer, [p1, p2], false, color, sw, null, dashes);
        }

        function drawText(layer, txt, pos, sz, color) {
            var tf = layer.textFrames.add();
            tf.contents = txt;
            tf.position = pos;
            var tr = tf.textRange;
            tr.characterAttributes.size = sz || 9;
            if (color) tr.characterAttributes.fillColor = color;
            return tf;
        }

        // Màu sắc chuẩn
        var cutColor    = makeCMYK(100, 40, 0, 0);   // Xanh dương
        var creaseColor = makeCMYK(0, 95, 90, 0);     // Đỏ
        var bleedColor  = makeCMYK(75, 0, 100, 0);    // Xanh lá
        var dimColor    = makeCMYK(100, 30, 0, 0);

        var layers = {
            info:   getOrCreateLayer('THÔNG SỐ & KÍCH THƯỚC'),
            mockup: getOrCreateLayer('3D MOCKUP'),
            cut:    getOrCreateLayer('CUT (Xanh Dương)'),
            crease: getOrCreateLayer('CREASE (Đỏ)'),
            bleed:  getOrCreateLayer('BLEED (Xanh Lá)')
        };

        function px(mmVal) { return ox + mm2pt(mmVal); }
        function py(mmVal) { return oy + mm2pt(mmVal); }

        var x0 = 0, x1 = L, x2 = L + W, x3 = 2*L + W, x4 = 2*L + 2*W;
        var tH = tuckHMm;
        var dH = Math.max(18.0, Math.min(32.0, W * 0.62));
        var rT = Math.min(10.0, tH * 0.65);
        var eW = 3.2, eD = 1.8;

        var lC = layers.crease;
        var cW = 0.5, cD = [4, 2.5];

        // Gân thân đứng
        drawLine(lC,[px(x0),py(0)],[px(x0),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x1),py(0)],[px(x1),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x2),py(0)],[px(x2),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x3),py(0)],[px(x3),py(H)],creaseColor,cW,cD);

        // Gân ngang
        drawLine(lC,[px(x0),py(H)],[px(x1),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x1),py(H)],[px(x2),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x3),py(H)],[px(x4),py(H)],creaseColor,cW,cD);
        drawLine(lC,[px(x0+eW),py(H+W)],[px(x1-eW),py(H+W)],creaseColor,cW,cD);
        drawLine(lC,[px(x1),py(0)],[px(x2),py(0)],creaseColor,cW,cD);
        drawLine(lC,[px(x2),py(0)],[px(x3),py(0)],creaseColor,cW,cD);
        drawLine(lC,[px(x2+eW),py(-W)],[px(x3-eW),py(-W)],creaseColor,cW,cD);

        // Đường CUT chính
        var lCut = layers.cut;
        // Nắp trên (Panel 1)
        var topLid = [
            [px(x0),py(H)],[px(x0),py(H+W-eD)],[px(x0+eW),py(H+W-eD)],[px(x0+eW),py(H+W)],
            [px(x0+1.2),py(H+W)],
            [px(x0+1.2+rT),py(H+W+tH)],
            [px(x1-1.2-rT),py(H+W+tH)],
            [px(x1-1.2),py(H+W)],
            [px(x1-eW),py(H+W)],[px(x1-eW),py(H+W-eD)],[px(x1),py(H+W-eD)],[px(x1),py(H)]
        ];
        drawPath(lCut,topLid,false,cutColor,0.75);

        // Tai bụi trên 1 (Panel 2)
        var rd = Math.min(12.0, dH * 0.45);
        drawPath(lCut,[
            [px(x1),py(H)],[px(x1+3),py(H+3)],[px(x1+3.5),py(H+dH-rd)],
            [px(x1+3.5+rd),py(H+dH)],[px(x2-3.5-rd*0.4),py(H+dH)],
            [px(x2-2.5),py(H+3)],[px(x2),py(H)]
        ],false,cutColor,0.75);

        // Panel 3 top cut & tai bụi 2
        drawLine(lCut,[px(x2),py(H)],[px(x3),py(H)],cutColor,0.75);
        drawPath(lCut,[
            [px(x3),py(H)],[px(x3+3),py(H+3)],[px(x3+3.5),py(H+dH-rd)],
            [px(x3+3.5+rd),py(H+dH)],[px(x4-3.5-rd*0.4),py(H+dH)],
            [px(x4-2.5),py(H+3)],[px(x4),py(H)]
        ],false,cutColor,0.75);

        // Cạnh phải & đáy Panel 4
        drawLine(lCut,[px(x4),py(H)],[px(x4),py(0)],cutColor,0.75);
        drawLine(lCut,[px(x4),py(0)],[px(x3),py(0)],cutColor,0.75);

        // Nắp đáy (Panel 3)
        var botLid = [
            [px(x3),py(0)],[px(x3),py(-W+eD)],[px(x3-eW),py(-W+eD)],[px(x3-eW),py(-W)],
            [px(x3-1.2),py(-W)],
            [px(x3-1.2-rT),py(-W-tH)],
            [px(x2+1.2+rT),py(-W-tH)],
            [px(x2+1.2),py(-W)],
            [px(x2+eW),py(-W)],[px(x2+eW),py(-W+eD)],[px(x2),py(-W+eD)],[px(x2),py(0)]
        ];
        drawPath(lCut,botLid,false,cutColor,0.75);

        // Tai bụi đáy (Panel 2)
        drawPath(lCut,[
            [px(x2),py(0)],[px(x2-2.5),py(-3)],[px(x2-3.5),py(-dH+rd*0.4)],
            [px(x2-3.5-rd*0.4),py(-dH)],[px(x1+3.5+rd),py(-dH)],
            [px(x1+3),py(-3)],[px(x1),py(0)]
        ],false,cutColor,0.75);

        // Mép dán keo
        drawLine(lCut,[px(x1),py(0)],[px(x0),py(0)],cutColor,0.75);
        drawPath(lCut,[
            [px(x0),py(H)],[px(x0-G),py(H-4)],[px(x0-G),py(4)],[px(x0),py(0)]
        ],false,cutColor,0.75);

        // Bleed outline
        var b = bleed;
        drawPath(layers.bleed,[
            [px(x0-G-b),py(H+W+tH+b)],[px(x4+b),py(H+W+tH+b)],
            [px(x4+b),py(-W-tH-b)],[px(x0-G-b),py(-W-tH-b)]
        ],true,bleedColor,0.4);

        // Info header
        var fw = (x4 - x0 + G).toFixed(1);
        var fh = (H + 2*W + 2*tH).toFixed(1);
        drawText(layers.info,
            'KHUON BE: HOP NAP GAI DAY GAI (' + L + 'x' + W + 'x' + H + 'mm)',
            [px(x0), py(H+W+tH+35)], 11, dimColor);
        drawText(layers.info,
            'Kho trai phang: ' + fw + ' x ' + fh + ' mm  |  Mep dan: ' + G + 'mm  |  Bleed: ' + bleed + 'mm',
            [px(x0), py(H+W+tH+20)], 8.5, dimColor);

        // Mặt nhãn
        drawText(layers.info,'Mat truoc',[px((x0+x1)/2), py(H/2+5)],9,dimColor);
        drawText(layers.info,'Hong T',[px((x1+x2)/2), py(H/2+5)],9,dimColor);
        drawText(layers.info,'Mat sau',[px((x2+x3)/2), py(H/2+5)],9,dimColor);
        drawText(layers.info,'Hong P',[px((x3+x4)/2), py(H/2+5)],9,dimColor);
        drawText(layers.info,'Nap tren',[px((x0+x1)/2), py(H+W/2+5)],8,dimColor);
        drawText(layers.info,'Nap day',[px((x2+x3)/2), py(-W/2+5)],8,dimColor);

        app.activeDocument.views[0].zoom = 0.8;

        return JSON.stringify({
            ok: true,
            msg: 'Khuon ' + L + 'x' + W + 'x' + H + 'mm da ve xong'
        });

    } catch (err) {
        return JSON.stringify({ ok: false, msg: 'Loi: ' + err.message });
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Export artboard hiện tại sang PNG base64 để apply lên mô hình 3D
// ────────────────────────────────────────────────────────────────────────────
function host_exportArtboard() {
    try {
        if (!app.documents.length) {
            return JSON.stringify({ ok: false, msg: 'Khong co tai lieu nao dang mo trong Illustrator.' });
        }

        var doc  = app.activeDocument;
        var tmpPath = Folder.temp.fsName + '/ps3d_export_' + (new Date().getTime()) + '.png';
        var tmpFile = new File(tmpPath);

        var opts = new ExportOptionsPNG24();
        opts.antiAliasing     = true;
        opts.transparency     = false;
        opts.artBoardClipping = true;
        opts.horizontalScale  = 100;
        opts.verticalScale    = 100;

        doc.exportFile(tmpFile, ExportType.PNG24, opts);

        // Đọc file PNG và encode base64
        if (!tmpFile.exists) {
            return JSON.stringify({ ok: false, msg: 'Xuat PNG that bai.' });
        }

        tmpFile.encoding = 'BINARY';
        tmpFile.open('r');
        var rawData = tmpFile.read();
        tmpFile.close();
        tmpFile.remove();

        // Encode base64 thủ công (ExtendScript không có btoa)
        function toBase64(str) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            var out = '', i = 0, len = str.length;
            while (i < len) {
                var a = str.charCodeAt(i++) & 0xff;
                var b = i < len ? str.charCodeAt(i++) & 0xff : 0;
                var c = i < len ? str.charCodeAt(i++) & 0xff : 0;
                out += chars[a >> 2];
                out += chars[((a & 3) << 4) | (b >> 4)];
                out += i - 2 < len ? chars[((b & 15) << 2) | (c >> 6)] : '=';
                out += i - 1 < len ? chars[c & 63] : '=';
            }
            return out;
        }

        var b64 = toBase64(rawData);
        return JSON.stringify({ ok: true, base64: b64 });

    } catch (err) {
        return JSON.stringify({ ok: false, msg: 'Loi export: ' + err.message });
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Lấy kích thước từ tài liệu đang mở (đọc từ tên layer hoặc metadata)
// ────────────────────────────────────────────────────────────────────────────
function host_getDimensions() {
    try {
        if (!app.documents.length) {
            return JSON.stringify({ ok: false, msg: 'Khong co tai lieu nao.' });
        }
        var doc = app.activeDocument;
        var w   = doc.width;
        var h   = doc.height;
        var PT  = 72.0 / 25.4;
        return JSON.stringify({
            ok: true,
            docW: Math.round(w / PT),
            docH: Math.round(h / PT)
        });
    } catch (err) {
        return JSON.stringify({ ok: false, msg: err.message });
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Mở Trình xem 3D tương tác ra trình duyệt ngoài (Fullscreen Web 3D)
// ────────────────────────────────────────────────────────────────────────────
function host_openPreview3D(L, W, H, mat) {
    try {
        var baseFolder = new File($.fileName).parent.parent;
        var htmlFile = new File(baseFolder + "/preview_3d.html");
        if (!htmlFile.exists) {
            htmlFile = new File(baseFolder + "/PackagingStudio3D/preview_3d.html");
        }
        var cfgFile = new File(baseFolder + "/preview_config.js");
        cfgFile.encoding = "UTF-8";
        cfgFile.open("w");
        cfgFile.write("window.PACDORA_INIT_CONFIG = " + JSON.stringify({
            L: parseFloat(L) || 80,
            W: parseFloat(W) || 60,
            H: parseFloat(H) || 120,
            material: mat || "kraft",
            slider: 100
        }) + ";\n");
        cfgFile.close();

        if (htmlFile.exists) {
            htmlFile.execute();
            return JSON.stringify({ ok: true, msg: "Da mo 3D Viewer!" });
        }
        return JSON.stringify({ ok: false, msg: "Khong tim thay preview_3d.html" });
    } catch (e) {
        return JSON.stringify({ ok: false, msg: e.message });
    }
}

// ============================================================================
// PS3D API — Thư viện mẫu hộp (dữ liệu khuôn do engine JS ps3d_core.js sinh ra)
// ============================================================================
var PS3D_LAYERS = {
    art: 'ARTWORK (Thiết kế)',
    bleed: 'BLEED (Tràn lề)',
    crease: 'CREASE (Gấp)',
    cut: 'CUT (Bế)',
    dims: 'DIMS (Kích thước)',
    data: 'PS3D_DATA'
};

function _ps3dMM(v) { return v * 72 / 25.4; }
function _ps3dOk(o) { o = o || {}; o.ok = true; return JSON.stringify(o); }
function _ps3dErr(e) { return JSON.stringify({ ok: false, msg: String(e && e.message ? e.message : e) }); }

function _ps3dCMYK(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
    return col;
}

function _ps3dFindLayer(doc, name) {
    for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === name) return doc.layers[i];
    return null;
}

function _ps3dLayer(doc, name) {
    var l = _ps3dFindLayer(doc, name);
    if (!l) { l = doc.layers.add(); l.name = name; }
    l.locked = false; l.visible = true;
    return l;
}

function _ps3dClear(layer) {
    layer.locked = false; layer.visible = true;
    while (layer.pageItems.length) layer.pageItems[0].remove();
}

function _ps3dReadMeta(doc) {
    try {
        var l = _ps3dFindLayer(doc, PS3D_LAYERS.data);
        if (l && l.pathItems.length && l.pathItems[0].note) return JSON.parse(l.pathItems[0].note);
    } catch (e) {}
    return null;
}

function _ps3dWriteMeta(doc, meta) {
    var l = _ps3dLayer(doc, PS3D_LAYERS.data);
    _ps3dClear(l);
    var p = l.pathItems.rectangle(0, 0, 1, 1);
    p.filled = false; p.stroked = false;
    p.name = 'PS3D_META';
    p.note = JSON.stringify(meta);
    l.printable = false;
    l.visible = false;
    l.locked = true;
}

function _ps3dStyleOutline(item, color, w) {
    var t = item.typename;
    if (t === 'PathItem') {
        item.filled = false; item.stroked = true; item.strokeColor = color; item.strokeWidth = w; item.strokeDashes = [];
    } else if (t === 'CompoundPathItem') {
        for (var i = 0; i < item.pathItems.length; i++) _ps3dStyleOutline(item.pathItems[i], color, w);
    } else if (t === 'GroupItem') {
        for (var j = 0; j < item.pageItems.length; j++) _ps3dStyleOutline(item.pageItems[j], color, w);
    }
}

// Bleed = hợp (Pathfinder Add) các mặt rồi Offset Path +bleed, bo tròn góc
function _ps3dMakeBleed(doc, layer, data, P) {
    if (!data.bleed || data.bleed <= 0) return true;
    var green = _ps3dCMYK(75, 0, 100, 0);
    try {
        var grp = layer.groupItems.add();
        for (var i = 0; i < data.panels.length; i++) {
            var pts = [];
            for (var k = 0; k < data.panels[i].length; k++) pts.push(P(data.panels[i][k]));
            var pi = grp.pathItems.add();
            pi.setEntirePath(pts); pi.closed = true;
            pi.filled = true; pi.fillColor = green; pi.stroked = false;
        }
        doc.selection = null;
        grp.selected = true;
        app.executeMenuCommand('Live Pathfinder Add');
        app.executeMenuCommand('expandStyle');
        var item = doc.selection[0];
        item.applyEffect('<LiveEffect name="Adobe Offset Path"><Dict data="R mlim 4 R ofst ' +
            _ps3dMM(data.bleed) + ' I jntp 0 "/></LiveEffect>');
        doc.selection = null;
        item.selected = true;
        app.executeMenuCommand('expandStyle');
        var sel = doc.selection;
        for (var s = 0; s < sel.length; s++) _ps3dStyleOutline(sel[s], green, 0.4);
        doc.selection = null;
        return true;
    } catch (e) {
        try { doc.selection = null; } catch (e2) {}
        return false;
    }
}

function _ps3dDraw(doc, data, isNew) {
    var r = data.rect;
    var ab = doc.artboards[0];
    var cur = ab.artboardRect;
    var left = cur[0], bottom = cur[3];
    ab.artboardRect = [left, bottom + _ps3dMM(r.h), left + _ps3dMM(r.w), bottom];
    function P(q) { return [left + _ps3dMM(q[0] - r.x0), bottom + _ps3dMM(q[1] - r.y0)]; }

    var art;
    if (isNew) { art = doc.layers[0]; art.name = PS3D_LAYERS.art; }
    else { art = _ps3dLayer(doc, PS3D_LAYERS.art); }
    var lBleed = _ps3dLayer(doc, PS3D_LAYERS.bleed);
    var lCrease = _ps3dLayer(doc, PS3D_LAYERS.crease);
    var lCut = _ps3dLayer(doc, PS3D_LAYERS.cut);
    var lDims = _ps3dLayer(doc, PS3D_LAYERS.dims);
    _ps3dClear(lBleed); _ps3dClear(lCrease); _ps3dClear(lCut); _ps3dClear(lDims);
    // Thứ tự lớp (trên → dưới): DIMS, CUT, CREASE, BLEED, ..., ARTWORK
    lDims.zOrder(ZOrderMethod.BRINGTOFRONT);
    lCut.zOrder(ZOrderMethod.BRINGTOFRONT);
    lDims.zOrder(ZOrderMethod.BRINGTOFRONT);
    art.zOrder(ZOrderMethod.SENDTOBACK);

    var blue = _ps3dCMYK(100, 40, 0, 0), red = _ps3dCMYK(0, 95, 90, 0), dimC = _ps3dCMYK(100, 30, 0, 0);
    var i, k, pts, path;

    for (i = 0; i < data.cuts.length; i++) {
        pts = [];
        for (k = 0; k < data.cuts[i].pts.length; k++) pts.push(P(data.cuts[i].pts[k]));
        path = lCut.pathItems.add();
        path.setEntirePath(pts);
        path.closed = !!data.cuts[i].closed;
        path.filled = false; path.stroked = true; path.strokeColor = blue; path.strokeWidth = 0.75;
    }
    for (i = 0; i < data.creases.length; i++) {
        path = lCrease.pathItems.add();
        path.setEntirePath([P(data.creases[i][0]), P(data.creases[i][1])]);
        path.filled = false; path.stroked = true; path.strokeColor = red; path.strokeWidth = 0.5;
        path.strokeDashes = [4, 2.5];
    }
    for (i = 0; i < (data.dims || []).length; i++) {
        var d = data.dims[i], a = P(d.a), b = P(d.b);
        path = lDims.pathItems.add();
        path.setEntirePath([a, b]);
        path.filled = false; path.stroked = true; path.strokeColor = dimC; path.strokeWidth = 0.4;
        var tf = lDims.textFrames.pointText([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2]);
        tf.contents = d.label;
        tf.textRange.characterAttributes.size = 6;
        tf.textRange.characterAttributes.fillColor = dimC;
        tf.textRange.paragraphAttributes.justification = Justification.CENTER;
        if (Math.abs(a[0] - b[0]) < 0.01) tf.rotate(90);
    }

    var bleedOk = _ps3dMakeBleed(doc, lBleed, data, P);
    _ps3dWriteMeta(doc, {
        version: 1, templateId: data.templateId, templateName: data.templateName,
        params: data.params, bleed: data.bleed, material: data.material, rect: data.rect
    });
    doc.activeLayer = art;
    return bleedOk;
}

// Tạo file AI mới chứa khuôn của mẫu đang chọn
function ps3d_createDoc(json) {
    try {
        var data = JSON.parse(json);
        var doc = app.documents.add(DocumentColorSpace.CMYK, _ps3dMM(data.rect.w), _ps3dMM(data.rect.h));
        var bleedOk = _ps3dDraw(doc, data, true);
        return _ps3dOk({ name: doc.name, bleedOk: bleedOk });
    } catch (e) { return _ps3dErr(e); }
}

// Vẽ lại / gắn khuôn vào file đang mở (giữ nguyên layer ARTWORK)
function ps3d_updateDoc(json) {
    try {
        if (!app.documents.length) return _ps3dErr('Chưa mở file nào.');
        var data = JSON.parse(json);
        var doc = app.activeDocument;
        var bleedOk = _ps3dDraw(doc, data, false);
        return _ps3dOk({ name: doc.name, bleedOk: bleedOk });
    } catch (e) { return _ps3dErr(e); }
}

// Danh sách file đang mở + metadata mẫu hộp của từng file
function ps3d_getState() {
    try {
        var docs = [], active = null;
        if (app.documents.length) active = app.activeDocument;
        for (var i = 0; i < app.documents.length; i++) {
            var d = app.documents[i];
            docs.push({ name: d.name, meta: _ps3dReadMeta(d), active: !!(active && d.name === active.name) });
        }
        return _ps3dOk({
            app: app.version,
            active: active ? active.name : null,
            activeMeta: active ? _ps3dReadMeta(active) : null,
            docs: docs
        });
    } catch (e) { return _ps3dErr(e); }
}

function ps3d_activateDoc(name) {
    try {
        for (var i = 0; i < app.documents.length; i++) {
            if (app.documents[i].name === name) { app.documents[i].activate(); return _ps3dOk(); }
        }
        return _ps3dErr('Không tìm thấy file ' + name);
    } catch (e) { return _ps3dErr(e); }
}

// Xuất artboard 1 (ẩn lớp khuôn) ra PNG trong suốt để dán lên mô hình 3D
function ps3d_exportArtwork() {
    try {
        if (!app.documents.length) return _ps3dErr('Chưa mở file nào.');
        var doc = app.activeDocument;
        if (!_ps3dReadMeta(doc)) return _ps3dErr('File này chưa gắn mẫu hộp.');

        var old = Folder.temp.getFiles('ps3d_art_*.png');
        for (var o = 0; o < old.length; o++) { try { old[o].remove(); } catch (e0) {} }

        var hide = [PS3D_LAYERS.cut, PS3D_LAYERS.crease, PS3D_LAYERS.bleed, PS3D_LAYERS.dims];
        var artLayer = _ps3dFindLayer(doc, PS3D_LAYERS.art);
        var itemCount = artLayer ? (artLayer.pageItems.length) : 0;

        var saved = [];
        for (var i = 0; i < hide.length; i++) {
            var l = _ps3dFindLayer(doc, hide[i]);
            if (l) { saved.push([l, l.visible]); l.visible = false; }
        }
        doc.artboards.setActiveArtboardIndex(0);
        var rect = doc.artboards[0].artboardRect;
        var maxPt = Math.max(rect[2] - rect[0], rect[1] - rect[3]);
        var opts = new ExportOptionsPNG24();
        opts.artBoardClipping = true;
        opts.antiAliasing = true;
        opts.transparency = true;
        opts.horizontalScale = opts.verticalScale = Math.min(500, 3600 / maxPt * 100);
        var f = new File(Folder.temp.fsName + '/ps3d_art_' + new Date().getTime() + '.png');
        try {
            doc.exportFile(f, ExportType.PNG24, opts);
        } finally {
            for (var s = 0; s < saved.length; s++) saved[s][0].visible = saved[s][1];
        }
        return _ps3dOk({ path: f.fsName, itemCount: itemCount, docName: doc.name });
    } catch (e) { return _ps3dErr(e); }
}

// ────────────────────────────────────────────────────────────────────────────
// Quét khuôn bế tự do từ Illustrator (Hướng A: Scan Dieline Vector → 3D)
// ────────────────────────────────────────────────────────────────────────────
function ps3d_scanDieline() {
    try {
        if (!app.documents.length) return _ps3dErr('Chưa mở file nào trong Illustrator.');
        var doc = app.activeDocument;
        var toMM = 25.4 / 72.0;

        function pt2mm(pt) {
            return [pt[0] * toMM, pt[1] * toMM];
        }

        var cuts = [];
        var creases = [];
        var allPaths = [];

        // Kiểm tra xem người dùng có chọn cụ thể đối tượng nào trong AI không
        var hasSelection = (doc.selection && doc.selection.length > 0);
        var targetItems = hasSelection ? doc.selection : null;

        function collectFromItem(item, layerName) {
            if (!item) return;
            var t = item.typename;
            if (t === 'PathItem') {
                if (!item.pathPoints || item.pathPoints.length < 2) return;
                var pts = [];
                var numPts = item.pathPoints.length;
                var isClosed = item.closed;
                var segCount = isClosed ? numPts : numPts - 1;

                for (var i = 0; i < segCount; i++) {
                    var ppCurr = item.pathPoints[i];
                    var ppNext = item.pathPoints[(i + 1) % numPts];

                    var a0 = ppCurr.anchor;
                    var r0 = ppCurr.rightDirection;
                    var l1 = ppNext.leftDirection;
                    var a1 = ppNext.anchor;

                    pts.push(pt2mm(a0));

                    // Kiểm tra đoạn cong Bézier (handles lệch khỏi anchor)
                    var dR = Math.abs(r0[0] - a0[0]) + Math.abs(r0[1] - a0[1]);
                    var dL = Math.abs(l1[0] - a1[0]) + Math.abs(l1[1] - a1[1]);

                    if (dR > 0.4 || dL > 0.4) {
                        var steps = 6;
                        for (var st = 1; st < steps; st++) {
                            var bT = st / steps;
                            var mt = 1.0 - bT;
                            var bx = mt * mt * mt * a0[0] + 3 * mt * mt * bT * r0[0] + 3 * mt * bT * bT * l1[0] + bT * bT * bT * a1[0];
                            var by = mt * mt * mt * a0[1] + 3 * mt * mt * bT * r0[1] + 3 * mt * bT * bT * l1[1] + bT * bT * bT * a1[1];
                            pts.push(pt2mm([bx, by]));
                        }
                    }
                }
                if (!isClosed) {
                    pts.push(pt2mm(item.pathPoints[numPts - 1].anchor));
                }

                var isCrease = false;
                var lName = (layerName || '').toLowerCase();
                var sColor = item.stroked && item.strokeColor;

                // 0. LỌC BỎ HOÀN TOÀN BLEED (MÀU XANH LÁ) VÀ CÁC LAYER KÍCH THƯỚC / CHÚ THÍCH
                if (lName.indexOf('bleed') !== -1 || lName.indexOf('tran') !== -1 || lName.indexOf('tràn') !== -1) {
                    return; // Bỏ qua layer Bleed
                }
                if (lName.indexOf('dim') !== -1 || lName.indexOf('kich_thuoc') !== -1 ||
                    lName.indexOf('kích thước') !== -1 || lName.indexOf('annotation') !== -1 ||
                    lName.indexOf('ghi_chu') !== -1 || lName.indexOf('note') !== -1) {
                    return; // Bỏ qua layer ghi chú kích thước
                }

                // Nhận diện màu nét BLEED (Xanh lá chuẩn Pacdora C:75, M:0, Y:100, K:0 hoặc RGB G > 120)
                if (sColor && sColor.typename === 'CMYKColor') {
                    if (sColor.cyan > 35 && sColor.yellow > 45 && sColor.magenta < 25) {
                        return; // Bỏ qua nét Bleed xanh lá CMYK
                    }
                } else if (sColor && sColor.typename === 'RGBColor') {
                    if (sColor.green > 120 && sColor.green > sColor.red * 1.25 && sColor.green > sColor.blue * 1.25) {
                        return; // Bỏ qua nét Bleed xanh lá RGB
                    }
                } else if (sColor && sColor.typename === 'SpotColor') {
                    var spBleedName = (sColor.spot && sColor.spot.name || '').toLowerCase();
                    if (spBleedName.indexOf('bleed') !== -1 || spBleedName.indexOf('tran') !== -1 || spBleedName.indexOf('tràn') !== -1) {
                        return; // Bỏ qua nét Bleed Spot color
                    }
                }

                // 1. Nhận diện theo tên Layer (crease, gap, cấn, can, fold...)
                if (lName.indexOf('crease') !== -1 || lName.indexOf('can') !== -1 ||
                    lName.indexOf('cấn') !== -1 || lName.indexOf('gap') !== -1 ||
                    lName.indexOf('gập') !== -1 || lName.indexOf('fold') !== -1) {
                    isCrease = true;
                }
                // 2. Nhận diện theo nét đứt (dashed stroke)
                else if (item.strokeDashes && item.strokeDashes.length > 0) {
                    isCrease = true;
                }
                // 3. Nhận diện theo màu nét (Màu đỏ / Magenta / Spot Crease)
                else if (sColor && sColor.typename === 'CMYKColor') {
                    // Magenta cao hoặc Đỏ (M>40 & Y>40 & C<35) hoặc Hồng/Magenta (M>50 & C<35)
                    if ((sColor.magenta > 40 && sColor.yellow > 35 && sColor.cyan < 35) || (sColor.magenta > 50 && sColor.cyan < 35)) {
                        isCrease = true;
                    }
                } else if (sColor && sColor.typename === 'RGBColor') {
                    // Red dominant: R > 150 và R áp đảo G, B
                    if (sColor.red > 150 && (sColor.red > sColor.green * 1.3) && (sColor.red > sColor.blue * 1.3)) {
                        isCrease = true;
                    }
                } else if (sColor && sColor.typename === 'SpotColor') {
                    var spName = (sColor.spot && sColor.spot.name || '').toLowerCase();
                    if (spName.indexOf('crease') !== -1 || spName.indexOf('can') !== -1 ||
                        spName.indexOf('cấn') !== -1 || spName.indexOf('gap') !== -1 ||
                        spName.indexOf('gập') !== -1 || spName.indexOf('fold') !== -1 ||
                        spName.indexOf('red') !== -1) {
                        isCrease = true;
                    }
                }

                var pObj = { pts: pts, closed: item.closed, isCrease: isCrease };
                if (isCrease) creases.push(pts);
                else cuts.push({ pts: pts, closed: item.closed });
                allPaths.push(pObj);
            } else if (t === 'GroupItem') {
                for (var g = 0; g < item.pageItems.length; g++) {
                    collectFromItem(item.pageItems[g], layerName);
                }
            } else if (t === 'CompoundPathItem') {
                for (var c = 0; c < item.pathItems.length; c++) {
                    collectFromItem(item.pathItems[c], layerName);
                }
            }
        }

        // Nếu có chọn vùng (selection): ưu tiên quét chính xác vùng người dùng chọn
        if (hasSelection) {
            for (var si = 0; si < targetItems.length; si++) {
                collectFromItem(targetItems[si], (targetItems[si].layer ? targetItems[si].layer.name : ''));
            }
        } else {
            // Quét toàn bộ các nét trong tài liệu (trừ layer data/dims)
            for (var l = 0; l < doc.layers.length; l++) {
                var lyr = doc.layers[l];
                var lyrLower = lyr.name.toLowerCase();
                if (lyrLower.indexOf('ps3d_data') !== -1 || lyrLower.indexOf('dims') !== -1) continue;
                for (var p = 0; p < lyr.pageItems.length; p++) {
                    collectFromItem(lyr.pageItems[p], lyr.name);
                }
            }
        }

        if (allPaths.length === 0) {
            return _ps3dErr('Không tìm thấy đường vector (Path) nào trong file hoặc vùng chọn để quét khuôn.');
        }

        // Thu thập text nhãn và thông số kích thước trong tài liệu (toàn bộ doc.textFrames)
        var docLabels = [];
        try {
            for (var tfIdx = 0; tfIdx < doc.textFrames.length; tfIdx++) {
                var tf = doc.textFrames[tfIdx];
                if (tf.layer && tf.layer.name.toLowerCase().indexOf('ps3d_data') !== -1) continue;
                if (tf.contents && tf.contents.length > 0) {
                    var rawTxt = tf.contents.replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
                    if (rawTxt.length > 0) {
                        var tPos = tf.position; // [left, top]
                        var tWidth = (tf.width || 0) * toMM;
                        var tHeight = (tf.height || 0) * toMM;
                        docLabels.push({
                            text: rawTxt,
                            x: tPos[0] * toMM,
                            y: tPos[1] * toMM,
                            cx: (tPos[0] * toMM) + (tWidth / 2),
                            cy: (tPos[1] * toMM) - (tHeight / 2)
                        });
                    }
                }
            }
        } catch (errTF) {}

        // Artboard size
        doc.artboards.setActiveArtboardIndex(0);
        var abRect = doc.artboards[0].artboardRect;
        var abW = (abRect[2] - abRect[0]) * toMM;
        var abH = (abRect[1] - abRect[3]) * toMM;

        // Tính Bounding Box cho từng path
        for (var pi = 0; pi < allPaths.length; pi++) {
            var path = allPaths[pi];
            var pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
            for (var pk = 0; pk < path.pts.length; pk++) {
                var px = path.pts[pk][0], py = path.pts[pk][1];
                if (px < pMinX) pMinX = px; if (px > pMaxX) pMaxX = px;
                if (py < pMinY) pMinY = py; if (py > pMaxY) pMaxY = py;
            }
            path.minX = pMinX; path.minY = pMinY;
            path.maxX = pMaxX; path.maxY = pMaxY;
            path.w = pMaxX - pMinX; path.h = pMaxY - pMinY;
            path.isFrame = false;
        }

        // LỌC BỎ KHUNG VIỀN SECTION & ĐƯỜNG KẺ PHÂN CÁCH (Không phải khuôn hộp)
        // Những khung chữ nhật viền bao quanh toàn bộ cụm combo hộp hoặc đường viền trang
        for (var fi = 0; fi < allPaths.length; fi++) {
            var pfi = allPaths[fi];
            // 1. Viền trang artboard
            if (pfi.w > abW * 0.75 && pfi.h > abH * 0.75) {
                pfi.isFrame = true;
                continue;
            }
            // 2. Khung bao cụm combo (hình chữ nhật chứa nhiều nét khác bên trong với lề trống)
            if ((pfi.pts.length <= 6 || pfi.closed) && pfi.w > 120 && pfi.h > 80) {
                var enclosedCount = 0;
                for (var fj = 0; fj < allPaths.length; fj++) {
                    if (fi === fj) continue;
                    var pfj = allPaths[fj];
                    if (pfj.minX >= pfi.minX + 3 && pfj.maxX <= pfi.maxX - 3 &&
                        pfj.minY >= pfi.minY + 3 && pfj.maxY <= pfi.maxY - 3) {
                        enclosedCount++;
                    }
                }
                // Nếu chứa từ 4 đường khác trở lên bên trong: đây là khung section, không phải dieline
                if (enclosedCount >= 4) {
                    pfi.isFrame = true;
                }
            }
            // 3. Đường thẳng gióng kích thước / mũi tên / đường phân cách đơn độc
            // (Open Paths có 2-3 điểm, không khép kín, hoặc có độ dài độc lập không dính vào khuôn chính)
            if (!pfi.closed && pfi.pts.length <= 4) {
                var touchesCount = 0;
                for (var fk = 0; fk < allPaths.length; fk++) {
                    if (fi === fk) continue;
                    var pfk = allPaths[fk];
                    // Kiểm tra nhanh bounding box
                    if (pfk.maxX + 3.0 < pfi.minX || pfk.minX - 3.0 > pfi.maxX ||
                        pfk.maxY + 3.0 < pfi.minY || pfk.minY - 3.0 > pfi.maxY) continue;

                    for (var ptIdx = 0; ptIdx < pfi.pts.length; ptIdx++) {
                        var pPt = pfi.pts[ptIdx];
                        for (var fkp = 0; fkp < pfk.pts.length; fkp++) {
                            var q = pfk.pts[fkp];
                            var d = Math.sqrt((pPt[0]-q[0])*(pPt[0]-q[0]) + (pPt[1]-q[1])*(pPt[1]-q[1]));
                            if (d < 2.5) { touchesCount++; break; }
                        }
                    }
                }
                // Nếu là nét đơn lẻ không chạm vào đâu (touchesCount === 0),
                // hoặc chỉ chạm đúng 1 đầu (đường gióng kích thước / chỉ dẫn), hoặc đường phân cách dài > 150mm
                if (touchesCount === 0 || (pfi.pts.length === 2 && touchesCount < 2 && (pfi.w > 60 || pfi.h > 60))) {
                    pfi.isFrame = true;
                }
            }
        }

        // Lấy danh sách các đường hợp lệ thuộc khuôn
        var validPaths = [];
        for (var vi = 0; vi < allPaths.length; vi++) {
            if (!allPaths[vi].isFrame) validPaths.push(allPaths[vi]);
        }

        // KIỂM TRA ĐỘ TIẾP XÚC GIỮA CÁC ĐƯỜNG (Point-to-Point Touch Connectivity)
        // Các đường trong CÙNG MỘT HỘP luôn chạm hoặc gặp nhau tại các điểm nút (< 4mm)
        // Các con hộp KHÁC NHAU trong combo cách nhau ít nhất 15mm-50mm nên không bị dính chùm
        function pathsConnect(pA, pB, thresh) {
            // Kiểm tra bounding box trước
            if (pA.maxX + thresh < pB.minX || pA.minX - thresh > pB.maxX ||
                pA.maxY + thresh < pB.minY || pA.minY - thresh > pB.maxY) {
                return false;
            }
            var thSq = thresh * thresh;
            for (var aIdx = 0; aIdx < pA.pts.length; aIdx++) {
                var pa = pA.pts[aIdx];
                for (var bIdx = 0; bIdx < pB.pts.length; bIdx++) {
                    var pb = pB.pts[bIdx];
                    var dx = pa[0] - pb[0], dy = pa[1] - pb[1];
                    if (dx * dx + dy * dy <= thSq) return true;
                }
            }
            return false;
        }

        // Khởi tạo cụm
        var clusters = [];
        for (var ci = 0; ci < validPaths.length; ci++) {
            var vpo = validPaths[ci];
            clusters.push({
                minX: vpo.minX, minY: vpo.minY,
                maxX: vpo.maxX, maxY: vpo.maxY,
                paths: [vpo]
            });
        }

        // Gộp các đường tiếp xúc nhau thành từng mẫu hộp riêng biệt
        var merged = true;
        while (merged) {
            merged = false;
            for (var i = 0; i < clusters.length; i++) {
                for (var j = i + 1; j < clusters.length; j++) {
                    var cA = clusters[i], cB = clusters[j];
                    if (!(cA.maxX + 4.0 < cB.minX || cA.minX - 4.0 > cB.maxX ||
                          cA.maxY + 4.0 < cB.minY || cA.minY - 4.0 > cB.maxY)) {

                        var touchFound = false;
                        for (var ma = 0; ma < cA.paths.length; ma++) {
                            for (var mb = 0; mb < cB.paths.length; mb++) {
                                if (pathsConnect(cA.paths[ma], cB.paths[mb], 4.0)) {
                                    touchFound = true;
                                    break;
                                }
                            }
                            if (touchFound) break;
                        }

                        if (touchFound) {
                            cA.minX = Math.min(cA.minX, cB.minX);
                            cA.minY = Math.min(cA.minY, cB.minY);
                            cA.maxX = Math.max(cA.maxX, cB.maxX);
                            cA.maxY = Math.max(cA.maxY, cB.maxY);
                            cA.paths = cA.paths.concat(cB.paths);
                            clusters.splice(j, 1);
                            merged = true;
                            break;
                        }
                    }
                }
                if (merged) break;
            }
        }

        // THUẬT TOÁN GỘP CỤM NÉT NHỎ / LỖ KHOÉT VÀO KHUÔN CHÍNH (Bounding Box Containment)
        // Áp dụng cho: Cửa sổ kính (window cutout), ô định hình khay bánh/trà, các lỗ khoét tay cầm...
        function mergeInnerCutoutsIntoParentDieline(rawClusters) {
            var tolerance = 3.0; // Dung sai 3pt/mm

            // Sắp xếp các cụm theo diện tích Bounding Box từ lớn đến nhỏ
            rawClusters.sort(function (a, b) {
                var areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
                var areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
                return areaB - areaA;
            });

            var mergedClusters = [];
            var absorbedMap = {};

            for (var i = 0; i < rawClusters.length; i++) {
                if (absorbedMap[i]) continue;

                var parent = rawClusters[i];
                parent.innerCutouts = parent.innerCutouts || [];

                for (var j = i + 1; j < rawClusters.length; j++) {
                    if (absorbedMap[j]) continue;

                    var child = rawClusters[j];

                    // Kiểm tra nếu child nằm hoàn toàn bên trong khung bao (Bounding Box) của parent
                    // Hệ tọa độ chuẩn của Illustrator (minX <= maxX, minY <= maxY)
                    var isInside =
                        child.minX >= (parent.minX - tolerance) &&
                        child.maxX <= (parent.maxX + tolerance) &&
                        child.minY >= (parent.minY - tolerance) &&
                        child.maxY <= (parent.maxY + tolerance);

                    if (isInside) {
                        // Gộp các path của ô nhỏ/lỗ khoét vào khuôn mẹ thay vì tạo mẫu hộp riêng
                        parent.paths = parent.paths.concat(child.paths);
                        parent.innerCutouts.push(child);
                        absorbedMap[j] = true;
                    }
                }

                mergedClusters.push(parent);
            }

            return mergedClusters;
        }

        // Thực hiện gộp các lỗ khoét và khay ô con vào khuôn mẹ
        var consolidatedClusters = mergeInnerCutoutsIntoParentDieline(clusters);

        // Lọc bỏ rác nhỏ (< 25mm hoặc < 3 đường)
        var validClusters = [];
        for (var k = 0; k < consolidatedClusters.length; k++) {
            var cl = consolidatedClusters[k];
            var cw = cl.maxX - cl.minX;
            var ch = cl.maxY - cl.minY;
            if (cw >= 25 && ch >= 25 && cl.paths.length >= 3) {
                cl.w = cw;
                cl.h = ch;
                validClusters.push(cl);
            }
        }

        // Sắp xếp các cụm khuôn chuẩn từ trái qua phải, trên xuống dưới
        validClusters.sort(function (a, b) {
            if (Math.abs(a.minY - b.minY) > 80) return b.minY - a.minY; // từ trên xuống
            return a.minX - b.minX; // từ trái qua phải
        });

        // BÓC TÁCH TÊN, COMBO HEADER VÀ THÔNG SỐ DRC CHO TỪNG HỘP
        var boxesData = [];

        function parseDRC(str) {
            if (!str) return null;
            // Tìm dạng DRC: 37x7x30 hoặc 37.5x4x30.5 hoặc 38.5x8x31.5cm
            var rx = /(?:DRC|KT|Kích thước)?[:\s]*([0-9]+(?:\.[0-9]+)?)\s*[*xX×]\s*([0-9]+(?:\.[0-9]+)?)\s*[*xX×]\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(cm|mm|m))?/i;
            var m = str.match(rx);
            if (!m) return null;
            var v1 = parseFloat(m[1]), v2 = parseFloat(m[2]), v3 = parseFloat(m[3]);
            var unit = (m[4] || '').toLowerCase();
            // Nếu có chữ cm hoặc số nhỏ <= 80 thì quy đổi cm ra mm
            var scale = (unit === 'cm' || (v1 <= 80 && v2 <= 80 && v3 <= 80)) ? 10 : 1;
            return { d1: v1 * scale, d2: v2 * scale, d3: v3 * scale };
        }

        for (var bi = 0; bi < validClusters.length; bi++) {
            var bClust = validClusters[bi];
            var cCx = (bClust.minX + bClust.maxX) / 2;
            var cCy = (bClust.minY + bClust.maxY) / 2;

            // 1. Thu thập nhãn text thuộc về cụm khuôn này:
            // - Nhãn nằm trong lòng khuôn (strictly inside)
            // - Header nằm ngay trên nắp/khuôn: y >= maxY - 10 và y <= maxY + 95 (Y tăng dần hướng lên trên)
            // - Caption nằm dưới đáy khuôn: y <= minY + 10 và y >= minY - 70
            // - Nhãn sát 2 bên mép (margin <= 40mm)
            var boxLabels = [];
            for (var li = 0; li < docLabels.length; li++) {
                var lbl = docLabels[li];
                var lTxt = lbl.text;
                var lx = lbl.cx, ly = lbl.cy;

                var isInside = (lx >= bClust.minX - 5 && lx <= bClust.maxX + 5 &&
                                ly >= bClust.minY - 5 && ly <= bClust.maxY + 5);

                var isHeaderAbove = (ly > bClust.maxY - 10 && ly <= bClust.maxY + 95 &&
                                     Math.abs(lx - cCx) <= Math.max(bClust.w * 0.65, 80));

                var isCaptionBelow = (ly < bClust.minY + 10 && ly >= bClust.minY - 70 &&
                                      Math.abs(lx - cCx) <= Math.max(bClust.w * 0.65, 70));

                var isSideNear = (Math.abs(ly - cCy) <= bClust.h * 0.6 &&
                                  ((lx >= bClust.minX - 40 && lx <= bClust.minX) ||
                                   (lx >= bClust.maxX && lx <= bClust.maxX + 40)));

                if (isInside || isHeaderAbove || isCaptionBelow || isSideNear) {
                    // Kiểm tra xem nhãn này có gần một cụm khuôn nào khác hơn không
                    var isCloserToOther = false;
                    var myDist = Math.sqrt((lx - cCx) * (lx - cCx) + (ly - cCy) * (ly - cCy));
                    for (var oi = 0; oi < validClusters.length; oi++) {
                        if (oi === bi) continue;
                        var oC = validClusters[oi];
                        var oCx = (oC.minX + oC.maxX) / 2, oCy = (oC.minY + oC.maxY) / 2;
                        var oDist = Math.sqrt((lx - oCx) * (lx - oCx) + (ly - oCy) * (ly - oCy));
                        if (oDist < myDist * 0.85) {
                            isCloserToOther = true;
                            break;
                        }
                    }
                    if (!isCloserToOther) {
                        boxLabels.push(lTxt);
                    }
                }
            }

            // 2. Tìm Combo Title / Section Header (khoảng cách Y từ -40 đến 320mm)
            var comboTitle = '';
            var minTitleDist = Infinity;
            for (var ti = 0; ti < docLabels.length; ti++) {
                var tLbl = docLabels[ti];
                var yDist = tLbl.cy - bClust.maxY;
                var xDist = Math.abs(tLbl.cx - cCx);
                if (yDist >= -40 && yDist <= 320 && xDist <= (bClust.w / 2 + 300)) {
                    var txtLow = tLbl.text.toLowerCase();
                    if (txtLow.indexOf('tất cả') !== -1) continue;
                    if (txtLow.indexOf('bộ hộp âm dương') !== -1 || txtLow.indexOf('âm dương') !== -1 ||
                        txtLow.indexOf('hộp bánh trung thu') !== -1 || txtLow.indexOf('bánh trung thu') !== -1 ||
                        txtLow.indexOf('nắp rút') !== -1 || txtLow.indexOf('đồ ăn nhanh') !== -1 ||
                        txtLow.indexOf('gà rán & burger') !== -1 || txtLow.indexOf('hộp bánh sinh nhật') !== -1 ||
                        txtLow.indexOf('bì thư') !== -1 || txtLow.indexOf('thùng carton') !== -1 ||
                        txtLow.indexOf('nắp gài & đáy dán') !== -1) {
                        var totDist = Math.sqrt(xDist * xDist + yDist * yDist);
                        if (totDist < minTitleDist) {
                            minTitleDist = totDist;
                            comboTitle = tLbl.text;
                        }
                    }
                }
            }

            // 3. Phân tích văn bản & thông số kích thước DRC
            var fullInnerText = boxLabels.join(' ');
            var lowText = fullInnerText.toLowerCase();
            var drcVals = parseDRC(fullInnerText);
            var drc = null;

            var groupName = 'Hộp nắp gài & Đáy dán';
            var subName = '';
            var boxType = 'reverse-tuck';
            var comboLow = (comboTitle || '').toLowerCase();

            // Tính toán kích thước hộp ước lượng chuẩn xác từ kích thước trải khuôn
            var estTuckW = Math.max(25, Math.round((bClust.w - 15) / 4));
            var estTuckH = Math.max(30, Math.round(bClust.h - 2 * estTuckW));
            if (estTuckH < 30) estTuckH = Math.max(30, Math.round(bClust.h * 0.55));
            var defaultTuckDRC = { L: estTuckW, W: estTuckW, H: estTuckH };

            // A. Nhóm: BỘ HỘP ÂM DƯƠNG KÈM TÚI
            if (comboLow.indexOf('âm dương') !== -1 || lowText.indexOf('âm dương') !== -1 ||
                (lowText.indexOf('đáy hộp') !== -1 && lowText.indexOf('37') !== -1) ||
                (lowText.indexOf('nắp hộp') !== -1 && lowText.indexOf('37.5') !== -1)) {
                groupName = 'Bộ hộp Âm Dương Kèm túi';
                if (lowText.indexOf('đáy') !== -1) {
                    subName = 'Đáy hộp';
                    boxType = 'tray';
                    if (drcVals) {
                        var dArr = [drcVals.d1, drcVals.d2, drcVals.d3].sort(function (a, b) { return a - b; });
                        drc = { L: dArr[2], W: dArr[1], H: dArr[0] };
                    } else {
                        drc = { L: 370, W: 300, H: 70 };
                    }
                } else if (lowText.indexOf('nắp') !== -1) {
                    subName = 'Nắp hộp';
                    boxType = 'tray';
                    if (drcVals) {
                        var dArr = [drcVals.d1, drcVals.d2, drcVals.d3].sort(function (a, b) { return a - b; });
                        drc = { L: dArr[2], W: dArr[1], H: dArr[0] };
                    } else {
                        drc = { L: 375, W: 305, H: 40 };
                    }
                } else if (lowText.indexOf('túi') !== -1 || bClust.h > bClust.w * 0.7) {
                    subName = 'Túi giấy xách ngoài';
                    boxType = 'tote-bag';
                    if (drcVals) {
                        var dArr = [drcVals.d1, drcVals.d2, drcVals.d3].sort(function (a, b) { return a - b; });
                        drc = { L: dArr[2], W: dArr[0], H: dArr[1] };
                    } else {
                        drc = { L: 385, W: 80, H: 315 };
                    }
                } else {
                    subName = 'Khay âm dương';
                    boxType = 'tray';
                    drc = { L: 370, W: 300, H: 60 };
                }
            }
            // B. Nhóm: BỘ HỘP BÁNH TRUNG THU NẮP RÚT
            else if (comboLow.indexOf('nắp rút') !== -1 || (comboLow.indexOf('trung thu') !== -1 && comboLow.indexOf('2 bánh') === -1) || lowText.indexOf('nắp rút') !== -1) {
                groupName = 'Bộ hộp bánh trung thu (Nắp rút)';
                if (lowText.indexOf('rút') !== -1 || lowText.indexOf('vỏ bao') !== -1 || lowText.indexOf('hộp mẹ') !== -1 || (bClust.w > bClust.h * 1.5 && bClust.paths.length <= 10)) {
                    subName = 'Vỏ hộp mẹ dạng ống rút';
                    boxType = 'sleeve-drawer';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 320, W: 255, H: 75 };
                } else if (lowText.indexOf('định hình') !== -1 || (bClust.innerCutouts && bClust.innerCutouts.length >= 3)) {
                    subName = 'Khay định hình 4 ô';
                    boxType = 'divider-tray';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 305, W: 240, H: 45 };
                } else if (lowText.indexOf('khay') !== -1 || lowText.indexOf('đáy') !== -1) {
                    subName = 'Khay đựng';
                    boxType = 'tray';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 310, W: 245, H: 70 };
                } else if (lowText.indexOf('trà') !== -1) {
                    subName = 'Hộp trà';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 75, W: 75, H: 140 };
                } else if (lowText.indexOf('con') !== -1) {
                    subName = 'Hộp con đựng bánh';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 85, W: 85, H: 55 };
                } else if (lowText.indexOf('túi') !== -1) {
                    subName = 'Túi giấy xách ngoài';
                    boxType = 'tote-bag';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 340, W: 90, H: 280 };
                } else {
                    subName = 'Khay hộp trung thu';
                    boxType = 'tray';
                    drc = { L: 310, W: 245, H: 70 };
                }
            }
            // C. Nhóm: COMBO ĐỒ ĂN NHANH (Gà rán & Burger)
            else if (comboLow.indexOf('đồ ăn nhanh') !== -1 || comboLow.indexOf('gà rán') !== -1 || comboLow.indexOf('burger') !== -1 ||
                     lowText.indexOf('gà rán') !== -1 || lowText.indexOf('hamburger') !== -1 || lowText.indexOf('burger') !== -1 || lowText.indexOf('khoai tây') !== -1) {
                groupName = 'Combo Đồ ăn nhanh (Gà rán & Burger)';
                if (lowText.indexOf('hamburger') !== -1 || lowText.indexOf('burger') !== -1) {
                    subName = 'Hộp bánh Hamburger';
                    boxType = 'burger-box';
                    drc = (drcVals && drcVals.d1 <= 150) ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 105, W: 105, H: 70 };
                } else if (lowText.indexOf('khoai tây') !== -1) {
                    subName = 'Hộp đựng khoai tây chiên';
                    boxType = 'fries-box';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 85, W: 50, H: 110 };
                } else if (lowText.indexOf('túi') !== -1) {
                    subName = 'Túi đựng gà rán';
                    boxType = 'chicken-bag';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 200, W: 100, H: 300 };
                } else {
                    subName = 'Hộp đựng gà rán';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 200, W: 120, H: 70 };
                }
            }
            // D. Nhóm: HỘP BÁNH SINH NHẬT
            else if (comboLow.indexOf('sinh nhật') !== -1 || lowText.indexOf('sinh nhật') !== -1 || lowText.indexOf('bánh kem') !== -1) {
                groupName = 'Hộp bánh sinh nhật';
                subName = 'Hộp bánh sinh nhật';
                boxType = 'cake-box';
                drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 260, W: 260, H: 180 };
            }
            // E. Nhóm: HỘP BÁNH TRUNG THU 2 BÁNH
            else if (comboLow.indexOf('2 bánh') !== -1 || lowText.indexOf('2 bánh') !== -1) {
                groupName = 'Hộp bánh trung thu 2 bánh';
                subName = 'Hộp bánh trung thu 2 bánh';
                boxType = 'reverse-tuck';
                drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 180, W: 95, H: 60 };
            }
            // F. Nhóm: TÚI GIẤY & BÌ THƯ
            else if (comboLow.indexOf('bì thư') !== -1 || lowText.indexOf('túi giấy') !== -1 || lowText.indexOf('bì thư') !== -1 || lowText.indexOf('phong bì') !== -1) {
                groupName = 'Túi giấy & Bì thư';
                if (lowText.indexOf('bì thư') !== -1 || lowText.indexOf('phong bì') !== -1) {
                    var isBig = (lowText.indexOf('25x34') !== -1 || lowText.indexOf('25×34') !== -1 || bClust.w > 300);
                    subName = isBig ? 'Bì thư 25x34' : 'Bì thư 12x22';
                    boxType = 'envelope';
                    drc = isBig ? { L: 340, W: 250, H: 15 } : { L: 220, W: 120, H: 10 };
                } else if (lowText.indexOf('có nắp') !== -1) {
                    subName = 'Túi giấy có nắp';
                    boxType = 'chicken-bag';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 250, W: 100, H: 300 };
                } else {
                    subName = 'Túi giấy không nắp';
                    boxType = 'tote-bag';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: 250, W: 100, H: 300 };
                }
            }
            // G. Nhóm: HỘP NẮP GÀI & ĐÁY DÁN (Bao gồm 8 mẫu chuẩn trong bộ khuôn)
            else {
                groupName = 'Hộp nắp gài & Đáy dán';
                if (lowText.indexOf('đáy khóa') !== -1 || lowText.indexOf('gài đáy khóa') !== -1 || lowText.indexOf('khóa') !== -1) {
                    subName = 'Hộp nắp gài đáy khóa';
                    boxType = 'crash-lock';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : defaultTuckDRC;
                } else if (lowText.indexOf('cùng chiều') !== -1) {
                    subName = (lowText.indexOf('mép dán') !== -1) ? 'Hộp 2 nắp cùng chiều mép dán' : 'Hộp 2 nắp cùng chiều';
                    boxType = 'straight-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : defaultTuckDRC;
                } else if (lowText.indexOf('quai xách') !== -1 || lowText.indexOf('chóp') !== -1) {
                    subName = 'Hộp chóp có quai xách';
                    boxType = 'gable-box';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: Math.round((bClust.w - 15) * 0.28), W: Math.round((bClust.w - 15) * 0.22), H: Math.round(bClust.h * 0.55) };
                } else if (lowText.indexOf('dẹp') !== -1 || lowText.indexOf('đẹp') !== -1) {
                    subName = 'Hộp dẹp - đáy dán';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: Math.round((bClust.w - 15) * 0.35), W: Math.round((bClust.w - 15) * 0.15), H: estTuckH };
                } else if (lowText.indexOf('đáy dán') !== -1) {
                    subName = 'Hộp đáy dán';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : defaultTuckDRC;
                } else if (lowText.indexOf('thùng') !== -1 || lowText.indexOf('carton') !== -1) {
                    subName = 'Thùng carton';
                    boxType = 'rsc-carton';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : { L: Math.round(bClust.w * 0.35), W: Math.round(bClust.w * 0.25), H: Math.round(bClust.h * 0.4) };
                } else if (lowText.indexOf('gài') !== -1 || lowText.indexOf('nắp gài') !== -1) {
                    subName = 'Hộp nắp gài đáy gài';
                    boxType = 'reverse-tuck';
                    drc = drcVals ? { L: drcVals.d1, W: drcVals.d2, H: drcVals.d3 } : defaultTuckDRC;
                } else {
                    // Fallback theo hình học: chỉ khi có chữ 'khay' rõ ràng mới là khay, còn lại mặc định là hộp gài
                    if (lowText.indexOf('khay') !== -1) {
                        subName = 'Khay hộp';
                        boxType = 'tray';
                        var estH = Math.min(bClust.w, bClust.h) * 0.18;
                        drc = { L: Math.round(bClust.w - 2 * estH), W: Math.round(bClust.h - 2 * estH), H: Math.round(estH) };
                    } else {
                        subName = 'Hộp nắp gài';
                        boxType = 'reverse-tuck';
                        drc = defaultTuckDRC;
                    }
                }
            }

            var finalName = subName;
            if (drc) {
                finalName += ' (' + Math.round(drc.L) + '×' + Math.round(drc.W) + '×' + Math.round(drc.H) + 'mm)';
            }

            // 4. Chuẩn hóa toạ độ các đường cắt & cấn về gốc (0,0) của hộp này
            function normBoxPts(pts, oX, oY) {
                var res = [];
                for (var np = 0; np < pts.length; np++) {
                    res.push([pts[np][0] - oX, pts[np][1] - oY]);
                }
                return res;
            }

            var bCuts = [];
            var bCreases = [];

            for (var pIdx = 0; pIdx < bClust.paths.length; pIdx++) {
                var cPath = bClust.paths[pIdx];
                var nPts = normBoxPts(cPath.pts, bClust.minX, bClust.minY);
                if (cPath.isCrease) {
                    bCreases.push(nPts);
                } else {
                    bCuts.push({ pts: nPts, closed: cPath.closed });
                }
            }

            boxesData.push({
                id: 'scanned_box_' + (bi + 1),
                name: finalName,
                group: groupName,
                comboTitle: comboTitle || null,
                boxType: boxType,
                drc: drc,
                width: bClust.w,
                height: bClust.h,
                cutsCount: bCuts.length,
                creasesCount: bCreases.length,
                rect: { x0: 0, y0: 0, w: bClust.w, h: bClust.h },
                cuts: bCuts,
                creases: bCreases
            });
        }

        return _ps3dOk({
            docName: doc.name,
            totalBoxes: boxesData.length,
            boxes: boxesData,
            activeBox: boxesData.length > 0 ? boxesData[0] : null
        });
    } catch (e) {
        return _ps3dErr(e);
    }
}

/* jshint ignore:end */

