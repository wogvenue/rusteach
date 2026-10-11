---
title: "Özet Kartı: Değişkenler ve Veri Tipleri"
---

# Değişkenler ve Veri Tipleri: Özet Kartı

## Değişken, sabit, gölgeleme

| Yazım | Anlamı | Not |
|-------|--------|-----|
| `let x = 5;` | değişmez değişken | Varsayılan! Tekrar atama → **E0384** |
| `let mut x = 5;` | değiştirilebilir değişken | `x = 6;`, `x += 1;` (`x++` yok) |
| `const MAKS: u32 = 100;` | derleme zamanı sabiti | Tip **zorunlu**, `SCREAMING_SNAKE_CASE`, `let` değeri kullanamaz → **E0435** |
| `static AD: &str = "...";` | tek adresli global değer | `static mut` yalnızca `unsafe` ile (**E0133**); 2024'te `&STATIC_MUT` bile hata, kaçın |
| `let x = x.len();` | gölgeleme (shadowing) | **Yeni** değişken; tip değişebilir. `{ }` bitince iç gölge biter |

- Değişken isimleri `snake_case`. Değer **dönüşüyorsa** gölgeleme, zaman içinde **güncelleniyorsa** `mut`.
- Değer verilmemiş değişkeni okumak → **E0381**. Kapsam dışındaki değişken → **E0425**.
- `_ad` hâlâ bir değişkendir (yalnızca "kullanılmıyor" uyarısını susturur); tek başına `_` hiçbir şeye bağlamaz.

## Sayı tipleri

| Tip | Aralık / özellik |
|-----|------------------|
| `i8` `i16` `i32` `i64` `i128` | işaretli; `-2ⁿ⁻¹ … 2ⁿ⁻¹-1`. **Varsayılan `i32`** |
| `u8` `u16` `u32` `u64` `u128` | işaretsiz; `0 … 2ⁿ-1` (`u8`: 0-255) |
| `isize` `usize` | adres boyutu; **uzunluk ve indeksler `usize`** |
| `f64` / `f32` | ondalık; **varsayılan `f64`** (~15-16 basamak), `f32` ~7 basamak |

Sabit yazımları: `1_000_000`, `0xff`, `0o755`, `0b1010`, `b'A'` (`u8`), `5u8`, `2.5_f32`, `6.022e23`.

**Taşma:** derleyici görürse derleme hatası; debug'da **panik**; release'te **başa sarar**.

| Metot | Taşmada | `250u8` + `10` |
|-------|---------|----------------|
| `checked_add` | `None` | `None` |
| `saturating_add` | sınırda durur | `255` |
| `wrapping_add` | başa sarar | `4` |
| `overflowing_add` | `(sonuç, taştı_mı)` | `(4, true)` |

- Tamsayı bölmesi sıfıra doğru keser: `-17 / 5 = -3`, `-17 % 5 = -2` (kalan bölünenin işaretinde).
  Hiç negatif olmayan kalan: `(-17_i32).rem_euclid(5)` → `3` (parantez şart!).
- Sıfıra bölme ve `i32::MIN / -1` **release'te de** panik yapar; `/` ve `%` kontrolleri hiç kapanmaz.
- `0.1 + 0.2 != 0.3` → ondalıkları `(a - b).abs() < 1e-9` ile karşılaştır. **Para = kuruş, tamsayı.**
- Tamsayı ile ondalık karışmaz (**E0277**). Belirsiz `{float}` üzerinde metot → **E0689** (tip yaz).

## bool ve char

- `bool`: `true` / `false`, 1 bayt. Karşılaştırma: `== != < > <= >=` (zincirlenemez: `a < b && b < c`).
- Mantık: `!` > `&&` > `||` önceliği; `&&` ve `||` **kısa devre** yapar. Sayılar `bool` yerine geçmez.
- `char`: tek tırnak `'ş'`, **4 bayt**, bir Unicode skaler değeri. `'🇹🇷'` iki değerdir → `char` olamaz.
- Metin içinde karakterler UTF-8'dir: `.len()` **bayt** sayar (`"şeker".len()` → `6`).

## as ile dönüşüm (çalışma zamanında asla hata vermez: sessizce keser!)

| Dönüşüm | Sonuç |
|---------|-------|
| `200_u8 as u32` | `200` (genişletme, kayıpsız) |
| `300_i32 as u8` | `44` (son 8 bit) · `-1_i32 as u8` → `255` |
| `7.9_f64 as i32` | `7` (keser) · `300.7 as u8` → `255` (sınırda durur) · NaN → `0` |
| `82.6_f64.round() as i32` | `83` (yuvarlamak için önce `round`) |
| `65_u8 as char` · `'ş' as u32` · `true as i32` | `'A'` · `351` · `1` |
| `'ş' as u8` | `95` (son 8 bit!), `as u8` yalnızca ASCII karakterlerde güvenli |

Yalnızca `u8 → char` (`i32 as char` → **E0604**). Ortalama: `toplam as f64 / adet as f64` (bölmeden **önce** çevir).

## Tuple ve dizi

```rust
fn main() {
    let ogrenci = ("Ayşe", 17, 92.5); // (&str, i32, f64)
    let (ad, _, ort) = ogrenci; // parçalara ayırma
    let notlar: [u32; 3] = [85, 92, 78]; // aynı tip, sabit uzunluk
    let sifirlar = [0; 5];
    println!("{ad} {ort} {} {} {sifirlar:?}", ogrenci.1, notlar[notlar.len() - 1]);
}
```

- Tuple: `.0 .1 ...`; yanlış alan → **E0609**. `()` birim tipi: "değer yok". Tek elemanlı: `(5,)`.
- Dizi: indeks **0'dan**, tipi **`usize`**; `[i32; 3]` ≠ `[i32; 4]`. Sınır dışı: derleme hatası ya da
  **panik** (`index out of bounds`), asla yanlış bellek.
- Sayı dizisini atamak onu **kopyalar**. Büyüyen liste gerekiyorsa `Vec` (`vec![...]`, `.push()`).

## Tip çıkarımı ve parse

- Rust **statik tiplidir**; çıkarım değere **ve sonraki kullanıma** bakar (`let n = 200; let k: u8 = n;` → `n: u8`).
- Tip zorunlu: `const`/`static`, fonksiyon imzaları, belirsiz yerler (**E0284/E0282** *type annotations needed*).
- `let yas: u32 = metin.trim().parse().unwrap();` ya da turbofish `metin.parse::<u32>()`. Sonraki bir
  atama (`let k: u32 = yas;`) ipucu olabilir, ama `yas * fiyat` gibi bir işlem olamaz → tipi hemen yaz.
- `parse` → `Result` (`Ok(42)` / `Err(ParseIntError { kind: InvalidDigit })`). Şimdilik
  `.unwrap()` veya daha iyisi `.expect("açıklama")`; doğrusu Modül 10'da.
- `"3,5"`, `" 42"`, `"1_000"` çevrilemez; `"300".parse::<u8>()` → `PosOverflow` (`as` gibi kesmez).

## Hata kodları

| Kod | Ne oldu? | Çözüm |
|-----|----------|-------|
| E0384 | `mut` olmayan değişkene atama (`+=` dâhil) | `let mut` |
| E0381 | değer verilmemiş değişkeni okuma | önce değer ver |
| E0425 | isim bu kapsamda yok (blok bitti) | değişkeni doğru kapsamda tanımla |
| E0435 | `const` içinde `let` değeri | sabit değer yaz |
| E0133 | `static mut`'a `unsafe` dışında erişim | `static mut`'tan kaçın (Modül 18, 24) |
| E0080 | `const` değeri hesaplanırken hata (ör. `const X: u8 = 200 + 100;`) | değeri ya da tipi düzelt |
| E0308 | tip uyuşmazlığı (*expected X, found Y*) | doğru tip / gölgeleme / `as` |
| E0277 | `{float} * {integer}`, diziyi `i32` ile indeksleme | aynı tipe çevir, indeks `usize` |
| E0689 | belirsiz sayı tipinde metot | `let x: f64 = ...` / `2.0_f64` |
| E0604 | `i32 as char` | yalnızca `u8 as char` |
| E0609 | olmayan tuple alanı | doğru indeks (`.0`'dan başlar) |
| E0284 | `parse` hedef tipi belli değil | anotasyon ya da turbofish |
| E0282 | tip çıkarılamıyor (ör. boş `Vec::new()`) | tipi yaz |

Kodsuz ama yine de **derleme hatası** olanlar: `literal out of range` (sabit tipine sığmıyor),
`this arithmetic operation will overflow` ve `this operation will panic at runtime` (derleyicinin
önceden gördüğü taşma, sıfıra bölme, sınır dışı indeks), `missing type for const item`.
