---
id: m02-l01
title: Değişkenler ve Değişmezlik
minutes: 15
type: lesson
objectives:
  - "`let` ile değişken tanımlayıp değerini hesaplamalarda ve `println!` içinde kullanabilmek"
  - Rust'ta değişkenlerin neden varsayılan olarak değişmez olduğunu üç gerekçeyle açıklayabilmek
  - "`E0384` hatasını okuyup `mut` ile düzeltebilmek ve `mut`'un gerçekten gerektiği durumları ayırt edebilmek"
  - Değişkenlere `snake_case` kuralına uygun, anlamlı isimler verebilmek
keywords: [let, mut, değişken, değişmezlik, immutability, E0384, E0381, snake_case]
---

Bir oyunda karakterinin canı, bankadaki bakiyen, hava durumu uygulamasındaki sıcaklık... Her program
**veri** ile çalışır ve bu verilere isim vermek zorundadır. Bir değere verdiğimiz isme **değişken
(variable)** denir.

Bu derste Rust'ta değişken tanımlamayı öğreneceksin. Ama asıl sürpriz şu: Rust'ta değişkenler,
adlarının aksine, **varsayılan olarak değişmez**. Bunun neden çok akıllıca bir karar olduğunu birlikte
keşfedeceğiz.

:::ferris
Modül 2'ye hoş geldin! Bu modülün sonunda Rust'ın temel veri tiplerini tanıyacak ve derleyicinin seni
hangi hatalardan koruduğunu göreceksin. Hadi başlayalım! 🦀
:::

## let ile ilk değişkenin

Önce örneğe bakalım, kuralı sonra çıkaracağız. Programı çalıştırıp çıktısını incele:

```rust
fn main() {
    let oyuncu = "Ferris";
    let can = 100;
    let guc = 15;
    let uc_vurus_hasari = guc * 3;
    println!("{oyuncu} oyuna katıldı. Can: {can}");
    println!("Üç vuruşta toplam hasar: {uc_vurus_hasari}");
}
```

Her `let` satırı bir **bağlama (binding)** yapar: eşittir işaretinin sağındaki **değeri**, solundaki
**isme** bağlar. Genel kalıp şudur:

```text
let isim = değer;
```

- `let` anahtar kelimesi "yeni bir değişken tanımlıyorum" der.
- İsim (`can`) ile değer (`100`) arasında `=` vardır; satır `;` ile biter.
- Tanımladığın değişkeni sonraki satırlarda istediğin kadar kullanabilirsin: başka bir hesaplamada
  (`guc * 3`) ya da Modül 1'den hatırladığın gibi `println!` içinde süslü parantezlerle (`{can}`).

Rust her değişkenin **tipini** de bilir: `can` bir tamsayı, `oyuncu` bir metin. Tipi çoğu zaman sen
yazmazsın; derleyici değerden anlar. Tipleri Ders 3-6'da tek tek inceleyeceğiz.

:::analogy Etiketli kavanozlar
Değişkenleri mutfaktaki etiketli kavanozlar gibi düşün: **etiket** isimdir (`can`), **içindeki** ise
değerdir (`100`). Tarif "şeker kavanozundan iki kaşık al" dediğinde kavanozun içindekini kullanırsın;
kodda `can` yazdığında da Rust kavanozun içindeki değeri kullanır.
:::

```predict
code: |
  fn main() {
      let fiyat = 25;
      let adet = 4;
      let toplam = fiyat * adet;
      println!("{adet} adet x {fiyat} TL = {toplam} TL");
  }
options:
  - "4 adet x 25 TL = 100 TL"
  - "{adet} adet x {fiyat} TL = {toplam} TL"
  - "adet adet x fiyat TL = toplam TL"
answer: 0
explanation: |
  `toplam`, `fiyat * adet` hesaplanarak oluşturulur: `25 * 4 = 100`. `println!` içindeki `{adet}`,
  `{fiyat}` ve `{toplam}` ise Modül 1'de öğrendiğin **satır içi biçimlendirme argümanlarıdır**
  (inline format args): süslü parantezin içine yazılan değişkenin değeri metne yerleştirilir.
```

## Değeri değiştirmeyi deneyelim

Karakterin bir tuzağa düştü ve skorunu güncellemek istiyorsun. Çoğu dilde bu çok sıradan bir işlem.
Peki Rust ne diyor? Açıklamaya geçmeden önce tahmin et:

```compiles
code: |
  fn main() {
      let skor = 10;
      println!("Skor: {skor}");
      skor = 20;
      println!("Skor: {skor}");
  }
answer: false
error: E0384
explanation: |
  Derlenmez! `let` ile tanımlanan değişkenler Rust'ta **varsayılan olarak değişmezdir (immutable)**.
  `skor = 20;` satırı, değeri zaten bağlanmış bir değişkene ikinci kez değer atamaya çalışıyor;
  derleyici buna izin vermez.
```

Derleyicinin tam mesajı şöyle:

:::error
```text
error[E0384]: cannot assign twice to immutable variable `skor`
 --> src/main.rs:4:5
  |
2 |     let skor = 10;
  |         ---- first assignment to `skor`
3 |     println!("Skor: {skor}");
4 |     skor = 20;
  |     ^^^^^^^^^ cannot assign twice to immutable variable
  |
help: consider making this binding mutable
  |
2 |     let mut skor = 10;
  |         +++
```
Mesajı Modül 1'de öğrendiğin sırayla oku: **1)** hata kodu ve özet (*değişmez değişkene iki kez
atama*), **2)** konum (`4:5` → 4. satır, 5. sütun), **3)** etiketler hikâyeyi anlatır: *ilk atama
burada*, *ikincisi burada*. **4)** `help` satırı çözümü bile gösteriyor: `+++` işaretleri, `mut`
kelimesinin nereye ekleneceğini gösterir.
:::

Bu hata bir kusur değil, bilinçli bir tasarım kararı. Diğer dillerde durum nasıl?

| Dil | Değişmez tanım | Değiştirilebilir tanım | Varsayılan |
|---|---|---|---|
| C / C++ | `const int x = 5;` | `int x = 5;` | değiştirilebilir |
| Java | `final int x = 5;` | `int x = 5;` | değiştirilebilir |
| JavaScript | `const x = 5;` | `let x = 5;` | değiştirilebilir |
| Python | *(yok)* | `x = 5` | değiştirilebilir |
| **Rust** | `let x = 5;` | `let mut x = 5;` | **değişmez** |

Çoğu dilde değişmezlik için **ekstra** bir şey yazarsın (`const`, `final`). Rust bunu tersine
çevirir: değişmezlik bedavadır, değiştirilebilirlik için ekstra bir şey (`mut`) yazarsın.

:::warning JavaScript bilenler dikkat!
JavaScript'te `let` **değiştirilebilir** bir değişken tanımlar; değişmez olan `const`'tur. Rust'ta ise
`let` tek başına **değişmezdir**. Aynı kelime, ters anlam! (Rust'ın da bir `const`'u var; onu bir
sonraki derste göreceksin.)
:::

## Neden varsayılan olarak değişmez?

Rust'ın tasarımcıları değişmezliği bilerek varsayılan yaptı. Üç güçlü gerekçesi var:

1. **Kazara değişikliklere karşı güvenlik.** Büyük bir programda bir değerin yanlışlıkla değiştirilmesi
   en sinsi hatalardandır: değer bir yerde bozulur, belirti bambaşka bir yerde ortaya çıkar. Rust'ta
   değişmemesi gereken bir değeri değiştirmeye kalkarsan derleyici seni **program daha çalışmadan**
   durdurur.
2. **Kolay akıl yürütme.** `let kdv_orani = 20;` satırını gördüğün anda bu değerin aşağıdaki hiçbir
   satırda değişmeyeceğini bilirsin; bütün fonksiyonu taramana gerek kalmaz. Değişebilen her şey `mut`
   ile **işaretlidir**, yani dikkatini nereye vereceğini kod sana söyler. (Modül 17'de bu kurala
   bilinçli bir istisna tanıyan **iç değişkenlik (interior mutability)** tiplerini göreceksin; onlar
   da bu özelliklerini tiplerinde açıkça ilan eder.)
3. **Güvenli eşzamanlılık.** Değişmeyen bir veriyi aynı anda birçok iş parçacığı (**thread**) sorunsuzca
   okuyabilir. Sorun, aynı veriye eşzamanlı erişenlerden **en az biri yazdığında** başlar; buna **veri
   yarışı (data race)** denir. Rust'ın "korkusuz eşzamanlılık" vaadi bu temelin üstüne kurulur
   (Modül 18).

Rust'ın güvenlik anlayışının bir parçası daha var. Şu kodu tahmin et:

```compiles
code: |
  fn main() {
      let sicaklik: i32;
      println!("Bugün hava {sicaklik} derece");
  }
answer: false
error: E0381
explanation: |
  `let sicaklik: i32;` bir değişkeni **değer vermeden** tanımlar (`: i32` kısmı tipini söyler; tipleri
  Ders 3'te göreceğiz). Rust, değeri olmayan bir değişkeni okumana asla izin vermez:
  ``E0381: used binding `sicaklik` isn't initialized``.

  C'de benzer bir kod (en fazla bir uyarıyla) derlenir. Okunan değer **belirsizdir**: çoğu zaman o
  bellek hücresinde önceden ne kaldıysa (**çöp değer**) ekrana basılır, ama derleyici bu durumda
  programı istediği gibi değiştirmekte de serbesttir. Buna **tanımsız davranış (undefined behavior)**
  denir. Rust bu hata sınıfını derleme zamanında tamamen ortadan kaldırır.
```

:::deep Değeri sonradan vermek
Bir değişkeni değersiz tanımlayıp değerini **bir kez** sonradan verebilirsin:

```rust
fn main() {
    let sonuc;
    sonuc = 42; // bu bir değişiklik değil, ilk değer verme (initialization)
    println!("{sonuc}");
}
```

İkinci kez atamaya kalkarsan yine `E0384` alırsın, çünkü `sonuc` değişmezdir. Bu özellik Modül 3'te
`if` ile birlikte işe yarayacak: değeri bir koşula göre vermek istediğinde. Değeri hemen
verebiliyorsan ise doğrudan `let sonuc = 42;` yaz; Clippy de gereksiz yere ertelenmiş ilk değer
vermeyi (`needless_late_init`) bu yüzden işaretler.
:::

```quiz
question: |
  Rust'ın değişkenleri varsayılan olarak değişmez yapmasının **gerçek** faydaları hangileridir?
  (Birden fazla seçenek doğru olabilir.)
options:
  - Değişmemesi gereken bir değerin kazara değiştirilmesi derleme anında yakalanır
  - "Kodu okuyan kişi, `mut` olmayan bir değişkenin değerinin değişmeyeceğinden emin olur"
  - Değişmez veriler birden fazla thread tarafından güvenle okunabilir
  - Değişmez değişkenler bellekte hiç yer kaplamaz
answer: [0, 1, 2]
explanation: |
  İlk üç seçenek değişmezliğin asıl kazançlarıdır: **güvenlik**, **kolay akıl yürütme** ve **güvenli
  eşzamanlılık**. Değişmez bir değişken de bellekte yer kaplar: değişmez bir `i32` de `mut` bir `i32`
  kadar, yani 4 bayt. `mut` olup olmaması boyutu değiştirmez, sadece neye **izin** verildiğini belirler.
feedback:
  - "Doğru: `E0384` tam olarak bunu yakalar."
  - "Doğru: değişebilen her şey `mut` ile işaretlidir."
  - "Doğru: veri yarışları ancak biri yazarken ortaya çıkar."
  - "Yanlış: değişmez bir tamsayı da bellekte yer kaplar; değişmezlik bir **izin** meselesidir, boyut değil."
```

## mut ile değiştirilebilir değişkenler

Bir değerin gerçekten değişmesi gerekiyorsa bunu Rust'a açıkça söylersin: `let` ile isim arasına `mut`
(**mutable**: değiştirilebilir) yazarsın.

```rust
fn main() {
    let mut sepet = 0;
    println!("Sepet: {sepet} TL");

    sepet = sepet + 45; // ekmek ve süt
    println!("Sepet: {sepet} TL");

    sepet = sepet + 120; // peynir
    println!("Sepet: {sepet} TL");
}
```

`sepet = sepet + 45;` satırı önce sağ tarafı hesaplar (mevcut değer `0` + `45`), sonra sonucu aynı
değişkene yazar. Başında `let` yok, çünkü yeni bir değişken tanımlamıyoruz; **var olanın değerini
değiştiriyoruz**. (Bu "al, ekle, geri yaz" kalıbının kısa yazımı `sepet += 45;`'tir; Ders 4'te
göreceksin. Clippy de seni o kısa yazıma yönlendirir.)

```memory
title: let mut sepet adım adım
steps:
  - caption: "`let mut sepet = 0;` — `main` fonksiyonunun bellek alanında (**stack**) `sepet` için bir yer ayrılır."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: i32, value: "0", mut: true }
  - caption: "`sepet = sepet + 45;` — yeni bir yer açılmaz; **aynı yerdeki** değer güncellenir."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: i32, value: "45", mut: true, note: "0 → 45" }
  - caption: "`sepet = sepet + 120;` — yine aynı yer; değer artık `165`."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: i32, value: "165", mut: true, note: "45 → 165" }
```

(**Stack**, bir fonksiyonun yerel değişkenlerinin durduğu bellek bölgesidir; Modül 4'te ayrıntısıyla
göreceğiz.)

**`mut` ne zaman gerekli?**

- ✅ Değer zaman içinde **gerçekten değişiyorsa**: sayaçlar, toplamlar, bir oyunun skoru, bir hesabın
  bakiyesi, döngülerdeki değişkenler (Modül 3).
- ❌ Bir değeri bir kez hesaplayıp kullanacaksan `mut`'a gerek yok; sonucu yeni bir değişkene koy:
  `let indirimli_fiyat = fiyat - indirim;`

Peki gereksiz yere `mut` yazarsan ne olur?

````compiles
code: |
  fn main() {
      let mut sehir = "Ankara";
      println!("Başkent: {sehir}");
  }
answer: true
explanation: |
  **Derlenir!** Ama derleyici bir **uyarı (warning)** verir, çünkü `sehir` hiç değiştirilmiyor:

  ```text
  warning: variable does not need to be mutable
   --> src/main.rs:2:9
    |
  2 |     let mut sehir = "Ankara";
    |         ----^^^^^
    |         |
    |         help: remove this `mut`
  ```

  Modül 1'den hatırla: uyarılar derlemeyi durdurmaz ama bir şeyin gereksiz ya da şüpheli olduğunu
  söyler. Gereksiz `mut`'u sil ki kodu okuyan biri boşuna "bu değer nerede değişiyor?" diye aramasın.
````

Şimdi sıra sende. Sabah ve akşam yürüyüşlerinin adımlarını toplayan programı tamamla:

```fill
prompt: Programın derlenmesi için boşluğu doldur.
code: |
  fn main() {
      let ___0 adim = 0;
      adim = adim + 4000; // sabah yürüyüşü
      adim = adim + 2500; // akşam yürüyüşü
      println!("Bugün {adim} adım attın!");
  }
blanks:
  - ["mut"]
output: Bugün 6500 adım attın!
explanation: |
  `adim` iki kez değiştiriliyor, bu yüzden `let mut adim = 0;` olmalı. `mut` olmasaydı ilk atamada
  `E0384` hatası alırdın.
```

## İsimlendirme kuralları

Rust'ta bir değişken ismi şu kurallara uyar:

- Harf, rakam ve alt çizgiden (`_`) oluşur; **rakamla başlayamaz** (`2oyuncu` olmaz).
- Büyük-küçük harfe duyarlıdır: `puan` ile `Puan` farklı isimlerdir.
- Anahtar kelimeler (`let`, `fn`, `mut`, `type`, `match`...) isim olarak kullanılamaz. `final` gibi
  ileride kullanılmak üzere **ayrılmış** kelimeler de öyle. (Çok nadiren gerekirse başka bir kütüphaneyle
  uyum için `r#type` gibi bir **ham tanımlayıcı (raw identifier)** yazılabilir; şimdilik bilmen yeterli.)

Bunlar zorunlu kurallar. Bir de topluluğun **gelenekleri** var: değişkenler ve fonksiyonlar
**snake_case** yazılır, yani tamamı küçük harf ve kelimeler alt çizgiyle ayrılır: `ogrenci_sayisi`,
`toplam_puan`. Java ya da JavaScript alışkanlığıyla *camelCase* yazarsan derleyici seni uyarır:

:::error Derleyici diyor ki (uyarı)
```text
warning: variable `notOrtalamasi` should have a snake case name
 --> src/main.rs:2:9
  |
2 |     let notOrtalamasi = 85;
  |         ^^^^^^^^^^^^^ help: convert the identifier to snake case: `not_ortalamasi`
```
Rust'ta her şeyin bir yazım geleneği var: değişkenler `snake_case`, sabitler `SCREAMING_SNAKE_CASE`
(bir sonraki ders), tipler `UpperCamelCase` (`String` gibi). Bu sayede bir ismin **ne olduğunu**
yazılışından anlarsın.
:::

İki pratik bilgi daha:

- Rust 1.53'ten beri `let öğrenci = 1;` gibi Türkçe karakterli isimler de derlenir. Ama bu derste ve
  çoğu gerçek projede isimler **ASCII** yazılır: her klavyede kolayca yazılır, ekip arkadaşların ve
  araçlar sorun yaşamaz. Metinlerin (`"Öğrenci"`) içinde ise Türkçe karakterleri özgürce kullan.
- Kasıtlı olarak kullanmadığın bir değişkenin adının başına `_` koyarsan derleyici "kullanılmayan
  değişken" uyarısı vermez:

```rust
fn main() {
    let ogrenci_sayisi = 32;
    let sinif_adi = "10-B";
    let _yedek_sayi = 0; // baştaki _ "bunu bilerek kullanmıyorum" der
    println!("{sinif_adi} sınıfında {ogrenci_sayisi} öğrenci var.");
}
```

İnce bir ayrım: `_yedek_sayi` hâlâ gerçek bir değişkendir; değeri kapsamın sonuna kadar yaşar. Tek
başına `_` ise bir isim değil, "bunu hiçbir yere bağlama" demektir: `let _ = 5;` hiçbir değişken
oluşturmaz. Bu farkın neden önemli olduğunu Modül 4'te, değerlerin ne zaman temizlendiğini öğrenirken
göreceksin.

```quiz
question: |
  Bir öğrencinin not ortalamasını tutan değişken için Rust'ın kurallarına ve geleneklerine **en uygun**
  isim hangisidir?
options:
  - "`NotOrtalamasi`"
  - "`notOrtalamasi`"
  - "`not_ortalamasi`"
  - "`2_not_ortalamasi`"
answer: 2
explanation: |
  Rust'ta değişken isimleri **snake_case** yazılır: tamamı küçük harf, kelimeler alt çizgiyle ayrılır.
  Diğer yazımlar ya uyarıya ya da derleme hatasına yol açar.
feedback:
  - "`UpperCamelCase` tipler içindir (`String` gibi). Değişkene verirsen derleyici `non_snake_case` uyarısı verir."
  - "Bu **camelCase**, Java/JavaScript geleneği. Rust uyarı verir ve `not_ortalamasi` önerir."
  - Doğru! Küçük harf ve alt çizgi.
  - Bir isim rakamla **başlayamaz**; bu bir uyarı değil, derleme hatasıdır.
```

## Alıştırma zamanı

İlk alıştırmada derleyicinin mesajını kullanarak bir programı düzelteceksin, ikincisinde ise sıfırdan
yazacaksın.

````exercise
id: m02-e-can-bari
title: Can barını düzelt
difficulty: 1
prompt: |
  Bir oyun karakterinin canını takip eden bu program **derlenmiyor**: derleyici `E0384` hatası veriyor.
  Hesaplamaları değiştirmeden programı düzelt ki şu çıktıyı üretsin:

  ```text
  Başlangıç canı: 100
  Tuzağa düştü: 70
  İksir içti: 85
  ```
starter: |
  fn main() {
      let can = 100;
      println!("Başlangıç canı: {can}");

      can = can - 30; // tuzak!
      println!("Tuzağa düştü: {can}");

      can = can + 15; // iksir
      println!("İksir içti: {can}");
  }
starter_compiles: false
solution: |
  fn main() {
      let mut can = 100;
      println!("Başlangıç canı: {can}");

      can = can - 30; // tuzak!
      println!("Tuzağa düştü: {can}");

      can = can + 15; // iksir
      println!("İksir içti: {can}");
  }
check: output
expected_output: |
  Başlangıç canı: 100
  Tuzağa düştü: 70
  İksir içti: 85
hints:
  - "Derleyicinin mesajını oku: hangi değişkene **ikinci kez** değer atanıyor?"
  - "Değeri değişecek bir değişkeni Rust'a önceden bildirmen gerekir. Bunun için hangi anahtar kelimeyi öğrendin?"
  - "Sadece ilk satırı değiştirmen yeterli: `let mut can = 100;`"
require:
  - pattern: "let\\s+mut\\s+can\\b"
    message: "`can` değişkenini `mut` ile tanımlamalısın."
forbid:
  - pattern: "\\b(70|85)\\b"
    message: Sonuçları elle yazma; hesaplamaları Rust yapsın!
explanation: |
  Tek değişiklik `let mut can = 100;`. `mut` olmadan `can` değişmezdi ve ikinci atama `E0384` hatası
  veriyordu. Derleyicinin `help` satırı da tam olarak bunu öneriyordu: hata mesajlarını dikkatle okumak
  çoğu zaman çözümü doğrudan verir.

  **Alternatif:** Bir sonraki derste göreceğin **gölgeleme** ile de çözülebilirdi: `let can = can - 30;`
  Bu durumda her satır yeni bir değişken oluşturur. Ama "can" zaman içinde değişen **tek bir** şey
  olduğu için burada `mut` daha doğal bir seçimdir.
````

````exercise
id: m02-e-kumbara
title: Elif'in kumbarası
difficulty: 2
prompt: |
  Elif harçlıklarını bir kumbarada biriktiriyor: 1. hafta **50 TL**, 2. hafta **75 TL**, 3. hafta
  **40 TL** atıyor; sonra kumbaradaki paranın **30 TL**'siyle bir kitap alıyor. Hedefi **200 TL**
  biriktirmek.

  `kumbara` adında, `0` ile başlayan **tek bir** değiştirilebilir değişken kullanarak her işlemden sonra
  kumbaradaki parayı yazdır. Son satırda hedefe ne kadar kaldığını **yeni ve değişmez** bir değişkenle
  hesapla. Çıktı tam olarak şöyle olmalı:

  ```text
  1. hafta: 50 TL
  2. hafta: 125 TL
  3. hafta: 165 TL
  Kitaptan sonra: 135 TL
  Hedefe kalan: 65 TL
  ```
starter: |
  fn main() {
      // 1) `kumbara` adında, 0 ile başlayan değiştirilebilir bir değişken tanımla.
      // 2) Her işlemden sonra kumbaradaki parayı yazdır.
      // 3) Hedefe kalan miktarı yeni bir değişkenle hesaplayıp yazdır.
  }
solution: |
  fn main() {
      let mut kumbara = 0;

      kumbara = kumbara + 50;
      println!("1. hafta: {kumbara} TL");

      kumbara = kumbara + 75;
      println!("2. hafta: {kumbara} TL");

      kumbara = kumbara + 40;
      println!("3. hafta: {kumbara} TL");

      kumbara = kumbara - 30;
      println!("Kitaptan sonra: {kumbara} TL");

      let kalan = 200 - kumbara;
      println!("Hedefe kalan: {kalan} TL");
  }
check: output
expected_output: |
  1. hafta: 50 TL
  2. hafta: 125 TL
  3. hafta: 165 TL
  Kitaptan sonra: 135 TL
  Hedefe kalan: 65 TL
hints:
  - "Başlangıç satırı: `let mut kumbara = 0;`"
  - |
    Her hafta için iki satır yaz: önce `kumbara = kumbara + 50;`, sonra
    `println!("1. hafta: {kumbara} TL");`
  - |
    Son iki satır: `let kalan = 200 - kumbara;` ve `println!("Hedefe kalan: {kalan} TL");`
require:
  - pattern: "let\\s+mut\\s+kumbara\\b"
    message: "`kumbara` adında `mut` bir değişken tanımlamalısın."
  - pattern: "let\\s+(?!mut\\b)\\w+[^;]*-\\s*kumbara\\b"
    message: "Hedefe kalan miktarı `let kalan = 200 - kumbara;` gibi **yeni ve değişmez** bir değişkenle hesapla."
forbid:
  - pattern: "\\b(125|165|135|65)\\b"
    message: Ara toplamları elle yazma; hesaplamayı Rust'a bırak!
explanation: |
  `kumbara` zaman içinde gerçekten değişen bir değer, bu yüzden `mut` burada tam yerinde. `kalan` ise
  bir kez hesaplanıp kullanılıyor; `mut` gerekmez. Onu değişmez bırakmak, kodu okuyan birine "bu değer
  bir daha değişmeyecek" der.

  "Değeri al, üstüne ekle, geri yaz" işlemi o kadar yaygındır ki Rust'ta bir kısaltması var:
  `kumbara += 50;` Bu **bileşik atamayı (compound assignment)** Ders 4'te göreceksin.
````

## Özet

:::remember
- `let isim = değer;` bir değişken tanımlar; değişkenler varsayılan olarak **değişmezdir**.
- Değeri değişecekse `let mut isim = değer;` yaz, sonra `isim = yeni_deger;` ile güncelle.
- Değişmez bir değişkene tekrar atama → **E0384**; değer verilmemiş bir değişkeni okuma → **E0381**.
- Gereksiz `mut` bir uyarıdır. Değişmezliği tercih et, `mut`'u gerçekten değişen değerlere sakla.
- İsimler `snake_case` yazılır; kasıtlı olarak kullanılmayan değişkenin başına `_` konur.
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: Rust neden değişkenleri varsayılan olarak değişmez yapıyor? Bir
  değişkenin önünde `mut` görmek, kodu okuyan birine ne anlatır?
answer: |
  Model cevap: Değişmezlik varsayılan olduğunda bir değerin kazara değiştirilmesi derleme anında
  yakalanır (`E0384`). Kodu okurken `mut` olmayan bir değişkenin değerinin hiç değişmeyeceğini bilirim;
  bu da programı anlamayı kolaylaştırır. Ayrıca değişmez veriler birden çok thread tarafından güvenle
  okunabilir. Bir değişkenin önünde `mut` görmek ise "dikkat, bu değer ileride değişecek" demektir;
  okuyucunun dikkatini değişimin olduğu yerlere çeker.
```

```flashcards
- front: "`let x = 5;` ile tanımlanan `x`'e sonradan `x = 6;` atanabilir mi?"
  back: "Hayır. `let` ile tanımlanan değişkenler varsayılan olarak **değişmezdir**; `E0384` alırsın. `let mut x = 5;` gerekir."
- front: "`E0384` hata kodu ne anlama gelir?"
  back: "*cannot assign twice to immutable variable*: değişmez bir değişkene ikinci kez değer atanmaya çalışılıyor."
- front: Bir değişkenin `mut` olmaması, kodu okuyan birine ne garanti eder?
  back: "Değerinin kapsamı boyunca **hiç değişmeyeceğini**. Değişebilen her şey `mut` ile işaretlidir (tek istisna: Modül 17'deki iç değişkenlik tipleri)."
- front: Değişmezlik eşzamanlılığa (concurrency) nasıl yardım eder?
  back: Değişmez veriyi birden çok thread aynı anda güvenle okuyabilir; veri yarışı (data race) ancak biri yazarken oluşur.
- front: Hiç değiştirilmeyen bir değişkene `mut` yazarsan ne olur?
  back: "Program derlenir ama derleyici `variable does not need to be mutable` **uyarısı** verir."
- front: "`E0381` hatası ne zaman çıkar?"
  back: Değer verilmemiş (ilklendirilmemiş) bir değişken okunmaya çalışıldığında. Rust çöp değer okumana asla izin vermez.
- front: Rust'ta değişken isimleri hangi stilde yazılır? Bir örnek ver.
  back: "**snake_case**: küçük harf ve alt çizgi, örneğin `ogrenci_sayisi`."
- front: Kasıtlı olarak kullanmadığın bir değişkenin uyarısını nasıl susturursun?
  back: "Adının başına alt çizgi koyarak: `let _yedek = 5;`"
```
