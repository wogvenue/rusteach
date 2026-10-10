---
id: m06-l06
title: "Proje: Kütüphane envanteri"
minutes: 35
type: project
objectives:
  - Dağınık değişkenlerle yazılmış bir programı struct'lara ve metotlara dönüştürebilmek (refactoring)
  - Bir `Vec<Kitap>`'i sahiplenen bir `Kutuphane` tipi tasarlayıp her metot için doğru alıcıyı (`&self`, `&mut self`) seçebilmek
  - "`ekle`, `odunc_ver`, `iade_et`, `kaldir` ve `listele` metotlarını yazıp testlerle doğrulayabilmek"
  - Döngü içinde `self`'i ödünç alırken çıkan `E0499` ve `E0502` hatalarını açıklayıp düzeltebilmek
keywords: [proje, kütüphane, struct, impl, metot, Vec, refactoring, iter_mut, E0382, E0499, E0502]
---

Mahallenin halk kütüphanesi, kitaplarını hâlâ bir defterde takip ediyor. Görevli Nesrin Hanım senden küçük
bir program istiyor: kitap eklesin, ödünç verip geri alsın, rafta ne kaldığını listelesin. Bu modülde
öğrendiğin her şeyi, yani struct'ları, `#[derive(Debug)]`'ı, metotları ve kurucuları, ilk kez **tek bir
gerçek programda** bir araya getireceksin.

Bu bir **proje dersi**. Programı adım adım büyüteceğiz. Her yeni metodu önce bir örnekte göreceksin, sonra
kendin yazıp testlerle doğrulayacaksın.

:::ferris
Bu derste yazacağın kod küçük bir oyuncak değil. Gerçek uygulamalardaki "model katmanı" tam olarak böyle
başlar: birkaç iyi tasarlanmış tip ve onların davranışı. Kollarını sıva! 🦀
:::

## Başlangıç noktası: dağınık değişkenler

Struct'ları bilmeyen biri bu programı nasıl yazardı? Muhtemelen her bilgi için ayrı bir vektör tutardı:
başlıklar bir vektörde, yazarlar bir başka vektörde, ödünç durumu bir üçüncüsünde. Aynı kitabın bilgileri
aynı **indekste** durur.

```rust
fn main() {
    let basliklar = vec![
        String::from("Tutunamayanlar"),
        String::from("Kürk Mantolu Madonna"),
    ];
    let yazarlar = vec![String::from("Oğuz Atay"), String::from("Sabahattin Ali")];
    let mut oduncte = vec![false, false];

    oduncte[1] = true; // 1 numaralı kitabı ödünç verdik

    for i in 0..basliklar.len() {
        println!("{} — {} (ödünçte: {})", basliklar[i], yazarlar[i], oduncte[i]);
    }
}
```

Çalışıyor. Ama bu yapının bir sırrı var: üç vektör arasındaki bağı **yalnızca senin kafan** biliyor.
Derleyici `basliklar[1]` ile `yazarlar[1]`'in aynı kitaba ait olduğundan habersiz. Nesrin Hanım "Kitapları
başlığa göre sıralayalım" deyince ne olacak? Modül 5'te gördüğün `sort` metodu bir dilimi yerinde sıralar.
Tahmin et:

```predict
code: |
  fn main() {
      let mut basliklar = vec![
          String::from("Tutunamayanlar"),
          String::from("Kürk Mantolu Madonna"),
          String::from("Beyaz Kale"),
      ];
      let yazarlar = vec![
          String::from("Oğuz Atay"),
          String::from("Sabahattin Ali"),
          String::from("Orhan Pamuk"),
      ];

      basliklar.sort();

      for i in 0..basliklar.len() {
          println!("{} — {}", basliklar[i], yazarlar[i]);
      }
  }
options:
  - |
    Beyaz Kale — Orhan Pamuk
    Kürk Mantolu Madonna — Sabahattin Ali
    Tutunamayanlar — Oğuz Atay
  - |
    Beyaz Kale — Oğuz Atay
    Kürk Mantolu Madonna — Sabahattin Ali
    Tutunamayanlar — Orhan Pamuk
  - |
    Tutunamayanlar — Oğuz Atay
    Kürk Mantolu Madonna — Sabahattin Ali
    Beyaz Kale — Orhan Pamuk
  - "Derlenmez: `yazarlar` da sıralanmalı"
answer: 1
explanation: |
  `basliklar.sort()` **yalnızca** başlık vektörünü sıralar; `yazarlar` olduğu gibi kalır. Artık 0.
  indekste "Beyaz Kale" var ama 0. yazar hâlâ "Oğuz Atay". Program hatasız derlenir, çalışır ve **yanlış
  sonuç** üretir. Ortadaki satırın doğru çıkması sadece şans: "Kürk Mantolu Madonna" sıralamada da 1.
  indekste kaldı. En tehlikeli hatalar böyledir: derleyici de program da sessiz kalır.
```

Bu yapıda her işlem üç vektörü **birlikte** güncellemeyi gerektirir: yeni kitap eklerken üçüne de `push`,
silerken üçünden de silme, sıralarken üçünü birden aynı biçimde yer değiştirme. Bir tanesini unutursan
ya sessizce yanlış veri ya da `index out of bounds` paniği alırsın. Bu desenin bir adı bile var: **paralel
diziler (parallel arrays)**. C'de struct'lar yaygınlaşmadan önce çok kullanılırdı ve hata kaynağı olmasıyla
ünlüdür.

:::analogy Üç defter mi, bir kartoteks mi?
Eski kütüphanelerde her kitabın bir **katalog kartı** vardı: başlık, yazar, raf numarası ve ödünç
durumu aynı kartın üzerinde yazardı. Kartları istediğin gibi sıralayabilir, birini çekmeceden çıkarabilir,
yenisini ekleyebilirdin. Bilgiler hep birlikte hareket ederdi. Paralel vektörler ise **üç ayrı deftere**
benzer: birinde başlıklar, birinde yazarlar, birinde ödünç durumu. Sadece bir defterin sayfalarını yeniden
sıralarsan bütün kütüphane birbirine girer. **Struct, katalog kartıdır.**
:::

Çözüm belli: bir kitabın bilgilerini tek bir tipte toplamak. Yeniden düzenleme (refactoring) sırası şöyle
olacak:

1. Birlikte hareket eden verileri bul → `Kitap` struct'ı.
2. Kitapların listesini ve kütüphanenin kendi bilgisini topla → `Kutuphane` struct'ı.
3. Defterde elle yapılan her işlemi bir **metoda** dönüştür → `ekle`, `odunc_ver`, `iade_et`, `listele`.

## Kitap tipini tasarlamak

Bir kitap için hangi alanlar gerekli ve tipleri ne olmalı? Her kararın bir gerekçesi var:

| Alan | Tip | Neden? |
|---|---|---|
| `kod` | `u32` | Her kitabın kütüphanedeki benzersiz numarası. Sayı karşılaştırmak ucuz ve `u32` `Copy`. |
| `baslik` | `String` | Metin; struct verisinin **sahibi** olmalı (Ders 1: `&str` alan yaşam süresi ister). |
| `yazar` | `String` | Aynı gerekçe. |
| `oduncte` | `bool` | Kitap ya raftadır ya ödünçte. |
| `okunma_sayisi` | `u32` | Kaç kez ödünç verildi; istatistikler için. |

Neden başlığı kitabı bulmak için kullanmıyoruz? Çünkü aynı başlıktan iki nüsha olabilir ve başlıkta küçük
bir yazım farkı ("Kürk Mantolu Madonna" ile "Kürk mantolu Madonna") aramayı bozar. Gerçek kütüphaneler de
her nüshaya ayrı bir **demirbaş numarası** verir.

Yeni bir kitap kütüphaneye her zaman **rafta** ve **hiç okunmamış** olarak girer. Bu kuralı her çağıranın
hatırlamasını beklemek yerine, Ders 5'teki gibi bir **kurucuya** emanet ederiz:

```rust
# #![allow(dead_code)]
#[derive(Debug)]
struct Kitap {
    kod: u32,
    baslik: String,
    yazar: String,
    oduncte: bool,
    okunma_sayisi: u32,
}

impl Kitap {
    fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
        Self {
            kod,
            baslik: String::from(baslik),
            yazar: String::from(yazar),
            oduncte: false,
            okunma_sayisi: 0,
        }
    }
}

fn main() {
    let kitap = Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali");
    println!("{kitap:#?}");
}
```

Bu küçük kod bloğunda modülün yarısı var: `#[derive(Debug)]` ve `{:#?}` (Ders 3), `Self` ve `new`
geleneği (Ders 5), `kod` için alan başlatma kısaltması (Ders 1). Kurucu `&str` alıyor, böylece çağıran
literal'leri doğrudan verebiliyor; içeride `String::from` ile kitabın **kendi** kopyası oluşuyor.

```quiz
question: |
  Bir arkadaşın `baslik` alanını `baslik: &str` olarak tanımlamayı öneriyor: "Literal'ler zaten `&str`,
  `String::from` yazmaktan kurtuluruz." Bu öneri şu an neden derlenmez?
options:
  - "Struct alanında referans tutmak bir yaşam süresi (lifetime) parametresi gerektirir; derleyici `E0106` verir"
  - "`&str` bir `Copy` tip olmadığı için struct alanı olamaz"
  - "`#[derive(Debug)]` referans içeren alanları yazdıramaz"
  - "Derlenir; sadece biraz daha yavaş çalışır"
answer: 0
explanation: |
  Ders 1'den ve Modül 5'ten hatırla: bir struct bir referans tutarsa, struct'ın işaret ettiği veriden daha
  uzun yaşamadığını derleyiciye kanıtlamak gerekir. Bunun için `struct Kitap<'a>` gibi bir yaşam süresi
  etiketi lazım (Modül 12). O zamana kadar kural: **struct'lar verilerinin sahibi olsun**. Bir kütüphane
  kataloğu için bu zaten doğru tasarım: kitap kaydı, kendisini oluşturan geçici bir metne bağımlı olmamalı.
feedback:
  - Doğru!
  - "Tam tersi: `&str` (her paylaşılan referans gibi) `Copy`'dir. Sorun kopyalanabilirlik değil, yaşam süresi."
  - "`Debug`, `&str` alanları da sorunsuz yazdırır. Hata `derive`'a gelmeden, struct tanımında çıkar."
  - "Derlenmez. Rust'ta alan tipine referans yazmak, yaşam süresi belirtmeden mümkün değil."
```

Şimdi sıra sende. Kütüphanenin üyeleri için de bir tip lazım:

```fill
prompt: |
  `Uye` tipini ve kurucusunu tamamla. Yeni üye 0 kitapla başlar. Kurucunun dönüş tipinde ve gövdesinde
  tipin adını tekrar yazmak yerine kısaltmasını kullan; `no` alanında da alan başlatma kısaltmasından yararlan.
code: |
  #[derive(Debug)]
  struct Uye {
      no: u32,
      ad: String,
      kitap_sayisi: u32,
  }

  impl Uye {
      fn new(no: u32, ad: &str) -> ___0 {
          Self {
              ___1,
              ad: String::from(___2),
              kitap_sayisi: 0,
          }
      }
  }

  fn main() {
      let uye = Uye::new(42, "Deniz Yılmaz");
      println!("{uye:?}");
  }
blanks:
  - ["Self", "Uye"]
  - ["no", "no: no"]
  - ["ad"]
output: |
  Uye { no: 42, ad: "Deniz Yılmaz", kitap_sayisi: 0 }
explanation: |
  - `-> Self`: `impl Uye` bloğunun içinde `Self`, `Uye` demektir (Ders 5).
  - `no`: parametrenin adı alanın adıyla aynı, bu yüzden `no: no` yerine kısaca `no` yazabiliyoruz (Ders 1).
  - `String::from(ad)`: parametre bir `&str`; alana sahip olunan bir `String` koymak için kopyasını üretiyoruz.
    Burada kısaltma kullanamazdık, çünkü `ad: ad` yazsaydık bir `&str`'yi `String` alana koymaya çalışırdık (E0308).
  - Çıktıda `Debug`'ın `String`'i **tırnak içinde** yazdığına dikkat et (Ders 3).
```

## Kütüphane: kitapların sahibi

Kitap kartlarımız hazır; şimdi onları tutacak bir **çekmece** lazım. Kaç kitap olacağını önceden
bilmiyoruz, bu yüzden sabit boyutlu bir dizi değil, büyüyebilen bir **`Vec<Kitap>`** kullanacağız.
`Vec<i32>` ya da `Vec<String>` gibi, `Vec<Kitap>` de "kitaplardan oluşan bir vektör" demektir. Vektörleri
Modül 9'da derinlemesine göreceğiz; burada sadece bildiklerini kullanacağız: `push`, `len`, indeksleme ve
`for` ile dolaşma.

```rust
# #![allow(dead_code)]
# #[derive(Debug)]
# struct Kitap {
#     kod: u32,
#     baslik: String,
#     yazar: String,
#     oduncte: bool,
#     okunma_sayisi: u32,
# }
#
# impl Kitap {
#     fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
#         Self {
#             kod,
#             baslik: String::from(baslik),
#             yazar: String::from(yazar),
#             oduncte: false,
#             okunma_sayisi: 0,
#         }
#     }
# }
#
#[derive(Debug)]
struct Kutuphane {
    ad: String,
    kitaplar: Vec<Kitap>,
}

impl Kutuphane {
    fn new(ad: &str) -> Self {
        Self {
            ad: String::from(ad),
            kitaplar: Vec::new(),
        }
    }

    fn ekle(&mut self, kitap: Kitap) {
        self.kitaplar.push(kitap);
    }

    fn kitap_sayisi(&self) -> usize {
        self.kitaplar.len()
    }
}

fn main() {
    let mut kutuphane = Kutuphane::new("Moda Halk Kütüphanesi");
    let kitap = Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali");
    kutuphane.ekle(kitap);
    kutuphane.ekle(Kitap::new(1002, "Tutunamayanlar", "Oğuz Atay"));
    println!("{}: {} kitap", kutuphane.ad, kutuphane.kitap_sayisi());
    println!("İlk kitap: {}", kutuphane.kitaplar[0].baslik);
}
```

Üç şeye dikkat et:

- **`Vec::new()`** de bir ilişkili fonksiyon! Ders 5'te `String::new()` için söylediğimiz her şey geçerli:
  `self` almaz, boş bir vektör **üretir**, tipin adı üzerinden `::` ile çağrılır.
- **`ekle`, `kitap: Kitap` alıyor**, yani `&Kitap` değil. Kitabın **sahipliği** kütüphaneye geçiyor; artık
  kitabın sahibi vektör. Bu bilinçli bir karar: kütüphanenin kataloğu kendi kartlarına sahip olmalı, bir
  başkasının kartına bakan referanslar tutmamalı.
- **Alıcılar** işi anlatıyor: `ekle` kütüphaneyi değiştiriyor → `&mut self`; `kitap_sayisi` sadece okuyor
  → `&self`. İmzaya bakan herkes, hangi metodun kütüphaneyi değiştirebileceğini anında görür.

`ekle` çağrısından önce ve sonra bellekte ne olduğuna bakalım:

```memory
title: "`kutuphane.ekle(kitap);` adım adım"
steps:
  - caption: "Önce: `kitap` `main`'in stack çerçevesinde duruyor; başlığının ve yazarının karakterleri heap'te. Kütüphanenin vektörü boş."
    stack:
      - frame: main
        vars:
          - { name: kutuphane, type: Kutuphane, value: "ad: ptr | kitaplar: ptr · len=0 · cap=0", mut: true, to: h1 }
          - { name: kitap, type: Kitap, value: "kod: 1001 | baslik: ptr | yazar: ptr | oduncte: false | okunma_sayisi: 0", to: h2 }
    heap:
      - { id: h1, value: "Moda Halk Kütüphanesi", label: "kutuphane.ad" }
      - { id: h2, value: "Kürk Mantolu Madonna", label: "kitap.baslik" }
      - { id: h3, value: "Sabahattin Ali", label: "kitap.yazar" }
  - caption: "`ekle` sonrası: `Kitap` değeri vektörün heap'teki tamponuna **taşındı**. `kitap` değişkeni artık geçersiz. Başlık ve yazar metinleri kopyalanmadı; sadece onları gösteren işaretçiler yer değiştirdi."
    stack:
      - frame: main
        vars:
          - { name: kutuphane, type: Kutuphane, value: "ad: ptr | kitaplar: ptr · len=1 · cap=4", mut: true, to: h4 }
          - { name: kitap, type: Kitap, value: "(taşındı)", moved: true }
    heap:
      - { id: h4, value: "[ Kitap { kod: 1001, baslik: ptr→\"Kürk…\", yazar: ptr→\"Sabahattin…\", oduncte: false, okunma_sayisi: 0 } ]", label: "kutuphane.kitaplar tamponu" }
      - { id: h1, value: "Moda Halk Kütüphanesi", label: "kutuphane.ad" }
      - { id: h2, value: "Kürk Mantolu Madonna", label: "kitaplar[0].baslik" }
      - { id: h3, value: "Sabahattin Ali", label: "kitaplar[0].yazar" }
```

Bir sahiplik **ağacı** oluştu: `kutuphane` → `kitaplar` vektörü → her `Kitap` → her kitabın `String`'leri.
`kutuphane` kapsamdan çıktığında Rust bu ağacı yukarıdan aşağı otomatik olarak `drop` eder: önce
kitapların metinleri, sonra vektörün tamponu, en son kütüphanenin adı. Tek bir `free` bile yazmadın.
C'de bu ağacı elle, doğru sırayla serbest bırakmak zorundaydın.

Modül 4'teki taşıma kuralını hatırlayarak tahmin et:

```compiles
code: |
  struct Kitap {
      baslik: String,
  }

  struct Kutuphane {
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn ekle(&mut self, kitap: Kitap) {
          self.kitaplar.push(kitap);
      }
  }

  fn main() {
      let mut kutuphane = Kutuphane { kitaplar: Vec::new() };
      let kitap = Kitap { baslik: String::from("Beyaz Kale") };
      kutuphane.ekle(kitap);
      println!("{} eklendi", kitap.baslik);
      println!("{}", kutuphane.kitaplar.len());
  }
answer: false
error: E0382
explanation: |
  `ekle(kitap)` kitabı değer olarak aldığı için `kitap` kütüphaneye **taşındı**. Bir sonraki satırda
  `kitap.baslik`'i okumak, taşınmış bir değeri kullanmaktır: `E0382`. Metotlar da sıradan fonksiyonlardır;
  argümanlar için Modül 4'teki kurallar aynen geçerli.
```

:::error
```text
error[E0382]: borrow of moved value: `kitap`
  --> src/main.rs:19:28
   |
17 |     let kitap = Kitap { baslik: String::from("Beyaz Kale") };
   |         ----- move occurs because `kitap` has type `Kitap`, which does not implement the `Copy` trait
18 |     kutuphane.ekle(kitap);
   |                    ----- value moved here
19 |     println!("{} eklendi", kitap.baslik);
   |                            ^^^^^^^^^^^^ value borrowed here after move
   |
note: consider changing this parameter type in method `ekle` to borrow instead if owning the value isn't necessary
  --> src/main.rs:10:31
   |
10 |     fn ekle(&mut self, kitap: Kitap) {
   |        ---- in this method    ^^^^^ this parameter takes ownership of the value
note: if `Kitap` implemented `Clone`, you could clone the value
  --> src/main.rs:1:1
   |
 1 | struct Kitap {
   | ^^^^^^^^^^^^ consider implementing `Clone` for this type
...
18 |     kutuphane.ekle(kitap);
   |                    ----- you could clone this value
```
Derleyici iki seçenek öneriyor: `ekle`'nin parametresini referansa çevirmek ya da kitabı kopyalamak.
**İkisi de burada yanlış çözüm!** Kütüphanenin kitabın sahibi olması zaten istediğimiz şey. Doğru
düzeltme, kitabı **eklemeden önce** kullanmak ya da eklendikten sonra kütüphane üzerinden okumak:
`kutuphane.kitaplar[0].baslik`. Derleyicinin önerileri birer ipucudur, emir değil; tasarım kararını sen
verirsin.
:::

İlk alıştırma: kütüphaneye iki kural ekleyeceksin.

```exercise
id: m06-e-kutuphane-ekle
title: Aynı kod iki kez olmasın
difficulty: 2
prompt: |
  Nesrin Hanım bir sorun fark etti: aynı demirbaş koduyla iki kitap eklenebiliyor. İki metodu tamamla:

  - `ekle(&mut self, kitap: Kitap) -> bool` — kütüphanede **aynı `kod`'a sahip** bir kitap varsa
    kitabı eklemez ve `false` döndürür; yoksa vektöre ekler ve `true` döndürür.
  - `musait_sayisi(&self) -> usize` — **rafta olan** (ödünçte olmayan) kitapların sayısını döndürür.
starter: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn kitap_sayisi(&self) -> usize {
          self.kitaplar.len()
      }

      fn ekle(&mut self, kitap: Kitap) -> bool {
          todo!()
      }

      fn musait_sayisi(&self) -> usize {
          todo!()
      }
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      println!("{}", k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali")));
      println!("{}", k.ekle(Kitap::new(1001, "Beyaz Kale", "Orhan Pamuk")));
      println!("{}: {} kitap, {} rafta", k.ad, k.kitap_sayisi(), k.musait_sayisi());
  }
solution: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn kitap_sayisi(&self) -> usize {
          self.kitaplar.len()
      }

      fn ekle(&mut self, kitap: Kitap) -> bool {
          for k in &self.kitaplar {
              if k.kod == kitap.kod {
                  return false;
              }
          }
          self.kitaplar.push(kitap);
          true
      }

      fn musait_sayisi(&self) -> usize {
          let mut sayac = 0;
          for k in &self.kitaplar {
              if !k.oduncte {
                  sayac += 1;
              }
          }
          sayac
      }
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      println!("{}", k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali")));
      println!("{}", k.ekle(Kitap::new(1001, "Beyaz Kale", "Orhan Pamuk")));
      println!("{}: {} kitap, {} rafta", k.ad, k.kitap_sayisi(), k.musait_sayisi());
  }
check: tests
tests: |
  #[test]
  fn yeni_kitap_eklenir() {
      let mut k = Kutuphane::new("Test");
      assert!(k.ekle(Kitap::new(1, "Beyaz Kale", "Orhan Pamuk")), "boş kütüphaneye ekleme başarılı olmalı");
      assert!(k.ekle(Kitap::new(2, "Çalıkuşu", "Reşat Nuri Güntekin")), "farklı kodlu kitap eklenebilmeli");
      assert_eq!(k.kitap_sayisi(), 2, "iki kitap eklendi, sayı 2 olmalı");
      assert_eq!(k.kitaplar[1].baslik, "Çalıkuşu", "kitaplar eklenme sırasıyla durmalı");
  }

  #[test]
  fn ayni_kod_reddedilir() {
      let mut k = Kutuphane::new("Test");
      k.ekle(Kitap::new(7, "İnce Memed", "Yaşar Kemal"));
      assert!(!k.ekle(Kitap::new(7, "Saatleri Ayarlama Enstitüsü", "Ahmet Hamdi Tanpınar")), "aynı kodlu ikinci kitap reddedilmeli");
      assert_eq!(k.kitap_sayisi(), 1, "reddedilen kitap vektöre girmemeli");
      assert_eq!(k.kitaplar[0].baslik, "İnce Memed", "ilk eklenen kitap yerinde kalmalı");
  }

  #[test]
  fn musait_sayisi_oduncteki_kitaplari_saymaz() {
      let mut k = Kutuphane::new("Test");
      assert_eq!(k.musait_sayisi(), 0, "boş kütüphanede rafta kitap yoktur");
      k.ekle(Kitap::new(1, "A", "X"));
      k.ekle(Kitap::new(2, "B", "Y"));
      k.ekle(Kitap::new(3, "C", "Z"));
      k.kitaplar[1].oduncte = true;
      assert_eq!(k.musait_sayisi(), 2, "3 kitaptan biri ödünçte, 2 tanesi rafta olmalı");
      k.kitaplar[0].oduncte = true;
      k.kitaplar[2].oduncte = true;
      assert_eq!(k.musait_sayisi(), 0, "hepsi ödünçteyse rafta 0 kitap kalır");
  }
hints:
  - "İki metot da `self.kitaplar`'ı **okuyarak** dolaşıyor. Modül 5'ten: `for k in &self.kitaplar` her kitabı bir `&Kitap` olarak verir; vektör taşınmaz."
  - "`ekle`: önce döngüde `k.kod == kitap.kod` olan biri var mı bak; varsa hemen `return false;`. Döngü bittiyse `self.kitaplar.push(kitap);` ve son ifade olarak `true`."
  - "`musait_sayisi`: `let mut sayac = 0;` ile başla, döngüde `if !k.oduncte { sayac += 1; }`, en sonda `sayac` döndür."
explanation: |
  `ekle` önce **okur**, sonra **yazar**: döngüdeki `&self.kitaplar` ödüncü döngüyle birlikte biter (NLL),
  bu yüzden ardından gelen `push` için `self.kitaplar`'ı değiştirilebilir olarak ödünç almak serbest.
  `return false;` erken dönüştür (Modül 3); kopya bulunduğu an aramayı keser.

  Döngü içinde `kitap.kod` yazabiliyoruz, çünkü `kod` bir `u32`: sadece okunur, `kitap` taşınmaz. Kitap
  ancak en sonda `push(kitap)` ile vektöre taşınır.

  Bir ayrıntıyı fark ettin mi? Reddedilen kitap `ekle`'nin sonunda **drop edilir**; çağıran onu geri
  alamaz. Kitap küçük bir değer olduğu için şimdilik sorun değil. Modül 10'da `Result` ile reddedilen
  değeri çağırana geri vermeyi göreceksin.

  `musait_sayisi` için Modül 14'te çok daha kısa bir yol öğreneceksin (iterator adaptörleri). Şimdilik
  döngü + sayaç, ne olduğunu açıkça gösteriyor.
```

## Ödünç verme: döngüde `&mut` ile arama

Sıra kütüphanenin asıl işinde: kitap ödünç vermek. Bunun için kodu verilen kitabı **bulmamız** ve
**değiştirmemiz** gerekiyor. Okurken `&self.kitaplar` kullanmıştık; değiştirmek için her kitabı `&mut Kitap`
olarak veren `iter_mut()`'u (Modül 5) kullanırız:

```rust
# #![allow(dead_code)]
# #[derive(Debug)]
# struct Kitap {
#     kod: u32,
#     baslik: String,
#     yazar: String,
#     oduncte: bool,
#     okunma_sayisi: u32,
# }
#
# impl Kitap {
#     fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
#         Self {
#             kod,
#             baslik: String::from(baslik),
#             yazar: String::from(yazar),
#             oduncte: false,
#             okunma_sayisi: 0,
#         }
#     }
# }
#
# #[derive(Debug)]
# struct Kutuphane {
#     ad: String,
#     kitaplar: Vec<Kitap>,
# }
#
impl Kutuphane {
#     fn new(ad: &str) -> Self {
#         Self { ad: String::from(ad), kitaplar: Vec::new() }
#     }
#
#     fn ekle(&mut self, kitap: Kitap) {
#         self.kitaplar.push(kitap);
#     }
#
    fn odunc_ver(&mut self, kod: u32) -> bool {
        for kitap in self.kitaplar.iter_mut() {
            if kitap.kod == kod {
                if kitap.oduncte {
                    return false; // kitap zaten ödünçte
                }
                kitap.oduncte = true;
                kitap.okunma_sayisi += 1;
                return true;
            }
        }
        false // bu kodda bir kitap yok
    }
}

fn main() {
    let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
    k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali"));
    println!("1. deneme: {}", k.odunc_ver(1001));
    println!("2. deneme: {}", k.odunc_ver(1001));
    println!("olmayan kod: {}", k.odunc_ver(9999));
    println!("{:?}", k.kitaplar[0]);
}
```

Metodun iskeleti, bundan sonra çok kez yazacağın bir **arama deseni**: döngüde aranan öğeyi bul, işini yap
ve `return` ile hemen çık; döngü bittiyse öğe yoktur. `kitap` burada bir `&mut Kitap`. Yine de
`(*kitap).oduncte` yazmamıza gerek yok, çünkü alan erişiminde nokta, referansı **kendiliğinden çözer**
(Modül 5'teki otomatik çözme).

Neden `bool` döndürüyoruz? Çünkü ödünç verme **başarısız olabilir**: kitap ya yoktur ya da başkasındadır.
Çağıranın bunu bilmesi gerekir. `bool` bu iki başarısızlığı birbirinden ayıramıyor; Modül 7'de `Option`,
Modül 10'da `Result` ile "neden başarısız oldu?" sorusunu da cevaplayacağız. Şimdilik `bool` dürüst ve yeterli.

Nesrin Hanım günlük toplam işlem sayısını da görmek istiyor. Kütüphaneye `islem_sayisi: u32` alanı ve onu
artıran küçük bir yardımcı metot ekleyelim; sonra bu metodu döngünün içinden çağıralım. Modül 5'teki
ödünç alma kurallarını hatırlayarak tahmin et:

```compiles
code: |
  struct Kitap {
      kod: u32,
      oduncte: bool,
  }

  struct Kutuphane {
      kitaplar: Vec<Kitap>,
      islem_sayisi: u32,
  }

  impl Kutuphane {
      fn islem_say(&mut self) {
          self.islem_sayisi += 1;
      }

      fn odunc_ver(&mut self, kod: u32) -> bool {
          for kitap in self.kitaplar.iter_mut() {
              if kitap.kod == kod && !kitap.oduncte {
                  self.islem_say();
                  kitap.oduncte = true;
                  return true;
              }
          }
          false
      }
  }

  fn main() {
      let mut k = Kutuphane { kitaplar: vec![Kitap { kod: 1, oduncte: false }], islem_sayisi: 0 };
      println!("{} {}", k.odunc_ver(1), k.islem_sayisi);
  }
answer: false
error: E0499
explanation: |
  `self.kitaplar.iter_mut()` döngü boyunca vektörü **değiştirilebilir olarak** ödünç alıyor ve `kitap` bu
  ödüncün bir parçası. `self.islem_say()` ise `&mut self` istiyor, yani **bütün** kütüphaneyi, `kitaplar`
  dahil. Aynı anda iki `&mut` olamaz (Modül 5): `E0499`.
```

:::error
```text
error[E0499]: cannot borrow `*self` as mutable more than once at a time
  --> src/main.rs:19:17
   |
17 |           for kitap in self.kitaplar.iter_mut() {
   |           -            ------------- first mutable borrow occurs here
   |  _________|
   | |
18 | |             if kitap.kod == kod && !kitap.oduncte {
19 | |                 self.islem_say();
   | |                 ^^^^ second mutable borrow occurs here
20 | |                 kitap.oduncte = true;
   | |                 -------------------- first borrow later used here
...  |
23 | |         }
   | |_________- this for loop borrows `*self` mutably, preventing mutation within its body
   |
   = help: consider using an index-based loop instead, or collecting modifications into a separate collection
```
Hikâyeyi oku: **birinci** ödünç `self.kitaplar`'da başladı, **ikinci** ödünç `self.islem_say()`'de
istendi ve birinci ödünç `kitap.oduncte = true;` satırında hâlâ kullanılıyor. Alt satırdaki not, sorunun
döngünün tamamıyla ilgili olduğunu söylüyor: döngü sürdükçe `self`'in içindeki vektör kilitli.
:::

Burada Ders 4'teki derin ders geri dönüyor: derleyici `islem_say`'in **gövdesine** bakıp "aslında sadece
`islem_sayisi` alanına dokunuyor" demez; yalnızca **imzaya** (`&mut self`) bakar. İmza "bütün kütüphaneyi
değiştirebilirim" diyor ve kitaplar da kütüphanenin parçası. C++'ta bu kod derlenirdi ve metot içeride
vektöre eleman ekleseydi, döngünün elindeki referans serbest bırakılmış belleği gösterirdi (**iterator
invalidation**). Rust bu ihtimali baştan kapatır.

Peki bu doğrudan alan erişimiyle olsaydı? Tahmin et:

```compiles
code: |
  struct Kitap {
      kod: u32,
      oduncte: bool,
  }

  struct Kutuphane {
      kitaplar: Vec<Kitap>,
      islem_sayisi: u32,
  }

  impl Kutuphane {
      fn odunc_ver(&mut self, kod: u32) -> bool {
          for kitap in self.kitaplar.iter_mut() {
              if kitap.kod == kod && !kitap.oduncte {
                  self.islem_sayisi += 1;
                  kitap.oduncte = true;
                  return true;
              }
          }
          false
      }
  }

  fn main() {
      let mut k = Kutuphane { kitaplar: vec![Kitap { kod: 1, oduncte: false }], islem_sayisi: 0 };
      println!("{} {}", k.odunc_ver(1), k.islem_sayisi);
  }
answer: true
explanation: |
  Derlenir ve `true 1` yazdırır. Bu kez derleyici iki **ayrı alanın** ödünç alındığını görebiliyor:
  döngü `self.kitaplar`'ı, toplama ise `self.islem_sayisi`'ni ödünç alıyor. Bir fonksiyonun **içinde**
  derleyici, struct'ın hangi alanlarına dokunduğunu alan alan takip eder (**ayrık alan ödünçleri**,
  disjoint field borrows). Metot çağrısında ise sadece imzayı bilir ve imza `self`'in tamamını ister.
```

:::tip Döngüde `self`'e ihtiyacın varsa
- Alanlara **doğrudan** eriş (`self.islem_sayisi += 1`): derleyici farklı alanları ayrı ayrı görür.
- Ya da işi **döngüden sonraya** bırak: döngüde sadece bir bilgi (indeks, bulundu mu?) topla, `self`'in
  metodunu döngü bittikten sonra çağır.
- Ya da derleyicinin önerdiği gibi **indeksle** dolaş: `for i in 0..self.kitaplar.len()` ve her seferinde
  `self.kitaplar[i]`'ye kısa süreli eriş. Bu ödünç her satırda başlayıp biter.
:::

Okuma yapan aramalar için `&mut`'a hiç gerek yok. Şimdi bir kitabın rafta olup olmadığını söyleyen salt
okunur bir arama metodunu sen kur:

```parsons
prompt: |
  `musait_mi(&self, kod: u32) -> bool` metodunu kur: kitap varsa ve ödünçte değilse `true`, aksi hâlde
  `false` döndürsün. Program `true false false` yazmalı. Dikkat, iki satır tuzak!
lines: |
  struct Kitap { kod: u32, oduncte: bool }
  struct Kutuphane { kitaplar: Vec<Kitap> }
  impl Kutuphane {
      fn musait_mi(&self, kod: u32) -> bool {
          for kitap in &self.kitaplar {
              if kitap.kod == kod {
                  return !kitap.oduncte;
              }
          }
          false
      }
  }
  fn main() {
      let k = Kutuphane { kitaplar: vec![Kitap { kod: 1, oduncte: false }, Kitap { kod: 2, oduncte: true }] };
      println!("{} {} {}", k.musait_mi(1), k.musait_mi(2), k.musait_mi(3));
  }
distractors: |2
          for kitap in self.kitaplar {
      fn musait_mi(&mut self, kod: u32) -> bool {
explanation: |
  - Metot sadece okuyor → `&self`. `&mut self` de derlenirdi ama `main`'deki `k` `mut` olmadığı için
    çağrı hata verirdi; üstelik imza yalan söylerdi ("değiştirebilirim").
  - `for kitap in &self.kitaplar` vektörü ödünç alır. `for kitap in self.kitaplar` ise vektörü `self`'in
    içinden **taşımaya** çalışırdı; `self` bir `&Kutuphane` olduğu için bu yasaktır (`E0507`: cannot move
    out of `self.kitaplar` which is behind a shared reference).
  - `return !kitap.oduncte;` kitap bulunduğunda cevabı hemen verir: rafta ise `true`. Döngü biterse kitap
    yoktur → `false`.
```

İkinci alıştırmada iade işlemini ve kitap kaldırmayı yazacaksın. Kaldırırken yeni bir vektör metodu
kullanacaksın: **`v.remove(i)`**, `i`. indeksteki elemanı vektörden çıkarır ve arkasındakileri birer
sola kaydırır (Modül 9'da ayrıntısıyla göreceğiz).

```exercise
id: m06-e-iade-kaldir
title: İade ve kayıttan düşme
difficulty: 3
prompt: |
  `odunc_ver` hazır. İki metodu tamamla:

  - `iade_et(&mut self, kod: u32) -> bool` — kitap varsa **ve ödünçteyse** rafa geri koyar (`oduncte = false`)
    ve `true` döndürür. Kitap yoksa ya da zaten raftaysa `false` döndürür. İade, `okunma_sayisi`'ni
    **değiştirmez**.
  - `kaldir(&mut self, kod: u32) -> bool` — yıpranan bir kitabı envanterden siler. Ama **ödünçteki** bir
    kitap silinemez (okurun elindeki kitabı kayıttan düşemeyiz!). Kitap rafta ise vektörden çıkarır ve
    `true` döndürür; yoksa ya da ödünçteyse `false` döndürür.
starter: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn ekle(&mut self, kitap: Kitap) {
          self.kitaplar.push(kitap);
      }

      fn odunc_ver(&mut self, kod: u32) -> bool {
          for kitap in self.kitaplar.iter_mut() {
              if kitap.kod == kod {
                  if kitap.oduncte {
                      return false;
                  }
                  kitap.oduncte = true;
                  kitap.okunma_sayisi += 1;
                  return true;
              }
          }
          false
      }

      fn iade_et(&mut self, kod: u32) -> bool {
          todo!()
      }

      fn kaldir(&mut self, kod: u32) -> bool {
          todo!()
      }
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali"));
      k.ekle(Kitap::new(1002, "Tutunamayanlar", "Oğuz Atay"));
      k.odunc_ver(1001);
      println!("ödünçteki kitap silinebilir mi? {}", k.kaldir(1001));
      println!("iade: {}", k.iade_et(1001));
      println!("şimdi silinebilir mi? {}", k.kaldir(1001));
      println!("{}: {} kitap kaldı", k.ad, k.kitaplar.len());
  }
solution: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn ekle(&mut self, kitap: Kitap) {
          self.kitaplar.push(kitap);
      }

      fn odunc_ver(&mut self, kod: u32) -> bool {
          for kitap in self.kitaplar.iter_mut() {
              if kitap.kod == kod {
                  if kitap.oduncte {
                      return false;
                  }
                  kitap.oduncte = true;
                  kitap.okunma_sayisi += 1;
                  return true;
              }
          }
          false
      }

      fn iade_et(&mut self, kod: u32) -> bool {
          for kitap in self.kitaplar.iter_mut() {
              if kitap.kod == kod {
                  if !kitap.oduncte {
                      return false;
                  }
                  kitap.oduncte = false;
                  return true;
              }
          }
          false
      }

      fn kaldir(&mut self, kod: u32) -> bool {
          for i in 0..self.kitaplar.len() {
              if self.kitaplar[i].kod == kod {
                  if self.kitaplar[i].oduncte {
                      return false;
                  }
                  self.kitaplar.remove(i);
                  return true;
              }
          }
          false
      }
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali"));
      k.ekle(Kitap::new(1002, "Tutunamayanlar", "Oğuz Atay"));
      k.odunc_ver(1001);
      println!("ödünçteki kitap silinebilir mi? {}", k.kaldir(1001));
      println!("iade: {}", k.iade_et(1001));
      println!("şimdi silinebilir mi? {}", k.kaldir(1001));
      println!("{}: {} kitap kaldı", k.ad, k.kitaplar.len());
  }
check: tests
tests: |
  fn ornek() -> Kutuphane {
      let mut k = Kutuphane::new("Test");
      k.ekle(Kitap::new(1, "Beyaz Kale", "Orhan Pamuk"));
      k.ekle(Kitap::new(2, "Çalıkuşu", "Reşat Nuri Güntekin"));
      k.ekle(Kitap::new(3, "İnce Memed", "Yaşar Kemal"));
      k
  }

  #[test]
  fn iade_kitabi_rafa_koyar() {
      let mut k = ornek();
      k.odunc_ver(2);
      assert!(k.iade_et(2), "ödünçteki kitabın iadesi başarılı olmalı");
      assert!(!k.kitaplar[1].oduncte, "iade edilen kitap rafta olmalı");
      assert_eq!(k.kitaplar[1].okunma_sayisi, 1, "iade, okunma sayısını değiştirmemeli");
      assert!(k.odunc_ver(2), "iade edilen kitap yeniden ödünç verilebilmeli");
  }

  #[test]
  fn raftaki_ya_da_olmayan_kitap_iade_edilemez() {
      let mut k = ornek();
      assert!(!k.iade_et(1), "zaten rafta olan kitap iade edilemez");
      assert!(!k.iade_et(99), "olmayan bir kitap iade edilemez");
      assert!(!k.kitaplar[0].oduncte, "başarısız iade kitabın durumunu bozmamalı");
  }

  #[test]
  fn raftaki_kitap_kaldirilir() {
      let mut k = ornek();
      assert!(k.kaldir(2), "raftaki kitap kaldırılabilmeli");
      assert_eq!(k.kitaplar.len(), 2, "kaldırma sonrası 2 kitap kalmalı");
      assert_eq!(k.kitaplar[0].kod, 1, "diğer kitaplar yerinde kalmalı");
      assert_eq!(k.kitaplar[1].kod, 3, "kaldırılanın arkasındaki kitap bir sola kaymalı");
      assert!(!k.kaldir(2), "aynı kitap ikinci kez kaldırılamaz");
  }

  #[test]
  fn oduncteki_kitap_kaldirilamaz() {
      let mut k = ornek();
      k.odunc_ver(3);
      assert!(!k.kaldir(3), "okurun elindeki kitap kayıttan düşülemez");
      assert_eq!(k.kitaplar.len(), 3, "kaldırma reddedilince kitap sayısı değişmemeli");
      assert!(!k.kaldir(42), "olmayan kod için kaldir false döndürmeli");
  }
hints:
  - "`iade_et`, `odunc_ver`'in neredeyse aynısı; sadece koşul tersine dönüyor: kitap **raftaysa** (`!kitap.oduncte`) `false` döndür, değilse `oduncte = false` yap. `okunma_sayisi`'ne dokunma."
  - "`kaldir`'da `remove`'a bir **indeks** vermen gerekiyor, bu yüzden en net yol indeksle dolaşmak: `for i in 0..self.kitaplar.len()` ve her seferinde `self.kitaplar[i]`'ye bak. (`for k in &self.kitaplar` döngüsünün ortasında `remove` çağırıp döngüye devam etmek derlenmez: E0502.)"
  - "`kaldir`: `if self.kitaplar[i].kod == kod { if self.kitaplar[i].oduncte { return false; } self.kitaplar.remove(i); return true; }`; döngüden sonra `false`."
explanation: |
  `iade_et` arama desenini tekrar kullanıyor: bul, kontrol et, değiştir, çık. Başarısız iadenin kitabın
  durumuna dokunmaması önemli; testler bunu da denetliyor.

  `kaldir` neden farklı? Vektörü `for k in &self.kitaplar` ile dolaşırken içinde `self.kitaplar.remove(..)`
  çağırıp **döngüye devam etmek**, vektörü okurken yapısını değiştirmek olurdu. C++'ta bu, klasik bir
  çökme sebebidir: elemanlar kayar ve döngünün elindeki referans yanlış yeri, hatta serbest bırakılmış
  belleği gösterir. Rust buna izin vermez (`E0502`; `iter_mut` ile `E0499`). İlginç bir ayrıntı: `remove`'dan
  hemen sonra `return` edersen derleyici aynı döngüyü kabul eder, çünkü NLL döngünün bir daha
  kullanılmayacağını görür. Ama buna güvenmek ince bir akıl yürütme ister. İndeksli döngü niyeti açıkça
  gösterir: her `self.kitaplar[i]` erişimi kısa bir ödünçtür ve satır bitince sona erer; `remove(i)`
  çağrıldığında başka hiçbir ödünç yaşamıyor. Hemen ardından `return` ettiğimiz için kayan indeksler de
  sorun olmuyor.

  `remove(i)` çıkardığı `Kitap`'ı geri döndürür. Biz onu bir değişkene bağlamadığımız için değer satırın
  sonunda **drop edilir**: kitabın başlığı ve yazarı da heap'ten serbest bırakılır. Kitabı bir "arşiv"
  vektörüne taşımak isteseydin `let k = self.kitaplar.remove(i);` yazıp `k`'yi oraya `push` edebilirdin.

  Alternatif: önce bir döngüyle sadece indeksi bul, sonra döngü bittikten sonra sil. Modül 7'de bunu
  `Option<usize>` döndüren bir arama metoduyla çok daha temiz yazacaksın.
```

## Rapor: kütüphanenin dökümü

Nesrin Hanım her akşam bir döküm almak istiyor. Dökümü doğrudan ekrana yazdırmak yerine bir `String`
olarak **üretip döndürmek** daha iyi bir tasarım: aynı metni ekrana yazdırabilir, ileride bir dosyaya
kaydedebilir ya da (bu derste olduğu gibi) testlerde karşılaştırabilirsin. Ekrana yazdıran bir metodu
test etmek çok zordur; değer döndüren bir metodu test etmek ise tek satırdır.

```rust
# #![allow(dead_code)]
# #[derive(Debug)]
# struct Kitap {
#     kod: u32,
#     baslik: String,
#     yazar: String,
#     oduncte: bool,
#     okunma_sayisi: u32,
# }
#
# impl Kitap {
#     fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
#         Self {
#             kod,
#             baslik: String::from(baslik),
#             yazar: String::from(yazar),
#             oduncte: false,
#             okunma_sayisi: 0,
#         }
#     }
# }
#
# #[derive(Debug)]
# struct Kutuphane {
#     ad: String,
#     kitaplar: Vec<Kitap>,
# }
#
impl Kitap {
    fn durum(&self) -> &str {
        if self.oduncte { "ödünçte" } else { "rafta" }
    }
}

impl Kutuphane {
#     fn new(ad: &str) -> Self {
#         Self { ad: String::from(ad), kitaplar: Vec::new() }
#     }
#
#     fn ekle(&mut self, kitap: Kitap) {
#         self.kitaplar.push(kitap);
#     }
#
    fn listele(&self) -> String {
        let mut rapor = format!("== {} ==\n", self.ad);
        for k in &self.kitaplar {
            let satir = format!("#{} {} ({}) — {}\n", k.kod, k.baslik, k.yazar, k.durum());
            rapor.push_str(&satir);
        }
        rapor
    }
}

fn main() {
    let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
    k.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali"));
    k.ekle(Kitap::new(1002, "Tutunamayanlar", "Oğuz Atay"));
    k.kitaplar[1].oduncte = true;
    print!("{}", k.listele());
}
```

- `durum` bir `&str` döndürüyor: iki literal de programın içine gömülü (Modül 4) ve `&self`'ten uzun
  yaşıyor, bu yüzden güvenle döndürülebilir. `if` bir ifade olduğu için iki dal doğrudan sonuç oluyor
  (Modül 3).
- `durum` metodu `Kitap`'ın ikinci `impl` bloğunda (Ders 5): kurucuyu tekrar yazmamak için ayrı bir blok
  açtık; derleyici ikisini birleştirir.
- `listele`, `format!` ile her satırı üretip `push_str` ile rapora ekliyor. `push_str` bir `&str` ister;
  `&satir` (bir `&String`) otomatik olarak `&str`'ye dönüşür (Modül 5).
- Her satır `\n` ile bitiyor, bu yüzden `main`'de `println!` değil `print!` kullandık (Modül 1).

Modül 1'deki biçimlendirme bilgilerini konuşturalım. Rapora hizalanmış sütunlar ekledik. Tahmin et:

```predict
code: |
  struct Kitap {
      kod: u32,
      baslik: String,
      okunma_sayisi: u32,
  }

  fn main() {
      let kitaplar = vec![
          Kitap { kod: 7, baslik: String::from("Beyaz Kale"), okunma_sayisi: 12 },
          Kitap { kod: 1042, baslik: String::from("Çalıkuşu"), okunma_sayisi: 3 },
      ];
      for k in &kitaplar {
          println!("{:04}|{:<10}|{:>3}", k.kod, k.baslik, k.okunma_sayisi);
      }
  }
options:
  - |
    0007|Beyaz Kale| 12
    1042|Çalıkuşu  |  3
  - |
    7   |Beyaz Kale|12
    1042|Çalıkuşu  |3
  - |
    0007|Beyaz Kale| 12
    1042|Çalıkuşu|  3
  - |
    0007|Beyaz Kale| 12
    1042|  Çalıkuşu|  3
answer: 0
explanation: |
  - `{:04}`: en az 4 hane, eksikse soldan **sıfırla** doldur → `0007`; `1042` zaten 4 hane.
  - `{:<10}`: en az 10 karakter, **sola** yasla, sağı boşlukla doldur. "Beyaz Kale" tam 10 karakter;
    "Çalıkuşu" 8 karakter, yanına 2 boşluk eklenir. Genişlik **karakter** sayar, bayt değil: `Ç`, `ı`, `ş`
    UTF-8'de 2'şer bayt olsa da birer karakterdir.
  - `{:>3}`: en az 3 karakter, **sağa** yasla → ` 12`, `  3`. Sayılar sağa yaslanınca basamaklar alt alta gelir.
```

Şimdi bu modülün en zorlu alıştırması: kütüphanenin istatistiklerini çıkarmak.

```exercise
id: m06-e-istatistik
title: Okuma istatistikleri
difficulty: 4
prompt: |
  Belediye, kütüphaneden aylık bir istatistik raporu istiyor. İki metot yaz (imzaları sen yazacaksın,
  `main`'deki ve testlerdeki kullanıma bak):

  - `yazarin_kitaplari` — bir yazarın adını `&str` olarak alır ve o yazarın kütüphanedeki kitaplarının
    **başlıklarını**, eklenme sırasıyla, bir `Vec<String>` olarak döndürür. Yazarın kitabı yoksa boş vektör.
  - `en_cok_okunan` — `okunma_sayisi` en yüksek kitabın **başlığını** `String` olarak döndürür. Eşitlik
    varsa **önce eklenen** kazanır. Kütüphane boşsa ya da hiçbir kitap hiç okunmamışsa (hepsi 0) boş bir
    `String` döndürür.

  İki metot da kütüphaneyi **değiştirmemeli**.
starter: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn ekle(&mut self, kitap: Kitap) {
          self.kitaplar.push(kitap);
      }

      // yazarin_kitaplari ve en_cok_okunan metotlarını buraya yaz.
      // Derlenmesi için önce imzayı ve gövdeye todo!() yazabilirsin.
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      k.ekle(Kitap::new(1, "Kürk Mantolu Madonna", "Sabahattin Ali"));
      k.ekle(Kitap::new(2, "İçimizdeki Şeytan", "Sabahattin Ali"));
      k.ekle(Kitap::new(3, "Tutunamayanlar", "Oğuz Atay"));
      k.kitaplar[0].okunma_sayisi = 5;
      k.kitaplar[2].okunma_sayisi = 9;
      println!("{} raporu", k.ad);
      // println!("{:?}", k.yazarin_kitaplari("Sabahattin Ali"));
      // println!("En çok okunan: {}", k.en_cok_okunan());
      println!("{}", k.kitaplar[0].kod);
  }
solution: |
  #[derive(Debug)]
  struct Kitap {
      kod: u32,
      baslik: String,
      yazar: String,
      oduncte: bool,
      okunma_sayisi: u32,
  }

  impl Kitap {
      fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
          Self {
              kod,
              baslik: String::from(baslik),
              yazar: String::from(yazar),
              oduncte: false,
              okunma_sayisi: 0,
          }
      }
  }

  #[derive(Debug)]
  struct Kutuphane {
      ad: String,
      kitaplar: Vec<Kitap>,
  }

  impl Kutuphane {
      fn new(ad: &str) -> Self {
          Self {
              ad: String::from(ad),
              kitaplar: Vec::new(),
          }
      }

      fn ekle(&mut self, kitap: Kitap) {
          self.kitaplar.push(kitap);
      }

      fn yazarin_kitaplari(&self, yazar: &str) -> Vec<String> {
          let mut sonuc = Vec::new();
          for k in &self.kitaplar {
              if k.yazar == yazar {
                  sonuc.push(k.baslik.clone());
              }
          }
          sonuc
      }

      fn en_cok_okunan(&self) -> String {
          let mut en_iyi = String::new();
          let mut en_cok = 0;
          for k in &self.kitaplar {
              if k.okunma_sayisi > en_cok {
                  en_cok = k.okunma_sayisi;
                  en_iyi = k.baslik.clone();
              }
          }
          en_iyi
      }
  }

  fn main() {
      let mut k = Kutuphane::new("Moda Halk Kütüphanesi");
      k.ekle(Kitap::new(1, "Kürk Mantolu Madonna", "Sabahattin Ali"));
      k.ekle(Kitap::new(2, "İçimizdeki Şeytan", "Sabahattin Ali"));
      k.ekle(Kitap::new(3, "Tutunamayanlar", "Oğuz Atay"));
      k.kitaplar[0].okunma_sayisi = 5;
      k.kitaplar[2].okunma_sayisi = 9;
      println!("{} raporu", k.ad);
      println!("{:?}", k.yazarin_kitaplari("Sabahattin Ali"));
      println!("En çok okunan: {}", k.en_cok_okunan());
      println!("{}", k.kitaplar[0].kod);
  }
check: tests
tests: |
  fn ornek() -> Kutuphane {
      let mut k = Kutuphane::new("Test");
      k.ekle(Kitap::new(1, "Kürk Mantolu Madonna", "Sabahattin Ali"));
      k.ekle(Kitap::new(2, "Tutunamayanlar", "Oğuz Atay"));
      k.ekle(Kitap::new(3, "İçimizdeki Şeytan", "Sabahattin Ali"));
      k.ekle(Kitap::new(4, "Tehlikeli Oyunlar", "Oğuz Atay"));
      k
  }

  #[test]
  fn yazarin_kitaplari_eklenme_sirasiyla_gelir() {
      let k = ornek();
      assert_eq!(
          k.yazarin_kitaplari("Sabahattin Ali"),
          vec![String::from("Kürk Mantolu Madonna"), String::from("İçimizdeki Şeytan")],
          "Sabahattin Ali'nin iki kitabı eklenme sırasıyla gelmeli"
      );
      assert_eq!(
          k.yazarin_kitaplari("Oğuz Atay"),
          vec![String::from("Tutunamayanlar"), String::from("Tehlikeli Oyunlar")],
          "Oğuz Atay'ın iki kitabı gelmeli"
      );
  }

  #[test]
  fn kitabi_olmayan_yazar_icin_bos_vektor() {
      let k = ornek();
      assert!(k.yazarin_kitaplari("Orhan Pamuk").is_empty(), "kütüphanede Orhan Pamuk kitabı yok, vektör boş olmalı");
      assert_eq!(k.kitaplar.len(), 4, "metot kütüphaneyi değiştirmemeli");
  }

  #[test]
  fn en_cok_okunan_bulunur() {
      let mut k = ornek();
      k.kitaplar[1].okunma_sayisi = 4;
      k.kitaplar[3].okunma_sayisi = 11;
      k.kitaplar[0].okunma_sayisi = 7;
      assert_eq!(k.en_cok_okunan(), "Tehlikeli Oyunlar", "11 kez okunan kitap kazanmalı");
  }

  #[test]
  fn esitlikte_once_eklenen_kazanir() {
      let mut k = ornek();
      k.kitaplar[1].okunma_sayisi = 6;
      k.kitaplar[2].okunma_sayisi = 6;
      assert_eq!(k.en_cok_okunan(), "Tutunamayanlar", "eşit okunmada önce eklenen kitap kazanmalı");
  }

  #[test]
  fn hic_okunmamissa_bos_string() {
      let k = ornek();
      assert_eq!(k.en_cok_okunan(), "", "hiçbir kitap okunmadıysa boş String dönmeli");
      let bos = Kutuphane::new("Boş");
      assert_eq!(bos.en_cok_okunan(), "", "boş kütüphanede boş String dönmeli");
  }
hints:
  - "İki metot da sadece okuyor → `&self`. İmzalar: `fn yazarin_kitaplari(&self, yazar: &str) -> Vec<String>` ve `fn en_cok_okunan(&self) -> String`. `main`'deki iki satırın yorumunu kaldırmayı unutma."
  - "Döndüreceğin başlıklar **yeni** `String`'ler olmalı: `k.baslik`'i vektörün içinden taşıyamazsın (o `&self`'in arkasında). `k.baslik.clone()` bilinçli bir kopya üretir. `yazarin_kitaplari`: `let mut sonuc = Vec::new();` ve uyan her kitap için `sonuc.push(k.baslik.clone());`."
  - "`en_cok_okunan`: `let mut en_iyi = String::new();` ve `let mut en_cok = 0;` ile başla. Döngüde `k.okunma_sayisi > en_cok` ise (dikkat: `>=` değil, eşitlikte önce eklenen kalmalı) ikisini de güncelle. Başlangıç değeri 0 olduğu için hiç okunmamış kitaplar asla seçilmez."
explanation: |
  **Neden `clone`?** Metotlar `&self` alıyor; kitapların sahibi kütüphane. `k.baslik` ifadesiyle bir
  `String`'i ödünç alınmış bir yapının içinden **taşımaya** kalkarsan `E0507` alırsın: "cannot move out of
  `k.baslik` which is behind a shared reference". Çağırana bağımsız bir değer vermek istiyorsak bilinçli
  bir kopya üretmek gerekir. Modül 4'teki kural: `clone` her derdin ilacı değil ama **sahibi olunan bir
  sonuç** döndürmek gerektiğinde doğru araçtır. (Modül 12'de yaşam süreleriyle `Vec<&str>` döndürerek
  kopyasız bir sürüm de yazabileceksin.)

  **Eşitlik kuralı** tek bir karakterde saklı: `>` önce eklenen kitabı korur, `>=` ise son eşit kitabı
  seçerdi. Testlerdeki eşitlik durumu bu farkı yakalıyor.

  **Başlangıç değerleri** iki kenar durumu birden çözüyor: `en_cok = 0` ile hiç okunmamış kitaplar asla
  `> 0` olmadığı için seçilmez, boş kütüphanede döngü hiç dönmez ve boş `String` döner. Ayrı bir `if`
  yazmaya gerek yok.

  `k.yazar == yazar`: `String` ile `&str` doğrudan karşılaştırılabilir. Modül 7'de "belki yoktur" sonucunu
  boş `String` yerine `Option<String>` ile ifade etmeyi öğreneceksin; boş başlıklı bir kitap olsaydı mevcut
  tasarım onu "sonuç yok"tan ayıramazdı.
```

## Hepsi bir arada: tam program

Parçaları birleştirelim. Aşağıdaki program, kütüphanenin bir gününü baştan sona canlandırıyor. Çalıştır,
sonra metotları değiştirip ne olduğunu gözle:

```rust
#[derive(Debug)]
struct Kitap {
    kod: u32,
    baslik: String,
    yazar: String,
    oduncte: bool,
    okunma_sayisi: u32,
}

impl Kitap {
    fn new(kod: u32, baslik: &str, yazar: &str) -> Self {
        Self {
            kod,
            baslik: String::from(baslik),
            yazar: String::from(yazar),
            oduncte: false,
            okunma_sayisi: 0,
        }
    }

    fn durum(&self) -> &str {
        if self.oduncte { "ödünçte" } else { "rafta" }
    }
}

#[derive(Debug)]
struct Kutuphane {
    ad: String,
    kitaplar: Vec<Kitap>,
}

impl Kutuphane {
    fn new(ad: &str) -> Self {
        Self { ad: String::from(ad), kitaplar: Vec::new() }
    }

    fn ekle(&mut self, kitap: Kitap) -> bool {
        for k in &self.kitaplar {
            if k.kod == kitap.kod {
                return false;
            }
        }
        self.kitaplar.push(kitap);
        true
    }

    fn odunc_ver(&mut self, kod: u32) -> bool {
        for kitap in self.kitaplar.iter_mut() {
            if kitap.kod == kod {
                if kitap.oduncte {
                    return false;
                }
                kitap.oduncte = true;
                kitap.okunma_sayisi += 1;
                return true;
            }
        }
        false
    }

    fn iade_et(&mut self, kod: u32) -> bool {
        for kitap in self.kitaplar.iter_mut() {
            if kitap.kod == kod {
                if !kitap.oduncte {
                    return false;
                }
                kitap.oduncte = false;
                return true;
            }
        }
        false
    }

    fn musait_sayisi(&self) -> usize {
        let mut sayac = 0;
        for k in &self.kitaplar {
            if !k.oduncte {
                sayac += 1;
            }
        }
        sayac
    }

    fn listele(&self) -> String {
        let mut rapor = format!("== {} ==\n", self.ad);
        for k in &self.kitaplar {
            rapor.push_str(&format!("#{} {:<22} {:<16} {}\n", k.kod, k.baslik, k.yazar, k.durum()));
        }
        rapor
    }
}

fn main() {
    let mut kutuphane = Kutuphane::new("Moda Halk Kütüphanesi");
    kutuphane.ekle(Kitap::new(1003, "Tutunamayanlar", "Oğuz Atay"));
    kutuphane.ekle(Kitap::new(1001, "Kürk Mantolu Madonna", "Sabahattin Ali"));
    kutuphane.ekle(Kitap::new(1002, "Beyaz Kale", "Orhan Pamuk"));
    let kopya = kutuphane.ekle(Kitap::new(1002, "Çalıkuşu", "Reşat Nuri Güntekin"));
    println!("Aynı kodlu kitap eklendi mi? {kopya}");

    println!("Ödünç 1001: {}", kutuphane.odunc_ver(1001));
    println!("Ödünç 1001 (tekrar): {}", kutuphane.odunc_ver(1001));
    println!("Ödünç 1003: {}", kutuphane.odunc_ver(1003));
    println!("İade 1003: {}", kutuphane.iade_et(1003));

    // Ön izleme (Modül 9): sort_by_key, her kitap için |k| k.kod ile verilen anahtara göre sıralar.
    // Struct sayesinde kitabın bütün bilgileri birlikte yer değiştirir.
    kutuphane.kitaplar.sort_by_key(|k| k.kod);

    print!("{}", kutuphane.listele());
    println!("Rafta {} / {} kitap", kutuphane.musait_sayisi(), kutuphane.kitaplar.len());
    dbg!(&kutuphane.kitaplar[0]);
}
```

En baştaki sıralama sorununu hatırla: paralel vektörlerde başlıkları sıralamak yazarları karıştırıyordu.
Burada `sort_by_key` her **`Kitap`'ı bir bütün olarak** yer değiştiriyor; bir kitabın başlığını yazarından
ayırmak artık **mümkün değil**. Struct'a geçmek bir hata sınıfını tamamen ortadan kaldırdı. `|k| k.kod`
yazımı bir **closure**'dır: "her kitap için kodunu anahtar olarak kullan" demek. Closure'ları Modül 9'da
tanıyacak, Modül 14'te derinlemesine öğreneceksin. Son satırdaki `dbg!` (Ders 3) ise `&` ile çağrıldığı
için kitabı taşımadan stderr'e yazdırıyor.

Bu tasarımda bilinçli olarak ertelediğimiz şeyler var. Hangi modülün hangisini çözeceğini bil:

| Şu anki sınırlama | Çözüm |
|---|---|
| `odunc_ver` neden başarısız olduğunu söyleyemiyor (`bool`) | `Option` ve `enum` (Modül 7), `Result` (Modül 10) |
| Herkes `kutuphane.kitaplar`'a doğrudan erişip `ekle`'nin kod kontrolünü atlayabilir | Gizli alanlar ve `pub` (Modül 8) |
| Kodu bulmak için bütün vektörü baştan sona dolaşıyoruz | `HashMap<u32, Kitap>` (Modül 9) |
| `kod` alanı ile üye numarası ikisi de `u32`; karıştırılabilir | Ders 2'deki newtype: `struct KitapKodu(u32);` |

Son satıra dikkat: newtype'ı **şimdi** de uygulayabilirsin. `odunc_ver(&mut self, kod: KitapKodu)` imzası,
yanlışlıkla bir üye numarasını kitap kodu yerine vermeyi derleme hatasına çevirir.

Son bir tasarım sorusu. Ders 4'te öğrendiğin alıcı seçimini hatırla:

```quiz
question: |
  Kütüphaneye `kapat(self) -> Vec<Kitap>` adında bir metot eklemek istiyoruz: şube kapanırken bütün
  kitapları başka bir şubeye devretmek için vektörü çağırana verecek. Bu metot için `self` alıcısı neden doğru seçim?
options:
  - "Metot vektörü kütüphanenin **içinden dışarı taşıyor**; bunun için kütüphanenin sahipliğini almalı. Çağrıdan sonra eski kütüphane kullanılamaz, ki kapanan bir şube için istenen de bu"
  - "`self` en hızlı alıcıdır; `&self` ve `&mut self` her çağrıda struct'ı kopyalar"
  - "`&mut self` ile de yazılabilirdi: `self.kitaplar`'ı doğrudan döndürmek yeterli"
  - "`self` yalnızca ilişkili fonksiyonlarda kullanılır; bu soruda ilişkili fonksiyon yazılmalı"
answer: 0
explanation: |
  `self.kitaplar`'ı döndürmek, alanı struct'ın **içinden taşımak** demektir. `&self` ya da `&mut self` ile bu
  mümkün değildir, ödünç aldığın bir şeyin parçasını götüremezsin (`E0507`). `self` alıcısı kütüphanenin
  sahipliğini alır; metot bitince kütüphanenin geri kalanı (adı) drop edilir ve kitapların sahibi artık
  çağırandır. Çağırandaki eski `kutuphane` değişkeni kullanılamaz: kapanmış bir şubeye kitap eklenemez.
  Derleyici bu iş kuralını senin yerine uyguluyor.
feedback:
  - Doğru!
  - "Tersine: `&self` ve `&mut self` struct'ı kopyalamaz, sadece bir referans (adres) verir. Seçim hız değil **anlam** meselesi."
  - "`&mut self` ile `self.kitaplar`'ı değer olarak döndüremezsin: `E0507` (cannot move out of `self.kitaplar` which is behind a mutable reference)."
  - "İlişkili fonksiyonlar `self` almayanlardır. `self` alan her fonksiyon bir metottur ve `kutuphane.kapat()` ile çağrılır."
```

```reflect
prompt: |
  Bu projede paralel vektörlerden `Kitap` ve `Kutuphane` struct'larına geçtin. Bu yeniden düzenlemenin
  (refactoring) kazandırdıklarını en az üç maddeyle, kendi cümlelerinle açıkla. Hangisi sence en önemlisi?
answer: |
  Model cevap:
  1. **Birlikte hareket eden veri birlikte durur.** Bir kitabın başlığı, yazarı ve durumu tek bir değerde;
     sıralama, ekleme, silme işlemleri kitabı bütün olarak taşır. Paralel vektörlerdeki "bir vektörü
     güncellemeyi unuttum" hatası artık yazılamaz.
  2. **Kurallar tek bir yerde.** "Yeni kitap rafta başlar" kuralı `Kitap::new`'de, "aynı kod iki kez
     olmaz" kuralı `ekle`'de. Kural değişince tek bir yeri düzeltirim.
  3. **İmzalar niyeti anlatır.** `&self` alan metotların kütüphaneyi değiştiremeyeceğini, `&mut self`
     alanların değiştirebileceğini derleyici garanti eder; `ekle(kitap: Kitap)` sahipliğin devredildiğini söyler.
  4. **Test edilebilirlik.** Her metot küçük, değer döndüren bir birim; testler onları tek tek doğrulayabiliyor.
  Bence en önemlisi ilki: bir hata sınıfını "dikkatli olmaya" değil, **tip sistemine** emanet ediyoruz.
```

## Özet

:::remember
- **Refactoring yolu:** birlikte değişen verileri bul → struct yap; elle yapılan işlemleri → metot yap; kuralları → kurucuya ve metotlara taşı.
- Paralel vektörler kırılgandır; bir kaydın bilgilerini **tek bir struct**'ta topla, koleksiyonu `Vec<Kitap>` olarak tut.
- `ekle(&mut self, kitap: Kitap)`: koleksiyon elemanlarının **sahibi** olur; eklenen değer çağırandan taşınır.
- Alıcıyı işe göre seç: okuyan → `&self`, değiştiren → `&mut self`, içini dışarı veren → `self`.
- Arama deseni: döngüde bul → işini yap → `return`; döngü bittiyse yok. Okurken `&self.v`, değiştirirken `self.v.iter_mut()`.
- `iter_mut` döngüsünün içinde `self.metot()` çağıramazsın (**E0499**); alanlara doğrudan eriş ya da indeksle dolaş. Vektörden silmek (`remove`) için indeksli döngü kullan.
- Test edilebilir tasarım: metotlar ekrana yazmak yerine **değer döndürsün** (`listele() -> String`).
:::

```flashcards
- front: Paralel vektörlerle (`basliklar`, `yazarlar`) tutulan verinin temel tehlikesi nedir?
  back: "Bağı derleyici bilmez: bir vektörü sıralamak, eklemek ya da silmek diğerlerini güncellemezse kayıtlar **sessizce** karışır."
- front: "`fn ekle(&mut self, kitap: Kitap)` imzası sahiplik hakkında ne söyler?"
  back: "Kütüphane değişir (`&mut self`) ve kitabın **sahipliği** kütüphaneye geçer; çağırandaki `kitap` artık kullanılamaz (E0382)."
- front: Bir vektördeki struct'ları değiştirerek dolaşmak için hangi döngü yazılır?
  back: "`for kitap in self.kitaplar.iter_mut()`; `kitap` bir `&mut Kitap` olur, alanlar `kitap.oduncte = true` ile değişir."
- front: "`iter_mut` döngüsünde `self.islem_say()` (`&mut self`) çağırmak neden `E0499` verir?"
  back: "Döngü `self.kitaplar`'ı `&mut` ödünç almış; metot imzası `self`'in **tamamını** ister. Aynı anda iki `&mut` olamaz."
- front: "`iter_mut` döngüsünde `self.islem_sayisi += 1` neden derlenir?"
  back: "Fonksiyon içinde derleyici **ayrı alanların** ödüncünü ayrı izler (disjoint field borrows); `kitaplar` ile `islem_sayisi` çakışmaz."
- front: "Bir vektörden arama sırasında eleman silmek (`remove`) için neden indeksli döngü kullanılır?"
  back: "`for k in &v` döngüsü vektörü ödünç tutar; içinde `v.remove(i)` yapıp döngüye devam etmek **E0502** verir. `for i in 0..v.len()` her erişimde kısa bir ödünç alır."
- front: Rapor üreten bir metot neden ekrana yazdırmak yerine `String` döndürmeli?
  back: Döndürülen değer test edilebilir, ekrana, dosyaya ya da başka bir yere verilebilir; ekrana yazan kodu test etmek zordur.
- front: "`&self` alan bir metottan bir `String` alanını döndürmek için neden `clone()` gerekir?"
  back: "Ödünç alınmış yapının içinden değer taşınamaz (**E0507**). Sahip olunan bir sonuç için bilinçli kopya gerekir."
```
