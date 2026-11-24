-- Salinan terenkripsi mendukung fitur tampilkan password; hash tetap untuk verifikasi.
ALTER TABLE users ADD COLUMN password_encrypted TEXT;
