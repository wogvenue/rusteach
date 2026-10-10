---
id: m17-l06
title: "Referans döngüleri ve Weak<T>"
minutes: 24
type: lesson
objectives:
  - "`Rc<RefCell<..>>` ile bir referans döngüsü kurulduğunda belleğin neden sızdığını `strong_count` üzerinden açıklayabilmek"
  - "`Rc::downgrade` ile `Weak<T>` oluşturup `upgrade()` ile dönen `Option<Rc<T>>`'yi doğru kullanabilmek"
  - "Ebeveyni `Weak`, çocukları `Rc` ile tutan bir ağaç kurup `strong_count` / `weak_count` değerlerini önceden söyleyebilmek"
  - "Bir veri yapısında hangi bağlantının güçlü, hangisinin zayıf olacağına (ya da indeksli bir arena kullanmaya) karar verebilmek"
keywords: [Weak, "Rc::downgrade", upgrade, weak_count, strong_count, referans döngüsü, reference cycle, bellek sızıntısı, memory leak, ağaç, arena]
---

Rust bellek güvenliğini garanti eder: serbest bırakılmış belleği kullanamazsın, aynı belleği iki kez
serbest bırakamazsın. Ama dikkat et, "bellek **hiç** sızmaz" demedik. 3. derste `mem::forget`'in güvenli
olduğunu görmüştün. Bu derste, hiç `forget` yazmadan, yalnızca `Rc` ve `RefCell` ile **kazara** sızıntı
yaratmayı göreceğiz. Sonra da çözümü: sahip olmadan gösteren işaretçi, `Weak<T>`.

## Birbirini tutan iki Rc

İki kişi birbirini "arkadaş" olarak kaydediyor. Her biri diğerine bir `Rc` tutuyor. `arkadas` alanı
sonradan atanacağı için `RefCell` içinde (önceki ders):

```predict
code: |
  use std::cell::RefCell;
  use std::rc::Rc;

  struct Kisi {
      ad: String,
      arkadas: RefCell<Option<Rc<Kisi>>>,
  }

  impl Drop for Kisi {
      fn drop(&mut self) {
          println!("{} bırakıldı", self.ad);
      }
  }

  fn main() {
      let ali = Rc::new(Kisi { ad: String::from("Ali"), arkadas: RefCell::new(None) });
      let veli = Rc::new(Kisi { ad: String::from("Veli"), arkadas: RefCell::new(None) });
      *ali.arkadas.borrow_mut() = Some(Rc::clone(&veli));
      *veli.arkadas.borrow_mut() = Some(Rc::clone(&ali));
      println!("ali: {}, veli: {}", Rc::strong_count(&ali), Rc::strong_count(&veli));
      println!("main bitiyor");
  }
options:
  - |
    ali: 2, veli: 2
    main bitiyor
  - |
    ali: 2, veli: 2
    main bitiyor
    Veli bırakıldı
    Ali bırakıldı
  - |
    ali: 1, veli: 1
    main bitiyor
    Veli bırakıldı
    Ali bırakıldı
  - Panik atar, çünkü `RefCell` iki kez ödünç alınıyor
answer: 0
explanation: |
  Her kişinin iki sahibi var: kendi değişkeni ve diğerinin `arkadas` alanı. `main` bitince `veli` ve
  `ali` değişkenleri drop edilir, sayaçlar **2'den 1'e** iner. Ama sıfıra inmez: Ali'yi Veli'nin alanı,
  Veli'yi Ali'nin alanı hâlâ tutuyor. Sayaç sıfıra inmediği için `drop` **hiç çalışmaz**. "bırakıldı"
  satırları yazdırılmaz ve iki `Kisi`'nin belleği program bitene kadar sızar.
```

```memory
title: Referans döngüsü
steps:
  - caption: "`main` sırasında: her kutunun iki güçlü sahibi var: bir stack değişkeni ve diğer kutunun `arkadas` alanı."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Kisi>", value: "ptr", to: h1 }
          - { name: veli, type: "Rc<Kisi>", value: "ptr", to: h2 }
    heap:
      - { id: h1, value: "strong=2 · Ali · arkadas: Some(ptr)", to: h2 }
      - { id: h2, value: "strong=2 · Veli · arkadas: Some(ptr)", to: h1 }
  - caption: "`main` bitti: stack değişkenleri yok oldu, sayaçlar 1'e indi. Kutular **birbirini** yaşatıyor; artık hiçbir değişken onlara ulaşamıyor ama bellekte duruyorlar: **sızıntı**."
    stack:
      - frame: main
        vars:
          - { name: ali, type: "Rc<Kisi>", value: "ptr", moved: true, note: drop edildi }
          - { name: veli, type: "Rc<Kisi>", value: "ptr", moved: true, note: drop edildi }
    heap:
      - { id: h1, value: "strong=1 · Ali", label: "sızdı", to: h2 }
      - { id: h2, value: "strong=1 · Veli", label: "sızdı", to: h1 }
```

Bu küçük programda zarar yok; işletim sistemi program bitince bütün belleği geri alır. Ama saatlerce,
günlerce çalışan bir sunucuda her istek böyle bir döngü bırakırsa bellek yavaş yavaş dolar.

:::info Rust neden bunu engellemiyor?
Referans sayımı (Python, Swift, C++'taki `shared_ptr`) döngüleri **kendi başına** temizleyemez. Python
bunun için ayrıca bir döngü toplayıcı çalıştırır; Swift ve C++ ise Rust gibi programcıdan `weak`
kullanmasını bekler. Bir döngünün varlığını derleme zamanında kanıtlamak genel olarak imkânsızdır. Bu yüzden
Rust sızıntıyı **bellek güvenliği ihlali saymaz**: sızan bellek hiçbir zaman serbest bırakılmadığı için
ona erişmek de tehlikeli değildir (use-after-free ya da double free olmaz); yalnızca israf edilir.
`mem::forget` bu yüzden güvenli bir fonksiyondur. Standart kütüphanede bilerek sızdıran bir fonksiyon daha
var: `Box::leak(kutu)`, kutuyu hiç bırakmaz ve içindeki değere program sonuna kadar geçerli bir
`&'static mut` referans döndürür.
:::

## Weak<T>: sahip olmadan göstermek

Çözüm, döngüdeki bağlantılardan en az birinin **sahiplik taşımamasıdır**. `Weak<T>` tam olarak bu:
bir `Rc`'nin gösterdiği değeri gösterir ama **güçlü sayaca katkıda bulunmaz**. Değer, yalnızca güçlü
sahipler bitene kadar yaşar; zayıf işaretçiler onu yaşatamaz.

- `Rc::downgrade(&rc)` → `Weak<T>` (zayıf sayacı bir artırır)
- `weak.upgrade()` → `Option<Rc<T>>`: değer hâlâ yaşıyorsa `Some(rc)` (geçici bir güçlü sahip),
  çoktan drop edildiyse `None`
- `Rc::weak_count(&rc)`: kaç zayıf işaretçi var

:::analogy Telefon rehberi
Bir arkadaşının telefon numarasını rehberine kaydetmek, onu **şehirde tutmaz**. Taşınabilir, numarasını
kapatabilir. Aradığında ya açar (`Some`) ya da "bu numara kullanılmıyor" mesajı duyarsın (`None`). Bu
yüzden her aramada sonucu kontrol etmek zorundasın. `Weak` bir rehber kaydıdır, `upgrade` ise aramaktır.
Evin anahtarı (bir `Rc`) ise gerçekten sahip olmak demektir.
:::

```predict
code: |
  use std::rc::Rc;

  fn main() {
      let rapor = Rc::new(String::from("hava durumu raporu"));
      let zayif = Rc::downgrade(&rapor);
      println!("{} {}", Rc::strong_count(&rapor), Rc::weak_count(&rapor));

      if let Some(r) = zayif.upgrade() {
          println!("okundu: {r} ({} güçlü)", Rc::strong_count(&r));
      }

      drop(rapor);
      println!("{:?}", zayif.upgrade());
  }
options:
  - |
    1 1
    okundu: hava durumu raporu (2 güçlü)
    None
  - |
    2 0
    okundu: hava durumu raporu (2 güçlü)
    Some("hava durumu raporu")
  - |
    1 1
    okundu: hava durumu raporu (1 güçlü)
    None
  - |
    1 1
    okundu: hava durumu raporu (2 güçlü)
    Some("hava durumu raporu")
answer: 0
explanation: |
  `downgrade` güçlü sayaca dokunmaz: güçlü 1, zayıf 1. `upgrade` başarılı olunca dönen `r` **geçici bir
  güçlü sahiptir**. `if let` bloğu boyunca sayaç 2 olur, blok bitince `r` drop edilir. `drop(rapor)` son
  güçlü sahibi bırakır: `String` drop edilir. Zayıf işaretçi değeri yaşatamadığı için artık `upgrade`
  `None` döndürür.
```

`Weak` neden doğrudan `Deref` uygulamaz da her seferinde `upgrade` ister? Çünkü gösterdiği değer **her an
yok olmuş olabilir**. Rust, "belki ölmüş bir değere" doğrudan erişmene izin vermez:

```compiles
code: |
  use std::rc::{Rc, Weak};

  struct Klasor {
      ad: String,
  }

  fn main() {
      let kok = Rc::new(Klasor { ad: String::from("belgeler") });
      let zayif: Weak<Klasor> = Rc::downgrade(&kok);
      println!("{}", zayif.ad);
  }
answer: false
error: E0609
explanation: |
  `Weak<T>` `Deref` uygulamaz; auto-deref onu açamaz, bu yüzden `ad` alanı "bilinmeyen alan" olur.
  Doğrusu `if let Some(k) = zayif.upgrade() { println!("{}", k.ad); }`. `Option` dönüşü, "değer gitmiş
  olabilir" ihtimalini **tip sistemine** yazar (Modül 7'deki null'suz dünya). C++'ta zayıf işaretçiyi
  kontrolsüz kullanmak *use-after-free* olurdu; Rust'ta derlenmez.
```

:::error
```text
error[E0609]: no field `ad` on type `std::rc::Weak<Klasor>`
  --> src/main.rs:10:26
   |
10 |     println!("{}", zayif.ad);
   |                          ^^ unknown field
```
:::

Arkadaşlık örneğini `Weak` ile düzeltelim. Artık kimse diğerinin sahibi değil, yalnızca "rehberinde
kayıtlı":

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Kisi {
    ad: String,
    arkadas: RefCell<Weak<Kisi>>,
}

impl Drop for Kisi {
    fn drop(&mut self) {
        println!("{} bırakıldı", self.ad);
    }
}

fn main() {
    let ali = Rc::new(Kisi { ad: String::from("Ali"), arkadas: RefCell::new(Weak::new()) });
    let veli = Rc::new(Kisi { ad: String::from("Veli"), arkadas: RefCell::new(Weak::new()) });
    *ali.arkadas.borrow_mut() = Rc::downgrade(&veli);
    *veli.arkadas.borrow_mut() = Rc::downgrade(&ali);

    if let Some(a) = ali.arkadas.borrow().upgrade() {
        println!("{}'nin arkadaşı {}", ali.ad, a.ad);
    }
    println!(
        "güçlü: {} {}, zayıf: {} {}",
        Rc::strong_count(&ali),
        Rc::strong_count(&veli),
        Rc::weak_count(&ali),
        Rc::weak_count(&veli)
    );
} // güçlü sayaçlar 0'a iner: ikisi de gerçekten bırakılır
```

`Weak::new()` hiçbir şeyi göstermeyen boş bir zayıf işaretçi oluşturur (`upgrade` her zaman `None`
döndürür). `Option<Weak<T>>` yazmaya gerek kalmaz.

## Ebeveyni bilen ağaç

`Weak`'in en klasik kullanımı: çocuklarını **ve** ebeveynini bilen bir ağaç. Bilgisayarındaki klasör
yapısını düşün. Bir klasör alt klasörlerinin **sahibidir**: üst klasörü silersen alttakiler de gider. Ama
bir alt klasör, üst klasörünün sahibi **değildir**; yalnızca onu bilir (".." ile yukarı çıkabilmek için).

| Bağlantı | Tip | Neden |
|---|---|---|
| ebeveyn → çocuklar | `RefCell<Vec<Rc<Klasor>>>` | sahiplik; sonradan çocuk eklenebilsin diye `RefCell` |
| çocuk → ebeveyn | `RefCell<Weak<Klasor>>` | sahiplik **yok**; döngü olmasın diye `Weak` |

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Klasor {
    ad: String,
    ust: RefCell<Weak<Klasor>>,
    alt: RefCell<Vec<Rc<Klasor>>>,
}

impl Klasor {
    fn yeni(ad: &str) -> Rc<Klasor> {
        Rc::new(Klasor {
            ad: ad.to_string(),
            ust: RefCell::new(Weak::new()),
            alt: RefCell::new(Vec::new()),
        })
    }
}

fn alta_ekle(ust: &Rc<Klasor>, cocuk: &Rc<Klasor>) {
    *cocuk.ust.borrow_mut() = Rc::downgrade(ust); // çocuk ebeveynini bilir (zayıf)
    ust.alt.borrow_mut().push(Rc::clone(cocuk)); // ebeveyn çocuğuna sahip olur (güçlü)
}

fn yol(k: &Rc<Klasor>) -> String {
    match k.ust.borrow().upgrade() {
        Some(ust) => format!("{}/{}", yol(&ust), k.ad),
        None => k.ad.clone(),
    }
}

fn main() {
    let belgeler = Klasor::yeni("belgeler");
    let okul = Klasor::yeni("okul");
    let odevler = Klasor::yeni("odevler");
    alta_ekle(&belgeler, &okul);
    alta_ekle(&okul, &odevler);

    println!("{}", yol(&odevler));
    println!("belgeler'in {} alt klasörü var", belgeler.alt.borrow().len());
    println!("okul: güçlü {}, zayıf {}", Rc::strong_count(&okul), Rc::weak_count(&okul));
}
```

```memory
title: Klasör ağacı
steps:
  - caption: "Güçlü bağlar aşağı doğru (`alt`), zayıf bağlar yukarı doğru (`ust`). `okul`'un iki güçlü sahibi var (`okul` değişkeni + `belgeler.alt`) ve bir zayıf göstericisi (`odevler.ust`)."
    stack:
      - frame: main
        vars:
          - { name: belgeler, type: "Rc<Klasor>", value: "ptr", to: h1 }
          - { name: okul, type: "Rc<Klasor>", value: "ptr", to: h2 }
          - { name: odevler, type: "Rc<Klasor>", value: "ptr", to: h3 }
    heap:
      - { id: h1, value: "strong=1 weak=1 · belgeler · alt: [okul]", to: h2 }
      - { id: h2, value: "strong=2 weak=1 · okul · ust ⇢ belgeler (zayıf) · alt: [odevler]", to: h3 }
      - { id: h3, value: "strong=2 weak=0 · odevler · ust ⇢ okul (zayıf)" }
```

Yukarı doğru hiçbir güçlü bağ olmadığı için döngü yok. `main` bittiğinde önce `odevler`, sonra `okul`,
sonra `belgeler` değişkeni drop edilir. `belgeler`'in güçlü sayacı 0 olur, kutusu bırakılır. Bu sırada `alt`
vektörü de drop edildiği için `okul`'un sayacı 0'a iner ve zincirleme her şey temizlenir.

```predict
code: |
  use std::cell::RefCell;
  use std::rc::{Rc, Weak};

  struct Klasor {
      ad: String,
      ust: RefCell<Weak<Klasor>>,
      alt: RefCell<Vec<Rc<Klasor>>>,
  }

  fn yeni(ad: &str) -> Rc<Klasor> {
      Rc::new(Klasor {
          ad: ad.to_string(),
          ust: RefCell::new(Weak::new()),
          alt: RefCell::new(Vec::new()),
      })
  }

  fn main() {
      let foto = yeni("foto");
      {
          let tatil = yeni("tatil");
          *foto.ust.borrow_mut() = Rc::downgrade(&tatil);
          tatil.alt.borrow_mut().push(Rc::clone(&foto));
          let ust_adi = foto.ust.borrow().upgrade().map(|u| u.ad.clone());
          println!("{ust_adi:?} {} {}", Rc::strong_count(&foto), Rc::weak_count(&tatil));
      }
      let ust_adi = foto.ust.borrow().upgrade().map(|u| u.ad.clone());
      println!("{ust_adi:?} {} {}", Rc::strong_count(&foto), foto.alt.borrow().len());
  }
options:
  - |
    Some("tatil") 2 1
    None 1 0
  - |
    Some("tatil") 2 1
    Some("tatil") 2 0
  - |
    Some("tatil") 1 1
    None 1 0
  - |
    Some("tatil") 2 0
    None 2 0
answer: 0
explanation: |
  İç blokta `foto`'nun iki güçlü sahibi var (değişkeni + `tatil.alt`); `tatil`'in bir zayıf göstericisi var
  (`foto.ust`). Blok bitince `tatil` değişkeni drop edilir. Onun **tek** güçlü sahibi oydu, bu yüzden
  `tatil` kutusu bırakılır. Onunla birlikte `alt` vektörü de gider ve `foto`'nun sayacı 1'e iner. `foto.ust`
  hâlâ bir `Weak` tutuyor ama gösterdiği değer artık yok: `upgrade` → `None`. Ebeveyn `Rc` ile tutulsaydı
  `tatil` asla bırakılmazdı (döngü!).
```

## Sahiplik tasarım rehberi

Bir yapıya `Rc`/`Weak` yerleştirirken kendine tek bir soru sor: **"Kim kimi yaşatmalı?"**

- **Sahiplik hiyerarşisi** (ebeveyn → çocuk, liste → eleman, uygulama → pencere): güçlü (`Rc` ya da
  doğrudan sahiplik, mümkünse `Box`/`Vec`).
- **Geriye/yukarı bakan bağlantılar** (çocuk → ebeveyn, pencere → uygulama): zayıf (`Weak`).
- **Gözlemciler ve önbellekler** (bir olay yayıncısının aboneleri, "varsa kullan" önbelleği): genellikle
  `Weak`. Abone kendiliğinden yok olabilmeli, yayıncı onu zorla yaşatmamalı.
- Graf gibi **gerçekten döngülü** yapılar: düğümlerin sahibi tek bir yapı olsun, bağlantılar ise
  **indeks** tutsun.

Sonuncusu Rust'ta çok yaygın bir desendir: **arena (indeksli depo)**. Düğümler bir `Vec`'te yaşar,
birbirlerine `usize` indeksleriyle "işaret ederler". Ne `Rc` ne `RefCell` gerekir, sızıntı imkânsızdır ve
borrow checker tamamen devrededir:

```rust
struct Dugum {
    ad: String,
    komsular: Vec<usize>, // diğer düğümlerin indeksleri
}

struct Harita {
    dugumler: Vec<Dugum>,
}

impl Harita {
    fn ekle(&mut self, ad: &str) -> usize {
        self.dugumler.push(Dugum { ad: ad.to_string(), komsular: Vec::new() });
        self.dugumler.len() - 1
    }

    fn baglat(&mut self, a: usize, b: usize) {
        self.dugumler[a].komsular.push(b);
        self.dugumler[b].komsular.push(a); // döngü var ama sorun yok: sahibi Harita
    }
}

fn main() {
    let mut harita = Harita { dugumler: Vec::new() };
    let ankara = harita.ekle("Ankara");
    let konya = harita.ekle("Konya");
    let izmir = harita.ekle("İzmir");
    harita.baglat(ankara, konya);
    harita.baglat(konya, izmir);
    harita.baglat(izmir, ankara);

    for d in &harita.dugumler {
        let komsu_adlari: Vec<&str> = d.komsular.iter().map(|&i| harita.dugumler[i].ad.as_str()).collect();
        println!("{} → {komsu_adlari:?}", d.ad);
    }
}
```

Bedeli: bir düğümü silersen eski indeksler yanlış düğümü gösterebilir. Bu bir bellek hatası değildir ama
bir mantık hatasıdır. Büyük projeler bunun için "nesil numaralı" indeksler sunan crate'ler kullanır.

```quiz
question: |
  Bir sohbet uygulamasında bir `Kanal`, üyelerini (`Uye`) bir listede tutuyor; her `Uye` de bildirim
  göndermek için bulunduğu `Kanal`'ı biliyor. Kanal silinince üyeleri de bellekten gitmeli. Hangi tasarım
  döngüsüz ve doğrudur?
options:
  - "`Kanal { uyeler: Vec<Rc<Uye>> }` ve `Uye { kanal: Rc<Kanal> }`"
  - "`Kanal { uyeler: Vec<Rc<Uye>> }` ve `Uye { kanal: Weak<Kanal> }`"
  - "`Kanal { uyeler: Vec<Weak<Uye>> }` ve `Uye { kanal: Rc<Kanal> }`"
  - "`Kanal { uyeler: Vec<Weak<Uye>> }` ve `Uye { kanal: Weak<Kanal> }`"
answer: 1
explanation: |
  "Kanal silinince üyeler de gitsin" → kanal üyelerin **sahibidir** (güçlü, aşağı doğru). Üyenin kanala olan
  bağlantısı geriye bakan bir bağlantıdır → `Weak`. Bildirim gönderirken `self.kanal.upgrade()` ile
  kanalın hâlâ var olup olmadığını kontrol eder.
feedback:
  - "İki yönde de güçlü bağ = referans döngüsü; hiçbiri asla bırakılmaz."
  - "Doğru! Sahiplik aşağı, zayıf bağ yukarı."
  - "Sahiplik ters: üyeler kanalı yaşatır; kanal silinmek istense bile üyeler onu tutar."
  - "Kimse kimsenin sahibi değil: `Rc::new` ile oluşturulan değerler, son güçlü `Rc` gidince hemen bırakılır."
```

## Alıştırma: Organizasyon şeması

```exercise
id: m17-e-organizasyon-semasi
title: Organizasyon şeması
difficulty: 4
prompt: |
  Bir şirkette her çalışanın bir ekibi (sahip olduğu çalışanlar) ve bir yöneticisi (sahip olmadığı,
  yalnızca bildiği kişi) var. Üç fonksiyonu tamamla:

  - `ekibe_ekle(yonetici, calisan)`: `calisan`'ın yöneticisini **zayıf** olarak ayarla, `yonetici`'nin
    ekibine `calisan`'ın güçlü bir klonunu ekle.
  - `yonetici_adi(c) -> Option<String>`: yönetici hâlâ varsa adını döndür.
  - `zincir(c) -> Vec<String>`: çalışandan en tepeye kadar adlar: `["Deniz", "Selin", "Kaan"]`.

  Döngü kurma: yönetici silinince ona ait bellek de gerçekten bırakılmalı.
starter: |
  use std::cell::RefCell;
  use std::rc::{Rc, Weak};

  struct Calisan {
      ad: String,
      yonetici: RefCell<Weak<Calisan>>,
      ekip: RefCell<Vec<Rc<Calisan>>>,
  }

  impl Calisan {
      fn yeni(ad: &str) -> Rc<Calisan> {
          Rc::new(Calisan {
              ad: ad.to_string(),
              yonetici: RefCell::new(Weak::new()),
              ekip: RefCell::new(Vec::new()),
          })
      }
  }

  fn ekibe_ekle(yonetici: &Rc<Calisan>, calisan: &Rc<Calisan>) {
      todo!()
  }

  fn yonetici_adi(c: &Calisan) -> Option<String> {
      todo!()
  }

  fn zincir(c: &Rc<Calisan>) -> Vec<String> {
      todo!()
  }

  fn main() {
      let kaan = Calisan::yeni("Kaan");
      let selin = Calisan::yeni("Selin");
      let deniz = Calisan::yeni("Deniz");
      ekibe_ekle(&kaan, &selin);
      ekibe_ekle(&selin, &deniz);
      println!("{:?}", zincir(&deniz));
      println!("Selin'in yöneticisi: {:?}", yonetici_adi(&selin));
  }
solution: |
  use std::cell::RefCell;
  use std::rc::{Rc, Weak};

  struct Calisan {
      ad: String,
      yonetici: RefCell<Weak<Calisan>>,
      ekip: RefCell<Vec<Rc<Calisan>>>,
  }

  impl Calisan {
      fn yeni(ad: &str) -> Rc<Calisan> {
          Rc::new(Calisan {
              ad: ad.to_string(),
              yonetici: RefCell::new(Weak::new()),
              ekip: RefCell::new(Vec::new()),
          })
      }
  }

  fn ekibe_ekle(yonetici: &Rc<Calisan>, calisan: &Rc<Calisan>) {
      *calisan.yonetici.borrow_mut() = Rc::downgrade(yonetici);
      yonetici.ekip.borrow_mut().push(Rc::clone(calisan));
  }

  fn yonetici_adi(c: &Calisan) -> Option<String> {
      let yonetici = c.yonetici.borrow().upgrade()?;
      Some(yonetici.ad.clone())
  }

  fn zincir(c: &Rc<Calisan>) -> Vec<String> {
      let mut adlar = vec![c.ad.clone()];
      let mut simdiki = Rc::clone(c);
      loop {
          let ust = simdiki.yonetici.borrow().upgrade();
          match ust {
              Some(u) => {
                  adlar.push(u.ad.clone());
                  simdiki = u;
              }
              None => break,
          }
      }
      adlar
  }

  fn main() {
      let kaan = Calisan::yeni("Kaan");
      let selin = Calisan::yeni("Selin");
      let deniz = Calisan::yeni("Deniz");
      ekibe_ekle(&kaan, &selin);
      ekibe_ekle(&selin, &deniz);
      println!("{:?}", zincir(&deniz));
      println!("Selin'in yöneticisi: {:?}", yonetici_adi(&selin));
  }
check: tests
tests: |
  #[test]
  fn ekleme_sayaclari_dogru() {
      let mudur = Calisan::yeni("Selin");
      let a = Calisan::yeni("Deniz");
      let b = Calisan::yeni("Arda");
      ekibe_ekle(&mudur, &a);
      ekibe_ekle(&mudur, &b);
      assert_eq!(mudur.ekip.borrow().len(), 2, "müdürün ekibinde iki kişi olmalı");
      assert_eq!(Rc::strong_count(&mudur), 1, "çalışanlar yöneticiye sahip olmamalı (Weak kullan)");
      assert_eq!(Rc::weak_count(&mudur), 2, "her çalışan yöneticisine bir zayıf işaretçi tutmalı");
      assert_eq!(Rc::strong_count(&a), 2, "çalışanın sahipleri: kendi değişkeni + müdürün ekibi");
  }

  #[test]
  fn yonetici_adini_verir() {
      let mudur = Calisan::yeni("Selin");
      let c = Calisan::yeni("Deniz");
      assert_eq!(yonetici_adi(&c), None, "henüz yöneticisi yok");
      ekibe_ekle(&mudur, &c);
      assert_eq!(yonetici_adi(&c), Some(String::from("Selin")));
  }

  #[test]
  fn zinciri_tepeye_kadar_cikar() {
      let kaan = Calisan::yeni("Kaan");
      let selin = Calisan::yeni("Selin");
      let deniz = Calisan::yeni("Deniz");
      ekibe_ekle(&kaan, &selin);
      ekibe_ekle(&selin, &deniz);
      assert_eq!(zincir(&deniz), ["Deniz", "Selin", "Kaan"]);
      assert_eq!(zincir(&kaan), ["Kaan"], "en tepedeki kişinin zinciri yalnızca kendisi");
  }

  #[test]
  fn yonetici_gidince_bellek_birakilir() {
      let calisan = Calisan::yeni("Deniz");
      {
          let mudur = Calisan::yeni("Selin");
          ekibe_ekle(&mudur, &calisan);
          assert_eq!(yonetici_adi(&calisan).as_deref(), Some("Selin"));
      }
      assert_eq!(yonetici_adi(&calisan), None, "müdür bırakıldı; zayıf işaretçi None vermeli (döngü yok)");
      assert_eq!(Rc::strong_count(&calisan), 1, "müdürün ekibi de bırakılmış olmalı");
  }
hints:
  - "`ekibe_ekle` iki satır: `*calisan.yonetici.borrow_mut() = Rc::downgrade(yonetici);` ve `yonetici.ekip.borrow_mut().push(Rc::clone(calisan));`"
  - "`yonetici_adi`: `c.yonetici.borrow().upgrade()` bir `Option<Rc<Calisan>>` verir. `?` ile açıp (Modül 10) `Some(y.ad.clone())` döndürebilirsin."
  - "`zincir`: `let mut simdiki = Rc::clone(c);` ile başla, döngüde `let ust = simdiki.yonetici.borrow().upgrade();` yaz (önce **ayrı bir `let`** ile), sonra `match ust` ile ya adı ekleyip `simdiki = u;` yap ya da `break`."
explanation: |
  Son test asıl kanıt: müdür kapsamdan çıkınca **gerçekten** bırakılıyor. `yonetici` alanında `Rc`
  kullansaydın, müdürle çalışan birbirini tutacaktı (döngü). Müdür hiç bırakılmayacak, `yonetici_adi` hâlâ
  `Some("Selin")` döndürecekti.

  `zincir`'deki ayrı `let` satırı bir tuzağı önlüyor. `match simdiki.yonetici.borrow().upgrade() { ... simdiki = u; ... }`
  yazsaydın, `borrow()`'un döndürdüğü geçici `Ref` bütün `match` boyunca yaşardı. Bu `Ref` `simdiki`'den
  ödünç aldığı için, kol içinde `simdiki`'ye atama yapmak **derlenmezdi** (ödünç alınmışken atama, E0506).
  `let ust = ...;` satırında ise geçici değer satırın sonunda bırakılır.

  `simdiki` için `Rc<Calisan>` tutuyoruz, `&Calisan` değil. `upgrade`'den dönen `Rc` geçici bir sahiptir. Onu
  bir değişkende saklamazsak yönetici, biz onun alanlarını okurken yaşamaya devam edeceğinin garantisini
  kaybederiz. Döngü her adımda bir `Rc`'yi bırakıp bir sonrakini alır; sayaçlar hep dengede kalır.
  `yonetici_adi(&calisan).as_deref()` ise `Option<String>`'i `Option<&str>`'ye çevirir; testte
  karşılaştırmayı kolaylaştırır.
```

## Özet

:::remember
- Güvenli Rust'ta **bellek sızıntısı mümkündür**: iki `Rc` birbirini (doğrudan ya da dolaylı) tutarsa güçlü sayaçlar asla 0'a inmez, `drop` çalışmaz.
- `Weak<T>`: sahip olmadan gösterir. `Rc::downgrade(&rc)` ile oluşturulur, güçlü sayacı artırmaz, değeri yaşatmaz.
- `weak.upgrade()` → `Option<Rc<T>>`: değer yaşıyorsa geçici bir güçlü sahip, yoksa `None`. `Weak`'in `Deref`'i yoktur (E0609).
- `Rc::strong_count` değerin ömrünü belirler; `Rc::weak_count` yalnızca bilgi verir.
- Kural: sahiplik **aşağı** (ebeveyn → çocuk: `Rc`), geriye/yukarı bakan bağlar **zayıf** (`Weak`). Gerçek graflarda indeksli **arena** düşün.
:::

```reflect
prompt: Kendi cümlelerinle açıkla — bir ağaçta çocuklar ebeveynlerini neden `Rc` ile değil de `Weak` ile tutmalı? Tersini (ebeveyn çocukları `Weak` ile tutsun) yapsaydık ne olurdu?
answer: |
  Model cevap: Ebeveyn çocuklarını `Rc` ile tutuyor. Çocuklar da ebeveyni `Rc` ile tutsaydı her ebeveyn-çocuk
  çifti bir döngü oluştururdu ve güçlü sayaçlar hiçbir zaman 0'a inmezdi: ağaç asla bırakılmaz, bellek sızardı.
  Çocuğun ebeveyne olan bağı bir sahiplik değil, yalnızca "yukarıyı bilme" ihtiyacıdır; bu yüzden `Weak`.
  Tersini yapsaydık (ebeveyn → çocuk `Weak`), çocukların başka güçlü sahibi yoksa oluşturuldukları anda
  bırakılırlardı; ağacın alt dalları kaybolur, `upgrade` hep `None` dönerdi. Sahiplik, "kim kimi yaşatmalı"
  sorusunun cevabı yönünde akmalı.
```

```flashcards
- front: "İki `Rc` birbirini tuttuğunda neden bellek sızar?"
  back: "Değişkenler drop edilince güçlü sayaçlar 1'e iner ama 0'a inmez; değerler birbirini yaşatır, `drop` hiç çalışmaz."
- front: "Rust bellek sızıntısını neden bellek güvenliği ihlali saymaz?"
  back: "Sızan bellek hiç serbest bırakılmaz, bu yüzden use-after-free ya da double free oluşamaz; sızıntı israftır. `mem::forget` ve `Box::leak` bu yüzden güvenlidir."
- front: "`Weak<T>` nasıl oluşturulur ve güçlü sayacı etkiler mi?"
  back: "`Rc::downgrade(&rc)` ile. Güçlü sayacı artırmaz, yalnızca zayıf sayacı artırır; değeri yaşatmaz."
- front: "`weak.upgrade()` ne döndürür?"
  back: "`Option<Rc<T>>`: değer hâlâ yaşıyorsa `Some` (geçici bir güçlü sahip), drop edildiyse `None`."
- front: "Neden `zayif.ad` gibi bir `Weak` üzerinden doğrudan alana erişilemez?"
  back: "`Weak` `Deref` uygulamaz, çünkü değer her an yok olmuş olabilir. Önce `upgrade()` ile `Option`'ı kontrol etmelisin (E0609)."
- front: "Ebeveyn–çocuk ağacında bağlantıların tipleri ne olmalı?"
  back: "Ebeveyn → çocuklar: `RefCell<Vec<Rc<T>>>` (sahiplik). Çocuk → ebeveyn: `RefCell<Weak<T>>` (sahipliksiz)."
- front: "Döngülü graflar için `Rc`/`Weak` yerine yaygın Rust alternatifi nedir?"
  back: "İndeksli arena: düğümler tek bir `Vec`'te yaşar, bağlantılar `usize` indeksleri tutar."
```
