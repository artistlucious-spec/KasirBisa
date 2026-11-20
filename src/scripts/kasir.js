// Logika domain kasir di browser: katalog, keranjang, harga, dan ringkasan transaksi.
// Worker menghitung ulang nilai checkout sebelum transaksi disimpan ke database.
(function (global) {
  const MENU = [
    { kode: "K01", id: 1, nama: "Nasi kuning", kategori: "Makanan", harga: 8000, stock: 30, barcode: "899100100001", gambar: "assets/images/nasikuning.png" },
    { kode: "K02", id: 2, nama: "Air Mineral", kategori: "Minuman", harga: 5000, stock: 50, barcode: "899100100002", gambar: "assets/images/mineral.png" },
    { kode: "K13", id: 13, nama: "Bakwan", kategori: "Makanan", harga: 2000, stock: 40, barcode: "899100100013", gambar: "assets/images/bakwan.png" },
    { kode: "K03", id: 3, nama: "Nasi Goreng", kategori: "Makanan", harga: 12000, stock: 25, barcode: "899100100003", gambar: "assets/images/nasigoreng.png" },
    { kode: "K04", id: 4, nama: "Mi Instan", kategori: "Makanan", harga: 6500, stock: 35, barcode: "899100100004", gambar: "assets/images/popmiekari.png" },
    { kode: "K05", id: 5, nama: "Susu Kotak", kategori: "Minuman", harga: 6000, stock: 30, barcode: "899100100005", gambar: "assets/images/susukotak.png" },
    { kode: "K06", id: 6, nama: "Biskuit Gandum", kategori: "Makanan", harga: 4500, stock: 20, barcode: "899100100006", gambar: "assets/images/biskuit.png" },
    { kode: "K07", id: 7, nama: "Mie Instan", kategori: "Makanan", harga: 6500, stock: 35, barcode: "899100100007", gambar: "assets/images/popmierawit.png" },
    { kode: "K08", id: 8, nama: "Gorengan Tahu isi", kategori: "Makanan", harga: 2500, stock: 40, barcode: "899100100008", gambar: "assets/images/tahuisi.png" },
    { kode: "K09", id: 9, nama: "Gorengan Telur gulung", kategori: "Makanan", harga: 2500, stock: 40, barcode: "899100100009", gambar: "assets/images/telurgulung.png" },
    { kode: "K10", id: 10, nama: "Buku Tulis", kategori: "Kebutuhan Harian", harga: 2500, stock: 30, barcode: "899100100010", gambar: "assets/images/bukutulis.png" },
    { kode: "K11", id: 11, nama: "Pulpen", kategori: "Kebutuhan Harian", harga: 3000, stock: 50, barcode: "899100100011", gambar: "assets/images/pulpen.png" },
    { kode: "K12", id: 12, nama: "Protex/Pembalut Wanita", kategori: "Kebutuhan Harian", harga: 2500, stock: 20, barcode: "899100100012", gambar: "assets/images/pembalutwanita.png" },
    { kode: "K14", id: 14, nama: "Tisu basah Antiseptic", kategori: "Kebutuhan Harian", harga: 4500, stock: 25, barcode: "899100100014", gambar: "assets/images/tisubasah.png" },
  ];

  function cariProduk(kode) {
    return MENU.find((produk) => produk.kode === kode || String(produk.id) === String(kode));
  }

  function cariProdukByBarcode(barcode) {
    return MENU.find((produk) => String(produk.barcode || "") === String(barcode).trim());
  }

  function daftarProduk() {
    return MENU;
  }

  function gantiProduk(produk) {
    if (!Array.isArray(produk)) throw new Error("Data katalog tidak valid");
    MENU.splice(0, MENU.length, ...produk);
  }

  function simpanProduk(produk) {
    if (produk.kode) {
      const indeks = MENU.findIndex((item) => item.kode === produk.kode);
      if (indeks < 0) throw new Error("Produk tidak ditemukan");
      MENU[indeks] = { ...MENU[indeks], ...produk };
    } else {
      const nomor = MENU.reduce((maks, item) => Math.max(maks, Number(item.id) || 0), 0) + 1;
      MENU.push({
        ...produk,
        id: nomor,
        kode: `K${String(nomor).padStart(2, "0")}`,
        gambar: produk.gambar || "",
      });
    }
    return MENU;
  }

  function hapusProduk(kode) {
    const indeks = MENU.findIndex((item) => item.kode === kode);
    if (indeks < 0) throw new Error("Produk tidak ditemukan");
    MENU.splice(indeks, 1);
    return MENU;
  }

  function saringProduk(produk, kataKunci = "", kategori = "") {
    const kata = String(kataKunci).trim().toLocaleLowerCase("id-ID");
    return produk.filter((item) => {
      const cocokKategori = !kategori || item.kategori === kategori;
      const cocokKata = !kata || item.nama.toLocaleLowerCase("id-ID").includes(kata);
      return cocokKategori && cocokKata;
    });
  }

  function validasiJumlah(qty) {
    const jumlah = typeof qty === "string" && qty.trim() === "" ? NaN : Number(qty);
    if (!Number.isSafeInteger(jumlah) || jumlah < 1 || jumlah > 99) {
      throw new Error("Jumlah harus bilangan bulat dari 1 sampai 99");
    }
    return jumlah;
  }

  function tambahItem(keranjang, kode, qty = 1) {
    const produk = cariProduk(kode);
    if (!produk) {
      throw new Error("Produk tidak ditemukan");
    }
    const jumlah = validasiJumlah(qty);
    const itemLama = keranjang.find((item) => item.kode === produk.kode);
    if (itemLama && itemLama.qty + jumlah > 99) {
      throw new Error("Jumlah produk di keranjang tidak boleh lebih dari 99");
    }
    if (itemLama) {
      itemLama.qty += jumlah;
    } else {
      keranjang.push({
        kode: produk.kode,
        id: produk.id,
        nama: produk.nama,
        kategori: produk.kategori,
        harga: produk.harga,
        gambar: produk.gambar,
        qty: jumlah,
      });
    }
    return keranjang;
  }

  function ubahJumlah(keranjang, kode, qty) {
    const jumlah = validasiJumlah(qty);
    const item = keranjang.find((produk) => produk.kode === kode);
    if (!item) {
      throw new Error("Produk tidak ditemukan di keranjang");
    }
    item.qty = jumlah;
    return keranjang;
  }

  function hapusItem(keranjang, kode) {
    return keranjang.filter((item) => item.kode !== kode);
  }

  function hitungSubtotal(keranjang) {
    return keranjang.reduce((subtotal, item) => subtotal + item.harga * item.qty, 0);
  }

  function hitungDiskon(subtotal, member) {
    // Aturan yang sama diterapkan kembali oleh worker sebelum transaksi disimpan.
    if (member) {
      return Math.floor((subtotal * 10 + 50) / 100);
    }
    if (subtotal >= 100000) {
      return Math.floor((subtotal * 5 + 50) / 100);
    }
    return 0;
  }

  function hitungPPN(dasarPajak) {
    // PPN 11% dihitung dari nilai setelah diskon.
    return Math.floor((dasarPajak * 11 + 50) / 100);
  }

  function hitungRingkasan(keranjang, member) {
    const subtotal = hitungSubtotal(keranjang);
    const diskon = hitungDiskon(subtotal, member);
    const ppn = hitungPPN(subtotal - diskon);
    return { subtotal, diskon, ppn, total: subtotal - diskon + ppn };
  }

  function hitungKembalian(total, dibayar) {
    if (!Number.isSafeInteger(dibayar) || dibayar < 0) {
      throw new Error("Masukkan jumlah uang yang valid");
    }
    if (dibayar < total) {
      throw new Error("Uang pembayaran kurang");
    }
    return dibayar - total;
  }

  function buatTransaksi(keranjang, dibayar, member = false, waktu = new Date().toISOString()) {
    if (keranjang.length === 0) {
      throw new Error("Keranjang masih kosong");
    }
    const ringkasan = hitungRingkasan(keranjang, member);
    const kembalian = hitungKembalian(ringkasan.total, dibayar);
    return {
      waktu,
      items: keranjang.map((item) => ({
        kode: item.kode,
        nama: item.nama,
        harga: item.harga,
        qty: item.qty,
      })),
      ...ringkasan,
      dibayar,
      kembalian,
      member,
    };
  }

  function hitungRingkasanPenjualan(transaksi) {
    return transaksi.reduce(
      (ringkasan, item) => {
        if (!item || !Number.isSafeInteger(item.total) || item.total < 0 || !Array.isArray(item.items)) {
          throw new Error("Data riwayat transaksi tidak valid");
        }
        ringkasan.jumlahTransaksi += 1;
        ringkasan.totalPenjualan += item.total;
        for (const produk of item.items) {
          if (!produk || typeof produk.nama !== "string" || !Number.isSafeInteger(produk.qty) || produk.qty < 1) {
            throw new Error("Data riwayat transaksi tidak valid");
          }
          ringkasan.totalProduk += produk.qty;
        }
        return ringkasan;
      },
      { jumlahTransaksi: 0, totalPenjualan: 0, totalProduk: 0 }
    );
  }

  function nominalPembayaranCepat(total) {
    if (!Number.isSafeInteger(total) || total <= 0) return [];
    const nominal = [total];
    for (const kelipatan of [5000, 10000, 20000, 50000]) {
      nominal.push(Math.ceil(total / kelipatan) * kelipatan);
    }
    return [...new Set(nominal)];
  }

  const api = {
    MENU,
    cariProduk,
    cariProdukByBarcode,
    daftarProduk,
    gantiProduk,
    simpanProduk,
    hapusProduk,
    saringProduk,
    tambahItem,
    ubahJumlah,
    hapusItem,
    hitungSubtotal,
    hitungDiskon,
    hitungPPN,
    hitungRingkasan,
    hitungKembalian,
    buatTransaksi,
    hitungRingkasanPenjualan,
    nominalPembayaranCepat,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.KasirLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
