# Özet Kartı: Hata Yönetimi

## İki tür hata

| | Kurtarılamaz | Kurtarılabilir |
|---|---|---|
| Ne zaman? | Bug: bozulan sözleşme ya da değişmez, "imkânsız" durum | Beklenen başarısızlık: kullanıcı girdisi, dosya, ağ |
| Araç | `panic!`, `assert!`, `unreachable!`, `todo!`, `unwrap`/`expect` | `Result<T, E>` (ve "yok" için `Option<T>`) |
| Sonuç | Mesaj + konum, unwinding (drop), çıkış kodu **101** | Hata bir **değer**dir; çağıran karar verir |

**Temel soru:** bu başarısızlık, kod doğru olsa bile yaşanabilir mi? Evet → `Result`. Hayır → `panic!`.

## panic!

- `panic!("{x} geçersiz")`: biçimlendirme kabul eder; mesaj **programcı** içindir.
- Varsayılan: **unwinding**, stack geri sarılır ve her çerçevedeki değerler `drop` edilir.
  `Cargo.toml` → `[profile.release]` `panic = "abort"`: anında sonlanma, temizlik yok.
- Backtrace: `RUST_BACKTRACE=1 cargo run`. Kendi crate adınla başlayan ilk satırı bul.
- Panik atan / atmayan kardeşler: `v[i]` / `v.get(i)`, `a + b` / `a.checked_add(b)`,
  `&s[0..1]` / `s.get(0..1)`, `a / b` / `a.checked_div(b)` (sıfıra bölme release'de de panikler).
- Panik mesajındaki konum, std içinde değil **senin** satırındır (`#[track_caller]`).

## Result'ı açmak

| Yöntem | `Err` olunca |
|---|---|
| `match r { Ok(v) => .., Err(e) => .. }` | Her iki durumu da sen yazarsın (`e.kind()` ile türüne göre ayır, `_` kolu şart) |
| `r.unwrap()` | Panik (hatanın `Debug` görünümüyle; bu yüzden `E: Debug` olmalı) |
| `r.expect("neden başarı bekliyorum")` | Panik, mesajın başında senin cümlen |
| `r.unwrap_or(v)` | `v` (her durumda hesaplanır, eager) |
| `r.unwrap_or_else(\|e\| ..)` | Closure çalışır (yalnızca gerekince, lazy) |
| `r.unwrap_or_default()` | Tipin varsayılanı (`0`, `""`, `false`) |
| `r.is_ok()` / `r.is_err()` | Yalnızca `bool` |

Kullanılmayan bir `Result` uyarı verir (`#[must_use]`); bilerek yok saymak için `let _ = ...;`.

## ? operatörü

```rust
use std::num::ParseIntError;

fn satir_tutari(adet: &str, fiyat: &str) -> Result<u32, ParseIntError> {
    let adet = adet.trim().parse::<u32>()?; // Err ise: return Err(From::from(e))
    let fiyat = fiyat.trim().parse::<u32>()?;
    Ok(adet * fiyat) // noktalı virgül yok!
}

fn main() {
    println!("{:?}", satir_tutari("3", "25"));
}
```

- `?` yalnızca `Result`/`Option` döndüren fonksiyonlarda → aksi halde **E0277**.
- Sonda `Ok(...)` yerine `Ok(...);` ya da çıplak değer → **E0308**.
- Döngüde `?`: ilk hatada döngü de fonksiyon da biter ("ya hep ya hiç").
- `fn main() -> Result<(), Box<dyn std::error::Error>>`: `main`'de `?` kullanılır, `Err` → `Error: {:?}` yazılır
  (`Debug`, yani kullanıcı için kaba) ve çıkış kodu **1** olur. `Box<dyn Error>` her standart hatayı taşır
  (önizleme; Modül 11, 17, 20). Kendi mesajın: `return Err(format!("...").into());`.

## Option ve Result arasında köprüler

| Elinde | İstediğin | Yaz |
|---|---|---|
| `Option<T>` (fonksiyon `Option` döndürüyor) | açılmış `T` | `x?` → `None` ise hemen `None` döner |
| `Option<T>` | `Result<T, E>` | `.ok_or(hata)` / `.ok_or_else(\|\| hata)` |
| `Result<T, E>` | `Option<T>` | `.ok()` (hata atılır) |
| `Result<T, E>` | `Result<T, F>` | `.map_err(\|e\| ...)` (yalnızca `Err` tarafı) |

`?` bir `Option`'ı kendiliğinden `Result`'a çevirmez (E0277): önce `ok_or`. `&str` hatası `String`'e `?` ile
kendiliğinden çevrilir (`From<&str>`).

## Kendi hata tipin

```rust
use std::num::ParseIntError;

#[derive(Debug, PartialEq)] // PartialEq: testlerde == / assert_eq! (Modül 11)
enum AtmHatasi {
    GecersizTutar(ParseIntError),                 // alttaki hatayı sar
    YetersizBakiye { bakiye: u64, istenen: u64 }, // karar için veri, cümle değil
}

fn cek(bakiye: u64, girdi: &str) -> Result<u64, AtmHatasi> {
    let tutar = girdi.trim().parse::<u64>().map_err(AtmHatasi::GecersizTutar)?;
    if tutar > bakiye {
        return Err(AtmHatasi::YetersizBakiye { bakiye, istenen: tutar });
    }
    Ok(bakiye - tutar)
}

fn main() {
    match cek(300, "500") {
        Ok(kalan) => println!("Kalan: {kalan} TL"),
        Err(AtmHatasi::YetersizBakiye { bakiye, istenen }) => println!("{} TL eksik", istenen - bakiye),
        Err(AtmHatasi::GecersizTutar(e)) => println!("Tutar okunamadı: {e}"),
    }
}
```

- Her başarısızlık bir **varyant**; çağıranın ihtiyaç duyduğu bilgi varyantın **verisi**.
- Mesajı gösterim anında üret (`fn mesaj(&self) -> String`; Modül 11'de `impl Display`).
- Yeni varyant → onu ele almayan her `match`'te **E0004**. Kendi enum'unda `_ =>` ile bu korumayı kapatma.
- `main() -> Result<(), KendiHatan>` için `Debug` yeter. `Box<dyn Error>`'a girmesi için `Error` trait'i gerekir (Modül 11).
- Hata durumunda durumu değiştirme: önce bütün kontroller, sonra değişiklik (atomiklik).

| Hata tipi | Ne zaman? |
|---|---|
| `String` | Hızlı denemeler; hata yalnızca insana gösterilecekse |
| `Box<dyn Error>` | `main`, küçük araçlar; farklı standart hatalar karışıyorsa |
| Kendi enum'un | Kütüphaneler ve iş mantığı; çağıran hataya göre davranacaksa |

## panic mi, Result mı? Karar listesi

1. Kod doğru olsa bile olabilir mi (girdi, dosya, ağ, ayar)? → `Result`.
2. Yalnızca bir bug yüzünden mi (sözleşme, değişmez, imkânsız kol)? → `panic!` / `assert!` / `unreachable!`.
3. Geçersiz değer hiç oluşmasın mı? → gizli alanlı tip + `new() -> Result<Tip, Hata>` ("doğrulamakla yetinme, ayrıştır").
4. Derleyiciden fazlasını mı biliyorsun? → önce `if let`/`match`/`let else` ile yeniden yapılandır, olmuyorsa gerekçeli `expect`.
5. Örnek, prototip, test? → `unwrap`/`expect` serbest (prototipte her biri bir yer imi).
6. Kütüphane? → girdiden kaynaklanan hiçbir durumda panikleme; sözleşmeye bağlı panikleri belgele.

## Sık hatalar

| Hata | Neden | Çözüm |
|---|---|---|
| `E0277` the `?` operator can only be used in a function that returns `Result` or `Option` | `?`, `()` döndüren fonksiyonda | Dönüş tipini `Result` yap |
| `E0277` `?` couldn't convert the error to `X` | Hata tipleri uyuşmuyor | `map_err`, `Box<dyn Error>` ya da kendi enum'un |
| `E0277` ... can only be used on `Result`s, not `Option`s | `Result` döndüren fonksiyonda `Option?` | `.ok_or(...)?` |
| `E0308` expected `Result<..>`, found `()` / `i64` | `Ok(x);` ya da `Ok` unutuldu | Son satır `Ok(x)` |
| `E0004` non-exhaustive patterns | Yeni varyant ele alınmamış | `match`'e kol ekle |
| `E0603` / `E0423` private tuple struct constructor | Gizli alanlı tip modül dışında kuruluyor | `Tip::new(...)` kullan |
| `thread 'main' panicked at ...` | `unwrap`, `v[i]`, `/ 0`, taşma | Güvenli kardeş (`get`, `checked_*`) ya da `Result` |
