// Memeriksa foto dan mengecilkannya menjadi WebP sebelum dikirim ke API.
(function (global) {
  function blobKeDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Foto tidak dapat dibaca."));
      }, { once: true });
      reader.addEventListener("error", () => reject(new Error("Foto tidak dapat dibaca.")), { once: true });
      reader.readAsDataURL(blob);
    });
  }

  async function kompresKeWebp(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Pilih foto berformat JPG, PNG, atau WebP.");
    }
    if (file.size > 12 * 1024 * 1024) {
      throw new Error("Ukuran foto asli maksimal 12 MB.");
    }

    const bitmap = await createImageBitmap(file);
    try {
      const skalaAwal = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Foto tidak dapat diproses di browser ini.");

      // Coba beberapa ukuran dan kualitas supaya data URL muat dalam batas API/D1.
      for (const pengaliUkuran of [1, 0.8, 0.65]) {
        canvas.width = Math.max(1, Math.round(bitmap.width * skalaAwal * pengaliUkuran));
        canvas.height = Math.max(1, Math.round(bitmap.height * skalaAwal * pengaliUkuran));
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        for (const kualitas of [0.8, 0.68, 0.55]) {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", kualitas));
          if (!blob) throw new Error("Foto tidak dapat dikompres.");
          if (blob.size <= 100 * 1024) return await blobKeDataUrl(blob);
        }
      }
    } finally {
      bitmap.close();
    }
    throw new Error("Foto terlalu besar setelah dikompres. Coba pilih foto lain.");
  }

  global.KasirImageUtils = { kompresKeWebp };
})(window);
