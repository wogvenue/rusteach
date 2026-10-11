---
title: "Özet Kartı: Sahiplik"
---

# Sahiplik (Ownership): Özet Kartı

## Stack ve heap

| | Stack | Heap |
|---|---|---|
| Ne tutar? | Boyutu derleme zamanında bilinen değerler | Boyutu çalışma zamanında belli olan / büyüyen veriler |
| Düzen | LIFO çerçeveler (fonksiyon başına bir çerçeve) | Ayırıcının (allocator) bulduğu boş alanlar |
| Hız | Çok hızlı (işaretçiyi kaydırmak) | Daha yavaş (yer arama + işaretçi takibi) |
| Temizlik | Fonksiyon dönünce çerçeve kalkar | **Sahip** kapsamdan çıkınca drop |

- `String` = stack'te **ptr + len + cap** (24 bayt) + heap'te baytlar.
- String literali `"..."` → `&'static str`: baytlar programın içinde, salt okunur; büyütülemez.
- C (elle `free`): sızıntı, double free, use-after-free, sarkan işaretçi. GC: güvenli ama çalışma zamanı
  maliyeti ve belirsiz zamanlama. Rust: derleyicinin yerleştirdiği drop; toplayıcı yok, duraklama yok.
- Güvenli Rust double free ve use-after-free'yi derleme zamanında engeller; sızıntıyı ise tamamen
  imkânsız kılmaz (ama "`free`'yi unuttum" diye bir hata yoktur).

## Üç kural

> 1. Her değerin bir **sahibi** vardır.
> 2. Aynı anda yalnızca **bir** sahip olabilir.
> 3. Sahip **kapsamdan** çıkınca değer **drop** edilir.

- Drop noktası, sahibin bloğunu kapatan `}`'dir; aynı kapsamdakiler **ters sırayla** drop edilir.
- Gölgeleme drop **etmez** (eski değer kapsam sonuna kadar yaşar); `x = yeni;` eski değeri **hemen** drop eder.
- `let _x = Balon(..);` kapsam sonuna kadar yaşar. `let _ = Balon(..);` bağlamaz → geçici değer hemen
  drop. Dikkat: `let _ = x;` mevcut `x`'i **taşımaz ve drop etmez**.
- Erken bırakmak için `drop(x);`, gövdesi boş, sahipliği alan bir fonksiyon.
- **RAII**: bellek, dosya, kilit... kaynak, onu tutan değerle birlikte bırakılır.

## Taşıma, Copy, clone

| İşlem | `String`, `Vec` (Copy değil) | `i32`, `bool`, `char`, `f64`, `(i32, char)`, `[u8; 4]` (Copy) |
|---|---|---|
| `let b = a;` | **Taşıma**: başlık kopyalanır, `a` geçersiz | Bit kopyası: `a` ve `b` geçerli |
| `f(a)` | Parametreye taşınır | Kopya gider |
| `a.clone()` | Yeni heap alanı + bütün baytlar (pahalı) | Gereksiz (zaten kopyalanır) |

```rust
fn main() {
    let s1 = String::from("merhaba");
    let n = s1.len(); // önce oku...
    let mut s2 = s1; // ...sonra taşı (mut olmayan değer mut değişkene taşınabilir)
    s2.push('!');
    let kopya = s2.clone(); // bilinçli derin kopya: iki bağımsız değer
    println!("{n} {s2} {kopya}");
}
```

- Bir tuple/dizi ancak **bütün** elemanları `Copy` ise `Copy`'dir.
- Drop'ta kaynak geri veren tip `Copy` **olamaz** (bit kopyası = double free; `E0184` / `E0204`).
- `Copy` açıkça verilen bir etikettir: kendi tiplerin otomatik `Copy` olmaz (Modül 11: `#[derive(Clone, Copy)]`).
  Büyük `Copy` diziler (`[u8; 100_000]`) her atamada bütünüyle kopyalanır.
- Taşıma drop yerini de taşır; taşınmış değişken için drop yapılmaz.
- Taşınmış bir `mut` değişkene yeni değer atanabilir (`kutu = String::from("yeni");`).
- Derleyici temkinlidir: bir `if` dalında ya da döngünün önceki turunda "belki taşınmış" değer kullanılamaz.
  (Kapsam sonundaki drop'u ise gizli bir *drop bayrağı* doğru yönetir.)

## Fonksiyonlar: imza = sözleşme

| İmza | Anlamı |
|---|---|
| `fn f(s: String)` | Tüketir: alır, geri vermez (sonunda drop) |
| `fn f() -> String` | Üretir: sahipliği çağırana verir |
| `fn f(mut s: String) -> String` | Al, işle, geri ver → `let s = f(s);` |
| `fn f(s: String) -> (String, usize)` | Geri verir + sonuç → `let (s, n) = f(s);` |
| `fn f(n: i32) -> i32` | `Copy` tip: kopya gider, çağıranınki değişmez |

```rust
fn uzunluk_ve_kendisi(s: String) -> (String, usize) {
    let n = s.len(); // (s, s.len()) yazma: E0382!
    (s, n)
}

fn main() {
    let (s, n) = uzunluk_ve_kendisi(String::from("Rize"));
    println!("{s}: {n}");
}
```

Sadece okuyan fonksiyonlar için tuple zahmetli → **Modül 5: referanslar (`&`)**.

## Hatalar ve çözümleri

| Hata | Anlamı | Çözüm |
|---|---|---|
| `E0382` borrow/use of moved value | Taşınmış değer kullanıldı | Yeni sahibi kullan · taşımadan önce oku · dönen değeri yakala · gerekçeliyse `clone` · (Modül 5) ödünç ver |
| `E0382` …in previous iteration of loop | Döngü içinde taşıma | Taşımayı döngüden çıkar ya da her tur için bilinçli `clone` |
| `E0382` partially moved | Tuple'ın bir alanı taşındı | Bütünü kullanma ya da alanı `clone`'la |
| `E0508` cannot move out of array | Diziden indeksle taşıma | `clone` ya da (Modül 5) `&dizi[i]` |
| `E0599` no method `push_str` on `&str` | Literal büyütülemez | `String::from(...)` |
| `E0596` cannot borrow as mutable | `push_str` için `mut` yok | `let mut` |
| `E0308` expected `String`, found `()` | Son ifadede `;` var | Noktalı virgülü kaldır |

**`clone` kontrol listesi**: Gerçekten iki bağımsız değer mi lazım? → evet: `clone`. Sadece okuyacak
mıyım? → önce oku, sonra taşı. Eski değişkene sonra ihtiyacım var mı? → yoksa taşı.
