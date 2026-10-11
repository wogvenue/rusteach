## Fonksiyonlar

```rust
fn ortalama(a: f64, b: f64) -> f64 { // her parametrenin tipi zorunlu, dönüş tipi -> ile
    (a + b) / 2.0                     // noktalı virgülsüz son ifade = dönüş değeri
}

fn selamla(yas: u32) {                // dönüş tipi yoksa () döner
    println!("{yas} yaşındasın!");
}
# fn main() { selamla(20); println!("{}", ortalama(70.0, 90.0)); }
```

- İsimler `snake_case`. Tanım sırası önemsiz; `main`'den sonra tanımlanan fonksiyon da çağrılabilir.
- Her çağrı kendi **stack çerçevesini** alır; `i32`, `f64`, `bool`, `char` argümanları parametreye **kopyalanır**.
- `fn f(mut x: i32)` yalnızca fonksiyonun kendi kopyasını değiştirilebilir yapar.
- Birden çok değer döndürmek için tuple: `fn bol(a: u32, b: u32) -> (u32, u32) { (a / b, a % b) }`.

## İfadeler ve deyimler

| | Değer üretir mi? | Örnekler |
|---|---|---|
| **İfade (expression)** | Evet | `5`, `a + b`, `kare(3)`, `{ ... }`, `if ... else ...`, `loop { ... break x; }` |
| **Deyim (statement)** | Hayır | `let x = 5;`, `fn` tanımı, sonuna `;` konmuş her ifade |

```rust
# fn main() {
let fiyat = 200;
let kdv_dahil = {
    let kdv = fiyat / 5;
    fiyat + kdv        // ; YOK → bloğun değeri
};
# println!("{kdv_dahil}");
# }
```

- `return` **erken çıkış** içindir; fonksiyonun sonunda son ifadeyi kullan.

## Koşullar

```rust
fn harf_notu(puan: u32) -> char {
    if puan > 100 {
        return '?';              // koruma koşulu (guard clause)
    }
    if puan >= 85 { 'A' } else if puan >= 70 { 'B' } else if puan >= 50 { 'C' } else { 'F' }
}
# fn main() { println!("{}", harf_notu(77)); }
```

- Koşul **her zaman `bool`**: `if n != 0`, asla `if n`. Parantez yok, süslü parantez zorunlu.
- Zincirde **ilk doğru dal** çalışır → en dar koşul en üste.
- Değer olarak kullanılan `if`: bütün dallar **aynı tip** ve **`else` şart**.
- `&&` / `||` kısa devre yapar: `n != 0 && 100 / n > 2` sıfıra bölmez.
- `0 <= x <= 100` yazılamaz → `0 <= x && x <= 100`.

## Döngüler

| Döngü | Ne zaman? | Değer döndürür mü? |
|---|---|---|
| `for x in koleksiyon` | Her eleman için / belli sayıda tekrar, **ilk tercih** | Hayır |
| `while kosul` | Koşul doğru olduğu sürece (0 kez çalışabilir) | Hayır |
| `loop` | Bitiş anı gövdede belli oluyor, en az 1 tur | Evet: `break deger` |

| Aralık | Üretir | Eleman sayısı |
|---|---|---|
| `1..5` | 1, 2, 3, 4 | `b - a` = 4 |
| `1..=5` | 1, 2, 3, 4, 5 | 5 |
| `(1..=5).rev()` | 5, 4, 3, 2, 1 | 5 (parantez şart) |
| `5..1` | hiçbir şey (boş) | 0 |

```rust
# fn main() {
let mut sayac = 0;
let sonuc = loop {
    sayac += 1;
    if sayac == 4 { break sayac * 10; }   // loop'tan değer: 40
};

'dis: for kat in 1..=3 {
    for oda in 1..=4 {
        if oda == 2 { continue; }          // içteki döngünün sıradaki turu
        if kat * oda == 9 { break 'dis; }  // ikisini birden bitir
    }
}
# println!("{sonuc}");
# }
```

- Dizi indeksleri `0..dizi.len()`; `0..=dizi.len()` son turda **panik**. Mümkünse `for x in dizi` kullan.

## Tahmin oyunu kalıpları

```rust,ignore
use std::io;

let mut girdi = String::new();                       // her turda YENİ String (read_line sona ekler!)
io::stdin().read_line(&mut girdi).expect("Satır okunamadı");
let tahmin: u32 = girdi.trim().parse().expect("Sayı yaz!"); // önce trim (\n, \r\n), sonra parse
let gizli: u32 = rand::random_range(1..=100);        // Cargo.toml: [dependencies] rand = "0.10"
```

- Geçersiz girdide çökmemek: `let sonuc = girdi.trim().parse::<u32>(); if sonuc.is_err() { continue; }`, sonra `sonuc.unwrap()`.
- Mantığı **saf fonksiyonlara** ayır (`karsilastir(tahmin, gizli)`) → klavyesiz, rastgeleliksiz test edilir.
- Önizleme (Modül 7): `match tahmin.cmp(&gizli) { Ordering::Less => ..., Ordering::Greater => ..., Ordering::Equal => ... }`.

## Sık hatalar

| Hata | Anlamı | Çözüm |
|---|---|---|
| `E0308` *expected `i32`, found `()`* | Son ifadenin sonuna `;` konmuş | `;`'yi sil |
| `E0308` *expected `bool`, found integer* | `if sayi` | `if sayi != 0` |
| `E0308` *`if` and `else` have incompatible types* | Dallar farklı tipte | Bütün dallar aynı tipi üretsin |
| `E0308` *expected `String`, found `u32`* | Metin ile sayı karşılaştırılıyor | Önce `trim().parse()` |
| `E0317` *`if` may be missing an `else` clause* | Değer olarak kullanılan `if`'te `else` yok | `else { ... }` ekle |
| `E0061` | Yanlış sayıda argüman | İmzaya bak |
| `E0425` | Bilinmeyen isim (başka fonksiyonun yerel değişkeni) | Değeri parametreyle gönder |
| `E0571` | `while`/`for` içinde `break deger` | `loop` kullan |
| `E0689` | `1..4.rev()` | `(1..4).rev()` |
| `E0284` *type annotations needed* | `parse()` hedef tipi bilinmiyor | `let n: u32 = ...` ya da `parse::<u32>()` |
| Panik: *ParseIntError { kind: InvalidDigit }* | `"42\n".parse()` | Önce `.trim()` |
