const $ = (id) => document.getElementById(id);
const qrList = $("qr-list");
const qrEditor = $("qr-editor");
const qrForm = $("qr-form");
const cropCanvas = $("qr-crop-canvas");
const cropContext = cropCanvas.getContext("2d");
let qrs = [];
let editingQr = null;
let pendingImage = null;
let pendingSourceImage = null;
let pendingCropSelection = null;
let sourceCanvas = null;
let selection = null;
let pointerAction = null;

function showNotice(message, type = "") {
  const notice = $("qr-notice");
  notice.textContent = message;
  notice.className = `notice${type ? ` ${type}` : ""}`;
}

async function requestApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace("/login.html");
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  if (!response.ok) throw new Error(data.error || "Permintaan QRIS gagal.");
  return data;
}

function resetCrop(initialSelection = null) {
  if (!sourceCanvas) return;
  if (
    initialSelection
    && ["x", "y", "w", "h"].every((key) => Number.isFinite(initialSelection[key]))
    && initialSelection.x >= 0
    && initialSelection.y >= 0
    && initialSelection.w > 0
    && initialSelection.h > 0
    && initialSelection.x + initialSelection.w <= 1
    && initialSelection.y + initialSelection.h <= 1
  ) {
    selection = {
      x: initialSelection.x * sourceCanvas.width,
      y: initialSelection.y * sourceCanvas.height,
      w: initialSelection.w * sourceCanvas.width,
      h: initialSelection.h * sourceCanvas.height,
    };
    drawCrop();
    return;
  }
  const side = Math.max(40, Math.floor(Math.min(cropCanvas.width, cropCanvas.height) * 0.78));
  selection = {
    x: Math.floor((cropCanvas.width - side) / 2),
    y: Math.floor((cropCanvas.height - side) / 2),
    w: side,
    h: side,
  };
  drawCrop();
}

function drawCrop() {
  if (!sourceCanvas || !selection) return;
  cropContext.drawImage(sourceCanvas, 0, 0);
  cropContext.fillStyle = "rgba(12, 28, 44, 0.62)";
  cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.clearRect(selection.x, selection.y, selection.w, selection.h);
  cropContext.drawImage(
    sourceCanvas,
    selection.x, selection.y, selection.w, selection.h,
    selection.x, selection.y, selection.w, selection.h
  );
  cropContext.strokeStyle = "#fff";
  cropContext.lineWidth = Math.max(2, cropCanvas.width / 450);
  cropContext.strokeRect(selection.x, selection.y, selection.w, selection.h);
  const handleSize = Math.max(10, Math.min(cropCanvas.width, cropCanvas.height) / 45);
  cropContext.fillStyle = "#fff";
  cropContext.strokeStyle = "#1565c0";
  cropContext.lineWidth = Math.max(2, cropCanvas.width / 500);
  for (const [x, y] of [
    [selection.x, selection.y],
    [selection.x + selection.w, selection.y],
    [selection.x, selection.y + selection.h],
    [selection.x + selection.w, selection.y + selection.h],
    [selection.x + selection.w / 2, selection.y],
    [selection.x + selection.w / 2, selection.y + selection.h],
    [selection.x, selection.y + selection.h / 2],
    [selection.x + selection.w, selection.y + selection.h / 2],
  ]) {
    cropContext.beginPath();
    cropContext.arc(x, y, handleSize / 2, 0, Math.PI * 2);
    cropContext.fill();
    cropContext.stroke();
  }
}

async function setCropSource(imageSource, initialSelection = null) {
  const bitmap = await createImageBitmap(imageSource);
  if (bitmap.width * bitmap.height > 24_000_000) {
    bitmap.close();
    throw new Error("Resolusi gambar terlalu besar. Pilih gambar dengan resolusi lebih rendah.");
  }
  if (bitmap.width < 40 || bitmap.height < 40) {
    bitmap.close();
    throw new Error("Resolusi gambar terlalu kecil untuk memilih area QRIS.");
  }
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
  sourceCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = sourceCanvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Gambar tidak dapat diproses di browser ini.");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  context.drawImage(bitmap, 0, 0, sourceCanvas.width, sourceCanvas.height);
  bitmap.close();
  cropCanvas.width = sourceCanvas.width;
  cropCanvas.height = sourceCanvas.height;
  selection = null;
  $("qr-crop-stage").hidden = false;
  resetCrop(initialSelection);
}

function cropPoint(event) {
  const bounds = cropCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * cropCanvas.width / bounds.width,
    y: (event.clientY - bounds.top) * cropCanvas.height / bounds.height,
  };
}

function resizedRange(anchor, position, length) {
  const next = Math.max(0, Math.min(length, position));
  if (next < anchor) {
    const end = Math.min(length, Math.max(40, anchor));
    const start = Math.min(next, end - 40);
    return { start, size: end - start };
  }
  const start = Math.min(anchor, length - 40);
  const end = Math.max(next, start + 40);
  return { start, size: Math.min(length - start, end - start) };
}

function findResizeHandle(point) {
  const radius = Math.max(20, Math.min(cropCanvas.width, cropCanvas.height) / 30);
  const corners = [
    { x: selection.x, y: selection.y, anchorX: selection.x + selection.w, anchorY: selection.y + selection.h },
    { x: selection.x + selection.w, y: selection.y, anchorX: selection.x, anchorY: selection.y + selection.h },
    { x: selection.x, y: selection.y + selection.h, anchorX: selection.x + selection.w, anchorY: selection.y },
    { x: selection.x + selection.w, y: selection.y + selection.h, anchorX: selection.x, anchorY: selection.y },
  ];
  const corner = corners.find((handle) =>
    Math.hypot(point.x - handle.x, point.y - handle.y) <= radius
  );
  if (corner) return { type: "corner", ...corner };

  if (Math.abs(point.x - selection.x) <= radius && point.y >= selection.y + radius && point.y <= selection.y + selection.h - radius) {
    return { type: "edge-x", side: "left", anchorX: selection.x + selection.w };
  }
  if (Math.abs(point.x - (selection.x + selection.w)) <= radius && point.y >= selection.y + radius && point.y <= selection.y + selection.h - radius) {
    return { type: "edge-x", side: "right", anchorX: selection.x };
  }
  if (Math.abs(point.y - selection.y) <= radius && point.x >= selection.x + radius && point.x <= selection.x + selection.w - radius) {
    return { type: "edge-y", side: "top", anchorY: selection.y + selection.h };
  }
  if (Math.abs(point.y - (selection.y + selection.h)) <= radius && point.x >= selection.x + radius && point.x <= selection.x + selection.w - radius) {
    return { type: "edge-y", side: "bottom", anchorY: selection.y };
  }
  return null;
}

cropCanvas.addEventListener("pointerdown", (event) => {
  if (!selection) return;
  const point = cropPoint(event);
  const handle = findResizeHandle(point);
  if (handle) {
    pointerAction = handle;
  } else if (
    point.x >= selection.x && point.x <= selection.x + selection.w &&
    point.y >= selection.y && point.y <= selection.y + selection.h
  ) {
    pointerAction = { type: "move", offsetX: point.x - selection.x, offsetY: point.y - selection.y };
  } else {
    pointerAction = { type: "new", startX: point.x, startY: point.y };
    selection = { x: point.x, y: point.y, w: 1, h: 1 };
  }
  cropCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

cropCanvas.addEventListener("pointermove", (event) => {
  if (!pointerAction) return;
  const point = cropPoint(event);
  if (pointerAction.type === "move") {
    selection.x = Math.min(cropCanvas.width - selection.w, Math.max(0, point.x - pointerAction.offsetX));
    selection.y = Math.min(cropCanvas.height - selection.h, Math.max(0, point.y - pointerAction.offsetY));
  } else if (pointerAction.type === "edge-x") {
    const nextX = Math.max(0, Math.min(cropCanvas.width, point.x));
    if (pointerAction.side === "left") {
      selection.x = Math.min(nextX, pointerAction.anchorX - 40);
      selection.w = pointerAction.anchorX - selection.x;
    } else {
      selection.x = pointerAction.anchorX;
      selection.w = Math.max(40, Math.min(cropCanvas.width - selection.x, nextX - selection.x));
    }
  } else if (pointerAction.type === "edge-y") {
    const nextY = Math.max(0, Math.min(cropCanvas.height, point.y));
    if (pointerAction.side === "top") {
      selection.y = Math.min(nextY, pointerAction.anchorY - 40);
      selection.h = pointerAction.anchorY - selection.y;
    } else {
      selection.y = pointerAction.anchorY;
      selection.h = Math.max(40, Math.min(cropCanvas.height - selection.y, nextY - selection.y));
    }
  } else if (pointerAction.type === "corner") {
    const horizontal = resizedRange(pointerAction.anchorX, point.x, cropCanvas.width);
    const vertical = resizedRange(pointerAction.anchorY, point.y, cropCanvas.height);
    selection = {
      x: horizontal.start,
      y: vertical.start,
      w: horizontal.size,
      h: vertical.size,
    };
  } else {
    const startX = pointerAction.startX;
    const startY = pointerAction.startY;
    const left = Math.max(0, Math.min(cropCanvas.width - 40, Math.min(startX, point.x)));
    const top = Math.max(0, Math.min(cropCanvas.height - 40, Math.min(startY, point.y)));
    selection = {
      x: left,
      y: top,
      w: Math.min(cropCanvas.width - left, Math.max(40, Math.abs(point.x - startX))),
      h: Math.min(cropCanvas.height - top, Math.max(40, Math.abs(point.y - startY))),
    };
  }
  drawCrop();
});

function endCropPointer() {
  pointerAction = null;
}
cropCanvas.addEventListener("pointerup", endCropPointer);
cropCanvas.addEventListener("pointercancel", endCropPointer);

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Potongan QRIS tidak dapat dibuat."));
    }, "image/webp", quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Gambar QRIS tidak dapat dibaca.")), { once: true });
    reader.addEventListener("error", () => reject(new Error("Gambar QRIS tidak dapat dibaca.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function encodeCanvas(canvas) {
  let scale = Math.min(1, 768 / Math.max(canvas.width, canvas.height));
  while (scale >= 0.25) {
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(canvas.width * scale));
    output.height = Math.max(1, Math.round(canvas.height * scale));
    const context = output.getContext("2d");
    if (!context) throw new Error("Gambar QRIS tidak dapat diproses.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);
    for (const quality of [0.9, 0.78, 0.66, 0.54]) {
      const blob = await canvasToBlob(output, quality);
      if (blob.size <= 100 * 1024) return await blobToDataUrl(blob);
    }
    scale *= 0.8;
  }
  throw new Error("Gambar QRIS terlalu besar untuk disimpan. Pilih gambar yang lebih sederhana.");
}

async function encodeSelection() {
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(selection.w));
  output.height = Math.max(1, Math.round(selection.h));
  const context = output.getContext("2d");
  if (!context) throw new Error("Area QRIS tidak dapat diproses.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(
    sourceCanvas,
    selection.x, selection.y, selection.w, selection.h,
    0, 0, output.width, output.height
  );
  return await encodeCanvas(output);
}

function getNormalizedSelection() {
  const x = Number((selection.x / sourceCanvas.width).toFixed(6));
  const y = Number((selection.y / sourceCanvas.height).toFixed(6));
  return {
    x,
    y,
    w: Number(Math.min(1 - x, selection.w / sourceCanvas.width).toFixed(6)),
    h: Number(Math.min(1 - y, selection.h / sourceCanvas.height).toFixed(6)),
  };
}

function showPreview(image) {
  $("qr-image-preview-wrap").hidden = !image;
  $("qr-image-preview-caption").textContent = pendingImage
    ? "Area gambar yang akan ditampilkan sebagai QRIS"
    : "Gambar QRIS saat ini";
  $("qr-image-preview").src = image || "";
}

function hideEditor() {
  qrEditor.hidden = true;
  qrForm.reset();
  $("qr-image-status").textContent = "";
  $("qr-crop-stage").hidden = true;
  $("qr-image-recrop").hidden = true;
  $("qr-image-preview-wrap").hidden = true;
  $("qr-image-preview").removeAttribute("src");
  sourceCanvas = null;
  selection = null;
  pendingImage = null;
  pendingSourceImage = null;
  pendingCropSelection = null;
  editingQr = null;
}

function openEditor(qr = null) {
  editingQr = qr;
  pendingImage = null;
  pendingSourceImage = null;
  pendingCropSelection = null;
  $("qr-editor-title").textContent = qr ? "Ubah QRIS" : "Tambah QRIS";
  $("qr-save").textContent = qr ? "Simpan perubahan" : "Simpan QRIS";
  $("qr-name").value = qr?.name || "";
  $("qr-image-file").value = "";
  $("qr-image-status").textContent = "";
  $("qr-crop-stage").hidden = true;
  $("qr-image-recrop").hidden = !qr;
  showPreview(qr?.image || "");
  qrEditor.hidden = false;
  qrEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  $("qr-name").focus();
}

function renderList() {
  qrList.replaceChildren();
  const count = document.createElement("p");
  count.className = "qr-manager-count";
  count.textContent = `${qrs.length} dari 10 QRIS tersimpan`;
  qrList.appendChild(count);
  if (!qrs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Belum ada QRIS. Tambahkan QRIS agar bisa dipilih saat transaksi.";
    qrList.appendChild(empty);
    return;
  }
  for (const qr of qrs) {
    const card = document.createElement("article");
    card.className = "qr-manager-card";
    const image = document.createElement("img");
    image.src = qr.image;
    image.alt = `QRIS ${qr.name}`;
    image.loading = "lazy";
    const details = document.createElement("div");
    details.className = "qr-manager-details";
    const title = document.createElement("h3");
    title.textContent = qr.name;
    const status = document.createElement("span");
    status.className = `admin-status-badge ${qr.enabled ? "active" : "inactive"}`;
    status.textContent = qr.enabled ? "Aktif di kasir" : "Nonaktif";
    details.append(title, status);
    const actions = document.createElement("div");
    actions.className = "qr-manager-card-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary-button";
    toggle.textContent = qr.enabled ? "Nonaktifkan" : "Aktifkan";
    toggle.addEventListener("click", () => updateEnabled(qr));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-button";
    edit.textContent = "Ubah";
    edit.addEventListener("click", () => openEditor(qr));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => removeQr(qr));
    actions.append(toggle, edit, remove);
    card.append(image, details, actions);
    qrList.appendChild(card);
  }
}

async function loadQrs() {
  try {
    const data = await requestApi("/api/payment-settings?includeSource=1");
    qrs = Array.isArray(data.paymentQrs) ? data.paymentQrs : [];
    renderList();
    return true;
  } catch (error) {
    qrList.replaceChildren();
    showNotice(error.message, "error");
    return false;
  }
}

async function updateEnabled(qr) {
  try {
    await requestApi("/api/payment-settings", {
      method: "PATCH",
      body: JSON.stringify({ id: qr.id, enabled: !qr.enabled }),
    });
    if (await loadQrs()) {
      showNotice(`${qr.name} berhasil ${qr.enabled ? "dinonaktifkan" : "diaktifkan"}.`, "success");
    }
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function removeQr(qr) {
  if (!window.confirm(`Hapus QRIS "${qr.name}"?`)) return;
  try {
    await requestApi(`/api/payment-settings?id=${encodeURIComponent(qr.id)}`, { method: "DELETE" });
    if (await loadQrs()) showNotice(`${qr.name} berhasil dihapus.`, "success");
  } catch (error) {
    showNotice(error.message, "error");
  }
}

$("qr-add").addEventListener("click", () => {
  if (qrs.length >= 10) {
    showNotice("Maksimal 10 QRIS per usaha. Hapus QRIS lain sebelum menambahkan yang baru.", "error");
    return;
  }
  openEditor();
});

$("qr-image-file").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  pendingImage = null;
  pendingSourceImage = null;
  pendingCropSelection = null;
  $("qr-image-recrop").hidden = true;
  $("qr-image-status").textContent = "Membuka gambar...";
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Pilih gambar berformat JPG, PNG, atau WebP.");
    }
    if (file.size > 12 * 1024 * 1024) throw new Error("Ukuran gambar asli maksimal 12 MB.");
    await setCropSource(file);
    $("qr-image-status").textContent = "Atur area yang akan ditampilkan sebagai QRIS. Gambar di luar area tetap tersimpan.";
  } catch (error) {
    event.currentTarget.value = "";
    $("qr-image-status").textContent = error.message;
  }
});

$("qr-crop-reset").addEventListener("click", resetCrop);
$("qr-crop-apply").addEventListener("click", async () => {
  $("qr-crop-apply").disabled = true;
  $("qr-image-status").textContent = "Menyimpan pilihan area QRIS...";
  try {
    const [image, sourceImage] = await Promise.all([
      encodeSelection(),
      encodeCanvas(sourceCanvas),
    ]);
    pendingImage = image;
    pendingSourceImage = sourceImage;
    pendingCropSelection = getNormalizedSelection();
    showPreview(pendingImage);
    $("qr-image-recrop").hidden = false;
    $("qr-crop-stage").hidden = true;
    $("qr-image-status").textContent = "Area terpilih siap disimpan. Gambar utuh tetap bisa dipilih lagi saat diedit.";
  } catch (error) {
    $("qr-image-status").textContent = error.message;
  } finally {
    $("qr-crop-apply").disabled = false;
  }
});

$("qr-image-recrop").addEventListener("click", async () => {
  const image = pendingSourceImage || editingQr?.sourceImage || editingQr?.image;
  if (!image) return;
  const cropSelection = pendingCropSelection || editingQr?.cropSelection || null;
  $("qr-image-status").textContent = "Membuka gambar utuh...";
  try {
    const response = await fetch(image);
    if (!response.ok) throw new Error("Gambar QRIS tidak dapat dibuka.");
    await setCropSource(await response.blob(), cropSelection);
    $("qr-image-status").textContent = "Atur ulang area yang digunakan. Gambar di luar area tetap tersimpan.";
  } catch (error) {
    $("qr-image-status").textContent = error.message;
  }
});

$("qr-cancel").addEventListener("click", hideEditor);
qrForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("qr-crop-stage").hidden) {
    $("qr-image-status").textContent = "Simpan pilihan area terlebih dahulu agar tampilan QRIS diperbarui.";
    return;
  }
  const name = $("qr-name").value.trim();
  const image = pendingImage || editingQr?.image || "";
  const sourceImage = pendingSourceImage || editingQr?.sourceImage || image;
  const cropSelection = pendingCropSelection || editingQr?.cropSelection || { x: 0, y: 0, w: 1, h: 1 };
  if (!name || name.length > 40) {
    $("qr-image-status").textContent = "Nama QRIS wajib diisi dan maksimal 40 karakter.";
    return;
  }
  if (!image) {
    $("qr-image-status").textContent = "Pilih gambar dan tentukan area QRIS terlebih dahulu.";
    return;
  }
  $("qr-save").disabled = true;
  const isEditing = Boolean(editingQr);
  try {
    await requestApi("/api/payment-settings", {
      method: editingQr ? "PUT" : "POST",
      body: JSON.stringify({
        ...(editingQr ? { id: editingQr.id } : {}),
        name,
        image,
        sourceImage,
        cropSelection,
        ...(!editingQr ? { enabled: true } : {}),
      }),
    });
    hideEditor();
    if (await loadQrs()) {
      showNotice(`${name} berhasil ${isEditing ? "diperbarui" : "ditambahkan"}.`, "success");
    }
  } catch (error) {
    $("qr-image-status").textContent = error.message;
  } finally {
    $("qr-save").disabled = false;
  }
});

loadQrs().then((loaded) => {
  if (!loaded) return;
  if (new URLSearchParams(location.search).get("add") === "1") {
    if (qrs.length >= 10) showNotice("Maksimal 10 QRIS per usaha sudah tersimpan.", "error");
    else openEditor();
  }
});
