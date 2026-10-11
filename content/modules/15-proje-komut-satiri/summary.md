---
title: "Özet Kartı: Komut Satırı Aracı (minigrep)"
---

# Proje: ara (minigrep): Özet Kartı

## Proje düzeni

| Dosya | Görevi |
|-------|--------|
| `src/main.rs` | **İnce katman**: argümanları ve ortamı oku, `Config::build`'i çağır, `run`'ı çağır, hatayı `eprintln!` ile yaz, `process::exit(1)` |
| `src/lib.rs` | **Mantık**: `Config`, `build`, `run`, `ara`, `ara_buyuk_kucuk_duyarsiz`, saf yardımcılar ve **testler** |
| `siir.txt` | Proje kökünde (göreli yollar çalışma klasörüne göre çözülür) |

```console
> cargo new ara
> cargo run -- rust siir.txt                        # -- sonrası programa gider
$ IGNORE_CASE=1 cargo run -- rust siir.txt          # bash
PS> $Env:IGNORE_CASE=1; cargo run -- rust siir.txt  # PowerShell
> cargo run -- rust siir.txt > cikti.txt            # yalnızca stdout dosyaya
> cargo test
```

## Yeni araçlar

| Araç | İmza / kullanım | Not |
|------|-----------------|-----|
| `std::env::args()` | `Iterator<Item = String>` | `args[0]` program yolu; geçersiz UTF-8'de panik (`args_os` alternatif) |
| `std::fs::read_to_string(yol)` | `io::Result<String>` | Tüm dosyayı belleğe okur |
| `std::process::exit(kod)` | `-> !` | `0` başarı; yıkıcıları (`drop`) **çalıştırmaz**; sadece `main`'de |
| `std::env::var("X")` | `Result<String, VarError>` | Tanımsızsa `Err(NotPresent)`; `.ok()` → `Option<String>`, `.as_deref()` → `Option<&str>` |
| `eprintln!` | `println!` gibi, stderr'e | Hatalar ve tanı mesajları |
| `Box<dyn Error>` | `Result<T, Box<dyn Error>>` | `?` her standart hatayı kutular; `"mesaj".into()` |

## Son hâli: src/lib.rs

```rust
use std::error::Error;
use std::fs;

pub struct Config {
    pub sorgu: String,
    pub dosya_yolu: String,
    pub buyuk_kucuk_duyarsiz: bool,
}

impl Config {
    pub fn build(
        mut args: impl Iterator<Item = String>,
        buyuk_kucuk_duyarsiz: bool,
    ) -> Result<Config, &'static str> {
        args.next(); // program yolu
        let Some(sorgu) = args.next() else {
            return Err("sorgu verilmedi");
        };
        let Some(dosya_yolu) = args.next() else {
            return Err("dosya yolu verilmedi");
        };
        Ok(Config { sorgu, dosya_yolu, buyuk_kucuk_duyarsiz })
    }
}

pub fn ortam_bayragi(deger: Option<&str>) -> bool {
    let Some(deger) = deger else {
        return false;
    };
    let deger = deger.trim().to_lowercase();
    !matches!(deger.as_str(), "" | "0" | "false" | "no" | "off" | "hayir" | "hayır")
}

pub fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let icerik = fs::read_to_string(config.dosya_yolu)?;
    let sonuclar = if config.buyuk_kucuk_duyarsiz {
        ara_buyuk_kucuk_duyarsiz(&config.sorgu, &icerik)
    } else {
        ara(&config.sorgu, &icerik)
    };
    for satir in sonuclar {
        println!("{satir}");
    }
    Ok(())
}

pub fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    icerik.lines().filter(|satir| satir.contains(sorgu)).collect()
}

pub fn ara_buyuk_kucuk_duyarsiz<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    let sorgu = sorgu.to_lowercase();
    icerik
        .lines()
        .filter(|satir| satir.to_lowercase().contains(&sorgu))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buyuk_kucuk_duyarli() {
        let icerik = "Rust öğrenmek\nrust gibi paslanmaz";
        assert_eq!(vec!["rust gibi paslanmaz"], ara("rust", icerik));
    }

    #[test]
    fn buyuk_kucuk_duyarsiz() {
        let icerik = "Rust öğrenmek\nrust gibi paslanmaz";
        assert_eq!(icerik.lines().collect::<Vec<_>>(), ara_buyuk_kucuk_duyarsiz("rUsT", icerik));
    }
}
```

## Son hâli: src/main.rs

```rust,ignore
use std::env;
use std::process;

use ara::{ortam_bayragi, Config};

fn main() {
    let buyuk_kucuk_duyarsiz = ortam_bayragi(env::var("IGNORE_CASE").ok().as_deref());

    let config = Config::build(env::args(), buyuk_kucuk_duyarsiz).unwrap_or_else(|hata| {
        eprintln!("Argümanlar ayrıştırılamadı: {hata}");
        process::exit(1);
    });

    if let Err(e) = ara::run(config) {
        eprintln!("Uygulama hatası: {e}");
        process::exit(1);
    }
}
```

## Tasarım kuralları

- **Dış dünyaya dokunan kod kenarda** (`main`): argümanlar, ortam, dosya, ekran. **Karar veren kod saf** (`lib.rs`): parametre al, değer döndür, test et.
- Başarısız olabilen kurucu → `build` (`new` başarısız olmaz). Hatalar `Result` ile yukarı; kütüphane asla `exit` etmez.
- Kullanıcı hatası → `Result` + anlaşılır mesaj; programcı hatası (bozulan varsayım) → `panic!`.
- **Veri stdout'a** (`println!`), **mesajlar stderr'e** (`eprintln!`). `>` stdout'u, `2>` stderr'i yönlendirir, `2>&1` birleştirir.
- Sonuç girdinin parçasıysa **ödünç** döndür (`Vec<&'a str>`); yeni üretiliyorsa **sahipli** (`Vec<String>`).
- Testlerde ortamı değiştirme (`env::set_var` edition 2024'te `unsafe`); değeri parametre olarak ver.
- `to_lowercase()` Türkçe kurallarını bilmez: `I` → `i`, `İ` → `i̇`.

## Sık hatalar ve çözümleri

| Hata | Nerede? | Çözüm |
|------|---------|-------|
| `E0507` cannot move out of index | `let s = args[1];` | `&args[1]` ya da `args[1].clone()` |
| `index out of bounds` paniği | Eksik argümanla `args[2]` | Önce `args.len()` kontrolü ya da `next()` + `let-else` |
| `E0308` mismatched types | `&'static str` hatası beklenirken `format!` | Hata tipini `String` yap ya da sabit metin kullan |
| `E0277` `?` couldn't convert the error | `Result<_, String>` içinde `io::Error` | `Box<dyn Error>` ya da `map_err` |
| `E0106` missing lifetime specifier | `fn ara(&str, &str) -> Vec<&str>` | `fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str>` |
| `E0621` explicit lifetime required | `'a` yanlış parametrede | `'a`'yı sonucun geldiği parametreye koy |
| `E0515` returns a value referencing local | `to_lowercase()` kopyasına dilim döndürmek | Kopyayla karşılaştır, **orijinal** satırı döndür |
| `E0596` cannot borrow as mutable | `args: impl Iterator` + `args.next()` | `mut args` |
| `E0616` private field | `lib.rs`'teki alan `pub` değil | Alanı `pub` yap |
| `E0133` call to unsafe function | `env::set_var` (edition 2024) | Ortamı değiştirme, parametre ver |

## Döngüden iterator'a

```rust
fn main() {
    let icerik = "elma\narmut\nelmas";
    let sonuc: Vec<&str> = icerik.lines().filter(|s| s.contains("elma")).collect();
    let numarali: Vec<(usize, &str)> = icerik
        .lines()
        .enumerate() // filter'dan ÖNCE: gerçek satır konumu
        .filter(|(_, s)| s.contains("elma"))
        .map(|(i, s)| (i + 1, s))
        .collect();
    println!("{sonuc:?} {numarali:?}");
}
```

Aynı hız (sıfır maliyetli soyutlama), daha az değiştirilebilir durum, daha açık niyet.

## clap (gerçek dünya)

`cargo add clap --features derive`, sonra argümanları bir struct olarak tarif et: alanlar konumsal argüman,
`#[arg(short, long)]` ile işaretli `bool` alanlar bayrak, `///` yorumlar yardım metni olur.
`Argumanlar::parse()` hatada mesajı stderr'e yazar ve `2` koduyla çıkar; `--help` ve `--version` bedava gelir.
