// Script chuẩn hóa Layer và màu sắc cho Packaging Studio 3D
#target illustrator

function setupStandardPackagingLayers() {
    if (app.documents.length === 0) {
        alert("Vui lòng mở file PDF khuôn hộp trước!");
        return;
    }
    var doc = app.activeDocument;

    // 1. Tạo các Layer chuẩn cho Tool 3D nhận diện
    var layerNames = ["TEXT_ANNOTATION", "GLUE_FLAP", "CREASE_FOLD", "CUT_LINE"];
    var layers = {};

    for (var i = 0; i < layerNames.length; i++) {
        try {
            layers[layerNames[i]] = doc.layers.getByName(layerNames[i]);
        } catch (e) {
            layers[layerNames[i]] = doc.layers.add();
            layers[layerNames[i]].name = layerNames[i];
        }
    }

    // 2. Tự động lọc toàn bộ chữ (TextFrame) đưa vào Layer TEXT_ANNOTATION và khóa lại
    for (var t = doc.textFrames.length - 1; t >= 0; t--) {
        doc.textFrames[t].move(layers["TEXT_ANNOTATION"], ElementPlacement.PLACEATBEGINNING);
    }
    layers["TEXT_ANNOTATION"].locked = true;
    layers["TEXT_ANNOTATION"].visible = false; // Ẩn chữ khi quét 3D

    // 3. Tạo Swatch màu chuẩn RGB/CMYK cho Đường Cắt (Đen) và Đường Gấp (Đỏ)
    alert("Đã tách toàn bộ Text sang layer riêng và ẩn đi!\n\nBây giờ bạn hãy:\n1. Xóa các khung viền chữ nhật bao quanh các mẫu.\n2. Chọn các nét gấp -> Đổi sang màu ĐỎ (R:255, G:0, B:0).\n3. Dùng Shift+O tạo Artboard riêng cho từng mẫu hộp.");
}

setupStandardPackagingLayers();

