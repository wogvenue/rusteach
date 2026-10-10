# Özet Kartı: Enum'lar ve Desen Eşleştirme

## Enum tanımlamak

```rust
enum Mesaj {
    Cik,                     // verisiz varyant
    Yaz(String),             // tuple benzeri varyant
    Tasi { x: i32, y: i32 }, // struct benzeri varyant
}

impl Mesaj {
    fn yeni_yazi(metin: &str) -> Self {
        Self::Yaz(String::from(metin)) // ilişkili fonksiyon
    }
    fn onemli_mi(&self) -> bool {
        matches!(self, Self::Yaz(_) | Self::Tasi { .. }) // &self: sorgu
    }
    fn ozet(&self) -> String {
        match self {
            Self::Cik => String::from("çıkış"),
            Self::Yaz(metin) => format!("yazı: {metin}"), // metin: &String
            Self::Tasi { x, y } => format!("taşı: ({x}, {y})"),
        }
    }
}

fn main() {
    let liste = [Mesaj::Cik, Mesaj::yeni_yazi("selam"), Mesaj::Tasi { x: 1, y: -2 }];
    for m in &liste {
        println!("{} → önemli mi? {}", m.ozet(), m.onemli_mi());
    }
}
```

- **"ve" → struct, "veya" → enum.** Bir enum değeri her an varyantlarından **tam olarak birindedir**.
- Varyant adları `UpperCamelCase`; değer oluştururken yol yazılır: `Mesaj::Cik`. `impl` içinde `Self::Cik`.
- Bellekte: bir **etiket** (hangi varyant) + en büyük varyanta yetecek kadar yer.
- Enum'un alanı olmaz, varyantın olur: `m.metin` → **E0609**. Veriye **desenle** ulaşılır.

## Option&lt;T&gt;: null yerine

```rust,ignore
enum Option<T> { None, Some(T) } // standart kütüphanede hazır, önek gerekmez
```

| İhtiyaç | Yazım |
|---|---|
| Değer var / yok | `Some(5)`, `None` (tip belirsizse `let x: Option<u32> = None;`) |
| Güvenle açmak | `match`, `if let`, `let ... else` |
| Varsayılanla açmak | `x.unwrap_or(0)` |
| Sadece "var mı?" | `x.is_some()`, `x.is_none()` |
| Alanı boşaltıp içindekini almak | `self.alan.take()` (yerine `None` bırakır) |
| Kesin doluysa (yoksa panik) | `x.unwrap()`, `x.expect("neden")`; dikkatli kullan |

- `Option<u32>` bir `u32` **değildir**: `fiyat + indirim` → **E0277**. Önce kutuyu aç.
- "Sonucu olmayabilir" işlemler `Option` döndürür: `checked_add`, `checked_sub`, `checked_div`, `split_once`, `Vec::pop`.

## match

```rust,ignore
match deger {
    DESEN_1 => ifade,
    DESEN_2 | DESEN_3 => { /* blok */ }
    _ => ifade, // geri kalan her şey (en sona)
}
```

- Kollar **yukarıdan aşağıya** denenir, **ilk uyan** çalışır; düşme (fallthrough) yok.
- `match` bir **ifadedir**: bütün kollar aynı tipte değer üretmeli (yoksa **E0308**).
- **Eksiksizlik**: tipin bütün değerleri kapsanmalı (yoksa **E0004**). Yeni bir varyant, onu ele almayan her `match`'i hataya çevirir.
- Enum'larda `_` yerine varyantları açıkça yazmak, yeni varyantlarda derleyicinin uyarısını korur.

| Desen | Anlamı |
|---|---|
| `Some(n)`, `Mesaj::Yaz(metin)` | içindeki değeri bağla |
| `Some(0)`, `Islem::Bol(_, 0)` | sabit değeri sına |
| `90..=100`, `'a'..='z'`, `1..` | aralık (dahil / sonu açık) |
| `'a' \| 'e'` | veya |
| `diger` / `_` | her şeye uyar: bağlar / yok sayar |
| `Kargoda { .. }`, `Begeni(..)` | geri kalan alanları yok say |
| `(0, _)`, `(Durum::A, Olay::X)` | tuple ile birden çok değer |

- Desende tek başına bir ad **yeni değişkendir** (dıştakiyle karşılaştırılmaz!). Bir değerle karşılaştırmak için `const`.
- `match m` içindeki `String`'i taşır (kısmi taşıma, **E0382**). Sahipliği korumak için `match &m`; bağlananlar referans olur.
- `'a'..='z'` Türkçe harfleri (`ç ğ ı ö ş ü`) **kapsamaz**.

## Kısa yollar

```rust
fn main() {
    let kupon: Option<u32> = Some(15);
    if let Some(oran) = kupon {
        println!("%{oran} indirim"); // tek ilginç desen
    }

    let Some((ad, _)) = "ece@okul.tr".split_once('@') else {
        return; // else bloğu MUTLAKA akıştan çıkar
    };
    println!("kullanıcı: {ad}"); // ad burada da geçerli

    let mut yigin = vec![1, 2, 3];
    while let Some(n) = yigin.pop() {
        print!("{n} "); // desen uydukça döner (LIFO: 3 2 1)
    }
    println!("| rakam mı? {}", matches!('7', '0'..='9')); // bool
}
```

| İstediğin | Araç |
|---|---|
| Her durum için ayrı karar | `match` |
| Tek desen, gerisi için hiçbir şey ya da tek `else` | `if let` (+ `else`, `else if let`, `&& kosul` let zinciri) |
| Değeri çıkar, olmazsa hemen dön; değer devamında lazım | `let ... else` |
| Desen uydukça tekrarla | `while let` |
| Sadece evet/hayır | `matches!(deger, DESEN)` |

## Enum'larla modelleme

- **Geçersiz durumları temsil edilemez kıl**: birbirini dışlayan bool'lar yerine bir enum; duruma özgü veri o varyantta.
- Ortak veri struct'ta, değişen kısım bir enum alanında: `struct Siparis { no, musteri, durum: SiparisDurumu }`.
- Durum makinesi: sorgular `&self`, geçişler `self` alır ve yeni durumu döndürür: `isik = isik.sonraki();`
- Olaylı geçiş kalıbı:

```rust,ignore
fn isle(self, olay: Olay) -> Durum {
    match (self, olay) {
        (Durum::Kilitli, Olay::KartBas) => Durum::Acik,
        (Durum::Acik, Olay::Gec) => Durum::Kilitli,
        (durum, _) => durum, // geçersiz geçiş: durum aynen kalır
    }
}
```

## Sık hatalar

| Hata | Anlamı | Çözüm |
|---|---|---|
| **E0004** non-exhaustive patterns | `match` bir durumu kapsamıyor | eksik kolu ekle (gerekirse `_`) |
| **E0005** refutable pattern in local binding | `let Some(x) = opt;` | `let ... else` ya da `if let` |
| **E0308** `else` clause of `let...else` does not diverge | `else` bloğu normal bitiyor | `return` / `break` / `continue` / `panic!` |
| **E0308** match arms have incompatible types | kollar farklı tip üretiyor | kolları aynı tipe getir |
| **E0277** `Option<u32>` ile `u32` hesabı | kutu açılmadan işlem | `match` / `unwrap_or` |
| **E0369** `==` cannot be applied | enum `PartialEq` uygulamıyor | `matches!` ya da `#[derive(PartialEq)]` |
| **E0382** use of moved value | `match m` String'i taşıdı ya da `self` alan geçiş durumu tüketti | `match &m`; yeni durumu aynı değişkene ata |
| **E0425** cannot find value | `if let` değişkeni bloğun dışında kullanıldı | `let ... else` |
| **E0599** no variant named ... | varyant adında yazım hatası | derleyicinin önerdiği adı kullan |
| **E0609** no field on type | enum'un alanına nokta ile erişim | desenle eşleştir |
