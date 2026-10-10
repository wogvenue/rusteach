# Özet Kartı: Desenler Derinlemesine

## Desen nerede yazılır?

| Konum | Örnek | Desen türü |
|---|---|---|
| `let` | `let (ad, yas) = kisi;` | reddedilemez |
| `for` | `for (i, x) in v.iter().enumerate()` | reddedilemez |
| Fonksiyon parametresi | `fn f(&(x, y): &(i32, i32))` | reddedilemez |
| Closure parametresi | `.map(\|&(ad, _)\| ad)` | reddedilemez |
| `match` kolu | `Some(n) => ...` | reddedilebilir (kolların **toplamı** eksiksiz) |
| `if let` / `else if let` | `if let Some(x) = secim { ... }` | reddedilebilir |
| `while let` | `while let Some(ust) = yigin.pop() { ... }` | reddedilebilir |
| `let ... else` | `let Some(x) = secim else { return; };` | reddedilebilir; `else` **ıraksamalı** |

- **Reddedilemez (irrefutable)**: tipin her değerine uyar (`x`, `_`, `(a, b)`, `Nokta { x, y }`, dizide `[a, b, c]`).
- **Reddedilebilir (refutable)**: bazı değerlere uymayabilir (`Some(x)`, `Ok(x)`, `0`, `1..=9`, dilimde `[x]`).
- Reddedilebilir desen reddedilemez konumda → **E0005**. Tersi → `irrefutable_let_patterns` uyarısı.

## Desen sözdizimi tek örnekte

```rust
#[derive(Debug)]
enum Komut {
    Git { x: i32, y: i32 },
    Renk(u8, u8, u8),
    Yaz(String),
    Dur,
}

fn yorumla(k: &Komut) -> String {
    match k {
        Komut::Git { x: 0, y: 0 } => String::from("yerinde kal"), // değişmez alanlar
        Komut::Git { x, y: 0 } => format!("yatay {x}"), // sına + bağla
        Komut::Git { x: yatay, .. } if *yatay < 0 => String::from("geri"), // adlandır + guard
        Komut::Git { .. } => String::from("ileri"),
        Komut::Renk(0, 0, 0) | Komut::Renk(255, 255, 255) => String::from("siyah/beyaz"),
        Komut::Renk(k @ 200.., _, _) => format!("kırmızımsı ({k})"), // @ bağlama
        Komut::Renk(..) => String::from("renk"),
        Komut::Yaz(metin) => format!("yaz: {metin}"), // metin: &String
        Komut::Dur => String::from("dur"),
    }
}

fn main() {
    let komutlar = [
        Komut::Git { x: 4, y: 0 },
        Komut::Git { x: -2, y: 5 },
        Komut::Renk(230, 10, 10),
        Komut::Yaz(String::from("merhaba")),
        Komut::Dur,
    ];
    for k in &komutlar {
        println!("{k:?} → {}", yorumla(k));
    }
}
```

| Desen | Anlamı |
|---|---|
| `5`, `'x'`, `true`, `"evet"` | Değişmez: eşitlikle sınar (`String` için `.as_str()` ile eşleştir) |
| `isim` | Her şeye uyar, **yeni** değişken bağlar (dıştakini gölgeler: `unreachable pattern` tuzağı) |
| `A \| B` | Alternatifler, iç içe de olur (`Some(1 \| 2)`); hepsi **aynı isimleri** bağlamalı (**E0408**) |
| `1..=9`, `'a'..='z'`, `10..`, `..0`, `..=5` | Aralık (tamsayı ve `char`); `char` aralığı Unicode sırasıdır: `'ğ'` ∉ `'a'..='z'` |
| `Nokta { x, y }` / `Nokta { x: yatay, .. }` | Struct: kısaltma / yeniden adlandır + gerisini yok say (eksik alan: **E0027**) |
| `(a, _, c)` / `(ilk, .., son)` | Tuple; `..` desen başına bir kez |
| `_` | Her şeye uyar, **bağlamaz**: hiçbir şey taşınmaz, `let _ = guard;` geçiciyi hemen drop eder |
| `_isim` | **Gerçek** değişken: değer taşınır ve kapsam sonuna kadar yaşar; sadece uyarıyı susturur |
| `ref x` / `ref mut x` | Sahip olunan değeri taşımadan referans bağla |
| `&p` | Gelen referansı aç (`for &(a, b) in v.iter()`, içerik `Copy` ise) |
| `isim @ DESEN` | Sına ve bağla: `m @ 3..=5`, `m @ (1 \| 2)` (parantez şart), `[bas, kalan @ ..]` |
| `DESEN if KOSUL` | Match guard: desen uyduktan sonra koşul; `\|` alternatiflerinin **hepsine** uygulanır |

## Bağlama kipleri ve sahiplik

- Desendeki isim değeri sahiplik kurallarıyla alır: `Copy` kopyalanır, diğerleri **taşınır**. Bir alan
  taşınırsa **kısmi taşıma**: bütün değer artık kullanılamaz (**E0382**), taşınmayan alanlar kullanılabilir.
- **Varsayılan bağlama kipi (match ergonomics):** referans olmayan desen `&T` ile karşılaşırsa kip `ref`,
  `&mut T` ile karşılaşırsa `ref mut` olur ve isimler `&` / `&mut` bağlar.

```rust,ignore
for (ad, puan) in &notlar { }                 // ad: &String, puan: &u32
for (_, puan) in &mut notlar { *puan += 5; }  // puan: &mut u32
match &secim { Some(a) => {}, None => {} }     // a: &T

// 2024 sürümü: örtük ödünç alan desenin içinde ref / mut / & yazmak HATA
match &secim { Some(ref a) => {}, _ => {} }   // cannot explicitly borrow within an implicitly-borrowing pattern
match secim { Some(ref a) => {}, _ => {} }    // sahip olunan değerde ref serbest: taşımadan ödünç alır
```

## Guard'lar, eksiksizlik ve dilim desenleri

- Guard'lı kollar eksiksizliğe **sayılmaz**: en az bir koşulsuz kol gerekir (**E0004**, *match arms with
  guards don't count towards exhaustivity*). `@` ve aralık kolları **sayılır**.
- Kollar yukarıdan aşağı denenir, **ilk uyan** kazanır: özel durumlar üstte, genel durumlar altta.
- Desenle söylenebiliyorsa desen yaz (derleyici denetler). İki bağlamanın ilişkisi, metot çağrısı ya da
  dıştaki bir değişken gerekiyorsa guard.

| Dilim deseni | Uyduğu dilimler |
|---|---|
| `[]` | boş |
| `[x]` / `[a, b]` | tam 1 / tam 2 eleman |
| `[ilk, ..]` | en az 1 |
| `[ilk, .., son]` | en az 2 |
| `[bas, kalan @ ..]` | en az 1; `kalan` aynı veriye bakan bir alt dilimdir (`&[T]`), kopya yok |

```rust,ignore
fn toplam(s: &[i32]) -> i32 {
    match s {
        [] => 0,
        [bas, kalan @ ..] => bas + toplam(kalan), // büyük veride döngü/iterator tercih et
    }
}

match v.as_slice() { [a, b, ..] => {}, _ => {} } // Vec doğrudan eşleşmez: E0529
```

- `box` desenleri kararsız (**E0658**). `Box`'ın içine bakmak için: okurken `ic.as_ref()` ya da deref
  zorlaması, sahip olduğun kutuda `match *ic`.

## Sık hatalar

| Belirti | Sebep | Çözüm |
|---|---|---|
| **E0005** refutable pattern in local binding / function argument | `let`, `for` ya da parametrede reddedilebilir desen | `let ... else`, `if let` ya da `match` |
| **E0004** non-exhaustive patterns | Kapsanmayan durum ya da her kol guard'lı | Eksik kolu ekle; son kolu koşulsuz yap |
| **E0308** `else` clause of `let...else` does not diverge | `else` bloğu değer üretiyor | `return` / `break` / `continue` / `panic!` |
| **E0408** variable is not bound in all patterns | `\|` alternatifleri farklı isim bağlıyor, ör. `m @ 1 \| 2` | Aynı isimleri bağla; `m @ (1 \| 2)` |
| **E0027** pattern does not mention field | Struct deseninde alan eksik | Alanı yaz ya da `..` ekle |
| **E0382** borrow of partially moved value | Desen bir alanı taşıdı | `&deger` ile eşleştir, `ref` kullan ya da alanı `..` ile alma |
| **E0507** cannot move out of a shared reference | `&` deseni `Copy` olmayan değeri taşımaya çalışıyor | `&`'yi kaldır; varsayılan kip referans bağlasın |
| **E0508** cannot move out of a non-copy slice | `match v[..]` ile `String` bağlamak | `match v.as_slice()` ya da `&v[..]` |
| **E0529** expected an array or slice | `Vec` ile dilim deseni | `.as_slice()` |
| **E0658** box pattern syntax is experimental | `box x` deseni | `as_ref()` ya da `match *kutu` |
| `unreachable pattern` uyarısı | Üstteki kol her şeyi yakalıyor (çoğu zaman gölgeleme tuzağı) | `const` ya da guard: `x if x == hedef` |
