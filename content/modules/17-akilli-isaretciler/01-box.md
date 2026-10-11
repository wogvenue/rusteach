---
id: m17-l01
title: "Box<T>, heap'te tek sahip"
minutes: 22
type: lesson
objectives:
  - "`Box::new` ile heap'te değer oluşturup kullanabilmek ve `Box`'ın sahiplik kurallarına (taşıma, `drop`) nasıl uyduğunu açıklayabilmek"
  - "`E0072: recursive type has infinite size` hatasını okuyup özyinelemeli bir tipi `Box` ile düzeltebilmek"
  - "`Option<Box<Dugum>>` kullanarak bağlı liste ve ikili arama ağacı yazabilmek"
  - "Bir durumda `Box` gerekip gerekmediğine (bilinmeyen boyut, büyük veri, trait nesnesi) karar verebilmek"
keywords: [Box, "Box::new", akıllı işaretçi, smart pointer, heap, özyinelemeli tip, E0072, cons list, ikili ağaç, "Option<Box<T>>"]
---

Modül 4'te `String`'in stack'te küçük bir "başlık" (işaretçi + uzunluk + kapasite), heap'te de asıl
karakterleri tuttuğunu görmüştün. Peki **kendi** verini heap'e koymak istersen? Ya da derleyici sana
"bu tipin boyutu sonsuz" derse? Bu modül Rust'ın **akıllı işaretçilerini (smart pointers)** tanıtıyor;
ilki ve en sadesi `Box<T>`.

`Box` küçük bir araç gibi görünür ama onsuz Rust'ta bağlı liste, ağaç, ifade ağacı (derleyicilerin kalbi)
ya da "çalışma zamanında seçilen davranış" yazamazsın. Bu derste hepsinin temelini atacağız.

:::ferris
Bu modülde sahiplik kurallarını **çiğnemeyeceğiz**; onları akıllıca esneteceğiz. Box, Rc, RefCell...
Hepsi Modül 4-5'te öğrendiğin kurallar üzerine kurulu. Temelin sağlam, korkma! 🦀
:::

## Akıllı işaretçi nedir?

**İşaretçi (pointer)**, bellekte başka bir yeri gösteren bir adrestir. Rust'ta en sık gördüğün işaretçi
referanstır (`&T`): veriyi yalnızca **ödünç alır**, sahibi değildir ve ek bir maliyeti yoktur.

**Akıllı işaretçi** ise bir işaretçi gibi davranan ama ek yetenekleri olan bir **struct**'tır. Çoğu
zaman gösterdiği verinin **sahibidir**, ek bilgi (uzunluk, sayaç...) tutar ve kapsamdan çıkınca temizlik
yapar. Aslında farkında olmadan iki tanesini zaten kullanıyorsun: `String` ve `Vec<T>`. İkisi de heap'teki
verinin sahibidir, uzunluk/kapasite tutar ve `drop` edilince belleği serbest bırakır.

`Box<T>` bunların en yalını: heap'te **tek bir** `T` değeri tutar, başka hiçbir ek bilgi tutmaz.

```rust
fn main() {
    let b = Box::new(5); // 5 heap'e konur, b onu gösteren işaretçidir
    println!("b = {b}");
    let toplam = *b + 10; // * ile kutunun içindeki değere ulaşırız
    println!("toplam = {toplam}");
} // b kapsamdan çıkar: önce heap'teki 5 serbest bırakılır, sonra işaretçi silinir
```

```memory
title: "let b = Box::new(5);"
steps:
  - caption: "`b` stack'te yalnızca bir **adres** tutar (64 bit sistemde 8 bayt). `5` değeri heap'tedir."
    stack:
      - frame: main
        vars:
          - { name: b, type: "Box<i32>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "5", label: "i32" }
  - caption: "Kapsam bitince `b` drop edilir ve sahibi olduğu heap belleği de **otomatik** serbest kalır."
    stack:
      - frame: main
        vars:
          - { name: b, type: "Box<i32>", value: "ptr", moved: true, note: drop edildi }
    heap:
      - { id: h1, value: "5", label: "i32", freed: true }
```

Tek bir `i32`'yi heap'e koymanın pratik bir faydası yok; bu sadece mekanizmayı görmek için. Gerçek
kullanım alanlarına birazdan geleceğiz.

:::info Diğer dillerle karşılaştırma
- **C**: `int *p = malloc(sizeof(int)); *p = 5; ... free(p);`, `free`'yi unutursan sızıntı, iki kez
  çağırırsan *double free*, sonra kullanırsan *use-after-free*.
- **C++**: `std::unique_ptr<int> p = std::make_unique<int>(5);`, `Box`'ın en yakın akrabası. Ama C++'ta
  taşınmış bir `unique_ptr`'ı kullanmak derlenir ve çalışma zamanında boş işaretçiye çarpar.
- **Java/Python**: Her nesne zaten heap'te ve çöp toplayıcı (GC) temizler. Seçme şansın yoktur.

Rust'ta ise heap'e koymak **açık bir karardır**, temizlik derleyicinin garantisi altındadır.
:::

## Box da bir sahiptir

`Box<T>`, `String` gibi sahiplik kurallarına uyar. İçindeki değer `Copy` olsa bile kutunun kendisi
`Copy` değildir. Önce tahmin et:

```compiles
code: |
  fn main() {
      let a = Box::new(5);
      let b = a;
      println!("{a} {b}");
  }
answer: false
error: E0382
explanation: |
  `5` bir `i32` ve `Copy`'dir ama `Box<i32>` **değildir**. `Box` heap belleğinin **tek sahibidir**;
  kopyalanabilseydi iki kutu aynı belleği serbest bırakmaya çalışırdı (Modül 4'teki *double free*).
  Bu yüzden `let b = a;` kutuyu **taşır** ve `a` artık geçersizdir.
```

Hata mesajı Modül 4'ten tanıdık:

:::error
```text
error[E0382]: borrow of moved value: `a`
 --> src/main.rs:4:16
  |
2 |     let a = Box::new(5);
  |         - move occurs because `a` has type `Box<i32>`, which does not implement the `Copy` trait
3 |     let b = a;
  |             - value moved here
4 |     println!("{a} {b}");
  |                ^ value borrowed here after move
  |
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let b = a.clone();
  |              ++++++++
```
"`Box<i32>` `Copy` trait'ini uygulamıyor" cümlesi her şeyi anlatıyor: taşıma, `Box`'ın tek sahip
olmasının doğrudan sonucu. `help:` satırı `clone`'u öneriyor; `Box::clone` **heap'te yeni bir kutu**
ayırıp içeriği kopyalar. Gerçekten iki bağımsız kutu istiyorsan doğrudur, aksi hâlde gereksiz bir tahsistir.
:::

Taşıma **ucuzdur**: heap'teki veri yerinden kıpırdamaz, yalnızca stack'teki 8 baytlık adres kopyalanır.

```predict
code: |
  fn main() {
      let a = Box::new(5);
      let b = a;
      let c = *b + 1;
      println!("{b} {c}");
  }
options:
  - "5 6"
  - "ptr 6"
  - Derlenmez, çünkü `a` taşındı
  - "6 6"
answer: 0
explanation: |
  `a` taşındı ama sonra `a`'yı **kullanmıyoruz**; sorun yok. `*b` kutunun içindeki `5`'e ulaşır ve
  `*b + 1` → `6`. `println!` bir `Box<i32>`'yi yazdırırken adresi değil **içindeki değeri** gösterir:
  `Box<T>`, `T` yazdırılabiliyorsa onu yazdırır. Bu "içindekine yönlendirme" davranışını bir sonraki
  derste (`Deref`) ayrıntılı göreceğiz.
```

:::deep Box'ın içinden dışarı taşımak
`Box`'ın sana özel bir ayrıcalığı var: `*` ile içindeki değeri **dışarı taşıyabilirsin**.

```rust
fn main() {
    let kutu = Box::new(String::from("çay"));
    let s: String = *kutu; // String kutudan çıkarıldı; kutunun heap alanı serbest bırakıldı
    println!("{s}");
}
```

Bunu bir `&String` ile yapamazsın (`*r` ödünç alınmış veriyi taşıyamaz, E0507), çünkü referans sahip
değildir. `Box` ise tek sahip olduğu için derleyici bu taşımaya izin verir.
:::

## Boyutu bilinmeyen tip: özyinelemeli enum

Fonksiyonel dillerden gelen klasik bir veri yapısı: **cons listesi**. Her eleman bir değer ve
"listenin geri kalanı"ndan oluşur; liste `Bos` ile biter. Modül 7'deki enum bilginle hemen yazmayı dene:

```compiles
code: |
  enum Liste {
      Dugum(i32, Liste),
      Bos,
  }

  fn main() {}
answer: false
error: E0072
explanation: |
  Derleyici, her tipin stack'te **kaç bayt** kaplayacağını derleme zamanında bilmek zorundadır.
  `Liste`'nin boyutu = `i32` + `Liste`'nin boyutu = `i32` + `i32` + `Liste`'nin boyutu = ... Bu hesap
  hiç bitmez: tipin boyutu **sonsuzdur**.
```

:::error
```text
error[E0072]: recursive type `Liste` has infinite size
 --> src/main.rs:1:1
  |
1 | enum Liste {
  | ^^^^^^^^^^
2 |     Dugum(i32, Liste),
  |                ----- recursive without indirection
  |
help: insert some indirection (e.g., a `Box`, `Rc`, or `&`) to break the cycle
  |
2 |     Dugum(i32, Box<Liste>),
  |                ++++     +
```
"recursive without indirection" = "dolaylılık olmadan özyineleme". Derleyici çözümü de söylüyor:
araya bir **dolaylılık (indirection)**, yani değerin kendisi yerine onu gösteren bir işaretçi koy.
Önerdiği üç seçenek bu modülün konusu: `Box`, `Rc` ve `&`.
:::

Neden işe yarar? Bir `Box<Liste>`'nin boyutu, içindeki liste ne kadar uzun olursa olsun **sabittir**:
bir adres, yani 8 bayt. Böylece `Dugum`'un boyutu da sabitlenir: `i32` + 8 bayt (+ hangi varyant olduğunu
tutan etiket).

:::analogy Matruşka bebekleri ve adres kartları
Sonsuz boyutlu tip, her bebeğin içinde **kendisi kadar büyük** bir bebek olan bir matruşka setine benzer:
böyle bir seti hiçbir kutuya sığdıramazsın. `Box` ile her bebek, bir sonrakini içinde taşımak yerine onun
**nerede durduğunu yazan küçük bir kart** taşır. Kartın boyutu, gösterdiği bebek ne kadar büyük olursa
olsun aynıdır.
:::

```rust
#[derive(Debug)]
enum Liste {
    Dugum(i32, Box<Liste>),
    Bos,
}

use Liste::{Bos, Dugum};

fn toplam(liste: &Liste) -> i32 {
    match liste {
        Dugum(deger, kalan) => deger + toplam(kalan),
        Bos => 0,
    }
}

fn main() {
    let liste = Dugum(1, Box::new(Dugum(2, Box::new(Dugum(3, Box::new(Bos))))));
    println!("{liste:?}");
    println!("toplam = {}", toplam(&liste));
}
```

`match liste` bir **referans** üzerinde eşleştiriyor; bu yüzden `deger` bir `&i32`, `kalan` bir
`&Box<Liste>` olur. `toplam(kalan)` çağrısı `&Liste` beklerken `&Box<Liste>` alıyor ve yine de derleniyor.
Bu küçük sihrin adı **deref zorlaması (deref coercion)**; bir sonraki dersin konusu.

```memory
title: "Dugum(1, Box→Dugum(2, Box→Bos))"
steps:
  - caption: "İlk düğüm stack'te: değer + bir sonrakinin **adresi**. Geri kalan her düğüm heap'te ayrı bir kutuda."
    stack:
      - frame: main
        vars:
          - { name: liste, type: Liste, value: "Dugum(1, ptr)", to: h1 }
    heap:
      - { id: h1, value: "Dugum(2, ptr)", label: "Box<Liste>", to: h2 }
      - { id: h2, value: "Bos", label: "Box<Liste>" }
  - caption: "`liste` drop edilince zincirleme temizlik başlar: her kutu, kendi içindeki kutuyu da serbest bırakır."
    stack:
      - frame: main
        vars:
          - { name: liste, type: Liste, value: "Dugum(1, ptr)", moved: true, note: drop edildi }
    heap:
      - { id: h1, value: "Dugum(2, ptr)", label: "Box<Liste>", freed: true }
      - { id: h2, value: "Bos", label: "Box<Liste>", freed: true }
```

```predict
code: |
  #[derive(Debug)]
  enum Liste {
      Dugum(i32, Box<Liste>),
      Bos,
  }

  use Liste::{Bos, Dugum};

  fn main() {
      let kuyruk = Dugum(20, Box::new(Bos));
      let liste = Dugum(10, Box::new(kuyruk));
      println!("{liste:?}");
  }
options:
  - "Dugum(10, Dugum(20, Bos))"
  - "Dugum(10, Box(Dugum(20, Box(Bos))))"
  - "Dugum(20, Dugum(10, Bos))"
  - Derlenmez, çünkü `kuyruk` taşındı
answer: 0
explanation: |
  `kuyruk` yeni kutunun **içine taşınır**; sonra bir daha kullanılmadığı için sorun yok. `Box`'ın `Debug`
  çıktısı "şeffaftır": `Box(...)` diye bir sarmalayıcı göstermez, doğrudan içindekini yazar. Liste baştan
  sona `10 → 20 → Bos` sırasıyla basılır.
```

## Option<Box<Dugum>> ile ikili arama ağacı

Gerçek Rust kodunda özyinelemeli yapıları genellikle `enum` yerine bir struct ve `Option<Box<...>>`
alanlarıyla yazarız: "belki bir çocuk vardır, varsa heap'tedir". Bir **ikili arama ağacı (binary search
tree)** kuralı basittir: her düğümün solundakiler ondan **küçük**, sağındakiler **büyük ya da eşittir**.

Bir okulun öğrenci numaralarını hızlı aramak için ağaç kuralım:

```rust
#[derive(Debug)]
struct Dugum {
    deger: i32,
    sol: Option<Box<Dugum>>,
    sag: Option<Box<Dugum>>,
}

impl Dugum {
    fn yeni(deger: i32) -> Self {
        Dugum { deger, sol: None, sag: None }
    }

    fn ekle(&mut self, deger: i32) {
        // Hangi tarafa gideceğimize karar ver ve o alanı değiştirilebilir ödünç al.
        let hedef = if deger < self.deger { &mut self.sol } else { &mut self.sag };
        match hedef {
            Some(cocuk) => cocuk.ekle(deger), // çocuk varsa işi ona devret
            None => *hedef = Some(Box::new(Dugum::yeni(deger))), // yoksa yeni kutu aç
        }
    }

    // Sol alt ağaç → kendisi → sağ alt ağaç: sonuç küçükten büyüğe sıralı çıkar.
    fn sirali(&self, cikti: &mut Vec<i32>) {
        if let Some(sol) = &self.sol {
            sol.sirali(cikti);
        }
        cikti.push(self.deger);
        if let Some(sag) = &self.sag {
            sag.sirali(cikti);
        }
    }
}

fn main() {
    let mut kok = Dugum::yeni(50);
    for numara in [30, 70, 20, 40, 60, 80] {
        kok.ekle(numara);
    }
    let mut liste = Vec::new();
    kok.sirali(&mut liste);
    println!("{liste:?}");
}
```

Koda dikkatle bak: `cocuk` bir `&mut Box<Dugum>` ve `cocuk.ekle(deger)` çağrısı `Box`'ın içindeki
`Dugum`'un metodunu çalıştırıyor. Metot çağrılarında Rust kutuyu kendiliğinden açar (bunu da bir sonraki
derste göreceğiz).

```fill
prompt: |
  Bir oyunun skor tablosu için ağaç düğümü tanımlanıyor. Çocuk alanlarının tipini ve yeni bir çocuğun
  nasıl oluşturulacağını doldur.
code: |
  struct Skor {
      puan: u32,
      sol: ___0,
      sag: Option<Box<Skor>>,
  }

  impl Skor {
      fn yeni(puan: u32) -> Self {
          Skor { puan, sol: None, sag: None }
      }

      fn ekle(&mut self, puan: u32) {
          let hedef = if puan < self.puan { &mut self.sol } else { &mut self.sag };
          match hedef {
              Some(cocuk) => cocuk.ekle(puan),
              None => *hedef = ___1,
          }
      }

      fn en_buyuk(&self) -> u32 {
          match &self.sag {
              Some(sag) => sag.en_buyuk(),
              None => self.puan,
          }
      }
  }

  fn main() {
      let mut tablo = Skor::yeni(500);
      tablo.ekle(300);
      tablo.ekle(900);
      tablo.ekle(700);
      println!("rekor: {}", tablo.en_buyuk());
  }
blanks:
  - ["Option<Box<Skor>>"]
  - ["Some(Box::new(Skor::yeni(puan)))"]
explanation: |
  Çocuk "olabilir de olmayabilir de" → `Option`; varsa boyutu bilinmeyen bir alt ağaç → `Box`. Yeni çocuk
  için önce düğümü oluşturur (`Skor::yeni(puan)`), onu heap'e koyar (`Box::new`) ve "var" diye işaretleriz
  (`Some`). `en_buyuk` hep sağa giderek en büyük puanı bulur: `900`.
```

```quiz
question: |
  Neden ağaç düğümlerinde `Box<Option<Dugum>>` değil de `Option<Box<Dugum>>` yazıyoruz?
options:
  - "İkisi tamamen aynıdır, yalnızca bir yazım tercihi"
  - "`Option<Box<Dugum>>`'da çocuk yoksa (`None`) **hiç heap tahsisi yapılmaz**; ayrıca boyutu tek bir işaretçi kadardır"
  - "`Box<Option<Dugum>>` derlenmez, çünkü `Option` kutuya konamaz"
  - "`Option<Box<Dugum>>` veriyi stack'te tutar, bu yüzden daha hızlıdır"
answer: 1
explanation: |
  `Box<Option<Dugum>>` olsaydı, boş bir çocuk için bile heap'te bir `None` tutmak üzere tahsis yapardın:
  binlerce yaprak düğüm = binlerce gereksiz tahsis. `Option<Box<Dugum>>`'da `None` hiçbir şey ayırmaz.
  Üstelik bir `Box` asla boş (null) olamayacağı için derleyici `None`'u "adres = 0" olarak kodlar; böylece
  `Option<Box<Dugum>>` da tıpkı `Box` gibi **8 bayttır**. Buna **niş optimizasyonu (niche optimization)**
  denir (Modül 24'te ayrıntılı).
feedback:
  - "Bellek ve performans açısından belirgin bir fark var."
  - "Doğru!"
  - "Derlenir, sadece israflıdır."
  - "Veri her iki durumda da heap'tedir; fark, `None` için tahsis yapılıp yapılmamasıdır."
```

## Box ne zaman gerekir?

`Box` kullanmak için üç tipik sebep vardır:

| Durum | Neden `Box`? | Örnek |
|---|---|---|
| **1. Boyut derleme zamanında bilinmiyor** | Tipin kendisini içermesi gerekiyor (özyineleme) | bağlı liste, ağaç, ifade ağacı |
| **2. Büyük veriyi kopyalamadan taşımak** | Taşırken yalnızca 8 baytlık adres kopyalanır | büyük bir oyun haritası, görüntü tamponu |
| **3. "Bu trait'i uygulayan herhangi bir tip"** | Farklı boyutlu tipleri aynı kapta tutmak | `Box<dyn Fn(i32) -> i32>`, `Box<dyn Error>` |

İkinci durumu görelim:

```rust
fn main() {
    let harita = Box::new([0u8; 100_000]); // 100 KB'lık dizi heap'te
    let oyun_haritasi = harita; // yalnızca 8 baytlık adres kopyalandı, 100 KB değil
    println!("{} hücre", oyun_haritasi.len());
}
```

Kutusuz bir `[u8; 100_000]` taşındığında 100 000 baytın tamamı stack'te yeni yerine **kopyalanır**.
Kutuyla taşıma her zaman 8 bayttır.

Üçüncü durumun bir önizlemesini aslında Modül 10'da (`Box<dyn std::error::Error>`) ve Modül 14'te
(`Box<dyn Fn>`) gördün. Her closure'ın tipi farklı ve boyutları farklı olabilir; onları tek bir `Vec`'te
tutmak için her birini kutuya koyar, "bu bir `Fn(i32) -> i32`" diye ortak bir arayüzle bakarız:

```rust
fn main() {
    let adimlar: Vec<Box<dyn Fn(i32) -> i32>> = vec![
        Box::new(|x| x + 10),
        Box::new(|x| x * 2),
        Box::new(|x| x - 1),
    ];
    let mut deger = 5;
    for adim in &adimlar {
        deger = adim(deger);
    }
    println!("sonuç: {deger}"); // (5 + 10) * 2 - 1
}
```

`dyn Trait` ve **trait nesneleri (trait objects)** Modül 20'nin ana konusu; şimdilik "farklı tipleri
ortak bir trait arkasında kutulayabiliyoruz" demen yeterli.

:::warning Her şeyi kutulama
Java'dan gelenler bazen "nesneler heap'te yaşar" alışkanlığıyla her struct'ı `Box`'a koyar. Rust'ta bu
gereksizdir: her `Box::new` bir **heap tahsisi** ve her erişim fazladan bir **adres takibi (indirection)**
demektir. `Vec<T>` ve `String` zaten verilerini heap'te tutar; `Box<Vec<T>>` neredeyse hiçbir zaman
gerekmez. Kural: önce kutusuz yaz, derleyici (E0072) ya da gerçek bir ihtiyaç (yukarıdaki tablo)
istediğinde kutula.
:::

```quiz
question: Aşağıdakilerden hangisinde `Box` kullanmak **gerçekten gereklidir**?
options:
  - "`struct Ogrenci { ad: Box<String>, not: Box<u8> }`"
  - "`enum Ifade { Sayi(f64), Topla(Box<Ifade>, Box<Ifade>) }`"
  - "`let notlar: Box<Vec<u8>> = Box::new(vec![90, 75]);`"
  - "`fn kare(x: Box<i32>) -> Box<i32>`"
answer: 1
explanation: |
  `Ifade` kendini içeren özyinelemeli bir tiptir (`(2 + 3) + 4` gibi ifadeler). Kutusuz yazarsan
  E0072 alırsın. Diğerlerinde `Box` yalnızca gereksiz bir tahsis ekler: `String` ve `Vec` verilerini
  zaten heap'te tutar, `u8` ve `i32` gibi küçük `Copy` değerler doğrudan stack'te en verimli hâlindedir.
feedback:
  - "`String` verisini zaten heap'te tutar; `u8`'i kutulamak 1 baytlık veri için 8 baytlık adres + tahsis demek."
  - "Doğru! Özyinelemeli tip, `Box`'ın asıl kullanım alanı."
  - "`Vec` zaten heap'teki verinin sahibidir; kutulamak bir dolaylılık katmanı daha ekler."
  - "Küçük bir `Copy` değerini kutulamak yalnızca maliyet getirir."
```

## Alıştırmalar

Önce cons listesiyle ısın, sonra ağaçla devam et.

```exercise
id: m17-e-sepet-listesi
title: Sepet zinciri
difficulty: 2
prompt: |
  Bir market uygulaması alışveriş sepetini cons listesi olarak tutuyor. Üç fonksiyonu tamamla:

  - `olustur(fiyatlar: &[i32]) -> Liste`: dilimdeki fiyatlardan **aynı sırada** bir liste kurar
    (`&[1, 2]` → `Dugum(1, Dugum(2, Bos))`). Boş dilim → `Bos`.
  - `toplam(liste: &Liste) -> i32`: bütün fiyatların toplamı.
  - `uzunluk(liste: &Liste) -> usize`: düğüm (ürün) sayısı.
starter: |
  #[derive(Debug)]
  enum Liste {
      Dugum(i32, Box<Liste>),
      Bos,
  }

  use Liste::{Bos, Dugum};

  fn olustur(fiyatlar: &[i32]) -> Liste {
      todo!()
  }

  fn toplam(liste: &Liste) -> i32 {
      todo!()
  }

  fn uzunluk(liste: &Liste) -> usize {
      todo!()
  }

  fn main() {
      let sepet = olustur(&[120, 45, 300]);
      println!("{sepet:?}");
      println!("{} ürün, toplam {} TL", uzunluk(&sepet), toplam(&sepet));
  }
solution: |
  #[derive(Debug)]
  enum Liste {
      Dugum(i32, Box<Liste>),
      Bos,
  }

  use Liste::{Bos, Dugum};

  fn olustur(fiyatlar: &[i32]) -> Liste {
      let mut liste = Bos;
      for fiyat in fiyatlar.iter().rev() {
          liste = Dugum(*fiyat, Box::new(liste));
      }
      liste
  }

  fn toplam(liste: &Liste) -> i32 {
      match liste {
          Dugum(fiyat, kalan) => fiyat + toplam(kalan),
          Bos => 0,
      }
  }

  fn uzunluk(liste: &Liste) -> usize {
      match liste {
          Dugum(_, kalan) => 1 + uzunluk(kalan),
          Bos => 0,
      }
  }

  fn main() {
      let sepet = olustur(&[120, 45, 300]);
      println!("{sepet:?}");
      println!("{} ürün, toplam {} TL", uzunluk(&sepet), toplam(&sepet));
  }
check: tests
tests: |
  #[test]
  fn sirayi_korur() {
      let l = olustur(&[1, 2, 3]);
      assert_eq!(
          format!("{l:?}"),
          "Dugum(1, Dugum(2, Dugum(3, Bos)))",
          "liste, dilimdeki sırayla kurulmalı"
      );
  }

  #[test]
  fn bos_sepet() {
      let l = olustur(&[]);
      assert_eq!(format!("{l:?}"), "Bos", "boş dilim Bos listesi vermeli");
      assert_eq!(toplam(&l), 0, "boş sepetin toplamı 0'dır");
      assert_eq!(uzunluk(&l), 0, "boş sepette ürün yoktur");
  }

  #[test]
  fn toplam_ve_uzunluk() {
      let l = olustur(&[120, 45, 300, 35]);
      assert_eq!(toplam(&l), 500, "120 + 45 + 300 + 35 = 500");
      assert_eq!(uzunluk(&l), 4, "dört ürün var");
  }

  #[test]
  fn indirimli_negatif_fiyat() {
      let l = olustur(&[100, -20]);
      assert_eq!(toplam(&l), 80, "-20'lik indirim kuponu toplamdan düşmeli");
  }
hints:
  - "`toplam` ve `uzunluk` için `match liste { Dugum(..) => ..., Bos => ... }` kullan ve kalan liste için fonksiyonu **yeniden çağır** (özyineleme)."
  - "`olustur` için listeyi **sondan başa** kurmak en kolayı: `let mut liste = Bos;` ile başla, fiyatları `fiyatlar.iter().rev()` ile tersten dolaş."
  - "Döngü gövdesi: `liste = Dugum(*fiyat, Box::new(liste));`, eski liste yeni kutunun içine taşınır, sonra değişkene yeni baş düğüm atanır."
explanation: |
  **Neden tersten?** Cons listesinde yalnızca **başa** eklemek ucuzdur: yeni bir düğüm oluşturup eski
  listeyi onun kutusuna taşırsın. Fiyatları sondan başa dolaşırsak son eklenen (ilk fiyat) en başta kalır.

  `liste = Dugum(*fiyat, Box::new(liste));` satırı sahipliğin güzel bir örneği: sağ tarafta `liste`
  **taşınır** (değişken bir an için geçersizdir), sonra hemen yeni bir değer atanır. Rust bunu kabul eder,
  çünkü taşınmış bir değişkene yeniden atama yapmak her zaman güvenlidir.

  `toplam(kalan)` çağrısında `kalan` bir `&Box<Liste>`'dir; fonksiyon `&Liste` bekler. Arada `Box` açılır
  (deref zorlaması, sonraki ders). Alternatif olarak döngüyle de toplayabilirdin:
  `let mut simdiki = liste; while let Dugum(f, kalan) = simdiki { t += f; simdiki = kalan; }`.
```

```exercise
id: m17-e-ogrenci-agaci
title: Öğrenci numarası ağacı
difficulty: 3
prompt: |
  Okulun öğrenci numaralarını tutan ikili arama ağacına (`ekle` hazır) üç metot ekle:

  - `icerir(&self, aranan: i32) -> bool`: numara ağaçta var mı? Ağacın kuralını kullan:
    bütün ağacı dolaşma, yalnızca doğru tarafa in.
  - `en_kucuk(&self) -> i32`: ağaçtaki en küçük numara (hep sola git).
  - `yukseklik(&self) -> usize`: kökten en uzak yaprağa kadar düğüm sayısı (tek düğüm = 1).
starter: |
  struct Dugum {
      deger: i32,
      sol: Option<Box<Dugum>>,
      sag: Option<Box<Dugum>>,
  }

  impl Dugum {
      fn yeni(deger: i32) -> Self {
          Dugum { deger, sol: None, sag: None }
      }

      fn ekle(&mut self, deger: i32) {
          let hedef = if deger < self.deger { &mut self.sol } else { &mut self.sag };
          match hedef {
              Some(cocuk) => cocuk.ekle(deger),
              None => *hedef = Some(Box::new(Dugum::yeni(deger))),
          }
      }

      fn icerir(&self, aranan: i32) -> bool {
          todo!()
      }

      fn en_kucuk(&self) -> i32 {
          todo!()
      }

      fn yukseklik(&self) -> usize {
          todo!()
      }
  }

  fn main() {
      let mut kok = Dugum::yeni(1050);
      for n in [1020, 1080, 1010, 1030] {
          kok.ekle(n);
      }
      println!("1030 var mı? {}", kok.icerir(1030));
      println!("en küçük: {}", kok.en_kucuk());
      println!("yükseklik: {}", kok.yukseklik());
  }
solution: |
  struct Dugum {
      deger: i32,
      sol: Option<Box<Dugum>>,
      sag: Option<Box<Dugum>>,
  }

  impl Dugum {
      fn yeni(deger: i32) -> Self {
          Dugum { deger, sol: None, sag: None }
      }

      fn ekle(&mut self, deger: i32) {
          let hedef = if deger < self.deger { &mut self.sol } else { &mut self.sag };
          match hedef {
              Some(cocuk) => cocuk.ekle(deger),
              None => *hedef = Some(Box::new(Dugum::yeni(deger))),
          }
      }

      fn icerir(&self, aranan: i32) -> bool {
          if aranan == self.deger {
              return true;
          }
          let taraf = if aranan < self.deger { &self.sol } else { &self.sag };
          match taraf {
              Some(cocuk) => cocuk.icerir(aranan),
              None => false,
          }
      }

      fn en_kucuk(&self) -> i32 {
          let mut simdiki = self;
          while let Some(sol) = &simdiki.sol {
              simdiki = sol;
          }
          simdiki.deger
      }

      fn yukseklik(&self) -> usize {
          let sol = match &self.sol {
              Some(d) => d.yukseklik(),
              None => 0,
          };
          let sag = match &self.sag {
              Some(d) => d.yukseklik(),
              None => 0,
          };
          1 + sol.max(sag)
      }
  }

  fn main() {
      let mut kok = Dugum::yeni(1050);
      for n in [1020, 1080, 1010, 1030] {
          kok.ekle(n);
      }
      println!("1030 var mı? {}", kok.icerir(1030));
      println!("en küçük: {}", kok.en_kucuk());
      println!("yükseklik: {}", kok.yukseklik());
  }
check: tests
tests: |
  fn agac(kok: i32, digerleri: &[i32]) -> Dugum {
      let mut d = Dugum::yeni(kok);
      for n in digerleri {
          d.ekle(*n);
      }
      d
  }

  #[test]
  fn icerir_dogru_cevap_verir() {
      let a = agac(50, &[30, 70, 20, 40, 60, 80]);
      for n in [50, 30, 70, 20, 40, 60, 80] {
          assert!(a.icerir(n), "{n} ağaca eklendi, bulunmalı");
      }
      for n in [10, 35, 65, 90] {
          assert!(!a.icerir(n), "{n} ağaçta yok, false dönmeli");
      }
  }

  #[test]
  fn en_kucugu_bulur() {
      assert_eq!(agac(50, &[30, 70, 20, 40]).en_kucuk(), 20, "en sol düğüm 20");
      assert_eq!(agac(5, &[8, 9]).en_kucuk(), 5, "solda çocuk yoksa kökün kendisi en küçüktür");
  }

  #[test]
  fn yukseklik_dengeli_ve_tek_dugum() {
      assert_eq!(Dugum::yeni(1).yukseklik(), 1, "tek düğümlü ağacın yüksekliği 1");
      assert_eq!(agac(50, &[30, 70, 20, 40, 60, 80]).yukseklik(), 3, "dengeli 7 düğüm → yükseklik 3");
  }

  #[test]
  fn yukseklik_dengesiz_agac() {
      let a = agac(1, &[2, 3, 4, 5]);
      assert_eq!(a.yukseklik(), 5, "sıralı eklenen sayılar ağacı bir zincire çevirir");
      assert!(a.icerir(5) && !a.icerir(6), "zincirde de arama doğru çalışmalı");
  }
hints:
  - "`icerir`: önce `aranan == self.deger` mi diye bak. Değilse `ekle`'deki gibi doğru tarafı seç: `let taraf = if aranan < self.deger { &self.sol } else { &self.sag };`"
  - "`en_kucuk` için döngü yeterli: `let mut simdiki = self; while let Some(sol) = &simdiki.sol { simdiki = sol; }`, `sol` bir `&Box<Dugum>`, `simdiki` ise `&Dugum`; atama deref zorlamasıyla çalışır."
  - "`yukseklik`: iki tarafın yüksekliğini ayrı ayrı hesapla (çocuk yoksa 0), sonra `1 + sol.max(sag)` döndür."
explanation: |
  **Neden hızlı?** `icerir` her adımda ağacın yarısını eler: dengeli bir ağaçta 1 milyon numara arasında
  yaklaşık 20 adımda sonuca ulaşırsın (O(log n)). Ama son test bir tuzağı gösteriyor: numaralar **sıralı**
  eklenirse ağaç bir zincire döner ve arama O(n)'e düşer. Gerçek projelerde bu yüzden kendini dengeleyen
  ağaçlar kullanılır; standart kütüphanedeki `BTreeMap` (Modül 9) tam olarak budur.

  `en_kucuk`'taki `simdiki = sol;` satırında `&Box<Dugum>` → `&Dugum` dönüşümü kendiliğinden olur.
  `yukseklik`'teki iki `match`, `Option`'ın standart kütüphanedeki `map_or` metoduyla tek satıra da
  inebilir: `self.sol.as_ref().map_or(0, |d| d.yukseklik())`, yani "`None` ise `0`, `Some(d)` ise
  closure'ın sonucu". `as_ref()` burada `&Option<Box<Dugum>>`'yi `Option<&Box<Dugum>>`'ye çevirir; böylece
  kutu taşınmaz, yalnızca ödünç alınır.

  Özyinelemeli metotlar ağaç için doğaldır ama çok derin (örneğin 1 milyonluk zincir) bir yapıda stack'i
  taşırabilir; `en_kucuk`'taki gibi döngüyle yazmak bu riski ortadan kaldırır.
```

## Özet

:::remember
- **Akıllı işaretçi** = işaretçi gibi davranan, genellikle verinin sahibi olan bir struct. `String` ve `Vec` de birer akıllı işaretçidir.
- `Box::new(x)`: `x` heap'e konur, stack'te 8 baytlık bir adres kalır. Kutu kapsamdan çıkınca heap belleği otomatik serbest kalır.
- `Box<T>` tek sahiptir: `Copy` değildir, atamada **taşınır** (E0382), taşıma ucuzdur.
- Özyinelemeli tip → **E0072** (sonsuz boyut). Çözüm: araya `Box` gibi bir dolaylılık koy.
- Ağaçlarda çocuklar: `Option<Box<Dugum>>` (boşken tahsis yok, boyutu = bir işaretçi).
- `Box` gerekir: bilinmeyen boyut, büyük veriyi ucuz taşıma, `Box<dyn Trait>`. Aksi hâlde kutulama.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, derleyici neden her tipin boyutunu derleme zamanında bilmek ister ve `Box` özyinelemeli bir tipte bu sorunu nasıl çözer?
answer: |
  Model cevap: Derleyici, bir değişkeni stack'e koymak, fonksiyona geçirmek ya da bir struct'ın alanları
  için yer ayırmak üzere tipin kaç bayt tuttuğunu önceden bilmek zorundadır. Kendini doğrudan içeren bir
  tipin boyutu kendi boyutuna bağlı olduğu için hesap hiç bitmez (sonsuz boyut, E0072). `Box<T>` ise
  içindeki veri ne kadar büyük olursa olsun sabit boyutlu bir adrestir (8 bayt); asıl veri heap'te
  durur. Böylece tipin boyutu sabitlenir, özyineleme "değerin içinde değer" yerine "değerin içinde
  adres" olur.
```

```flashcards
- front: "`Box::new(5)` çalıştığında `5` nerede durur, stack'te ne kalır?"
  back: "`5` heap'te durur; stack'te yalnızca onu gösteren bir adres (64 bit sistemde 8 bayt) kalır."
- front: "`let b = a;` (`a: Box<i32>`) satırından sonra `a` kullanılabilir mi?"
  back: "Hayır. `Box` `Copy` değildir; kutu **taşınır**, `a`'yı kullanmak E0382 verir."
- front: "`E0072: recursive type has infinite size` hatası ne demektir ve nasıl düzeltilir?"
  back: "Tip kendini doğrudan içeriyor, boyutu hesaplanamıyor. Araya bir dolaylılık koy: `Box<Liste>` (ya da `Rc`, `&`)."
- front: "Ağaç düğümünde çocuk alanının idiomatik tipi nedir?"
  back: "`Option<Box<Dugum>>`, çocuk yoksa `None` (tahsis yok), varsa heap'te kutulu düğüm."
- front: "`Box` kullanmayı gerektiren üç tipik durum nedir?"
  back: "1) Boyutu derleme zamanında bilinmeyen (özyinelemeli) tipler, 2) büyük veriyi kopyalamadan taşımak, 3) trait nesneleri (`Box<dyn Trait>`)."
- front: "`size_of::<Option<Box<T>>>()` neden `size_of::<Box<T>>()` ile aynıdır?"
  back: "`Box` asla null olamaz; derleyici `None`'u adres = 0 olarak kodlar (niş optimizasyonu). Ek etiket gerekmez."
- front: "Bir `Box<String>`'in içindeki `String`'i nasıl dışarı taşırsın?"
  back: "`let s = *kutu;`, `Box` tek sahip olduğu için `*` ile içinden taşımaya izin verir (bir `&String` ile bu yapılamaz)."
```
