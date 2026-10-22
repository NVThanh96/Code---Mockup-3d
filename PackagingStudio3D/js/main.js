/**
 * ============================================================================
 * PACKAGING STUDIO 3D — main.js (v2.1)
 * Panel CEP: Thư viện mẫu hộp phong phú + 3D gập/mở chuẩn Pacdora + đồng bộ AI
 * Mọi hình học lấy từ PS3D (js/ps3d_core.js + templates/*.js) → 2D và 3D luôn khớp.
 * ============================================================================
 */
(function () {
    'use strict';

    // ── CSInterface ─────────────────────────────────────────────────────────
    var cs = null;
    try { if (window.__adobe_cep__) cs = new CSInterface(); } catch (e) { /* chạy ngoài Illustrator */ }

    function evalScript(code, cb) {
        if (cs) cs.evalScript(code, cb || function () {});
        else { console.log('[DEV] ' + code.slice(0, 120)); if (cb) cb('{"ok":false,"msg":"dev"}'); }
    }
    // Gọi hàm ExtendScript, truyền 1 tham số chuỗi (JSON được bọc thành literal an toàn)
    function callHost(fn, arg, cb) {
        var a = arg === undefined ? '' : JSON.stringify(typeof arg === 'string' ? arg : JSON.stringify(arg));
        evalScript(fn + '(' + a + ')', function (r) {
            var res;
            try { res = JSON.parse(r); } catch (e) { res = { ok: false, msg: String(r) }; }
            if (cb) cb(res || { ok: false });
        });
    }

    // Node (CEP --enable-nodejs) để đọc file, xuất PNG ra Desktop và bật Windows Explorer
    var nodeRequire = (typeof require === 'function') ? require :
        (window.cep_node && window.cep_node.require) ? window.cep_node.require : null;

    function setStatus(msg, mode) {
        var bar = document.getElementById('statusbar');
        var txt = document.getElementById('status-text');
        if (bar) bar.className = mode || '';
        if (txt) txt.textContent = msg;
    }
    function $(id) { return document.getElementById(id); }

    // ── Nạp tự động mọi file mẫu trong thư mục templates/ ────────────────────
    (function autoLoadTemplates() {
        if (!nodeRequire || !cs) return;
        try {
            var fs = nodeRequire('fs'), path = nodeRequire('path');
            var dir = path.join(cs.getSystemPath(SystemPath.EXTENSION), 'templates');
            fs.readdirSync(dir).forEach(function (f) {
                if (!/\.js$/i.test(f)) return;
                try { (new Function(fs.readFileSync(path.join(dir, f), 'utf8')))(); }
                catch (e) { console.warn('Lỗi mẫu ' + f, e); }
            });
        } catch (e) { console.warn('autoLoadTemplates', e); }
    })();

    // ── Khởi tạo lưu trữ vĩnh viễn và tải tất cả mẫu đã lưu ──────────────
    PS3D.initStorage(nodeRequire);
    PS3D.loadAllFromStorage();

    // ── State ───────────────────────────────────────────────────────────────
    var templatesList = PS3D.getTemplates();
    var state = {
        tpl: templatesList[0],
        params: PS3D.defaultParams(templatesList[0]),
        bleed: 3,
        material: 'kraft',
        sliderVal: 100,
        autoPlay: false,
        autoPlayDir: -0.65,
        wireframe: false,
        activeDoc: null,      // tên file AI đang active
        follow: false,
        searchQuery: '',
        categoryFilter: 'all'
    };
    var artCache = {};        // tên file → THREE.Texture artwork

    // ── Presets vật liệu thực tế (Pacdora Materials) ─────────────────────────
    var MATERIALS = {
        kraft: {
            bg: '#ceaa75', amp: 24, fiber: true, rough: 0.78, metal: 0.02,
            backBg: '#b89462', name: 'Giấy Kraft nâu'
        },
        ivory: {
            bg: '#f8f8fb', amp: 8, fiber: false, rough: 0.55, metal: 0.01,
            backBg: '#eeeef2', name: 'Giấy Ivory trắng'
        },
        flute: {
            bg: '#c5a470', amp: 20, flute: true, rough: 0.85, metal: 0.0,
            backBg: '#b08e5c', name: 'Carton sóng E'
        },
        matte_black: {
            bg: '#1c1c1f', amp: 10, rough: 0.88, metal: 0.05,
            backBg: '#18181a', name: 'Giấy mỹ thuật đen nhám'
        },
        gold_foil: {
            bg: '#ffd700', amp: 12, rough: 0.22, metal: 0.88,
            backBg: '#e6c200', name: 'Ép kim vàng Gold Foil'
        },
        silver_foil: {
            bg: '#e2e8f0', amp: 10, rough: 0.20, metal: 0.90,
            backBg: '#cbd5e1', name: 'Ép kim bạc Silver Foil'
        }
    };

    function createPaperCanvas(matKey, w, h) {
        var c = document.createElement('canvas');
        c.width = w || 512; c.height = h || 512;
        var ctx = c.getContext('2d');
        var cfg = MATERIALS[matKey] || MATERIALS.kraft;

        ctx.fillStyle = cfg.bg;
        ctx.fillRect(0, 0, c.width, c.height);

        var amp = cfg.amp;
        var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            var n = (Math.random() - 0.5) * amp;
            d[i]     = Math.min(255, Math.max(0, d[i] + n));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 0.9));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.7));
        }
        ctx.putImageData(img, 0, 0);

        if (cfg.flute) {
            for (var x = 0; x < c.width; x += 12) {
                ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(x, 0, 3, c.height);
                ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + 3, 0, 3, c.height);
            }
        } else if (cfg.fiber) {
            ctx.fillStyle = 'rgba(80,50,20,0.22)';
            for (var f = 0; f < 300; f++) {
                ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 2.5, 1);
            }
        }
        return c;
    }

    function paperTexture(matKey, uvRect) {
        var tex = new THREE.CanvasTexture(createPaperCanvas(matKey));
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(uvRect.w / 120, uvRect.h / 120);
        return tex;
    }

    // ════════════════════════════════════════════════════════════════════════
    // THREE.JS SCENE SETUP (Studio Pacdora với sàn tối và lưới grid)
    // ════════════════════════════════════════════════════════════════════════
    var canvas = $('canvas3d');
    var vpWrap = $('viewport-wrap');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(36, 1, 1, 5000);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.85;

    // Ánh sáng Studio mềm mại
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.70);
    scene.add(ambientLight);

    var sunLight = new THREE.DirectionalLight(0xfff8ee, 1.2);
    sunLight.position.set(160, 260, 180);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -450;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 450;
    sunLight.shadow.camera.far = 1600;
    scene.add(sunLight);

    var fillLight = new THREE.DirectionalLight(0xddeeff, 0.5);
    fillLight.position.set(-160, 110, -90);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(0, 180, -220);
    scene.add(rimLight);

    // Lưới sàn tối (Dark Grid Floor chuẩn hình ảnh người dùng)
    var gridHelper = new THREE.GridHelper(1200, 40, 0x444455, 0x272733);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // Sàn bóng đổ mềm
    var shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ opacity: 0.35 }));
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // ── Mô hình hiện tại ───────────────────────────────────────────────────
    var model = null, folder = null, lastFitKey = '';

    function rebuild3D(keepCamera) {
        model = PS3D.build(state.tpl, state.params);
        var uvRect = PS3D.artboardRect(model, state.bleed);
        var matCfg = MATERIALS[state.material] || MATERIALS.kraft;

        if (folder) folder.dispose();
        folder = new PS3D.Folder(THREE, model, {
            paperMap: paperTexture(state.material, uvRect),
            backMap: paperTexture(state.material === 'ivory' ? 'ivory' : 'kraft', uvRect),
            roughness: matCfg.rough,
            metalness: matCfg.metal,
            uvRect: uvRect
        });
        folder.setWireframe(state.wireframe);

        if (state.activeDoc && artCache[state.activeDoc] && docMatchesCurrent(state.activeDoc)) {
            folder.setArtwork(artCache[state.activeDoc]);
        }
        scene.add(folder.root);
        folder.setT(state.sliderVal / 100);
        updateInfo(uvRect);

        var fitKey = state.tpl.id + JSON.stringify(state.params);
        if (!keepCamera && fitKey !== lastFitKey) fitCamera();
        lastFitKey = fitKey;
    }

    function docMatchesCurrent(name) {
        var d = (lastState && lastState.docs || []).filter(function (x) { return x.name === name; })[0];
        return !d || !d.meta || d.meta.templateId === state.tpl.id;
    }

    function fitCamera() {
        if (!model) return;
        var p = model.params || {};
        var b = model.bounds || {};
        var boundMax = Math.max(b.w || 0, b.h || 0);
        var maxDim = Math.max(boundMax, p.L || 50, p.W || 50, p.H || 50, p.W_TOTAL || 0, p.H_TOTAL || 0);
        if (maxDim < 20) maxDim = 100;
        var targetY = Math.max(10, (p.H || maxDim * 0.3) * 0.48);

        // Tính khoảng cách camera theo FOV để bao trọn góc nhìn hộp đẹp mắt (~75% khung nhìn)
        var fovRad = (camera.fov * Math.PI) / 180;
        var dist = (maxDim * 0.95) / Math.sin(fovRad / 2);

        // Góc phối cảnh Isometric nhìn chếch từ trên xuống chuẩn Pacdora Studio
        camera.position.set(dist * 0.65, dist * 0.68, dist * 1.15);
        camera.near = 1;
        camera.far = dist * 20;
        camera.updateProjectionMatrix();

        controls.target.set(0, targetY, 0);
        controls.minDistance = maxDim * 0.4;
        controls.maxDistance = dist * 8;
        controls.update();
    }

    function updateInfo(uvRect) {
        var b = model.bounds;
        $('info-size').textContent = b.w.toFixed(1) + ' × ' + b.h.toFixed(1) + ' mm';
        $('info-ab').textContent = uvRect.w.toFixed(0) + ' × ' + uvRect.h.toFixed(0) + ' mm';
        $('info-panels').textContent = model.panels.length;
        $('info-creases').textContent = PS3D.dieline(model).creases.length;
        var lbl = $('lid-val'), t = state.sliderVal / 100;
        if (lbl) lbl.textContent = t >= 0.98 ? 'Đóng' : t <= 0.02 ? 'Trải phẳng' : Math.round(state.sliderVal) + '%';
    }

    function setSlider(v) {
        state.sliderVal = Math.max(0, Math.min(100, +v));
        $('slider-main-pill').value = state.sliderVal;
        $('slider-lid').value = state.sliderVal;
        if (folder) folder.setT(state.sliderVal / 100);
        var lbl = $('lid-val'), t = state.sliderVal / 100;
        lbl.textContent = t >= 0.98 ? 'Đóng' : t <= 0.02 ? 'Trải phẳng' : Math.round(state.sliderVal) + '%';
    }

    // ── Resize & loop ──────────────────────────────────────────────────────
    function onResize() {
        var w = vpWrap.clientWidth, h = vpWrap.clientHeight || 300;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    onResize();

    (function animate() {
        requestAnimationFrame(animate);
        if (state.autoPlay) {
            var v = state.sliderVal + state.autoPlayDir;
            if (v <= 0) { v = 0; state.autoPlayDir = 0.65; }
            if (v >= 100) { v = 100; state.autoPlayDir = -0.65; }
            setSlider(v);
        }
        controls.update();
        renderer.render(scene, camera);
    })();

    // ════════════════════════════════════════════════════════════════════════
    // THƯ VIỆN MẪU HỘP + TÌM KIẾM & BỘ LỌC DANH MỤC
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // THƯ VIỆN MẪU HỘP + TÌM KIẾM, BỘ LỌC DANH MỤC & XÓA NHIỀU MẪU (BATCH)
    // ════════════════════════════════════════════════════════════════════════
    var selectedTemplateIds = {};

    function updateCategoryOptions(templates) {
        var sel = $('tpl-category-filter');
        if (!sel) return;
        var currentVal = sel.value;
        var groups = {};
        templates.forEach(function (t) {
            if (t.group) groups[t.group] = true;
        });

        // Giữ lại option "all"
        var html = '<option value="all">Tất cả danh mục</option>';
        Object.keys(groups).sort().forEach(function (grp) {
            html += '<option value="' + grp.replace(/"/g, '&quot;') + '">' + grp + '</option>';
        });
        sel.innerHTML = html;
        if (groups[currentVal] || currentVal === 'all') {
            sel.value = currentVal;
        } else {
            sel.value = 'all';
            state.categoryFilter = 'all';
        }
    }

    function renderLibrary() {
        templatesList = PS3D.getTemplates();
        updateCategoryOptions(templatesList);

        var q = (state.searchQuery || '').trim().toLowerCase();
        var cat = state.categoryFilter || 'all';

        var filtered = templatesList.filter(function (tpl) {
            var matchCat = (cat === 'all') || (tpl.group === cat);
            var matchText = !q || (tpl.name && tpl.name.toLowerCase().indexOf(q) !== -1) ||
                            (tpl.nameEn && tpl.nameEn.toLowerCase().indexOf(q) !== -1) ||
                            (tpl.group && tpl.group.toLowerCase().indexOf(q) !== -1);
            return matchCat && matchText;
        });

        var grid = $('tpl-grid');
        grid.innerHTML = '';

        // Cập nhật số lượng checkbox đang chọn
        updateBatchDeleteBtn(filtered);

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:15px;color:var(--text-dim)">Không tìm thấy mẫu phù hợp.</div>';
        } else {
            filtered.forEach(function (tpl) {
                var isSelected = !!selectedTemplateIds[tpl.id];
                var card = document.createElement('div');
                card.className = 'tpl-card' + (tpl.id === state.tpl.id ? ' active' : '') + (isSelected ? ' selected' : '');
                var svg = tpl._thumbSvg;
                if (!svg) {
                    try {
                        svg = PS3D.thumbnailSVG(PS3D.build(tpl, PS3D.defaultParams(tpl)));
                        tpl._thumbSvg = svg;
                    } catch (e) {
                        svg = '⚠';
                    }
                }

                var chkBox = '<div class="card-chk-wrap">' +
                    '<input type="checkbox" class="c-chk" data-id="' + tpl.id + '"' + (isSelected ? ' checked' : '') + ' title="Chọn để xóa hoặc thao tác hàng loạt"/>' +
                    '</div>';

                var actionButtons = '<div class="card-actions">' +
                    '<button class="c-btn c-rename" title="Sửa tên">✏️</button>' +
                    '<button class="c-btn c-clone" title="Nhân bản (Clone)">📋</button>' +
                    (tpl.isCustom ? '<button class="c-btn c-del" title="Xóa mẫu">🗑️</button>' : '') +
                    '</div>';

                card.innerHTML = chkBox + actionButtons + '<div class="thumb">' + svg + '</div><div class="tname">' + tpl.name +
                    '</div><div class="tgroup">' + (tpl.group || '') + '</div>';

                // Event checkbox
                var chk = card.querySelector('.c-chk');
                if (chk) {
                    chk.addEventListener('click', function (e) {
                        e.stopPropagation();
                    });
                    chk.addEventListener('change', function (e) {
                        e.stopPropagation();
                        if (this.checked) {
                            selectedTemplateIds[tpl.id] = true;
                            card.classList.add('selected');
                        } else {
                            delete selectedTemplateIds[tpl.id];
                            card.classList.remove('selected');
                        }
                        updateBatchDeleteBtn(filtered);
                    });
                }

                var btnRename = card.querySelector('.c-rename');
                if (btnRename) {
                    btnRename.addEventListener('click', function (e) {
                        e.stopPropagation();
                        renameTemplateAction(tpl.id);
                    });
                }

                var btnClone = card.querySelector('.c-clone');
                if (btnClone) {
                    btnClone.addEventListener('click', function (e) {
                        e.stopPropagation();
                        cloneTemplateAction(tpl.id);
                    });
                }

                var btnDel = card.querySelector('.c-del');
                if (btnDel) {
                    btnDel.addEventListener('click', function (e) {
                        e.stopPropagation();
                        deleteTemplateAction(tpl.id);
                    });
                }

                card.addEventListener('click', function (e) {
                    // Nếu giữ phím Ctrl / Shift hoặc khi đang có các mẫu khác được tick chọn: Click vào thẻ sẽ toggle chọn/bỏ chọn
                    var hasSelections = Object.keys(selectedTemplateIds).length > 0;
                    if (e.ctrlKey || e.metaKey || e.shiftKey || hasSelections) {
                        if (selectedTemplateIds[tpl.id]) {
                            delete selectedTemplateIds[tpl.id];
                            card.classList.remove('selected');
                            if (chk) chk.checked = false;
                        } else {
                            selectedTemplateIds[tpl.id] = true;
                            card.classList.add('selected');
                            if (chk) chk.checked = true;
                        }
                        updateBatchDeleteBtn(filtered);
                        return;
                    }
                    selectTemplate(tpl.id);
                });
                grid.appendChild(card);
            });
        }
        $('tpl-count').textContent = filtered.length + '/' + templatesList.length + ' mẫu';
    }

    function updateBatchDeleteBtn(filteredList) {
        var count = Object.keys(selectedTemplateIds).length;
        var btn = $('btn-batch-delete');
        var cntLbl = $('batch-selected-count');
        var chkAll = $('chk-select-all');

        if (cntLbl) cntLbl.textContent = count;
        if (btn) btn.disabled = (count === 0);

        if (chkAll && filteredList && filteredList.length > 0) {
            var allSelected = filteredList.every(function (t) { return !!selectedTemplateIds[t.id]; });
            chkAll.checked = allSelected;
        } else if (chkAll) {
            chkAll.checked = false;
        }
    }

    // Chọn tất cả
    $('chk-select-all').addEventListener('change', function () {
        var isChecked = this.checked;
        var q = (state.searchQuery || '').trim().toLowerCase();
        var cat = state.categoryFilter || 'all';

        templatesList.forEach(function (tpl) {
            var matchCat = (cat === 'all') || (tpl.group === cat);
            var matchText = !q || (tpl.name && tpl.name.toLowerCase().indexOf(q) !== -1) ||
                            (tpl.nameEn && tpl.nameEn.toLowerCase().indexOf(q) !== -1) ||
                            (tpl.group && tpl.group.toLowerCase().indexOf(q) !== -1);
            if (matchCat && matchText) {
                if (isChecked) {
                    selectedTemplateIds[tpl.id] = true;
                } else {
                    delete selectedTemplateIds[tpl.id];
                }
            }
        });
        renderLibrary();
    });

    // Nút Bỏ chọn tất cả
    var btnDeselectAll = $('btn-deselect-all');
    if (btnDeselectAll) {
        btnDeselectAll.addEventListener('click', function () {
            selectedTemplateIds = {};
            renderLibrary();
        });
    }

    // Nút Chuyển đổi 3 hàng / 6 hàng (Mở rộng thư viện theo chiều dọc)
    var btnToggleRows = $('btn-toggle-rows');
    var is6Rows = false;
    if (btnToggleRows) {
        btnToggleRows.addEventListener('click', function () {
            is6Rows = !is6Rows;
            var grid = $('tpl-grid');
            var lbl = $('rows-label');

            if (grid) grid.classList.toggle('rows-6', is6Rows);
            this.classList.toggle('active', is6Rows);

            if (lbl) lbl.textContent = is6Rows ? '3 hàng' : '6 hàng';
            this.title = is6Rows ? 'Thu gọn về 3 hàng mẫu' : 'Mở rộng xem 6 hàng mẫu';
        });
    }

    // Nút Xóa Hàng Loạt
    $('btn-batch-delete').addEventListener('click', function () {
        var idsToDelete = Object.keys(selectedTemplateIds);
        if (idsToDelete.length === 0) return;

        // Chỉ xóa các mẫu custom, cảnh báo nếu có mẫu mặc định
        var customIds = idsToDelete.filter(function (id) {
            var tpl = PS3D.getTemplate(id);
            return tpl && tpl.isCustom;
        });

        if (customIds.length === 0) {
            alert('Các mẫu bạn chọn đều là mẫu gốc mặc định của hệ thống, không thể xóa.');
            return;
        }

        if (confirm('Bạn có chắc muốn xóa vĩnh viễn ' + customIds.length + ' mẫu hộp đã chọn khỏi thư viện không?')) {
            customIds.forEach(function (id) {
                PS3D.removeTemplate(id);
                PS3D.removeTemplateFromStorage(id);
                delete selectedTemplateIds[id];
            });

            // Nếu mẫu đang xem bị xóa thì chuyển sang mẫu đầu tiên còn lại
            if (selectedTemplateIds[state.tpl.id] || !PS3D.getTemplate(state.tpl.id)) {
                var remaining = PS3D.getTemplates();
                if (remaining.length > 0) selectTemplate(remaining[0].id);
            }

            renderLibrary();
            setStatus('✓ Đã xóa thành công ' + customIds.length + ' mẫu hộp khỏi thư viện!');
        }
    });

    // Toggle Ẩn / Hiện các mục (Collapsible Accordion)
    document.querySelectorAll('.section-header[data-toggle]').forEach(function (hdr) {
        hdr.addEventListener('click', function (e) {
            // Không kích hoạt toggle nếu click vào button hoặc input bên trong header
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('badge-hl')) return;
            var secId = this.getAttribute('data-toggle');
            var sec = $(secId);
            if (sec) {
                sec.classList.toggle('collapsed');
            }
        });
    });

    $('tpl-search').addEventListener('input', function () {
        state.searchQuery = this.value;
        renderLibrary();
    });
    $('tpl-category-filter').addEventListener('change', function () {
        state.categoryFilter = this.value;
        renderLibrary();
    });

    // ── Thao tác Quản lý Thư viện: Sửa tên, Nhân bản (Clone), Xóa ───────────
    function renameTemplateAction(tplId) {
        var tpl = PS3D.getTemplate(tplId);
        if (!tpl) return;
        var newName = prompt('Nhập tên mới cho mẫu hộp:', tpl.name);
        if (newName && newName.trim() && newName.trim() !== tpl.name) {
            tpl.name = newName.trim();
            tpl.isCustom = true;
            PS3D.saveTemplateToStorage(tpl);
            renderLibrary();
            if (state.tpl.id === tplId) {
                $('tpl-name-label').textContent = tpl.name;
            }
            setStatus('✓ Đã đổi tên thành: "' + tpl.name + '".');
        }
    }

    function cloneTemplateAction(tplId) {
        var tpl = PS3D.getTemplate(tplId);
        if (!tpl) return;
        var newName = prompt('Nhập tên cho thiết kế clone (Bản sao):', tpl.name + ' (Bản sao)');
        if (!newName || !newName.trim()) return;

        var cloneId = 'custom_' + Date.now();
        var clonedData = {
            id: cloneId,
            name: newName.trim(),
            group: tpl.group || 'Khuôn đã lưu',
            boxType: tpl.boxType,
            baseTemplateId: tpl.baseTemplateId || tpl.id,
            drc: Object.assign({}, tpl.drc || state.params),
            params: (tpl.params || []).map(function (param) {
                return { key: param.key, label: param.label, def: state.params[param.key] || param.def };
            }),
            closedRotX: tpl.closedRotX,
            scannedCuts: tpl.scannedCuts,
            scannedCreases: tpl.scannedCreases,
            customPanels: tpl.customPanels,
            isCustom: true
        };

        var newTpl = PS3D.registerSavedTemplate(clonedData);
        PS3D.saveTemplateToStorage(newTpl);
        renderLibrary();
        selectTemplate(newTpl.id);
        setStatus('✓ Đã nhân bản thiết kế: "' + newTpl.name + '"!');
    }

    function deleteTemplateAction(tplId) {
        var tpl = PS3D.getTemplate(tplId);
        if (!tpl) return;
        if (!tpl.isCustom) {
            alert('Không thể xóa mẫu mặc định của hệ thống.');
            return;
        }
        if (confirm('Bạn có chắc muốn xóa mẫu "' + tpl.name + '" khỏi thư viện vĩnh viễn không?')) {
            PS3D.removeTemplate(tplId);
            PS3D.removeTemplateFromStorage(tplId);
            delete selectedTemplateIds[tplId];
            renderLibrary();
            if (state.tpl.id === tplId) {
                selectTemplate(templatesList[0].id);
            }
            setStatus('✓ Đã xóa mẫu "' + tpl.name + '" khỏi thư viện.');
        }
    }

    // ── Hai nút lưu: Lưu đè & Lưu thành mẫu mới ─────────────────────────────
    $('btn-save-overwrite').addEventListener('click', function () {
        var tpl = state.tpl;
        // Cập nhật giá trị def của params theo kích thước đang chỉnh
        (tpl.params || []).forEach(function (p) {
            if (state.params[p.key] !== undefined) {
                p.def = state.params[p.key];
            }
        });
        tpl.isCustom = true;
        tpl.group = 'Khuôn đã lưu';
        PS3D.saveTemplateToStorage(tpl);
        renderLibrary();
        setStatus('✓ Đã lưu đè thông số mới vào mẫu "' + tpl.name + '"!');
    });

    $('btn-save-as-new').addEventListener('click', function () {
        var tpl = state.tpl;
        var p = state.params;
        var dims = [p.L || p.W_TOTAL, p.W, p.H].filter(Boolean).join('×');
        var defaultName = tpl.name.replace(/\s*\([^\)]*\)\s*$/, '') + (dims ? ' (' + dims + 'mm)' : ' (Mới)');
        var newName = prompt('Nhập tên cho mẫu hộp mới:', defaultName);
        if (!newName || !newName.trim()) return;

        var newId = 'custom_' + Date.now();
        var newTplData = {
            id: newId,
            name: newName.trim(),
            group: 'Khuôn đã lưu',
            boxType: tpl.boxType,
            baseTemplateId: tpl.baseTemplateId || tpl.id,
            drc: Object.assign({}, tpl.drc || state.params),
            params: (tpl.params || []).map(function (param) {
                return { key: param.key, label: param.label, def: state.params[param.key] || param.def };
            }),
            closedRotX: tpl.closedRotX,
            scannedCuts: tpl.scannedCuts,
            scannedCreases: tpl.scannedCreases,
            customPanels: tpl.customPanels,
            isCustom: true
        };

        var createdTpl = PS3D.registerSavedTemplate(newTplData);
        PS3D.saveTemplateToStorage(createdTpl);
        renderLibrary();
        selectTemplate(createdTpl.id);
        setStatus('✓ Đã lưu mẫu mới: "' + createdTpl.name + '" vào thư viện vĩnh viễn!');
    });

    // ── Hướng A: Quét thông minh khuôn bế từ Illustrator → Dựng 3D & Lưu Thư viện ───
    $('btn-scan-dieline').addEventListener('click', function () {
        if (!cs) { setStatus('Cần mở panel trong Illustrator.', 'error'); return; }
        setStatus('Đang quét và bóc tách các mẫu hộp trong Illustrator…', 'loading');
        callHost('ps3d_scanDieline', undefined, function (res) {
            if (!res.ok) { setStatus('⚠ ' + res.msg, 'error'); return; }

            try {
                var boxes = res.boxes || (res.cuts ? [res] : []);
                if (boxes.length === 0) {
                    setStatus('⚠ Không tìm thấy cụm khuôn bao bì hợp lệ nào.', 'error');
                    return;
                }

                // Đăng ký các mẫu hộp được phân tích vào thư viện VÀ LƯU VĨNH VIỄN
                boxes.forEach(function (box, idx) {
                    var modelObj = PS3D.buildFromDieline(box);
                    modelObj.template.isCustom = true;
                    modelObj.template.group = box.group || 'Khuôn đã lưu';
                    PS3D.registerTemplate(modelObj.template);
                    PS3D.saveTemplateToStorage(modelObj.template);
                });

                // Cập nhật lại giao diện thư viện với các mẫu mới vừa lưu
                renderLibrary();

                // Dựng 3D cho hộp đầu tiên
                var activeBoxData = boxes[0];
                var scannedModel = PS3D.buildFromDieline(activeBoxData);
                model = scannedModel;
                state.tpl = scannedModel.template;
                state.params = scannedModel.params;

                var uvRect = PS3D.artboardRect(model, state.bleed);
                var matCfg = MATERIALS[state.material] || MATERIALS.kraft;

                if (folder) folder.dispose();
                folder = new PS3D.Folder(THREE, model, {
                    paperMap: paperTexture(state.material, uvRect),
                    backMap: paperTexture('kraft', uvRect),
                    roughness: matCfg.rough,
                    metalness: matCfg.metal,
                    uvRect: uvRect
                });
                scene.add(folder.root);
                setSlider(100);

                updateInfo(uvRect);
                fitCamera();
                renderParams();

                if (boxes.length === 1) {
                    setStatus('✓ Đã quét 1 hộp: "' + activeBoxData.name + '" (' + activeBoxData.width.toFixed(0) + '×' + activeBoxData.height.toFixed(0) + 'mm). Đã lưu vĩnh viễn vào thư viện!');
                } else {
                    setStatus('✓ Đã bóc tách ' + boxes.length + ' mẫu hộp và LƯU VĨNH VIỄN vào thư viện! Đang xem: "' + activeBoxData.name + '".');
                }
            } catch (errBuild) {
                console.error('Lỗi buildFromDieline:', errBuild);
                setStatus('⚠ Lỗi phân tích khuôn: ' + errBuild.message, 'error');
            }
        });
    });

    function updateActiveCard(activeId) {
        var cards = document.querySelectorAll('.tpl-card');
        for (var i = 0; i < cards.length; i++) {
            var chk = cards[i].querySelector('.c-chk');
            var cid = chk ? chk.getAttribute('data-id') : null;
            if (cid === activeId) {
                cards[i].classList.add('active');
            } else {
                cards[i].classList.remove('active');
            }
        }
    }

    function selectTemplate(id, params) {
        var tpl = PS3D.getTemplate(id);
        if (!tpl) { setStatus('⚠ Không có mẫu "' + id + '" trong thư viện máy này.', 'error'); return false; }
        state.tpl = tpl;
        state.params = params ? Object.assign(PS3D.defaultParams(tpl), params) : PS3D.defaultParams(tpl);
        updateActiveCard(tpl.id);
        renderParams();
        setSlider(100);
        rebuild3D();
        return true;
    }

    function renderParams() {
        var box = $('param-grid');
        box.innerHTML = '';
        $('tpl-name-label').textContent = state.tpl.name;
        (state.tpl.params || []).forEach(function (d) {
            var wrap = document.createElement('div');
            wrap.className = 'dim-box';
            wrap.innerHTML = '<span>' + d.label + '</span><input type="number" min="1" max="2500" step="0.5" value="' + state.params[d.key] + '"/>';
            var inp = wrap.querySelector('input');
            inp.addEventListener('input', function () {
                var v = parseFloat(inp.value);
                if (isFinite(v) && v > 0) { state.params[d.key] = v; scheduleRebuild(); }
            });
            box.appendChild(wrap);
        });
        $('inp-bleed').value = state.bleed;
    }

    var rebuildTimer = null;
    function scheduleRebuild() {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(function () { rebuild3D(true); }, 120);
    }

    $('inp-bleed').addEventListener('input', function () {
        var v = parseFloat(this.value);
        if (isFinite(v) && v >= 0) { state.bleed = v; scheduleRebuild(); }
    });

    // ════════════════════════════════════════════════════════════════════════
    // ĐỒNG BỘ NHIỀU FILE ILLUSTRATOR (Tối ưu hóa tránh giật lag con trỏ chuột)
    // ════════════════════════════════════════════════════════════════════════
    var lastState = null;
    var lastUserActionTime = 0;
    window.addEventListener('mousemove', function () { lastUserActionTime = Date.now(); }, { passive: true });
    window.addEventListener('mousedown', function () { lastUserActionTime = Date.now(); }, { passive: true });
    window.addEventListener('wheel', function () { lastUserActionTime = Date.now(); }, { passive: true });

    function refreshDocs(force) {
        if (!cs) return;
        // Hoãn poll nếu người dùng đang di chuột hoặc tương tác trong 1.5s qua (tránh blocking main thread Illustrator)
        if (!force && Date.now() - lastUserActionTime < 1500) return;
        callHost('ps3d_getState', undefined, function (res) {
            if (!res || !res.ok) return;
            var same = !force && lastState &&
                lastState.activeDoc === res.activeDoc &&
                lastState.docs.length === res.docs.length &&
                lastState.docs.every(function (d, i) { return d.name === res.docs[i].name && d.hasMeta === res.docs[i].hasMeta; });
            if (same) return;
            lastState = res;
            renderDocList(res.docs, res.activeDoc);

            if (state.follow && res.activeDoc) {
                var cur = res.docs.filter(function (x) { return x.name === res.activeDoc; })[0];
                if (cur && cur.meta && cur.meta.templateId) {
                    if (cur.meta.templateId !== state.tpl.id || JSON.stringify(cur.meta.params) !== JSON.stringify(state.params)) {
                        selectTemplate(cur.meta.templateId, cur.meta.params);
                        if (cur.meta.bleed) { state.bleed = cur.meta.bleed; $('inp-bleed').value = state.bleed; }
                        if (cur.meta.material) setMaterial(cur.meta.material, true);
                    }
                }
                updateDocBadge(cur);
            }
            state.activeDoc = res.activeDoc;
        });
    }
    setInterval(refreshDocs, 3500);

    function updateDocBadge(d) {
        var b = $('doc-badge');
        if (!b) return;
        if (!d) { b.style.display = 'none'; return; }
        b.style.display = 'block';
        b.textContent = '📄 ' + d.name + (d.meta ? ' (' + d.meta.templateName + ')' : ' [Chưa gắn khuôn]');
    }

    function renderDocList(docs, active) {
        var list = $('doc-list');
        list.innerHTML = '';
        if (!docs || docs.length === 0) {
            list.innerHTML = '<div class="doc-empty">Chưa có file nào đang mở trong AI.</div>';
            $('doc-count').textContent = '0 file';
            return;
        }
        $('doc-count').textContent = docs.length + ' file';
        docs.forEach(function (d) {
            var item = document.createElement('div');
            item.className = 'doc-item' + (d.name === active ? ' active' : '');
            var metaText = d.meta ? (d.meta.templateName + ' · ' +
                (d.meta.params ? [d.meta.params.L, d.meta.params.W, d.meta.params.H].filter(Boolean).join('×') : '')) : 'Chưa gắn khuôn';
            item.innerHTML = '<span class="dname" title="' + d.name + '">' + d.name + '</span>' +
                '<span class="dmeta' + (d.meta ? '' : ' none') + '">' + metaText + '</span>';
            item.addEventListener('click', function () {
                callHost('ps3d_activateDoc', d.name, function () { refreshDocs(true); });
            });
            list.appendChild(item);
        });
    }

    $('chk-follow').addEventListener('change', function () { state.follow = this.checked; });

    // ════════════════════════════════════════════════════════════════════════
    // TẠO FILE / ÁP KHUÔN / SYNC ARTWORK / XUẤT MOCKUP
    // ════════════════════════════════════════════════════════════════════════
    function aiPayload() {
        return PS3D.exportForAI(model, { bleed: state.bleed, material: state.material });
    }

    $('btn-new-doc').addEventListener('click', function () {
        if (!cs) { setStatus('Cần mở panel trong Illustrator.', 'error'); return; }
        setStatus('Đang tạo file mới trong Illustrator…', 'loading');
        callHost('ps3d_createDoc', aiPayload(), function (res) {
            if (res.ok) {
                setStatus('✓ Đã tạo file "' + res.name + '" với khuôn ' + state.tpl.name + '.');
                refreshDocs(true);
            } else setStatus('⚠ ' + res.msg, 'error');
        });
    });

    $('btn-update-doc').addEventListener('click', function () {
        if (!cs) { setStatus('Cần mở panel trong Illustrator.', 'error'); return; }
        setStatus('Đang vẽ lại khuôn vào file hiện tại…', 'loading');
        callHost('ps3d_updateDoc', aiPayload(), function (res) {
            if (res.ok) {
                delete artCache[res.name];
                setStatus('✓ Đã áp khuôn ' + state.tpl.name + ' vào "' + res.name + '".' +
                    (res.bleedOk ? '' : ' (Không tạo được bleed tự động)'));
                refreshDocs(true);
            } else setStatus('⚠ ' + res.msg, 'error');
        });
    });

    // ── Sync artwork: layer ARTWORK → texture phủ toàn bộ khuôn 3D ──────────
    function loadImage(path, cb) {
        var img = new Image();
        img.onload = function () { cb(img); };
        img.onerror = function () { cb(null); };
        if (nodeRequire) {
            try {
                var b64 = nodeRequire('fs').readFileSync(path).toString('base64');
                img.src = 'data:image/png;base64,' + b64;
                return;
            } catch (e) { /* fallback */ }
        }
        img.src = 'file:///' + path.replace(/\\/g, '/') + '?t=' + Date.now();
    }

    $('btn-sync-texture').addEventListener('click', function () {
        if (!cs) { setStatus('Cần mở panel trong Illustrator.', 'error'); return; }
        setStatus('Đang xuất thiết kế layer ARTWORK từ Illustrator…', 'loading');
        callHost('ps3d_exportArtwork', undefined, function (res) {
            if (!res.ok) { setStatus('⚠ ' + res.msg, 'error'); return; }
            var docName = res.docName || state.activeDoc || 'Untitled';
            loadImage(res.path, function (img) {
                if (!img) { setStatus('⚠ Không đọc được ảnh artwork.', 'error'); return; }
                // Ghép artwork lên nền giấy (vùng không in vẫn là màu giấy)
                var c = createPaperCanvas(state.material, img.width, img.height);
                c.getContext('2d').drawImage(img, 0, 0);
                var tex = new THREE.CanvasTexture(c);
                tex.encoding = THREE.sRGBEncoding;
                tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                if (artCache[docName]) artCache[docName].dispose();
                artCache[docName] = tex;
                if (folder) folder.setArtwork(tex);
                
                if (res.itemCount === 0) {
                    setStatus('⚠ Layer ARTWORK đang trống! Hãy vẽ logo/màu sắc vào layer ARTWORK trong AI rồi bấm Sync lại.', 'error');
                } else {
                    setStatus('✓ Đã Sync Artwork: Đã dán ' + res.itemCount + ' đối tượng thiết kế từ "' + docName + '" lên 3D.');
                }
            });
        });
    });

    // ── Xuất mockup 3D lưu vào thư mục và TỰ ĐỘNG BẬT WINDOWS EXPLORER ───────
    function saveMockupPNG(scale, fileName) {
        // Căn chỉnh lại camera để mô hình luôn nằm trọn vẹn ở trung tâm khung hình khi render
        fitCamera();
        var orig = renderer.getPixelRatio();
        if (scale) renderer.setPixelRatio(scale);
        renderer.render(scene, camera);
        var dataUrl = canvas.toDataURL('image/png');
        if (scale) { renderer.setPixelRatio(orig); onResize(); }

        var targetPath = null;

        // Nếu có window.cep.fs.showSaveDialogEx thì cho người dùng chọn nơi lưu
        if (window.cep && window.cep.fs && window.cep.fs.showSaveDialogEx) {
            try {
                var dlgRes = window.cep.fs.showSaveDialogEx('Chọn nơi lưu Mockup 3D', '', ['png'], fileName);
                if (dlgRes && dlgRes.data) {
                    targetPath = dlgRes.data;
                }
            } catch (errDlg) {
                console.warn('Lỗi mở dialog CEP:', errDlg);
            }
        }

        if (nodeRequire) {
            try {
                var fs = nodeRequire('fs');
                var path = nodeRequire('path');
                var cp = nodeRequire('child_process');

                if (!targetPath) {
                    // Thư mục Desktop người dùng Windows
                    var home = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\' + (process.env.USERNAME || 'Public');
                    var outDir = path.join(home, 'Desktop');
                    if (!fs.existsSync(outDir)) outDir = path.join(home, 'Pictures');
                    if (!fs.existsSync(outDir)) outDir = home;
                    targetPath = path.join(outDir, fileName);
                }

                var base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(targetPath, base64Data, 'base64');

                // Bật thư mục trong Windows Explorer và chọn sẵn file vừa xuất
                try {
                    cp.exec('explorer.exe /select,"' + targetPath + '"');
                } catch (errExp) {
                    cp.exec('explorer.exe "' + path.dirname(targetPath) + '"');
                }

                setStatus('✓ Đã xuất mockup: ' + targetPath, '');
                return;
            } catch (e) {
                console.warn('Lỗi ghi file qua Node fs:', e);
            }
        }

        // Fallback trình duyệt CEF nếu không gọi được Node fs
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        a.click();
        setStatus('✓ Đã lưu mockup: ' + fileName);
    }

    $('btn-screenshot').addEventListener('click', function () {
        saveMockupPNG(0, 'Snapshot_' + state.tpl.id + '.png');
    });

    $('btn-export-mockup').addEventListener('click', function () {
        var p = state.params;
        var dims = [p.L, p.W, p.H].filter(Boolean).join('x');
        saveMockupPNG(2.5, 'Mockup3D_' + state.tpl.id + '_' + dims + '_' + state.material + '.png');
    });

    // ════════════════════════════════════════════════════════════════════════
    // ĐIỀU KHIỂN GIAO DIỆN & VẬT LIỆU
    // ════════════════════════════════════════════════════════════════════════
    // Ẩn/Hiện thanh điều khiển để xem toàn cảnh 3D
    var controlsPane = $('controls-pane');
    var appLayout = $('app-layout');
    $('btn-toggle-sidebar').addEventListener('click', function () {
        var isCollapsed = controlsPane.classList.toggle('collapsed');
        appLayout.classList.toggle('sidebar-collapsed', isCollapsed);
        this.title = isCollapsed ? 'Hiện thanh điều khiển' : 'Ẩn thanh điều khiển';
        setTimeout(function () {
            onResize();
            fitCamera();
        }, 100);
        setTimeout(function () {
            onResize();
            fitCamera();
        }, 280);
    });

    $('slider-main-pill').addEventListener('input', function () { stopAuto(); setSlider(this.value); });
    $('slider-lid').addEventListener('input', function () { stopAuto(); setSlider(this.value); });

    function stopAuto() {
        state.autoPlay = false;
        $('btn-autoplay').classList.remove('btn-success');
        $('btn-autoplay').textContent = '▶ Auto Play';
    }
    $('btn-autoplay').addEventListener('click', function () {
        state.autoPlay = !state.autoPlay;
        this.classList.toggle('btn-success', state.autoPlay);
        this.textContent = state.autoPlay ? '⏸ Tạm dừng' : '▶ Auto Play';
    });

    $('btn-mode-toggle').addEventListener('click', function () {
        stopAuto();
        if (state.sliderVal > 80) { setSlider(70); this.textContent = '📐 Trải phẳng'; }
        else if (state.sliderVal > 5) { setSlider(0); this.textContent = '📦 Đóng hộp'; }
        else { setSlider(100); this.textContent = '🎁 Mở nắp'; }
    });

    function setMaterial(mat, silent) {
        state.material = mat;
        document.querySelectorAll('.mat-chip').forEach(function (c) {
            c.classList.toggle('active', c.dataset.mat === mat);
        });
        if (!silent) rebuild3D(true);
    }
    document.querySelectorAll('.mat-chip').forEach(function (chip) {
        chip.addEventListener('click', function () { setMaterial(chip.dataset.mat); });
    });

    $('slider-light').addEventListener('input', function () {
        var k = this.value / 100;
        $('light-val').textContent = this.value + '%';
        ambientLight.intensity = k * 0.95;
        sunLight.intensity = k * 1.65;
        fillLight.intensity = k * 0.65;
    });

    $('btn-3d-badge').addEventListener('click', fitCamera);
    $('btn-reset-cam').addEventListener('click', fitCamera);
    $('btn-toggle-wire').addEventListener('click', function () {
        state.wireframe = !state.wireframe;
        this.style.background = state.wireframe ? 'rgba(76,155,232,0.7)' : '';
        if (folder) folder.setWireframe(state.wireframe);
    });

    // ════════════════════════════════════════════════════════════════════════
    // KHỞI ĐỘNG
    // ════════════════════════════════════════════════════════════════════════
    renderLibrary();
    renderParams();
    rebuild3D();

    if (cs) {
        callHost('host_ping', undefined, function (res) {
            if (res.ok) {
                $('app-version').textContent = 'v2.1 · AI ' + String(res.version).split('.')[0];
                setStatus('✓ Đã kết nối Illustrator. Chọn mẫu hộp hoặc file AI đang mở.');
            } else {
                setStatus('⚠ Chưa gọi được ExtendScript: ' + res.msg, 'error');
            }
            refreshDocs(true);
        });
    } else {
        setStatus('Chế độ xem thử (Preview ngoài Illustrator).');
    }
})();
