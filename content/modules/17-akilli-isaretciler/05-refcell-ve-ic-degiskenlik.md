---
id: m17-l05
title: RefCell ve iç değişkenlik
minutes: 25
type: lesson
objectives:
  - "İç değişkenlik (interior mutability) desenini ve neden gerektiğini (`&self` üzerinden değişiklik) açıklayabilmek"
  - "`Cell<T>` ile `Copy` değerleri, `RefCell<T>` ile her tür değeri `borrow` / `borrow_mut` kullanarak değiştirebilmek"
  - "`RefCell`'in kurallarının çalışma zamanında denetlendiğini ve ihlalin `RefCell already borrowed` paniğine yol açtığını gösterebilmek"
  - "Paylaşılan ve değiştirilebilir veri için `Rc<RefCell<T>>` kurup duruma göre `Box`, `Rc`, `Cell`, `RefCell` arasında seçim yapabilmek"
keywords: [RefCell, Cell, iç değişkenlik, interior mutability, borrow, borrow_mut, Ref, RefMut, BorrowMutError, "Rc<RefCell<T>>", mock, try_borrow_mut]
---

Önceki derste `Rc`'nin yalnızca **okuma** izni verdiğini gördük. Paylaşım ve değişiklik bir araya
gelmiyordu. Modül 5'ten beri de kuralı ezbere biliyorsun: bir değeri `&` ile alan kimse onu
değiştiremez. Peki bir hava durumu servisi kaç kez sorgulandığını saymak istese? Ya da bir test, sahte
bir nesnenin hangi mesajları aldığını kaydetmek istese? Bu işlemler **dışarıdan bakınca** değişmezdir ama
**içeride** küçük bir kayıt tutmaları gerekir.

Rust'ın cevabı **iç değişkenlik (interior mutability)**: ödünç alma kurallarını **kaldırmadan**,
denetimini derleme zamanından çalışma zamanına taşıyan tipler. Bu derste `Cell<T>` ve `RefCell<T>`'yi,
sonra da onları `Rc` ile birleştirip "paylaşılan ve değiştirilebilir" veriyi kuracağız.

## Değişmez bir şeyi değiştirmek?

Bir hava durumu servisi, kaç kez sorgulandığını saysın. Sorgulamak servisi değiştirmemeli, o yüzden
`&self` alıyor:

```compiles
code: |
  struct HavaDurumu {
      sehir: String,
      sorgu_sayisi: u32,
  }

  impl HavaDurumu {
      fn sicaklik(&self) -> i32 {
          self.sorgu_sayisi += 1;
          if self.sehir == "Erzurum" { -12 } else { 18 }
      }
  }

  fn main() {
      let servis = HavaDurumu { sehir: String::from("Erzurum"), sorgu_sayisi: 0 };
      println!("{}", servis.sicaklik());
  }
answer: false
error: E0594
explanation: |
  `&self` paylaşılan bir referanstır (Modül 6). Onun üzerinden hiçbir alan değiştirilemez. Derleyici
  `&mut self` yapmayı önerecek. Ama o zaman servisi kullanan **herkes** ona özel (`&mut`) erişim almak
  zorunda kalır. Mantıken "sadece okuyan" bir işlem için bu çok ağır bir bedel.
```

:::error
```text
error[E0594]: cannot assign to `self.sorgu_sayisi`, which is behind a `&` reference
 --> src/main.rs:8:9
  |
8 |         self.sorgu_sayisi += 1;
  |         ^^^^^^^^^^^^^^^^^^^^^^ `self` is a `&` reference, so it cannot be written to
  |
help: consider changing this to be a mutable reference
  |
7 |     fn sicaklik(&mut self) -> i32 {
  |                  +++
```
Bazen `help:` önerisi doğrudur. Ama burada sayaç bir **iç ayrıntı**; arayüzü değiştirmek istemiyoruz.
Hele servis bir `Rc` ile paylaşılıyorsa `&mut` hiç alınamaz.
:::

:::analogy Müzedeki vitrin ve görevli
Bir müzede eserler camlı vitrinlerde durur. Ziyaretçiler (paylaşılan referanslar) bakabilir ama
dokunamaz. Ama müzenin içinde bir **görevli** vardır: vitrini açmak isteyen ondan izin ister. Görevli
o an vitrinin başında kimse yoksa anahtarı verir; birileri bakıyorsa "şu an olmaz" der. Kural aynıdır
("ya tek kişi dokunur ya da herkes bakar"). Fark, kuralı mimarın (derleyici) planla değil, görevlinin
(`RefCell`) **o anda** uygulamasıdır.
:::

## Cell<T>: kopyala-al, kopyala-koy

En basit iç değişkenlik aracı `std::cell::Cell<T>`. İçindeki değere **asla referans vermez**. Yalnızca
değeri kopyalayıp verir (`get`) ya da yenisini koyar (`set`). Referans yoksa ödünç alma çakışması da olamaz,
bu yüzden `Cell` hiçbir denetim yapmaz ve hiç panik atmaz:

```rust
use std::cell::Cell;

struct HavaDurumu {
    sehir: String,
    sorgu_sayisi: Cell<u32>,
}

impl HavaDurumu {
    fn sicaklik(&self) -> i32 {
        self.sorgu_sayisi.set(self.sorgu_sayisi.get() + 1); // &self yeterli!
        if self.sehir == "Erzurum" { -12 } else { 18 }
    }
}

fn main() {
    let servis = HavaDurumu { sehir: String::from("Erzurum"), sorgu_sayisi: Cell::new(0) };
    println!("{} derece", servis.sicaklik());
    println!("{} derece", servis.sicaklik());
    println!("{} kez sorgulandı", servis.sorgu_sayisi.get());
}
```

`servis` `mut` bile değil. `get` değeri **kopyaladığı** için yalnızca `T: Copy` tiplerde çalışır (`u32`,
`bool`, `char`...). `String` gibi tipler için `Cell`'in `replace(yeni)` (eskisini döndürür) ve `take()`
(yerine `Default` koyar) metotları vardır. Ama "içine bakıp bir metot çağırmak" istiyorsan `RefCell`
gerekir.

```predict
code: |
  use std::cell::Cell;

  fn main() {
      let c = Cell::new(5);
      let a = &c;
      let b = &c;
      a.set(a.get() * 2);
      b.set(b.get() + 1);
      let eski = c.replace(100);
      println!("{eski} {}", c.get());
  }
options:
  - "11 100"
  - "5 100"
  - "10 100"
  - Derlenmez, çünkü `a` ve `b` aynı anda değiştiriyor
answer: 0
explanation: |
  `a` ve `b` aynı `Cell`'e iki **paylaşılan** referans; ikisi de değeri değiştirebiliyor. `5 * 2 = 10`,
  sonra `10 + 1 = 11`. `replace(100)` eski değeri (11) döndürüp 100 koyar. Bu neden güvenli? `Cell`
  içeriye hiçbir zaman referans vermediği için, değer değişirken "eski değeri gösteren" bir referans
  olamaz. Her işlem tek ve bölünmez bir kopyalamadır. (Tek thread'de; `Cell` thread'ler arasında
  paylaşılamaz.)
```

## RefCell<T>: çalışma zamanında ödünç denetimi

`RefCell<T>` her tip için çalışır ve sana gerçek referanslar verir:

- `borrow()` → `Ref<T>`: paylaşılan bir okuma koruyucusu (`&T` gibi davranır)
- `borrow_mut()` → `RefMut<T>`: özel bir yazma koruyucusu (`&mut T` gibi davranır)

`RefCell` içeride kaç okuyucu ve yazıcı olduğunu sayar. Kurallar Modül 5'tekiyle **aynıdır**: ya bir
`RefMut` ya da istediğin kadar `Ref`. Fark, denetimin **çalışma zamanında** yapılmasıdır. Bu derlenir mi?

```compiles
code: |
  use std::cell::RefCell;

  fn main() {
      let sepet = RefCell::new(vec!["elma"]);
      let bakis = sepet.borrow();
      sepet.borrow_mut().push("armut");
      println!("{}", bakis.len());
  }
answer: true
explanation: |
  **Derlenir!** `borrow` ve `borrow_mut` ikisi de `&self` alan sıradan metotlardır; derleyicinin gözünde
  burada hiçbir çakışma yok. Ama kural yine de geçerli: program **çalışınca** `bakis` hâlâ yaşarken
  `borrow_mut` çağrıldığı için `RefCell` **panik** atar. Derleme hatası yerine çalışma zamanı paniği:
  `RefCell`'in bedeli budur.
```

```rust,should_panic
use std::cell::RefCell;

fn main() {
    let sepet = RefCell::new(vec!["elma"]);
    let bakis = sepet.borrow(); // okuyucu sayısı: 1
    sepet.borrow_mut().push("armut"); // yazıcı istendi ama okuyucu var → PANİK
    println!("{}", bakis.len());
}
```

:::error
```text
thread 'main' (13) panicked at src/main.rs:6:11:
RefCell already borrowed
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
"RefCell zaten ödünç alınmış." Bu bir **derleyici** mesajı değil, bir panik. Hata `borrow_mut`'un çağrıldığı
satırı gösterir (parantezdeki sayı thread'in kimliğidir, her çalıştırmada farklı olabilir). Tersini
yapsaydın (yazıcı yaşarken `borrow()`) mesaj `RefCell already mutably borrowed` olurdu.
:::

```memory
title: RefCell'in iç sayacı
steps:
  - caption: "`let bakis = sepet.borrow();`, `RefCell` bir okuyucu kaydeder. `bakis`, içerideki `Vec`'i gösteren bir `Ref`."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "RefCell<Vec<&str>>", value: "okuyucu=1 · Vec(ptr, len=1)", to: h1 }
          - { name: bakis, type: "Ref<Vec<&str>>", value: "ref", to: sepet }
    heap:
      - { id: h1, value: "\"elma\"" }
  - caption: "`sepet.borrow_mut()`, okuyucu varken yazıcı istendi. `RefCell` sayaca bakar ve **panik** atar. Panik olmasaydı, `push` `Vec`'i yeniden tahsis edip `bakis`'in gösterdiği belleği geçersiz kılabilirdi."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "RefCell<Vec<&str>>", value: "okuyucu=1 · yazıcı isteği ✗", to: h1 }
          - { name: bakis, type: "Ref<Vec<&str>>", value: "ref", to: sepet }
    heap:
      - { id: h1, value: "\"elma\"" }
```

Çözüm, 3. dersteki koruyucu bilgisiyle kolay: **`Ref` ve `RefMut` birer koruyucudur**. Drop edildiklerinde
sayacı geri alırlar. Ödüncü kısa tut:

```rust
use std::cell::RefCell;

fn main() {
    let sepet = RefCell::new(vec!["elma"]);

    let adet = sepet.borrow().len(); // geçici Ref, satırın sonunda drop edilir
    sepet.borrow_mut().push("armut"); // artık okuyucu yok, sorun yok

    {
        let mut yazici = sepet.borrow_mut();
        yazici.push("kiraz");
        yazici.push("muz");
    } // yazici burada drop edilir

    let bakis = sepet.borrow();
    println!("önce {adet}, şimdi {} ürün: {:?}", bakis.len(), *bakis);
    drop(bakis); // istersen elle de bırakabilirsin

    // Panik yerine hata istiyorsan try_ sürümleri Result döndürür:
    let _okuyucu = sepet.borrow();
    match sepet.try_borrow_mut() {
        Ok(_) => println!("yazabildim"),
        Err(e) => println!("yazamadım: {e}"),
    }
}
```

:::warning Neden hep derleme zamanı denetimini tercih etmeliyiz?
Borrow checker'ın hatası programı **çalıştırmadan önce**, her olası yol için yakalar. `RefCell`'in paniği
ise yalnızca o kod yolu **gerçekten çalıştığında** ortaya çıkar. Belki de testte hiç denemediğin bir
kenar durumda, üretimde. Ayrıca her `borrow` küçük bir sayaç işlemidir. Kural: Önce sıradan sahiplik ve
`&mut` ile tasarla. `RefCell`'i yalnızca derleyicinin kanıtlayamadığı ama senin doğru olduğundan emin
olduğun durumlar için sakla.
:::

## Örnek: sahte (mock) nesne

İç değişkenliğin en klasik kullanımı testlerdeki **sahte nesneler (mock objects)**. Bir mobil operatör,
kullanıcının internet kotasını takip edip eşiklerde mesaj gönderiyor. Mesaj gönderme işi bir trait'in
(Modül 11) arkasında:

```rust,ignore
trait Mesajci {
    fn gonder(&self, mesaj: &str); // &self: göndermek, gönderen nesneyi "değiştirmez"
}
```

Testte gerçek SMS göndermek istemeyiz. Bunun yerine, gönderilen mesajları **bir listeye kaydeden** sahte bir
`Mesajci` yazalım. Ama trait `&self` diyor:

```compiles
code: |
  trait Mesajci {
      fn gonder(&self, mesaj: &str);
  }

  struct SahteMesajci {
      gonderilenler: Vec<String>,
  }

  impl Mesajci for SahteMesajci {
      fn gonder(&self, mesaj: &str) {
          self.gonderilenler.push(String::from(mesaj));
      }
  }

  fn main() {}
answer: false
error: E0596
explanation: |
  `push`, `Vec`'i değiştirir ve bir `&mut` ister. Elimizde ise yalnızca `&self` var. Derleyici, trait'in
  imzasını `&mut self` yapmayı önerir. Ama trait'i değiştirmek, yalnızca bir test için **gerçek**
  kodun bütün kullanıcılarını etkiler. Belki trait bir kütüphaneden geliyor ve sen değiştiremiyorsun bile.
```

:::error
```text
error[E0596]: cannot borrow `self.gonderilenler` as mutable, as it is behind a `&` reference
  --> src/main.rs:11:9
   |
11 |         self.gonderilenler.push(String::from(mesaj));
   |         ^^^^^^^^^^^^^^^^^^ `self` is a `&` reference, so it cannot be borrowed as mutable
   |
help: consider changing this to be a mutable reference in the `impl` method and the `trait` definition
   |
 2 ~     fn gonder(&mut self, mesaj: &str);
 3 | }
...
 9 | impl Mesajci for SahteMesajci {
10 ~     fn gonder(&mut self, mesaj: &str) {
   |
```
:::

`RefCell` ile trait'e dokunmadan çözeriz:

```rust
use std::cell::RefCell;

trait Mesajci {
    fn gonder(&self, mesaj: &str);
}

struct KotaTakipci<'a, T: Mesajci> {
    mesajci: &'a T,
    kullanilan_mb: u32,
    kota_mb: u32,
}

impl<'a, T: Mesajci> KotaTakipci<'a, T> {
    fn new(mesajci: &'a T, kota_mb: u32) -> Self {
        KotaTakipci { mesajci, kullanilan_mb: 0, kota_mb }
    }

    fn kullan(&mut self, mb: u32) {
        self.kullanilan_mb += mb;
        let yuzde = self.kullanilan_mb * 100 / self.kota_mb;
        if yuzde >= 100 {
            self.mesajci.gonder("Kotanız doldu!");
        } else if yuzde >= 90 {
            self.mesajci.gonder("Acil uyarı: kotanızın %90'ını kullandınız");
        } else if yuzde >= 75 {
            self.mesajci.gonder("Uyarı: kotanızın %75'ini kullandınız");
        }
    }
}

struct SahteMesajci {
    gonderilenler: RefCell<Vec<String>>,
}

impl Mesajci for SahteMesajci {
    fn gonder(&self, mesaj: &str) {
        self.gonderilenler.borrow_mut().push(String::from(mesaj));
    }
}

fn main() {
    let sahte = SahteMesajci { gonderilenler: RefCell::new(Vec::new()) };
    let mut takipci = KotaTakipci::new(&sahte, 1000);
    takipci.kullan(500); // %50 → mesaj yok
    takipci.kullan(300); // %80 → uyarı
    takipci.kullan(150); // %95 → acil uyarı

    let mesajlar = sahte.gonderilenler.borrow();
    assert_eq!(mesajlar.len(), 2);
    println!("{mesajlar:#?}");
}
```

Modül 13'teki gibi bunu bir `#[test]` fonksiyonuna koyduğunda, `KotaTakipci`'nin doğru eşiklerde doğru
mesajları gönderdiğini **gerçek bir SMS göndermeden** test etmiş olursun. Modül 11 (trait), 12 (`'a`), 13
(test) ve bu dersin aracı aynı örnekte buluşuyor.

:::deep Perde arkası: UnsafeCell
`Cell`, `RefCell` ve Modül 18'deki `Mutex` gibi bütün iç değişkenlik tiplerinin temelinde
`std::cell::UnsafeCell<T>` vardır. Rust'ta bir `&T` üzerinden değişiklik yapmanın **tek yasal yolu**
budur. Derleyici normalde "`&T` arkasındaki veri değişmez" varsayımıyla optimizasyon yapar; `UnsafeCell`
bu varsayımı o tip için kapatır. `RefCell` bu tehlikeli temelin üstüne sayaçlı, **güvenli** bir arayüz kurar.
`unsafe` ile bu tür soyutlamaları kendin yazmayı Modül 24'te göreceğiz.
:::

## Rc<RefCell<T>>: paylaşılan ve değiştirilebilir

Şimdi önceki dersin eksiğini kapatabiliriz. `Rc<T>` = **birden çok sahip** ama salt okuma. `RefCell<T>` =
**tek sahip** ama `&` üzerinden değişiklik. İkisini birleştirince: birden çok sahip **ve** değişiklik.

Bir ailenin ortak banka hesabı ve her birinin ayrı kartı olsun:

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Hesap {
    bakiye: i64,
    hareketler: Vec<String>,
}

struct Kart {
    sahibi: String,
    hesap: Rc<RefCell<Hesap>>,
}

impl Kart {
    fn harca(&self, tutar: i64, nereye: &str) -> bool {
        let mut hesap = self.hesap.borrow_mut(); // RefMut<Hesap>
        if hesap.bakiye < tutar {
            return false; // hesap (RefMut) burada da drop edilir
        }
        hesap.bakiye -= tutar;
        hesap.hareketler.push(format!("{}: {nereye} -{tutar} TL", self.sahibi));
        true
    }
}

fn main() {
    let ortak = Rc::new(RefCell::new(Hesap { bakiye: 1000, hareketler: Vec::new() }));
    let anne = Kart { sahibi: "Anne".into(), hesap: Rc::clone(&ortak) };
    let ogul = Kart { sahibi: "Oğul".into(), hesap: Rc::clone(&ortak) };

    anne.harca(400, "market");
    ogul.harca(250, "kitapçı");
    let onay = ogul.harca(500, "oyun konsolu");

    let h = ortak.borrow();
    println!("bakiye: {} TL, son işlem onaylandı mı? {onay}", h.bakiye);
    for satir in &h.hareketler {
        println!("  {satir}");
    }
}
```

```memory
title: "Rc<RefCell<Hesap>>"
steps:
  - caption: "Üç `Rc` aynı kutuyu gösterir (strong=3). Kutunun içinde `RefCell`'in ödünç sayacı ve `Hesap` var."
    stack:
      - frame: main
        vars:
          - { name: ortak, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
          - { name: anne.hesap, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
          - { name: ogul.hesap, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "strong=3 · ödünç=yok · Hesap { bakiye: 1000 }", label: "Rc kutusu" }
  - caption: "`anne.harca(..)` sırasında `borrow_mut` yazıcıyı kaydeder. Fonksiyon bitince `RefMut` drop edilir, sayaç sıfırlanır."
    stack:
      - frame: harca
        vars:
          - { name: hesap, type: "RefMut<Hesap>", value: "yazıcı", to: h1 }
      - frame: main
        vars:
          - { name: ortak, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
          - { name: anne.hesap, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
          - { name: ogul.hesap, type: "Rc<RefCell<Hesap>>", value: "ptr", to: h1 }
    heap:
      - { id: h1, value: "strong=3 · ödünç=1 yazıcı · Hesap { bakiye: 600 }", label: "Rc kutusu" }
```

Sıra önemli: `Rc<RefCell<T>>` (paylaşılan bir hücre). `RefCell<Rc<T>>` ise "değiştirilebilir bir
işaretçi" olur; hangi `Rc`'yi tuttuğunu değiştirebilirsin ama gösterdiği veriyi değiştiremezsin.

```predict
code: |
  use std::cell::RefCell;
  use std::rc::Rc;

  fn main() {
      let liste = Rc::new(RefCell::new(vec![1, 2]));
      let a = Rc::clone(&liste);
      let b = Rc::clone(&liste);
      a.borrow_mut().push(3);
      b.borrow_mut().push(4);
      println!("{:?} {}", liste.borrow(), Rc::strong_count(&liste));
  }
options:
  - "[1, 2, 3, 4] 3"
  - "[1, 2] 3"
  - "[1, 2, 3, 4] 1"
  - Panik atar, çünkü iki kez `borrow_mut` çağrılıyor
answer: 0
explanation: |
  `a`, `b` ve `liste` aynı `RefCell`'i paylaşır; birinin yaptığı değişiklik hepsinden görünür. İki
  `borrow_mut` **aynı anda** değil, **ardışık**: her biri satırın sonunda geçici bir değer olarak drop
  edilir, bu yüzden panik yok. Sahip sayısı 3. `Ref<Vec<i32>>` `Debug` uyguladığı için `{:?}` doğrudan
  içteki vektörü yazdırır.
```

```fill
prompt: |
  Bir sınıftaki öğretmen ve rehber öğretmen aynı yoklama listesini paylaşıyor ve ikisi de ekleme yapabiliyor.
  Boşlukları doldur. Program `["Ece", "Arda"]` yazdırmalı.
code: |
  use std::cell::RefCell;
  use std::rc::Rc;

  fn main() {
      let yoklama = Rc::new(___0(Vec::new()));
      let ogretmen = Rc::clone(&yoklama);
      let rehber = Rc::clone(&yoklama);

      ogretmen.___1().push(String::from("Ece"));
      rehber.borrow_mut().push(String::from("Arda"));

      println!("{:?}", yoklama.___2());
  }
blanks:
  - ["RefCell::new"]
  - ["borrow_mut"]
  - ["borrow", "borrow_mut"]
explanation: |
  Dış katman `Rc` (paylaşım), iç katman `RefCell` (değişiklik). `ogretmen.borrow_mut()` yazarken önce
  `Rc` auto-deref ile açılır, sonra `RefCell`'in metodu çağrılır. Yazdırmak için `borrow()` yeterli. Bir
  okuma için yazma koruyucusu (`borrow_mut`) almak da çalışır ama niyeti yanlış anlatır ve gereksiz yere
  diğer okuyucuları engeller.
```

## Hangisini seçmeli?

| | `Box<T>` | `Rc<T>` | `Cell<T>` | `RefCell<T>` |
|---|---|---|---|---|
| **Sahip sayısı** | tek | çok | tek | tek |
| **Değiştirme** | `&mut` ile | yok (salt okuma) | `&self` ile, kopyalayarak | `&self` ile, `borrow_mut` |
| **Kurallar ne zaman denetlenir?** | derleme | derleme | gerekmez (referans vermez) | **çalışma zamanı** (ihlal = panik) |
| **Ek maliyet** | heap tahsisi | tahsis + sayaç | yok | ödünç sayacı |
| **Tipik kullanım** | özyinelemeli tip, `dyn Trait` | paylaşılan salt okunur veri | sayaç, bayrak | önbellek, mock, paylaşılan durum (`Rc` ile) |

Hepsi **tek thread** içindir (`Box` hariç). Thread'ler arasında paylaşım ve değişiklik için karşılıkları
Modül 18'de: `Arc<T>` (`Rc`'nin atomik kardeşi) ve `Mutex<T>` / `RwLock<T>` (`RefCell`'in kilitli
kardeşleri).

```quiz
question: |
  Bir oyunda birçok düşman aynı **ses ayarları** nesnesini okuyor. Oyuncu menüden ses seviyesini
  değiştirdiğinde hepsi yeni değeri görmeli. Ayar nesnesi bir `String` (ses paketi adı) ve bir `u8`
  (seviye) içeriyor. En uygun tip hangisi?
options:
  - "`Box<Ayarlar>`, her düşmana bir tane"
  - "`Rc<Ayarlar>`"
  - "`Rc<RefCell<Ayarlar>>`"
  - "`RefCell<Rc<Ayarlar>>`"
answer: 2
explanation: |
  İki ihtiyaç var: **birden çok sahip** (bütün düşmanlar) → `Rc`; **paylaşılan veriyi değiştirmek** (menü)
  → `RefCell`. Değiştirilen şey verinin kendisi olduğu için hücre içte olmalı: `Rc<RefCell<Ayarlar>>`.
  (Yalnızca seviye değişecek olsaydı, `Rc<Ayarlar>` içinde `seviye: Cell<u8>` alanı da zarif bir çözüm
  olurdu.)
feedback:
  - "Her düşmana ayrı kutu = ayrı kopyalar; menüdeki değişiklik hiçbirine yansımaz."
  - "Paylaşım tamam ama `Rc` salt okumadır; seviyeyi değiştiremezsin (E0594)."
  - "Doğru!"
  - "Bu, hangi `Rc`'yi tuttuğunu değiştirmeye yarar; paylaşılan verinin kendisi yine değişmez."
```

:::ferris
`Rc<RefCell<T>>` güçlü ama bağımlılık yapar! Her şeyi `Rc<RefCell<..>>` ile sarmalamak, Rust'ı
"çalışma zamanında patlayan Java"ya çevirir. Önce sahipliği netleştirmeyi dene. Paylaşılan durum
gerçekten gerekiyorsa o zaman bu ikiliyi çağır. 🦀
:::

## Alıştırmalar

İlk alıştırma 3. dersteki oturum günlüğünün devamı. Orada iki oturum aynı günlüğe **aynı anda** yazamıyordu.
Şimdi yazabilecek.

```exercise
id: m17-e-ortak-gunluk
title: Ortak oturum günlüğü
difficulty: 2
prompt: |
  Kütüphanede aynı anda birden çok bilgisayar açık olabiliyor ve hepsi **aynı** günlüğe yazıyor. Günlük
  artık `Rc<RefCell<Vec<String>>>` olarak paylaşılıyor ve `islem` yalnızca `&self` alıyor. Tamamla:

  - `Oturum::ac(kullanici, gunluk)`: günlüğe `"giriş: <kullanici>"` ekler, günlüğün **paylaşılan bir
    klonunu** saklar.
  - `islem(&self, ne)`: `"<kullanici>: <ne>"` ekler.
  - `Drop`: `"çıkış: <kullanici>"` ekler.

  Ödünçleri kısa tut: oturumlar açıkken de günlük okunabilmeli.
starter: |
  use std::cell::RefCell;
  use std::rc::Rc;

  struct Oturum {
      kullanici: String,
      gunluk: Rc<RefCell<Vec<String>>>,
  }

  impl Oturum {
      fn ac(kullanici: &str, gunluk: &Rc<RefCell<Vec<String>>>) -> Oturum {
          todo!()
      }

      fn islem(&self, ne: &str) {
          todo!()
      }
  }

  impl Drop for Oturum {
      fn drop(&mut self) {
          todo!()
      }
  }

  fn main() {
      let gunluk = Rc::new(RefCell::new(Vec::new()));
      {
          let ayse = Oturum::ac("ayse", &gunluk);
          let can = Oturum::ac("can", &gunluk);
          ayse.islem("kitap aradı");
          can.islem("yazdırdı");
      }
      println!("{:#?}", gunluk.borrow());
  }
solution: |
  use std::cell::RefCell;
  use std::rc::Rc;

  struct Oturum {
      kullanici: String,
      gunluk: Rc<RefCell<Vec<String>>>,
  }

  impl Oturum {
      fn ac(kullanici: &str, gunluk: &Rc<RefCell<Vec<String>>>) -> Oturum {
          gunluk.borrow_mut().push(format!("giriş: {kullanici}"));
          Oturum { kullanici: kullanici.to_string(), gunluk: Rc::clone(gunluk) }
      }

      fn islem(&self, ne: &str) {
          self.gunluk.borrow_mut().push(format!("{}: {ne}", self.kullanici));
      }
  }

  impl Drop for Oturum {
      fn drop(&mut self) {
          self.gunluk.borrow_mut().push(format!("çıkış: {}", self.kullanici));
      }
  }

  fn main() {
      let gunluk = Rc::new(RefCell::new(Vec::new()));
      {
          let ayse = Oturum::ac("ayse", &gunluk);
          let can = Oturum::ac("can", &gunluk);
          ayse.islem("kitap aradı");
          can.islem("yazdırdı");
      }
      println!("{:#?}", gunluk.borrow());
  }
check: tests
tests: |
  #[test]
  fn ayni_anda_iki_oturum() {
      let g = Rc::new(RefCell::new(Vec::new()));
      {
          let a = Oturum::ac("ayse", &g);
          let b = Oturum::ac("can", &g);
          a.islem("kitap aradı");
          b.islem("yazdırdı");
      }
      assert_eq!(
          *g.borrow(),
          ["giriş: ayse", "giriş: can", "ayse: kitap aradı", "can: yazdırdı", "çıkış: can", "çıkış: ayse"],
          "iki oturum araya girerek yazabilmeli; çıkışlar ters sırayla"
      );
  }

  #[test]
  fn gunluk_paylasilir() {
      let g = Rc::new(RefCell::new(Vec::new()));
      let o = Oturum::ac("elif", &g);
      assert_eq!(Rc::strong_count(&g), 2, "oturum günlüğün paylaşılan bir klonunu tutmalı");
      drop(o);
      assert_eq!(Rc::strong_count(&g), 1, "oturum kapanınca klon da bırakılmalı");
  }

  #[test]
  fn oturum_acikken_okunabilir() {
      let g = Rc::new(RefCell::new(Vec::new()));
      let o = Oturum::ac("mert", &g);
      o.islem("e-posta okudu");
      assert_eq!(g.borrow().len(), 2, "oturum açıkken günlük okunabilmeli (ödünçler kısa tutulmalı)");
      assert_eq!(g.borrow()[1], "mert: e-posta okudu");
  }
hints:
  - "`ac`: önce `gunluk.borrow_mut().push(...)` ile girişi yaz, sonra `Oturum { kullanici: kullanici.to_string(), gunluk: Rc::clone(gunluk) }` döndür."
  - "`islem` ve `drop` gövdeleri tek satır: `self.gunluk.borrow_mut().push(format!(...));` - geçici `RefMut` satırın sonunda bırakılır."
  - "Struct'ta bir `RefMut` saklamaya çalışma: oturum yaşadıkça günlük kilitli kalır ve okuma paniğe yol açar."
explanation: |
  3. derste `&'a mut Vec<String>` tutan oturum, günlüğe **özel** erişim istiyordu. Bu yüzden iki oturum aynı
  anda açık olamıyordu, derleyici bunu engelliyordu. Şimdi sahiplik `Rc` ile paylaşılıyor, değişiklik izni
  `RefCell` ile **anlık** alınıp bırakılıyor. Her `borrow_mut()` yalnızca bir `push` süresince yaşıyor.

  Bedeli: artık ödünç kurallarını derleyici değil `RefCell` denetliyor. Örneğin `islem` içinde
  `let g = self.gunluk.borrow_mut();` yazıp sonra bir de `self.gunluk.borrow()` çağırsaydın kod derlenir,
  test çalışırken panik atardı. Ayrıca `Oturum` artık bir yaşam süresi parametresi (`'a`) taşımıyor.
  `Rc`, "günlük en az oturum kadar yaşar" garantisini sayaçla sağlıyor.
```

````exercise
id: m17-e-onbellekli-fibonacci
title: Önbellekli Fibonacci
difficulty: 4
prompt: |
  `Fibonacci::hesapla(&self, n)` n'inci Fibonacci sayısını döndürür (`F(0) = 0`, `F(1) = 1`,
  `F(n) = F(n-1) + F(n-2)`). Metot `&self` alıyor ama iki şeyi **içeride** tutmalı:

  - `onbellek: RefCell<HashMap<u64, u64>>`: hesaplanmış değerler. Önbellekte varsa yeniden hesaplama.
  - `hesaplama_sayisi: Cell<u32>`: `n >= 2` için önbellekte **olmayan** bir değer her hesaplandığında
    bir artar (`0` ve `1` sayılmaz).

  Böylece `hesapla(10)` yalnızca 9 hesaplama yapar (n = 2..10) ve ikinci `hesapla(10)` hiç hesaplama yapmaz.
starter: |
  use std::cell::{Cell, RefCell};
  use std::collections::HashMap;

  struct Fibonacci {
      onbellek: RefCell<HashMap<u64, u64>>,
      hesaplama_sayisi: Cell<u32>,
  }

  impl Fibonacci {
      fn new() -> Self {
          Fibonacci { onbellek: RefCell::new(HashMap::new()), hesaplama_sayisi: Cell::new(0) }
      }

      fn hesapla(&self, n: u64) -> u64 {
          todo!()
      }

      fn hesaplama_sayisi(&self) -> u32 {
          self.hesaplama_sayisi.get()
      }
  }

  fn main() {
      let fib = Fibonacci::new();
      println!("F(40) = {}", fib.hesapla(40));
      println!("{} hesaplama yapıldı", fib.hesaplama_sayisi());
  }
solution: |
  use std::cell::{Cell, RefCell};
  use std::collections::HashMap;

  struct Fibonacci {
      onbellek: RefCell<HashMap<u64, u64>>,
      hesaplama_sayisi: Cell<u32>,
  }

  impl Fibonacci {
      fn new() -> Self {
          Fibonacci { onbellek: RefCell::new(HashMap::new()), hesaplama_sayisi: Cell::new(0) }
      }

      fn hesapla(&self, n: u64) -> u64 {
          if n < 2 {
              return n;
          }
          if let Some(&deger) = self.onbellek.borrow().get(&n) {
              return deger;
          }
          self.hesaplama_sayisi.set(self.hesaplama_sayisi.get() + 1);
          let sonuc = self.hesapla(n - 1) + self.hesapla(n - 2);
          self.onbellek.borrow_mut().insert(n, sonuc);
          sonuc
      }

      fn hesaplama_sayisi(&self) -> u32 {
          self.hesaplama_sayisi.get()
      }
  }

  fn main() {
      let fib = Fibonacci::new();
      println!("F(40) = {}", fib.hesapla(40));
      println!("{} hesaplama yapıldı", fib.hesaplama_sayisi());
  }
check: tests
tests: |
  #[test]
  fn kucuk_degerler() {
      let f = Fibonacci::new();
      assert_eq!(f.hesapla(0), 0, "F(0) = 0");
      assert_eq!(f.hesapla(1), 1, "F(1) = 1");
      assert_eq!(f.hesapla(2), 1, "F(2) = 1");
      assert_eq!(f.hesapla(10), 55, "F(10) = 55");
  }

  #[test]
  fn onbellek_tekrar_hesaplamayi_onler() {
      let f = Fibonacci::new();
      assert_eq!(f.hesapla(10), 55);
      assert_eq!(f.hesaplama_sayisi(), 9, "F(10) için n = 2..10 arası her değer bir kez hesaplanmalı");
      f.hesapla(10);
      f.hesapla(7);
      assert_eq!(f.hesaplama_sayisi(), 9, "önbellekteki değerler yeniden hesaplanmamalı");
  }

  #[test]
  fn buyuk_deger_hizli() {
      let f = Fibonacci::new();
      assert_eq!(f.hesapla(90), 2_880_067_194_370_816_120, "F(90) önbellekle anında bulunmalı");
      assert_eq!(f.hesaplama_sayisi(), 89);
  }

  #[test]
  fn sifir_ve_bir_sayilmaz() {
      let f = Fibonacci::new();
      f.hesapla(0);
      f.hesapla(1);
      assert_eq!(f.hesaplama_sayisi(), 0, "F(0) ve F(1) hesaplama sayılmaz");
  }
hints:
  - "Önce `n < 2` ise `n` döndür. Sonra önbelleğe bak: `if let Some(&deger) = self.onbellek.borrow().get(&n) { return deger; }`."
  - "Önbellekte yoksa sayacı artır (`self.hesaplama_sayisi.set(self.hesaplama_sayisi.get() + 1)`), `self.hesapla(n - 1) + self.hesapla(n - 2)` ile sonucu bul, sonra `self.onbellek.borrow_mut().insert(n, sonuc)`."
  - "Tuzak: özyinelemeli çağrılar sırasında bir `borrow_mut()` koruyucusu **açık kalırsa**, içerideki çağrının `borrow()`'u `RefCell already mutably borrowed` paniğine yol açar. Önce hesapla, en sonda kısa bir `borrow_mut` ile yaz."
explanation: |
  Bu alıştırma `RefCell`'in en sinsi tuzağını gösteriyor. Şöyle yazmak çok cazip:

  ```rust,ignore
  let mut ob = self.onbellek.borrow_mut();
  // ... ob açıkken:
  let sonuc = self.hesapla(n - 1) + self.hesapla(n - 2); // içeride borrow() → PANİK
  ```

  Kod **derlenir** ama ilk özyinelemeli çağrıda panik atar. `entry(n).or_insert_with(|| self.hesapla(..))`
  da aynı sebeple patlar: `entry` için alınan `borrow_mut`, closure çalışırken hâlâ açıktır. Kural:
  **bir `RefCell` koruyucusunu tutarken, aynı `RefCell`'e dokunabilecek bir kodu çağırma.**

  `if let Some(&deger) = self.onbellek.borrow().get(&n)` satırında geçici `Ref`, `if let` gövdesi
  bitene kadar yaşar. Gövde yalnızca `return` ettiği için sorun yok. `&deger` deseni `&u64`'ü açıp `u64`
  kopyalar (Modül 9'un boss görevindeki `Some(&fiyat)` gibi).

  Önbelleksiz özyinelemeli Fibonacci `F(90)` için yaklaşık 10^18 çağrı yapardı; önbellekle 89 hesaplama
  yeterli. Bu tekniğe **memoization** denir. `&self` sayesinde `Fibonacci`'yi paylaşılan bir `Rc` içinde
  de kullanabilirsin; dışarıdan bakan için `hesapla` saf bir sorgudur.
````

## Özet

:::remember
- **İç değişkenlik**: `&self` / `&T` üzerinden güvenli değişiklik. Kurallar kalkmaz; denetim çalışma zamanına taşınır.
- `Cell<T>`: `get` (kopya, `T: Copy`), `set`, `replace`, `take`. Asla referans vermez → denetim yok, panik yok.
- `RefCell<T>`: `borrow()` → `Ref<T>`, `borrow_mut()` → `RefMut<T>`. Ya bir yazıcı ya çok okuyucu; ihlal = **panik** (`RefCell already borrowed` / `already mutably borrowed`). `try_borrow_mut` → `Result`.
- `Ref`/`RefMut` birer koruyucudur: ödüncü kısa tut, koruyucu açıkken aynı `RefCell`'e dokunan kodu çağırma.
- `Rc<RefCell<T>>` = birden çok sahip + değişiklik. Sıra önemli: paylaşılan **hücre**.
- Hepsi tek thread içindir. Thread'ler arası karşılıkları: `Arc`, `Mutex`, `RwLock` (Modül 18).
:::

```reflect
prompt: Kendi cümlelerinle açıkla, `RefCell<T>` ödünç alma kurallarını "kaldırıyor" mu? Derleme zamanı denetimi yerine çalışma zamanı denetimine geçmenin kazancı ve bedeli nedir?
answer: |
  Model cevap: Hayır. Kurallar aynıdır: ya tek bir yazıcı ya da istediğin kadar okuyucu. `RefCell` yalnızca
  denetimin **zamanını** değiştirir; her `borrow`/`borrow_mut` çağrısında içerideki sayaca bakar. Kazanç,
  derleyicinin statik olarak kanıtlayamadığı ama doğru olan desenleri (paylaşılan nesneyi değiştirmek,
  `&self` arkasında önbellek, mock nesneler) yazabilmektir. Bedeli ise hatanın derleme yerine çalışma
  anında, yalnızca o kod yolu çalıştığında panik olarak ortaya çıkması ve her ödünçte küçük bir sayaç
  maliyetidir.
```

```flashcards
- front: "İç değişkenlik (interior mutability) nedir?"
  back: "Bir değeri paylaşılan referans (`&self`/`&T`) üzerinden güvenle değiştirebilme deseni. Kurallar, tipin kendisi tarafından çalışma zamanında sağlanır."
- front: "`Cell<T>` neden hiçbir zaman panik atmaz?"
  back: "İçteki değere asla referans vermez; yalnızca kopyalar (`get`) ya da değiştirir (`set`/`replace`). Çakışacak bir ödünç olamaz."
- front: "`RefCell::borrow` ve `borrow_mut` ne döndürür?"
  back: "`Ref<T>` (paylaşılan okuma koruyucusu) ve `RefMut<T>` (özel yazma koruyucusu). Drop edildiklerinde ödünç biter."
- front: "Bir `Ref` yaşarken aynı `RefCell`'de `borrow_mut()` çağrılırsa ne olur?"
  back: "Kod derlenir, çalışma zamanında `RefCell already borrowed` paniği atar."
- front: "Panik yerine hata almak için hangi `RefCell` metotları kullanılır?"
  back: "`try_borrow()` ve `try_borrow_mut()`: `Result<Ref<T>, BorrowError>` / `Result<RefMut<T>, BorrowMutError>` döndürür."
- front: "`Rc<RefCell<T>>` neyi sağlar?"
  back: "`Rc`: birden çok sahip. `RefCell`: o paylaşılan veriyi `&` üzerinden değiştirebilme. Birlikte: paylaşılan, değiştirilebilir durum (tek thread)."
- front: "Testlerde mock nesnelerde neden `RefCell` kullanılır?"
  back: "Trait metodu `&self` alır; mock, gelen çağrıları kaydetmek için iç durumunu değiştirmelidir. `RefCell<Vec<..>>` bunu trait'i değiştirmeden sağlar."
- front: "`Cell`/`RefCell`'in çok thread'li karşılıkları nelerdir?"
  back: "`Mutex<T>` / `RwLock<T>` (ve atomikler); paylaşım için `Rc` yerine `Arc` (Modül 18)."
```
