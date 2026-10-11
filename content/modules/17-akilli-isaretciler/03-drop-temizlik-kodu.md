---
id: m17-l03
title: "Drop: temizlik kodu"
minutes: 20
type: lesson
objectives:
  - "Kendi tipin için `Drop` uygulayıp bir değer kapsamdan çıktığında çalışacak temizlik kodunu yazabilmek"
  - "Yerel değişkenlerin, struct alanlarının, `Vec` elemanlarının ve `let _`'in hangi sırayla drop edildiğini önceden söyleyebilmek"
  - "`E0040`'ı okuyup bir değeri `std::mem::drop` ile erken bırakabilmek"
  - "RAII koruyucu (guard) desenini kullanarak \"ne olursa olsun temizlenen\" kaynaklar tasarlayabilmek"
keywords: [Drop, drop, "std::mem::drop", E0040, E0184, RAII, guard, drop sırası, kapsam, yıkıcı, destructor]
---

Modül 4'ten beri "değer kapsamdan çıkınca Rust onu **drop** eder" diyoruz. `String`'in heap belleği
serbest kalır, `Vec`'in elemanları temizlenir. Ama bu temizliği **kim** yapıyor ve sen kendi tiplerinde aynı
şeyi yapabilir misin? Cevap: `Drop` trait'i. Bir dosyayı kapatmak, bir ağ bağlantısını sonlandırmak,
bir kilidi bırakmak, yarım kalan bir işlemi geri almak... Hepsini "ben unutsam bile kesin çalışacak"
şekilde yazmanın yolu bu.

## Kapsam bitince ne olur?

`Drop` trait'inin tek metodu var: `fn drop(&mut self)`. Bir değer yok olmadan hemen önce Rust bu metodu
**kendiliğinden** çağırır. Önce bir ev düşün, ışıkları kapsam bitince sönen:

```predict
code: |
  struct Isik {
      ad: &'static str,
  }

  impl Drop for Isik {
      fn drop(&mut self) {
          println!("{} söndü", self.ad);
      }
  }

  fn main() {
      let _a = Isik { ad: "mutfak" };
      let _b = Isik { ad: "salon" };
      println!("ev hazır");
  }
options:
  - |
    ev hazır
    salon söndü
    mutfak söndü
  - |
    ev hazır
    mutfak söndü
    salon söndü
  - |
    mutfak söndü
    salon söndü
    ev hazır
  - ev hazır
answer: 0
explanation: |
  `drop` metotları `main`'in sonunda, `}` satırında çalışır; yani "ev hazır"dan **sonra**. Sıra ise
  tanımlanma sırasının **tersidir**: önce en son oluşturulan `_b` (salon), sonra `_a` (mutfak). Ters sıranın
  sebebi: sonra oluşturulan bir değer, öncekine bağımlı olabilir (örneğin ondan ödünç alıyor olabilir).
  Önce bağımlı olanı yıkmak her zaman güvenlidir.
```

Kendi tipine `Drop` uygulamak bu kadar: `drop` gövdesine "son sözlerini" yazarsın. Bu metodun diğer
dillerdeki adı **yıkıcıdır (destructor)**.

:::info Diğer dillerle karşılaştırma
- **C++**: `~Dosya()` yıkıcıları aynı fikir. Bu deseni (RAII, *Resource Acquisition Is Initialization*)
  C++ icat etti, Rust ödünç aldı.
- **Java/C#**: `finalize`/finalizer'lar GC'nin **ne zaman** çalışacağına bağlıdır, belki hiç çalışmaz.
  Bu yüzden kaynaklar için `try-with-resources` / `using` blokları yazmak zorundasın.
- **Python**: `with open(...) as f:` bloğu. Bloğu unutursan dosya açık kalabilir.

Rust'ta `drop`'un ne zaman çalışacağı **kesin ve öngörülebilirdir**: sahibi kapsamdan çıktığı an.
Ayrıca bir blok yazmayı hatırlamana gerek yoktur, çünkü her değer bir kapsamda yaşar.
:::

:::analogy Otel odasından ayrılmak
Otelden çıkış yaptığında (kapsam bitti) resepsiyon odayı kendiliğinden temizletir, anahtar kartını iptal
eder, minibarı kontrol eder. Bunları sen hatırlamak zorunda değilsin; otelin **çıkış prosedürü** her
misafir için otomatik işler. `Drop`, tipin çıkış prosedürüdür. Kapıdan nasıl çıkarsan çık (normal dönüş,
erken `return`, `?` ile hata, hatta panik) prosedür çalışır.
:::

## Drop sırası kuralları

Tek bir kural ("tersten") her durumu açıklamaz. Kendini zorlamak için önce şunu tahmin et:

```predict
code: |
  struct Isik {
      ad: &'static str,
  }

  impl Drop for Isik {
      fn drop(&mut self) {
          println!("{} söndü", self.ad);
      }
  }

  fn main() {
      let _kalici = Isik { ad: "A" };
      let _ = Isik { ad: "B" };
      let mut c = Isik { ad: "C" };
      println!("c = {}", c.ad);
      c = Isik { ad: "D" };
      println!("son: {}", c.ad);
  }
options:
  - |
    B söndü
    c = C
    C söndü
    son: D
    D söndü
    A söndü
  - |
    c = C
    son: D
    D söndü
    C söndü
    B söndü
    A söndü
  - |
    B söndü
    c = C
    son: D
    D söndü
    C söndü
    A söndü
  - |
    c = C
    C söndü
    son: D
    D söndü
    B söndü
    A söndü
answer: 0
explanation: |
  İki sürpriz var:

  1. `let _ = ...` değeri **hiçbir değişkene bağlamaz**. `_` bir isim değil, "yok say" desenidir. Değerin
     sahibi olmadığı için satır biter bitmez drop edilir: "B söndü" en başta çıkar. (`let _b = ...` yazsaydık
     `_b` gerçek bir değişken olurdu ve kapsam sonuna kadar yaşardı.)
  2. `c = Isik { ad: "D" };` **yeniden atama**, eski değeri (C) atama anında drop eder; çünkü artık sahibi
     yoktur. Kapsam sonunda ise ters sırayla `c` (artık D) ve `_kalici` (A) gider.
```

Kuralları toplayalım:

| Durum | Ne zaman / hangi sırayla drop edilir? |
|---|---|
| Yerel değişkenler | Kapsam sonunda, tanımlanma sırasının **tersiyle** |
| `let _ = deger;` | Hemen, aynı satırda (değer bağlanmaz) |
| Yeniden atama `x = yeni;` | Eski değer, atama anında |
| Gölgeleme `let x = ...; let x = ...;` | İlk `x` drop **edilmez**, kapsam sonuna kadar yaşar (yalnızca adı gizlenir) |
| Taşınan değer | Eski kapsamda değil, **yeni sahibinin** kapsamı bitince |
| Struct alanları | Önce struct'ın kendi `drop`'u (varsa), sonra alanlar **tanımlanma sırasıyla** |
| `Vec`, dizi, tuple elemanları | Baştan sona doğru, sırayla |

````quiz
question: |
  ```rust
  struct Ev {
      salon: Isik,
      mutfak: Isik,
  }

  impl Drop for Ev {
      fn drop(&mut self) {
          println!("ev boşaltılıyor");
      }
  }
  ```
  Bir `Ev` değeri kapsamdan çıktığında (yukarıdaki `Isik` tipiyle) hangi sırayla ne yazdırılır?
options:
  - "salon söndü → mutfak söndü → ev boşaltılıyor"
  - "ev boşaltılıyor → salon söndü → mutfak söndü"
  - "ev boşaltılıyor → mutfak söndü → salon söndü"
  - "mutfak söndü → salon söndü → ev boşaltılıyor"
answer: 1
explanation: |
  Önce dış değerin kendi `drop`'u çalışır. Bu sırada alanlar hâlâ geçerlidir, yani `drop` içinde
  `self.salon`'u kullanabilirsin. Ardından alanlar **tanımlandıkları sırayla** (yukarıdan aşağı) drop edilir.
  Yerel değişkenlerdeki "ters sıra" kuralı alanlar için geçerli değildir; karıştırılan bir ayrıntıdır.
feedback:
  - "Alanlar dıştaki `drop`'tan önce yok olsaydı, `Ev::drop` geçersiz alanlara erişirdi."
  - "Doğru!"
  - "Ters sıra yerel değişkenler içindir; struct alanları tanımlanma sırasıyla gider."
  - "Hem sıra hem de dış `drop`'un zamanı yanlış."
````

## Erken bırakmak: `std::mem::drop`

Bazen bir değerin kapsam bitmeden **önce** temizlenmesini istersin: bir dosyayı yazdıktan hemen sonra
kapatmak, bir kilidi işin biter bitmez bırakmak (Modül 18) gibi. Akla ilk gelen yolu dene:

```compiles
code: |
  struct Dosya {
      ad: String,
  }

  impl Drop for Dosya {
      fn drop(&mut self) {
          println!("{} kapatıldı", self.ad);
      }
  }

  fn main() {
      let d = Dosya { ad: String::from("rapor.txt") };
      d.drop();
      println!("rapor gönderildi");
  }
answer: false
error: E0040
explanation: |
  `Drop::drop` metodunu elle çağırmak **yasaktır**. Çağırabilseydin, `d` kapsam sonunda yine drop
  edilirdi ve temizlik kodu **iki kez** çalışırdı (dosyayı iki kez kapatmak, belleği iki kez serbest
  bırakmak: *double free*).
```

:::error
```text
error[E0040]: explicit use of destructor method
  --> src/main.rs:13:7
   |
13 |     d.drop();
   |       ^^^^ explicit destructor calls not allowed
   |
help: consider using `drop` function
   |
13 -     d.drop();
13 +     drop(d);
   |
```
"Yıkıcı metodun açıkça kullanımı" yasak; derleyici doğru aracı öneriyor: `drop(d)` **fonksiyonu**.
:::

`std::mem::drop` prelude'da olduğu için doğrudan `drop(d)` yazarsın. Standart kütüphanedeki tanımı
şaşırtıcı derecede kısa:

```text
pub fn drop<T>(_x: T) {}
```

**Boş bir fonksiyon!** Sihir sahiplikte: `drop(d)` çağrısı `d`'yi parametreye **taşır** (Modül 4), fonksiyon
hemen biter, parametre kapsamdan çıkar ve `Drop::drop` kendiliğinden çalışır. `d` artık taşındığı için
`main`'in sonunda ikinci bir temizlik olmaz. Çift drop'u engelleyen şey yine sahiplik sistemi.

```rust
struct Dosya {
    ad: String,
}

impl Drop for Dosya {
    fn drop(&mut self) {
        println!("{} kapatıldı", self.ad);
    }
}

fn main() {
    let d = Dosya { ad: String::from("rapor.txt") };
    println!("{} yazılıyor...", d.ad);
    drop(d); // dosya tam burada kapanır
    println!("rapor gönderildi");
} // d zaten taşındığı için burada bir şey olmaz
```

```compiles
code: |
  struct Dosya {
      ad: String,
  }

  impl Drop for Dosya {
      fn drop(&mut self) {
          println!("{} kapatıldı", self.ad);
      }
  }

  fn main() {
      let d = Dosya { ad: String::from("rapor.txt") };
      drop(d);
      println!("{} gönderildi", d.ad);
  }
answer: false
error: E0382
explanation: |
  `drop(d)` sıradan bir fonksiyon çağrısı olduğu için `d`'yi **taşır**. Sonraki satırda `d.ad`'ı okumak,
  Modül 4'teki *taşınmış değeri kullanma* hatasıdır (E0382). İyi haber: derleyici, drop edilmiş (kapatılmış)
  bir dosyayı kullanmanı imkânsız kılıyor. C'deki *use-after-free*'nin Rust'taki karşılığı bir derleme hatası.
```

## RAII koruyucu (guard) deseni

`Drop`'un asıl gücü **koruyucu (guard)** nesnelerde ortaya çıkar: bir kaynağı alan ve kapsam bitince onu
**ne olursa olsun** geri veren küçük struct'lar. Bir zamanlayıcıyla başlayalım. Kendi bilgisayarında
çalıştırınca süreler her seferinde biraz farklı çıkar:

```rust,norun
use std::time::Instant;

struct Zamanlayici {
    etiket: &'static str,
    baslangic: Instant,
}

impl Zamanlayici {
    fn baslat(etiket: &'static str) -> Self {
        Zamanlayici { etiket, baslangic: Instant::now() }
    }
}

impl Drop for Zamanlayici {
    fn drop(&mut self) {
        println!("⏱ {} {:?} sürdü", self.etiket, self.baslangic.elapsed());
    }
}

fn agir_hesap() -> u64 {
    let _z = Zamanlayici::baslat("agir_hesap"); // fonksiyondan nasıl çıkılırsa çıkılsın süre yazılır
    (1..=1_000_000u64).sum()
}

fn main() {
    let sonuc = agir_hesap();
    println!("sonuç: {sonuc}");
}
```

`_z` adına dikkat: alt çizgiyle başlıyor (kullanılmıyor uyarısı çıkmasın diye) ama `_` **değil**. Az önce
gördüğün gibi `let _ = Zamanlayici::baslat(..)` yazsaydın zamanlayıcı aynı satırda drop edilir ve hep
sıfıra yakın bir süre (birkaç nanosaniye) yazardı. Koruyucularda sık yapılan bir hatadır.

Şimdi daha gerçekçi bir koruyucu: bir banka işlemi. İşlem **onaylanmadan** biterse (hata, erken `return`,
panik) bakiye eski hâline dönsün. Modül 12'deki referans tutan struct'ı hatırla:

```rust
struct Islem<'a> {
    bakiye: &'a mut i64,
    yedek: i64,
    onaylandi: bool,
}

impl<'a> Islem<'a> {
    fn basla(bakiye: &'a mut i64) -> Islem<'a> {
        let yedek = *bakiye;
        Islem { bakiye, yedek, onaylandi: false }
    }

    fn cek(&mut self, miktar: i64) {
        *self.bakiye -= miktar;
    }

    fn onayla(mut self) {
        self.onaylandi = true;
    } // self burada drop edilir, ama onaylandığı için geri alma yapılmaz
}

impl Drop for Islem<'_> {
    fn drop(&mut self) {
        if !self.onaylandi {
            *self.bakiye = self.yedek;
            println!("işlem geri alındı");
        }
    }
}

fn odeme_yap(bakiye: &mut i64, tutar: i64) -> Result<(), String> {
    let mut islem = Islem::basla(bakiye);
    islem.cek(tutar);
    if *islem.bakiye < 0 {
        return Err(format!("yetersiz bakiye ({tutar} TL çekilemedi)")); // islem onaysız drop edilir
    }
    islem.onayla();
    Ok(())
}

fn main() {
    let mut bakiye = 1000;
    println!("{:?} → bakiye {bakiye}", odeme_yap(&mut bakiye, 300));
    println!("{:?} → bakiye {bakiye}", odeme_yap(&mut bakiye, 5000));
}
```

`odeme_yap` içinde geri alma kodunu hiçbir dalda **elle çağırmadık**. Yarın biri fonksiyona yeni bir
`return` ya da `?` eklese bile işlem güvende kalır. Veritabanı işlemleri, kilitler (`MutexGuard`,
Modül 18), `RefCell`'in ödünç koruyucuları (bu modülün 5. dersi) hep bu desenle çalışır.

```parsons
prompt: Satırları sıralayarak bir `Kilit` koruyucusu kur. Kilit oluşturulunca "kilitlendi", drop edilince "kilit açıldı" yazsın.
lines: |
  struct Kilit;
  impl Kilit {
      fn al() -> Kilit {
          println!("kilitlendi");
          Kilit
      }
  }
  impl Drop for Kilit {
      fn drop(&mut self) {
          println!("kilit açıldı");
      }
  }
  fn main() {
      let _k = Kilit::al();
      println!("kritik iş yapılıyor");
  }
distractors: |
      let _ = Kilit::al();
      fn drop(self) {
explanation: |
  `drop` metodu `&mut self` alır; `self` alamaz, çünkü değeri tüketmek trait'in imzasına aykırıdır.
  `let _ = Kilit::al();` çeldiricisi tuzaktı: kilit aynı satırda açılır ve "kritik iş" korumasız kalır.
  Doğru program "kilitlendi → kritik iş yapılıyor → kilit açıldı" yazar.
```

## Drop'un sınırları

**1. `Drop` ve `Copy` bir arada olamaz.** `Copy` bir tip bit bit kopyalanır. Her kopya drop edilseydi aynı
kaynak defalarca temizlenirdi:

:::error
```text
error[E0184]: the trait `Copy` cannot be implemented for this type; the type has a destructor
 --> src/main.rs:2:8
  |
1 | #[derive(Clone, Copy)]
  |                 ---- in this derive macro expansion
2 | struct Para(i64);
  |        ^^^^ `Copy` not allowed on types with destructors
  |
note: destructor declared here
 --> src/main.rs:5:5
  |
5 |     fn drop(&mut self) {}
  |     ^^^^^^^^^^^^^^^^^^
```
Modül 11'de `Copy`'nin "ucuz ve sessiz kopya" demek olduğunu görmüştün; temizlik isteyen bir tip bu sözü
veremez.
:::

**2. Panikte de çalışır.** Modül 10'da gördüğün **unwinding** sırasında Rust stack'i çözerken yoldaki bütün
değerleri drop eder. Koruyucular panikte bile temizlik yapar:

```rust,should_panic
struct Temizlikci;

impl Drop for Temizlikci {
    fn drop(&mut self) {
        println!("geçici dosyalar silindi");
    }
}

fn main() {
    let _t = Temizlikci;
    let notlar: Vec<u8> = Vec::new();
    println!("ilk not: {}", notlar[0]); // panik! ama _t yine de drop edilir
}
```

Tek istisna: Modül 16'daki `panic = "abort"` profilinde unwinding olmadığı için `drop`'lar çalışmaz. Bu
profili seçerken bunu bilmelisin.

**3. `drop` çalışması garanti değildir.** `std::mem::forget(x)` bir değeri drop etmeden "unutur" ve bu
**güvenli (safe)** bir fonksiyondur. Bellek sızıntısı Rust'ta bellek güvenliği ihlali sayılmaz; yalnızca
bir kaynak israfıdır. Bu modülün son dersinde, `forget` çağırmadan da kazara sızıntı yaratmanın yolunu
(referans döngüleri) göreceğiz. Sonuç: `drop`'a **temizlik** için güven, **güvenlik garantisi** (örneğin
"bu bellek kesin silinir, yoksa güvenlik açığı olur") için değil.

```quiz
question: Aşağıdakilerden hangisi **doğrudur**?
options:
  - "Bir tipe hem `Drop` hem `Copy` uygulanabilir; yalnızca `Clone` uygulanamaz"
  - "Bir fonksiyondan `?` ile erken çıkıldığında, o ana kadar oluşturulmuş yerel değişkenlerin `drop`'ları çalışır"
  - "`x.drop()` çağrısı, değeri kapsam sonunu beklemeden temizlemenin önerilen yoludur"
  - "`std::mem::forget` `unsafe`'dir, çünkü bellek sızdırır"
answer: 1
explanation: |
  `?` aslında bir erken `return`'dür (Modül 10). Fonksiyondan hangi yoldan çıkılırsa çıkılsın, o kapsamda
  yaşayan değerler drop edilir; RAII'nin bütün değeri buradadır. `Copy` ile `Drop` birbirini dışlar (E0184),
  `x.drop()` yasaktır (E0040, onun yerine `drop(x)`), `forget` ise güvenlidir: sızıntı bellek hatası değildir.
feedback:
  - "Tam tersi: `Copy` ile `Drop` birlikte olamaz (E0184)."
  - "Doğru!"
  - "Elle `x.drop()` çağırmak E0040 verir; doğrusu `drop(x)`."
  - "`forget` güvenli bir fonksiyondur; Rust sızıntıyı bellek güvenliği ihlali saymaz."
```

## Alıştırma: Kütüphane bilgisayarı oturumu

```exercise
id: m17-e-oturum-gunlugu
title: Oturum günlüğü koruyucusu
difficulty: 3
prompt: |
  Bir kütüphanedeki ortak bilgisayarlar, her oturumu bir günlüğe (`Vec<String>`) yazıyor. `Oturum`
  koruyucusunu tamamla:

  - `Oturum::ac(kullanici, gunluk)`: günlüğe `"giriş: <kullanici>"` ekler ve oturumu döndürür.
  - `islem(&mut self, ne)`: günlüğe `"<kullanici>: <ne>"` ekler.
  - `Drop`: oturum hangi yoldan biterse bitsin günlüğe `"çıkış: <kullanici>"` ekler.

  Örnek: `ac("ayse", ..)`, `islem("kitap aradı")`, oturum biter →
  `["giriş: ayse", "ayse: kitap aradı", "çıkış: ayse"]`.
starter: |
  struct Oturum<'a> {
      kullanici: String,
      gunluk: &'a mut Vec<String>,
  }

  impl<'a> Oturum<'a> {
      fn ac(kullanici: &str, gunluk: &'a mut Vec<String>) -> Oturum<'a> {
          todo!()
      }

      fn islem(&mut self, ne: &str) {
          todo!()
      }
  }

  impl Drop for Oturum<'_> {
      fn drop(&mut self) {
          todo!()
      }
  }

  fn main() {
      let mut gunluk = Vec::new();
      {
          let mut o = Oturum::ac("ayse", &mut gunluk);
          o.islem("kitap aradı");
      }
      println!("{gunluk:#?}");
  }
solution: |
  struct Oturum<'a> {
      kullanici: String,
      gunluk: &'a mut Vec<String>,
  }

  impl<'a> Oturum<'a> {
      fn ac(kullanici: &str, gunluk: &'a mut Vec<String>) -> Oturum<'a> {
          gunluk.push(format!("giriş: {kullanici}"));
          Oturum { kullanici: kullanici.to_string(), gunluk }
      }

      fn islem(&mut self, ne: &str) {
          let satir = format!("{}: {ne}", self.kullanici);
          self.gunluk.push(satir);
      }
  }

  impl Drop for Oturum<'_> {
      fn drop(&mut self) {
          let satir = format!("çıkış: {}", self.kullanici);
          self.gunluk.push(satir);
      }
  }

  fn main() {
      let mut gunluk = Vec::new();
      {
          let mut o = Oturum::ac("ayse", &mut gunluk);
          o.islem("kitap aradı");
      }
      println!("{gunluk:#?}");
  }
check: tests
tests: |
  #[test]
  fn tam_bir_oturum() {
      let mut g = Vec::new();
      {
          let mut o = Oturum::ac("ayse", &mut g);
          o.islem("kitap aradı");
          o.islem("e-kitap indirdi");
      }
      assert_eq!(
          g,
          ["giriş: ayse", "ayse: kitap aradı", "ayse: e-kitap indirdi", "çıkış: ayse"],
          "giriş, işlemler ve çıkış sırayla yazılmalı"
      );
  }

  #[test]
  fn drop_ile_erken_bitirme() {
      let mut g = Vec::new();
      let o = Oturum::ac("can", &mut g);
      drop(o);
      g.push(String::from("bilgisayar kapandı"));
      assert_eq!(
          g,
          ["giriş: can", "çıkış: can", "bilgisayar kapandı"],
          "drop(o) çıkışı hemen yazmalı"
      );
  }

  #[test]
  fn ardisik_iki_oturum() {
      let mut g = Vec::new();
      {
          let _o = Oturum::ac("elif", &mut g);
      }
      {
          let mut o = Oturum::ac("mert", &mut g);
          o.islem("yazıcı kullandı");
      }
      assert_eq!(g.len(), 5, "iki giriş + bir işlem + iki çıkış");
      assert_eq!(g[1], "çıkış: elif", "ilk oturum ikincisi başlamadan kapanmalı");
      assert_eq!(g[4], "çıkış: mert");
  }

  #[test]
  fn fonksiyona_tasinan_oturum() {
      fn bitir(mut o: Oturum<'_>) {
          o.islem("son işlem");
      }
      let mut g = Vec::new();
      let o = Oturum::ac("deniz", &mut g);
      bitir(o);
      assert_eq!(g, ["giriş: deniz", "deniz: son işlem", "çıkış: deniz"], "taşınan oturum yeni sahibinin kapsamında kapanmalı");
  }
hints:
  - "`ac` içinde önce `gunluk.push(format!(\"giriş: {kullanici}\"))` yap, sonra `Oturum { kullanici: kullanici.to_string(), gunluk }` döndür."
  - "`islem` ve `drop`'ta `self.gunluk` bir `&mut Vec<String>`; doğrudan `self.gunluk.push(...)` çağırabilirsin. Metni önce bir değişkende hazırlamak okunabilirliği artırır."
  - "`drop` gövdesi: `let satir = format!(\"çıkış: {}\", self.kullanici); self.gunluk.push(satir);`"
explanation: |
  Koruyucunun gücü son iki testte görünüyor: `drop(o)` ile **istediğin an** kapatabiliyorsun, oturumu bir
  fonksiyona **taşıdığında** ise kapanış sorumluluğu da onunla birlikte gidiyor. Çıkış satırı `bitir`
  fonksiyonu bitince yazılıyor. Hiçbir yerde `kapat()` çağırmayı hatırlamak zorunda değilsin.

  `Oturum<'a>` bir `&'a mut Vec<String>` tuttuğu için (Modül 12) oturum yaşadığı sürece `g`'ye başka hiç
  kimse dokunamaz; `g.push(...)` ancak oturum drop edildikten **sonra** derlenir. Böylece iki oturum aynı
  günlüğü aynı anda karıştıramaz. Birden fazla koruyucunun **aynı anda** aynı günlüğe yazmasını istersen
  paylaşılan ve değiştirilebilir bir veriye ihtiyacın olur: `Rc<RefCell<Vec<String>>>`, 5. dersin konusu.

  `Drop` içinde `self.gunluk.push(format!(..., self.kullanici))` yazmak da derlenir. Biz önce metni
  hazırladık; `self`'in iki alanını aynı ifadede ödünç alırken kafa karışıklığını azaltır.
```

## Özet

:::remember
- `impl Drop for T { fn drop(&mut self) { ... } }`: değer yok olmadan hemen önce **otomatik** çalışan temizlik kodu (yıkıcı).
- Yerel değişkenler **ters** sırayla, struct alanları **tanımlanma** sırasıyla (dış `drop`'tan sonra), `Vec` elemanları baştan sona drop edilir.
- `let _ = x;` hemen drop eder; `let _x = x;` kapsam sonuna kadar tutar. Yeniden atama eski değeri hemen drop eder, gölgeleme etmez.
- `x.drop()` yasak (**E0040**). Erken bırakmak için `drop(x)` = `std::mem::drop`, boş bir fonksiyon; işi **taşıma** yapar.
- RAII koruyucu: kaynağı kurucuda al, `drop`'ta bırak. `return`, `?` ve panikte bile çalışır.
- `Drop` + `Copy` olmaz (**E0184**). `mem::forget` güvenlidir: sızıntı, bellek güvenliği ihlali değildir.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, `std::mem::drop` boş bir fonksiyon olduğu hâlde değeri nasıl temizliyor ve aynı değerin iki kez temizlenmesini ne engelliyor?
answer: |
  Model cevap: `drop(x)` çağrısı `x`'in sahipliğini fonksiyonun parametresine taşır. Fonksiyon gövdesi
  boştur; bitince parametre kapsamdan çıkar ve Rust her kapsam sonunda yaptığı gibi `Drop::drop`'u
  kendiliğinden çağırır. `x` taşındığı için çağıran fonksiyonun kapsamı bittiğinde onun için tekrar
  temizlik yapılmaz. Taşınmış `x`'i kullanmaya çalışmak da E0382 verir. Yani çift temizliği de, temizlenmiş
  değeri kullanmayı da sahiplik sistemi derleme zamanında engelliyor.
```

```flashcards
- front: "`Drop` trait'inin metodunun imzası nedir?"
  back: "`fn drop(&mut self)`, değer yok olmadan hemen önce otomatik çağrılır."
- front: "Aynı kapsamda `let a = ..; let b = ..;` tanımlıysa hangisi önce drop edilir?"
  back: "`b`. Yerel değişkenler tanımlanma sırasının tersiyle drop edilir."
- front: "`let _ = Kilit::al();` ile `let _k = Kilit::al();` arasındaki fark nedir?"
  back: "`_` değeri bağlamaz, kilit aynı satırda drop edilir. `_k` gerçek bir değişkendir, kapsam sonuna kadar yaşar."
- front: "`E0040: explicit use of destructor method` neden verilir, çözüm nedir?"
  back: "`x.drop()` elle çağrılamaz (çift temizlik riski). Çözüm: `drop(x)`, yani `std::mem::drop`."
- front: "`std::mem::drop`'un gövdesinde ne vardır?"
  back: "Hiçbir şey: `pub fn drop<T>(_x: T) {}`. Değeri taşıyıp kapsamdan çıkarması yeterlidir."
- front: "Bir struct'ın kendi `drop`'u ile alanlarının drop'u hangi sırayla olur?"
  back: "Önce struct'ın `drop`'u (alanlar hâlâ geçerli), sonra alanlar tanımlanma sırasıyla."
- front: "Bir tip neden hem `Copy` hem `Drop` olamaz (E0184)?"
  back: "`Copy` sessiz bit kopyası demektir; her kopya drop edilseydi aynı kaynak birden çok kez temizlenirdi."
```
