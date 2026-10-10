# Özet Kartı: Yaşam Süreleri (Lifetimes)

## Temel fikir

- Her referansın bir **yaşam süresi (lifetime)** vardır: Oluşturulduğu yerden **son kullanımına** kadar
  geçerli kalması gereken bölge (NLL).
- `&'a T` şunu söyler: Gösterilen değer **en az `'a` boyunca** yaşamalı. Bu süre boyunca taşınamaz, üzerine
  yazılamaz, `&mut` ile ödünç alınamaz.
- Yaşam süreleri **tanımlayıcıdır, emredici değil**: Referanslar arasındaki ilişkiyi tarif ederler, hiçbir
  değerin ömrünü uzatmaz ya da kısaltmazlar. Çalışma zamanında yokturlar, maliyetleri sıfırdır.
- C/C++'ta sarkan işaretçi (dangling pointer) program çalışırken sorun çıkarır. Rust'ta derleme zamanında
  reddedilir.

## Fonksiyon imzaları

```rust
// Sonuç x'ten ya da y'den gelebilir → ikisi de 'a. Sonuç, KISA yaşayan kadar geçerli
fn en_uzun<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

// Sonuç yalnızca icerik'ten gelir → sorgu isimsiz kalır, çağıranı kısıtlamaz
fn ara<'a>(sorgu: &str, icerik: &'a str) -> Vec<&'a str> {
    let mut sonuc = Vec::new();
    for satir in icerik.lines() {
        if satir.contains(sorgu) {
            sonuc.push(satir);
        }
    }
    sonuc
}

fn main() {
    let metin = String::from("elma\narmut\nelmas");
    let bulunan;
    {
        let aranan = String::from("elma");
        bulunan = ara(&aranan, &metin); // aranan ölebilir, sonuç metne bağlı
    }
    println!("{bulunan:?} {}", en_uzun("Ada", "Bora"));
}
```

- Sözdizimi: `<'a>` ile **tanımla**, `&'a T` / `&'a mut T` ile **kullan**.
- Derleyici yalnızca **imzaya** bakar: Gövde imzaya uymalı (**E0621**), çağıran da imzanın şartına (**E0597**).
- Yalnızca sonucun gelebileceği parametrelere `'a` ver. Fazlası çağıranı gereksiz kısıtlar.
- Yerel bir değere referans döndürmeyi **hiçbir anotasyon** kurtaramaz (**E0515**). Sahipli değer döndür.

## Referans tutan struct'lar

```rust
struct Alinti<'a> {
    parca: &'a str,
}

impl<'a> Alinti<'a> {
    fn kendisi(&self) -> &str { self.parca }  // sonuç self'e bağlı (Kural 3)
    fn metin(&self) -> &'a str { self.parca } // sonuç orijinal metne bağlı (daha esnek)
}

fn main() {
    let roman = String::from("Bir varmış. Bir yokmuş.");
    let ilk;
    {
        let a = Alinti { parca: roman.split('.').next().unwrap_or("") };
        println!("{}", a.kendisi());
        ilk = a.metin(); // a ölse de ilk geçerli
    }
    println!("{ilk}");
}
```

- Struct tanımında elision **yoktur**: Referans alanı varsa `<'a>` şarttır (**E0106**).
- Hiçbir `Alinti<'a>`, baktığı veriden uzun yaşayamaz (**E0597**). Veri, struct yaşarken taşınamaz (**E0505**).
- Metotlar için `impl<'a> Alinti<'a>`: İlk `'a` tanımlar, ikincisi kullanır.
- Yaşam süresi **bulaşıcıdır**: Ödünç alan bir tipi içeren tip de `<'a>` taşır.
- Varsayılan tasarım **sahipli** alanlardır (`String`). Ödünç alan struct'lar kısa ömürlü, kopyasız
  görünümler (ayrıştırıcı, arama sonucu) içindir.

## Elision kuralları

| Kural | Ne yapar? | Örnek |
|---|---|---|
| 1 | Her isimsiz **girdi** referansı ayrı bir yaşam süresi alır (`&[&str]` iki tane sayılır) | `fn f(a: &str, b: &str)` → iki ayrı ad |
| 2 | **Tam olarak bir** girdi yaşam süresi varsa, bütün çıktılara o verilir | `fn ilk_kelime(s: &str) -> &str` |
| 3 | `&self` / `&mut self` varsa, çıktılara `self`'inki verilir | `fn ad(&self, k: &str) -> &str` |

- Kurallardan sonra çıktıda isimsiz yaşam süresi kalırsa **E0106**. Elision gövdeye bakmaz, mekaniktir.
  Yanlış girdiyi bağlarsa hata gövdede çıkar.
- `'_`: "Burada bir yaşam süresi var, adı önemli değil." Örnekler: `-> Alinti<'_>`,
  `impl Display for Alinti<'_>`.

## 'static ve yaşam süresi sınırları

| Yazım | Anlamı |
|---|---|
| `&'static str` | Veri program sonuna kadar orada (literaller, `static` öğeler). Her `&'a` beklenen yere sığar |
| `T: 'static` | `T` kısa ömürlü referans **içermez**. `String`, `i32`, `Vec<u8>`, `&'static str` sağlar. Değer yine de istediği an düşürülebilir |
| `T: 'a` | `T`'nin içindeki bütün referanslar en az `'a` kadar yaşar |
| `'b: 'a` | `'b`, `'a`'yı kapsar ("en az onun kadar yaşar") |

- `'static` bir **susturucu değildir**: Çalışma anında üretilen veriye `&'static` istemek E0515/E0597 ile
  biter. Çözüm sahipli değer.
- Yaşam süresi sınırları generic fonksiyonlar arasında kendiliğinden aktarılmaz: **E0310** (`T: 'static`),
  **E0309** (`T: 'a`). Sınırı üst imzaya taşı.

## Hepsi bir arada

```rust
// Sıra: önce yaşam süreleri, sonra tipler. 'a: dilimin kendisi, 'b: içindeki metinler
fn gecenler<'a, 'b, T: PartialOrd>(kayitlar: &'a [(&'b str, T)], esik: &T) -> Vec<&'b str> {
    let mut sonuc = Vec::new();
    for (ad, puan) in kayitlar {
        if puan >= esik {
            sonuc.push(*ad);
        }
    }
    sonuc
}

fn main() {
    let secilen;
    {
        let liste = vec![("Ece", 90), ("Can", 45), ("Ali", 70)];
        secilen = gecenler(&liste, &50); // liste ölür, metinler 'static: sorun yok
    }
    println!("{secilen:?}");
}
```

İmza okuma yöntemi: (1) parametreler ve sahipleri, (2) her çıktı referansı **hangi girdiye** bağlı,
(3) sınırlar (`T: PartialOrd`, `T: 'a`, `'b: 'a`). Tek `'a` ile başla. Bağımsız referanslara tek ad vermek
güvenli bir kullanımı reddediyorsa ayrı adlar (`'a`, `'b`) ver.

## Sık hatalar ve reçeteler

| Hata | Neden | Çözüm |
|---|---|---|
| `E0106` missing lifetime specifier | Çıktı referansının kaynağı belirsiz | `<'a>` ile sonucu doğru girdiye bağla |
| `E0597` does not live long enough | Değer, referansın son kullanımından önce ölüyor | Değeri daha uzun yaşat, kullanımı kısalt ya da sahipli sakla |
| `E0515` cannot return reference to local | Fonksiyonda üretilen veriye referans | `String` / `Vec<T>` döndür |
| `E0621` explicit lifetime required | Gövde, `'a` almayan bir parametreyi döndürüyor | O parametreye de `'a` ver |
| `E0505` move out while borrowed | Ödünç yaşarken değer taşınıyor | Taşımayı son kullanımdan sonraya al |
| `E0502` (metot çağrılarında) | Metot `self`'in **tamamını** ödünç alır | Alanlara doğrudan eriş ya da parçaları birlikte döndür |
| `E0502` (`&mut` alıp `&` döndüren fonksiyon) | Dönen `&`, `&mut` ödüncünü uzatır | Sonucu önce kullan, sonra yeniden ödünç al |
| `E0310` / `E0309` | Yaşam süresi sınırı aktarılmamış | Üst imzaya `T: 'static` / `T: 'a` ekle |
| `<'a>` her yere bulaşıyor | Uzun yaşayan bir tipte referans saklanıyor | Sahipli alanlar ya da indeks/bayt aralığı sakla |
