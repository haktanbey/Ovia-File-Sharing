# Ovia — Dosya Paylaşım Platformu

## Kurulum

```bash
cd Ovia
npm install
node server.js
```

Tarayıcıda: **http://localhost:3700**

---

## Özellikler

### Kullanıcı Sistemi
- Kayıt / giriş / çıkış
- JWT tabanlı oturum yönetimi (cookie)
- Şifreler bcrypt ile hash'lenir

### Dosya Paylaşımı
- Drag & drop veya tıkla yükle
- Maksimum 50 MB dosya
- Açıklama ve etiket ekleme
- Herkese açık dosya galerisi
- Filtreler: Görsel / Video / Ses / Doküman
- Arama
- İndirme sayacı

### Hesap Özelleştirme
- Kullanıcı adı ve bio
- 15 emoji avatar seçeneği
- 10 profil rengi
- Kişisel dosya profili

### Log Sistemi (`data/accounts.log`)
```
[2025-04-25T10:30:00.000Z] REGISTER             | {"id":"...","username":"ali","email":"ali@mail.com"}
[2025-04-25T10:31:00.000Z] LOGIN                | {"id":"...","username":"ali"}
[2025-04-25T10:32:00.000Z] FILE_UPLOAD          | {"id":"...","file":"rapor.pdf","size":245120}
[2025-04-25T10:33:00.000Z] DOWNLOAD             | {"id":"...","file":"rapor.pdf"}
```

### API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/auth/register | Kayıt |
| POST | /api/auth/login | Giriş |
| POST | /api/auth/logout | Çıkış |
| GET | /api/auth/me | Mevcut kullanıcı |
| PATCH | /api/user/profile | Profil güncelle |
| POST | /api/files/upload | Dosya yükle |
| GET | /api/files | Tüm dosyalar (herkese açık) |
| GET | /api/files/mine | Kendi dosyaları |
| DELETE | /api/files/:id | Dosya sil |
| GET | /api/files/:id/download | İndir |
| GET | /api/admin/logs | Log kayıtları |

## Dosya Yapısı

```
Ovia/
├── server.js
├── package.json
├── public/
│   └── index.html
├── uploads/        ← yüklenen dosyalar
└── data/
    ├── users.json  ← kullanıcılar
    ├── files.json  ← dosya metadata
    └── accounts.log ← tüm aktivite logları
```
