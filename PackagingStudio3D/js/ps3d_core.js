/**
 * ============================================================================
 * PS3D CORE — Engine dùng chung cho khuôn 2D và mô hình 3D
 * ----------------------------------------------------------------------------
 * Mỗi mẫu hộp (templates/*.js) chỉ mô tả MỘT lần:
 *   - các mặt (panel) dưới dạng đa giác trên mặt phẳng khuôn trải (đơn vị mm)
 *   - mặt cha + đường bản lề (crease) + góc gập + thời điểm gập
 * Từ đó engine tự sinh:
 *   - PS3D.dieline(model): đường CUT (nối liền) và CREASE để vẽ trong Illustrator
 *   - PS3D.Folder: mô hình Three.js gập/mở theo thanh trượt, UV khớp artboard
 * Quy ước: mặt in (bên ngoài hộp) hướng +Z trên khuôn trải. "angle" dương = gập
 * về phía mặt không in (vào trong hộp). Engine tự tính chiều xoay.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var PS3D = global.PS3D = global.PS3D || {};
    var templates = [];

    // ── Registry ────────────────────────────────────────────────────────────
    PS3D.registerTemplate = function (tpl) {
        for (var i = 0; i < templates.length; i++) {
            if (templates[i].id === tpl.id) { templates[i] = tpl; return; }
        }
        templates.push(tpl);
    };
    PS3D.removeTemplate = function (id) {
        for (var i = 0; i < templates.length; i++) {
            if (templates[i].id === id) {
                templates.splice(i, 1);
                return true;
            }
        }
        return false;
    };
    PS3D.getTemplates = function () { return templates.slice(); };
    PS3D.getTemplate = function (id) {
        for (var i = 0; i < templates.length; i++) if (templates[i].id === id) return templates[i];
        return null;
    };
    PS3D.defaultParams = function (tpl) {
        var p = {};
        (tpl.params || []).forEach(function (d) { p[d.key] = d.def; });
        return p;
    };

    // ── Persistent Storage System (Lưu trữ vĩnh viễn trên ổ cứng & localStorage) ──
    var storageFilePath = null;
    var nodeFS = null;
    var nodePath = null;

    PS3D.initStorage = function (nodeReq) {
        if (nodeReq) {
            try {
                nodeFS = nodeReq('fs');
                nodePath = nodeReq('path');
                var userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\' + (process.env.USERNAME || 'Public');
                storageFilePath = nodePath.join(userHome, '.packagingstudio3d_templates.json');
            } catch (e) {
                console.warn('initStorage Node err:', e);
            }
        }
    };

    function readStoredRaw() {
        if (nodeFS && storageFilePath && nodeFS.existsSync(storageFilePath)) {
            try {
                var content = nodeFS.readFileSync(storageFilePath, 'utf8');
                return JSON.parse(content);
            } catch (e) {
                console.warn('Lỗi đọc storage file:', e);
            }
        }
        try {
            var ls = window.localStorage.getItem('ps3d_custom_templates');
            if (ls) return JSON.parse(ls);
        } catch (e2) {
            console.warn('Lỗi đọc localStorage:', e2);
        }
        return [];
    }

    function writeStoredRaw(list) {
        try {
            window.localStorage.setItem('ps3d_custom_templates', JSON.stringify(list));
        } catch (e) {
            console.warn('Lỗi ghi localStorage:', e);
        }
        if (nodeFS && storageFilePath) {
            try {
                nodeFS.writeFileSync(storageFilePath, JSON.stringify(list, null, 2), 'utf8');
            } catch (e2) {
                console.warn('Lỗi ghi storage file:', e2);
            }
        }
    }

    PS3D.saveTemplateToStorage = function (tpl) {
        if (!tpl || !tpl.id) return;
        var list = readStoredRaw();
        var serialized = {
            id: tpl.id,
            name: tpl.name,
            nameEn: tpl.nameEn || '',
            group: tpl.group || 'Khuôn đã lưu',
            boxType: tpl.boxType || 'custom',
            baseTemplateId: tpl.baseTemplateId || null,
            drc: tpl.drc || null,
            closedRotX: tpl.closedRotX || 0,
            isCustom: true,
            params: (tpl.params || []).map(function (p) {
                return { key: p.key, label: p.label, def: p.def };
            }),
            scannedCuts: tpl.scannedCuts || null,
            scannedCreases: tpl.scannedCreases || null,
            customPanels: tpl.customPanels || null,
            width: tpl.width || (tpl.drc ? tpl.drc.L : 200),
            height: tpl.height || (tpl.drc ? tpl.drc.H : 200),
            savedAt: Date.now()
        };

        var found = false;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === tpl.id) {
                list[i] = serialized;
                found = true;
                break;
            }
        }
        if (!found) list.push(serialized);
        writeStoredRaw(list);
    };

    PS3D.removeTemplateFromStorage = function (id) {
        var list = readStoredRaw();
        list = list.filter(function (x) { return x.id !== id; });
        writeStoredRaw(list);
    };

    PS3D.registerSavedTemplate = function (data) {
        if (!data || !data.id) return null;

        var tplId = data.id;
        var tplName = data.name || 'Mẫu khuôn đã lưu';
        var bType = data.boxType;
        var baseTplId = data.baseTemplateId;
        var cuts = data.scannedCuts || [];
        var creases = data.scannedCreases || [];
        var drc = data.drc || {};
        var savedParams = data.params || [];
        var closedRotX = data.closedRotX || 0;
        var extras = null;

        var buildFn = null;
        var builtPanels = (data.customPanels && data.customPanels.length > 0) ? data.customPanels : null;

        // Nếu có vector cuts hoặc customPanels: LUÔN ƯU TIÊN DỰNG MÔ HÌNH TỪ VECTOR THỰC TẾ
        if (!builtPanels && cuts && cuts.length > 0) {
            var part = PS3D.partitionDielineIntoPanels(cuts, creases, data.width || 200, data.height || 200);
            builtPanels = part.panels;
            creases = part.creases;
            data.customPanels = builtPanels;
            data.scannedCreases = creases;
        }

        if (builtPanels && builtPanels.length > 0) {
            buildFn = function (p) {
                var w = (p && p.W_TOTAL) || data.width || 200;
                var h = (p && p.H_TOTAL) || data.height || 200;
                return {
                    panels: builtPanels,
                    dims: [
                        { a: [0, h / 2], b: [w, h / 2], label: Math.round(w) + ' mm' },
                        { a: [w / 2, 0], b: [w / 2, h], label: Math.round(h) + ' mm' }
                    ]
                };
            };
        } else if (baseTplId && PS3D.getTemplate(baseTplId)) {
            var baseTpl = PS3D.getTemplate(baseTplId);
            buildFn = function (p) { return baseTpl.build(Object.assign({ G: 15, L: drc.L || 100, W: drc.W || 80, H: drc.H || 50 }, p)); };
            closedRotX = baseTpl.closedRotX || 0;
            extras = baseTpl.extras;
        } else if (bType === 'tray') {
            var trayTpl = PS3D.getTemplate('tray');
            if (trayTpl) {
                buildFn = function (p) { return trayTpl.build(Object.assign({ L: drc.L || 120, W: drc.W || 80, H: drc.H || 40 }, p)); };
                closedRotX = 90;
            }
        } else if (bType === 'tote-bag') {
            var bagTpl = PS3D.getTemplate('tote-bag');
            if (bagTpl) {
                buildFn = function (p) { return bagTpl.build(Object.assign({ G: 15, L: drc.L || 250, W: drc.W || 100, H: drc.H || 300 }, p)); };
                extras = bagTpl.extras;
            }
        } else if (bType === 'sleeve-drawer') {
            var sleeveTpl = PS3D.getTemplate('sleeve-drawer');
            if (sleeveTpl) buildFn = function (p) { return sleeveTpl.build(Object.assign({ G: 15, L: drc.L || 320, W: drc.W || 255, H: drc.H || 75 }, p)); };
        } else if (bType === 'crash-lock') {
            var crashTpl = PS3D.getTemplate('crash-lock');
            if (crashTpl) buildFn = function (p) { return crashTpl.build(Object.assign({ G: 15, L: drc.L || 60, W: drc.W || 50, H: drc.H || 100 }, p)); };
        } else if (bType === 'straight-tuck' || bType === 'reverse-tuck') {
            var tuckTpl = PS3D.getTemplate(bType === 'straight-tuck' ? 'straight-tuck' : 'reverse-tuck');
            if (tuckTpl) buildFn = function (p) { return tuckTpl.build(Object.assign({ G: 15, L: drc.L || 60, W: drc.W || 40, H: drc.H || 100 }, p)); };
        } else if (bType === 'burger-box') {
            var burgerTpl = PS3D.getTemplate('burger-box');
            if (burgerTpl) {
                buildFn = function (p) { return burgerTpl.build(Object.assign({ L: drc.L || 105, W: drc.W || 105, H: drc.H || 70 }, p)); };
                closedRotX = 90;
            }
        } else if (bType === 'mailer-box') {
            var mailerTpl = PS3D.getTemplate('mailer-box');
            if (mailerTpl) {
                buildFn = function (p) { return mailerTpl.build(Object.assign({ L: drc.L || 180, W: drc.W || 120, H: drc.H || 50 }, p)); };
                closedRotX = 90;
            }
        }

        if (!buildFn) {
            buildFn = function (p) {
                var w = (p && p.W_TOTAL) || data.width || 200;
                var h = (p && p.H_TOTAL) || data.height || 200;
                var pList = builtPanels || [{
                    id: 'base_dieline_plane',
                    poly: [[0, 0], [w, 0], [w, h], [0, h]],
                    face: 'bottom'
                }];
                return {
                    panels: pList,
                    dims: [
                        { a: [0, h / 2], b: [w, h / 2], label: Math.round(w) + ' mm' },
                        { a: [w / 2, 0], b: [w / 2, h], label: Math.round(h) + ' mm' }
                    ]
                };
            };
        }

        var template = {
            id: tplId,
            name: tplName,
            nameEn: data.nameEn || 'Saved Custom Packaging',
            group: data.group || 'Khuôn đã lưu',
            boxType: bType,
            baseTemplateId: baseTplId,
            drc: drc,
            isCustom: true,
            closedRotX: closedRotX,
            scannedCuts: cuts,
            scannedCreases: creases,
            customPanels: data.customPanels,
            extras: extras,
            params: (function () {
                var pList = (savedParams.length > 0) ? savedParams.slice() : [
                    { key: 'L', label: 'Dài (L)', def: drc.L || 100 },
                    { key: 'W', label: 'Rộng (W)', def: drc.W || 80 },
                    { key: 'H', label: 'Cao (H)', def: drc.H || 50 }
                ];
                var hasG = pList.some(function (p) { return p.key === 'G'; });
                if (!hasG && (bType === 'reverse-tuck' || bType === 'straight-tuck' || bType === 'crash-lock' || bType === 'tote-bag' || bType === 'sleeve-drawer')) {
                    pList.push({ key: 'G', label: 'Mép dán', def: 15 });
                }
                return pList;
            })(),
            build: buildFn
        };

        PS3D.registerTemplate(template);
        return template;
    };

    PS3D.loadAllFromStorage = function () {
        var list = readStoredRaw();
        list.forEach(function (data) {
            PS3D.registerSavedTemplate(data);
        });
        return list;
    };

    // ── Helpers hình học ────────────────────────────────────────────────────
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    PS3D.clamp = clamp;

    function arc(pts, cx, cy, r, a0, a1, n) {
        for (var i = 1; i <= n; i++) {
            var a = a0 + (a1 - a0) * i / n;
            pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
    }
    PS3D.arc = arc;

    PS3D.rect = function (x, y, w, h) {
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    };

    /**
     * Profile = danh sách điểm (s, h) trong hệ toạ độ bản lề:
     * s chạy dọc bản lề từ 0 → len, h vuông góc ra phía ngoài.
     * Điểm đầu luôn (0,0), điểm cuối luôn (len,0) → cạnh đóng chính là bản lề.
     */
    PS3D.profiles = {
        rect: function (len, h) {
            return [[0, 0], [0, h], [len, h], [len, 0]];
        },
        // Lưỡi gài: Có ngàm khóa (lock notch / friction lock) ở chân bản lề và 2 góc bo tròn
        tuck: function (len, h, r, lockNotch) {
            r = clamp(r || 8, 1, Math.min(h - 1, len / 2 - 1.5));
            var notchW = (lockNotch !== false) ? Math.min(2.0, len * 0.05) : 0;
            var notchH = (lockNotch !== false) ? Math.min(2.5, h * 0.25) : 0;
            var p = [[0, 0]];
            if (notchW > 0) {
                p.push([0, notchH]);
                p.push([notchW, notchH]);
                p.push([notchW + 0.5, h - r]);
            } else {
                p.push([1, h - r]);
            }
            arc(p, (notchW > 0 ? notchW + 0.5 : 1) + r, h - r, r, Math.PI, Math.PI / 2, 6);
            p.push([len - (notchW > 0 ? notchW + 0.5 : 1) - r, h]);
            arc(p, len - (notchW > 0 ? notchW + 0.5 : 1) - r, h - r, r, Math.PI / 2, 0, 6);
            if (notchW > 0) {
                p.push([len - notchW - 0.5, h - r]);
                p.push([len - notchW, notchH]);
                p.push([len, notchH]);
            } else {
                p.push([len - 1, h - r]);
            }
            p.push([len, 0]);
            return p;
        },
        // Tai bụi: rãnh thoát dao 45° ở chân, bo lớn phía bản lề nắp, bo nhỏ phía còn lại
        dust: function (len, h, r) {
            r = clamp(r || 10, 1, Math.min(h - 3.5, (len - 6) / 1.5));
            var r2 = r * 0.4;
            var p = [[0, 0], [2, 3], [2.5, h - r]];
            arc(p, 2.5 + r, h - r, r, Math.PI, Math.PI / 2, 6);
            p.push([len - 2.5 - r2, h]);
            arc(p, len - 2.5 - r2, h - r2, r2, Math.PI / 2, 0, 4);
            p.push([len - 2, 3], [len, 0]);
            return p;
        },
        // Mép dán / tai góc: hình thang
        glue: function (len, g, inset) {
            g = (g !== undefined && isFinite(g) && g > 0) ? g : 15;
            inset = Math.min(inset || 4, len / 3);
            return [[0, 0], [inset, g], [len - inset, g], [len, 0]];
        }
    };

    /**
     * Tạo đa giác cho một tai/nắp gắn vào đoạn bản lề a→b.
     * out: vector gợi ý hướng "ra ngoài" (vd [0,1] = lên trên).
     */
    PS3D.flap = function (a, b, out, profile) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len = Math.sqrt(dx * dx + dy * dy);
        var ux = dx / len, uy = dy / len;
        var nx = -uy, ny = ux;
        if (nx * out[0] + ny * out[1] < 0) { nx = -nx; ny = -ny; }
        return profile.map(function (q) {
            return [a[0] + ux * q[0] + nx * q[1], a[1] + uy * q[0] + ny * q[1]];
        });
    };

    // ── Build model ─────────────────────────────────────────────────────────
    PS3D.build = function (tpl, params) {
        var p = {};
        var defs = PS3D.defaultParams(tpl);
        for (var k in defs) p[k] = (params && isFinite(params[k]) && params[k] > 0) ? +params[k] : defs[k];
        var out = tpl.build(p);
        var panels = out.panels;

        // Sắp xếp cha trước con
        var byId = {};
        panels.forEach(function (pn) { byId[pn.id] = pn; });
        function depth(pn) { return pn.parent ? 1 + depth(byId[pn.parent]) : 0; }
        panels.forEach(function (pn) { pn._depth = depth(pn); });
        panels.sort(function (a, b) { return a._depth - b._depth; });

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        panels.forEach(function (pn) {
            pn.poly.forEach(function (q) {
                if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
                if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
            });
        });
        return {
            template: tpl, params: p, panels: panels, byId: byId,
            dims: out.dims || [], closedRotX: tpl.closedRotX || 0,
            extras: out.extras || tpl.extras || null,
            bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY }
        };
    };

    // Vùng artboard = khuôn + lề (bleed + 5 mm). Dùng chung cho AI và UV 3D.
    PS3D.artboardRect = function (model, bleed) {
        var m = (bleed || 0) + 5, b = model.bounds;
        return { x0: b.minX - m, y0: b.minY - m, w: b.w + 2 * m, h: b.h + 2 * m };
    };

    // ── Dieline 2D: phân loại cạnh CUT / CREASE và nối thành đường liền ─────
    PS3D.dieline = function (model) {
        if (model.template && model.template.scannedCuts && model.template.scannedCuts.length > 0) {
            var scCreases = model.template.scannedCreases || [];
            if ((!scCreases || scCreases.length === 0) && model.panels) {
                scCreases = model.panels.filter(function (p) { return !!p.hinge; }).map(function (p) { return p.hinge; });
            }
            return {
                cuts: model.template.scannedCuts,
                creases: scCreases
            };
        }
        if (model.creases && model.creases.length > 0) {
            return {
                cuts: (model.template && model.template.scannedCuts) || [],
                creases: model.creases
            };
        }
        var EPS = 0.02;
        var hinges = model.panels.filter(function (p) { return !!p.parent; }).map(function (p) { return p.hinge; });

        function onSeg(pt, s) {
            var ax = s[0][0], ay = s[0][1], dx = s[1][0] - ax, dy = s[1][1] - ay;
            var len = Math.sqrt(dx * dx + dy * dy);
            var cross = ((pt[0] - ax) * dy - (pt[1] - ay) * dx) / len;
            if (Math.abs(cross) > EPS) return false;
            var t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / (len * len);
            return t > -EPS / len && t < 1 + EPS / len;
        }
        function key(pt) { return pt[0].toFixed(2) + ',' + pt[1].toFixed(2); }

        var count = {}, edges = [];
        model.panels.forEach(function (pn) {
            var poly = pn.poly, n = poly.length;
            for (var i = 0; i < n; i++) {
                var a = poly[i], b = poly[(i + 1) % n];
                if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) continue;
                var crease = hinges.some(function (h) { return onSeg(a, h) && onSeg(b, h); });
                if (crease) continue;
                var ek = [key(a), key(b)].sort().join('|');
                count[ek] = (count[ek] || 0) + 1;
                edges.push({ a: a, b: b, k: ek });
            }
        });
        // Cạnh trùng giữa 2 mặt (không phải bản lề) là cạnh trong → bỏ
        edges = edges.filter(function (e) { return count[e.k] === 1; });

        // Nối các đoạn thành polyline
        var adj = {};
        edges.forEach(function (e, i) {
            (adj[key(e.a)] = adj[key(e.a)] || []).push(i);
            (adj[key(e.b)] = adj[key(e.b)] || []).push(i);
        });
        var used = [], cuts = [];
        function nextFrom(pt) {
            var list = adj[key(pt)] || [];
            for (var j = 0; j < list.length; j++) if (!used[list[j]]) return list[j];
            return -1;
        }
        for (var i = 0; i < edges.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            var pts = [edges[i].a, edges[i].b];
            var idx;
            while ((idx = nextFrom(pts[pts.length - 1])) >= 0) {
                used[idx] = true;
                var e = edges[idx];
                pts.push(key(e.a) === key(pts[pts.length - 1]) ? e.b : e.a);
            }
            while ((idx = nextFrom(pts[0])) >= 0) {
                used[idx] = true;
                var e2 = edges[idx];
                pts.unshift(key(e2.a) === key(pts[0]) ? e2.b : e2.a);
            }
            var closed = pts.length > 2 && key(pts[0]) === key(pts[pts.length - 1]);
            if (closed) pts.pop();
            cuts.push({ pts: pts, closed: closed });
        }
        return { cuts: cuts, creases: hinges };
    };

    // Dữ liệu gửi sang Illustrator (ExtendScript)
    PS3D.exportForAI = function (model, opts) {
        var dl = PS3D.dieline(model);
        return {
            version: 1,
            templateId: model.template.id,
            templateName: model.template.name,
            params: model.params,
            bleed: opts.bleed,
            material: opts.material,
            rect: PS3D.artboardRect(model, opts.bleed),
            cuts: dl.cuts,
            creases: dl.creases,
            panels: model.panels.map(function (p) { return p.poly; }),
            dims: model.dims
        };
    };

    // Thumbnail SVG cho thư viện
    PS3D.thumbnailSVG = function (model) {
        var dl = PS3D.dieline(model);
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Ưu tiên tính bounds trực tiếp từ các điểm thực tế trong cuts và creases
        function checkPt(x, y) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }

        dl.cuts.forEach(function (c) {
            (c.pts || []).forEach(function (pt) { checkPt(pt[0], pt[1]); });
        });
        dl.creases.forEach(function (cr) {
            (cr || []).forEach(function (pt) { checkPt(pt[0], pt[1]); });
        });

        // Nếu dl trống thì dùng model.bounds
        if (!isFinite(minX) || !isFinite(maxX)) {
            var b = model.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100, w: 100, h: 100 };
            minX = b.minX; minY = b.minY; maxX = b.maxX; maxY = b.maxY;
        }

        var bw = Math.max(1, maxX - minX);
        var bh = Math.max(1, maxY - minY);
        var pad = Math.max(bw, bh) * 0.05;

        // Toạ độ SVG: y quay xuống dưới. Dieline 2D: y hướng lên nên lấy -q[1]
        // Bounding box trong hệ toạ độ -y:
        var svgMinY = -maxY;
        var svgH = bh;
        var vb = [
            (minX - pad).toFixed(1),
            (svgMinY - pad).toFixed(1),
            (bw + 2 * pad).toFixed(1),
            (svgH + 2 * pad).toFixed(1)
        ].join(' ');

        function pl(pts, closed) {
            return pts.map(function (q, i) {
                return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + (-q[1]).toFixed(1);
            }).join('') + (closed ? 'Z' : '');
        }

        var sw = Math.max(bw, bh) / 100;
        var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">';
        dl.creases.forEach(function (c) {
            s += '<path d="' + pl(c, false) + '" stroke="#e33" stroke-width="' + sw + '" stroke-dasharray="' + (sw * 3).toFixed(1) + ' ' + (sw * 2).toFixed(1) + '" fill="none"/>';
        });
        dl.cuts.forEach(function (c) {
            s += '<path d="' + pl(c.pts, c.closed) + '" stroke="#3b8de6" stroke-width="' + (sw * 1.4).toFixed(1) + '" fill="none"/>';
        });
        return s + '</svg>';
    };

    // ── THUẬT TOÁN BÓC TÁCH MẶT PHẲNG ĐỒ THỊ PHẲNG (PLANAR GRAPH PARTITIONING) ───
    PS3D.partitionDielineIntoPanels = function (cuts, creases, totalW, totalH) {
        var TOL = 0.6; // Sai số snap toạ độ đỉnh (mm)

        function dist(p1, p2) {
            return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
        }

        function distToSeg(p, a, b) {
            var dx = b[0] - a[0], dy = b[1] - a[1];
            var l2 = dx * dx + dy * dy;
            if (l2 < 1e-6) return dist(p, a);
            var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
            t = Math.max(0, Math.min(1, t));
            return dist(p, [a[0] + t * dx, a[1] + t * dy]);
        }

        function segIntersect(p1, p2, p3, p4) {
            var d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
            if (Math.abs(d) < 1e-6) return null;
            var t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
            var u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
            if (t > 1e-4 && t < 1 - 1e-4 && u > 1e-4 && u < 1 - 1e-4) {
                return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
            }
            return null;
        }

        function pointInPoly(pt, poly) {
            var inside = false;
            var x = pt[0], y = pt[1];
            for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                var xi = poly[i][0], yi = poly[i][1];
                var xj = poly[j][0], yj = poly[j][1];
                var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        // 1. Phân rã tất cả cuts và creases thành các đoạn thẳng 2 đầu mút
        var segs = [];

        (cuts || []).forEach(function (c) {
            var pts = c.pts;
            if (!pts || pts.length < 2) return;
            var n = pts.length;
            var count = c.closed ? n : n - 1;
            for (var i = 0; i < count; i++) {
                var p1 = pts[i], p2 = pts[(i + 1) % n];
                if (dist(p1, p2) > 0.05) {
                    segs.push({ p1: [p1[0], p1[1]], p2: [p2[0], p2[1]], isCrease: false });
                }
            }
        });

        (creases || []).forEach(function (cr) {
            if (!cr || cr.length < 2) return;
            for (var i = 0; i < cr.length - 1; i++) {
                var p1 = cr[i], p2 = cr[i + 1];
                if (dist(p1, p2) > 0.05) {
                    segs.push({ p1: [p1[0], p1[1]], p2: [p2[0], p2[1]], isCrease: true });
                }
            }
        });

        // 2. Tách đoạn tại các điểm giao cắt chéo (Segment Crossings)
        var changed = true;
        var maxPasses = 50;
        while (changed && maxPasses-- > 0) {
            changed = false;
            for (var i = 0; i < segs.length; i++) {
                for (var j = i + 1; j < segs.length; j++) {
                    var pt = segIntersect(segs[i].p1, segs[i].p2, segs[j].p1, segs[j].p2);
                    if (pt) {
                        var s1 = segs[i], s2 = segs[j];
                        segs.splice(j, 1);
                        segs.splice(i, 1);
                        segs.push(
                            { p1: s1.p1, p2: pt, isCrease: s1.isCrease },
                            { p1: pt, p2: s1.p2, isCrease: s1.isCrease },
                            { p1: s2.p1, p2: pt, isCrease: s2.isCrease },
                            { p1: pt, p2: s2.p2, isCrease: s2.isCrease }
                        );
                        changed = true;
                        break;
                    }
                }
                if (changed) break;
            }
        }

        // 3. Tách đoạn tại các ngã ba T-Junctions (khi cấn/cắt chạm vào giữa một đoạn khác)
        changed = true;
        maxPasses = 50;
        while (changed && maxPasses-- > 0) {
            changed = false;
            var pts = [];
            for (var si = 0; si < segs.length; si++) {
                pts.push(segs[si].p1);
                pts.push(segs[si].p2);
            }

            for (var i = 0; i < segs.length; i++) {
                var s = segs[i];
                for (var k = 0; k < pts.length; k++) {
                    var p = pts[k];
                    if (dist(p, s.p1) > TOL && dist(p, s.p2) > TOL) {
                        if (distToSeg(p, s.p1, s.p2) < TOL) {
                            segs.splice(i, 1);
                            segs.push(
                                { p1: s.p1, p2: p, isCrease: s.isCrease },
                                { p1: p, p2: s.p2, isCrease: s.isCrease }
                            );
                            changed = true;
                            break;
                        }
                    }
                }
                if (changed) break;
            }
        }

        // 4. Gom cụm đỉnh (Vertex Snapping)
        var vertices = [];
        function getV(p) {
            for (var vi = 0; vi < vertices.length; vi++) {
                if (dist([vertices[vi].x, vertices[vi].y], p) < TOL) {
                    return vi;
                }
            }
            vertices.push({ x: p[0], y: p[1] });
            return vertices.length - 1;
        }

        var edgeMap = {};
        var cleanEdges = [];
        segs.forEach(function (s) {
            var u = getV(s.p1), v = getV(s.p2);
            if (u === v) return;
            var k = u < v ? u + '_' + v : v + '_' + u;
            if (!edgeMap[k]) {
                edgeMap[k] = { u: u, v: v, isCrease: s.isCrease };
                cleanEdges.push(edgeMap[k]);
            } else {
                if (s.isCrease) edgeMap[k].isCrease = true;
            }
        });

        // 5. Xây dựng Half-Edges và sắp xếp góc ngược chiều kim đồng hồ (CCW)
        var halfEdges = [];
        cleanEdges.forEach(function (e) {
            var h1 = { from: e.u, to: e.v, isCrease: e.isCrease, twin: null };
            var h2 = { from: e.v, to: e.u, isCrease: e.isCrease, twin: null };
            h1.twin = h2; h2.twin = h1;
            halfEdges.push(h1, h2);
        });

        var outgoing = vertices.map(function () { return []; });
        halfEdges.forEach(function (h) {
            var u = vertices[h.from], v = vertices[h.to];
            h.angle = Math.atan2(v.y - u.y, v.x - u.x);
            outgoing[h.from].push(h);
        });

        outgoing.forEach(function (list) {
            list.sort(function (a, b) { return a.angle - b.angle; });
        });

        // Đi theo mặt phẳng bên trái: cạnh tiếp theo = cạnh trước trong danh sách CCW của twin
        halfEdges.forEach(function (h) {
            var twin = h.twin;
            var list = outgoing[h.to];
            var idx = list.indexOf(twin);
            var nextIdx = (idx - 1 + list.length) % list.length;
            h.next = list[nextIdx];
        });

        // 6. Truy vết các chu trình mặt phẳng kín (Face Cycles)
        var visited = {};
        var allFaces = [];
        halfEdges.forEach(function (startH, hIdx) {
            if (visited[hIdx]) return;
            var cycle = [];
            var curr = startH;
            var cKey = [];
            while (!visited[halfEdges.indexOf(curr)]) {
                var curIdx = halfEdges.indexOf(curr);
                visited[curIdx] = true;
                cycle.push(curr);
                curr = curr.next;
                if (curr === startH) break;
            }
            if (curr === startH && cycle.length >= 3) {
                var area = 0;
                var poly = cycle.map(function (h) { return [vertices[h.from].x, vertices[h.from].y]; });
                var n = poly.length;
                for (var i = 0; i < n; i++) {
                    var p1 = poly[i], p2 = poly[(i + 1) % n];
                    area += (p1[0] * p2[1] - p2[0] * p1[1]);
                }
                area *= 0.5;

                // Mặt phẳng hữu hạn bên trong có diện tích dương > 3mm²
                if (area > 3.0) {
                    var creaseEdges = cycle.filter(function (h) { return h.isCrease; });
                    allFaces.push({
                        poly: poly,
                        area: area,
                        creaseCount: creaseEdges.length,
                        edges: cycle
                    });
                }
            }
        });

        // Tự động suy luận đường cấn nếu toàn bộ nét trong file đều vẽ màu đen (creases = [])
        var explicitCreasesCount = (creases || []).length;
        if (explicitCreasesCount === 0 && allFaces.length > 1) {
            // Các cạnh chung nằm giữa 2 mặt phẳng nội bộ chính là đường cấn gấp
            cleanEdges.forEach(function (e) {
                var leftCount = 0;
                allFaces.forEach(function (f) {
                    f.edges.forEach(function (h) {
                        if ((h.from === e.u && h.to === e.v) || (h.from === e.v && h.to === e.u)) leftCount++;
                    });
                });
                if (leftCount >= 2) {
                    e.isCrease = true;
                    halfEdges.forEach(function (h) {
                        if ((h.from === e.u && h.to === e.v) || (h.from === e.v && h.to === e.u)) h.isCrease = true;
                    });
                }
            });
            allFaces.forEach(function (f) {
                f.creaseCount = f.edges.filter(function (h) { return h.isCrease; }).length;
            });
        }

        // Sắp xếp các mặt theo diện tích từ lớn đến nhỏ
        allFaces.sort(function (a, b) { return b.area - a.area; });

        // 7. Phân biệt Mặt phẳng thực (Solid Panel) vs Lỗ khoét rỗng (Inner Hole Cutouts)
        var solidPanels = [];
        var holeCandidates = [];

        allFaces.forEach(function (f) {
            if (f.creaseCount > 0) {
                solidPanels.push(f);
            } else {
                holeCandidates.push(f);
            }
        });

        // Gán các lỗ khoét vào mặt phẳng chứa nó (Cửa sổ kính, 4 ô khay bánh, lỗ quai xách...)
        holeCandidates.forEach(function (hc) {
            var cx = 0, cy = 0;
            hc.poly.forEach(function (p) { cx += p[0]; cy += p[1]; });
            cx /= hc.poly.length; cy /= hc.poly.length;

            var enclosing = null;
            for (var si = 0; si < solidPanels.length; si++) {
                if (pointInPoly([cx, cy], solidPanels[si].poly)) {
                    enclosing = solidPanels[si];
                    break;
                }
            }

            if (enclosing) {
                enclosing.holes = enclosing.holes || [];
                enclosing.holes.push(hc.poly);
            } else {
                solidPanels.push(hc);
            }
        });

        if (solidPanels.length === 0 && allFaces.length > 0) {
            solidPanels = allFaces.slice();
        }

        // Nếu vẫn không tìm được mặt nào, fallback tạo 1 mặt toàn diện
        if (solidPanels.length === 0) {
            solidPanels.push({
                poly: [[0, 0], [totalW || 200, 0], [totalW || 200, totalH || 200], [0, totalH || 200]],
                area: (totalW || 200) * (totalH || 200),
                edges: []
            });
        }

        solidPanels.forEach(function (p, idx) {
            p.id = 'panel_' + idx;
        });

        // 8. Tìm các đường bản lề (Hinges) chung giữa các mặt
        var detectedCreases = [];
        for (var i = 0; i < solidPanels.length; i++) {
            var pA = solidPanels[i];
            pA.neighbors = pA.neighbors || [];

            for (var j = i + 1; j < solidPanels.length; j++) {
                var pB = solidPanels[j];
                pB.neighbors = pB.neighbors || [];

                var sharedHingePts = [];
                for (var ea = 0; ea < pA.edges.length; ea++) {
                    var eA = pA.edges[ea];
                    if (eA.isCrease) {
                        for (var eb = 0; eb < pB.edges.length; eb++) {
                            var eB = pB.edges[eb];
                            if (eA.twin === eB) {
                                sharedHingePts.push([
                                    [vertices[eA.from].x, vertices[eA.from].y],
                                    [vertices[eA.to].x, vertices[eA.to].y]
                                ]);
                            }
                        }
                    }
                }

                if (sharedHingePts.length > 0) {
                    var h0 = sharedHingePts[0][0], h1 = sharedHingePts[0][1];
                    detectedCreases.push([h0, h1]);
                    pA.neighbors.push({ target: pB.id, targetIdx: j, hinge: [h0, h1] });
                    pB.neighbors.push({ target: pA.id, targetIdx: i, hinge: [h1, h0] });
                }
            }
        }

        // 9. Chọn Mặt đáy gốc tối ưu (Best Root Panel)
        var bestRootIdx = 0;
        var maxScore = -Infinity;
        var midX = (totalW || 200) / 2, midY = (totalH || 200) / 2;

        solidPanels.forEach(function (p, idx) {
            var cx = 0, cy = 0;
            p.poly.forEach(function (q) { cx += q[0]; cy += q[1]; });
            cx /= p.poly.length; cy /= p.poly.length;
            var distToCenter = Math.hypot(cx - midX, cy - midY);
            var connCount = p.neighbors ? p.neighbors.length : 0;
            var score = (connCount * 2500) + (p.area * 0.5) - (distToCenter * 2.0);
            if (score > maxScore) {
                maxScore = score;
                bestRootIdx = idx;
            }
        });

        var root = solidPanels[bestRootIdx];
        root.face = 'bottom';

        // 10. Dựng cây động học gấp BFS (Kinematic Tree)
        var assigned = {};
        assigned[bestRootIdx] = true;
        var queue = [bestRootIdx];
        root._depth = 0;

        while (queue.length > 0) {
            var currIdx = queue.shift();
            var currP = solidPanels[currIdx];

            (currP.neighbors || []).forEach(function (nbr) {
                var nextIdx = nbr.targetIdx;
                if (!assigned[nextIdx]) {
                    assigned[nextIdx] = true;
                    var childP = solidPanels[nextIdx];
                    childP.parent = currP.id;
                    childP.hinge = nbr.hinge;
                    childP._depth = (currP._depth || 0) + 1;

                    if (childP._depth === 1) {
                        childP.angle = 90;
                        childP.stage = [0.0, 0.65];
                    } else if (childP._depth === 2) {
                        childP.angle = 90;
                        childP.stage = [0.35, 0.85];
                    } else {
                        childP.angle = 90;
                        childP.stage = [0.70, 1.0];
                    }

                    queue.push(nextIdx);
                }
            });
        }

        var finalPanels = solidPanels.map(function (p) {
            return {
                id: p.id,
                parent: p.parent || null,
                hinge: p.hinge || null,
                poly: p.poly,
                holes: p.holes || [],
                angle: p.angle || 0,
                stage: p.stage || [0, 1],
                face: p.face || (p.parent ? 'wall' : 'bottom')
            };
        });

        return {
            panels: finalPanels,
            creases: detectedCreases.length > 0 ? detectedCreases : (creases || []),
            rootId: root.id
        };
    };

    // ── Tạo model 3D từ dữ liệu khuôn bế vector (Hướng A - Thuật toán Planar Graph thực tế) ───
    PS3D.buildFromDieline = function (dielineData) {
        var cuts = dielineData.cuts || [];
        var creases = dielineData.creases || [];
        var w = dielineData.width || 200, h = dielineData.height || 200;

        // Sinh lưới 3D trực tiếp từ dữ liệu vector thực tế, không dùng template cố định
        var part = PS3D.partitionDielineIntoPanels(cuts, creases, w, h);
        var panels = part.panels;
        var detectedCreases = part.creases;

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        panels.forEach(function (pn) {
            pn.poly.forEach(function (q) {
                if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
                if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
            });
        });
        if (!isFinite(minX)) { minX = 0; minY = 0; maxX = w; maxY = h; }

        var builtById = {};
        panels.forEach(function (pn) { builtById[pn.id] = pn; });
        function depth(pn) { return pn.parent ? 1 + depth(builtById[pn.parent]) : 0; }
        panels.forEach(function (pn) { pn._depth = depth(pn); });
        panels.sort(function (a, b) { return a._depth - b._depth; });

        var tplId = 'custom-scanned-' + (dielineData.id || Date.now());
        var tplName = dielineData.name || ('Khuôn AI: ' + (dielineData.docName || 'File hiện tại'));

        var bType = (dielineData.boxType || '').toLowerCase();
        var isTrayOrFlat = (bType === 'tray' || bType === 'divider-tray' ||
                            bType === 'envelope' || bType === 'burger-box' ||
                            bType === 'fries-box' || bType === 'mailer-box');

        var rootPanel = panels.find(function (p) { return !p.parent; }) || panels[0];
        if (!isTrayOrFlat && rootPanel) {
            var children = panels.filter(function (p) { return p.parent === rootPanel.id; });
            if (children.length >= 4) {
                isTrayOrFlat = true;
            }
        }
        var computedRotX = isTrayOrFlat ? 90 : 0;

        var template = {
            id: tplId,
            name: tplName,
            nameEn: dielineData.nameEn || 'Custom Vector Dieline',
            group: dielineData.group || 'Khuôn đã lưu',
            boxType: dielineData.boxType || 'custom',
            drc: dielineData.drc || null,
            closedRotX: computedRotX,
            isCustom: true,
            scannedCuts: cuts,
            scannedCreases: detectedCreases,
            customPanels: panels,
            width: w,
            height: h,
            params: [
                { key: 'W_TOTAL', label: 'Rộng (W)', def: Math.round(w) },
                { key: 'H_TOTAL', label: 'Cao (H)', def: Math.round(h) }
            ],
            build: function (p) {
                return {
                    panels: panels,
                    dims: [
                        { a: [minX, (minY + maxY) / 2], b: [maxX, (minY + maxY) / 2], label: Math.round(w) + ' mm' },
                        { a: [(minX + maxX) / 2, minY], b: [(minX + maxX) / 2, maxY], label: Math.round(h) + ' mm' }
                    ]
                };
            }
        };

        return {
            template: template,
            params: {
                W_TOTAL: Math.round(w),
                H_TOTAL: Math.round(h),
                L: dielineData.drc ? dielineData.drc.L : Math.round(w * 0.4),
                W: dielineData.drc ? dielineData.drc.W : Math.round(w * 0.2),
                H: dielineData.drc ? dielineData.drc.H : Math.round(h * 0.5)
            },
            panels: panels,
            byId: builtById,
            creases: detectedCreases,
            closedRotX: computedRotX,
            bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY },
            dims: [
                { a: [minX, (minY + maxY) / 2], b: [maxX, (minY + maxY) / 2], label: Math.round(w) + ' mm' },
                { a: [(minX + maxX) / 2, minY], b: [(minX + maxX) / 2, maxY], label: Math.round(h) + ' mm' }
            ]
        };
    };

    // ── 3D Folder (Three.js) ────────────────────────────────────────────────
    function ease(p) { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); }

    PS3D.Folder = function (THREE, model, opts) {
        opts = opts || {};
        this.THREE = THREE;
        this.model = model;
        this.root = new THREE.Group();
        this.pivot = new THREE.Group();
        this.inner = new THREE.Group();
        this.root.add(this.pivot);
        this.pivot.add(this.inner);
        this.paperMap = opts.paperMap || null;

        var rough = (opts.roughness !== undefined) ? opts.roughness : 0.74;
        var metal = (opts.metalness !== undefined) ? opts.metalness : 0.0;
        this.frontMat = new THREE.MeshStandardMaterial({ map: opts.paperMap || null, roughness: rough, metalness: metal, side: THREE.FrontSide });
        this.backMat = new THREE.MeshStandardMaterial({ map: opts.backMap || opts.paperMap || null, roughness: 0.86, metalness: 0.0, side: THREE.BackSide });
        this.lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
        this.creaseMat = new THREE.LineBasicMaterial({ color: 0xee2222, linewidth: 2, transparent: true, opacity: 0.85 });

        var uv = opts.uvRect || PS3D.artboardRect(model, 3);
        var self = this;
        this.nodes = [];
        var nodeById = {};

        model.panels.forEach(function (pn) {
            var shape = new THREE.Shape(pn.poly.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
            // Đục lỗ thực tế trong 3D geometry từ pn.holes (cửa sổ, khay chia ô, lỗ quai xách)
            if (pn.holes && pn.holes.length > 0) {
                pn.holes.forEach(function (hPoly) {
                    shape.holes.push(new THREE.Path(hPoly.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
                });
            }

            var geo = new THREE.ShapeGeometry(shape);
            var pos = geo.attributes.position, uvs = [];
            for (var i = 0; i < pos.count; i++) {
                uvs.push((pos.getX(i) - uv.x0) / uv.w, (pos.getY(i) - uv.y0) / uv.h);
            }
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

            var g = new THREE.Group();
            g.matrixAutoUpdate = false;
            var front = new THREE.Mesh(geo, self.frontMat);
            var back = new THREE.Mesh(geo, self.backMat);
            front.castShadow = back.castShadow = true;
            front.receiveShadow = back.receiveShadow = true;
            g.add(front, back);

            // Đường viền cắt (Cut LineLoop) bao ngoài panel
            var lp = pn.poly.map(function (q) { return new THREE.Vector3(q[0], q[1], 0.02); });
            g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(lp), self.lineMat));

            // Đường viền cắt (Cut LineLoop) cho từng lỗ khoét
            if (pn.holes && pn.holes.length > 0) {
                pn.holes.forEach(function (hPoly) {
                    var hlp = hPoly.map(function (q) { return new THREE.Vector3(q[0], q[1], 0.02); });
                    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hlp), self.lineMat));
                });
            }

            // Hiển thị đường cấn 3D (Crease Line Helpers) màu đỏ dọc theo bản lề gập
            if (pn.hinge && pn.hinge.length >= 2) {
                var cPts = [
                    new THREE.Vector3(pn.hinge[0][0], pn.hinge[0][1], 0.04),
                    new THREE.Vector3(pn.hinge[1][0], pn.hinge[1][1], 0.04)
                ];
                g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cPts), self.creaseMat));
            }

            self.inner.add(g);

            var node = { panel: pn, group: g, matrix: new THREE.Matrix4(), parent: pn.parent ? nodeById[pn.parent] : null };
            if (pn.parent) {
                var a = new THREE.Vector3(pn.hinge[0][0], pn.hinge[0][1], 0);
                var b = new THREE.Vector3(pn.hinge[1][0], pn.hinge[1][1], 0);
                var d = b.clone().sub(a).normalize();
                // Tâm mặt con → xác định chiều xoay để gập về phía -Z (vào trong)
                var cx = 0, cy = 0;
                pn.poly.forEach(function (q) { cx += q[0]; cy += q[1]; });
                cx /= pn.poly.length; cy /= pn.poly.length;
                var cross = d.x * (cy - a.y) - d.y * (cx - a.x);
                var sign = cross < 0 ? 1 : -1;
                node.a = a;
                node.axis = d;
                node.angle = sign * (pn.angle || 90) * Math.PI / 180;
                node.stage = pn.stage || [0, 1];
            }
            nodeById[pn.id] = node;
            self.nodes.push(node);
        });

        // Hỗ trợ chi tiết phụ kiện 3D bổ sung (quai xách, dây đai túi, v.v.)
        if (model.extras && typeof model.extras === 'function') {
            try {
                var extraObj = model.extras(THREE, {
                    material: self.frontMat,
                    uvRect: uv
                });
                if (extraObj) {
                    self.inner.add(extraObj);
                    self.extraObj = extraObj;
                }
            } catch (errExtra) {
                console.warn('Lỗi dựng model extras:', errExtra);
            }
        }

        this._tmp = { t1: new THREE.Matrix4(), r: new THREE.Matrix4(), t2: new THREE.Matrix4(), v: new THREE.Vector3() };
    };

    PS3D.Folder.prototype.setT = function (t) {
        var T = this._tmp, THREE = this.THREE;
        this.nodes.forEach(function (n) {
            if (!n.parent) {
                n.matrix.identity();
            } else {
                var s0 = n.stage[0], s1 = n.stage[1];
                var ang = ease((t - s0) / Math.max(1e-6, s1 - s0)) * n.angle;
                T.t1.makeTranslation(n.a.x, n.a.y, 0);
                T.r.makeRotationAxis(n.axis, ang);
                T.t2.makeTranslation(-n.a.x, -n.a.y, 0);
                n.matrix.copy(n.parent.matrix).multiply(T.t1).multiply(T.r).multiply(T.t2);
            }
            n.group.matrix.copy(n.matrix);
            n.group.matrixWorldNeedsUpdate = true;
        });

        // Xoay cả khối về tư thế đứng (vd khay: đáy nằm xuống sàn)
        this.pivot.rotation.set(ease(t) * this.model.closedRotX * Math.PI / 180, 0, 0);
        this.pivot.position.set(0, 0, 0);
        this.pivot.updateMatrix();

        // Căn tâm: đáy chạm sàn (y=0), tâm X/Z tại gốc
        var minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        var pm = this.pivot.matrix, v = T.v;
        this.nodes.forEach(function (n) {
            n.panel.poly.forEach(function (q) {
                v.set(q[0], q[1], 0).applyMatrix4(n.matrix).applyMatrix4(pm);
                if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
            });
        });
        this.pivot.position.set(-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2);

        // Ẩn quai xách khi trải phẳng 2D, chỉ hiện rõ khi gập thành hình túi
        if (this.extraObj) {
            this.extraObj.visible = (t > 0.35);
        }
    };

    PS3D.Folder.prototype.setArtwork = function (tex) {
        this.frontMat.map = tex || this.paperMap;
        this.frontMat.needsUpdate = true;
    };

    PS3D.Folder.prototype.setWireframe = function (on) {
        this.frontMat.wireframe = this.backMat.wireframe = !!on;
    };

    PS3D.Folder.prototype.dispose = function () {
        this.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
        this.frontMat.dispose(); this.backMat.dispose(); this.lineMat.dispose();
        if (this.creaseMat) this.creaseMat.dispose();
        if (this.root.parent) this.root.parent.remove(this.root);
    };

})(typeof window !== 'undefined' ? window : this);
