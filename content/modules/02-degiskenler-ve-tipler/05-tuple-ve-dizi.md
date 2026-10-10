---
id: m02-l05
title: "Bileşik Tipler: Tuple ve Dizi"
minutes: 22
type: lesson
objectives:
  - Farklı tipteki değerleri bir tuple'da toplayıp `.0`, `.1` ve parçalara ayırma (destructuring) ile kullanabilmek
  - "`[T; N]` dizilerini oluşturup indeksleme, `.len()` ve `[0; N]` ile çalışabilmek"
  - Dizi sınırlarının dışına çıkıldığında derleme ve çalışma zamanında ne olduğunu açıklayabilmek
  - Bir problem için dizi, tuple ya da `Vec` arasında gerekçeli seçim yapabilmek
keywords: [tuple, dizi, array, destructuring, "()", birim tipi, indeks, len, out of bounds, Vec]
---

Şimdiye kadarki her değişken **tek** bir değer tutuyordu: bir sayı, bir `bool`, bir `char`. Ama gerçek
hayattaki veriler çoğu zaman gruplar hâlinde gelir. Bir haritadaki nokta iki sayıdır (enlem, boylam);
bir renk üç sayıdır (kırmızı, yeşil, mavi); bir haftanın sıcaklıkları yedi sayıdır.

Bu derste Rust'ın iki temel **bileşik tipini (compound type)** öğreneceksin: farklı tipleri bir arada
tutan **tuple** ve aynı tipten sabit sayıda değeri sıralayan **dizi (array)**.

## Tuple: farklı tipler bir arada

Bir **tuple**, birkaç değeri parantez içinde virgülle ayırarak tek bir değer hâline getirir. Değerlerin
tipleri **farklı olabilir**:

```rust
fn main() {
    let ogrenci: (&str, u8, f64) = ("Ayşe", 17, 92.5);
    let konum = (41.0082, 28.9784); // İstanbul'un enlemi ve boylamı
    println!("Ad: {}, yaş: {}, ortalama: {}", ogrenci.0, ogrenci.1, ogrenci.2);
    println!("Enlem: {}, boylam: {}", konum.0, konum.1);
    println!("Tamamı: {ogrenci:?}");
}
```

- Tuple'ın tipi, elemanlarının tiplerinden oluşur: `(&str, u8, f64)`. (`&str` metin tipidir; Ders 2'de
  gördün, Modül 5'te ayrıntısıyla gelecek.)
- Elemanlara **nokta ve sıra numarasıyla** erişirsin: `.0`, `.1`, `.2`. Numaralar **0'dan başlar**.
- Bir tuple'ı bütün olarak yazdırmak için `{}` değil **`{:?}`** (Modül 1) kullanırsın. `{}` ile
  denersen derleyici `doesn't implement std::fmt::Display` der ve `{:?}`'i önerir.

Tuple bellekte **tek bir blok** olarak durur; alanları bu bloğun içinde yer alır. (Derleyici, hizalama
için alanların bellekteki sırasını değiştirebilir ve aralarına boşluk (*padding*) koyabilir; bunu Modül
24'te göreceksin. Kodda ise sıra hep yazdığın gibidir: `.0`, `.1`, `.2`.)

```memory
title: Bir tuple bellekte
steps:
  - caption: "`ogrenci` tek bir değişken ama içinde üç ayrı alan var. Her alanın tipi farklı olabilir."
    stack:
      - frame: main
        vars:
          - { name: ogrenci.0, type: "&str", value: "\"Ayşe\"" }
          - { name: ogrenci.1, type: u8, value: "17" }
          - { name: ogrenci.2, type: f64, value: "92.5" }
```

Tuple değişkeni `mut` ise alanlarını tek tek değiştirebilirsin: `konum.0 = 39.9334;` Tuple'ın
**uzunluğu ve tipleri** ise sabittir; sonradan eleman ekleyemez, bir alanın tipini değiştiremezsin.
Bu program derlenir mi?

```compiles
code: |
  fn main() {
      let nokta = (3, 7);
      println!("{}", nokta.2);
  }
answer: false
error: E0609
explanation: |
  Derlenmez! `nokta`'nın yalnızca iki alanı var: `.0` ve `.1`. Sıra numaraları 0'dan başladığı için
  ikinci eleman `.1`'dir; `.2` diye bir alan yoktur:

  ```text
  error[E0609]: no field `2` on type `({integer}, {integer})`
   --> src/main.rs:3:22
    |
  3 |     println!("{}", nokta.2);
    |                      ^ unknown field
    |
    = note: available fields are: `0`, `1`
  ```

  Bu hata **derleme zamanında** yakalanır, çünkü tuple'ın kaç alanı olduğu tipinde yazılıdır.
```

```quiz
question: "`let t = (5, 'x', true);` satırındaki `t`'nin tipi nedir?"
options:
  - "`(i32, char, bool)`"
  - "`[i32; 3]`"
  - "`(i32, &str, bool)`"
  - "`tuple`"
answer: 0
explanation: |
  Tuple'ın tipi, elemanlarının tiplerinin parantez içinde sıralanmasıdır. `5` varsayılan olarak
  `i32`, `'x'` tek tırnaklı olduğu için `char`, `true` ise `bool`.
feedback:
  - Doğru!
  - "`[T; N]` bir **dizi** tipidir ve bütün elemanları aynı tipte olmalıdır. Burada üç farklı tip var."
  - "`'x'` tek tırnaklıdır, yani `char`. `&str` olması için `\"x\"` yazılmalıydı."
  - Rust'ta "tuple" diye tek bir tip yoktur. Her tuple'ın tipi elemanlarına göre belirlenir.
```

## Parçalara ayırma ve birim tipi

Tuple'ın alanlarına tek tek `.0`, `.1` diye erişmek, alan sayısı arttıkça okunmaz hâle gelir. Bunun
yerine tuple'ı **parçalara ayırabilirsin (destructuring)**:

```rust
fn main() {
    let ogrenci = ("Mehmet", 16, 88.0);
    let (ad, yas, ortalama) = ogrenci; // üç yeni değişken
    println!("{ad} {yas} yaşında, ortalaması {ortalama}.");

    let (_, _, sadece_ortalama) = ogrenci; // _ : "bu alanla ilgilenmiyorum"
    println!("Ortalama: {sadece_ortalama}");

    let (mut x, y) = (10, 20); // her değişken ayrı ayrı mut olabilir
    x += y;
    println!("x = {x}");
}
```

`let (ad, yas, ortalama) = ogrenci;` satırındaki sol taraf bir **desen (pattern)**: Rust sağdaki tuple'ı
bu kalıba oturtur ve her parçayı karşısındaki isme bağlar. Desenlerin çok daha güçlü hâllerini
Modül 7'de `match` ile göreceksin.

Ders 3'teki `overflowing_add`'i hatırlıyor musun? `(4, true)` gibi bir tuple döndürüyordu. Tuple,
bir hesaptan **birden fazla sonuç** almanın en kolay yoludur:

```rust
fn main() {
    let (sonuc, tasti) = 250_u8.overflowing_add(10);
    println!("Sonuç: {sonuc}, taştı mı? {tasti}");
}
```

Şimdi bir tahmin: bu program ne yazdırır?

```predict
code: |
  fn main() {
      let a = 1;
      let b = 2;
      let (a, b) = (b, a);
      let (x, _, z) = (a * 10, b * 10, a + b);
      println!("{a} {b} {x} {z}");
  }
options:
  - "2 1 20 3"
  - "1 2 10 3"
  - "2 1 20 10"
  - "2 2 20 4"
answer: 0
explanation: |
  `let (a, b) = (b, a);` önce sağ taraftaki tuple'ı **eski** değerlerle kurar: `(2, 1)`. Sonra bu tuple
  parçalanır ve yeni `a`, `b` değişkenleri eskilerini **gölgeler** (Ders 2). Sonuç: `a = 2`, `b = 1`.
  Böylece geçici bir değişken olmadan iki değeri **takas** etmiş olduk.

  İkinci satırda `x = 2 * 10 = 20`, ortadaki `b * 10` `_` ile atılır ve `z = 2 + 1 = 3`.
```

**Hiç elemanı olmayan tuple** de vardır: `()`. Ona **birim tipi (unit type)** denir ve "anlamlı bir
değer yok" demektir. Tek bir değeri vardır, o da yine `()`'dir. Bir sonuç döndürmeyen her şey aslında
`()` döndürür: `fn main()` de, `println!` de. Bir hata mesajında `expected (), found ...` gibi bir
ifade görürsen, "burada bir değer beklenmiyordu" diye oku. Bu tipi
Modül 3'te ifadeleri ve fonksiyonları incelerken sık sık göreceksin.

:::warning Tek elemanlı tuple
`(5)` bir tuple değil, parantez içindeki `5` sayısıdır (derleyici "gereksiz parantez" uyarısı verir).
Tek elemanlı bir tuple için sona **virgül** koyman gerekir: `(5,)`. Neredeyse hiç ihtiyacın olmaz, ama
bir gün karşına çıkarsa şaşırma.
:::

```fill
prompt: Bir sporcunun sonucu `(isim, puan)` tuple'ı olarak geliyor. Tuple'ı parçalara ayırıp isim ve puanı ayrı değişkenlere al.
code: |
  fn main() {
      let sonuc = ("Elif", 97);
      let ___0 = sonuc;
      println!("{isim}: {puan} puan");
  }
blanks:
  - ["(isim, puan)", "(isim,puan)"]
output: "Elif: 97 puan"
explanation: |
  Sol taraftaki `(isim, puan)` deseni, sağdaki `("Elif", 97)` tuple'ının şekliyle aynıdır. Rust ilk
  alanı `isim`'e, ikinciyi `puan`'a bağlar. Desendeki isim sayısı tuple'ın alan sayısıyla **aynı**
  olmalıdır; `let (isim, puan, yas) = sonuc;` yazsaydın `E0308` alırdın (3 isim, 2 alan).
```

## Diziler: aynı tipten sabit sayıda değer

Bir **dizi (array)**, **aynı tipteki** değerleri köşeli parantez içinde sıralar. Uzunluğu **sabittir**
ve tipinin bir parçasıdır: `[i32; 5]` "5 tane `i32`" demektir.

```rust
fn main() {
    let notlar: [u32; 5] = [85, 92, 78, 64, 99];
    let gunler = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    let sifirlar = [0; 4]; // [0, 0, 0, 0]: dört tane 0
    let mut skorlar = [0_u32; 3]; // başlangıçta hepsi 0

    println!("İlk not: {}, son not: {}", notlar[0], notlar[4]);
    println!("Haftada {} gün var, üçüncüsü {}.", gunler.len(), gunler[2]);
    skorlar[1] = 50; // mut dizide eleman değiştirmek
    println!("{sifirlar:?} {skorlar:?}");
}
```

- **İndeksleme (indexing):** `notlar[0]` ilk eleman, `notlar[4]` beşinci (son) elemandır. İndeksler
  **0'dan başlar**, son indeks `uzunluk - 1`'dir.
- **`.len()`** dizinin eleman sayısını (`usize`, Ders 3) verir.
- **`[deger; N]`** N tane aynı değerle dolu bir dizi oluşturur. Büyük dizileri sıfırlamanın en kolay yolu.
- Eleman değiştirmek için dizi **`mut`** olmalıdır.

Dizinin elemanları bellekte **art arda**, boşluksuz dizilir. Bu yüzden `notlar[3]`'ün yeri tek bir
hesapla bulunur: *başlangıç adresi + 3 × 4 bayt*. Dizi ne kadar büyük olursa olsun, her elemana erişim
aynı hızdadır.

```memory
title: "[u32; 5] dizisi bellekte"
steps:
  - caption: "Beş `u32` değeri stack'te yan yana duruyor; her biri 4 bayt, toplam 20 bayt. Köşeli parantezdeki sayı indekstir."
    stack:
      - frame: main
        vars:
          - { name: "notlar[0]", type: u32, value: "85", note: "+0 bayt" }
          - { name: "notlar[1]", type: u32, value: "92", note: "+4 bayt" }
          - { name: "notlar[2]", type: u32, value: "78", note: "+8 bayt" }
          - { name: "notlar[3]", type: u32, value: "64", note: "+12 bayt" }
          - { name: "notlar[4]", type: u32, value: "99", note: "+16 bayt" }
```

:::analogy Apartman daireleri
Bir dizi, daireleri aynı büyüklükte ve **zemin kattan (0) başlayarak** numaralandırılmış bir apartman
gibidir. Apartmanın kaç katlı olduğu inşaatta belli olur, sonradan kat çıkılamaz. Kapıcı 3 numaralı
daireyi aramaz; "zemin kattan 3 kat yukarı" der ve doğrudan oraya gider. 7 katlı bir apartmanda
8. kata çıkmaya çalışan bir ziyaretçiyi ise kapıda durdurur.
:::

Uzunluk tipin bir parçası olduğu için `[i32; 3]` ile `[i32; 4]` **farklı tiplerdir**.
`let a: [i32; 3] = [1, 2, 3, 4];` yazarsan derleyici
`expected an array with a size of 3, found one with a size of 4` der.

Diğer dillerle karşılaştır: Python'un listesi ve JavaScript'in dizisi büyüyüp küçülebilir ve farklı
tipleri karıştırabilir; esnektir ama her eleman için ek bellek ve kontrol gerekir. C'nin dizileri
Rust'ınkilere benzer, ama C dizi sınırlarını **hiç kontrol etmez**. Bunun neden önemli olduğunu bir
sonraki adımda göreceksin.

Şimdi bir dizinin ilk ve son elemanını kullanarak hafta sonu sıcaklık farkını bulan programı kur:

```parsons
prompt: Satırları sıraya koy. Program haftanın sıcaklıklarından cumartesi (indeks 5) ile pazar (indeks 6) arasındaki farkı yazdırsın.
lines: |
  fn main() {
      let sicakliklar = [18, 21, 19, 23, 25, 27, 22];
      let cumartesi = sicakliklar[5];
      let pazar = sicakliklar[6];
      let fark = cumartesi - pazar;
      println!("Hafta sonu farkı: {fark} derece");
  }
distractors: |
      let pazar = sicakliklar[7];
      let sicakliklar = [18, 21, 19, 23, 25, 27, 22.0];
explanation: |
  Yedi günlük dizinin indeksleri 0'dan 6'ya kadardır: cumartesi 5, pazar 6. `sicakliklar[7]` dizinin
  dışına çıkar. `22.0` ise dizinin bütün elemanlarının aynı tipte olması kuralını bozar: tamsayıların
  arasına ondalıklı bir sayı giremez.
```

## Dizinin sınırlarını aşmak

7 elemanlı bir dizide `gunler[7]` yazarsan ne olur? Önce derleyiciye soralım:

````compiles
code: |
  fn main() {
      let gunler = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
      println!("{}", gunler[7]);
  }
answer: false
explanation: |
  Derlenmez! Dizinin uzunluğu da indeks de derleme anında belli olduğu için derleyici programın
  çalışınca **kesinlikle** çökeceğini görüyor:

  ```text
  error: this operation will panic at runtime
   --> src/main.rs:3:20
    |
  3 |     println!("{}", gunler[7]);
    |                    ^^^^^^^^^ index out of bounds: the length is 7 but the index is 7
    |
    = note: `#[deny(unconditional_panic)]` on by default
  ```

  Bu, Ders 3'teki "this arithmetic operation will overflow" hatasının kardeşidir.
````

Ama indeks çoğu zaman program çalışırken belli olur; örneğin kullanıcı bir gün numarası yazar. Aşağıdaki
örnekte kullanıcının yazdığı metni (`"8"`) Ders 2'deki gibi `.parse().unwrap()` ile sayıya çeviriyoruz
(bir sonraki derste ayrıntılı göreceksin):

```rust,should_panic
fn main() {
    let gunler = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    let kullanici_girdisi = "8"; // kullanıcı 8. günü istedi
    let gun_no: usize = kullanici_girdisi.parse().unwrap();
    println!("İstenen gün: {}", gunler[gun_no - 1]);
}
```

:::error Panik!
```text
thread 'main' (13) panicked at src/main.rs:5:33:
index out of bounds: the len is 7 but the index is 7
```
Rust her indekslemede indeksin `len`'den küçük olup olmadığını **kontrol eder**. Değilse belleğe asla
dokunmaz; programı panikle durdurur ve neyin yanlış gittiğini (uzunluk 7, indeks 7) söyler.
:::

Bu kontrol neden bu kadar önemli? C dizi sınırlarını kontrol etmez: `gunler[7]` C'de dizinin hemen
arkasındaki bellekte ne varsa onu okur, belki bir şifreyi, belki başka bir değişkeni. Sınırın dışına
yazmaya **arabellek taşması (buffer overflow)**, dışından okumaya *buffer over-read* denir; tarihin en
büyük güvenlik açıklarının çoğu bu iki hatadan çıkmıştır. 2014'teki **Heartbleed** açığında,
sunucular kendisinden istenen uzunluğu kontrol etmeden bellek okuduğu için dünya çapında yüz binlerce
sunucunun belleğinden şifreler ve gizli anahtarlar sızabilir hâle geldi. Rust'ta güvenli kodda bu hata türü **imkânsızdır**: en kötü ihtimalle program
durur, ama asla yanlış belleği okumaz.

:::info Kontrolün maliyeti
Her indekslemede yapılan karşılaştırma çok ucuzdur ve derleyici, indeksin her zaman geçerli olduğunu
kanıtlayabildiği yerlerde (örneğin Modül 3'te göreceğin `for` döngülerinde) kontrolü tamamen kaldırır.
Panik yerine "eleman yoksa bana haber ver" diyen `.get(i)` metodunu da Modül 9'da göreceksin.
:::

İndeksin tipi de önemlidir. İndeks her zaman **`usize`** olmalıdır:

```quiz
question: |
  `let notlar = [85, 92, 78];` ve `let i: i32 = 1;` tanımlı. `notlar[i]` yazarsan ne olur?
options:
  - "`92` döner"
  - "Derlenmez: diziler yalnızca `usize` ile indekslenebilir"
  - Çalışma zamanında panik olur
  - "`85` döner, çünkü sayma 1'den başlar"
answer: 1
explanation: |
  İndeksler `usize`'dır, çünkü bir indeks bellekte bir konumu ifade eder ve negatif olamaz. Derleyici
  `the type [{integer}] cannot be indexed by i32` der. Çözüm, `i`'yi baştan `usize` tanımlamak ya da
  `notlar[i as usize]` yazmaktır (Ders 4).
feedback:
  - "Rust farklı tamsayı tiplerini kendiliğinden dönüştürmez; `i32` ile indeksleme yapılamaz."
  - Doğru! Bu bir **tip** hatası, derleme zamanında yakalanır.
  - Sorun değerde değil tipte; bu yüzden program çalışmadan yakalanır.
  - İndeksler 0'dan başlar; ayrıca `i32` ile indeksleme zaten derlenmez.
```

## Dizi mi, Vec mi?

Dizinin uzunluğu sabittir. Peki bir alışveriş sepeti gibi **büyüyüp küçülen** bir listeye ihtiyacın
varsa? O zaman Rust'ın **`Vec`** (vektör) tipini kullanırsın. Ayrıntıları Modül 4 ve 9'da göreceksin;
şimdilik küçük bir önizleme:

```rust
fn main() {
    let aylar = ["Ocak", "Şubat", "Mart"]; // dizi: uzunluk hep 3
    let mut sepet = vec!["elma", "ekmek"]; // Vec: büyüyebilir
    sepet.push("peynir"); // sona ekle
    println!("{aylar:?} ({} ay)", aylar.len());
    println!("{sepet:?} ({} ürün)", sepet.len());
}
```

| | Dizi `[T; N]` | `Vec<T>` |
|---|---|---|
| Uzunluk | derleme zamanında sabit | çalışırken değişebilir |
| Nerede durur? | stack'te (Modül 4) | elemanlar heap'te (Modül 4) |
| Ne zaman? | eleman sayısı **kesin** belliyse: haftanın günleri, aylar, RGB, satranç tahtası | eleman sayısı değişiyorsa: sepet, mesajlar, kullanıcı listesi |

Kararsızsan çoğu zaman `Vec` doğru seçimdir. Ama sayı gerçekten sabitse dizi hem daha hızlıdır hem de
"bu her zaman 7 tanedir" bilgisini tipe yazar.

Dizilerin bir özelliği daha var. Tahmin et:

```predict
code: |
  fn main() {
      let orijinal = [1, 2, 3];
      let mut kopya = orijinal;
      kopya[0] = 100;
      println!("{orijinal:?} {kopya:?}");
  }
options:
  - "[1, 2, 3] [100, 2, 3]"
  - "[100, 2, 3] [100, 2, 3]"
  - "[1, 2, 3] [1, 2, 3]"
answer: 0
explanation: |
  `let mut kopya = orijinal;` dizinin **bütün elemanlarını kopyalar**: bellekte birbirinden bağımsız
  iki dizi olur. `kopya`'yı değiştirmek `orijinal`'e dokunmaz.

  Python veya JavaScript'ten geliyorsan ikinci seçeneği beklemiş olabilirsin: o dillerde atama aynı
  listeyi paylaşır. Rust'ta ise elemanları tamsayı, `bool`, `char` gibi basit değerler olan bir dizi
  atamada **bütünüyle kopyalanır**; dizi ne kadar büyükse kopya da o kadar büyüktür (bir milyon
  elemanlı bir dizi, bir milyon elemanı kopyalar). `Vec` ve `String` gibi tiplerde ise bambaşka bir
  şey olur: **taşıma (move)**. Bu, Rust'ın en önemli fikrinin, sahipliğin (Modül 4) giriş kapısıdır.
```

Diziler iç içe de olabilir: `[[0; 3]; 3]` 3×3'lük bir tahta (örneğin XOX oyunu) oluşturur ve
`tahta[1][2]` ikinci satırın üçüncü elemanıdır. İki dizi ya da iki tuple `==` ile karşılaştırılabilir:
`[1, 2, 3] == [1, 2, 3]` sonucu `true`'dur.

:::ferris
Tuple'lar ve diziler basit görünür ama Rust'ın büyük fikirlerini şimdiden taşıyor: boyutu tipe yazmak,
sınırları kontrol etmek, kopyalama ile taşımayı ayırmak. Sonraki modüllerde bu tohumların nasıl büyüdüğünü
göreceksin! 🦀
:::

## Alıştırmalar

İlk alıştırmada tuple'larla, ikincisinde dizilerle çalışacaksın. İkisinde de Ders 3 ve 4'te
öğrendiğin taşma ve `as` bilgisine ihtiyacın olacak.

````exercise
id: m02-e-renk-karistir
title: Dijital boya dükkânı
difficulty: 2
prompt: |
  Bir boya dükkânının uygulaması iki rengi **eşit oranda** karıştırıyor. Renkler `(kırmızı, yeşil, mavi)`
  tuple'ı olarak geliyor; her kanal `u8` (0-255).

  `karistir(renk1, renk2)` fonksiyonunu tamamla: her kanal için iki değerin **ortalamasını** (aşağı
  yuvarlayarak, yani tamsayı bölmesiyle) hesaplayıp yeni rengi döndürsün.

  - `karistir((255, 0, 0), (0, 0, 255))` → `(127, 0, 127)` (kırmızı + mavi = mor)
  - `karistir((255, 255, 255), (255, 255, 255))` → `(255, 255, 255)`

  Dikkat: iki `u8`'in toplamı 255'i aşabilir!
starter: |
  fn karistir(renk1: (u8, u8, u8), renk2: (u8, u8, u8)) -> (u8, u8, u8) {
      todo!()
  }

  fn main() {
      let mor = karistir((255, 0, 0), (0, 0, 255));
      println!("Mor: {mor:?}");
  }
solution: |
  fn karistir(renk1: (u8, u8, u8), renk2: (u8, u8, u8)) -> (u8, u8, u8) {
      let (r1, g1, b1) = renk1;
      let (r2, g2, b2) = renk2;
      let r = (r1 as u16 + r2 as u16) / 2;
      let g = (g1 as u16 + g2 as u16) / 2;
      let b = (b1 as u16 + b2 as u16) / 2;
      (r as u8, g as u8, b as u8)
  }

  fn main() {
      let mor = karistir((255, 0, 0), (0, 0, 255));
      println!("Mor: {mor:?}");
  }
check: tests
tests: |
  #[test]
  fn kirmizi_ve_mavi_mor_yapar() {
      assert_eq!(karistir((255, 0, 0), (0, 0, 255)), (127, 0, 127), "kırmızı + mavi: (127, 0, 127) olmalı");
  }

  #[test]
  fn her_kanal_ayri_hesaplanir() {
      assert_eq!(karistir((200, 100, 50), (100, 200, 250)), (150, 150, 150), "her kanal kendi ortalamasını almalı");
      assert_eq!(karistir((0, 0, 0), (1, 3, 5)), (0, 1, 2), "ortalama aşağı yuvarlanmalı: 1/2=0, 3/2=1, 5/2=2");
  }

  #[test]
  fn beyaz_ile_beyaz_tasmaz() {
      assert_eq!(karistir((255, 255, 255), (255, 255, 255)), (255, 255, 255), "255 + 255 bir u8'e sığmaz; toplamı daha geniş bir tipte yap");
      assert_eq!(karistir((250, 240, 230), (240, 250, 220)), (245, 245, 225), "büyük değerlerde de taşma olmamalı");
  }
hints:
  - "Önce iki tuple'ı parçalara ayır: `let (r1, g1, b1) = renk1;` Aynısını `renk2` için yap."
  - "`(r1 + r2) / 2` mantıken doğru ama `255 + 255` bir `u8`'e sığmaz ve panik olur. Toplamadan önce değerleri `as u16` ile daha geniş bir tipe çevir."
  - "Bir kanal: `let r = (r1 as u16 + r2 as u16) / 2;` Sonunda `(r as u8, g as u8, b as u8)` döndür; ortalama hiçbir zaman 255'i geçmediği için bu dönüşüm güvenli."
explanation: |
  İki `u8`'in toplamı en fazla 510 olabilir, `u8` ise 255'te biter. Bu yüzden toplamı **daha geniş**
  bir tipte (`u16`, en fazla 65535) yapıp sonra 2'ye bölüyoruz. Ortalama hiçbir zaman 255'i geçemez,
  yani son adımdaki `as u8` hiçbir bilgi kaybetmez. "Geniş tipte hesapla, sonucu dar tipe güvenle geri
  çevir" çok sık kullanılan bir kalıptır.

  **Alternatifler:** `r1 / 2 + r2 / 2 + (r1 % 2 + r2 % 2) / 2` ifadesi `u8` içinde kalarak aynı sonucu
  verir, ama okunması zordur. Daha az zekice, daha çok açık kod çoğu zaman daha iyidir. Güncel Rust'ta
  standart kütüphane bu işi hazır da sunar: `r1.midpoint(r2)` iki sayının ortalamasını taşmadan ve
  aşağı yuvarlayarak hesaplar. Bir işi elle yazmadan önce standart kütüphaneye bakmak iyi bir
  alışkanlıktır.

  Parçalara ayırmak şart değildi; `renk1.0`, `renk2.0` diye de yazabilirdin. Ama `r1`, `g1` gibi isimler
  kodu çok daha okunur yapıyor.
````

Şimdi diziler. Bu alıştırmada indeks hesabı yapacaksın; bir sınırın dışına çıkmamaya dikkat et.

````exercise
id: m02-e-ceyrek-raporu
title: Kırtasiyenin çeyrek raporu
difficulty: 3
prompt: |
  Bir kırtasiye, yılın 12 ayındaki satış adetlerini bir dizide tutuyor: indeks 0 Ocak, indeks 11 Aralık.
  İki fonksiyonu tamamla:

  - `ceyrek_toplami(satislar, ceyrek)`: `ceyrek` 1, 2, 3 veya 4'tür. 1. çeyrek Ocak-Şubat-Mart,
    2. çeyrek Nisan-Mayıs-Haziran... O çeyreğin üç ayının toplamını döndür.
  - `yil_farki(satislar)`: Aralık satışlarından Ocak satışlarını çıkar. Satışlar düşmüşse sonuç
    **negatif** olabilir; bu yüzden dönüş tipi `i64`.

  Çeyrek numarası 1'den, dizi indeksleri 0'dan başlıyor. İndeks hesabını `ceyrek`'ten yap; dört
  çeyrek için ayrı ayrı kod yazma (döngüleri ve koşulları henüz öğrenmedik, onlara da gerek yok).
starter: |
  fn ceyrek_toplami(satislar: [u32; 12], ceyrek: usize) -> u32 {
      todo!()
  }

  fn yil_farki(satislar: [u32; 12]) -> i64 {
      todo!()
  }

  fn main() {
      let satislar = [120, 95, 140, 160, 180, 210, 90, 85, 300, 250, 170, 220];
      println!("3. çeyrek: {}", ceyrek_toplami(satislar, 3));
      println!("Yıl farkı: {}", yil_farki(satislar));
  }
solution: |
  fn ceyrek_toplami(satislar: [u32; 12], ceyrek: usize) -> u32 {
      let ilk_ay = (ceyrek - 1) * 3;
      satislar[ilk_ay] + satislar[ilk_ay + 1] + satislar[ilk_ay + 2]
  }

  fn yil_farki(satislar: [u32; 12]) -> i64 {
      satislar[11] as i64 - satislar[0] as i64
  }

  fn main() {
      let satislar = [120, 95, 140, 160, 180, 210, 90, 85, 300, 250, 170, 220];
      println!("3. çeyrek: {}", ceyrek_toplami(satislar, 3));
      println!("Yıl farkı: {}", yil_farki(satislar));
  }
check: tests
tests: |
  const SATISLAR: [u32; 12] = [120, 95, 140, 160, 180, 210, 90, 85, 300, 250, 170, 220];

  #[test]
  fn ilk_ve_son_ceyrek() {
      assert_eq!(ceyrek_toplami(SATISLAR, 1), 355, "1. çeyrek = Ocak + Şubat + Mart = 120 + 95 + 140");
      assert_eq!(ceyrek_toplami(SATISLAR, 4), 640, "4. çeyrek = Ekim + Kasım + Aralık = 250 + 170 + 220");
  }

  #[test]
  fn ara_ceyrekler() {
      assert_eq!(ceyrek_toplami(SATISLAR, 2), 550, "2. çeyrek = Nisan + Mayıs + Haziran = 160 + 180 + 210");
      assert_eq!(ceyrek_toplami(SATISLAR, 3), 475, "3. çeyrek = Temmuz + Ağustos + Eylül = 90 + 85 + 300");
      let sirali = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      assert_eq!(ceyrek_toplami(sirali, 3), 24, "[1..12] dizisinde 3. çeyrek 7 + 8 + 9 = 24 olmalı");
  }

  #[test]
  fn yil_farki_artis_ve_dusus() {
      assert_eq!(yil_farki(SATISLAR), 100, "Aralık 220 - Ocak 120 = 100");
      let dusus = [500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 300];
      assert_eq!(yil_farki(dusus), -200, "satış düştüyse fark negatif olmalı: 300 - 500 = -200");
  }

  #[test]
  #[should_panic]
  fn gecersiz_ceyrek_panik_yapar() {
      ceyrek_toplami(SATISLAR, 5);
  }
hints:
  - "Bir çeyreğin ilk ayının indeksi: 1. çeyrek → 0, 2. çeyrek → 3, 3. çeyrek → 6, 4. çeyrek → 9. Bu sayılarla `ceyrek` arasındaki ilişki nedir?"
  - "İlk ayın indeksi `(ceyrek - 1) * 3`. Toplam: `satislar[ilk_ay] + satislar[ilk_ay + 1] + satislar[ilk_ay + 2]`."
  - "`yil_farki` için `u32` çıkarması negatif sonuçta taşar. İki değeri de önce `as i64` ile çevir: `satislar[11] as i64 - satislar[0] as i64`."
explanation: |
  **Bire dayalı sayıdan sıfıra dayalı indekse geçiş**, programlamanın en klasik hata kaynağıdır
  (*off-by-one*). `(ceyrek - 1) * 3` formülü önce çeyreği 0'dan başlatır, sonra her çeyrek 3 ay
  olduğu için 3 ile çarpar. Geçersiz bir çeyrek (5) gelirse indeks 12 olur ve Rust panikle durur;
  yanlış bir toplam döndürmektense durmak çok daha güvenlidir. Son test tam olarak bunu kontrol ediyor.
  Geçersiz girdiyi panik yerine nazikçe reddetmeyi Modül 10'da öğreneceksin.

  `yil_farki`'nda `satislar[11] - satislar[0]` yazsaydın, `u32` negatif olamayacağı için düşüş
  durumunda `attempt to subtract with overflow` paniği alırdın. Önce `i64`'e çevirmek (kayıpsız bir
  genişletme) sorunu çözer.

  Fonksiyon dizinin **kopyasını** alıyor (`satislar: [u32; 12]`). 12 sayı için bu sorun değil; büyük
  verilerde kopyalamak yerine **ödünç vermeyi** (`&[u32]`) Modül 5'te göreceksin.
````

## Özet

:::remember
- **Tuple** `(a, b, c)`: farklı tipler, sabit uzunluk. Erişim `.0`, `.1`...; parçalara ayırma
  `let (x, y) = t;`; atlamak için `_`. Yazdırmak için `{:?}`.
- **Birim tipi** `()`: boş tuple, "anlamlı bir değer yok". Değer döndürmeyen her şey `()` döndürür.
- **Dizi** `[T; N]`: aynı tip, sabit uzunluk (uzunluk tipin parçası), elemanlar bellekte art arda.
  `[0; 5]` ile doldur, `a[i]` ile eriş (`i: usize`, 0'dan başlar), `.len()` ile say.
- Sınır dışı indeks: derleyici görebiliyorsa **derleme hatası**, göremiyorsa **panik**. Rust asla yanlış
  belleği okumaz.
- Eleman sayısı kesin belliyse dizi, değişiyorsa `Vec` (`vec![...]`, `.push()`).
- Tamsayı dizisini atamak onu **kopyalar**; iki dizi birbirinden bağımsızdır.
:::

```reflect
prompt: |
  C dizi sınırlarını kontrol etmezken Rust her indekslemede kontrol eder. Bu kontrol programı biraz
  yavaşlatabilir. Rust'ın bu tercihi neden mantıklı? Panik yapmak, yanlış bir değerle devam etmekten
  neden daha iyidir?
answer: |
  Model cevap: Sınır kontrolü olmayan bir dil, dizinin dışındaki belleği sessizce okur ya da üzerine
  yazar. Bu hem yanlış sonuçlara hem de Heartbleed gibi ciddi güvenlik açıklarına yol açar. Rust'ın
  kontrolü çok ucuz bir karşılaştırmadır ve derleyici güvenli olduğunu kanıtlayabildiği yerlerde onu
  kaldırır. Panik yapmak programı durdurur ama hatayı hemen, tam yeriyle (uzunluk ve indeks) gösterir.
  Yanlış bir değerle devam etmek ise hatayı gizler; sonuçlar çok sonra, alakasız bir yerde bozulur ve
  hatayı bulmak çok zorlaşır.
```

```flashcards
- front: "`let t = (5, 'x', true);` satırında `'x'` değerine nasıl erişirsin?"
  back: "`t.1` (tuple alanları 0'dan numaralanır)."
- front: "`let (a, _, c) = (1, 2, 3);` satırında `_` ne işe yarar?"
  back: Ortadaki değeri atlar; "bu alanla ilgilenmiyorum" demektir. Sonuç `a = 1`, `c = 3`.
- front: Birim tipi (unit type) nedir?
  back: "Boş tuple `()`. \"Anlamlı bir değer yok\" demektir; değer döndürmeyen her şey `()` döndürür."
- front: "`[0; 5]` ifadesi ne oluşturur?"
  back: "Beş elemanı da `0` olan bir dizi: `[0, 0, 0, 0, 0]` (tipi `[i32; 5]`)."
- front: "`[i32; 3]` ile `[i32; 4]` aynı tip midir?"
  back: Hayır. Dizinin uzunluğu tipinin parçasıdır; ikisi farklı tiplerdir.
- front: "7 elemanlı bir dizide `a[7]` indeksi çalışma zamanında hesaplanırsa ne olur?"
  back: "Program panik yapar: `index out of bounds: the len is 7 but the index is 7`. Rust dizinin dışındaki belleği asla okumaz."
- front: Dizileri hangi tamsayı tipiyle indekslersin?
  back: "`usize`. Başka bir tiple (`i32` gibi) indeksleme derlenmez."
- front: Ne zaman dizi yerine `Vec` seçersin?
  back: "Eleman sayısı çalışırken değişecekse (sepet, mesaj listesi). Sayı kesin ve sabitse dizi."
```
