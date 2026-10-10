---
id: m20-boss
title: "Boss: Desen Kanyonu'nun Bekçisi"
minutes: 40
type: boss
objectives:
  - Trait nesnelerini, dispatch türlerini ve dyn uyumluluğunu doğru kullandığını göstermek
  - Durum, typestate, builder, newtype, strateji, RAII ve uzantı trait'i desenlerini yerinde seçip uygulayabilmek
keywords: [boss, trait nesnesi, dyn, vtable, E0038, typestate, builder, newtype, RAII, uzantı trait]
---

Kanyonun girişinde bir bekçi duruyor: “Burayı geçmek için nesneleri **kalıtımsız** düşünebildiğini, `dyn`'ın
bedelini bildiğini ve desenleri ezberden değil, gerekçesiyle seçtiğini göstermelisin.” Bu sınavda yeni bir
şey öğretilmiyor; modülün altı dersini ve önceki modüllerden birkaç konuyu karışık sırayla soruyoruz. Geçmek
için **%80** gerekiyor. Acele etme, her kodu dikkatle oku.

## Bölüm 1: Nesneler ve trait nesneleri

```quiz
question: |
  Java'da `class Kedi extends Hayvan` ile `Hayvan`'ın `sesCikar()` dışındaki bütün kodunu miras alırdın. Rust'ta
  aynı kod paylaşımını sağlamanın **idiomatik** yolu hangisi?
options:
  - "`struct Kedi: Hayvan { .. }` sözdizimiyle struct kalıtımı"
  - "Ortak davranışı bir trait'in **varsayılan metotlarına**, ortak veriyi `Kedi`'nin içine gömülen bir alana (kompozisyon) koymak"
  - "`Deref<Target = Hayvan>` uygulayıp `Kedi`'yi bir `Hayvan` gibi kullanmak"
  - Bütün hayvanları tek bir struct'ta toplayıp `tur: String` alanıyla ayırmak
answer: 1
explanation: |
  Rust'ta kalıtım yoktur. Davranış paylaşımı trait'lerin varsayılan metotlarıyla, veri paylaşımı ise
  kompozisyonla (bir `Can` ya da `Konum` bileşenini alan olarak tutmak) yapılır. Bu, kırılgan taban sınıf
  (fragile base class) sorununu baştan engeller: alt tip, taban sınıfın gizli iç işleyişine bağlanmaz.
feedback:
  - Rust'ta böyle bir sözdizimi yok.
  - Doğru!
  - "`Deref` akıllı işaretçiler içindir; onu kalıtım taklidi için kullanmak bilinen bir anti-desendir."
  - "“Stringly typed” tasarım; derleyici türleri kontrol edemez."
```

```compiles
code: |
  trait Sekil {
      fn alan(&self) -> f64;
  }

  struct Kare(f64);

  impl Sekil for Kare {
      fn alan(&self) -> f64 {
          self.0 * self.0
      }
  }

  fn main() {
      let sekiller: Vec<dyn Sekil> = vec![Kare(2.0)];
      println!("{}", sekiller.len());
  }
answer: false
error: E0277
explanation: |
  `dyn Sekil` **boyutu bilinmeyen** (unsized) bir tiptir: arkasında 8 baytlık bir `Kare` de, 1 KB'lık bir
  başka şekil de olabilir. `Vec<T>` elemanlarını yan yana dizdiği için `T: Sized` ister. Trait nesneleri her zaman
  bir işaretçinin arkasında yaşar: `Vec<Box<dyn Sekil>>` ya da `Vec<&dyn Sekil>`.
```

```predict
code: |
  use std::mem::size_of;

  trait Ciz {
      fn ciz(&self);
  }

  fn main() {
      println!(
          "{} {} {} {}",
          size_of::<&u64>(),
          size_of::<&dyn Ciz>(),
          size_of::<Box<dyn Ciz>>(),
          size_of::<Box<u64>>()
      );
  }
options:
  - "8 8 8 8"
  - "8 16 16 8"
  - "8 16 8 8"
  - "8 24 24 16"
answer: 1
explanation: |
  Sıradan bir referans ya da `Box` tek bir işaretçidir (64 bit sistemde 8 bayt). Trait nesnesine işaret eden her
  şey ise **geniş işaretçidir** (fat pointer): veri işaretçisi + vtable işaretçisi = 16 bayt. Bu `&dyn` için de
  `Box<dyn>` için de geçerlidir; vtable'ın kendisi değerde değil, programın salt okunur verisinde durur.
```

```quiz
question: |
  Bir çizim uygulamasında kullanıcı aynı tuvale daire, dikdörtgen ve eklentilerden gelen **bilinmeyen** şekiller
  ekleyebiliyor. Tuval bütün şekilleri tek bir listede tutmalı. Hangi tip uygun?
options:
  - "`struct Tuval<T: Ciz> { sekiller: Vec<T> }`"
  - "`struct Tuval { sekiller: Vec<Box<dyn Ciz>> }`"
  - "`struct Tuval { sekiller: Vec<impl Ciz> }`"
answer: 1
explanation: |
  Generic `T` tek bir somut tipe sabitlenir: `Tuval<Daire>` yalnızca daire tutar. Karışık **ve açık** bir tip
  kümesi (eklentiler!) için trait nesnesi gerekir. `impl Trait` struct alanlarında kullanılamaz; kullanılabilseydi
  bile tek bir gizli somut tip anlamına gelirdi.
feedback:
  - Homojen bir koleksiyon; daire ile dikdörtgeni aynı `Vec<T>`'de tutamazsın.
  - Doğru!
  - "`impl Trait` struct alanı tipi olarak yazılamaz ve “tek gizli tip” demektir, “herhangi bir tip” değil."
```

## Bölüm 2: Dispatch ve dyn uyumluluğu

```compiles
code: |
  trait Depo {
      fn kaydet<T: std::fmt::Debug>(&mut self, deger: T);
  }

  struct Bellek(Vec<String>);

  impl Depo for Bellek {
      fn kaydet<T: std::fmt::Debug>(&mut self, deger: T) {
          self.0.push(format!("{deger:?}"));
      }
  }

  fn main() {
      let mut d: Box<dyn Depo> = Box::new(Bellek(Vec::new()));
      d.kaydet(42);
  }
answer: false
error: E0038
explanation: |
  Generic bir metot vtable'a konamaz: `kaydet::<i32>`, `kaydet::<String>`... sonsuz sayıda kopya olabilir ve
  hangilerinin gerekeceği derleme zamanında bilinmez. Bu yüzden `Depo` **dyn uyumlu değildir** (E0038).
  Çözüm yolları: parametreyi `&dyn Debug` yapmak, metoda `where Self: Sized` ekleyip dyn'dan çağırmamak ya da
  `dyn` yerine generic kullanmak.
```

```quiz
question: |
  `trait Sekil { fn alan(&self) -> f64; fn kopya(&self) -> Self; }` trait'ini `Box<dyn Sekil>` olarak
  kullanmak istiyorsun ama `kopya` yüzünden E0038 alıyorsun. `kopya`'yı korurken trait'i dyn uyumlu yapmanın
  yolu nedir?
options:
  - "`kopya`'ya `where Self: Sized` eklemek; o zaman `kopya` vtable'a girmez, yalnızca somut tiplerde çağrılabilir"
  - "`kopya`'nın dönüş tipini `dyn Sekil` yapmak"
  - "Trait'e `#[derive(Clone)]` eklemek"
  - Mümkün değil; `kopya` silinmeli
answer: 0
explanation: |
  `where Self: Sized` metodu trait nesnesinden “gizler”: vtable onsuz kurulur, trait yine dyn uyumlu olur, metot
  da `Kare` gibi somut tiplerde çalışmaya devam eder. Trait nesnesi üzerinden kopyalamak gerekiyorsa
  `fn kutu_kopyala(&self) -> Box<dyn Sekil>` (clone_box) deseni kullanılır.
feedback:
  - Doğru!
  - "`dyn Sekil` boyutsuzdur; bir fonksiyon onu değer olarak döndüremez. Olsa olsa `Box<dyn Sekil>` döndürülür."
  - "`derive` trait'lere değil tiplere uygulanır."
  - "`where Self: Sized` kaçış kapısı tam bu durum için var."
```

Önceki modüllerden: `Drop` sırasını hatırlıyor musun? (Modül 17)

```predict
code: |
  trait Ses {
      fn ad(&self) -> String;
  }

  struct Kedi;
  struct Kopek;

  impl Ses for Kedi {
      fn ad(&self) -> String {
          String::from("kedi")
      }
  }

  impl Ses for Kopek {
      fn ad(&self) -> String {
          String::from("köpek")
      }
  }

  impl Drop for Kedi {
      fn drop(&mut self) {
          println!("kedi gitti");
      }
  }

  impl Drop for Kopek {
      fn drop(&mut self) {
          println!("köpek gitti");
      }
  }

  fn main() {
      let ilk = Kopek;
      let hayvanlar: Vec<Box<dyn Ses>> = vec![Box::new(Kedi), Box::new(Kopek)];
      for h in &hayvanlar {
          println!("{}", h.ad());
      }
      println!("{}", ilk.ad());
      println!("son");
  }
options:
  - |
    kedi
    köpek
    köpek
    son
    kedi gitti
    köpek gitti
    köpek gitti
  - |
    kedi
    köpek
    köpek
    son
    köpek gitti
    köpek gitti
    kedi gitti
  - |
    kedi
    köpek
    köpek
    son
    köpek gitti
    kedi gitti
    köpek gitti
answer: 0
explanation: |
  Yerel değişkenler **ters tanım sırasıyla** drop edilir: önce `hayvanlar`, sonra `ilk`. Bir `Vec` ise
  elemanlarını **baştan sona** drop eder: önce kedi, sonra köpek. `Box<dyn Ses>` drop edilirken doğru `drop`
  fonksiyonu da vtable'dan bulunur; vtable'da yalnızca metotlar değil, tipin drop fonksiyonu, boyutu ve
  hizalaması da vardır. En son `ilk` (köpek) gider.
```

## Bölüm 3: Desenler

```compiles
code: |
  struct KapaliSiparis {
      urunler: Vec<String>,
  }

  struct AcikSiparis {
      urunler: Vec<String>,
  }

  impl AcikSiparis {
      fn new() -> AcikSiparis {
          AcikSiparis { urunler: Vec::new() }
      }
      fn ekle(&mut self, urun: &str) {
          self.urunler.push(urun.to_string());
      }
      fn kapat(self) -> KapaliSiparis {
          KapaliSiparis { urunler: self.urunler }
      }
  }

  fn main() {
      let mut s = AcikSiparis::new();
      s.ekle("simit");
      let mut kapali = s.kapat();
      kapali.ekle("ayran");
      println!("{}", kapali.urunler.len());
  }
answer: false
error: E0599
explanation: |
  Typestate: `KapaliSiparis`'in `ekle` metodu **yok**, kapanmış bir siparişe ürün eklemek derleme hatasıdır.
  Kural bir `if kapali { .. }` kontrolüyle değil, tiplerin kendisiyle uygulanıyor. Ayrıca `s.kapat()` `s`'yi
  tükettiği için eski değişkenle de ekleme yapılamaz (E0382).
```

```fill
prompt: |
  Durum deseninde `&mut self` arkasındaki kutulu durumu tüketen bir geçiş metodu yaz. Boşlukları doldur.
code: |
  trait Durum {
      fn ilerle(self: Box<Self>) -> Box<dyn Durum>;
      fn ad(&self) -> &'static str;
  }

  struct Hazirlaniyor;
  struct Kargoda;

  impl Durum for Hazirlaniyor {
      fn ilerle(self: Box<Self>) -> Box<dyn Durum> {
          Box::new(Kargoda)
      }
      fn ad(&self) -> &'static str {
          "hazırlanıyor"
      }
  }

  impl Durum for Kargoda {
      fn ilerle(self: Box<Self>) -> Box<dyn Durum> {
          self
      }
      fn ad(&self) -> &'static str {
          "kargoda"
      }
  }

  struct Siparis {
      durum: ___0<Box<dyn Durum>>,
  }

  impl Siparis {
      fn ilerle(&mut self) {
          if let Some(d) = self.durum.___1() {
              self.durum = Some(d.ilerle());
          }
      }
  }

  fn main() {
      let mut s = Siparis { durum: Some(Box::new(Hazirlaniyor)) };
      s.ilerle();
      s.ilerle();
      println!("{}", s.durum.as_ref().map_or("?", |d| d.ad()));
  }
blanks:
  - ["Option"]
  - ["take"]
output: kargoda
explanation: |
  `self.durum.ilerle()` doğrudan yazılamaz: kutuyu tüketmek sahiplik ister, oysa elimizde yalnızca `&mut self`
  var (E0507). `Option::take()` kutuyu dışarı alıp yerine `None` bırakır; alan hiçbir an geçersiz kalmaz, yeni
  durum hemen geri yerleştirilir.
```

```quiz
question: |
  `fn ayar(&mut self, ..) -> &mut Self` biçiminde ayar metotları olan bir builder için şu satır neden derlenmez?
  `let k = Kurucu::new().ayar(1);` (sonraki satırda `k.kur()` çağrılıyor)
options:
  - "`Kurucu::new()` geçici bir değerdir; ifade bitince drop edilir ama `k` ona referans olarak kalır (E0716)"
  - "`ayar` zincirlenemez; her çağrı ayrı bir satırda olmalı (E0499)"
  - "`k` `mut` tanımlanmadığı için (E0596)"
  - Derlenir; hiçbir sorun yok
answer: 0
explanation: |
  Tüketmeyen builder'ın klasik tuzağı. `ayar` geçici kurucuya bir `&mut` döndürür; geçici değer `;`'de ölür.
  Çözüm: önce `let mut k = Kurucu::new();`, sonra `k.ayar(1);`. Ya da hepsini tek ifadede zincirlemek:
  `Kurucu::new().ayar(1).kur()`. Tüketen builder'da (`mut self -> Self`) bu sorun yoktur, çünkü değer taşınır.
feedback:
  - Doğru!
  - "Tek ifadede zincirleme serbest; sorun geçicinin ömrü."
  - "`k`'nin kendisi bir `&mut Kurucu`; `k`'yi yeniden atamadıkça `mut` olması gerekmez."
  - "Geçici değerin ömrünü düşün: `;`'den sonra kimin elinde kalıyor?"
```

```predict
code: |
  struct Koruyucu(&'static str);

  impl Drop for Koruyucu {
      fn drop(&mut self) {
          println!("bırak {}", self.0);
      }
  }

  fn kilitle(ad: &'static str) -> Koruyucu {
      println!("al {ad}");
      Koruyucu(ad)
  }

  fn main() {
      let _ = kilitle("A");
      let _b = kilitle("B");
      println!("iş");
  }
options:
  - |
    al A
    bırak A
    al B
    iş
    bırak B
  - |
    al A
    al B
    iş
    bırak B
    bırak A
  - |
    al A
    al B
    iş
    bırak A
    bırak B
answer: 0
explanation: |
  `let _ =` değeri hiçbir değişkene bağlamaz; geçici koruyucu satır biter bitmez drop edilir, “A” korunan iş
  başlamadan bırakılır. `_b` ise gerçek bir değişkendir ve `main`'in sonuna kadar yaşar. Gerçek kodda
  `let _ = mutex.lock()` hatası tam olarak budur.
```

Önceki modüllerden: orphan kuralı (Modül 11).

```compiles
code: |
  trait Ozetle {
      fn ozet(&self) -> String;
  }

  impl Ozetle for Vec<u32> {
      fn ozet(&self) -> String {
          format!("{} eleman, toplam {}", self.len(), self.iter().sum::<u32>())
      }
  }

  fn main() {
      let notlar = vec![70, 80, 90];
      println!("{}", notlar.ozet());
  }
answer: true
explanation: |
  Derlenir: bu bir **uzantı trait'i**. `Vec<u32>` yabancı bir tip, ama `Ozetle` trait'i bizim crate'imizde
  tanımlı; orphan kuralı “trait **ya da** tip yerel olmalı” der. Yasak olan, yabancı bir trait'i (ör. `Display`)
  yabancı bir tipe uygulamaktır (E0117). O durumda newtype sarmalayıcı gerekir.
```

```parsons
prompt: |
  Bir newtype için doğrulayan kurucuyu sıraya koy: `Yuzde` yalnızca 0-100 arasındaki değerlerle oluşturulabilsin.
lines: |
  pub struct Yuzde(u8);
  impl Yuzde {
      pub fn new(deger: u8) -> Result<Yuzde, String> {
          if deger > 100 {
              return Err(format!("{deger} geçerli bir yüzde değil"));
          }
          Ok(Yuzde(deger))
      }
  }
distractors: |
  pub struct Yuzde(pub u8);
          Yuzde(deger)
explanation: |
  Alan **gizli** (`pub` değil) olmalı; yoksa modül dışından `Yuzde(250)` yazılıp kurucu atlanabilir ve değişmez
  çöker. Doğrulama `new`'da bir kez yapılır, başarısızsa `Err`, başarılıysa `Ok(Yuzde(deger))` döner.
  (Modül 10: `Result` ile kurtarılabilir hata; Modül 8: gizlilik.)
```

```quiz
question: |
  Bir oyun motorunda saniyede 60 kez çalışan döngüde düşman yapay zekâsının **hareket stratejisi** seçiliyor.
  Stratejiler motorla birlikte gelen 3 sabit algoritma (kovala, kaç, devriye) ve seçim her düşman için oyun
  başında bir kez yapılıp sonra değişmiyor. Performans kritik. En uygun tasarım?
options:
  - "`Box<dyn HareketStratejisi>` alanı; her karede dinamik dispatch"
  - "`enum Hareket { Kovala, Kac, Devriye }` ve `match` (ya da strateji tipine göre generic `Dusman<S>`)"
  - "`Vec<Box<dyn Fn()>>` callback listesi"
  - "`Any` ile her karede somut tipi sorgulamak"
answer: 1
explanation: |
  Küme **kapalı** (3 sabit algoritma) ve sıcak döngüde performans kritik. Enum + `match` heap tahsisi ve vtable
  gerektirmez, `match` satır içine alınabilir, ayrıca düşmanlar bellekte yan yana durabilir. Seçim derleme
  zamanında bilinseydi generic `Dusman<S: Hareket>` de sıfır maliyetli olurdu. `dyn` açık kümeler (eklentiler)
  için daha uygun; çalışırdı ama gereksiz bedel öder.
feedback:
  - Çalışır, ama kapalı bir küme için gereksiz heap ve dolaylı çağrı bedeli.
  - Doğru!
  - Strateji tek bir işlem bile olsa sabit bir küme için enum daha basit ve hızlı.
  - "`Any` son çaredir ve burada hiçbir şey kazandırmaz."
```

## Bölüm 4: Kodlama

```exercise
id: m20-boss-e-ev
title: Akıllı ev enerji raporu
difficulty: 3
prompt: |
  Akıllı bir evde farklı cihazlar `Cihaz` trait'ini uyguluyor. `Lamba` ve `Klima` hazır; sen:

  1. `Buzdolabi` için `Cihaz`'ı uygula: adı `"buzdolabı"`, her zaman açıktır, gücü `150` W.
  2. `toplam_guc(cihazlar)`: yalnızca **açık** cihazların güçlerinin toplamını döndürür.
  3. `en_cok_tuketen(cihazlar)`: açık cihazlar arasında gücü en yüksek olanın **adını** döndürür; eşitlikte
     listede önce geleni seçer; açık cihaz yoksa `None`.
starter: |
  pub trait Cihaz {
      fn ad(&self) -> String;
      fn guc_watt(&self) -> u32;
      fn acik_mi(&self) -> bool;
  }

  pub struct Lamba {
      pub oda: String,
      pub acik: bool,
  }

  pub struct Klima {
      pub derece: i32,
      pub acik: bool,
  }

  pub struct Buzdolabi;

  impl Cihaz for Lamba {
      fn ad(&self) -> String {
          format!("{} lambası", self.oda)
      }
      fn guc_watt(&self) -> u32 {
          10
      }
      fn acik_mi(&self) -> bool {
          self.acik
      }
  }

  impl Cihaz for Klima {
      fn ad(&self) -> String {
          format!("klima ({}°C)", self.derece)
      }
      fn guc_watt(&self) -> u32 {
          if self.derece < 20 { 1500 } else { 900 }
      }
      fn acik_mi(&self) -> bool {
          self.acik
      }
  }

  impl Cihaz for Buzdolabi {
      fn ad(&self) -> String {
          todo!()
      }
      fn guc_watt(&self) -> u32 {
          todo!()
      }
      fn acik_mi(&self) -> bool {
          todo!()
      }
  }

  pub fn toplam_guc(cihazlar: &[Box<dyn Cihaz>]) -> u32 {
      todo!()
  }

  pub fn en_cok_tuketen(cihazlar: &[Box<dyn Cihaz>]) -> Option<String> {
      todo!()
  }

  fn main() {
      let ev: Vec<Box<dyn Cihaz>> = vec![
          Box::new(Lamba { oda: String::from("salon"), acik: true }),
          Box::new(Klima { derece: 18, acik: false }),
          Box::new(Buzdolabi),
      ];
      println!("Toplam: {} W", toplam_guc(&ev));
      println!("En çok: {:?}", en_cok_tuketen(&ev));
  }
solution: |
  pub trait Cihaz {
      fn ad(&self) -> String;
      fn guc_watt(&self) -> u32;
      fn acik_mi(&self) -> bool;
  }

  pub struct Lamba {
      pub oda: String,
      pub acik: bool,
  }

  pub struct Klima {
      pub derece: i32,
      pub acik: bool,
  }

  pub struct Buzdolabi;

  impl Cihaz for Lamba {
      fn ad(&self) -> String {
          format!("{} lambası", self.oda)
      }
      fn guc_watt(&self) -> u32 {
          10
      }
      fn acik_mi(&self) -> bool {
          self.acik
      }
  }

  impl Cihaz for Klima {
      fn ad(&self) -> String {
          format!("klima ({}°C)", self.derece)
      }
      fn guc_watt(&self) -> u32 {
          if self.derece < 20 { 1500 } else { 900 }
      }
      fn acik_mi(&self) -> bool {
          self.acik
      }
  }

  impl Cihaz for Buzdolabi {
      fn ad(&self) -> String {
          String::from("buzdolabı")
      }
      fn guc_watt(&self) -> u32 {
          150
      }
      fn acik_mi(&self) -> bool {
          true
      }
  }

  pub fn toplam_guc(cihazlar: &[Box<dyn Cihaz>]) -> u32 {
      let mut toplam = 0;
      for c in cihazlar {
          if c.acik_mi() {
              toplam += c.guc_watt();
          }
      }
      toplam
  }

  pub fn en_cok_tuketen(cihazlar: &[Box<dyn Cihaz>]) -> Option<String> {
      let mut en_iyi: Option<&Box<dyn Cihaz>> = None;
      for c in cihazlar {
          if !c.acik_mi() {
              continue;
          }
          let daha_buyuk = match en_iyi {
              None => true,
              Some(e) => c.guc_watt() > e.guc_watt(),
          };
          if daha_buyuk {
              en_iyi = Some(c);
          }
      }
      en_iyi.map(|c| c.ad())
  }

  fn main() {
      let ev: Vec<Box<dyn Cihaz>> = vec![
          Box::new(Lamba { oda: String::from("salon"), acik: true }),
          Box::new(Klima { derece: 18, acik: false }),
          Box::new(Buzdolabi),
      ];
      println!("Toplam: {} W", toplam_guc(&ev));
      println!("En çok: {:?}", en_cok_tuketen(&ev));
  }
check: tests
tests: |
  fn ev() -> Vec<Box<dyn Cihaz>> {
      vec![
          Box::new(Lamba { oda: String::from("salon"), acik: true }),
          Box::new(Klima { derece: 18, acik: true }),
          Box::new(Buzdolabi),
          Box::new(Lamba { oda: String::from("mutfak"), acik: false }),
      ]
  }

  #[test]
  fn buzdolabi_dogru() {
      assert_eq!(Buzdolabi.ad(), "buzdolabı");
      assert_eq!(Buzdolabi.guc_watt(), 150);
      assert!(Buzdolabi.acik_mi(), "Buzdolabı her zaman açık");
  }

  #[test]
  fn yalnizca_acik_cihazlar_sayilir() {
      assert_eq!(toplam_guc(&ev()), 10 + 1500 + 150, "Kapalı mutfak lambası sayılmamalı");
      let kapali: Vec<Box<dyn Cihaz>> = vec![Box::new(Klima { derece: 25, acik: false })];
      assert_eq!(toplam_guc(&kapali), 0);
  }

  #[test]
  fn en_cok_tuketen_bulunur() {
      assert_eq!(en_cok_tuketen(&ev()), Some(String::from("klima (18°C)")));
      let sade: Vec<Box<dyn Cihaz>> = vec![
          Box::new(Klima { derece: 30, acik: false }),
          Box::new(Buzdolabi),
      ];
      assert_eq!(en_cok_tuketen(&sade), Some(String::from("buzdolabı")), "Kapalı klima aday değil");
  }

  #[test]
  fn esitlik_ve_bos_durum() {
      let iki_lamba: Vec<Box<dyn Cihaz>> = vec![
          Box::new(Lamba { oda: String::from("yatak odası"), acik: true }),
          Box::new(Lamba { oda: String::from("banyo"), acik: true }),
      ];
      assert_eq!(en_cok_tuketen(&iki_lamba), Some(String::from("yatak odası lambası")), "Eşitlikte ilk gelen");
      assert_eq!(en_cok_tuketen(&[]), None, "Cihaz yoksa None");
      let hepsi_kapali: Vec<Box<dyn Cihaz>> = vec![Box::new(Lamba { oda: String::from("hol"), acik: false })];
      assert_eq!(en_cok_tuketen(&hepsi_kapali), None, "Açık cihaz yoksa None");
  }
hints:
  - "`Buzdolabi` alansız bir struct; metotları sabit değerler döndürür: `String::from(\"buzdolabı\")`, `150`, `true`."
  - "`toplam_guc`: `for c in cihazlar { if c.acik_mi() { toplam += c.guc_watt(); } }`. `c` bir `&Box<dyn Cihaz>`; metot çağrısı otomatik deref edilir."
  - "`en_cok_tuketen`: şimdiye kadarki en iyiyi `Option` içinde tut; yalnızca açık cihazlara bak ve yalnızca **kesinlikle büyükse** (`>`) değiştir. Sonunda adı döndür."
explanation: |
  Fonksiyonlar `Lamba`, `Klima` ya da `Buzdolabi`'yi tanımıyor; yalnızca `Cihaz` sözleşmesini kullanıyorlar.
  Yarın bir “çamaşır makinesi” eklemek için bu fonksiyonlara dokunman gerekmez. Bu, açık bir tip kümesinde
  trait nesnelerinin gücü. Iterator'larla daha kısa yazılabilir:
  `cihazlar.iter().filter(|c| c.acik_mi()).map(|c| c.guc_watt()).sum()`. En çok tüketen için `max_by_key`
  kullanırsan dikkat: eşitlikte **son** elemanı döndürür, bu yüzden “ilk gelen” kuralı için döngü ya da
  `min_by_key` ile ters karşılaştırma gerekir.
```

```exercise
id: m20-boss-e-telefon
title: Typestate ile telefon kilidi
difficulty: 4
prompt: |
  Telefon kilidini **typestate** ile modelle. `KilitliTelefon` ve `AcikTelefon` iki ayrı tip.

  - `KilitliTelefon::new(pin)`: hatalı deneme sayısı 0.
  - `ac(self, girilen)` → `Result<AcikTelefon, KilitliTelefon>`:
    - Telefon **bloke** ise (3 veya daha fazla hatalı deneme) doğru PIN de olsa `Err(self)` döner, sayaç
      artmaz.
    - PIN doğruysa `Ok(AcikTelefon)` döner (hatalı deneme sayısı sıfırlanmış olarak saklanır).
    - Yanlışsa hatalı deneme sayısını 1 artırır ve telefonu `Err` içinde **geri verir**.
  - `KilitliTelefon::bloke_mi()`, `hatali_deneme()` getter'ları.
  - `AcikTelefon::mesaj_gonder(&mut self, metin)`: gönderilen mesajları sayar; `mesaj_sayisi()` döndürür.
  - `AcikTelefon::kilitle(self) -> KilitliTelefon`: aynı PIN'le, hatalı deneme sayısı 0 olarak kilitlenir.
starter: |
  pub struct KilitliTelefon {
      pin: String,
      hatali_deneme: u32,
  }

  pub struct AcikTelefon {
      pin: String,
      mesaj_sayisi: u32,
  }

  impl KilitliTelefon {
      pub fn new(pin: &str) -> KilitliTelefon {
          KilitliTelefon { pin: pin.to_string(), hatali_deneme: 0 }
      }

      pub fn hatali_deneme(&self) -> u32 {
          self.hatali_deneme
      }

      pub fn bloke_mi(&self) -> bool {
          todo!()
      }

      pub fn ac(self, girilen: &str) -> Result<AcikTelefon, KilitliTelefon> {
          todo!()
      }
  }

  impl AcikTelefon {
      pub fn mesaj_gonder(&mut self, metin: &str) {
          todo!()
      }

      pub fn mesaj_sayisi(&self) -> u32 {
          self.mesaj_sayisi
      }

      pub fn kilitle(self) -> KilitliTelefon {
          todo!()
      }
  }

  fn main() {
      let tel = KilitliTelefon::new("1453");
      let tel = match tel.ac("0000") {
          Ok(_) => panic!("yanlış PIN kabul edildi"),
          Err(t) => t,
      };
      println!("Hatalı deneme: {}", tel.hatali_deneme());
      match tel.ac("1453") {
          Ok(mut acik) => {
              acik.mesaj_gonder("Akşama geliyorum");
              println!("Açıldı, {} mesaj gönderildi", acik.mesaj_sayisi());
          }
          Err(_) => println!("Açılamadı"),
      }
  }
solution: |
  pub struct KilitliTelefon {
      pin: String,
      hatali_deneme: u32,
  }

  pub struct AcikTelefon {
      pin: String,
      mesaj_sayisi: u32,
  }

  impl KilitliTelefon {
      pub fn new(pin: &str) -> KilitliTelefon {
          KilitliTelefon { pin: pin.to_string(), hatali_deneme: 0 }
      }

      pub fn hatali_deneme(&self) -> u32 {
          self.hatali_deneme
      }

      pub fn bloke_mi(&self) -> bool {
          self.hatali_deneme >= 3
      }

      pub fn ac(mut self, girilen: &str) -> Result<AcikTelefon, KilitliTelefon> {
          if self.bloke_mi() {
              return Err(self);
          }
          if girilen == self.pin {
              Ok(AcikTelefon { pin: self.pin, mesaj_sayisi: 0 })
          } else {
              self.hatali_deneme += 1;
              Err(self)
          }
      }
  }

  impl AcikTelefon {
      pub fn mesaj_gonder(&mut self, metin: &str) {
          if !metin.is_empty() {
              self.mesaj_sayisi += 1;
          }
      }

      pub fn mesaj_sayisi(&self) -> u32 {
          self.mesaj_sayisi
      }

      pub fn kilitle(self) -> KilitliTelefon {
          KilitliTelefon { pin: self.pin, hatali_deneme: 0 }
      }
  }

  fn main() {
      let tel = KilitliTelefon::new("1453");
      let tel = match tel.ac("0000") {
          Ok(_) => panic!("yanlış PIN kabul edildi"),
          Err(t) => t,
      };
      println!("Hatalı deneme: {}", tel.hatali_deneme());
      match tel.ac("1453") {
          Ok(mut acik) => {
              acik.mesaj_gonder("Akşama geliyorum");
              println!("Açıldı, {} mesaj gönderildi", acik.mesaj_sayisi());
          }
          Err(_) => println!("Açılamadı"),
      }
  }
check: tests
tests: |
  fn yanlis(t: KilitliTelefon) -> KilitliTelefon {
      match t.ac("9999") {
          Ok(_) => panic!("yanlış PIN telefonu açmamalı"),
          Err(t) => t,
      }
  }

  #[test]
  fn dogru_pin_acar() {
      let acik = KilitliTelefon::new("2023").ac("2023");
      assert!(acik.is_ok(), "Doğru PIN telefonu açmalı");
  }

  #[test]
  fn yanlis_pin_telefonu_geri_verir_ve_sayar() {
      let t = yanlis(KilitliTelefon::new("2023"));
      assert_eq!(t.hatali_deneme(), 1, "Bir hatalı deneme sayılmalı");
      assert!(!t.bloke_mi(), "Tek hata bloke etmemeli");
      let t = yanlis(yanlis(t));
      assert_eq!(t.hatali_deneme(), 3);
      assert!(t.bloke_mi(), "3 hatalı denemeden sonra bloke olmalı");
  }

  #[test]
  fn bloke_telefon_dogru_pinle_de_acilmaz() {
      let t = yanlis(yanlis(yanlis(KilitliTelefon::new("2023"))));
      match t.ac("2023") {
          Ok(_) => panic!("Bloke telefon doğru PIN'le bile açılmamalı"),
          Err(t) => assert_eq!(t.hatali_deneme(), 3, "Bloke telefonda sayaç artmamalı"),
      }
  }

  #[test]
  fn mesaj_ve_kilitleme() {
      let t = yanlis(yanlis(KilitliTelefon::new("0101")));
      let mut acik = match t.ac("0101") {
          Ok(a) => a,
          Err(_) => panic!("2 hatadan sonra doğru PIN açmalı"),
      };
      acik.mesaj_gonder("Merhaba");
      acik.mesaj_gonder("Nasılsın?");
      assert_eq!(acik.mesaj_sayisi(), 2);
      let kilitli = acik.kilitle();
      assert_eq!(kilitli.hatali_deneme(), 0, "Kilitleme sayacı sıfırlamalı");
      assert!(kilitli.ac("0101").is_ok(), "Kilitlenen telefon aynı PIN'le açılmalı");
  }
hints:
  - "`bloke_mi` yalnızca `self.hatali_deneme >= 3`. `ac`'ın sayaç artırabilmesi için imzayı `pub fn ac(mut self, ...)` yap."
  - "`ac`'ta sıra önemli: önce bloke kontrolü (`return Err(self);`), sonra PIN karşılaştırması. Doğruysa `Ok(AcikTelefon { pin: self.pin, mesaj_sayisi: 0 })`."
  - "Yanlışsa `self.hatali_deneme += 1; Err(self)`. `kilitle` için `KilitliTelefon { pin: self.pin, hatali_deneme: 0 }`; `mesaj_gonder` için `self.mesaj_sayisi += 1;`."
explanation: |
  Typestate sayesinde kilitli bir telefonda `mesaj_gonder` **yazılamaz**; böyle bir metot `KilitliTelefon`'da yok.
  Başarısız geçişte eski durumu `Err(self)` ile geri vermek, telefonu “kaybetmeden” tekrar denemeyi mümkün
  kılıyor ve hatalı deneme sayısını da taşıyor. `pin` alanı geçişlerde **taşındı**, kopyalanmadı.

  “Bloke” üçüncü bir tip (`BlokeTelefon`) de olabilirdi; o zaman `ac` bir enum döndürmeliydi
  (`enum AcmaSonucu { Acik(..), Kilitli(..), Bloke(..) }`). Burada sayaçlı tek bir kilitli tip daha basit:
  typestate'i derleme zamanında **gerçekten** önemli olan ayrım (açık/kilitli) için kullan, her ayrıntı için değil.
  (Gerçek bir sistemde PIN'i düz metin olarak saklamazsın; bu yalnızca bir modelleme örneği.)
```

```exercise
id: m20-boss-e-sunucu
title: Eşzamanlı istek sayacı koruyucusu
difficulty: 4
prompt: |
  Bir sunucu, o anda işlenmekte olan istek sayısını ve gün içindeki **en yüksek** eşzamanlı istek sayısını
  izliyor. Bir RAII koruyucusu yaz:

  - `Sunucu::istek_baslat(&self, yol) -> IstekKoruyucu<'_>`: aktif sayıyı 1 artırır, gerekirse `en_yuksek`'i
    günceller ve `yol`'u `islenenler` listesine ekler.
  - `IstekKoruyucu` drop edildiğinde aktif sayıyı 1 azaltır.
  - `aktif()`, `en_yuksek()`, `islenenler()` hazır.

  `Sunucu` alanları `Cell` ve `RefCell` (Modül 17) kullanıyor, çünkü koruyucu sunucuyu yalnızca `&` ile tutuyor
  ve aynı anda birden çok koruyucu yaşayabilmeli.
starter: |
  use std::cell::{Cell, RefCell};

  pub struct Sunucu {
      aktif: Cell<u32>,
      en_yuksek: Cell<u32>,
      islenenler: RefCell<Vec<String>>,
  }

  pub struct IstekKoruyucu<'a> {
      sunucu: &'a Sunucu,
  }

  impl Sunucu {
      pub fn new() -> Sunucu {
          Sunucu { aktif: Cell::new(0), en_yuksek: Cell::new(0), islenenler: RefCell::new(Vec::new()) }
      }

      pub fn aktif(&self) -> u32 {
          self.aktif.get()
      }

      pub fn en_yuksek(&self) -> u32 {
          self.en_yuksek.get()
      }

      pub fn islenenler(&self) -> Vec<String> {
          self.islenenler.borrow().clone()
      }

      pub fn istek_baslat(&self, yol: &str) -> IstekKoruyucu<'_> {
          todo!()
      }
  }

  impl Drop for IstekKoruyucu<'_> {
      fn drop(&mut self) {
          todo!()
      }
  }

  fn main() {
      let s = Sunucu::new();
      {
          let _a = s.istek_baslat("/anasayfa");
          let _b = s.istek_baslat("/urunler");
          println!("Aktif: {}", s.aktif());
      }
      println!("Aktif: {}, en yüksek: {}", s.aktif(), s.en_yuksek());
  }
solution: |
  use std::cell::{Cell, RefCell};

  pub struct Sunucu {
      aktif: Cell<u32>,
      en_yuksek: Cell<u32>,
      islenenler: RefCell<Vec<String>>,
  }

  pub struct IstekKoruyucu<'a> {
      sunucu: &'a Sunucu,
  }

  impl Sunucu {
      pub fn new() -> Sunucu {
          Sunucu { aktif: Cell::new(0), en_yuksek: Cell::new(0), islenenler: RefCell::new(Vec::new()) }
      }

      pub fn aktif(&self) -> u32 {
          self.aktif.get()
      }

      pub fn en_yuksek(&self) -> u32 {
          self.en_yuksek.get()
      }

      pub fn islenenler(&self) -> Vec<String> {
          self.islenenler.borrow().clone()
      }

      pub fn istek_baslat(&self, yol: &str) -> IstekKoruyucu<'_> {
          let yeni = self.aktif.get() + 1;
          self.aktif.set(yeni);
          if yeni > self.en_yuksek.get() {
              self.en_yuksek.set(yeni);
          }
          self.islenenler.borrow_mut().push(yol.to_string());
          IstekKoruyucu { sunucu: self }
      }
  }

  impl Drop for IstekKoruyucu<'_> {
      fn drop(&mut self) {
          let aktif = &self.sunucu.aktif;
          aktif.set(aktif.get() - 1);
      }
  }

  fn main() {
      let s = Sunucu::new();
      {
          let _a = s.istek_baslat("/anasayfa");
          let _b = s.istek_baslat("/urunler");
          println!("Aktif: {}", s.aktif());
      }
      println!("Aktif: {}, en yüksek: {}", s.aktif(), s.en_yuksek());
  }
check: tests
tests: |
  #[test]
  fn ic_ice_istekler() {
      let s = Sunucu::new();
      {
          let _a = s.istek_baslat("/a");
          assert_eq!(s.aktif(), 1);
          {
              let _b = s.istek_baslat("/b");
              let _c = s.istek_baslat("/c");
              assert_eq!(s.aktif(), 3, "Üç koruyucu aynı anda yaşıyor");
          }
          assert_eq!(s.aktif(), 1, "İç bloktaki iki koruyucu drop edilmeli");
      }
      assert_eq!(s.aktif(), 0, "Bütün istekler bitti");
      assert_eq!(s.en_yuksek(), 3, "En yüksek eşzamanlı sayı 3");
      assert_eq!(s.islenenler(), vec!["/a", "/b", "/c"]);
  }

  #[test]
  fn alt_cizgi_hemen_birakir() {
      let s = Sunucu::new();
      let _ = s.istek_baslat("/x");
      assert_eq!(s.aktif(), 0, "`let _ =` koruyucuyu hemen drop eder");
      let _y = s.istek_baslat("/y");
      assert_eq!(s.aktif(), 1);
      assert_eq!(s.en_yuksek(), 1, "İki istek hiç aynı anda yaşamadı");
  }

  fn islem(s: &Sunucu, basarili: bool) -> Result<(), String> {
      let _k = s.istek_baslat("/odeme");
      if !basarili {
          return Err(String::from("ödeme reddedildi"));
      }
      Ok(())
  }

  #[test]
  fn erken_donuste_de_azalir() {
      let s = Sunucu::new();
      assert!(islem(&s, false).is_err());
      assert_eq!(s.aktif(), 0, "Hata ile erken dönüşte de sayaç azalmalı");
      assert!(islem(&s, true).is_ok());
      assert_eq!(s.aktif(), 0);
      assert_eq!(s.islenenler().len(), 2);
  }
hints:
  - "`Cell<u32>` için `get()` ve `set(..)` kullanılır: `let yeni = self.aktif.get() + 1; self.aktif.set(yeni);`"
  - "`en_yuksek`'i yalnızca `yeni` ondan büyükse güncelle. Listeye eklemek için `self.islenenler.borrow_mut().push(yol.to_string());`. Sonunda `IstekKoruyucu { sunucu: self }`."
  - "`drop` içinde: `self.sunucu.aktif.set(self.sunucu.aktif.get() - 1);`"
explanation: |
  Sayacı azaltmak hiçbir çağıranın sorumluluğu değil; koruyucu yaşadığı sürece istek “aktif”, drop edildiğinde
  bitmiş sayılır. Erken `return`, `?` ya da panik fark etmez. Koruyucu sunucuyu `&` ile tuttuğu için birden
  çok koruyucu aynı anda yaşayabiliyor; değiştirme işi `Cell`/`RefCell`'in iç değişkenliğiyle yapılıyor.

  Thread'ler arasında aynı fikir için `Cell` yerine `AtomicU32` ve `Arc<Sunucu>` kullanırdın (Modül 18):
  `fetch_add`/`fetch_sub` ile sayaç, `fetch_max` ile en yüksek değer. Desen değişmez, yalnızca araçlar
  thread güvenli olanlarla yer değiştirir.
```
