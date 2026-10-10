---
id: m20-l04
title: Durum (state) deseni iki şekilde
minutes: 24
type: lesson
objectives:
  - "Durum desenini `Option<Box<dyn Durum>>` ve `self: Box<Self>` metotlarıyla uygulayabilmek"
  - "`Option::take` ile `&mut self` arkasındaki bir değeri neden ve nasıl dışarı alacağını açıklayabilmek (E0507)"
  - Aynı iş akışını typestate deseniyle, durumları ayrı tiplere kodlayarak yazabilmek
  - Trait nesnesi, typestate ve enum durum makinesi arasında ihtiyaca göre seçim yapabilmek
keywords: [durum deseni, state pattern, typestate, "self: Box<Self>", Option::take, E0507, E0599, durum makinesi]
---

Bir blog platformunda gönderiler bir **iş akışından** geçer: önce **taslak** olarak yazılır, sonra editöre
**incelemeye** gönderilir, editör onaylarsa **yayına** girer. Kurallar nettir: taslaktaki ya da incelemedeki bir
gönderinin içeriği okuyuculara görünmez; yalnızca yayındaki gönderi okunabilir.

Böyle “duruma göre davranışı değişen” nesneler her yerde vardır: sipariş (hazırlanıyor → kargoda → teslim),
trafik ışığı, bir ağ bağlantısı, bir oyun karakterinin hâlleri. Klasik OOP'nin cevabı **durum (state)
deseni**dir. Bu derste onu önce kitaptaki gibi trait nesneleriyle, sonra Rust'a çok daha yakışan bir yolla,
**typestate** ile yazacaksın. İkisinin farkı, Rust'ın en güçlü tasarım fikirlerinden birini gösterecek:
*geçersiz durumları temsil edilemez hâle getirmek.*

## Hedef: bir gönderinin yaşam döngüsü

Önce kullanıcının göreceği API'yi yazalım. Kodun geri kalanı bu sözleşmeyi gerçekleştirecek:

```rust,ignore
let mut g = Gonderi::new();          // durum: Taslak
g.metin_ekle("Kapadokya gezisi...");
assert_eq!("", g.icerik());          // taslak görünmez

g.inceleme_iste();                   // durum: İnceleniyor
assert_eq!("", g.icerik());          // incelemedeki de görünmez

g.onayla();                          // durum: Yayında
assert_eq!("Kapadokya gezisi...", g.icerik());
```

Dikkat et: kullanıcı yalnızca **tek bir tip** (`Gonderi`) görüyor. Durumların hangi tiplerle temsil edildiği
gizli. Bu, ilk dersteki kapsüllemenin ta kendisi. Durum deseninin fikri şu: her durum ayrı bir **durum
nesnesidir**; `Gonderi` içinde o anki durum nesnesini tutar ve davranışı ona **devreder**. Durum değiştiğinde
eski durum nesnesi yerini yenisine bırakır.

:::analogy Bir dilekçenin masadan masaya yolculuğu
Bir belediyeye verdiğin dilekçe önce **evrak kayıt** masasındadır, sonra **ilgili müdürlüğe**, oradan
**onay makamına** gider. Dilekçenin kendisi (kâğıt, içerik) aynı kalır; değişen, onu o anda **elinde tutan
masa**dır. Her masa yalnızca kendi bildiği işi yapar: kayıt masası “müdürlüğe gönder”i bilir, onay makamı
“onayla”yı. Yanlış masaya “onayla” dersen memur omuz silker: *“Bu benim işim değil.”*

Durum deseninde `Gonderi` dilekçedir, durum nesneleri (`Taslak`, `Inceleniyor`, `Yayinda`) masalardır.
:::

## Durum nesneleri ve `self: Box<Self>`

Durumların ortak davranışını bir trait tanımlar:

```rust,ignore
trait Durum {
    fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum>;
    fn onayla(self: Box<Self>) -> Box<dyn Durum>;
    fn icerik<'a>(&self, _gonderi: &'a Gonderi) -> &'a str {
        ""
    }
}
```

İki yeni ayrıntı var:

**1) `self: Box<Self>` alıcısı.** Bu metot yalnızca bir `Box` içindeki değer üzerinde çağrılabilir ve o
kutunun **sahipliğini alır**. Yani eski durum tüketilir; metot yerine geçecek **yeni** durumu kutulu olarak
döndürür. `Taslak`'ın `inceleme_iste`'si `Box::new(Inceleniyor)` döndürür; `Taslak`'ın `onayla`'sı ise
durumu değiştirmediği için **kendini** (`self`) geri verir. Geçen dersten hatırla: `self: Box<Self>` dyn
uyumlu bir alıcıdır, yani bu metotlar `Box<dyn Durum>` üzerinde çağrılabilir.

**2) `icerik`'in yaşam süresi.** Durum nesnesi metni tutmuyor; metin `Gonderi`'de. Bu yüzden `icerik`
gönderiyi parametre olarak alır ve dönen `&str`'yi `'a` ile **gönderiye** bağlar, durum nesnesine değil
(Modül 12). Varsayılan uygulama boş metin döndürür; yalnızca `Yayinda` onu ezer.

Şimdi `Gonderi`'nin durumu nasıl değiştireceğine bakalım. İlk deneme:

```compiles
code: |
  trait Durum {
      fn ilerle(self: Box<Self>) -> Box<dyn Durum>;
  }

  struct Taslak;

  impl Durum for Taslak {
      fn ilerle(self: Box<Self>) -> Box<dyn Durum> {
          self
      }
  }

  struct Gonderi {
      durum: Box<dyn Durum>,
  }

  impl Gonderi {
      fn ilerle(&mut self) {
          self.durum = self.durum.ilerle();
      }
  }

  fn main() {
      let mut g = Gonderi { durum: Box::new(Taslak) };
      g.ilerle();
  }
answer: false
error: E0507
explanation: |
  `ilerle` kutunun sahipliğini istiyor, ama `Gonderi::ilerle` içinde elimizde yalnızca `&mut self` var.
  Ödünç alınmış bir yapının alanını **dışarı taşıyamazsın** (Modül 5): taşıma ile yeni değerin atanması
  arasındaki kısa anda `self.durum` geçersiz (taşınmış) olurdu. O arada bir panik olsaydı, `Gonderi`
  “yarısı taşınmış” bir hâlde kalır ve `drop` edilirken taşınmış kutuyu ikinci kez serbest bırakırdı.
```

:::error
```text
error[E0507]: cannot move out of `self.durum` which is behind a mutable reference
  --> src/main.rs:19:22
   |
19 |         self.durum = self.durum.ilerle();
   |                      ^^^^^^^^^^ -------- `self.durum` moved due to this method call
   |                      |
   |                      move occurs because `self.durum` has type `Box<dyn Durum>`, which does not implement the `Copy` trait
   |
note: `Durum::ilerle` takes ownership of the receiver `self`, which moves `self.durum`
```
Derleyicinin önerdiği `clone` burada işe yaramaz (`dyn Durum` `Clone` değil, geçen dersi hatırla). Doğru
çözüm, alanın yerine geçici olarak **geçerli bir değer bırakmak**.
:::

Çözüm, alanı `Option<Box<dyn Durum>>` yapmak ve `Option::take` kullanmak. `take()` `Option`'ın içindeki
değeri dışarı alır ve yerine `None` bırakır. Böylece alan hiçbir an “taşınmış” olmaz; yalnızca kısa bir süre
`None` olur:

```rust,ignore
pub fn inceleme_iste(&mut self) {
    if let Some(d) = self.durum.take() {        // değeri al, yerine None bırak
        self.durum = Some(d.inceleme_iste());   // yeni durumu yerleştir
    }
}
```

```memory
title: "durum.take() ile geçiş: Taslak → İnceleniyor"
steps:
  - caption: "Başlangıç: `durum` alanı `Some` içinde kutulu bir `Taslak` tutuyor."
    stack:
      - frame: inceleme_iste
        vars:
          - { name: self.durum, type: "Option<Box<dyn Durum>>", value: "Some(veri ptr · vtable: Taslak)", to: h1 }
    heap:
      - { id: h1, label: "Box", value: "Taslak" }
  - caption: "`self.durum.take()`: kutu `d`'ye taşındı, alanda `None` kaldı. Alan hiçbir an geçersiz olmadı."
    stack:
      - frame: inceleme_iste
        vars:
          - { name: self.durum, type: "Option<Box<dyn Durum>>", value: "None" }
          - { name: d, type: "Box<dyn Durum>", value: "veri ptr · vtable: Taslak", to: h1 }
    heap:
      - { id: h1, label: "Box", value: "Taslak" }
  - caption: "`d.inceleme_iste()` kutuyu tüketti: `Taslak` drop edildi, yerine yeni bir `Inceleniyor` kutusu döndü ve alana yerleşti."
    stack:
      - frame: inceleme_iste
        vars:
          - { name: self.durum, type: "Option<Box<dyn Durum>>", value: "Some(veri ptr · vtable: Inceleniyor)", to: h2 }
          - { name: d, type: "Box<dyn Durum>", value: "(tüketildi)", moved: true }
    heap:
      - { id: h1, label: "Box", value: "Taslak", freed: true }
      - { id: h2, label: "Box", value: "Inceleniyor" }
```

(Küçük bir dipnot: `Taslak` gibi alansız tipler sıfır bayttır ve `Box::new` onlar için gerçekte heap'ten yer
ayırmaz. Diyagram fikri göstermek için onları kutu olarak çiziyor.)

## Tam uygulama: trait nesneleriyle durum deseni

Parçaları birleştirelim. Durum tipleri ve trait `blog` modülünde **gizli**; dışarıya yalnızca `Gonderi` açık:

```rust
mod blog {
    pub struct Gonderi {
        durum: Option<Box<dyn Durum>>,
        icerik: String,
    }

    impl Gonderi {
        pub fn new() -> Gonderi {
            Gonderi { durum: Some(Box::new(Taslak)), icerik: String::new() }
        }

        pub fn metin_ekle(&mut self, metin: &str) {
            self.icerik.push_str(metin);
        }

        pub fn icerik(&self) -> &str {
            self.durum.as_ref().expect("durum her zaman Some").icerik(self)
        }

        pub fn durum_adi(&self) -> &'static str {
            self.durum.as_ref().expect("durum her zaman Some").ad()
        }

        pub fn inceleme_iste(&mut self) {
            if let Some(d) = self.durum.take() {
                self.durum = Some(d.inceleme_iste());
            }
        }

        pub fn onayla(&mut self) {
            if let Some(d) = self.durum.take() {
                self.durum = Some(d.onayla());
            }
        }
    }

    trait Durum {
        fn ad(&self) -> &'static str;
        fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum>;
        fn onayla(self: Box<Self>) -> Box<dyn Durum>;
        fn icerik<'a>(&self, _gonderi: &'a Gonderi) -> &'a str {
            ""
        }
    }

    struct Taslak;
    struct Inceleniyor;
    struct Yayinda;

    impl Durum for Taslak {
        fn ad(&self) -> &'static str {
            "Taslak"
        }
        fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
            Box::new(Inceleniyor)
        }
        fn onayla(self: Box<Self>) -> Box<dyn Durum> {
            self // taslak doğrudan onaylanamaz
        }
    }

    impl Durum for Inceleniyor {
        fn ad(&self) -> &'static str {
            "İnceleniyor"
        }
        fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
            self
        }
        fn onayla(self: Box<Self>) -> Box<dyn Durum> {
            Box::new(Yayinda)
        }
    }

    impl Durum for Yayinda {
        fn ad(&self) -> &'static str {
            "Yayında"
        }
        fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
            self
        }
        fn onayla(self: Box<Self>) -> Box<dyn Durum> {
            self
        }
        fn icerik<'a>(&self, gonderi: &'a Gonderi) -> &'a str {
            &gonderi.icerik
        }
    }
}

fn main() {
    let mut g = blog::Gonderi::new();
    g.metin_ekle("Kapadokya'da balonlar şafakta havalanıyor.");
    println!("{}: '{}'", g.durum_adi(), g.icerik());
    g.inceleme_iste();
    println!("{}: '{}'", g.durum_adi(), g.icerik());
    g.onayla();
    println!("{}: '{}'", g.durum_adi(), g.icerik());
}
```

`Gonderi`'nin metotlarında **hiç `match` yok**. `icerik()` ne döndüreceğini bilmiyor, o anki duruma soruyor.
`Yayinda`, gönderinin gizli `icerik` alanına erişebiliyor, çünkü aynı modülde (`blog`). Gizlilik modül
düzeyinde, hatırlıyor musun?

`expect("durum her zaman Some")` neden güvenli? `durum` yalnızca `take()` ile `Some(...)` ataması arasındaki
kısa anda `None` olur ve bu an hep aynı metodun içinde biter. Dışarıdan bakan biri onu asla `None` göremez.
Bu bir değişmezdir ve Modül 10'daki “derleyiciden fazlasını biliyorsan gerekçeli `expect`” kuralına uyar.

```predict
code: |
  # mod blog {
  #     pub struct Gonderi { durum: Option<Box<dyn Durum>>, icerik: String }
  #     impl Gonderi {
  #         pub fn new() -> Gonderi { Gonderi { durum: Some(Box::new(Taslak)), icerik: String::new() } }
  #         pub fn metin_ekle(&mut self, metin: &str) { self.icerik.push_str(metin); }
  #         pub fn icerik(&self) -> &str { self.durum.as_ref().expect("durum").icerik(self) }
  #         pub fn durum_adi(&self) -> &'static str { self.durum.as_ref().expect("durum").ad() }
  #         pub fn inceleme_iste(&mut self) { if let Some(d) = self.durum.take() { self.durum = Some(d.inceleme_iste()); } }
  #         pub fn onayla(&mut self) { if let Some(d) = self.durum.take() { self.durum = Some(d.onayla()); } }
  #     }
  #     trait Durum {
  #         fn ad(&self) -> &'static str;
  #         fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum>;
  #         fn onayla(self: Box<Self>) -> Box<dyn Durum>;
  #         fn icerik<'a>(&self, _g: &'a Gonderi) -> &'a str { "" }
  #     }
  #     struct Taslak;
  #     struct Inceleniyor;
  #     struct Yayinda;
  #     impl Durum for Taslak {
  #         fn ad(&self) -> &'static str { "Taslak" }
  #         fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> { Box::new(Inceleniyor) }
  #         fn onayla(self: Box<Self>) -> Box<dyn Durum> { self }
  #     }
  #     impl Durum for Inceleniyor {
  #         fn ad(&self) -> &'static str { "İnceleniyor" }
  #         fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> { self }
  #         fn onayla(self: Box<Self>) -> Box<dyn Durum> { Box::new(Yayinda) }
  #     }
  #     impl Durum for Yayinda {
  #         fn ad(&self) -> &'static str { "Yayında" }
  #         fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> { self }
  #         fn onayla(self: Box<Self>) -> Box<dyn Durum> { self }
  #         fn icerik<'a>(&self, g: &'a Gonderi) -> &'a str { &g.icerik }
  #     }
  # }
  // blog modülü yukarıdaki gibi (gizli satırlarda)
  fn main() {
      let mut g = blog::Gonderi::new();
      g.metin_ekle("Ege");
      g.onayla();
      println!("{} [{}]", g.durum_adi(), g.icerik());
      g.inceleme_iste();
      g.inceleme_iste();
      g.metin_ekle(" turu");
      println!("{} [{}]", g.durum_adi(), g.icerik());
      g.onayla();
      println!("{} [{}]", g.durum_adi(), g.icerik());
  }
options:
  - |
    Taslak []
    İnceleniyor []
    Yayında [Ege turu]
  - |
    Yayında [Ege]
    Yayında [Ege]
    Yayında [Ege turu]
  - |
    Taslak []
    İnceleniyor []
    Yayında [Ege]
  - |
    Taslak []
    Yayında []
    Yayında [Ege turu]
answer: 0
explanation: |
  Taslaktaki `onayla()` hiçbir şey yapmaz (`Taslak::onayla` `self` döndürür). İki kez `inceleme_iste()` demek
  de sorun değil; ikincisinde `Inceleniyor` kendini geri verir. Peki `" turu"` neden eklendi? `metin_ekle`
  `Gonderi`'de duruma **sormadan** çalışıyor: incelemedeki bir metin hâlâ değiştirilebiliyor! Bu muhtemelen
  bir iş kuralı hatası ve kimse bizi uyarmadı. Sıradaki bölümün konusu tam olarak bu.
```

## Deseni genişletmek ve eleştirmek

Trait nesneli durum deseninin güzel yanları var: yeni bir durum eklemek için yeni bir struct ve bir `impl`
yazarsın; `Gonderi`'nin metotları değişmez. Her durumun kuralları kendi impl bloğunda, derli topludur.
Ama az önceki tahmin sorusu zayıf yanları da gösterdi:

1. **Geçersiz işlemler sessizce yutulur.** Taslağı onaylamak, incelemedeki metni değiştirmek... Hiçbiri
   hata vermiyor; ancak testler (ya da kullanıcılar) fark ederse yakalanır.
2. **Durumlar birbirini tanıyor.** `Taslak`, `Inceleniyor`'u oluşturuyor; araya yeni bir durum eklemek
   (örneğin “Zamanlanmış”) komşu durumları değiştirmeyi gerektirir.
3. **Tekrar.** Çoğu durumda `onayla` ve `inceleme_iste` yalnızca `self` döndürüyor. Bunu trait'te varsayılan
   bir gövdeyle yazamazsın: `fn onayla(self: Box<Self>) -> Box<dyn Durum> { self }` derlenmez (`E0277`), çünkü
   varsayılan gövdede `Self`'in boyutu bilinmez ve `Box<Self>` → `Box<dyn Durum>` dönüşümü `Self: Sized` ister.
   `where Self: Sized` eklersen de metot trait nesnesinde çağrılamaz (geçen ders!).
4. **Çalışma zamanı bedeli.** Her geçiş bir heap tahsisi ve her çağrı bir vtable dolaylaması.

```quiz
question: |
  Bir arkadaşın tekrarı azaltmak için trait'e şu varsayılan metodu yazmayı öneriyor:
  `fn onayla(self: Box<Self>) -> Box<dyn Durum> { self }`. Ne olur?
options:
  - Derlenir; artık yalnızca `Inceleniyor` `onayla`'yı ezmek zorunda
  - "Derlenmez: varsayılan gövdede `Self`'in boyutu bilinmez, `Box<Self>` → `Box<dyn Durum>` dönüşümü `Self: Sized` gerektirir"
  - "Derlenir ama `onayla` çağrıldığında her zaman `Taslak`'a döner"
  - "Derlenmez, çünkü `self: Box<Self>` alıcıları varsayılan gövde içeremez"
answer: 1
explanation: |
  Trait'in varsayılan metotları **her** uygulayıcı için yazılır, `dyn Durum`'un kendisi gibi boyutsuz tipler de
  buna dahildir. Boyutsuz bir `Self`'i ikinci bir trait nesnesine dönüştürmek mümkün değildir (`Box<dyn Durum>`'u
  tekrar `Box<dyn Durum>` yapmak için onun boyutunu ve vtable'ını bilmek gerekir). Derleyici `E0277: the size
  for values of type Self cannot be known` der ve `where Self: Sized` önerir, ama o zaman da metot trait
  nesnesinden çağrılamaz. Kitap da bu tekrarı desenin bir bedeli olarak kabul eder.
feedback:
  - Ne yazık ki derlenmez; tekrarın sebebi tam da bu.
  - Doğru!
  - "`self` döndürmek durumu değiştirmez; ama zaten derlenmiyor."
  - "Bu alıcılarla varsayılan gövde yazılabilir (örneğin `self` yerine `Box::new(Taslak)` döndürmek derlenir). Sorun yalnızca `self`'i `dyn`'a dönüştürmek."
```

Şimdi deseni sen genişlet:

```exercise
id: m20-l04-e-iki-onay
title: Reddetme ve çift onay
difficulty: 4
prompt: |
  Editörler iki yeni kural istiyor:

  1. **`reddet`**: incelemedeki bir gönderi reddedilirse **taslağa** döner. Taslakta ve yayındaki gönderide
     `reddet` hiçbir şey yapmaz.
  2. **Çift onay**: incelemedeki bir gönderinin yayına girmesi için `onayla` **iki kez** çağrılmalı. İlk onaydan
     sonra gönderi hâlâ incelemededir. Reddedilip tekrar incelemeye gelen gönderinin onay sayısı **sıfırdan**
     başlar.

  `Inceleniyor` durumuna bir `onay_sayisi` alanı eklendi. `todo!()` olan yerleri doldur (`Gonderi::reddet`
  dahil). `durum_adi()` incelemede `"İnceleniyor (1/2)"` biçiminde onay sayısını da gösteriyor; bu metot hazır.
starter: |
  mod blog {
      pub struct Gonderi {
          durum: Option<Box<dyn Durum>>,
          icerik: String,
      }

      impl Gonderi {
          pub fn new() -> Gonderi {
              Gonderi { durum: Some(Box::new(Taslak)), icerik: String::new() }
          }

          pub fn metin_ekle(&mut self, metin: &str) {
              self.icerik.push_str(metin);
          }

          pub fn icerik(&self) -> &str {
              self.durum.as_ref().expect("durum her zaman Some").icerik(self)
          }

          pub fn durum_adi(&self) -> String {
              self.durum.as_ref().expect("durum her zaman Some").ad()
          }

          pub fn inceleme_iste(&mut self) {
              if let Some(d) = self.durum.take() {
                  self.durum = Some(d.inceleme_iste());
              }
          }

          pub fn onayla(&mut self) {
              if let Some(d) = self.durum.take() {
                  self.durum = Some(d.onayla());
              }
          }

          pub fn reddet(&mut self) {
              todo!()
          }
      }

      trait Durum {
          fn ad(&self) -> String;
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum>;
          fn onayla(self: Box<Self>) -> Box<dyn Durum>;
          fn reddet(self: Box<Self>) -> Box<dyn Durum>;
          fn icerik<'a>(&self, _gonderi: &'a Gonderi) -> &'a str {
              ""
          }
      }

      struct Taslak;

      struct Inceleniyor {
          onay_sayisi: u32,
      }

      struct Yayinda;

      impl Durum for Taslak {
          fn ad(&self) -> String {
              String::from("Taslak")
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              Box::new(Inceleniyor { onay_sayisi: 0 })
          }
          fn onayla(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              todo!()
          }
      }

      impl Durum for Inceleniyor {
          fn ad(&self) -> String {
              format!("İnceleniyor ({}/2)", self.onay_sayisi)
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn onayla(self: Box<Self>) -> Box<dyn Durum> {
              todo!()
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              todo!()
          }
      }

      impl Durum for Yayinda {
          fn ad(&self) -> String {
              String::from("Yayında")
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn onayla(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              todo!()
          }
          fn icerik<'a>(&self, gonderi: &'a Gonderi) -> &'a str {
              &gonderi.icerik
          }
      }
  }

  fn main() {
      let mut g = blog::Gonderi::new();
      g.metin_ekle("Mardin'de taş evler");
      g.inceleme_iste();
      g.onayla();
      println!("{}", g.durum_adi());
      g.reddet();
      println!("{}", g.durum_adi());
  }
solution: |
  mod blog {
      pub struct Gonderi {
          durum: Option<Box<dyn Durum>>,
          icerik: String,
      }

      impl Gonderi {
          pub fn new() -> Gonderi {
              Gonderi { durum: Some(Box::new(Taslak)), icerik: String::new() }
          }

          pub fn metin_ekle(&mut self, metin: &str) {
              self.icerik.push_str(metin);
          }

          pub fn icerik(&self) -> &str {
              self.durum.as_ref().expect("durum her zaman Some").icerik(self)
          }

          pub fn durum_adi(&self) -> String {
              self.durum.as_ref().expect("durum her zaman Some").ad()
          }

          pub fn inceleme_iste(&mut self) {
              if let Some(d) = self.durum.take() {
                  self.durum = Some(d.inceleme_iste());
              }
          }

          pub fn onayla(&mut self) {
              if let Some(d) = self.durum.take() {
                  self.durum = Some(d.onayla());
              }
          }

          pub fn reddet(&mut self) {
              if let Some(d) = self.durum.take() {
                  self.durum = Some(d.reddet());
              }
          }
      }

      trait Durum {
          fn ad(&self) -> String;
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum>;
          fn onayla(self: Box<Self>) -> Box<dyn Durum>;
          fn reddet(self: Box<Self>) -> Box<dyn Durum>;
          fn icerik<'a>(&self, _gonderi: &'a Gonderi) -> &'a str {
              ""
          }
      }

      struct Taslak;

      struct Inceleniyor {
          onay_sayisi: u32,
      }

      struct Yayinda;

      impl Durum for Taslak {
          fn ad(&self) -> String {
              String::from("Taslak")
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              Box::new(Inceleniyor { onay_sayisi: 0 })
          }
          fn onayla(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
      }

      impl Durum for Inceleniyor {
          fn ad(&self) -> String {
              format!("İnceleniyor ({}/2)", self.onay_sayisi)
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn onayla(mut self: Box<Self>) -> Box<dyn Durum> {
              self.onay_sayisi += 1;
              if self.onay_sayisi >= 2 { Box::new(Yayinda) } else { self }
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              Box::new(Taslak)
          }
      }

      impl Durum for Yayinda {
          fn ad(&self) -> String {
              String::from("Yayında")
          }
          fn inceleme_iste(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn onayla(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn reddet(self: Box<Self>) -> Box<dyn Durum> {
              self
          }
          fn icerik<'a>(&self, gonderi: &'a Gonderi) -> &'a str {
              &gonderi.icerik
          }
      }
  }

  fn main() {
      let mut g = blog::Gonderi::new();
      g.metin_ekle("Mardin'de taş evler");
      g.inceleme_iste();
      g.onayla();
      println!("{}", g.durum_adi());
      g.reddet();
      println!("{}", g.durum_adi());
  }
check: tests
tests: |
  use blog::Gonderi;

  fn incelemede(metin: &str) -> Gonderi {
      let mut g = Gonderi::new();
      g.metin_ekle(metin);
      g.inceleme_iste();
      g
  }

  #[test]
  fn tek_onay_yetmez_iki_onay_yayinlar() {
      let mut g = incelemede("Safranbolu evleri");
      g.onayla();
      assert_eq!(g.durum_adi(), "İnceleniyor (1/2)", "Tek onaydan sonra gönderi hâlâ incelemede olmalı");
      assert_eq!(g.icerik(), "", "İncelemedeki gönderinin içeriği görünmemeli");
      g.onayla();
      assert_eq!(g.durum_adi(), "Yayında", "İkinci onay gönderiyi yayına almalı");
      assert_eq!(g.icerik(), "Safranbolu evleri");
  }

  #[test]
  fn reddedilen_gonderi_taslaga_doner_ve_onaylar_sifirlanir() {
      let mut g = incelemede("Pamukkale");
      g.onayla();
      g.reddet();
      assert_eq!(g.durum_adi(), "Taslak", "İncelemede reddedilen gönderi taslağa dönmeli");
      g.inceleme_iste();
      assert_eq!(g.durum_adi(), "İnceleniyor (0/2)", "Yeniden incelemeye gelen gönderi sıfırdan başlamalı");
      g.onayla();
      assert_eq!(g.durum_adi(), "İnceleniyor (1/2)", "Eski onay sayılmamalı");
  }

  #[test]
  fn taslakta_ve_yayinda_reddet_etkisizdir() {
      let mut t = Gonderi::new();
      t.reddet();
      assert_eq!(t.durum_adi(), "Taslak", "Taslağı reddetmek bir şey değiştirmemeli");

      let mut y = incelemede("Nemrut");
      y.onayla();
      y.onayla();
      y.reddet();
      assert_eq!(y.durum_adi(), "Yayında", "Yayındaki gönderi reddedilemez");
      assert_eq!(y.icerik(), "Nemrut");
  }
hints:
  - "`Gonderi::reddet`, `onayla` ile aynı kalıpta: `if let Some(d) = self.durum.take() { self.durum = Some(d.reddet()); }`. `Taslak` ve `Yayinda` için `reddet` sadece `self` döndürür."
  - "`Inceleniyor::reddet` yeni bir `Box::new(Taslak)` döndürür; eski kutu (ve onay sayısı) böylece çöpe gider."
  - "`onayla`'da kutunun içini değiştirmek için alıcıyı değişebilir yap: `fn onayla(mut self: Box<Self>) -> Box<dyn Durum>`. Sonra `self.onay_sayisi += 1;` ve `if self.onay_sayisi >= 2 { Box::new(Yayinda) } else { self }`."
explanation: |
  Her durum yalnızca **kendi** kurallarını biliyor: `Inceleniyor` onayları sayıyor ve reddedilince yepyeni bir
  `Taslak` döndürüyor. Eski kutu, içindeki `onay_sayisi` ile birlikte drop edildiği için “sıfırlama” kendiliğinden
  oluyor; ayrıca bir sıfırlama kodu yazmadın. `Gonderi`'nin metotları ise yine yalnızca işi devrediyor.

  `mut self: Box<Self>` sözdizimi tıpkı `fn f(mut x: T)` gibi: parametreyi değişebilir bağlar. Kutu bizim, içini
  değiştirip aynı kutuyu geri verebiliriz; yeni bir tahsis gerekmez.

  Bu alıştırma desenin bir zayıflığını da gösterdi: trait'e `reddet` eklediğin anda **üç** durum impl'ini
  güncellemek zorunda kaldın. Bunlardan ikisi yalnızca `self` döndürüyor. Geçen dersteki tablo: trait'lerde
  yeni bir **işlem** eklemek zordur.
```

## Typestate: durumları tiplere kodla

Şimdi aynı iş akışını farklı düşünelim. Durumu bir alanda saklamak yerine, **her durumu ayrı bir tip** yapalım:
`TaslakGonderi`, `InceleniyorGonderi`, `Gonderi` (yayındaki). Her tipte yalnızca **o durumda anlamlı** metotlar
olsun. Önce tahmin et:

```compiles
code: |
  mod blog {
      pub struct Gonderi {
          icerik: String,
      }

      pub struct TaslakGonderi {
          icerik: String,
      }

      pub struct InceleniyorGonderi {
          icerik: String,
      }

      impl Gonderi {
          pub fn new() -> TaslakGonderi {
              TaslakGonderi { icerik: String::new() }
          }

          pub fn icerik(&self) -> &str {
              &self.icerik
          }
      }

      impl TaslakGonderi {
          pub fn metin_ekle(&mut self, metin: &str) {
              self.icerik.push_str(metin);
          }

          pub fn inceleme_iste(self) -> InceleniyorGonderi {
              InceleniyorGonderi { icerik: self.icerik }
          }
      }

      impl InceleniyorGonderi {
          pub fn onayla(self) -> Gonderi {
              Gonderi { icerik: self.icerik }
          }
      }
  }

  fn main() {
      let mut g = blog::Gonderi::new();
      g.metin_ekle("Bugün öğle yemeğinde mantı yedim.");
      let g = g.inceleme_iste();
      println!("{}", g.icerik());
  }
answer: false
error: E0599
explanation: |
  `g.inceleme_iste()` bir `InceleniyorGonderi` döndürür ve bu tipin `icerik` diye bir metodu **yok**. Yayınlanmamış
  bir gönderinin içeriğini okumaya çalışmak artık bir çalışma zamanı davranışı (boş metin) değil, bir **derleme
  hatası**. Aynı şekilde `InceleniyorGonderi` üzerinde `metin_ekle` de yok: incelemedeki metni değiştirme açığı
  kendiliğinden kapandı.
```

:::error
```text
error[E0599]: no method named `icerik` found for struct `InceleniyorGonderi` in the current scope
  --> src/main.rs:45:22
   |
10 |     pub struct InceleniyorGonderi {
   |     ----------------------------- method `icerik` not found for this struct
...
45 |     println!("{}", g.icerik());
   |                      ^^^^^^ private field, not a method
```
Hatayı “eksik metot” olarak değil, **iş kuralının derleyici tarafından hatırlatılması** olarak oku: “İncelemedeki
gönderinin okunabilir bir içeriği yoktur.” Editörün otomatik tamamlaması da sana yalnızca `onayla`'yı önerir.
:::

Typestate'in sırrı **`self` alan geçiş metotlarıdır**. `inceleme_iste(self)` eski taslağı **tüketir** ve yeni bir
tip döndürür. Eski değer taşındığı için bir daha kullanılamaz:

```rust
mod blog {
    pub struct Gonderi {
        icerik: String,
    }

    pub struct TaslakGonderi {
        icerik: String,
    }

    pub struct InceleniyorGonderi {
        icerik: String,
    }

    impl Gonderi {
        pub fn new() -> TaslakGonderi {
            TaslakGonderi { icerik: String::new() }
        }

        pub fn icerik(&self) -> &str {
            &self.icerik
        }
    }

    impl TaslakGonderi {
        pub fn metin_ekle(&mut self, metin: &str) {
            self.icerik.push_str(metin);
        }

        pub fn inceleme_iste(self) -> InceleniyorGonderi {
            InceleniyorGonderi { icerik: self.icerik } // String taşınır, kopyalanmaz
        }
    }

    impl InceleniyorGonderi {
        pub fn onayla(self) -> Gonderi {
            Gonderi { icerik: self.icerik }
        }

        pub fn reddet(self) -> TaslakGonderi {
            TaslakGonderi { icerik: self.icerik }
        }
    }
}

fn main() {
    let mut taslak = blog::Gonderi::new();
    taslak.metin_ekle("Bugün öğle yemeğinde mantı yedim.");

    let inceleme = taslak.inceleme_iste();
    // taslak.metin_ekle("..."); // E0382: taslak taşındı, artık yok

    let mut taslak = inceleme.reddet(); // editör geri gönderdi
    taslak.metin_ekle(" Yanında da ayran.");

    let yayinda = taslak.inceleme_iste().onayla();
    println!("{}", yayinda.icerik());
}
```

Kitaptaki sürümle karşılaştır: `Option` yok, `take()` yok, `Box` ve `dyn` yok, `expect` yok. Bütün durum
bilgisi **tip sisteminde**. Geçersiz bir sıra (taslağı onaylamak, taslağı okumak, eski taslağı değiştirmek)
derlenmez bile. Bedeli ise gölgeleme ya da yeni adlarla değişkenleri yeniden bağlamak (`let taslak = ...`):
her geçiş yeni bir değer üretir. `self.icerik` ise taşındığı için `String`'in heap verisi hiç kopyalanmaz;
geçişler neredeyse bedavadır.

:::analogy Bilet, biniş kartı, uçak
Havalimanında **bilet** ile uçağa binemezsin; önce check-in yapıp biletini bir **biniş kartına** çevirmen
gerekir. Kapıdaki görevli yalnızca biniş kartını kabul eder. Check-in bileti “tüketir”: aynı biletle ikinci kez
check-in yapamazsın. Typestate'te her durum ayrı bir “belge”dir (`TaslakGonderi`, `InceleniyorGonderi`) ve her
kapı (metot) yalnızca doğru belgeyi kabul eder. Derleyici, hiç yorulmayan bir kapı görevlisidir.
:::

Başarısız olabilen geçişlerde typestate'in güzel bir alışkanlığı vardır: başarısızlıkta **eski durumu geri
vermek**. Bir kasa örneğinde boşlukları doldur:

```fill
prompt: |
  `ac` yanlış şifrede kasayı tüketip kaybetmesin, `Err` içinde **geri versin**. `kilitle` açık kasayı tekrar
  kilitli tipe çevirsin. Boşlukları doldur.
code: |
  struct KilitliKasa {
      altin: u32,
  }

  struct AcikKasa {
      altin: u32,
  }

  impl KilitliKasa {
      fn ac(___0, sifre: &str) -> Result<AcikKasa, KilitliKasa> {
          if sifre == "1923" {
              Ok(AcikKasa { altin: self.altin })
          } else {
              Err(self)
          }
      }
  }

  impl AcikKasa {
      fn al(&mut self, adet: u32) -> u32 {
          let alinan = adet.min(self.altin);
          self.altin -= alinan;
          alinan
      }

      fn kilitle(self) -> ___1 {
          KilitliKasa { altin: self.altin }
      }
  }

  fn main() {
      let kasa = KilitliKasa { altin: 10 };
      let kasa = match kasa.ac("1234") {
          Ok(_) => panic!("yanlış şifreyle açılmamalıydı"),
          Err(geri_gelen) => geri_gelen,
      };
      let mut acik = match kasa.ac("1923") {
          Ok(a) => a,
          Err(_) => panic!("doğru şifre reddedildi"),
      };
      let alinan = acik.al(3);
      let kasa = acik.kilitle();
      println!("{alinan} altın alındı, kasada {} kaldı", kasa.altin);
  }
blanks:
  - ["self"]
  - ["KilitliKasa"]
output: "3 altın alındı, kasada 7 kaldı"
explanation: |
  `ac(self, ...)` kilitli kasayı **tüketir**: başarılıysa yerine bir `AcikKasa` verir, başarısızsa aynı kasayı
  `Err(self)` ile geri döndürür. Böylece yanlış şifre kasayı “kaybettirmez”. `kilitle(self) -> KilitliKasa` ise
  geri dönüş geçişi. `KilitliKasa` üzerinde `al` metodu olmadığı için kilitliyken altın almak derleme hatasıdır.
  Standart kütüphanede de bu kalıp var: `String::from_utf8(v)` hata durumunda baytları `FromUtf8Error` içinde
  geri verir (`into_bytes()`).
```

```exercise
id: m20-l04-e-kargo
title: Typestate ile kargo takibi
difficulty: 3
prompt: |
  Bir kargo şirketi için typestate tasarımı tamamla. Paket üç aşamadan geçiyor:
  `Paket` → (`etiketle`) → `EtiketliPaket` → (`kargoya_ver`) → `YoldakiPaket` → (`teslim_et`) → teslim mesajı.

  - `Paket::new(icerik, agirlik_gram)`
  - `etiketle(self, adres)`: adresi ekleyip `EtiketliPaket` döndürür.
  - `EtiketliPaket::kargoya_ver(self, sira_no)`: takip numarası `"TR"` + 6 haneli, başı sıfırlarla doldurulmuş sıra
    numarasıdır (42 → `"TR000042"`). Ücret (TL): **50 TL taban + başlayan her kilogram için 10 TL**
    (1000 g → 60, 1001 g → 70, 0 g → 50).
  - `YoldakiPaket::teslim_et(self, alan_kisi)`: `"TR000042 (kitap) Ankara adresinde Ayşe'ye teslim edildi"`
    biçiminde bir mesaj döndürür ve paketi tüketir.
starter: |
  mod kargo {
      pub struct Paket {
          icerik: String,
          agirlik_gram: u32,
      }

      pub struct EtiketliPaket {
          icerik: String,
          agirlik_gram: u32,
          adres: String,
      }

      pub struct YoldakiPaket {
          icerik: String,
          adres: String,
          takip_no: String,
          ucret: u32,
      }

      impl Paket {
          pub fn new(icerik: &str, agirlik_gram: u32) -> Paket {
              Paket { icerik: String::from(icerik), agirlik_gram }
          }

          pub fn etiketle(self, adres: &str) -> EtiketliPaket {
              todo!()
          }
      }

      impl EtiketliPaket {
          pub fn adres(&self) -> &str {
              &self.adres
          }

          pub fn kargoya_ver(self, sira_no: u32) -> YoldakiPaket {
              todo!()
          }
      }

      impl YoldakiPaket {
          pub fn takip_no(&self) -> &str {
              &self.takip_no
          }

          pub fn ucret(&self) -> u32 {
              self.ucret
          }

          pub fn teslim_et(self, alan_kisi: &str) -> String {
              todo!()
          }
      }
  }

  fn main() {
      let paket = kargo::Paket::new("kitap", 1200);
      let paket = paket.etiketle("Ankara");
      let paket = paket.kargoya_ver(42);
      println!("{} — {} TL", paket.takip_no(), paket.ucret());
      println!("{}", paket.teslim_et("Ayşe"));
  }
solution: |
  mod kargo {
      pub struct Paket {
          icerik: String,
          agirlik_gram: u32,
      }

      pub struct EtiketliPaket {
          icerik: String,
          agirlik_gram: u32,
          adres: String,
      }

      pub struct YoldakiPaket {
          icerik: String,
          adres: String,
          takip_no: String,
          ucret: u32,
      }

      impl Paket {
          pub fn new(icerik: &str, agirlik_gram: u32) -> Paket {
              Paket { icerik: String::from(icerik), agirlik_gram }
          }

          pub fn etiketle(self, adres: &str) -> EtiketliPaket {
              EtiketliPaket {
                  icerik: self.icerik,
                  agirlik_gram: self.agirlik_gram,
                  adres: String::from(adres),
              }
          }
      }

      impl EtiketliPaket {
          pub fn adres(&self) -> &str {
              &self.adres
          }

          pub fn kargoya_ver(self, sira_no: u32) -> YoldakiPaket {
              let kilo = self.agirlik_gram.div_ceil(1000);
              YoldakiPaket {
                  icerik: self.icerik,
                  adres: self.adres,
                  takip_no: format!("TR{sira_no:06}"),
                  ucret: 50 + 10 * kilo,
              }
          }
      }

      impl YoldakiPaket {
          pub fn takip_no(&self) -> &str {
              &self.takip_no
          }

          pub fn ucret(&self) -> u32 {
              self.ucret
          }

          pub fn teslim_et(self, alan_kisi: &str) -> String {
              format!(
                  "{} ({}) {} adresinde {alan_kisi}'ye teslim edildi",
                  self.takip_no, self.icerik, self.adres
              )
          }
      }
  }

  fn main() {
      let paket = kargo::Paket::new("kitap", 1200);
      let paket = paket.etiketle("Ankara");
      let paket = paket.kargoya_ver(42);
      println!("{} — {} TL", paket.takip_no(), paket.ucret());
      println!("{}", paket.teslim_et("Ayşe"));
  }
check: tests
tests: |
  use kargo::Paket;

  #[test]
  fn etiket_adresi_tasir() {
      let e = Paket::new("çay", 500).etiketle("Rize");
      assert_eq!(e.adres(), "Rize", "Etiketli paket verilen adresi taşımalı");
  }

  #[test]
  fn takip_no_alti_haneli() {
      let y = Paket::new("kitap", 300).etiketle("Ankara").kargoya_ver(42);
      assert_eq!(y.takip_no(), "TR000042", "Sıra numarası 6 haneye sıfırla tamamlanmalı");
      let y2 = Paket::new("kitap", 300).etiketle("Ankara").kargoya_ver(123456);
      assert_eq!(y2.takip_no(), "TR123456");
  }

  #[test]
  fn ucret_baslayan_kilograma_gore() {
      let ucret = |gram| Paket::new("x", gram).etiketle("İzmir").kargoya_ver(1).ucret();
      assert_eq!(ucret(0), 50, "Ağırlıksız paket yalnızca taban ücret öder");
      assert_eq!(ucret(1000), 60, "Tam 1 kg = 50 + 10");
      assert_eq!(ucret(1001), 70, "1 kg'ı 1 gram geçen paket 2 kg sayılır");
      assert_eq!(ucret(4500), 100, "4,5 kg → 5 kg → 50 + 50");
  }

  #[test]
  fn teslim_mesaji() {
      let mesaj = Paket::new("lokum", 250).etiketle("Bursa").kargoya_ver(7).teslim_et("Mehmet");
      assert_eq!(mesaj, "TR000007 (lokum) Bursa adresinde Mehmet'ye teslim edildi");
  }
hints:
  - "Her geçiş eski değeri tüketip yeni bir struct kurar; `String` alanları **taşı**: `EtiketliPaket { icerik: self.icerik, agirlik_gram: self.agirlik_gram, adres: String::from(adres) }`."
  - "Başlayan kilogram için yukarı yuvarlanmış bölme: `self.agirlik_gram.div_ceil(1000)` (ya da `(g + 999) / 1000`). Takip numarası: `format!(\"TR{sira_no:06}\")`. `:06` genişliği 6 yapar ve başa sıfır koyar (Modül 1)."
  - "`teslim_et`: `format!(\"{} ({}) {} adresinde {alan_kisi}'ye teslim edildi\", self.takip_no, self.icerik, self.adres)`."
explanation: |
  Hiçbir metot “yanlış aşamada mıyım?” diye kontrol yapmıyor, çünkü yanlış aşama **temsil edilemiyor**: etiketsiz
  bir paketin `kargoya_ver` metodu yok, yoldaki bir paketi ikinci kez teslim edemezsin (`teslim_et(self)` onu
  tüketir; tekrar çağırmak E0382). Durum deseninin trait nesneli sürümünde bu kontrollerin her biri bir çalışma
  zamanı kararı olurdu.

  Geçişlerde `self.icerik` gibi alanlar **taşındı**, kopyalanmadı; `String`'lerin heap verisi paketle birlikte
  bir struct'tan ötekine geçti. `agirlik_gram` `YoldakiPaket`'te artık gerekmediği için alınmadı (ücrete
  dönüştü); her durum yalnızca o aşamada anlamlı veriyi taşıyor. Bu da typestate'in bir artısıdır.

  (Türkçe dilbilgisi notu: ek, ismin son ünlüsüne göre değişir: “Mehmet'e”, “Ayşe'ye”. Gerçek bir uygulamada
  bunu da hesaplamak gerekirdi. Burada sabit `'ye` kullandık.)
```

## Hangisini ne zaman seçmeli?

Üç yol gördün: trait nesneli durum deseni, typestate ve (Modül 7'den bildiğin) bir **enum durum makinesi**.
Sonuncusu Rust'ta çok yaygındır. Bütün geçişler tek bir yerde, kapsamlı `match`'lerle durur:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Durum {
    Taslak,
    Inceleniyor,
    Yayinda,
}

struct Gonderi {
    durum: Durum,
    icerik: String,
}

impl Gonderi {
    fn inceleme_iste(&mut self) {
        if self.durum == Durum::Taslak {
            self.durum = Durum::Inceleniyor;
        }
    }

    fn onayla(&mut self) {
        self.durum = match self.durum {
            Durum::Inceleniyor => Durum::Yayinda,
            diger => diger, // diğer durumlarda değişiklik yok
        };
    }

    fn icerik(&self) -> &str {
        match self.durum {
            Durum::Yayinda => &self.icerik,
            Durum::Taslak | Durum::Inceleniyor => "",
        }
    }
}

fn main() {
    let mut g = Gonderi { durum: Durum::Taslak, icerik: String::from("Van kahvaltısı") };
    g.inceleme_iste();
    g.onayla();
    println!("{:?}: {}", g.durum, g.icerik());
}
```

| | Trait nesneli durum (`Box<dyn Durum>`) | Typestate (durum = tip) | Enum durum makinesi |
|---|---|---|---|
| Geçersiz geçiş | Çalışma zamanında yutulur/ele alınır | **Derlenmez** | Çalışma zamanında ele alınır |
| Durum ne zaman belli? | Çalışma zamanı | Derleme zamanı | Çalışma zamanı |
| Farklı durumdaki nesneleri tek `Vec`'te tutmak | Kolay | Zor (ayrıca bir enum gerekir) | Kolay |
| Yeni durum eklemek | Yeni struct + impl | Yeni tip + geçiş metotları | Enum'a varyant; `match`'ler uyarır |
| Maliyet | Heap + vtable | Sıfır | Sıfır |

Pratik rehber:

- Durum **derleme zamanında bilinebiliyorsa** (bir API'yi doğru sırada kullanma: önce bağlan, sonra gönder;
  builder'lar; protokol adımları) → **typestate**. Kullanıcıların yanlış kullanamadığı API'ler kurar.
- Durum **dışarıdan gelip çalışma anında değişiyorsa** (veritabanından okunan sipariş durumu, kullanıcı
  tıklamaları) ve durum kümesi senin elindeyse → **enum**.
- Durumlar **açık bir küme** olmalıysa (eklentilerin yeni durumlar tanımlaması) ya da her durumun karmaşık,
  bağımsız bir mantığı varsa → **trait nesneli durum deseni**.

```quiz
question: |
  Bir veritabanı bağlantı kütüphanesi yazıyorsun. Kurallar: önce `baglan()`, sonra (isteğe bağlı) `giris_yap()`,
  ancak giriş yapıldıktan sonra `sorgu()` çalıştırılabilir. Kütüphaneni kullananların bu sırayı **yanlışlıkla
  bozamaması** en önemli hedef. Hangi tasarım en uygun?
options:
  - "Tek bir `Baglanti` struct'ı ve her metodun başında `if !self.giris_yapildi { panic!(...) }` kontrolü"
  - "Typestate: `Baglanti` → `baglan()` → `AcikBaglanti` → `giris_yap()` → `OturumluBaglanti`; `sorgu()` yalnızca sonuncusunda"
  - "`Box<dyn BaglantiDurumu>` ile durum deseni; geçersiz çağrılar sessizce yok sayılır"
  - Durumu bir `String` alanında tutmak (`"acik"`, `"oturumlu"`) ve karşılaştırmak
answer: 1
explanation: |
  Sıra **derleme zamanında** bilinen bir API sözleşmesi; typestate onu tip sistemine kodlar. `sorgu()` metodu
  yalnızca `OturumluBaglanti`'da var, yani yanlış sıra derlenmez bile. Panik ve sessizce yok sayma hataları
  çalışma anına (ya da hiç fark edilmemeye) bırakır; `String` ile durum tutmak ise yazım hatalarına bile açıktır
  ve derleyicinin kapsamlılık kontrolünü kaybettirir.
feedback:
  - Çalışır ama hata ancak program çalışırken, belki de canlı sistemde ortaya çıkar.
  - Doğru!
  - Sessizce yok sayılan çağrılar en sinsi hatalardır.
  - "“Stringly typed” kod: derleyici hiçbir şeyi kontrol edemez."
```

## Özet

:::remember
- **Durum deseni**: nesne o anki durum nesnesini tutar (`Option<Box<dyn Durum>>`) ve davranışı ona devreder.
  Geçişler `self: Box<Self>` alan ve yeni durumu döndüren metotlarla yapılır.
- `&mut self` arkasındaki bir alanı taşıyamazsın (**E0507**); `Option::take()` değeri alıp yerine `None` bırakır.
- Zayıf yanları: geçersiz işlemler sessizce yutulur, durumlar birbirini tanır, `self` döndüren tekrar
  (varsayılan gövdede `Self: Sized` gerekir), heap + vtable maliyeti.
- **Typestate**: her durum ayrı bir tip; geçişler `self` alıp yeni tip döndürür. Geçersiz kullanım derlenmez
  (**E0599**, eski değeri kullanmak **E0382**). Başarısız geçişte eski durumu `Err` içinde geri ver.
- Seçim: derleme zamanı API sırası → typestate; çalışma zamanı, kapalı küme → enum; açık küme ya da karmaşık
  bağımsız durum mantığı → `Box<dyn Durum>`.
:::

```reflect
prompt: |
  “Geçersiz durumları temsil edilemez hâle getir (make illegal states unrepresentable)” sözünü blog örneği
  üzerinden açıkla. Trait nesneli sürümde ve typestate sürümünde “taslağın içeriğini okumak” ne oluyor?
answer: |
  Trait nesneli sürümde taslağın içeriğini okumak geçerli bir çağrıdır; `icerik()` çalışır ve boş metin döner.
  Kural çalışma zamanında, durum nesnesinin verdiği cevapla uygulanır ve yanlış kullanımı derleyici fark etmez.
  Typestate sürümünde ise `TaslakGonderi` tipinin `icerik` metodu yoktur; bu çağrı yazılamaz, derleme hatası
  (E0599) verir. Yani “içeriği okunabilen taslak” diye bir değer programda var olamaz.

  Sözün anlamı bu: kuralları kontrol eden kodlar yazmak yerine tipleri öyle tasarlıyorum ki kuralı çiğneyen bir
  değer hiç oluşturulamasın. Böylece hatalar test yazmadan, derleme anında yakalanır.
```

```flashcards
- front: "Durum deseninde geçiş metotları neden `self: Box<Self>` alır?"
  back: "Eski durum nesnesini tüketip yerine yeni bir kutulu durum (`Box<dyn Durum>`) döndürebilmek için. Bu alıcı dyn uyumludur."
- front: "`self.durum = self.durum.ilerle();` neden E0507 verir?"
  back: "`ilerle` sahiplik ister ama `self` yalnızca `&mut` ile ödünç alınmış; ödünç alınan yapının alanı dışarı taşınamaz."
- front: "`Option::take()` ne yapar?"
  back: "`Option`'daki değeri dışarı alır ve yerine `None` bırakır; böylece alan hiçbir an geçersiz (taşınmış) olmaz."
- front: "Trait'te `fn onayla(self: Box<Self>) -> Box<dyn Durum> { self }` varsayılan gövdesi neden derlenmez?"
  back: "Varsayılan gövdede `Self`'in boyutu bilinmez; `Box<Self>` → `Box<dyn Durum>` dönüşümü `Self: Sized` ister (E0277)."
- front: Typestate deseni nedir?
  back: Her durumun ayrı bir tip olduğu, geçişlerin `self` alıp yeni tip döndürdüğü desen; geçersiz geçişler derleme hatası olur.
- front: Typestate'te başarısız olabilen bir geçiş nasıl tasarlanır?
  back: "`Result<YeniDurum, EskiDurum>` döndürülür; başarısızlıkta eski değer `Err(self)` ile geri verilir."
- front: Çalışma anında değişen ve kümesi senin kontrolünde olan durumlar için en idiomatik seçim nedir?
  back: Bir enum durum makinesi (geçişler kapsamlı `match`'lerle tek yerde).
```
