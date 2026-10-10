---
id: m02-l06
title: Tip Çıkarımı ve Tip Belirtme
minutes: 20
type: lesson
objectives:
  - Derleyicinin bir değişkenin tipini nasıl çıkardığını (sonraki kullanımlar dâhil) açıklayabilmek
  - Tip belirtmenin zorunlu olduğu durumları tanıyıp `E0284`/`E0282` hatalarını düzeltebilmek
  - "Metni `parse` ile sayıya çevirip tipi anotasyonla ya da turbofish (`::<>`) ile belirtebilmek"
  - "`E0308 mismatched types` mesajını okuyup statik tiplemenin dinamik tiplemeye göre farkını açıklayabilmek"
keywords: [tip çıkarımı, type inference, anotasyon, parse, turbofish, unwrap, expect, E0308, E0284, statik tipleme]
---

Bu modül boyunca çoğu değişkenin tipini **hiç yazmadın**: `let fiyat = 2.5;` dedin ve Rust onun `f64`
olduğunu bildi. Öte yandan bazı yerlerde tip yazmak zorunluydu: sabitlerde, `parse` kullanırken, bir
metot çağırmadan önce... Peki derleyici tipleri nasıl tahmin ediyor ve neden bazen tahmin edemiyor?

Bu son derste Rust'ın **tip çıkarımı (type inference)** sistemini, tip belirtmenin yollarını ve metni
sayıya çevirmeyi öğreneceksin. Kullanıcıdan gelen her veri metin olarak geldiği için bu, gerçek
programların ilk adımıdır.

## Derleyici tipleri nasıl bilir?

Rust **statik tipli (statically typed)** bir dildir: her değişkenin tipi **derleme zamanında** belli
olmalıdır. Ama bu, her tipi senin yazman gerektiği anlamına gelmez. Derleyici bir dedektif gibi
ipuçlarını toplar:

```rust
fn main() {
    let ad = "Zeynep"; // tırnak → &str
    let yas = 15; // ipucu yok → varsayılan i32
    let boy = 1.62; // nokta → varsayılan f64
    let ogrenci_mi = true; // bool
    let bas_harf = 'Z'; // tek tırnak → char
    let puanlar = [90, 85, 77]; // [i32; 3]
    println!("{ad} {yas} {boy} {ogrenci_mi} {bas_harf} {puanlar:?}");
}
```

Burada derleyici her tipi değerin **kendisinden** çıkardı. Ama ipuçları yalnızca o satırda değildir.
Rust, değişkenin **sonradan nasıl kullanıldığına** da bakar. Tahmin et, bu program derlenir mi?

````compiles
code: |
  fn main() {
      let sayi = 300;
      let kucuk: u8 = sayi;
      println!("{kucuk}");
  }
answer: false
explanation: |
  Derlenmez, ama hata ikinci satırda değil **birinci** satırda:

  ```text
  error: literal out of range for `u8`
   --> src/main.rs:2:16
    |
  2 |     let sayi = 300;
    |                ^^^
    |
    = note: the literal `300` does not fit into the type `u8` whose range is `0..=255`
  ```

  Derleyici `sayi`'nin bir `u8` değişkenine atandığını gördü ve **geriye dönerek** `sayi`'nin de `u8`
  olması gerektiğine karar verdi. `300` ise bir `u8`'e sığmaz. Yani çıkarım yalnızca yukarıdan aşağıya
  değil, **kullanımdan tanıma doğru** da çalışır. `let sayi = 200;` olsaydı program sorunsuz derlenirdi.
````

Tamsayı ve ondalık sabitler başta "kesin olmayan" tiptedir; hata mesajlarında bunları `{integer}` ve
`{float}` olarak görürsün (Ders 4'teki `E0277` mesajını hatırla). Derleyici bütün fonksiyonu inceler;
kesin bir ipucu bulursa onu kullanır, bulamazsa varsayılana döner: tamsayılar için `i32`, ondalıklar
için `f64`.

:::analogy Dedektif derleyici
Derleyiciyi, bir olay yerinde ipucu toplayan bir dedektif gibi düşün. "Bu kişi kim?" sorusunun cevabı
bazen ilk ipucunda ortadadır (tırnak işareti → metin). Bazen sonradan gelen bir ipucu her şeyi
değiştirir ("`u8` bir değişkene atanmış, demek ki bu da `u8`"). Hiç ipucu yoksa en olası şüpheliyi
seçer (`i32`). Ama ipuçları **çelişirse** ya da ortada **hiç ipucu yoksa** dosyayı kapatamaz ve senden
yardım ister: işte o zaman tipi yazman gerekir.
:::

````quiz
question: |
  Aşağıdaki programda `adet`'in tipi nedir?

  ```rust
  let adet = 3;
  let fiyat: u64 = 1299;
  let toplam = adet * fiyat;
  ```
options:
  - "`i32`, çünkü tamsayıların varsayılan tipi `i32`'dir"
  - "`u64`, çünkü `u64` bir değerle çarpılıyor"
  - Program derlenmez, çünkü `i32` ile `u64` çarpılamaz
  - "`usize`, çünkü bir adet sayısıdır"
answer: 1
explanation: |
  `adet` için tip yazılmadı, ama `adet * fiyat` işlemi kesin bir ipucu: Rust farklı tamsayı tiplerini
  karıştırmadığına göre `adet` de `u64` olmalı. Varsayılan `i32` yalnızca **başka hiçbir ipucu yoksa**
  devreye girer.
feedback:
  - Varsayılan tip yalnızca başka ipucu yoksa seçilir. Burada `fiyat`'la çarpılması bir ipucu.
  - Doğru! Çıkarım, sonraki kullanıma bakarak `adet`'i `u64` yaptı.
  - "`adet`'in tipi henüz kesinleşmemiş bir `{integer}` olduğu için çakışma olmaz; derleyici onu `u64` seçer."
  - Derleyici değişken isimlerinin anlamına bakmaz; yalnızca nasıl kullanıldıklarına bakar.
````

:::tip Tipi görmek
VS Code'da rust-analyzer kuruluysa (Modül 1), her değişkenin yanında çıkarılan tipi gri bir yazıyla
görürsün (*inlay hints*). Editörün yoksa küçük bir hile: `let () = degisken;` yaz. Derleyici
`expected ..., found ()` diye şikâyet ederken değişkenin tipini de söyler.
:::

## Statik ve dinamik tipleme

Python veya JavaScript **dinamik tiplidir (dynamically typed)**: bir değişkenin tipi program
**çalışırken** belli olur ve değişebilir. Bir hata, ancak o satır çalıştığında ortaya çıkar:

```text
# Python
yas = "27"           # kullanıcıdan gelen metin
print(yas + 1)       # TypeError: can only concatenate str (not "int") to str
```

Bu satır, örneğin ayda bir çalışan bir rapor kodunun içindeyse hata ancak bir ay sonra, belki de bir
müşterinin önünde ortaya çıkar. JavaScript'te durum daha da sinsi olabilir: `"27" + 1` hata vermez,
sessizce `"271"` metnini üretir.

Rust'ta aynı hata program **hiç çalışmadan** yakalanır. Tip uyuşmazlığının hata kodu **`E0308`**'dir
ve muhtemelen en sık göreceğin hatadır:

:::error E0308 nasıl okunur?
```text
error[E0308]: mismatched types
 --> src/main.rs:2:20
  |
2 |     let yas: u32 = "27";
  |              ---   ^^^^ expected `u32`, found `&str`
  |              |
  |              expected due to this
```
Mesaj iki şey söyler: **ne bekleniyordu** (`expected u32`) ve **ne bulundu** (`found &str`). Alt
satırdaki `expected due to this` ise beklentinin **nereden** geldiğini gösterir: senin yazdığın `u32`
anotasyonu. E0308 gördüğünde hep şunu sor: "Beklenti doğru mu, yoksa değer mi yanlış?"
:::

Statik tipleme ilk başta yavaşlatıyor gibi gelebilir. Ama derleyici, test yazmadan ve programı
çalıştırmadan, bütün bir hata sınıfını senin yerine bulur. Rust'ın tip çıkarımı da bu güvenliği
Python'a yakın bir yazım rahatlığıyla sunar.

```quiz
question: Statik tipli bir dilin (Rust gibi) dinamik tipli bir dile (Python gibi) göre en temel avantajı nedir?
options:
  - Programlar daha kısa yazılır
  - Tip hataları program çalışmadan, derleme zamanında yakalanır
  - Değişkenlerin tipi program çalışırken değiştirilebilir
  - Hiç hata mesajı görmezsin
answer: 1
explanation: |
  Statik tiplemede her değişkenin tipi derleme zamanında bellidir; bu yüzden `"27" + 1` gibi hatalar
  daha program çalışmadan yakalanır. Bonus olarak derleyici her değerin boyutunu önceden bildiği için
  çok hızlı makine kodu üretebilir.
feedback:
  - Tip çıkarımı sayesinde Rust kodu kısa olabilir, ama bu statik tiplemenin kendisinin avantajı değil.
  - Doğru!
  - Bu dinamik tiplemenin özelliğidir. Rust'ta bir değişkenin tipi değişmez (gölgeleme yeni bir değişken oluşturur).
  - Tam tersi! Hata mesajlarını daha **erken** görürsün; ve bu iyi bir şey.
```

## Tip belirtmek ne zaman zorunlu?

Tipi yazmak (**tip anotasyonu, type annotation**) üç durumda zorunludur ya da gereklidir:

1. **Sabitlerde ve static'lerde:** `const MAKS_PUAN: u32 = 100;` (Ders 2). Derleyici burada çıkarım
   yapmaz; sabitler programın her yerinden görüldüğü için tipleri belge gibi açıkça yazılmalıdır.
2. **Fonksiyon imzalarında:** parametreler ve dönüş tipi her zaman yazılır:
   `fn ortalama(vize: u8, final_notu: u8) -> f64`. Bunun nedenini Modül 3'te göreceksin.
3. **Derleyicinin ipucu bulamadığı ya da birden çok seçeneğin mümkün olduğu yerlerde.**

Üçüncü durumun en yaygın örneği metni sayıya çeviren `parse`'tır. Tahmin et:

````compiles
code: |
  fn main() {
      let yas = "27".parse().unwrap();
      println!("{yas}");
  }
answer: false
error: E0284
explanation: |
  Derlenmez! `parse` metni **hangi tipe** çevireceğini bilmek zorundadır: `u8`'e mi, `i64`'e mi,
  `f64`'e mi? Her biri farklı kurallarla çalışır (örneğin `"3.5"` bir `f64` olur ama bir `i32` olamaz).
  Programda işe yarar hiçbir ipucu yok; `println!` yüzlerce farklı tipi yazdırabildiği için ipucu
  sayılmaz:

  ```text
  error[E0284]: type annotations needed
   --> src/main.rs:2:9
    |
  2 |     let yas = "27".parse().unwrap();
    |         ^^^        ----- type must be known at this point
    |
    = note: cannot satisfy `<_ as FromStr>::Err == _`
  help: consider giving `yas` an explicit type
    |
  2 |     let yas: /* Type */ = "27".parse().unwrap();
    |            ++++++++++++
  ```

  Çözüm derleyicinin önerisinde: `let yas: u32 = "27".parse().unwrap();`
````

Peki sonraki bir satır ipucu verseydi? Tahmin et:

```compiles
code: |
  fn main() {
      let yas = "27".parse().unwrap();
      let kontrol: u32 = yas;
      println!("{kontrol}");
  }
answer: true
explanation: |
  **Derlenir** ve `27` yazdırır! `let kontrol: u32 = yas;` ataması kesin bir ipucudur: `yas` bir `u32`
  değişkenine konduğuna göre kendisi de `u32` olmalıdır. Çıkarım bu bilgiyi **geriye doğru** taşır ve
  `parse`'ın hedef tipini `u32` olarak belirler.
```

Demek ki her şey ipucunun **türüne** bağlı:

- `let kontrol: u32 = yas;` gibi bir **atama** (ya da `u32` bekleyen bir fonksiyona gönderme) yeterli
  bir ipucudur.
- Ama sonraki kullanım `yas * fiyat` gibi bir **işlemse** yetmez ve yine `E0284` alırsın. `*`
  operatörü yalnızca `u32 * u32` için değil, başka tip çiftleri için de tanımlıdır (örneğin
  referanslarla, Modül 5). Derleyici bu işlemden `yas` için tek bir tip çıkaramaz.

Bu inceliği ezberlemene gerek yok; basit bir alışkanlık edin: `parse` kullanırken tipi **hemen orada**
yaz. Hem derleyici hem de kodu okuyan insan bunu sever.

Benzer bir hatayı Ders 4'te görmüştün: `let x = 2.0; x.sqrt()` yazınca `E0689` çıkmıştı, çünkü `x`'in
`f32` mi `f64` mü olduğu belli değildi. Yine benzer bir hata olan **`E0282`** (*type annotations
needed*) ise boş bir koleksiyon oluştururken karşına çıkacak: `let v = Vec::new();` içine ne
konacağını bilmeyen bir `Vec`'tir (Modül 9).

:::info Ne kadar tip yazmalı?
Rust topluluğunun alışkanlığı şöyledir: **gerekmedikçe yazma**, ama okuyana yardım edecekse çekinme.
`let toplam = 0;` gibi bir satırda tip çoğu zaman sonraki kullanımdan çıkar. Ama bir değerin tipi
önemli bir karar ise (para için `u64` kuruş, ölçüm için `f64` gibi) açıkça yazmak kodu bir belgeye
dönüştürür.
:::

## parse ve turbofish

`parse`, bir metni (`&str`) başka bir tipe çevirmeye **çalışır**. Hedef tipi bildirmenin iki yolu var:

```rust
fn main() {
    // 1) Değişkene tip anotasyonu
    let yas: u32 = "27".parse().unwrap();

    // 2) Turbofish: parse::<Tip>()
    let boy = "1.75".parse::<f64>().unwrap();

    let tamam = "true".parse::<bool>().unwrap();
    let harf = "ş".parse::<char>().unwrap();
    println!("{yas} {boy} {tamam} {harf}");
    println!("Gelecek yıl: {}", yas + 1);
}
```

`::<f64>` yazımına Rust topluluğu **turbofish** der, çünkü `::<>` yan yatmış hızlı bir balığa benzer.
Bir metoda hangi tiple çalışacağını **doğrudan** söyler. İki yol da aynı sonucu verir; hangisini
seçeceğin okunabilirliğe bağlıdır:

- Sonuç bir değişkene atanıyorsa anotasyon genellikle daha doğaldır: `let yas: u32 = ...`.
- Sonucu doğrudan bir ifadede kullanıyorsan turbofish gerekir, çünkü `parse`'ın sonucunu tutan bir
  değişken yoktur: `let gelecek_yil = "2024".parse::<i32>().unwrap() + 1;` Burada
  `let gelecek_yil: i32 = ...` yazmak bile yetmez; o anotasyon toplamanın sonucunu anlatır, `parse`'ı
  değil (yine `E0284`).

:::warning Boşluklar ve virgüller
`parse` çok **katıdır**. `" 42"` (başında boşluk) bir sayı değildir; önce `.trim()` ile temizlemen
gerekir (Ders 2). Türkçedeki `"3,5"` yazımı da `f64`'e çevrilemez; Rust ondalık ayırıcı olarak yalnızca
**nokta** kabul eder. `"1_000"` da çevrilemez: alt çizgi yalnızca kodun içindeki sabitlerde geçerlidir,
metinlerde değil.
:::

```fill
prompt: Turbofish kullanarak metni bir tamsayıya çevir ve sonucu doğrudan ifadede kullan.
code: |
  fn main() {
      let dogum_yili = "2009";
      let yas = 2025 - dogum_yili.parse::<___0>().___1();
      println!("{yas} yaşındasın.");
  }
blanks:
  - ["i32", "u32", "i64", "u64", "u16", "i16", "usize", "isize", "i128", "u128"]
  - ["unwrap"]
output: "16 yaşındasın."
explanation: |
  `parse::<i32>()` metni `i32`'ye çevirmeyi dener ve bir sonuç kutusu döndürür; `.unwrap()` kutuyu açıp
  içindeki sayıyı alır. Burada sonuç doğrudan `2025 - ...` ifadesinde kullanıldığı için tipi
  belirtecek bir değişken yok; turbofish tam bu durum içindir.

  `u8` seçseydin ne olurdu? Program **derlenmezdi** bile: çıkarım `2025` sabitini de `u8` yapar ve
  derleyici `literal out of range for u8` der. `2009` metni de zaten bir `u8`'e sığmazdı.
```

Şimdi baştan sona bir program kur. Bir formdan gelen ürün adedini temizleyip sayıya çevir, sonra
toplam tutarı hesapla:

```parsons
prompt: Satırları sıraya koy. Program, formdan gelen `"  4 "` metnini temizleyip sayıya çevirsin ve toplam tutarı (kuruş cinsinden) yazdırsın.
lines: |
  fn main() {
      let adet_metni = "  4 ";
      let adet_metni = adet_metni.trim();
      let adet: u64 = adet_metni.parse().unwrap();
      let birim_fiyat_kurus: u64 = 1250;
      let toplam = adet * birim_fiyat_kurus;
      println!("Toplam: {toplam} kuruş");
  }
distractors: |
      let adet = adet_metni.parse().unwrap();
      let toplam = adet_metni * birim_fiyat_kurus;
explanation: |
  Önce metin gölgelenerek temizlenir (`trim`), sonra `u64` anotasyonuyla sayıya çevrilir. Çeldiricilere
  bak: anotasyonsuz `let adet = adet_metni.parse().unwrap();` bu programda **derlenmez** (`E0284`).
  Sonraki `adet * birim_fiyat_kurus` çarpması bir ipucu gibi görünse de yetmez: `*` birden fazla tip
  çifti için tanımlı olduğundan derleyici `adet`'in tipini bu işlemden kesin olarak çıkaramaz.
  `adet_metni * birim_fiyat_kurus` ise bir metni sayıyla çarpmaya çalışır ve o da derlenmez.
```

## unwrap ve expect: şimdilik kestirme yol

`parse`'ın neden doğrudan bir sayı döndürmediğini merak ettin mi? Çünkü çevirme **başarısız olabilir**.
`"yirmi"` metni bir sayı değildir. Bu yüzden `parse` bir **`Result`** döndürür: başarılıysa
`Ok(değer)`, başarısızsa `Err(hata)`. `{:?}` ile içine bakalım. Önce tahmin et:

```predict
code: |
  fn main() {
      println!("{:?}", "42".parse::<u8>());
      println!("{:?}", "300".parse::<u8>());
      println!("{:?}", "-5".parse::<i32>());
      println!("{:?}", "3.5".parse::<i32>());
  }
options:
  - "Ok(42)\nErr(ParseIntError { kind: PosOverflow })\nOk(-5)\nErr(ParseIntError { kind: InvalidDigit })"
  - "Ok(42)\nOk(44)\nOk(-5)\nOk(3)"
  - "Ok(42)\nErr(ParseIntError { kind: PosOverflow })\nErr(ParseIntError { kind: InvalidDigit })\nOk(3)"
  - "42\n300\n-5\n3.5"
answer: 0
explanation: |
  - `"42"` bir `u8`'e sığar: `Ok(42)`.
  - `"300"` bir `u8`'e sığmaz. `parse`, `as`'ın aksine sessizce kesmez (`44` vermez); hatayı
    **bildirir**: `PosOverflow` (pozitif taşma).
  - `"-5"` geçerli bir `i32`'dir: `Ok(-5)`.
  - `"3.5"` bir tamsayı değildir; `parse` ondalığı atmaz, `InvalidDigit` (geçersiz rakam) hatası verir.
```

`Result`'ı ve hataları nazikçe ele almayı **Modül 10**'da ayrıntılı öğreneceksin. O zamana kadar iki
kestirme yol kullanacağız:

- **`.unwrap()`**: "Başarılıysa değeri ver, değilse programı **panikle durdur**."
- **`.expect("mesaj")`**: Aynısı, ama panik mesajına senin açıklamanı ekler.

```rust,should_panic
fn main() {
    let yas_metni = "yirmi"; // kullanıcı sayı yerine yazıyla yazdı
    let yas: u32 = yas_metni.parse().expect("yaş bir sayı olmalı");
    println!("Yaşın: {yas}");
}
```

:::error unwrap ve expect panikleri
`.unwrap()` ile:
```text
thread 'main' (13) panicked at src/main.rs:3:38:
called `Result::unwrap()` on an `Err` value: ParseIntError { kind: InvalidDigit }
```
`.expect("yaş bir sayı olmalı")` ile:
```text
thread 'main' (13) panicked at src/main.rs:3:38:
yaş bir sayı olmalı: ParseIntError { kind: InvalidDigit }
```
Konum (`3:38`), satırdaki `unwrap`/`expect` çağrısının başladığı yeri gösterir: hata `parse`'ta
oluştu, ama programı durduran bu çağrıdır.
İkisi de durur, ama `expect` **neyin** yanlış gittiğini insan diliyle söyler. Bu yüzden `unwrap` yerine
`expect` kullanmak iyi bir alışkanlıktır.
:::

`unwrap` ve `expect` gerçek uygulamalarda kullanıcıya gösterilecek bir çözüm değildir; bir kullanıcının
yanlış yazdığı yaş yüzünden bütün programın çökmesini istemezsin. Ama öğrenirken, örneklerde ve
testlerde son derece kullanışlıdır. "Burada hata olursa ne yapacağım?" sorusunu şimdilik erteliyoruz;
cevabı Modül 10'da.

:::ferris
Fark ettin mi? `as` sığmayan değeri sessizce keserken `parse` sana "bu olmadı" diye **haber veriyor**.
Rust'ın tasarımında bu bir tema: başarısız olabilecek işlemler bunu tiplerinde açıkça söyler. 🦀
:::

## Alıştırmalar

İlk alıştırmada derlenmeyen bir programı düzelteceksin, ikincisinde metinden gelen verilerle gerçek bir
hesap yapacaksın.

````exercise
id: m02-e-tip-hatalarini-duzelt
title: Kitapçı sepetini düzelt
difficulty: 2
prompt: |
  Bir online kitapçının sepet kodu derlenmiyor. Fiyat, web formundan **metin** olarak geliyor ve
  toplama %10 indirim uygulanıyor. Programı düzelt; çıktı tam olarak şöyle olmalı:

  ```text
  Toplam: 135 TL, indirimli: 121.50 TL
  ```

  Sayıları elle yazma: fiyat metinden `parse` ile çevrilmeli, indirimli tutar hesaplanmalı.
  Derleyicinin hata mesajlarını oku; ne istediklerini söylüyorlar!
starter: |
  fn main() {
      let fiyat_metni = "45"; // web formundan gelen fiyat
      let adet: u32 = 3;
      let fiyat = fiyat_metni.parse().unwrap();
      let toplam = fiyat * adet;
      let indirim_orani = 0.1;
      let indirimli = toplam * (1.0 - indirim_orani);
      println!("Toplam: {toplam} TL, indirimli: {indirimli:.2} TL");
  }
starter_compiles: false
solution: |
  fn main() {
      let fiyat_metni = "45"; // web formundan gelen fiyat
      let adet: u32 = 3;
      let fiyat: u32 = fiyat_metni.parse().unwrap();
      let toplam = fiyat * adet;
      let indirim_orani = 0.1;
      let indirimli = toplam as f64 * (1.0 - indirim_orani);
      println!("Toplam: {toplam} TL, indirimli: {indirimli:.2} TL");
  }
check: output
expected_output: "Toplam: 135 TL, indirimli: 121.50 TL"
hints:
  - "İlk hata `E0284: type annotations needed`: `parse` hangi tipe çevireceğini bilmiyor. `fiyat` için bir tip yaz; `adet` ile çarpılacağı için aynı tipte olmalı."
  - "İkinci hata: `toplam` bir `u32`, `(1.0 - indirim_orani)` ise bir `f64`. Tamsayı ile ondalık doğrudan çarpılamaz (Ders 4)."
  - "`let fiyat: u32 = fiyat_metni.parse().unwrap();` ve `let indirimli = toplam as f64 * (1.0 - indirim_orani);`"
require:
  - pattern: "parse"
    message: Fiyatı metinden `parse` ile çevirmelisin.
  - pattern: "as\\s+f64|f64::from"
    message: "`toplam`'ı ondalık hesaba sokmak için `as f64` ile dönüştürmelisin."
forbid:
  - pattern: "\\b(135|121)\\b"
    message: Sonuçları elle yazma; hesabı Rust yapsın!
explanation: |
  İki ayrı tip sorunu vardı:

  1. **`E0284`:** `parse` ne üreteceğini bilmek zorunda. `let fiyat: u32 = ...` anotasyonu bunu söyler.
     Turbofish ile de olurdu: `fiyat_metni.parse::<u32>().unwrap()`. Sonraki satırdaki
     `fiyat * adet` çarpımı bir ipucu gibi görünse de yetmez: `*` birden fazla tip çifti için tanımlı
     olduğundan derleyici `fiyat`'ın tipini bu işlemden kesin olarak çıkaramaz.
  2. **`E0277`:** `u32` ile `f64` çarpılamaz. `toplam as f64` kayıpsız bir dönüşümdür; sonra ondalıklı
     çarpma yapılır: `135.0 × 0.9 = 121.5`, `{:.2}` ile `121.50` yazılır.

  Gerçek bir uygulamada parayı kuruş cinsinden tamsayıyla tutardık (Ders 4); burada yalnızca ekranda
  göstermek için ondalık hesap yaptık.
````

````exercise
id: m02-e-kargo-ucreti
title: Kargo ücreti hesaplayıcı
difficulty: 3
prompt: |
  Bir kargo şirketinin web formu, gönderinin **ağırlığını** (kg, ondalıklı olabilir) ve **mesafesini**
  (km, tamsayı) metin olarak gönderiyor. Metinlerin başında ve sonunda boşluk olabilir. Ücret
  **kuruş** cinsinden hesaplanıyor:

  - kg başına 1250 kuruş (12,50 TL): ağırlık ücreti en yakın kuruşa **yuvarlanır**.
  - km başına 40 kuruş.

  `kargo_ucreti(agirlik_metni, mesafe_metni)` fonksiyonunu tamamla. Ücret = yuvarlanmış ağırlık ücreti +
  mesafe ücreti. Örnek: `kargo_ucreti("2", "100")` → `2500 + 4000 = 6500`.

  Geçersiz girdide program şu mesajlarla panik yapmalı (`.expect` kullan):

  - ağırlık çevrilemezse: `ağırlık bir sayı olmalı`
  - mesafe çevrilemezse: `mesafe bir tamsayı olmalı`

  (Metin parametrelerinin tipi `&str`; şimdilik "metin" diye düşünmen yeterli.)
starter: |
  const KG_BASINA_KURUS: f64 = 1250.0;
  const KM_BASINA_KURUS: u64 = 40;

  fn kargo_ucreti(agirlik_metni: &str, mesafe_metni: &str) -> u64 {
      // 1) Metinleri temizle (trim) ve çevir (parse + expect)
      // 2) Ağırlık ücretini hesapla, yuvarla, u64'e çevir
      // 3) Mesafe ücretini ekle
      todo!()
  }

  fn main() {
      let ucret = kargo_ucreti(" 1.5 ", "250");
      println!("Kargo ücreti: {} TL {} kuruş", ucret / 100, ucret % 100);
  }
solution: |
  const KG_BASINA_KURUS: f64 = 1250.0;
  const KM_BASINA_KURUS: u64 = 40;

  fn kargo_ucreti(agirlik_metni: &str, mesafe_metni: &str) -> u64 {
      let agirlik: f64 = agirlik_metni.trim().parse().expect("ağırlık bir sayı olmalı");
      let mesafe: u64 = mesafe_metni.trim().parse().expect("mesafe bir tamsayı olmalı");
      let agirlik_ucreti = (agirlik * KG_BASINA_KURUS).round() as u64;
      agirlik_ucreti + mesafe * KM_BASINA_KURUS
  }

  fn main() {
      let ucret = kargo_ucreti(" 1.5 ", "250");
      println!("Kargo ücreti: {} TL {} kuruş", ucret / 100, ucret % 100);
  }
check: tests
tests: |
  #[test]
  fn tam_sayili_girdiler() {
      assert_eq!(kargo_ucreti("2", "100"), 6500, "2 kg × 1250 + 100 km × 40 = 6500 kuruş");
      assert_eq!(kargo_ucreti("0", "0"), 0, "ağırlık ve mesafe 0 ise ücret 0 olmalı");
  }

  #[test]
  fn bosluklu_ve_ondalikli_girdiler() {
      assert_eq!(kargo_ucreti(" 1.5 ", "250"), 11875, "1,5 kg × 1250 = 1875, 250 km × 40 = 10000; boşluklar trim ile atılmalı");
      assert_eq!(kargo_ucreti("10", " 12 "), 12980, "10 kg × 1250 + 12 km × 40 = 12980; mesafedeki boşluklar da atılmalı");
  }

  #[test]
  fn agirlik_ucreti_yuvarlanir() {
      assert_eq!(kargo_ucreti("0.333", "0"), 416, "0,333 × 1250 = 416,25 → 416 kuruşa yuvarlanmalı");
      assert_eq!(kargo_ucreti("0.3335", "1"), 457, "0,3335 × 1250 = 416,875 → 417, + 40 = 457 (kesme değil yuvarlama!)");
  }

  #[test]
  #[should_panic(expected = "ağırlık bir sayı olmalı")]
  fn gecersiz_agirlik_aciklayici_panik() {
      kargo_ucreti("iki", "100");
  }

  #[test]
  #[should_panic(expected = "mesafe bir tamsayı olmalı")]
  fn ondalikli_mesafe_kabul_edilmez() {
      kargo_ucreti("2", "12.5");
  }
hints:
  - "Önce temizle, sonra çevir: `agirlik_metni.trim().parse()`. Hedef tipi anotasyonla söyle: ağırlık `f64`, mesafe `u64`."
  - "`.unwrap()` yerine `.expect(\"ağırlık bir sayı olmalı\")` yaz; mesaj testlerdeki ile birebir aynı olmalı."
  - "Ağırlık ücreti: `(agirlik * KG_BASINA_KURUS).round() as u64`. `as`'tan **önce** `round()` çağır, yoksa ondalık kısım kesilir. Sonuç: `agirlik_ucreti + mesafe * KM_BASINA_KURUS`."
require:
  - pattern: "trim"
    message: Girdilerdeki boşlukları `trim` ile temizlemelisin.
  - pattern: "expect"
    message: Geçersiz girdide açıklayıcı bir panik için `expect` kullanmalısın.
explanation: |
  Bu fonksiyon, bu modülde öğrendiğin hemen her şeyi birleştiriyor:

  - **Sabitler** (Ders 2): ücret tarifesi kodun içine "sihirli sayılar" olarak dağılmıyor.
  - **Gölgeleme yerine zincir:** `trim().parse()` metni önce temizleyip sonra çeviriyor.
  - **Tip anotasyonu** (bu ders): `let agirlik: f64` ve `let mesafe: u64` olmadan `parse` hangi tipe
    çevireceğini bilemezdi. Mesafeyi `u64` seçtiğimiz için `"12.5"` reddedildi; tam istediğimiz buydu.
  - **Ondalık → tamsayı** (Ders 4): `.round() as u64` önce yuvarlar, sonra çevirir. Yalnızca `as u64`
    deseydin `416.875` → `416` olurdu ve müşteriden 1 kuruş eksik alınırdı.
  - **Para tamsayıda** (Ders 4): sonuç kuruş cinsinden `u64`; `main`'deki `/ 100` ve `% 100` (Ders 3)
    onu TL ve kuruşa ayırıyor.

  `expect` mesajları, bir şey ters gittiğinde **neyin** yanlış olduğunu söylüyor. Modül 10'da bu panikleri
  kullanıcıya nazik bir hata mesajı gösteren `Result` dönüşlerine çevirmeyi öğreneceksin.
````

## Özet

:::remember
- Rust **statik tiplidir**: her tip derleme zamanında bellidir. Tip hataları (`E0308`) program
  çalışmadan yakalanır.
- **Tip çıkarımı** değerin kendisine **ve sonraki kullanımlarına** bakar. İpucu yoksa varsayılan:
  tamsayı `i32`, ondalık `f64`.
- Tip yazmak zorunlu: `const`/`static`, fonksiyon imzaları ve derleyicinin karar veremediği yerler
  (`E0284`/`E0282`: *type annotations needed*).
- `parse` metni çevirir; hedef tipi anotasyonla (`let x: u32 = s.parse()...`) ya da **turbofish** ile
  (`s.parse::<u32>()`) söylersin. Önce `.trim()`; ondalık ayırıcı nokta.
- `parse` bir `Result` döndürür (`Ok`/`Err`). `.unwrap()` / `.expect("mesaj")` şimdilik kestirme yol:
  hata varsa panik. Doğrusu Modül 10'da.
- `E0308` okurken: **expected** (beklenen) ne, **found** (bulunan) ne, beklenti **nereden** geliyor?
:::

```reflect
prompt: |
  Rust tipleri çoğu zaman kendisi çıkarıyor, ama `parse` gibi yerlerde tipi senin yazmanı istiyor.
  Derleyici neden `parse`'ın sonucunun tipini tahmin edemez? Tahmin etseydi (örneğin hep `i32`
  seçseydi) ne tür sorunlar çıkabilirdi?
answer: |
  Model cevap: `parse` aynı metni birçok farklı tipe çevirebilir ve her tipin kuralları farklıdır:
  `"3.5"` bir `f64` olur ama bir `i32` olamaz; `"300"` bir `u32` olur ama bir `u8` olamaz. Yani hangi
  tipin seçildiği, çevirmenin başarılı olup olmayacağını ve sonucun anlamını değiştirir. Derleyici
  sessizce `i32` seçseydi, ondalıklı bir fiyat ya da büyük bir sayı geldiğinde program beklenmedik
  biçimde hata verirdi ve bunun nedeni koda bakınca anlaşılmazdı. Tipi açıkça yazmak benim niyetimi
  belgeler ve derleyicinin bu niyete göre denetim yapmasını sağlar.
```

```flashcards
- front: Statik tipleme ile dinamik tipleme arasındaki temel fark nedir?
  back: "Statik tiplemede (Rust) tipler derleme zamanında bellidir ve tip hataları program çalışmadan yakalanır; dinamik tiplemede (Python) tipler çalışırken belli olur, hata o satır çalışınca çıkar."
- front: "`let x = 5;` satırında başka hiçbir ipucu yoksa `x`'in tipi nedir? `let y = 5.0;` için?"
  back: "`i32` ve `f64`."
- front: "`let n = 200; let k: u8 = n;` satırlarında `n`'in tipi nedir?"
  back: "`u8`. Tip çıkarımı sonraki kullanıma da bakar: `n` bir `u8`'e atandığı için o da `u8` olur."
- front: "`\"42\".parse().unwrap()` neden tek başına derlenmez? Hangi hata?"
  back: "`E0284: type annotations needed`. `parse` hangi tipe çevireceğini bilmiyor; `let x: i32 = ...` ya da `parse::<i32>()` yazmalısın."
- front: Turbofish nedir? Bir örnek ver.
  back: "Bir metoda tipi doğrudan `::<Tip>` ile söyleme yazımı: `\"3.5\".parse::<f64>()`"
- front: "`\" 42\".parse::<i32>()` neden başarısız olur?"
  back: "Baştaki boşluk geçerli bir rakam değildir (`InvalidDigit`). Önce `.trim()` çağırmalısın."
- front: "`.unwrap()` ile `.expect(\"mesaj\")` arasındaki fark nedir?"
  back: "İkisi de hata varsa panik yapar; `expect` panik mesajına senin açıklamanı ekler, bu yüzden hatanın nedenini anlamak kolaylaşır."
- front: "`\"300\".parse::<u8>()` ile `300_i32 as u8` farkı nedir?"
  back: "`parse` hatayı bildirir (`Err(... PosOverflow)`); `as` ise sessizce keser ve `44` verir."
```
