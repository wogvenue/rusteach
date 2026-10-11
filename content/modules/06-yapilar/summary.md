---
title: "Özet Kartı: Yapılar (Structs)"
---

# Yapılar (Structs): Özet Kartı

## Üç struct biçimi

| Biçim | Tanım | Örnek oluşturma | Erişim | Ne zaman? |
|---|---|---|---|---|
| Adlandırılmış alanlı | `struct Kitap { kod: u32, baslik: String }` | `Kitap { kod: 1, baslik: s }` | `k.baslik` | Çoğu veri; alan adları anlam taşır |
| Tuple struct | `struct Renk(u8, u8, u8);` | `Renk(255, 165, 0)` | `r.0`, `let Renk(r, g, b) = x;` | Kısa, sırası belli veri |
| Newtype | `struct Metre(f64);` | `Metre(3.5)` | `m.0` | Aynı ham tipi taşıyan değerleri **karıştırmamak** |
| Birim struct | `struct Isaret;` | `Isaret` | - | Verisi olmayan işaret tipleri (0 bayt) |

## Örnek oluşturma kuralları

```rust
#[derive(Debug)]
struct Ogrenci {
    ad: String,
    numara: u32,
    aktif: bool,
}

fn main() {
    let ad = String::from("Ayşe");
    let mut o1 = Ogrenci { ad, numara: 1001, aktif: true }; // alan başlatma kısaltması: `ad`
    o1.numara = 1002; // değiştirmek için örneğin tamamı `mut`
    let o2 = Ogrenci { ad: String::from("Can"), ..o1 }; // `..taban` en sonda, kalan alanları alır
    println!("{o1:?}");
    println!("{} {}", o2.ad, o2.aktif);
}
```

- **Her alan** doldurulmalı → yoksa `E0063`. Rust'ta `null` alan yok.
- `mut` alanlara değil, **bağlamaya** aittir → yoksa `E0594`.
- `..o1`: `Copy` alanları kopyalar, `String` gibi alanları **taşır** → `o1` kısmen taşınabilir.
- Struct'lar kendiliğinden `Copy` olmaz: `let b = a;` **taşır**.
- Alanlarda şimdilik `&str` değil `String` → referans alan yaşam süresi ister (`E0106`, Modül 12).

## Yazdırma

| Yazım | Çıktı | Not |
|---|---|---|
| `{:?}` | `Ogrenci { ad: "Ayşe", numara: 1002, aktif: true }` | `#[derive(Debug)]` gerekir, yoksa `E0277` |
| `{:#?}` | Çok satırlı, girintili | Büyük ya da iç içe yapılar için |
| `dbg!(ifade)` | `[src/main.rs:5:9] ifade = değer` → **stderr** | Değeri **geri döndürür**; `dbg!(&x)` taşımaz |
| `{}` | Display | Türetilemez; kendin yazarsın (trait'ler, Modül 11) |

## Metotlar ve alıcılar

```rust
struct Hesap {
    sahip: String,
    bakiye: u64,
}

impl Hesap {
    // ilişkili fonksiyon (kurucu): self yok
    fn new(sahip: &str) -> Self {
        Self { sahip: String::from(sahip), bakiye: 0 }
    }

    // okur → &self (getter: get_ öneki yok)
    fn bakiye(&self) -> u64 {
        self.bakiye
    }

    // değiştirir → &mut self
    fn yatir(&mut self, miktar: u64) {
        self.bakiye += miktar;
    }

    // tüketir, alanı dışarı taşır → self
    fn kapat(self) -> String {
        self.sahip
    }
}

fn main() {
    let mut h = Hesap::new("Elif"); // :: → tip üzerinden
    h.yatir(500); // . → değer üzerinden (otomatik &mut h)
    println!("{}", h.bakiye());
    let ad = h.kapat(); // h artık kullanılamaz
    println!("{ad}");
}
```

| Alıcı | Anlamı | Çağıran için |
|---|---|---|
| `&self` | sadece okur | değer ödünç verilir |
| `&mut self` | değiştirir | değer `let mut` olmalı |
| `self` | sahiplenir / tüketir | çağrıdan sonra değer **taşınmış**tır |
| (yok) | ilişkili fonksiyon | `Tip::fonksiyon()` ile çağrılır |

- `Self` = `impl` bloğunun **tipi**; `self` = metodun çağrıldığı **değer**.
- Rust'ta dil düzeyinde kurucu ve aşırı yükleme (overloading) yok → `new` + **isimli kurucular** (`kare`, `dakikadan`).
- Bir tipin birden fazla `impl` bloğu olabilir; ama yalnızca **kendi crate'indeki** tiplere (`impl String` → `E0116`; çözüm: newtype).
- Getter `&self`'ten referans döndürüyorsa **bütün örneği** ödünç tutar: derleyici gövdeye değil **imzaya** bakar.

## Sık hatalar

| Hata | Ne oldu? | Çözüm |
|---|---|---|
| `E0063` | struct ifadesinde eksik alan | bütün alanları ver ya da `..taban` kullan |
| `E0594` | `mut` olmayan örneğe ya da `&self` arkasına yazma | `let mut`; metotta `&mut self` |
| `E0382` | taşınmış değeri kullanma (`..o1`, `self` alan metot, `ekle(kitap)`) | önce kullan, ödünç ver ya da bilinçli `clone` |
| `E0507` | `&self` arkasından alan taşıma | `self` al, `clone` et ya da referans döndür |
| `E0599` | ilişkili fonksiyonu `.` ile çağırma, olmayan metot | `Tip::fonksiyon()` |
| `E0423` | `Hesap.new()` | `Hesap::new()` |
| `E0277` | `{:?}` ama `Debug` yok | `#[derive(Debug)]` |
| `E0308` | newtype karışıklığı (`Metre` yerine `Fit`) | doğru tipi ver; dönüşüm fonksiyonu yaz |
| `E0499` / `E0502` | döngü `self.v`'yi ödünç tutarken `self.metot()` ya da `self.v.remove(i)` | alana doğrudan eriş, indeksle dolaş ya da işi döngü sonrasına bırak |

## Proje desenleri

- **Refactoring:** birlikte değişen veri → struct; elle yapılan işlem → metot; kural → kurucu.
- Koleksiyon tutan tip, elemanlarının **sahibidir**: `fn ekle(&mut self, k: Kitap)`.
- **Ara-güncelle:** `for k in self.v.iter_mut() { if k.kod == kod { ...; return true; } } false`
- **Ara-sil:** `for i in 0..self.v.len() { if ... { self.v.remove(i); return true; } } false`
- Metotlar ekrana yazmak yerine **değer döndürsün** (`listele() -> String`) → test edilebilir.
- **Tip durumu (typestate):** `fn kargola(self) -> Kargoda` gibi tüketen geçişler, geçersiz sırayı derleme hatasına çevirir.
