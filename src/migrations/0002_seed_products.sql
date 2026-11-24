-- Data contoh awal; INSERT OR IGNORE mencegah duplikasi saat baris sudah tersedia.
INSERT OR IGNORE INTO products (id, code, barcode, name, category, price, stock, image) VALUES
  ('1', 'K01', '899100100001', 'Nasi kuning', 'Makanan', 8000, 30, 'assets/images/nasikuning.png'),
  ('2', 'K02', '899100100002', 'Air Mineral', 'Minuman', 5000, 50, 'assets/images/mineral.png'),
  ('13', 'K13', '899100100013', 'Bakwan', 'Makanan', 2000, 40, 'assets/images/bakwan.png'),
  ('3', 'K03', '899100100003', 'Nasi Goreng', 'Makanan', 12000, 25, 'assets/images/nasigoreng.png'),
  ('4', 'K04', '899100100004', 'Mi Instan', 'Makanan', 6500, 35, 'assets/images/popmiekari.png'),
  ('5', 'K05', '899100100005', 'Susu Kotak', 'Minuman', 6000, 30, 'assets/images/susukotak.png'),
  ('6', 'K06', '899100100006', 'Biskuit Gandum', 'Makanan', 4500, 20, 'assets/images/biskuit.png'),
  ('7', 'K07', '899100100007', 'Mie Instan', 'Makanan', 6500, 35, 'assets/images/popmierawit.png'),
  ('8', 'K08', '899100100008', 'Gorengan Tahu isi', 'Makanan', 2500, 40, 'assets/images/tahuisi.png'),
  ('9', 'K09', '899100100009', 'Gorengan Telur gulung', 'Makanan', 2500, 40, 'assets/images/telurgulung.png'),
  ('10', 'K10', '899100100010', 'Buku Tulis', 'Kebutuhan Harian', 2500, 30, 'assets/images/bukutulis.png'),
  ('11', 'K11', '899100100011', 'Pulpen', 'Kebutuhan Harian', 3000, 50, 'assets/images/pulpen.png'),
  ('12', 'K12', '899100100012', 'Protex/Pembalut Wanita', 'Kebutuhan Harian', 2500, 20, 'assets/images/pembalutwanita.png'),
  ('14', 'K14', '899100100014', 'Tisu basah Antiseptic', 'Kebutuhan Harian', 4500, 25, 'assets/images/tisubasah.png');
