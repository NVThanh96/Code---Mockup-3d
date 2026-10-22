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


// ════════════════════════════════════════════════════════════════════════════
// PAGE LAYOUT ANALYZER — Quét file khuôn tổng hợp (vd "Tất cả bộ khuôn hộp plus.pdf")
//   Bước 1: Tìm KHUNG NHÓM (CONTAINER_FRAME) — hình chữ nhật bao ngoài, không chạm nét khuôn,
//           chứa khuôn + tiêu đề. Khung KHÔNG bao giờ thành mặt phẳng 3D hay mẫu hộp.
//   Bước 2: Gom cụm khuôn, gộp lỗ khoét vào khuôn mẹ, loại mảnh phụ / mẫu rác (faceCount < 4).
//   Bước 3: Loại đường ghi kích thước (ANNOTATION_LINE) cạnh text "37cm", "30cm"…
//   Bước 4: Đặt tên nhóm / tên mẫu từ tiêu đề trong khung, nhận diện loại cấu trúc + DRC (L×W×H mm).
// ════════════════════════════════════════════════════════════════════════════
var PS3D_CLEAN_LAYER = 'KHUON CHUAN HOA 2D';

// Bỏ dấu tiếng Việt + chữ thường → so khớp từ khóa ASCII (bền với PDF lưu dấu tổ hợp)
function _ps3dFold(s) {
    s = String(s || '').toLowerCase();
    var groups = [
        ['a', '\u00e0\u00e1\u1ea1\u1ea3\u00e3\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5'],
        ['e', '\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5'],
        ['i', '\u00ec\u00ed\u1ecb\u1ec9\u0129'],
        ['o', '\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1'],
        ['u', '\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef'],
        ['y', '\u1ef3\u00fd\u1ef5\u1ef7\u1ef9'],
        ['d', '\u0111\u0110']
    ];
    var out = '';
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i), code = s.charCodeAt(i);
        if (code >= 0x0300 && code <= 0x036f) continue; // dấu tổ hợp
        var rep = ch;
        for (var g = 0; g < groups.length; g++) {
            if (groups[g][1].indexOf(ch) !== -1) { rep = groups[g][0]; break; }
        }
        out += rep;
    }
    return ' ' + out.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}
function _ps3dHas(f, keys) {
    for (var i = 0; i < keys.length; i++) if (f.indexOf(keys[i]) !== -1) return true;
    return false;
}

// DRC "9.5x9.5x7cm", "37*7*30", "14 x 14 x 17 cm" → { a, b, c } mm (giữ thứ tự viết)
function _ps3dParseDRC(str) {
    if (!str) return null;
    var rx = /([0-9]+(?:[.,][0-9]+)?)\s*(?:cm|mm)?\s*[x\u00d7\*X]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:cm|mm)?\s*[x\u00d7\*X]\s*([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|m)?/i;
    var m = String(str).match(rx);
    if (!m) return null;
    var a = parseFloat(m[1].replace(',', '.')), b = parseFloat(m[2].replace(',', '.')), c = parseFloat(m[3].replace(',', '.'));
    var unit = (m[4] || '').toLowerCase();
    if (!unit) {
        var low = String(str).toLowerCase();
        if (low.indexOf('mm') !== -1) unit = 'mm';
        else if (low.indexOf('cm') !== -1) unit = 'cm';
    }
    var k = unit === 'mm' ? 1 : (unit === 'cm' ? 10 : ((a <= 80 && b <= 80 && c <= 80) ? 10 : 1));
    return { a: a * k, b: b * k, c: c * k };
}
// "12x22" (bì thư) → { a, b } mm
function _ps3dParse2D(str) {
    var m = String(str || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*[x\u00d7\*X]\s*([0-9]+(?:[.,][0-9]+)?)/);
    if (!m) return null;
    var a = parseFloat(m[1].replace(',', '.')), b = parseFloat(m[2].replace(',', '.'));
    var k = (a <= 80 && b <= 80) ? 10 : 1;
    return { a: a * k, b: b * k };
}

// Kích thước mặc định (mm) theo loại khi file không ghi DRC
var PS3D_TYPE_DEFAULTS = {
    'burger-box': { L: 95, W: 95, H: 70 }, 'fries-box': { L: 85, W: 50, H: 110 },
    'chicken-bag': { L: 200, W: 100, H: 300 }, 'mailer-box': { L: 130, W: 130, H: 60 },
    'double-wall-tray': { L: 370, W: 300, H: 70 }, 'tote-bag': { L: 250, W: 100, H: 300 },
    'sleeve-drawer': { L: 320, W: 255, H: 75 }, 'tray': { L: 315, W: 250, H: 72 },
    'divider-tray': { L: 305, W: 240, H: 45 }, 'reverse-tuck': { L: 60, W: 50, H: 100 },
    'straight-tuck': { L: 60, W: 40, H: 120 }, 'crash-lock': { L: 60, W: 50, H: 100 },
    'gable-box': { L: 140, W: 90, H: 100 }, 'rsc-carton': { L: 300, W: 200, H: 200 },
    'cake-box': { L: 260, W: 260, H: 180 }, 'envelope': { L: 220, W: 120, H: 10 }
};

var PS3D_TYPE_NAMES = {
    'burger-box': 'H\u1ED9p b\u00E1nh Hamburger', 'fries-box': 'H\u1ED9p \u0111\u1EF1ng khoai t\u00E2y chi\u00EAn',
    'chicken-bag': 'T\u00FAi \u0111\u1EF1ng g\u00E0 r\u00E1n', 'mailer-box': 'H\u1ED9p g\u00E0 vu\u00F4ng n\u1EAFp g\u1EADp',
    'double-wall-tray': 'Khay \u00C2m D\u01B0\u01A1ng', 'tote-bag': 'T\u00FAi gi\u1EA5y',
    'sleeve-drawer': 'V\u1ECF h\u1ED9p m\u1EB9 n\u1EAFp r\u00FAt', 'tray': 'Khay \u0111\u00E1y h\u1ED9p m\u1EB9',
    'divider-tray': 'Khay \u0111\u1ECBnh h\u00ECnh 4 \u00F4', 'reverse-tuck': 'H\u1ED9p n\u1EAFp g\u00E0i',
    'straight-tuck': 'H\u1ED9p 2 n\u1EAFp c\u00F9ng chi\u1EC1u', 'crash-lock': 'H\u1ED9p n\u1EAFp g\u00E0i \u0111\u00E1y kh\u00F3a',
    'gable-box': 'H\u1ED9p ch\u00F3p c\u00F3 quai x\u00E1ch', 'rsc-carton': 'Th\u00F9ng carton',
    'cake-box': 'H\u1ED9p b\u00E1nh sinh nh\u1EADt', 'envelope': 'B\u00EC th\u01B0'
};

var PS3D_LIB_GROUPS = {
    trungthu: 'B\u1ED9 h\u1ED9p b\u00E1nh trung thu n\u1EAFp r\u00FAt',
    amduong: 'B\u1ED9 h\u1ED9p \u00C2m D\u01B0\u01A1ng K\u00E8m t\u00FAi',
    fastfood: 'Combo \u0110\u1ED3 \u0103n nhanh',
    bagenv: 'T\u00FAi gi\u1EA5y & B\u00EC th\u01B0',
    single: 'H\u1ED9p \u0111\u01A1n ti\u00EAu chu\u1EA9n'
};

// Nhận diện nhóm + loại cấu trúc từ text (đã fold)
function _ps3dClassify(fBox, fGroup, info) {
    var fAll = fBox + fGroup;
    var lib = 'single';
    if (_ps3dHas(fAll, ['am duong'])) lib = 'amduong';
    else if (_ps3dHas(fAll, [' 2 banh', 'hai banh'])) lib = 'single';
    else if (_ps3dHas(fGroup + fBox, ['nap rut', 'hop me', 'trung thu'])) lib = 'trungthu';
    else if (_ps3dHas(fAll, ['do an nhanh', 'ga ran', 'burger', 'khoai tay', 'ga vuong'])) lib = 'fastfood';
    else if (_ps3dHas(fAll, ['bi thu', 'phong bi', 'tui giay'])) lib = 'bagenv';

    var t = null, f = fBox.length > 3 ? fBox : fAll;
    if (_ps3dHas(f, ['hamburger', 'burger'])) t = 'burger-box';
    else if (_ps3dHas(f, ['khoai tay'])) t = 'fries-box';
    else if (_ps3dHas(f, ['bi thu', 'phong bi'])) t = 'envelope';
    else if (_ps3dHas(f, ['sinh nhat', 'banh kem'])) t = 'cake-box';
    else if (lib === 'amduong') {
        t = _ps3dHas(f, ['tui']) ? 'tote-bag' : 'double-wall-tray';
    } else if (lib === 'fastfood') {
        if (_ps3dHas(f, ['tui'])) t = 'chicken-bag';
        else t = 'mailer-box'; // hộp gà rán / hộp gà vuông nắp gập
    } else if (lib === 'trungthu') {
        if (_ps3dHas(f, ['dinh hinh', '4 o', 'bon o']) || info.innerCutouts >= 3) t = 'divider-tray';
        else if (_ps3dHas(f, ['tui'])) t = 'tote-bag';
        else if (_ps3dHas(f, ['hop tra', ' tra '])) t = 'reverse-tuck';
        else if (_ps3dHas(f, ['hop con'])) t = 'reverse-tuck';
        else if (_ps3dHas(f, ['khay', 'day hop'])) t = 'tray';
        else if (_ps3dHas(f, ['vo ', 'nap rut', 'hop me', 'ong rut'])) t = 'sleeve-drawer';
        else t = 'reverse-tuck';
    } else if (_ps3dHas(f, ['tui'])) t = 'tote-bag';
    else if (_ps3dHas(f, ['quai xach', 'chop'])) t = 'gable-box';
    else if (_ps3dHas(f, ['thung', 'carton'])) t = 'rsc-carton';
    else if (_ps3dHas(f, ['day khoa', 'khoa day', 'crash'])) t = 'crash-lock';
    else if (_ps3dHas(f, ['cung chieu'])) t = 'straight-tuck';
    else if (_ps3dHas(f, [' 2 banh', 'dep', 'day dan', 'nap gai', ' gai'])) t = 'reverse-tuck';
    else if (_ps3dHas(f, ['khay'])) t = 'tray';
    return { lib: lib, type: t };
}

// Gán DRC (chuỗi viết a×b×c) → L, W, H theo quy ước từng loại
function _ps3dDRCFor(type, raw, textAll) {
    if (type === 'envelope') {
        var e = _ps3dParse2D(textAll);
        if (e) return { L: Math.max(e.a, e.b), W: Math.min(e.a, e.b), H: 10 };
        return null;
    }
    if (!raw) return null;
    var v = [raw.a, raw.b, raw.c];
    if (type === 'double-wall-tray' || type === 'tray' || type === 'divider-tray' || type === 'sleeve-drawer' || type === 'mailer-box') {
        v.sort(function (x, y) { return y - x; });
        return { L: v[0], W: v[1], H: v[2] };       // khay: dài > rộng > cao
    }
    if (type === 'tote-bag' || type === 'chicken-bag') {
        var iMin = 0;
        for (var i = 1; i < 3; i++) if (v[i] < v[iMin]) iMin = i;
        var rest = [];
        for (var j = 0; j < 3; j++) if (j !== iMin) rest.push(v[j]);
        return { L: rest[0], W: v[iMin], H: rest[1] }; // túi: hông (W) mỏng nhất
    }
    return { L: v[0], W: v[1], H: v[2] };           // hộp: Dài × Rộng × Cao như ghi trên khuôn
}

function ps3d_scanDieline() {
    try {
        if (!app.documents.length) return _ps3dErr('Ch\u01B0a m\u1EDF file n\u00E0o trong Illustrator.');
        var doc = app.activeDocument;
        var toMM = 25.4 / 72.0;
        function pt2mm(pt) { return [pt[0] * toMM, pt[1] * toMM]; }

        var allPaths = [];
        var hasSelection = (doc.selection && doc.selection.length > 0);

        function skipLayerName(n) {
            var f = _ps3dFold(n);
            return _ps3dHas(f, ['ps3d_data', 'dims', ' dim ', 'kich thuoc', 'kich_thuoc', 'annotation', 'ghi chu', 'ghi_chu',
                'bleed', ' tran ', 'tran le', 'khuon chuan hoa']);
        }
        function isBleedColor(c) {
            if (!c) return false;
            if (c.typename === 'CMYKColor') return c.cyan > 35 && c.yellow > 45 && c.magenta < 25;
            if (c.typename === 'RGBColor') return c.green > 120 && c.green > c.red * 1.25 && c.green > c.blue * 1.25;
            if (c.typename === 'SpotColor') return _ps3dHas(_ps3dFold(c.spot && c.spot.name), ['bleed', 'tran']);
            return false;
        }
        function isCreaseStyle(item, lName, c) {
            var f = _ps3dFold(lName);
            if (_ps3dHas(f, ['crease', ' can ', 'gap', 'fold'])) return true;
            if (item.strokeDashes && item.strokeDashes.length > 0) return true;
            if (!c) return false;
            if (c.typename === 'CMYKColor') return (c.magenta > 40 && c.yellow > 35 && c.cyan < 35) || (c.magenta > 50 && c.cyan < 35);
            if (c.typename === 'RGBColor') return c.red > 150 && c.red > c.green * 1.3 && c.red > c.blue * 1.3;
            if (c.typename === 'SpotColor') return _ps3dHas(_ps3dFold(c.spot && c.spot.name), ['crease', ' can', 'fold', 'red', 'gap']);
            return false;
        }

        function collectFromItem(item, layerName) {
            if (!item) return;
            try { if (item.hidden || item.guides) return; } catch (eH) {}
            var t = item.typename;
            if (t === 'PathItem') {
                if (!item.pathPoints || item.pathPoints.length < 2) return;
                var sColor = item.stroked ? item.strokeColor : null;
                if (isBleedColor(sColor)) return;
                if (!item.stroked && !item.filled) return;
                var pts = [], numPts = item.pathPoints.length, isClosed = item.closed;
                var segCount = isClosed ? numPts : numPts - 1;
                for (var i = 0; i < segCount; i++) {
                    var p0 = item.pathPoints[i], p1 = item.pathPoints[(i + 1) % numPts];
                    var a0 = p0.anchor, r0 = p0.rightDirection, l1 = p1.leftDirection, a1 = p1.anchor;
                    pts.push(pt2mm(a0));
                    var dR = Math.abs(r0[0] - a0[0]) + Math.abs(r0[1] - a0[1]);
                    var dL = Math.abs(l1[0] - a1[0]) + Math.abs(l1[1] - a1[1]);
                    if (dR > 0.4 || dL > 0.4) {
                        for (var st = 1; st < 6; st++) {
                            var bT = st / 6, mt = 1 - bT;
                            pts.push(pt2mm([
                                mt * mt * mt * a0[0] + 3 * mt * mt * bT * r0[0] + 3 * mt * bT * bT * l1[0] + bT * bT * bT * a1[0],
                                mt * mt * mt * a0[1] + 3 * mt * mt * bT * r0[1] + 3 * mt * bT * bT * l1[1] + bT * bT * bT * a1[1]
                            ]));
                        }
                    }
                }
                if (!isClosed) pts.push(pt2mm(item.pathPoints[numPts - 1].anchor));
                allPaths.push({ pts: pts, closed: isClosed, anchors: numPts, isCrease: isCreaseStyle(item, layerName, sColor) });
            } else if (t === 'GroupItem') {
                for (var g = 0; g < item.pageItems.length; g++) collectFromItem(item.pageItems[g], layerName);
            } else if (t === 'CompoundPathItem') {
                for (var c = 0; c < item.pathItems.length; c++) collectFromItem(item.pathItems[c], layerName);
            }
        }

        if (hasSelection) {
            for (var si = 0; si < doc.selection.length; si++) {
                var sIt = doc.selection[si];
                var sLn = sIt.layer ? sIt.layer.name : '';
                if (!skipLayerName(sLn)) collectFromItem(sIt, sLn);
            }
        } else {
            for (var l = 0; l < doc.layers.length; l++) {
                var lyr = doc.layers[l];
                if (!lyr.visible || skipLayerName(lyr.name)) continue;
                for (var p = 0; p < lyr.pageItems.length; p++) collectFromItem(lyr.pageItems[p], lyr.name);
            }
        }
        if (allPaths.length === 0) return _ps3dErr('Kh\u00F4ng t\u00ECm th\u1EA5y \u0111\u01B0\u1EDDng vector n\u00E0o \u0111\u1EC3 qu\u00E9t khu\u00F4n.');

        // ── Bounding box + nhận dạng hình chữ nhật ─────────────────────────────
        var k, q;
        for (k = 0; k < allPaths.length; k++) {
            var P0 = allPaths[k], mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
            for (q = 0; q < P0.pts.length; q++) {
                var px = P0.pts[q][0], py = P0.pts[q][1];
                if (px < mnX) mnX = px; if (px > mxX) mxX = px;
                if (py < mnY) mnY = py; if (py > mxY) mxY = py;
            }
            P0.minX = mnX; P0.minY = mnY; P0.maxX = mxX; P0.maxY = mxY;
            P0.w = mxX - mnX; P0.h = mxY - mnY; P0.idx = k;
            P0.kind = 'DIELINE';
            var rect = P0.closed && P0.anchors >= 4 && P0.anchors <= 5 && P0.pts.length <= 5;
            if (rect) {
                for (q = 0; q < P0.pts.length; q++) {
                    var onX = Math.abs(P0.pts[q][0] - mnX) < 0.8 || Math.abs(P0.pts[q][0] - mxX) < 0.8;
                    var onY = Math.abs(P0.pts[q][1] - mnY) < 0.8 || Math.abs(P0.pts[q][1] - mxY) < 0.8;
                    if (!onX || !onY) { rect = false; break; }
                }
            }
            P0.isRect = rect;
        }

        // ── Text trong tài liệu ────────────────────────────────────────────────
        var texts = [];
        for (var ti = 0; ti < doc.textFrames.length; ti++) {
            try {
                var tf = doc.textFrames[ti];
                if (tf.hidden) continue;
                if (tf.layer && (_ps3dHas(_ps3dFold(tf.layer.name), ['ps3d_data', 'khuon chuan hoa']))) continue;
                var raw = String(tf.contents || '').replace(/[\r\n\u0003]+/g, ' ').replace(/^\s+|\s+$/g, '');
                if (!raw.length) continue;
                var gbT = tf.geometricBounds; // [left, top, right, bottom] pt
                var tx0 = gbT[0] * toMM, ty1 = gbT[1] * toMM, tx1 = gbT[2] * toMM, ty0 = gbT[3] * toMM;
                texts.push({
                    text: raw, fold: _ps3dFold(raw),
                    minX: tx0, maxX: tx1, minY: ty0, maxY: ty1,
                    cx: (tx0 + tx1) / 2, cy: (ty0 + ty1) / 2,
                    isDim: /^\s*[0-9]+(?:[.,][0-9]+)?\s*(?:cm|mm|m)?\s*$/i.test(raw),
                    isDRC: !!_ps3dParseDRC(raw)
                });
            } catch (eTF) {}
        }

        function inside(a, b, tol) { // a nằm trong b
            return a.minX >= b.minX - tol && a.maxX <= b.maxX + tol && a.minY >= b.minY - tol && a.maxY <= b.maxY + tol;
        }
        function ptInBox(x, y, b, tol) { return x >= b.minX - tol && x <= b.maxX + tol && y >= b.minY - tol && y <= b.maxY + tol; }

        // Artboard (để loại khung viền trang)
        var abR = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
        var abW = Math.abs(abR[2] - abR[0]) * toMM, abH = Math.abs(abR[1] - abR[3]) * toMM;

        // ════ BƯỚC 1: KHUNG NHÓM (CONTAINER_FRAME) ════════════════════════════
        var containers = [];
        for (k = 0; k < allPaths.length; k++) {
            var F0 = allPaths[k];
            if (!F0.isRect || F0.w < 40 || F0.h < 30) continue;
            if (F0.w > abW * 0.92 && F0.h > abH * 0.92) { F0.kind = 'CONTAINER_FRAME'; F0.pageFrame = true; continue; }
            var nIn = 0, nTouch = 0, nTxt = 0, tol = 1.2;
            for (var o = 0; o < allPaths.length; o++) {
                if (o === k) continue;
                var Q = allPaths[o];
                if (Q.maxX < F0.minX - tol || Q.minX > F0.maxX + tol || Q.maxY < F0.minY - tol || Q.minY > F0.maxY + tol) continue;
                if (inside(Q, F0, 0.3) && !(Math.abs(Q.w - F0.w) < 0.5 && Math.abs(Q.h - F0.h) < 0.5)) nIn++;
                for (q = 0; q < Q.pts.length; q++) {
                    var vx = Q.pts[q][0], vy = Q.pts[q][1];
                    var nearV = (Math.abs(vx - F0.minX) < tol || Math.abs(vx - F0.maxX) < tol) && vy > F0.minY - tol && vy < F0.maxY + tol;
                    var nearH = (Math.abs(vy - F0.minY) < tol || Math.abs(vy - F0.maxY) < tol) && vx > F0.minX - tol && vx < F0.maxX + tol;
                    if (nearV || nearH) { nTouch++; break; }
                }
            }
            for (var tt = 0; tt < texts.length; tt++) if (ptInBox(texts[tt].cx, texts[tt].cy, F0, 0)) nTxt++;
            // Khung nhóm: chứa nét khuôn bên trong, có tiêu đề (hoặc rất nhiều nét), và KHÔNG dính vào nét khuôn nào
            if (nIn >= 1 && nTouch <= 1 && (nTxt >= 1 || nIn >= 6)) {
                F0.kind = 'CONTAINER_FRAME';
                containers.push({ minX: F0.minX, minY: F0.minY, maxX: F0.maxX, maxY: F0.maxY, area: F0.w * F0.h, path: F0, children: [], clusters: [] });
            }
        }
        containers.sort(function (a, b) { return b.area - a.area; });
        for (k = 0; k < containers.length; k++) {
            containers[k].id = k;
            containers[k].parent = null;
            for (var pk = k - 1; pk >= 0; pk--) {          // khung nhỏ nhất (đã xét trước, lớn hơn) chứa nó
                if (inside(containers[k], containers[pk], 0.5)) {
                    if (!containers[k].parent || containers[pk].area < containers[k].parent.area) containers[k].parent = containers[pk];
                }
            }
            if (containers[k].parent) containers[k].parent.children.push(containers[k]);
        }
        function innermostContainer(b) {
            var best = null;
            for (var i = 0; i < containers.length; i++) {
                if (inside(b, containers[i], 1.0) && (!best || containers[i].area < best.area)) best = containers[i];
            }
            return best;
        }
        // Tiêu đề khung = text nằm cao nhất bên trong khung, không thuộc khung con, không phải số đo
        function containerTitle(c) {
            var best = null;
            for (var i = 0; i < texts.length; i++) {
                var T = texts[i];
                if (T.isDim || !ptInBox(T.cx, T.cy, c, 0)) continue;
                var inChild = false;
                for (var j = 0; j < c.children.length; j++) if (ptInBox(T.cx, T.cy, c.children[j], 0)) { inChild = true; break; }
                if (inChild) continue;
                if (!best || T.maxY > best.maxY) best = T;
            }
            return best;
        }

        // ════ BƯỚC 3: ĐƯỜNG GHI KÍCH THƯỚC (ANNOTATION_LINE) ══════════════════
        function distPtSeg(px, py, a, b) {
            var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
            var t = L2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
            t = Math.max(0, Math.min(1, t));
            var ex = a[0] + dx * t - px, ey = a[1] + dy * t - py;
            return Math.sqrt(ex * ex + ey * ey);
        }
        function distPtPath(px, py, P) {
            var best = Infinity, n = P.pts.length, segs = P.closed ? n : n - 1;
            for (var i = 0; i < segs; i++) {
                var d = distPtSeg(px, py, P.pts[i], P.pts[(i + 1) % n]);
                if (d < best) best = d;
            }
            return best;
        }
        function endpointTouches(P, pt, tol) {
            for (var i = 0; i < allPaths.length; i++) {
                var Q = allPaths[i];
                if (Q === P || Q.kind !== 'DIELINE') continue;
                if (pt[0] < Q.minX - tol || pt[0] > Q.maxX + tol || pt[1] < Q.minY - tol || pt[1] > Q.maxY + tol) continue;
                if (distPtPath(pt[0], pt[1], Q) <= tol) return true;
            }
            return false;
        }
        var dimTexts = [];
        for (k = 0; k < texts.length; k++) if (texts[k].isDim) dimTexts.push(texts[k]);

        function nearDimText(P) {
            var a = P.pts[0], b = P.pts[P.pts.length - 1];
            for (var i = 0; i < dimTexts.length; i++) {
                var T = dimTexts[i];
                var reach = Math.max(6, (T.maxY - T.minY) * 1.6);
                if (distPtSeg(T.cx, T.cy, a, b) <= reach) return true;
            }
            return false;
        }
        var annotated = 0;
        for (k = 0; k < allPaths.length; k++) {
            var A = allPaths[k];
            if (A.kind !== 'DIELINE' || A.closed || A.pts.length > 3) continue;
            var sTouch = endpointTouches(A, A.pts[0], 1.0);
            var eTouch = endpointTouches(A, A.pts[A.pts.length - 1], 1.0);
            var dimNear = nearDimText(A);
            if ((!sTouch && !eTouch) || (dimNear && !(sTouch && eTouch)) || (dimNear && A.isCrease)) {
                A.kind = 'ANNOTATION_LINE'; annotated++;
            }
        }
        // Vạch chặn / mũi tên nhỏ dính vào đường kích thước
        for (k = 0; k < allPaths.length; k++) {
            var Tk = allPaths[k];
            if (Tk.kind !== 'DIELINE' || Math.max(Tk.w, Tk.h) > 8) continue;
            for (var an = 0; an < allPaths.length; an++) {
                var AL = allPaths[an];
                if (AL.kind !== 'ANNOTATION_LINE') continue;
                if (distPtPath(Tk.pts[0][0], Tk.pts[0][1], AL) < 1.5 || distPtPath(Tk.pts[Tk.pts.length - 1][0], Tk.pts[Tk.pts.length - 1][1], AL) < 1.5) {
                    Tk.kind = 'ANNOTATION_LINE'; annotated++; break;
                }
            }
        }

        // ════ BƯỚC 2a: GOM CỤM NÉT KHUÔN (Union-Find theo tiếp xúc) ══════════
        var dl = [];
        for (k = 0; k < allPaths.length; k++) if (allPaths[k].kind === 'DIELINE') dl.push(allPaths[k]);
        var parentUF = [];
        for (k = 0; k < dl.length; k++) parentUF[k] = k;
        function find(i) { while (parentUF[i] !== i) { parentUF[i] = parentUF[parentUF[i]]; i = parentUF[i]; } return i; }
        function union(i, j) { var a = find(i), b = find(j); if (a !== b) parentUF[b] = a; }
        var TH = 2.5;
        function touches(A, B) {
            var i, j;
            for (i = 0; i < A.pts.length; i++) {
                for (j = 0; j < B.pts.length; j++) {
                    var dx = A.pts[i][0] - B.pts[j][0], dy = A.pts[i][1] - B.pts[j][1];
                    if (dx * dx + dy * dy <= TH * TH) return true;
                }
            }
            // Chạm chữ T: điểm mút đường hở nằm trên cạnh của đường kia
            if (!A.closed && (distPtPath(A.pts[0][0], A.pts[0][1], B) <= TH || distPtPath(A.pts[A.pts.length - 1][0], A.pts[A.pts.length - 1][1], B) <= TH)) return true;
            if (!B.closed && (distPtPath(B.pts[0][0], B.pts[0][1], A) <= TH || distPtPath(B.pts[B.pts.length - 1][0], B.pts[B.pts.length - 1][1], A) <= TH)) return true;
            return false;
        }
        for (var ia = 0; ia < dl.length; ia++) {
            for (var ib = ia + 1; ib < dl.length; ib++) {
                var PA = dl[ia], PB = dl[ib];
                if (PA.maxX + TH < PB.minX || PB.maxX + TH < PA.minX || PA.maxY + TH < PB.minY || PB.maxY + TH < PA.minY) continue;
                if (find(ia) === find(ib)) continue;
                if (touches(PA, PB)) union(ia, ib);
            }
        }
        var clMap = {}, clusters = [];
        for (k = 0; k < dl.length; k++) {
            var r = find(k);
            if (!clMap[r]) { clMap[r] = { paths: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, innerCutouts: 0 }; clusters.push(clMap[r]); }
            var cl = clMap[r], pp = dl[k];
            cl.paths.push(pp);
            if (pp.minX < cl.minX) cl.minX = pp.minX; if (pp.maxX > cl.maxX) cl.maxX = pp.maxX;
            if (pp.minY < cl.minY) cl.minY = pp.minY; if (pp.maxY > cl.maxY) cl.maxY = pp.maxY;
        }
        for (k = 0; k < clusters.length; k++) {
            clusters[k].area = (clusters[k].maxX - clusters[k].minX) * (clusters[k].maxY - clusters[k].minY);
            clusters[k].container = innermostContainer(clusters[k]);
        }

        // Gộp cụm nằm lọt lòng (lỗ khoét, cửa sổ, ô khay) vào khuôn mẹ — chỉ trong cùng khung
        clusters.sort(function (a, b) { return b.area - a.area; });
        var merged = [];
        for (k = 0; k < clusters.length; k++) {
            var C0 = clusters[k];
            if (C0.absorbed) continue;
            for (var kk = k + 1; kk < clusters.length; kk++) {
                var C1 = clusters[kk];
                if (C1.absorbed || C1.container !== C0.container) continue;
                if (inside(C1, C0, 2.0)) {
                    C0.paths = C0.paths.concat(C1.paths);
                    C0.innerCutouts++;
                    C1.absorbed = true;
                }
            }
            merged.push(C0);
        }

        // ════ BƯỚC 2b: LỌC MẢNH PHỤ / MẪU RÁC ══════════════════════════════
        function stats(C) {
            var nPts = 0, nCrease = 0, plainRect = true;
            for (var i = 0; i < C.paths.length; i++) {
                nPts += C.paths[i].pts.length;
                if (C.paths[i].isCrease) nCrease++;
                if (!C.paths[i].isRect) plainRect = false;
            }
            C.nPaths = C.paths.length; C.nPts = nPts; C.nCrease = nCrease;
            C.isPlainRect = plainRect && C.paths.length <= 2;
            // ước lượng số mặt phẳng: mỗi đường cấn/đường nội bộ tách thêm 1 mặt
            C.faceEstimate = Math.max(1, C.nPaths - 1 + (nCrease > 0 ? 1 : 0));
            C.w = C.maxX - C.minX; C.h = C.maxY - C.minY;
        }
        for (k = 0; k < merged.length; k++) stats(merged[k]);

        var kept = [], dropped = 0;
        for (k = 0; k < merged.length; k++) {
            var M = merged[k];
            if (M.w < 20 || M.h < 20 || M.area < 600) { dropped++; continue; }
            // Mảnh lớn nhất cùng khung
            var mainInFrame = null;
            for (var mm2 = 0; mm2 < merged.length; mm2++) {
                var O = merged[mm2];
                if (O === M || O.container !== M.container || !M.container) continue;
                if (O.area > M.area && (!mainInFrame || O.area > mainInFrame.area)) mainInFrame = O;
            }
            var junk = M.isPlainRect || M.faceEstimate < 4 || M.nPts < 10;
            var subPart = mainInFrame && (junk || (M.area < mainInFrame.area * 0.2 && M.faceEstimate < 6));
            if (subPart) { mainInFrame.subParts = (mainInFrame.subParts || 0) + 1; dropped++; continue; }
            if (junk) {
                // Giữ lại nếu là khuôn duy nhất trong khung riêng có tiêu đề (vd bì thư 1 nét bao)
                var own = M.container && M.container.children.length === 0;
                if (!own) { dropped++; continue; }
            }
            kept.push(M);
            if (M.container) M.container.clusters.push(M);
        }
        // Đếm số khuôn trong toàn bộ cây của từng khung
        function totalClusters(c) {
            var n = c.clusters.length;
            for (var i = 0; i < c.children.length; i++) n += totalClusters(c.children[i]);
            return n;
        }

        // Thứ tự đọc: trên → dưới, trái → phải
        kept.sort(function (a, b) {
            if (Math.abs(a.maxY - b.maxY) > 60) return b.maxY - a.maxY;
            return a.minX - b.minX;
        });

        // ════ BƯỚC 4: ĐẶT TÊN, NHÓM, LOẠI CẤU TRÚC, DRC ═════════════════════
        var boxes = [];
        for (var bi = 0; bi < kept.length; bi++) {
            var B = kept[bi];
            var box = B.container;
            // Khung nhóm = khung tổ tiên cao nhất chứa ≥ 2 khuôn (không tính khung trang)
            var grp = null, walk = box;
            while (walk) { if (totalClusters(walk) >= 2) grp = walk; walk = walk.parent; }
            var ownFrame = (box && totalClusters(box) === 1) ? box : null;

            // Nhãn của khuôn
            var labels = [];
            for (var li = 0; li < texts.length; li++) {
                var Tl = texts[li];
                var mine = false;
                if (ownFrame) mine = ptInBox(Tl.cx, Tl.cy, ownFrame, 0);
                else {
                    if (box && !ptInBox(Tl.cx, Tl.cy, box, 0)) continue;
                    var w2 = B.maxX - B.minX;
                    mine = ptInBox(Tl.cx, Tl.cy, B, 5) ||
                        (Tl.cy > B.maxY - 5 && Tl.cy < B.maxY + 60 && Tl.cx > B.minX - w2 * 0.15 && Tl.cx < B.maxX + w2 * 0.15) ||
                        (Tl.cy < B.minY + 5 && Tl.cy > B.minY - 50 && Tl.cx > B.minX - w2 * 0.15 && Tl.cx < B.maxX + w2 * 0.15);
                    if (mine) { // không gán nếu gần khuôn khác hơn
                        var bcx = (B.minX + B.maxX) / 2, bcy = (B.minY + B.maxY) / 2;
                        var dMe = Math.abs(Tl.cx - bcx) + Math.abs(Tl.cy - bcy);
                        for (var oi = 0; oi < kept.length; oi++) {
                            var Ko = kept[oi];
                            if (Ko === B) continue;
                            if (ptInBox(Tl.cx, Tl.cy, Ko, 2)) { mine = false; break; }
                            var dO = Math.abs(Tl.cx - (Ko.minX + Ko.maxX) / 2) + Math.abs(Tl.cy - (Ko.minY + Ko.maxY) / 2);
                            if (dO < dMe * 0.8 && Ko.container === B.container) { mine = false; break; }
                        }
                    }
                }
                if (mine && !Tl.isDim) labels.push(Tl);
            }
            labels.sort(function (a, b) { return b.maxY - a.maxY; });

            var titleT = ownFrame ? containerTitle(ownFrame) : null;
            var grpTitleT = grp ? containerTitle(grp) : null;
            if (!titleT) { for (var lt = 0; lt < labels.length; lt++) { if (!labels[lt].isDRC) { titleT = labels[lt]; break; } } }
            if (!titleT && labels.length) titleT = labels[0]; // nhãn dạng "Đáy hộp DRC: 37x7x30" → bỏ phần DRC khi đặt tên
            if (grpTitleT && titleT === grpTitleT) titleT = null;

            var boxText = '';
            for (var lb = 0; lb < labels.length; lb++) boxText += ' ' + labels[lb].text;
            var fBox = _ps3dFold((titleT ? titleT.text + ' ' : '') + boxText);
            var fGrp = grpTitleT ? _ps3dFold(grpTitleT.text) : ' ';
            var cls = _ps3dClassify(fBox, fGrp, { innerCutouts: B.innerCutouts, w: B.w, h: B.h });

            var rawDRC = _ps3dParseDRC(boxText) || (titleT ? _ps3dParseDRC(titleT.text) : null);
            var drc = cls.type ? _ps3dDRCFor(cls.type, rawDRC, (titleT ? titleT.text : '') + ' ' + boxText) : null;
            var drcSource = drc ? 'text' : 'default';
            if (!drc && cls.type && PS3D_TYPE_DEFAULTS[cls.type]) {
                var dft = PS3D_TYPE_DEFAULTS[cls.type];
                drc = { L: dft.L, W: dft.W, H: dft.H };
            }

            var subName = titleT ? titleT.text.replace(/\(?\s*(DRC|KT)?\s*[:\s]*[0-9]+(?:[.,][0-9]+)?\s*[x\u00d7\*X][^)]*\)?/i, '').replace(/^\s+|\s+$/g, '') : '';
            if (!subName) subName = cls.type ? PS3D_TYPE_NAMES[cls.type] : 'Khu\u00F4n t\u1EF1 do';
            if (subName.length > 60) subName = subName.substring(0, 60);
            var finalName = subName + (drc ? ' (' + Math.round(drc.L) + '\u00D7' + Math.round(drc.W) + '\u00D7' + Math.round(drc.H) + 'mm)' : '');

            // Chuẩn hoá toạ độ về gốc (0,0) của khuôn
            var bCuts = [], bCreases = [];
            for (var pi2 = 0; pi2 < B.paths.length; pi2++) {
                var cp = B.paths[pi2], np = [];
                for (q = 0; q < cp.pts.length; q++) np.push([cp.pts[q][0] - B.minX, cp.pts[q][1] - B.minY]);
                if (cp.isCrease) bCreases.push(np); else bCuts.push({ pts: np, closed: cp.closed });
            }

            boxes.push({
                id: 'scanned_box_' + (bi + 1),
                uid: 'scan_' + (new Date().getTime()) + '_' + (bi + 1),
                name: finalName,
                libGroup: cls.lib,
                group: PS3D_LIB_GROUPS[cls.lib],
                groupId: grp ? 'grp_' + grp.id : (ownFrame ? 'frame_' + ownFrame.id : 'free_' + bi),
                comboTitle: grpTitleT ? grpTitleT.text : null,
                boxType: cls.type,
                templateType: cls.type,
                drc: drc,
                drcSource: drcSource,
                innerCutouts: B.innerCutouts,
                subParts: B.subParts || 0,
                width: B.w, height: B.h,
                origin: { x: B.minX, y: B.minY },
                cutsCount: bCuts.length, creasesCount: bCreases.length,
                rect: { x0: 0, y0: 0, w: B.w, h: B.h },
                cuts: bCuts, creases: bCreases
            });
        }

        var nFrames = 0;
        for (k = 0; k < containers.length; k++) nFrames++;
        return _ps3dOk({
            docName: doc.name,
            totalBoxes: boxes.length,
            stats: { frames: nFrames, annotationLines: annotated, droppedParts: dropped, rawClusters: merged.length },
            boxes: boxes,
            activeBox: boxes.length > 0 ? boxes[0] : null
        });
    } catch (e) {
        return _ps3dErr(e);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// AUTO-REBUILD CLEAN 2D DIELINE — Vẽ lại khuôn chuẩn kỹ thuật sang ARTBOARD MỚI
//   CUT   : nét liền xanh dương #0066EE 0.75pt
//   CREASE: nét đứt đỏ #EE1E23 0.5pt [4, 2.5]
//   BLEED : nét xanh lá #28B446 0.4pt (+bleed mm ôm sát biên dạng)
// json = { bleed, items: [{ name, drcText, rect, cuts, creases, panels }] }
// ════════════════════════════════════════════════════════════════════════════
function _ps3dRGB(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
function _ps3dSpotLike(doc, hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    if (doc.documentColorSpace === DocumentColorSpace.RGB) return _ps3dRGB(r, g, b);
    // Quy đổi RGB → CMYK đơn giản
    var c = 1 - r / 255, m = 1 - g / 255, y = 1 - b / 255, kk = Math.min(c, m, y);
    if (kk >= 1) return _ps3dCMYK(0, 0, 0, 100);
    return _ps3dCMYK(Math.round((c - kk) / (1 - kk) * 100), Math.round((m - kk) / (1 - kk) * 100), Math.round((y - kk) / (1 - kk) * 100), Math.round(kk * 100));
}
function _ps3dSubLayer(parent, name) {
    for (var i = 0; i < parent.layers.length; i++) if (parent.layers[i].name === name) return parent.layers[i];
    var l = parent.layers.add(); l.name = name; return l;
}

function ps3d_drawCleanDielines(json) {
    try {
        if (!app.documents.length) return _ps3dErr('Ch\u01B0a m\u1EDF file n\u00E0o.');
        var data = JSON.parse(json);
        var doc = app.activeDocument;
        var items = data.items || [];
        if (!items.length) return _ps3dErr('Kh\u00F4ng c\u00F3 khu\u00F4n n\u00E0o \u0111\u1EC3 v\u1EBD l\u1EA1i.');

        var root = _ps3dLayer(doc, PS3D_CLEAN_LAYER);
        root.zOrder(ZOrderMethod.BRINGTOFRONT);
        var lBleed = _ps3dSubLayer(root, 'BLEED (+' + (data.bleed || 3) + 'mm)');
        var lCrease = _ps3dSubLayer(root, 'CREASE (G\u1EA5p)');
        var lCut = _ps3dSubLayer(root, 'CUT (C\u1EAFt)');
        var lLabel = _ps3dSubLayer(root, 'NH\u00C3N');

        var blue = _ps3dSpotLike(doc, '#0066EE'), red = _ps3dSpotLike(doc, '#EE1E23');
        var green = _ps3dSpotLike(doc, '#28B446'), ink = _ps3dSpotLike(doc, '#333333');

        // Vùng đặt artboard mới: hàng mới BÊN DƯỚI toàn bộ artboard hiện có
        var uL = Infinity, uB = Infinity, uR = -Infinity;
        for (var a = 0; a < doc.artboards.length; a++) {
            var ar = doc.artboards[a].artboardRect;
            if (ar[0] < uL) uL = ar[0]; if (ar[2] > uR) uR = ar[2]; if (ar[3] < uB) uB = ar[3];
        }
        var GAP = _ps3dMM(30), MARGIN = _ps3dMM(15), LABEL_H = _ps3dMM(14);
        var rowWidth = Math.max(uR - uL, _ps3dMM(1500));
        var curX = uL, curTop = uB - GAP * 2, rowH = 0;
        var made = 0, bleedFail = 0;

        for (var i = 0; i < items.length; i++) {
            var it = items[i], r = it.rect;
            var bw = _ps3dMM(r.w) + MARGIN * 2, bh = _ps3dMM(r.h) + MARGIN * 2 + LABEL_H;
            if (curX > uL && curX + bw > uL + rowWidth) { curX = uL; curTop -= rowH + GAP; rowH = 0; }
            if (curTop - bh < -16000) return _ps3dErr('H\u1EBFt kh\u00F4ng gian canvas \u0111\u1EC3 th\u00EAm artboard.');

            var ab = doc.artboards.add([curX, curTop, curX + bw, curTop - bh]);
            try { ab.name = String(it.name || ('Khuon ' + (i + 1))).substring(0, 60); } catch (eN) {}
            var left = curX + MARGIN, bottom = curTop - bh + MARGIN;
            (function (left, bottom, r) {
                function P(qq) { return [left + _ps3dMM(qq[0] - r.x0), bottom + _ps3dMM(qq[1] - r.y0)]; }
                var k, pts, path;
                for (k = 0; k < it.cuts.length; k++) {
                    pts = [];
                    for (var j = 0; j < it.cuts[k].pts.length; j++) pts.push(P(it.cuts[k].pts[j]));
                    path = lCut.pathItems.add(); path.setEntirePath(pts); path.closed = !!it.cuts[k].closed;
                    path.filled = false; path.stroked = true; path.strokeColor = blue; path.strokeWidth = 0.75; path.strokeDashes = [];
                }
                for (k = 0; k < it.creases.length; k++) {
                    path = lCrease.pathItems.add(); path.setEntirePath([P(it.creases[k][0]), P(it.creases[k][1])]);
                    path.filled = false; path.stroked = true; path.strokeColor = red; path.strokeWidth = 0.5; path.strokeDashes = [4, 2.5];
                }
                // Bleed: hợp các mặt + Offset Path (dùng lại thủ tục chuẩn của plugin)
                var ok = _ps3dMakeBleed(doc, lBleed, { bleed: data.bleed || 3, panels: it.panels }, P);
                if (!ok) bleedFail++;
                var tf = lLabel.textFrames.pointText([left, curTop - MARGIN * 0.6 - _ps3dMM(5)]);
                tf.contents = (it.name || '') + (it.drcText ? '   \u2022   ' + it.drcText : '');
                tf.textRange.characterAttributes.size = 11;
                tf.textRange.characterAttributes.fillColor = ink;
            })(left, bottom, r);

            curX += bw + GAP;
            if (bh > rowH) rowH = bh;
            made++;
        }
        try { doc.selection = null; } catch (eS) {}
        return _ps3dOk({ artboards: made, bleedFail: bleedFail, layer: PS3D_CLEAN_LAYER });
    } catch (e) {
        return _ps3dErr(e);
    }
}

/* jshint ignore:end */
