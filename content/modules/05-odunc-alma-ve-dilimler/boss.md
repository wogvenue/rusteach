---
id: m05-boss
title: "Boss: Ödünç Defterinin Bekçisi"
minutes: 30
type: boss
objectives:
  - Referans, `&mut`, sarkan referans ve dilim kurallarını yeni kodlarda uygulayabilmek
  - Bir programın ödünç denetiminden geçip geçmeyeceğini çalıştırmadan tahmin edebilmek
  - Ödünç alan fonksiyonlar yazarak gerçekçi küçük problemleri çözebilmek
keywords: [boss, ödünç alma, referans, "&mut", dilim, "&str", "&[T]", borrow checker]
---

Modül 5'in sonuna geldin. Kütüphanenin ödünç defteri artık senin elinde: Kim hangi kitabı, okumak
için mi düzeltmek için mi, ne zamana kadar aldı? Bu sınavda yeni bir şey öğretilmeyecek. Öğrendiklerini
**yeni** kodlarda kullanacaksın. Geçmek için puanların en az **%80**'ini toplaman gerekiyor.

Her soruda acele etme: Önce sahibi bul, sonra ödünçleri ve çizgilerini kafanda çiz. Bir iki soruda
önceki modüllerden de bir şeyler hatırlaman gerekecek.

## Bölüm 1: Referanslar ve `&mut`

```predict
code: |
  fn bayt_sayisi(s: &String) -> usize {
      s.len()
  }

  fn main() {
      let ad = String::from("Gül");
      let n = bayt_sayisi(&ad);
      println!("{ad} {n}");
  }
options:
  - "Gül 3"
  - "Gül 4"
  - Derlenmez (E0382)
answer: 1
explanation: |
  `&ad` sahipliği **taşımaz**, sadece ödünç verir. Bu yüzden çağrıdan sonra `ad` hâlâ kullanılabilir.
  (Modül 4'te `bayt_sayisi(ad)` yazsaydık `ad` taşınırdı ve `println!` E0382 verirdi.) `len()` **bayt**
  sayar: `G`(1) + `ü`(2) + `l`(1) = 4.
```

```compiles
code: |
  fn unvan_ekle(ad: &String) {
      ad.push_str(" Bey");
  }

  fn main() {
      let mut ad = String::from("Ahmet");
      unvan_ekle(&ad);
      println!("{ad}");
  }
answer: false
error: E0596
explanation: |
  `&String` **değişmez** bir referanstır; onun üzerinden `push_str` çağrılamaz: `cannot borrow *ad as
  mutable, as it is behind a & reference`. `ad`'ın `let mut` olması yetmez; fonksiyonun da `&mut
  String` alması ve çağrının `unvan_ekle(&mut ad)` olması gerekir.
```

```compiles
code: |
  fn main() {
      let mut skor = 0;
      let oyuncu1 = &mut skor;
      let oyuncu2 = &mut skor;
      *oyuncu1 += 10;
      *oyuncu2 += 20;
      println!("{skor}");
  }
answer: false
error: E0499
explanation: |
  `oyuncu1`'in son kullanımı `*oyuncu1 += 10` satırı ve `oyuncu2` ondan **önce** oluşturuluyor. İki
  `&mut` çizgisi çakışıyor: `cannot borrow skor as mutable more than once at a time`. Satırları
  `let oyuncu1 = ...; *oyuncu1 += 10; let oyuncu2 = ...; *oyuncu2 += 20;` diye sıralasaydık derlenirdi.
```

```compiles
code: |
  fn main() {
      let mut not_defteri = String::from("Notlar:");
      let okuyucu = &not_defteri;
      println!("{okuyucu}");
      let yazar = &mut not_defteri;
      yazar.push_str(" sınav pazartesi");
      println!("{not_defteri}");
  }
answer: true
explanation: |
  Derlenir. `okuyucu`'nun son kullanımı ilk `println!`; ödünç orada biter (NLL). `yazar` ondan sonra
  oluşturulur ve son kullanımı `push_str` satırıdır. En sondaki `println!` geldiğinde ortada canlı bir
  ödünç kalmamıştır, sahip serbestçe okuyabilir.
```

```quiz
question: Rust bir değere canlı bir `&` referans varken aynı değere `&mut` alınmasını neden yasaklar?
options:
  - "Değiştirme sırasında veri yeni bir yere taşınabilir (ör. `Vec` yeniden ayırma) ve okuyucu serbest bırakılmış ya da yarım değişmiş veri görebilir; thread'ler varsa bu bir veri yarışıdır"
  - "`&mut` referanslar bellekte daha fazla yer kapladığı için"
  - "Çöp toplayıcının (garbage collector) karışmaması için"
  - "Sadece çok thread'li programlarda bir sorun olduğu için; tek thread'li programlarda bu kural uygulanmaz"
answer: 0
explanation: |
  Kuralın iki gerekçesi var: **geçersiz kalan referanslar** (iterator invalidation, tek thread'de bile
  olur) ve **veri yarışları** (çok thread'de). "Aliasing XOR mutation" ikisini de derleme zamanında
  imkânsız kılar.
feedback:
  - "Doğru! Kural tek thread'li programlarda da geçerlidir, çünkü sarkan referans tehlikesi orada da var."
  - "`&` ve `&mut` bellekte aynı boyuttadır (bir adres). Sorun boyut değil, aynı anda okuma ve yazma."
  - "Rust'ta çöp toplayıcı yoktur; bellek sahiplik kurallarıyla yönetilir."
  - "Kural her programda uygulanır. Ders 2'deki `Vec` + `push` örneği tek thread'de bile sarkan referans üretirdi."
```

Şimdi `&` ve `&mut` referansları birlikte kullanacağın ilk alıştırma.

````exercise
title: Kumbaraya para at
difficulty: 2
prompt: |
  Çocuklar için bir kumbara uygulaması yazıyorsun. `kumbaraya_at` fonksiyonu:

  - `paralar` dilimindeki her bozuk parayı (kuruş cinsinden) **sırasıyla** `kumbara`'nın sonuna ekler,
  - ekledikten sonra kumbaradaki **tüm** paraların toplamını döndürür (önceden içinde olanlar dahil).

  `kumbara` değiştirileceği için `&mut Vec<u32>`, `paralar` sadece okunacağı için `&[u32]` olarak
  ödünç alınıyor. Böylece hem bir diziyle hem de bir vektörün parçasıyla çağrılabilir.
starter: |
  fn kumbaraya_at(kumbara: &mut Vec<u32>, paralar: &[u32]) -> u32 {
      todo!()
  }

  fn main() {
      let mut kumbara = vec![50];
      let toplam = kumbaraya_at(&mut kumbara, &[25, 100]);
      println!("{kumbara:?} → {toplam} kuruş");
  }
solution: |
  fn kumbaraya_at(kumbara: &mut Vec<u32>, paralar: &[u32]) -> u32 {
      for p in paralar {
          kumbara.push(*p);
      }
      let mut toplam = 0;
      for p in kumbara.iter() {
          toplam += *p;
      }
      toplam
  }

  fn main() {
      let mut kumbara = vec![50];
      let toplam = kumbaraya_at(&mut kumbara, &[25, 100]);
      println!("{kumbara:?} → {toplam} kuruş");
  }
check: tests
tests: |
  #[test]
  fn paralar_sirasiyla_eklenir_ve_toplam_doner() {
      let mut k = vec![50];
      let t = kumbaraya_at(&mut k, &[25, 100]);
      assert_eq!(k, vec![50, 25, 100], "paralar kumbaranın sonuna sırasıyla eklenmeli");
      assert_eq!(t, 175, "50 + 25 + 100 = 175 kuruş");
  }

  #[test]
  fn bos_paralar_mevcut_toplami_dondurur() {
      let mut k = vec![10, 5];
      let t = kumbaraya_at(&mut k, &[]);
      assert_eq!(k, vec![10, 5], "hiç para atılmadıysa kumbara değişmemeli");
      assert_eq!(t, 15, "önceden içindeki paraların toplamı dönmeli");
  }

  #[test]
  fn vektor_parcasiyla_da_calisir() {
      let cuzdan = vec![1, 5, 10, 25];
      let mut k = vec![];
      let t = kumbaraya_at(&mut k, &cuzdan[2..]);
      assert_eq!(k, vec![10, 25], "sadece dilimdeki paralar eklenmeli");
      assert_eq!(t, 35);
      assert_eq!(cuzdan.len(), 4, "cüzdan sadece ödünç verildi, olduğu gibi kalmalı");
  }
hints:
  - "`for p in paralar` ile dilimi dolaş; `p` bir `&u32`'dir, eklerken `*p` yaz."
  - "Eklemeler bittikten **sonra** ikinci bir döngüyle `kumbara`'yı dolaşıp topla: `for p in kumbara.iter() { toplam += *p; }`"
  - "`let mut toplam = 0;` ile başla ve en sonda noktalı virgülsüz `toplam` döndür."
explanation: |
  `paralar` bir `&[u32]` olduğu için fonksiyon bir diziyle (`&[25, 100]`), bir vektörle ya da
  vektörün bir parçasıyla (`&cuzdan[2..]`) çağrılabiliyor. `kumbara` ise `&mut` olarak ödünç alındı;
  `push` doğrudan çağıranın vektörünü büyüttü, hiçbir şey döndürmemiz gerekmedi.

  İki `for` döngüsünü ayırmamız tesadüf değil: Birinci döngü `paralar`'ı okuyup `kumbara`'ya yazıyor
  (iki **farklı** değer, çakışma yok). İkinci döngü sadece okuyor. Toplamı her `push`'ta ayrı ayrı
  güncellemek de mümkündü, ama önceden kumbarada olan paraları da saymak gerekiyor.
````

## Bölüm 2: Sarkan referanslar ve dilimler

```compiles
code: |
  fn main() {
      let r;
      {
          let sehir = String::from("Trabzon");
          r = &sehir;
      }
      println!("{r}");
  }
answer: false
error: E0597
explanation: |
  `sehir` iç bloğun sonunda drop edilir, ama `r` blok bittikten sonra kullanılıyor. Referans, gösterdiği
  değerden **uzun yaşayamaz**: `sehir does not live long enough`. Düzeltme: `sehir`'i dış kapsamda
  tanımlamak ya da `println!`'i bloğun içine almak.
```

```predict
code: |
  fn main() {
      let s = String::from("şeker");
      let parca = &s[0..3];
      println!("{parca}");
  }
options:
  - "şek"
  - "şe"
  - "Panik: bayt sınırı değil"
answer: 1
explanation: |
  Dilim indeksleri **bayt** sayar, karakter değil. `ş` UTF-8'de 2 bayt (0 ve 1), `e` 1 bayt (2). `0..3`
  tam olarak bu üç baytı kapsar ve bir karakter sınırında biter: `"şe"`. `&s[0..1]` yazsaydık `ş`'nin
  ortasından keserdik ve program panik verirdi.
```

```compiles
code: |
  fn ilk_kelime(s: &str) -> &str {
      for (i, b) in s.as_bytes().iter().enumerate() {
          if *b == b' ' {
              return &s[..i];
          }
      }
      s
  }

  fn main() {
      let mut cumle = String::from("merhaba dünya");
      let kelime = ilk_kelime(&cumle);
      cumle.clear();
      println!("{kelime}");
  }
answer: false
error: E0502
explanation: |
  `kelime`, `cumle`'nin içini gösteren bir dilim (imza `&str` alıp `&str` döndürdüğü için derleyici bunu
  bilir). `clear` ise `cumle`'yi `&mut` olarak ister. `kelime` son satırda hâlâ kullanıldığı için çakışma
  var. Dilimler sayesinde "boşaltılmış bir metnin eski indeksi" hatası derleme zamanında yakalanır.
```

```fill
prompt: "`toplam` hem diziyle hem de bir vektörün parçasıyla çalışsın. Çıktı `6 90` olmalı."
code: |
  fn toplam(sayilar: ___0) -> i32 {
      let mut t = 0;
      for x in sayilar {
          t += *x;
      }
      t
  }

  fn main() {
      let dizi = [1, 2, 3];
      let v = vec![10, 20, 30, 40];
      println!("{} {}", toplam(&dizi), toplam(___1));
  }
blanks:
  - ["&[i32]"]
  - ["&v[1..]", "&v[1..4]", "&v[1..=3]"]
output: "6 90"
explanation: |
  `&[i32]` parametresi `&[i32; 3]`'ü ve `&Vec<i32>`'yi otomatik kabul eder, bir vektör dilimini de
  doğrudan. `20 + 30 + 40 = 90` için `v`'nin 1. elemanından sonuna kadarki dilim gerekiyor: `&v[1..]`.
```

```predict
code: |
  fn main() {
      let mut v = vec![1, 2, 3, 4, 5];
      for x in &mut v[1..3] {
          *x *= 10;
      }
      println!("{v:?}");
  }
options:
  - "[1, 20, 30, 4, 5]"
  - "[1, 20, 30, 40, 5]"
  - "[10, 20, 30, 4, 5]"
answer: 0
explanation: |
  `&mut v[1..3]` 1. ve 2. indeksleri kapsayan değiştirilebilir bir dilimdir (üst sınır **hariç**).
  Döngüde `x` bir `&mut i32` ve `*x *= 10` elemanı yerinde değiştirir. Diğer elemanlara dokunulmaz.
```

İkinci alıştırmada bir metin dilimi döndüreceksin. Türkçe karakterlere dikkat!

````exercise
title: İlk cümleyi bul
difficulty: 3
prompt: |
  Bir haber uygulaması, bildirimlerde haberin sadece **ilk cümlesini** gösteriyor. `ilk_cumle`
  fonksiyonu, metnin başından ilk `.`, `!` ya da `?` işaretine kadar olan kısmı (**işaret dahil**)
  bir **dilim** olarak döndürmeli:

  - `"Kar yağdı. Okullar tatil."` → `"Kar yağdı."`
  - Hiç noktalama işareti yoksa metnin tamamı döner.
  - Yeni bir `String` oluşturma: Sonuç, verilen metnin içini gösteren bir `&str` olmalı.

  İpucu: Noktalama işaretleri ASCII'dir (1 bayt). Dilim indekslerinin **bayt** saydığını unutma.
starter: |
  fn ilk_cumle(metin: &str) -> &str {
      todo!()
  }

  fn main() {
      let haber = String::from("Kar yağdı. Okullar tatil.");
      println!("{}", ilk_cumle(&haber));
  }
solution: |
  fn ilk_cumle(metin: &str) -> &str {
      for (i, b) in metin.as_bytes().iter().enumerate() {
          if *b == b'.' || *b == b'!' || *b == b'?' {
              return &metin[..=i];
          }
      }
      metin
  }

  fn main() {
      let haber = String::from("Kar yağdı. Okullar tatil.");
      println!("{}", ilk_cumle(&haber));
  }
check: tests
tests: |
  #[test]
  fn nokta_ile_biten_ilk_cumle() {
      assert_eq!(ilk_cumle("Kar yağdı. Okullar tatil."), "Kar yağdı.", "ilk noktaya kadar (nokta dahil) dönmeli");
  }

  #[test]
  fn unlem_ve_soru_isareti_de_cumle_bitirir() {
      assert_eq!(ilk_cumle("Gol! Maç 1-0 bitti."), "Gol!", "ünlem işareti de cümleyi bitirir");
      assert_eq!(ilk_cumle("Şişli mi? Evet."), "Şişli mi?", "soru işareti de cümleyi bitirir (Türkçe harflere dikkat: indeksler bayt sayar)");
  }

  #[test]
  fn noktalama_yoksa_tamami_doner() {
      assert_eq!(ilk_cumle("Çay demlendi"), "Çay demlendi", "noktalama yoksa metnin tamamı dönmeli");
      assert_eq!(ilk_cumle(""), "", "boş metin boş dönmeli");
  }

  #[test]
  fn sonuc_orijinal_metnin_icini_gosterir() {
      let haber = String::from("Ödül töreni başladı. Detaylar birazdan.");
      let ilk = ilk_cumle(&haber);
      assert_eq!(ilk, "Ödül töreni başladı.");
      assert_eq!(ilk.as_ptr(), haber.as_ptr(), "sonuç yeni bir String değil, haber'in başını gösteren bir dilim olmalı");
  }
hints:
  - "Metnin baytlarını indeksleriyle dolaş: `for (i, b) in metin.as_bytes().iter().enumerate()`. Ders 4'teki gibi `b` bir `&u8`'dir."
  - "Bayt bir noktalama işaretiyse (`*b == b'.' || *b == b'!' || *b == b'?'`) işaret dahil dilimi döndür: `return &metin[..=i];`"
  - "Döngü hiçbir şey bulamadan biterse metnin tamamını döndür: son satıra noktalı virgülsüz `metin` yaz."
explanation: |
  Fonksiyon bir `&str` alıp bir `&str` döndürüyor; dönen dilim, parametrenin gösterdiği metnin **içini**
  gösteriyor. Hiç kopya yok, sadece "adres + uzunluk". Test bunu `as_ptr()` ile doğruluyor: Dilimin
  başlangıç adresi, `haber`'in başlangıç adresiyle aynı.

  Neden `chars().enumerate()` değil? O, **karakter** sırası verir. `"Şişli mi?"` metninde (sıfırdan sayınca)
  `?`'nin karakter sırası 8, bayt indeksi ise 10'dur (`Ş` ve `ş` ikişer bayt). Karakter sırasını dilim indeksi olarak
  kullansaydın yanlış yerden keserdin, hatta bir karakterin ortasına denk gelip panik verebilirdin.
  Noktalama işaretleri tek baytlık ASCII olduğu için bayt indeksi `i`'de bitirilen `..=i` dilimi her
  zaman bir karakter sınırında biter.

  `b'.'` bir **bayt literalidir** (Modül 2): `u8` tipinde, `'.'`'nın ASCII kodu.
````

## Bölüm 3: Borrow checker gibi düşün

```compiles
code: |
  fn main() {
      let mut liste = vec![String::from("elma"), String::from("armut")];
      for meyve in &liste {
          if meyve.len() > 4 {
              liste.push(String::from("kiraz"));
          }
      }
      println!("{}", liste.len());
  }
answer: false
error: E0502
explanation: |
  `for meyve in &liste` döngüsü `liste`'yi **bütün döngü boyunca** ödünç alır. İçerideki `push` bir
  `&mut` ister ve bu çizginin içine düşer. Çözüm: Uzunluğu önceden saklayıp indeksle dolaşmak ya da
  eklenecekleri ayrı bir listede toplayıp döngüden sonra eklemek.
```

```predict
code: |
  fn main() {
      let mut stok = vec![4, 0, 7, 0];
      let mut i = 0;
      let ilk_bos = loop {
          if stok[i] == 0 {
              break i;
          }
          i += 1;
      };
      stok[ilk_bos] = 10;
      println!("{ilk_bos} {stok:?}");
  }
options:
  - "1 [4, 10, 7, 0]"
  - "3 [4, 0, 7, 10]"
  - Derlenmez (E0502)
answer: 0
explanation: |
  Modül 3'teki `loop` + `break değer` deseni: Döngü ilk `0`'ı bulduğu anda `break i` ile indeksi
  (`1`) dışarı verir. `ilk_bos` bir `usize`, yani bir referans değil; `stok`'u ödünç almaz. Bu yüzden
  `stok[ilk_bos] = 10` serbestçe çalışır. İkinci `0`'a hiç bakılmaz.
```

```compiles
code: |
  fn main() {
      let a = String::from("kitap");
      let b = a;
      let r = &a;
      println!("{r} {b}");
  }
answer: false
error: E0382
explanation: |
  Modül 4'ü hatırla: `let b = a;` bir `String`'i **taşır**. Taşınmış bir değeri ödünç almak da onu
  kullanmaktır: `borrow of moved value: a`. Sadece geçerli (taşınmamış) bir değer ödünç verilebilir.
  `let r = &b;` yazsaydık derlenirdi.
```

Son ve en zor alıştırma. Burada ödünçleri ve indeksleri birlikte düşünmen gerekecek.

````exercise
title: Sırada öne geçir
difficulty: 4
prompt: |
  Bir hastanenin bekleme sırası `sira` vektöründe tutuluyor. Acil bir durum olduğunda `one_al`
  fonksiyonu adı verilen hastayı sıranın **en önüne** almalı:

  - Diğer hastaların **kendi aralarındaki sırası değişmemeli**:
    `["Ali", "Ayşe", "Can", "Deniz"]` içinde `"Can"` öne alınırsa → `["Can", "Ali", "Ayşe", "Deniz"]`.
  - Aynı isim birden fazla varsa **ilk** bulunan öne alınır.
  - Hasta sırada yoksa hiçbir şey değişmez ve fonksiyon `false` döndürür; bulunduysa `true`.

  Kullanabileceğin araçlar: indeksleme, `len()` ve Ders 5'teki `swap(i, j)` (iki elemanın yerini
  değiştirir). `String` ile `&str` `==` ile karşılaştırılabilir: `sira[i] == isim`.
starter: |
  fn one_al(sira: &mut [String], isim: &str) -> bool {
      todo!()
  }

  fn main() {
      let mut sira = vec![
          String::from("Ali"),
          String::from("Ayşe"),
          String::from("Can"),
          String::from("Deniz"),
      ];
      let bulundu = one_al(&mut sira, "Can");
      println!("{bulundu}: {sira:?}");
  }
solution: |
  fn one_al(sira: &mut [String], isim: &str) -> bool {
      let mut bulunan = sira.len();
      for i in 0..sira.len() {
          if sira[i] == isim {
              bulunan = i;
              break;
          }
      }
      if bulunan == sira.len() {
          return false;
      }
      let mut j = bulunan;
      while j > 0 {
          sira.swap(j, j - 1);
          j -= 1;
      }
      true
  }

  fn main() {
      let mut sira = vec![
          String::from("Ali"),
          String::from("Ayşe"),
          String::from("Can"),
          String::from("Deniz"),
      ];
      let bulundu = one_al(&mut sira, "Can");
      println!("{bulundu}: {sira:?}");
  }
check: tests
tests: |
  fn sira_yap(isimler: &[&str]) -> Vec<String> {
      let mut v = vec![];
      for i in isimler {
          v.push(String::from(*i));
      }
      v
  }

  #[test]
  fn ortadaki_hasta_one_gecer_digerleri_sirasini_korur() {
      let mut s = sira_yap(&["Ali", "Ayşe", "Can", "Deniz"]);
      assert!(one_al(&mut s, "Can"), "Can sırada var, true dönmeli");
      assert_eq!(s, sira_yap(&["Can", "Ali", "Ayşe", "Deniz"]), "Can öne geçmeli; Ali, Ayşe, Deniz kendi sıralarını korumalı");
  }

  #[test]
  fn sondaki_ve_bastaki_hasta() {
      let mut s = sira_yap(&["Ali", "Ayşe", "Can"]);
      assert!(one_al(&mut s, "Can"));
      assert_eq!(s, sira_yap(&["Can", "Ali", "Ayşe"]), "sondaki hasta da en öne gelebilmeli");
      assert!(one_al(&mut s, "Can"), "zaten en öndeki hasta için de true dönmeli");
      assert_eq!(s, sira_yap(&["Can", "Ali", "Ayşe"]), "zaten öndeyse sıra değişmemeli");
  }

  #[test]
  fn sirada_olmayan_hasta() {
      let mut s = sira_yap(&["Ali", "Ayşe"]);
      assert!(!one_al(&mut s, "Zeynep"), "sırada olmayan hasta için false dönmeli");
      assert_eq!(s, sira_yap(&["Ali", "Ayşe"]), "bulunamazsa sıra değişmemeli");
      let mut bos: Vec<String> = vec![];
      assert!(!one_al(&mut bos, "Ali"), "boş sırada kimse bulunamaz");
  }

  #[test]
  fn ayni_isimden_ilk_bulunan_one_gecer() {
      let mut s = sira_yap(&["Ali", "Can", "Ayşe", "Can"]);
      assert!(one_al(&mut s, "Can"));
      assert_eq!(s, sira_yap(&["Can", "Ali", "Ayşe", "Can"]), "ilk Can öne geçmeli, ikinci Can yerinde kalmalı");
  }
hints:
  - "İki aşamada düşün: **önce oku** (hastanın indeksini bul), **sonra yaz** (yerini değiştir). Hastaya bir referans tutma; indeksini (`usize`) tut."
  - "Bulunan indeksi döngüden önce `sira.len()` gibi \"bulunamadı\" anlamına gelen bir değerle başlat; bulunca güncelleyip `break` et. Döngüden sonra hâlâ `sira.len()` ise `false` döndür."
  - "Hastayı öne getirmek için bulunduğu yerden başlayıp her adımda bir önceki komşusuyla yer değiştir: `while j > 0 { sira.swap(j, j - 1); j -= 1; }`. Bu, aradaki herkesi bir geriye kaydırır."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: Hastaları kopyalamaya gerek yok; `swap` ile yerlerini değiştirmek yeter.
explanation: |
  Çözüm, bu modülde öğrendiğin **"önce oku, sonra yaz"** ve **"referans yerine indeks"** fikirlerinin
  birleşimi:

  1. **Okuma aşaması:** Döngü sadece karşılaştırma yapar ve hastanın indeksini bulur. `bulunan` bir
     `usize` olduğu için hiçbir şeyi ödünç almaz. Başlangıç değeri olarak `sira.len()` seçtik, çünkü bu
     geçerli hiçbir indekse eşit olamaz ("bulunamadı" işareti). Modül 7'de bunu `Option` ile daha
     zarif ifade edeceğiz.
  2. **Yazma aşaması:** Hasta, komşusuyla art arda yer değiştirerek öne "kabarcık gibi" yükselir.
     `swap` iki `String`'in sadece stack'teki başlıklarını (işaretçi, uzunluk, kapasite) değiş tokuş
     eder; isimlerin heap'teki harfleri hiç kopyalanmaz.

  Hastaya bir `&String` tutmaya çalışsaydın, o referans canlıyken `swap` için gereken `&mut` alınamazdı
  (E0502). Bir de çağıran tarafı düşün: `one_al(&mut sira, &sira[2])` yazmak da E0502 olurdu, çünkü
  `isim` parametresi `sira`'nın içini gösterirken `sira` aynı anda `&mut` olarak ödünç verilemez. Doğru
  çağrı, ismi ayrı bir yerden vermektir: `one_al(&mut sira, "Can")`.

  Parametre `&mut Vec<String>` değil `&mut [String]`: Eleman eklemiyor ya da silmiyoruz, sadece yerlerini
  değiştiriyoruz. Ders 4 ve 5'teki ilkenin aynısı: Fonksiyon,
  işi için gerekenden fazla yetki istememeli.
````
