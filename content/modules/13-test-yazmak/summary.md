# Özet Kartı: Test Yazmak

## Test modülü kalıbı

```rust
pub fn kdv_ekle(fiyat: u32) -> u32 {
    fiyat + fiyat * 20 / 100
}

#[cfg(test)]              // sadece `cargo test`'te derlenir
mod tests {
    use super::*;         // ebeveyn modüldeki her şey (özel öğeler dahil)

    #[test]
    fn yuz_liranin_kdvli_hali() {
        assert_eq!(kdv_ekle(100), 120, "100 TL + %20 = 120 TL");
    }
}
```

- Test **panik yapmadan biterse geçer**, panik yaparsa kalır.
- Test adı = davranış cümlesi: `bos_sepetin_toplami_sifirdir`. Yapı: **Hazırla → Çalıştır → Doğrula**.
- Özel fonksiyonlar test edilebilir: `tests` bir **çocuk modüldür**.

## Doğrulama makroları

| makro | kontrol | not |
|---|---|---|
| `assert!(kosul, "mesaj {x}")` | `kosul == true` | `bool` sonuçlar için |
| `assert_eq!(a, b, "mesaj")` | `a == b` | Tip `PartialEq` + `Debug` olmalı; çıktıda `left` (1.) / `right` (2.) |
| `assert_ne!(a, b)` | `a != b` | Çıktı: ``assertion `left != right` failed`` |
| `assert!((a - b).abs() < 1e-9)` | ondalık eşitlik | `f64`'ü `assert_eq!` ile karşılaştırma |
| `debug_assert!` / `_eq!` / `_ne!` | aynısı | Sadece debug derlemede; testlerde düz `assert!` kullan |

- Testlerin **çalışma sırasına güvenme**: alfabetik başlar, paralel biter.

## Panik ve `Result` testleri

```rust,ignore
#[test]
#[should_panic(expected = "kapasite sıfır olamaz")] // alt dizge, büyük/küçük harf duyarlı
fn sifir_kapasite_panik_yapar() {
    Depo::yeni(0);
}

#[test]
fn cekim_bakiyeyi_azaltir() -> Result<(), HesapHatasi> { // Ok → geçer, Err → kalır
    let mut hesap = Hesap::yeni(100);
    hesap.cek(30)?;                       // hazırlık adımları için ?
    assert_eq!(                           // hata yolunu TAM değerle sına
        hesap.cek(500),
        Err(HesapHatasi::YetersizBakiye { bakiye: 70, istenen: 500 })
    );
    Ok(())
}

#[test]
#[ignore = "yavaş"]
fn milyon_kayit() { /* ... */ }
```

- `expected`'siz `#[should_panic]` yanlış sebepten (sıfıra bölme, taşma) de geçer.
- `#[should_panic]` + `-> Result` birlikte **olmaz**. `?` ile kalan testte satır numarası görünmez.
- Hata yolu gücü: `assert_eq!(r, Err(..))` > `matches!(r, Err(X { .. }))` > `r.is_err()`.
- Hata elle kurulamıyorsa (`ParseIntError`): `r.unwrap_err().kind()` ya da `.to_string()` ile karşılaştır.
- Ortam değişkeni, dosya gibi **süreç çapında ortak** kaynaklar paralel testleri bozar (2024'te `env::set_var` `unsafe`).

## `cargo test` komutları

| komut | ne yapar? |
|---|---|
| `cargo test kdv` | Adında `kdv` geçen testler |
| `cargo test tests::kdv -- --exact` | Birebir ad |
| `cargo test -- --ignored` / `--include-ignored` | Sadece / dahil `#[ignore]`'lular |
| `cargo test -- --no-capture` / `--show-output` | `println!` çıktısını anında / sonda göster (eski yazım: `--nocapture`) |
| `cargo test -- --test-threads=1` | Sırayla (testler varsayılan olarak **paralel thread**'lerde) |
| `cargo test --lib` / `--test dosya` / `--doc` | Birim / tek entegrasyon dosyası / doc testleri |

`--`'den **öncesi** Cargo'ya, **sonrası** test programına gider.

## Birim ve entegrasyon testleri

```text
kargo/
├── src/lib.rs            ← mantık + #[cfg(test)] birim testleri (özel öğeleri görür)
├── src/main.rs           ← ince: use kargo::...; (binary crate içe aktarılamaz!)
└── tests/
    ├── common/mod.rs     ← yardımcılar (test crate'i DEĞİL) → mod common;
    └── fiyat_testleri.rs ← ayrı crate, sadece pub API: use kargo::ucret;
```

- `tests/*.rs` → her dosya ayrı crate, `#[cfg(test)]` gerekmez. `tests/common.rs` boş bir test bölümü üretir.
- Kütüphanedeki `#[cfg(test)]` öğeleri entegrasyon testlerine **görünmez** (kütüphane onlar için normal derlenir).
- Sıra: birim → entegrasyon → doc testleri; bir bölüm kalırsa sonrakiler çalışmaz (`--no-fail-fast` hepsini koşturur).
- Paket adı `kargo-hesap` → `use kargo_hesap::...`. Sadece testte gereken crate'ler → `[dev-dependencies]`.

## Belgeler ve doc testleri

````rust,ignore
//! # not_defteri - crate açıklaması (lib.rs'in EN BAŞINDA)

/// Metni puana çevirir. Bağlantı: [`NotHatasi`].
///
/// # Errors
/// Sayı değilse `NotHatasi::SayiDegil` döner.
///
/// # Panics
/// (panik yapıyorsa burada yazılır)
///
/// # Examples
/// ```
/// use not_defteri::not_coz;          // doc test crate'in DIŞINDA çalışır
/// let puan = not_coz(" 85 ")?;
/// assert_eq!(puan, 85);
/// # Ok::<(), not_defteri::NotHatasi>(())   // gizli satır: ? için
/// ```
pub fn not_coz(metin: &str) -> Result<u32, NotHatasi> { /* ... */ }
````

- Etiketler: ```` ``` ```` (çalıştır) · `should_panic` · `no_run` (sadece derle) · `compile_fail` · `ignore` · `text`.
- Doc testler sadece **library crate**'lerde çalışır. Özel öğelerin örnekleri de çalıştırılır ama onları çağıramaz (E0603).
- `cargo doc --open` → `target/doc/` (docs.rs aynı rustdoc). `` [`ad`] `` belge içi bağlantıdır.

## TDD

1. 🔴 **Kırmızı**: tek davranış için kalan bir test (derleme hatası da kırmızı). Hemen geçen yeni teste şüpheyle bak.
2. 🟢 **Yeşil**: en basit kod (gerekirse sahte cevap; yeni testler genellemeye zorlar, üçgenleme).
3. 🔵 **Yeniden düzenle**: davranış aynı, testler yeşil.

```rust,ignore
#[test]
fn bilinen_degerler() {                       // tablo güdümlü test
    let vakalar = [(1, "I"), (4, "IV"), (9, "IX"), (1994, "MCMXCIV")];
    for (girdi, beklenen) in vakalar {
        assert_eq!(roma(girdi), beklenen, "roma({girdi})");
    }
}

#[test]
fn gidis_donus() {                            // binlerce vaka, tek döngü
    for n in 1..=3999 {
        assert_eq!(roma_coz(&roma(n)), Some(n));
    }
}
```

**Uç durum listesi:** boş · tek eleman · sıfır · sınır ve hemen altı/üstü · en büyük değer / taşma ·
geçersiz girdi · Türkçe karakter (`len()` bayt sayar!).

## Sık hatalar

| belirti | sebep | çözüm |
|---|---|---|
| `E0425 cannot find function` (testte) | `use super::*;` eksik | Test modülünün başına ekle |
| `` E0277 `X` doesn't implement `Debug` `` | `assert_eq!` yazdıramıyor | `#[derive(Debug, PartialEq)]` |
| `E0369 binary operation == cannot be applied` | `PartialEq` yok | `#[derive(PartialEq)]` |
| `E0277 the ? operator can only be used...` | Test `()` döndürüyor | `-> Result<(), E>` + `Ok(())` |
| `panic did not contain expected string` | Yanlış panik ya da yanlış `expected` | Gerçek `panic message` satırını oku |
| `test did not panic as expected` | Beklenen panik gelmedi | Fonksiyondaki kontrolü (`assert!`) incele |
| `` warning: function `x` is never used `` | Özel fonksiyonu sadece testler kullanıyor | Kodu bağla ya da sil |
| Bazen geçip bazen kalan test | Paralel testler ortak kaynak paylaşıyor | Bağımsız yap / `--test-threads=1` |
