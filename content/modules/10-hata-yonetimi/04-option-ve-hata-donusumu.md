---
id: m10-l04
title: "Option'da ? ve Hata Dönüştürme"
minutes: 15
type: lesson
objectives:
  - "`Option` döndüren fonksiyonlarda `?` ile \"değer yoksa hemen dön\" kalıbını kısaltabilmek"
  - "`ok_or`/`ok_or_else` ile `Option`'ı `Result`'a, `ok()` ile `Result`'ı `Option`'a çevirebilmek"
  - "`map_err` ile bir hatayı fonksiyonun kendi hata tipine çevirip `?` ile yayabilmek"
keywords: ["?", Option, ok_or, ok_or_else, ok, err, map_err, split_once, hata dönüştürme]
---

Birinci dersin alıştırmasını hatırla: `bonuslu_puan`, `let ... else` ile "sıra geçersizse `None` döndür"
diyordu ve dersi bir sözle bitirmiştik: bu fonksiyonu tek satıra indireceğiz. Şimdi o sözü tutuyoruz.

Ardından daha büyük bir soruna geçeceğiz. Gerçek bir programda "yok"lar (`Option`) ve farklı tiplerde
hatalar (`ParseIntError`, `String`...) bir arada gelir. Hepsinin aynı dili konuşması gerekir. Bu derste
aralarında **köprü** kurmayı öğreneceksin.

## Option'da ?

`?` yalnızca `Result`'la değil, `Option`'la da çalışır. `Option` döndüren bir fonksiyonda `ifade?`:
**`Some(v)` ise değeri `v` olur; `None` ise fonksiyondan hemen `None` döner.**

```rust
fn bonuslu_puan(puanlar: &[u8], sira: usize, bonus: u8) -> Option<u8> {
    puanlar.get(sira)?.checked_add(bonus)
}

fn main() {
    let puanlar = [120, 250, 30];
    println!("{:?}", bonuslu_puan(&puanlar, 0, 15));
    println!("{:?}", bonuslu_puan(&puanlar, 1, 15));
    println!("{:?}", bonuslu_puan(&puanlar, 7, 15));
}
```

`puanlar.get(sira)` bir `Option<&u8>` döndürür. `?` onu açar: sıra geçersizse fonksiyon orada `None` ile
biter, geçerliyse `checked_add` çağrılır. Onun sonucu da zaten bir `Option<u8>`: fonksiyonun dönüş değeri.

Modül 2'deki `checked_*` metotlarıyla `?`'yi birleştirelim. Tahmin et:

```predict
code: |
  fn hesapla(a: u8, b: u8, c: u8) -> Option<u8> {
      let ara = a.checked_add(b)?;
      println!("ara toplam: {ara}");
      let sonuc = ara.checked_mul(c)?;
      println!("sonuç: {sonuc}");
      Some(sonuc)
  }

  fn main() {
      println!("{:?}", hesapla(10, 20, 3));
      println!("{:?}", hesapla(100, 50, 2));
  }
options:
  - |
    ara toplam: 30
    sonuç: 90
    Some(90)
    ara toplam: 150
    None
  - |
    ara toplam: 30
    sonuç: 90
    Some(90)
    ara toplam: 150
    sonuç: 44
    Some(44)
  - |
    ara toplam: 30
    sonuç: 90
    Some(90)
    None
  - |
    ara toplam: 30
    sonuç: 90
    Some(90)
    ara toplam: 150
    sonuç: 255
    Some(255)
answer: 0
explanation: |
  İkinci çağrıda `100 + 50 = 150` bir `u8`'e sığar, yani `ara toplam: 150` yazılır. Ama `150 × 2 = 300`
  sığmaz: `checked_mul` `None` döndürür ve `?` fonksiyondan **hemen** `None` ile çıkar; `sonuç:` satırı hiç
  çalışmaz. `44` (300 - 256) `wrapping_mul`'un, `255` ise `saturating_mul`'un sonucu olurdu. Bu örnekte
  `checked_*` taşmayı yakaladı, `?` da onu sessizce ama güvenle yukarı iletti.
```

Modül 9'daki `HashMap::get` de bir `Option` döndürür, yani o da `?` ile açılabilir:

```rust
use std::collections::HashMap;

fn sinif_ortalamasi(notlar: &HashMap<&str, Vec<u32>>, sinif: &str) -> Option<u32> {
    let liste = notlar.get(sinif)?; // sınıf yoksa → None
    let mut toplam = 0;
    for not in liste {
        toplam += not;
    }
    toplam.checked_div(liste.len() as u32) // liste boşsa (0'a bölme) → None
}

fn main() {
    let mut notlar = HashMap::new();
    notlar.insert("9-A", vec![80, 90, 75]);
    notlar.insert("9-B", vec![]);

    println!("{:?}", sinif_ortalamasi(&notlar, "9-A"));
    println!("{:?}", sinif_ortalamasi(&notlar, "9-B"));
    println!("{:?}", sinif_ortalamasi(&notlar, "10-C"));
}
```

İki farklı "yok" durumu var: sınıf hiç kayıtlı değil ya da sınıfta hiç not yok. İkisi de panik atmadan `None`
olarak çağırana iletiliyor.

## Option ile Result arasında köprü

Fonksiyon `Result` döndürüyorsa, içinde bir `Option`'a `?` uygulayabilir misin?

```compiles
code: |
  fn ilk_not(notlar: &[u32]) -> Result<u32, String> {
      let ilk = notlar.first()?;
      Ok(*ilk)
  }

  fn main() {
      println!("{:?}", ilk_not(&[70, 85]));
  }
answer: false
error: E0277
explanation: |
  Derlenmez. `notlar.first()` bir `Option`, fonksiyon ise `Result` döndürüyor. Liste boşsa `?`'nin bir `Err`
  döndürmesi gerekirdi, ama **hangi** hatayı? `None` hiçbir bilgi taşımaz, derleyici de bir hata mesajı
  uyduramaz. `?` bir `Option`'ı kendiliğinden `Result`'a çevirmez; köprüyü sen kurmalısın.
```

:::error Derleyici hatası
```text
error[E0277]: the `?` operator can only be used on `Result`s, not `Option`s, in a function that returns `Result`
 --> src/main.rs:2:29
  |
1 | fn ilk_not(notlar: &[u32]) -> Result<u32, String> {
  | ------------------------------------------------- this function returns a `Result`
2 |     let ilk = notlar.first()?;
  |                             ^ use `.ok_or(...)?` to provide an error compatible with `Result<u32, String>`
```
Derleyici çözümü de söylüyor: *use `.ok_or(...)?`*. `ok_or`, `None`'a bir hata değeri ekleyerek `Option`'ı
`Result`'a çevirir.
:::

`ok_or(hata)`: `Some(v)` → `Ok(v)`, `None` → `Err(hata)`. Kardeşi `ok_or_else(|| hata)` aynı işi yapar ama hata
değerini yalnızca **gerektiğinde** üretir. İkinci dersteki `unwrap_or` / `unwrap_or_else` farkının aynısı:
`ok_or(format!(...))` yazarsan metin, değer olsa bile her çağrıda oluşturulur. Hata mesajı `format!` ile
hesaplanıyorsa `ok_or_else` kullan.

```rust
fn ilk_not(notlar: &[u32]) -> Result<u32, String> {
    let ilk = notlar
        .first()
        .ok_or_else(|| String::from("not listesi boş"))?;
    Ok(*ilk)
}

fn main() {
    println!("{:?}", ilk_not(&[70, 85]));
    println!("{:?}", ilk_not(&[]));
}
```

`|| ...` parametresiz bir closure'dır: `ok_or_else`, `None` görürse onu çağırır ve dönen değeri hata olarak
kullanır.

:::analogy Sessiz "yok", gerekçeli "yok"
Kütüphanede bir kitabı sorduğunda görevli yalnızca omuz silkerse (`None`), ne yapacağını bilemezsin: kitap
kayıp mı, ödünçte mi, hiç alınmamış mı? "O kitap ödünçte, üç gün sonra gelir" derse (`Err("ödünçte")`) bir
sonraki adımını planlarsın. `ok_or` omuz silkmeyi gerekçeli bir cevaba çevirir. Aynı "yok", farklı yerlerde
farklı gerekçeler taşıyabilir.
:::

Bir pastanenin sipariş sisteminde iki ayrı başarısızlık var: ürün hiç yok (bir `Option`'dan gelir) ve stok
yetmiyor (bir iş kuralından gelir). İkisi de aynı dili konuşuyor, yani bir `String` mesaj:

```rust
use std::collections::HashMap;

fn siparis_ver(stok: &mut HashMap<String, u32>, urun: &str, adet: u32) -> Result<u32, String> {
    let mevcut = stok
        .get_mut(urun)
        .ok_or_else(|| format!("'{urun}' diye bir ürünümüz yok"))?;
    if *mevcut < adet {
        return Err(format!("'{urun}' için stok yetersiz: {mevcut} var, {adet} istendi"));
    }
    *mevcut -= adet;
    Ok(*mevcut) // kalan stok
}

fn main() {
    let mut stok = HashMap::new();
    stok.insert(String::from("simit"), 10);
    stok.insert(String::from("poğaça"), 2);

    println!("{:?}", siparis_ver(&mut stok, "simit", 3));
    println!("{:?}", siparis_ver(&mut stok, "poğaça", 5));
    println!("{:?}", siparis_ver(&mut stok, "börek", 1));
}
```

| Elinde | İstediğin | Metot |
|---|---|---|
| `Option<T>` | `Result<T, E>` | `ok_or(hata)` ya da `ok_or_else(closure)` |
| `Result<T, E>` | `Option<T>` | `ok()`: hatayı atar, `Ok(v)` → `Some(v)` |
| `Result<T, E>` | `Option<E>` | `err()`: yalnızca hatayla ilgileniyorsan |
| `Result<T, E>` | `Result<T, F>` | `map_err(closure)`: hatayı başka bir tipe çevirir (sonraki adım) |

```fill
prompt: |
  Boşlukları doldur: `kullanici_yasi` kayıtlı olmayan bir isimde **gerekçeli** bir hata döndürsün,
  `yas_oku` ise okunamayan bir yaşta hatanın ayrıntısını atıp yalnızca `None` versin.
code: |
  use std::collections::HashMap;

  fn kullanici_yasi(kayitlar: &HashMap<&str, u32>, isim: &str) -> Result<u32, String> {
      let yas = kayitlar.get(isim).___0(|| format!("{isim} kayıtlı değil"))?;
      Ok(*yas)
  }

  fn yas_oku(metin: &str) -> Option<u32> {
      metin.trim().parse::<u32>().___1()
  }

  fn main() {
      let mut kayitlar = HashMap::new();
      kayitlar.insert("Zeynep", 28);
      println!("{:?}", kullanici_yasi(&kayitlar, "Zeynep"));
      println!("{:?}", kullanici_yasi(&kayitlar, "Mert"));
      println!("{:?} {:?}", yas_oku(" 42 "), yas_oku("kırk"));
  }
blanks:
  - ["ok_or_else"]
  - ["ok"]
output: |
  Ok(28)
  Err("Mert kayıtlı değil")
  Some(42) None
explanation: |
  `get` bir `Option<&u32>` döndürür. `ok_or_else` onu, `None` durumunda closure'ın ürettiği mesajı taşıyan
  bir `Result<&u32, String>`'e çevirir, `?` da açar. Burada `ok_or` yazamazdın: `ok_or` bir closure değil,
  doğrudan hata **değerini** ister. `yas_oku`'da ise ters yön var: `ok()` bir `Result`'ı `Option`'a çevirir,
  `Err`'in içindeki `ParseIntError` atılır. Hatanın nedeni önemsizse bu kullanışlıdır.
```

## map_err: hatayı tercüme etmek

Şimdi daha sinsi bir durum. Fonksiyonumuz hatalarını `String` olarak bildiriyor, ama içeride `parse` bir
`ParseIntError` üretiyor:

```rust,compile_fail,E0277
fn yas_oku(metin: &str) -> Result<u8, String> {
    let yas = metin.trim().parse::<u8>()?;
    Ok(yas)
}

fn main() {
    println!("{:?}", yas_oku("17"));
}
```

:::error Derleyici hatası
```text
error[E0277]: `?` couldn't convert the error to `String`
 --> src/main.rs:2:41
  |
1 | fn yas_oku(metin: &str) -> Result<u8, String> {
  |                            ------------------ expected `String` because of this
2 |     let yas = metin.trim().parse::<u8>()?;
  |                            -------------^ the trait `From<ParseIntError>` is not implemented for `String`
  |                            |
  |                            this can't be annotated with `?` because it has type `Result<_, ParseIntError>`
  |
  = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
  = help: `String` implements trait `From<T>`:
            From<&String>
            From<&mut str>
            From<&str>
            From<Box<str>>
            From<Cow<'_, str>>
            From<char>
```
Önceki dersteki hatanın aynısı: `?`'nin içindeki `From::from`, `ParseIntError`'ı `String`'e çeviremiyor.
`help` kısmı, `String`'e hangi tiplerden otomatik dönüşüm olduğunu listeliyor. `From<&str>` satırını aklında
tut, alıştırmada işine yarayacak!
:::

Çözüm `map_err`: `Result`'ın yalnızca **`Err` tarafına** bir dönüşüm uygular. `Ok` olduğu gibi geçer:

```rust
fn yas_oku(metin: &str) -> Result<u8, String> {
    let yas = metin
        .trim()
        .parse::<u8>()
        .map_err(|hata| format!("'{metin}' bir yaş değil ({hata})"))?;
    Ok(yas)
}

fn main() {
    println!("{:?}", yas_oku("17"));
    println!("{:?}", yas_oku("on yedi"));
}
```

:::analogy Tercüman
Yurt dışındaki bir şube, merkeze Almanca bir arıza raporu gönderiyor. Merkez yalnızca Türkçe rapor kabul
ediyor. Rapor yola çıkmadan önce bir tercümana uğrar: içerik aynı kalır, ama artık merkezin dilindedir.
`map_err` bu tercümandır. `ParseIntError`'ı fonksiyonun hata diline (burada `String`) çevirir; `?` de
tercüme edilmiş raporu merkeze, yani çağırana iletir.
:::

`map_err` yalnızca hata **tipini** değil, hatanın **içeriğini** de zenginleştirmeye yarar. `ParseIntError`'ın
kendi mesajı (`invalid digit found in string`) hangi metnin okunamadığını söylemez; `format!` ile `'{metin}'`
eklediğimiz için yukarıdaki çıktıda sorunlu girdi de görünüyor. İyi bir hata mesajı **ne** olduğunu ve
**hangi değerle** olduğunu birlikte söyler: birinci dersteki iyi panik mesajı kuralının aynısı.

```quiz
question: |
  Fonksiyonun `Result<u8, String>` döndürüyor. İçeride `metin.parse::<u8>()` çağırıp hatayı `?` ile yaymak
  istiyorsun. `?`'den önce hangi metodu eklemelisin?
options:
  - "`ok_or`"
  - "`map_err`"
  - "`ok`"
  - "`unwrap_or_default`"
answer: 1
explanation: |
  Elinde bir `Result<u8, ParseIntError>` var, ihtiyacın `Result<u8, String>`. Yani yalnızca **hata tipini**
  değiştirmen gerekiyor: `.map_err(|hata| hata.to_string())?` ya da daha açıklayıcı bir `format!`.
feedback:
  - "`ok_or` bir `Option`'ı `Result`'a çevirir; elindeki zaten bir `Result`."
  - Doğru! Hatayı fonksiyonun hata tipine çevirir.
  - "`ok()` `Result`'ı `Option`'a çevirir. Hata bilgisi kaybolur ve fonksiyon `Result` döndürdüğü için `?` yine uyuşmaz."
  - "Bu, hatayı yaymak yerine yutar: hatalı girdi sessizce `0` olur."
```

```predict
code: |
  fn main() {
      let a: Result<i32, String> = "12".parse::<i32>().map_err(|e| format!("hata: {e}"));
      let b: Result<i32, String> = "on iki".parse::<i32>().map_err(|e| format!("hata: {e}"));
      let c: Option<i32> = "on iki".parse::<i32>().ok();
      println!("{a:?}");
      println!("{b:?}");
      println!("{c:?}");
  }
options:
  - |
    Ok(12)
    Err("hata: invalid digit found in string")
    None
  - |
    Ok("hata: 12")
    Err("hata: invalid digit found in string")
    None
  - |
    Ok(12)
    Err(ParseIntError { kind: InvalidDigit })
    None
  - |
    Ok(12)
    Err("hata: invalid digit found in string")
    Err(ParseIntError { kind: InvalidDigit })
answer: 0
explanation: |
  `map_err` yalnızca `Err` tarafına dokunur: `Ok(12)` olduğu gibi kalır, `Err` içindeki `ParseIntError` ise
  closure'ın ürettiği `String`'e dönüşür. `Debug` görünümünde `String`'ler tırnaklı yazılır. `ok()` ise
  `Result`'ı `Option`'a çevirir: `Err` → `None`.
```

:::deep Bir adım ötesi: `map` ve `and_then`
`map_err`'in bir de ikizi var: `map`, yalnızca **`Ok` tarafına** dokunur:
`"21".parse::<u32>().map(|yas| yas + 1)` → `Ok(22)`. `and_then` ise başarılı değerle, **yine başarısız
olabilecek** bir sonraki adımı çalıştırır: `"250".parse::<u8>().ok().and_then(|x| x.checked_add(10))` → `None`.
Bu "combinator" metotları `Option`'da da var. Closure'ları ve bu tarz zincirleri Modül 14'te derinlemesine
göreceğiz. Şimdilik `?` ile adım adım yazmak çoğu zaman daha okunaklıdır.
:::

````exercise
id: m10-e-nokta-oku
title: Koordinat okuyucu
difficulty: 3
prompt: |
  Bir harita uygulaması, kullanıcıdan `"3,-7"` biçiminde koordinat alıyor. `nokta_oku(metin)` fonksiyonunu
  yaz. Fonksiyon `Ok((x, y))` döndürsün ya da hatayı **tam olarak** şu mesajlarla bildirsin:

  | Durum | Hata mesajı |
  |---|---|
  | metinde virgül yok | `virgül eksik` |
  | `x` okunamıyor | `x okunamadı: ` + `ParseIntError` mesajı |
  | `y` okunamıyor | `y okunamadı: ` + `ParseIntError` mesajı |

  Örnek: `"a,5"` → `Err("x okunamadı: invalid digit found in string")`. Parçaların başındaki ve sonundaki
  boşlukları temizle. Metni **ilk** virgülden böl (`split_once`).

  `match` kullanmadan, bu dersteki köprülerle (`ok_or`/`ok_or_else`, `map_err`) ve `?` ile çöz.
starter: |
  fn nokta_oku(metin: &str) -> Result<(i32, i32), String> {
      todo!()
  }

  fn main() {
      println!("{:?}", nokta_oku("3,-7")); // Ok((3, -7))
      println!("{:?}", nokta_oku("3 7")); // Err("virgül eksik")
      println!("{:?}", nokta_oku("3,yedi")); // Err("y okunamadı: invalid digit found in string")
  }
solution: |
  fn nokta_oku(metin: &str) -> Result<(i32, i32), String> {
      let (x, y) = metin
          .split_once(',')
          .ok_or_else(|| String::from("virgül eksik"))?;
      let x = x
          .trim()
          .parse::<i32>()
          .map_err(|hata| format!("x okunamadı: {hata}"))?;
      let y = y
          .trim()
          .parse::<i32>()
          .map_err(|hata| format!("y okunamadı: {hata}"))?;
      Ok((x, y))
  }

  fn main() {
      println!("{:?}", nokta_oku("3,-7")); // Ok((3, -7))
      println!("{:?}", nokta_oku("3 7")); // Err("virgül eksik")
      println!("{:?}", nokta_oku("3,yedi")); // Err("y okunamadı: invalid digit found in string")
  }
check: tests
tests: |
  #[test]
  fn gecerli_koordinatlar() {
      assert_eq!(nokta_oku("3,-7"), Ok((3, -7)), "\"3,-7\" → (3, -7)");
      assert_eq!(nokta_oku(" 10 , 20 "), Ok((10, 20)), "parçalardaki boşluklar temizlenmeli");
      assert_eq!(nokta_oku("0,0"), Ok((0, 0)), "orijin noktası da geçerli");
  }

  #[test]
  fn virgul_yoksa_hata() {
      assert_eq!(nokta_oku("3 7"), Err(String::from("virgül eksik")), "virgülsüz metin");
      assert_eq!(nokta_oku(""), Err(String::from("virgül eksik")), "boş metinde de virgül yok");
  }

  #[test]
  fn x_okunamazsa_hata() {
      assert_eq!(nokta_oku("a,5"), Err(String::from("x okunamadı: invalid digit found in string")), "x = \"a\"");
      assert_eq!(nokta_oku(",5"), Err(String::from("x okunamadı: cannot parse integer from empty string")), "x boş");
  }

  #[test]
  fn y_okunamazsa_hata() {
      assert_eq!(nokta_oku("3,"), Err(String::from("y okunamadı: cannot parse integer from empty string")), "y boş");
      assert_eq!(
          nokta_oku("1,2,3"),
          Err(String::from("y okunamadı: invalid digit found in string")),
          "ilk virgülden bölünce y = \"2,3\" olur, bu da geçerli bir sayı değil"
      );
  }
hints:
  - "Önce `metin.split_once(',')` ile böl. Sonuç bir `Option<(&str, &str)>`; virgül yoksa `None`."
  - "`Option`'ı `.ok_or_else(|| String::from(\"virgül eksik\"))?` ile açabilirsin. Sayılar için `.trim().parse::<i32>()` sonucuna `.map_err(|hata| format!(\"x okunamadı: {hata}\"))?` ekle."
  - |
    İskelet şöyle:
    ```rust
    let (x, y) = metin.split_once(',').ok_or_else(|| String::from("virgül eksik"))?;
    let x = x.trim().parse::<i32>().map_err(|hata| format!("x okunamadı: {hata}"))?;
    // y için aynısı...
    Ok((x, y))
    ```
forbid:
  - pattern: "\\bmatch\\b"
    message: "Bu alıştırmada `match` yerine `ok_or`/`ok_or_else`, `map_err` ve `?` kullan."
  - pattern: "\\.unwrap\\(|\\.expect\\("
    message: "Panik yok: hataları `?` ile yay."
explanation: |
  Fonksiyon, üç farklı kaynaktan gelen sorunu tek bir hata diline çeviriyor: `split_once`'tan gelen `None`'ı
  `ok_or_else` ile, iki ayrı `ParseIntError`'ı da `map_err` ile. Her `?` bir çıkış kapısı: ilk sorunda
  fonksiyon, açıklayıcı bir mesajla biter.

  İlk adımı daha kısa da yazabilirdin: `.ok_or("virgül eksik")?`. Bu, `Result<_, &str>` üretir. Fonksiyonun hata
  tipi `String` olsa da derlenir, çünkü `?`'nin içindeki `From::from`, `&str`'yi `String`'e çevirmeyi bilir
  (hata mesajındaki `From<&str>` satırı). Metin sabit olduğu için burada `ok_or` kullanmak da sorun değil;
  `format!` gibi her seferinde hesaplanan mesajlarda `ok_or_else`'i tercih et.
````

## Özet

:::remember
- `Option` döndüren fonksiyonda `ifade?`: `Some(v)` → `v`, `None` → hemen `return None`.
- `?` `Option` ile `Result`'ı kendiliğinden birbirine **çevirmez** (E0277). Köprüleri sen kurarsın:
  - `Option` → `Result`: `ok_or(hata)`, hesaplanan hata için `ok_or_else(|| ...)`.
  - `Result` → `Option`: `ok()` (hata atılır).
  - Hata tipini değiştirmek: `map_err(|hata| ...)`, `Ok` tarafına dokunmaz.
- `?` hatayı `From::from` ile dönüştürür: `&str` → `String` gibi tanımlı dönüşümler kendiliğinden olur.
- Hedef: farklı kaynaklardan gelen "yok"ları ve hataları fonksiyonun **tek bir hata diline** çevirmek.
:::

```reflect
prompt: "`ok_or` ve `map_err` gibi dönüşümler olmasaydı, farklı tiplerde hatalar üreten (`Option`, `ParseIntError`, kendi kuralların...) bir fonksiyonu nasıl yazmak zorunda kalırdın? Hataları tek bir tipe çevirmek çağırana ne kazandırır?"
answer: |
  Model cevap: Her kaynağı ayrı ayrı `match` ile açıp elle `return Err(...)` yazmak gerekirdi; kod uzar,
  asıl mantık hata işleme satırlarının arasında kaybolurdu. Hataları tek bir tipe çevirmek, çağıranın tek bir
  `match` ile bütün olası sorunları ele alabilmesini sağlar: çağıran, içeride hangi metodun hangi hatayı
  ürettiğini bilmek zorunda kalmaz. Fonksiyonun imzası (`Result<T, String>` ya da ileride kendi hata enum'u)
  bir **sözleşme** olur: "benden şu türde hatalar gelebilir".
```

```flashcards
- front: "`Option<T>` döndüren bir fonksiyonda `deger?` ne yapar?"
  back: "`Some(v)` ise `v`'yi verir; `None` ise fonksiyondan hemen `None` ile döner."
- front: "`Result` döndüren bir fonksiyonda bir `Option`'a doğrudan `?` uygulanabilir mi?"
  back: "Hayır (E0277). Önce `ok_or(...)` ya da `ok_or_else(...)` ile `Result`'a çevir."
- front: "`ok_or` ile `ok_or_else` arasındaki fark nedir?"
  back: "`ok_or(hata)` hata değerini her durumda önceden oluşturur (eager); `ok_or_else(|| hata)` yalnızca `None` gelince üretir (lazy)."
- front: "`Result<T, E>`'yi `Option<T>`'ye nasıl çevirirsin?"
  back: "`.ok()`: `Ok(v)` → `Some(v)`, `Err(_)` → `None` (hata bilgisi atılır)."
- front: "`map_err` ne yapar?"
  back: "Yalnızca `Err` içindeki hatayı bir closure ile başka bir değere/tipe çevirir; `Ok` olduğu gibi geçer."
- front: "`\"x=5\".split_once('=')` neyi döndürür? Peki `\"x5\".split_once('=')`?"
  back: "`Some((\"x\", \"5\"))` ve `None`."
- front: "Hata tipi `String` olan bir fonksiyonda `.ok_or(\"boş\")?` neden derlenir?"
  back: "`?` hatayı `From::from` ile dönüştürür ve `String`, `From<&str>`'yi uygular."
```
