# Özet Kartı: Koleksiyonlar

## `Vec<T>`: büyüyebilen dizi

| İş | Kod | Not |
|---|---|---|
| Oluştur | `Vec::new()`, `vec![1, 2, 3]`, `vec![0; n]`, `Vec::with_capacity(n)` | `new` bellek ayırmaz; `with_capacity` yeri önceden ayırır |
| Ekle / çıkar (sondan) | `v.push(x)`, `v.pop()` → `Option<T>` | amortize O(1) |
| Ortaya ekle / sil | `v.insert(i, x)`, `v.remove(i)` | O(n), kaydırır |
| Erişim | `v[i]` (sınır dışıysa **panik**), `v.get(i)` → `Option<&T>` | kullanıcı girdisinde `get` |
| Dolaş | `for x in &v` (`&T`), `for x in &mut v` (`&mut T`, `*x` ile yaz), `for x in v` (tüketir) | |
| Boyut | `v.len()`, `v.capacity()`, `v.is_empty()` | `len <= capacity`; `clear`/`truncate` kapasiteyi küçültmez |

- `push` kapasite dolunca **yeniden tahsis** yapar ve bütün elemanlar yeni bir adrese taşınabilir. Bu yüzden bir elemana referans tutarken ya da `for x in &v` içinde `push` yapamazsın (**E0502**).
- `Copy` olmayan bir elemanı indeksle dışarı taşıyamazsın (**E0507**): `&v[i]`, `v[i].clone()` ya da `v.remove(i)` kullan.
- Farklı türde verileri bir arada tutmak için bir `enum` tanımla, sonra `Vec<Enum>` kullan.

## `String`: UTF-8 metin

| | `String` | `&str` |
|---|---|---|
| Sahiplik | sahip, heap'te, büyüyebilir | ödünç alınmış bir dilim |
| Parametre olarak | yalnızca fonksiyon metnin sahibi olacaksa (ör. struct'a saklayacaksa) | **tercih et**: `&String` de kabul edilir |

- `len()` **bayt** sayısıdır: `'ş'.len_utf8() == 2`, `"şeker".len() == 6`. Karakter sayısı için `s.chars().count()`.
- `s[0]` **derlenmez**. Bayt indeksi bir karakterin ortasına denk gelebilir. `&s[a..b]` derlenir, ama sınır bir karakterin ortasındaysa **panik** yapar.
- Dolaşma: `chars()` (`char`), `bytes()` (`u8`), `char_indices()` (konum ve `char`).
- Birleştirme: `push(c)`, `push_str("..")`, `s1 + &s2` (**`s1` taşınır**, `s2` ödünç alınır), `format!("{a}{b}")` (hiçbirini taşımaz).
- Araçlar: `trim`, `split_whitespace`, `contains`, `replace`, `to_uppercase` / `to_lowercase`.
- **Türkçe tuzağı**: `"i".to_uppercase()` sonucu `"I"` olur, `"İ"` değil. `"I".to_lowercase()` sonucu da `"i"` olur, `"ı"` değil.

## `HashMap<K, V>`: anahtar → değer

```rust
use std::collections::HashMap;

fn main() {
    let mut sayim: HashMap<&str, u32> = HashMap::new();
    for kelime in "bir iki bir üç bir".split_whitespace() {
        *sayim.entry(kelime).or_insert(0) += 1; // yoksa 0 ile başlat, sonra artır
    }
    if let Some(n) = sayim.get("bir") {
        // get → Option<&V>
        println!("bir: {n}");
    }
}
```

- `insert(k, v)` sahipliği **haritaya taşır** ve eski değeri `Option<V>` olarak döndürür.
- `entry(k).or_insert(v)` / `.or_default()` / `.and_modify(|v| ...)`: hepsi tek aramada çalışır. `or_insert(v)` argümanını her zaman hesaplar; pahalı başlangıç değeri için `.or_insert_with(|| ...)`. `get_mut(&k)` → `Option<&mut V>`.
- Dolaşım sırası **garanti değildir**. Sıralı çıktı gerekiyorsa anahtarları bir `Vec`'e alıp sırala ya da `BTreeMap` kullan.
- Varsayılan hash fonksiyonu SipHash'tir: biraz yavaştır ama HashDoS saldırılarına dayanıklıdır.
- Anahtar tipi `Hash + Eq` olmalıdır. Kendi struct'ların için şimdilik tuple kullan (`derive` Modül 11'de).

## Diğer koleksiyonlar (`std::collections`)

| Koleksiyon | Ne zaman? | Önemli işlemler |
|---|---|---|
| `HashSet<T>` | benzersizlik, "var mı?" | `insert` → `bool`, `contains`, `&a \| &b`, `&a & &b`, `&a - &b`, `&a ^ &b` |
| `BTreeMap<K, V>` / `BTreeSet<T>` | **sıralı** anahtarlar, aralık sorgusu | O(log n), `range(a..b)`, `first_key_value`, `pop_first` |
| `VecDeque<T>` | iki uçlu kuyruk | `push_front`, `push_back`, `pop_front`, `pop_back`: hepsi O(1) |
| `BinaryHeap<T>` | sürekli en büyüğü almak | `push`, `pop` (en büyük), `peek`; min-heap için `Reverse(x)` |

**Seçim sırası:** emin değilsen `Vec` kullan. Elemanları baştan da çıkarıyorsan `VecDeque`. Anahtarla arıyorsan `HashMap` (sıralı istiyorsan `BTreeMap`). Yalnızca üyelik soruyorsan `HashSet`. Hep "en öncelikli" olanı alıyorsan `BinaryHeap`.

## Sıralama, arama, filtreleme

| İş | Kod | Maliyet / not |
|---|---|---|
| Doğal sıra | `v.sort()` / `v.sort_unstable()` | O(n log n), yerinde, `()` döndürür, `let mut` gerekir |
| Kendi kuralın | `v.sort_by(\|a, b\| b.puan.cmp(&a.puan).then(a.ad.cmp(&b.ad)))` | azalan için `b` solda |
| Anahtara göre | `v.sort_by_key(\|x\| x.yas)`, `sort_by_key(\|x\| Reverse(x.yas))` | anahtar elemanı ödünç alamaz (`\|x\| &x.ad` olmaz) |
| Pahalı anahtar | `v.sort_by_cached_key(\|x\| x.ad.to_lowercase())` | anahtar eleman başına bir kez hesaplanır |
| Ters çevir | `v.reverse()` | sıralamaz |
| Var mı? | `v.contains(&x)` | O(n), sırasız veride de çalışır |
| İkili arama | `v.binary_search(&x)` → `Ok(i)` / `Err(ekleme_yeri)` | O(log n), **yalnızca sıralı** veride |
| Filtrele | `v.retain(\|x\| *x >= 50)` | yerinde, sırayı ve kapasiteyi korur |
| Tekrar sil | `v.dedup()` | yalnızca **ardışık** tekrarlar, önce `sort` |
| Uç değerler | `v.iter().max()` / `min()` → `Option<&T>` | boş listede `None`; `f64` için `max_by(\|a, b\| a.total_cmp(b))` |

- `sort*` ailesi **kararlıdır**: eşitler orijinal sırasını korur. `sort_unstable*` daha hızlıdır ve ek bellek ayırmaz.
- `cmp` → `Ordering::{Less, Equal, Greater}`. Yardımcıları: `.reverse()`, `.then(o)`, `.then_with(|| ..)`.
- `|a, b| ...` bir **closure**'dır (isimsiz fonksiyon). Parametreleri genellikle elemanlara **referanstır**, bu yüzden `*x` gerekebilir. Ayrıntısı Modül 14'te.

```rust
fn main() {
    let mut olcumler = vec![21.5, f64::NAN, 18.0, 25.25];
    // f64 Ord değildir (NaN): sort() ve iter().max() derlenmez (E0277)
    olcumler.retain(|t| !t.is_nan());
    olcumler.sort_by(|a, b| a.total_cmp(b));
    println!("{olcumler:?}");
}
```

## Sık hatalar

| Hata | Sebep | Çözüm |
|---|---|---|
| **E0502** | elemana `&` tutarken `push`, ya da `for x in &v` içinde `v.push` | önce referansın işini bitir, eklenecekleri ayrı bir vektörde topla |
| **E0507** | `let s = v[0];` (`String` gibi bir eleman) | `&v[0]`, `.clone()` ya da `remove` |
| **E0277** `the type str cannot be indexed by {integer}` | `s[0]` | `s.chars()`, `s.bytes()` ya da güvenli dilim |
| **E0277** `{float}: Ord` | `Vec<f64>` üzerinde `sort()` ya da `max()` | `sort_by(\|a, b\| a.total_cmp(b))` |
| **E0277** `Hash`/`Eq` | kendi struct'ın küme elemanı ya da harita anahtarı | tuple kullan ya da `derive` (Modül 11) |
| **E0308** `expected &_, found integer` | `retain(\|p\| p >= 50)` | `*p >= 50` |
| **E0596** | `let v` ile `v.sort()` / `v.push()` | `let mut v` |
| `lifetime may not live long enough` | `sort_by_key(\|k\| &k.ad)` | `sort_by(\|a, b\| a.ad.cmp(&b.ad))` |
