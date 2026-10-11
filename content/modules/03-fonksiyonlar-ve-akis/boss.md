---
id: m03-boss
title: "Boss: Fonksiyonlar ve Kontrol Akışı"
minutes: 30
type: boss
keywords: [boss, fonksiyon, ifade, deyim, if, else, loop, while, for, break, continue, etiket, parse]
---

Modül 3'ün sonuna geldin! Bu sınavda fonksiyonları, ifadeleri, koşulları, döngüleri ve tahmin oyunu
projesini bir arada kullanacaksın. Arada Modül 1 ve 2'den de birkaç soru çıkacak. Geçmek için **%80**
gerekiyor. Acele etme: Her kodu satır satır, derleyici gibi oku.

:::tip Strateji
Bir `predict` sorusunda değişkenlerin değerlerini kâğıda tablo olarak yaz ve her satırda güncelle. Döngülerde
her tur için bir satır aç. Kafadan yapılan hesap en çok döngülerde yanıltır.
:::

## Bölüm 1: Fonksiyonlar ve ifadeler

```predict
code: |
  fn katla(x: i32) -> i32 {
      x * 2
  }

  fn main() {
      let x = 3;
      let y = {
          let x = katla(x);
          x + 1
      };
      println!("{x} {y}");
  }
options:
  - "3 7"
  - "6 7"
  - "7 7"
  - "3 6"
answer: 0
explanation: |
  Bloğun içindeki `let x = katla(x);` yeni bir `x` tanımlar ve dıştakini yalnızca **blok boyunca**
  gölgeler (Modül 2). İçteki `x` 6'dır ve bloğun son ifadesi `x + 1`, yani 7, `y`'ye bağlanır. Blok
  bitince içteki `x` yok olur ve dıştaki `x` yeniden görünür: Hâlâ 3.
```

```compiles
code: |
  fn main() {
      let fiyat = 120;
      let kdv_dahil: i32 = {
          let kdv = fiyat / 5;
          fiyat + kdv;
      };
      println!("{kdv_dahil}");
  }
answer: false
error: E0308
explanation: |
  Bloğun son satırındaki `fiyat + kdv;` noktalı virgülle bittiği için bir **deyim** olur; değeri atılır ve
  blok `()` üretir. `kdv_dahil` ise `i32` bekliyor: *expected `i32`, found `()`*. Düzeltme: Son satırdaki
  noktalı virgülü silmek. Fonksiyon gövdelerinde de aynı kural geçerlidir.
```

```predict
code: |
  fn indirimli(tutar: u32) -> u32 {
      if tutar < 100 {
          return tutar;
      }
      tutar - tutar / 10
  }

  fn main() {
      println!("{} {}", indirimli(80), indirimli(250));
  }
options:
  - "80 225"
  - "80 25"
  - "72 225"
  - "Derlenmez, çünkü `if`'in `else` dalı yok"
answer: 0
explanation: |
  80 için koruma koşulu (guard clause) çalışır ve `return tutar;` fonksiyonu hemen 80 ile bitirir.
  250 için `if`'e girilmez; son ifade `250 - 250 / 10` = `250 - 25` = 225 dönüş değeri olur. Kod
  derlenir: Bu `if` bir değer üretmek için değil, erken çıkış için kullanılıyor ve gövdesi `return` ile
  bittiği için `else`'e ihtiyaç yoktur.
```

## Bölüm 2: Koşullar

```compiles
code: |
  fn main() {
      let sicaklik = 22;
      let durum = if sicaklik > 30 {
          "sıcak"
      } else if sicaklik > 15 {
          "ılık"
      };
      println!("{durum}");
  }
answer: false
error: E0317
explanation: |
  `if` bir değer olarak kullanılıyor ama son bir `else` dalı yok. Sıcaklık 15 ya da daha azsa hiçbir dal
  çalışmaz ve ifade `()` üretirdi; diğer dallar ise `&str` üretiyor. Derleyici bu yüzden *`if` may be
  missing an `else` clause* (`E0317`) der. Düzeltme: `else { "soğuk" }` eklemek.
```

```predict
code: |
  fn kategori(yas: u32) -> &'static str {
      if yas >= 18 {
          "yetişkin"
      } else if yas >= 65 {
          "emekli"
      } else {
          "çocuk"
      }
  }

  fn main() {
      println!("{} {} {}", kategori(70), kategori(10), kategori(18));
  }
options:
  - "yetişkin çocuk yetişkin"
  - "emekli çocuk yetişkin"
  - "emekli çocuk çocuk"
  - "yetişkin çocuk çocuk"
answer: 0
explanation: |
  Bir `else if` zincirinde **ilk doğru dal** çalışır, diğerlerine bakılmaz bile. 70 için ilk koşul
  (`yas >= 18`) zaten doğru, bu yüzden "emekli" dalına hiç gelinmez; o dal aslında **hiçbir zaman**
  çalışamaz. Düzeltme: En dar koşulu (`yas >= 65`) en üste koymak. 18 için `>=` sınırı dahil eder:
  "yetişkin".
```

```predict
code: |
  fn main() {
      let kisi_sayisi = 0;
      let dilim = 8;
      if kisi_sayisi > 0 && dilim / kisi_sayisi >= 2 {
          println!("Herkese en az 2 dilim düşüyor");
      } else {
          println!("Önce kaç kişi olduğunu söyle");
      }
  }
options:
  - "Önce kaç kişi olduğunu söyle"
  - "Herkese en az 2 dilim düşüyor"
  - "Program sıfıra bölme yüzünden panikler"
answer: 0
explanation: |
  `&&` **kısa devre** yapar: Sol taraf (`kisi_sayisi > 0`) `false` olduğu anda sonuç kesinleşir ve sağ
  taraf hiç hesaplanmaz. Bu yüzden `8 / 0` bölmesi hiç yapılmaz ve panik olmaz. Koşulların sırasını
  değiştirseydin (`dilim / kisi_sayisi >= 2 && kisi_sayisi > 0`) program sıfıra bölme paniği verirdi.
```

## Bölüm 3: Döngüler

```predict
code: |
  fn main() {
      let mut i = 0;
      let mut toplam = 0;
      let sonuc = loop {
          i += 1;
          if i % 3 == 0 {
              continue;
          }
          toplam += i;
          if toplam > 10 {
              break i;
          }
      };
      println!("{sonuc} {toplam}");
  }
options:
  - "5 12"
  - "5 15"
  - "4 10"
  - "6 12"
answer: 0
explanation: |
  Turları tek tek izle: `i = 1` → toplam 1; `i = 2` → toplam 3; `i = 3` → 3'e tam bölünür, `continue`
  turun geri kalanını atlar (toplam 3 kalır); `i = 4` → toplam 7; `i = 5` → toplam 12, 10'dan büyük,
  `break i` döngüyü bitirir ve `loop` ifadesinin değeri 5 olur. 3'ü atlamasaydık toplam 15 olurdu.
```

```compiles
code: |
  fn main() {
      let notlar = [45, 70, 38, 90];
      let ilk_gecen = for not in notlar {
          if not >= 50 {
              break not;
          }
      };
      println!("{ilk_gecen}");
  }
answer: false
error: E0571
explanation: |
  `break` ile değer döndürmek **yalnızca `loop`**'ta mümkündür; `for` ve `while`'da değil (`E0571`).
  `for` döngüsü eleman bulamadan bitebilir (bütün notlar 50'nin altında olsaydı) ve o zaman
  `ilk_gecen`'in değeri belirsiz kalırdı. Çözüm: Arama işini `loop` ile yapmak ya da bir fonksiyona koyup
  bulunca `return not;` demek.
```

````quiz
question: |
  Bir oyunda karakterin canı `u8` tipinde tutuluyor. Bu program (varsayılan debug derlemesiyle)
  çalıştırılınca ne olur?
  ```rust
  fn main() {
      let mut can: u8 = 250;
      for _ in 0..10 {
          can += 1;
      }
      println!("{can}");
  }
  ```
options:
  - "`260` yazar"
  - "`4` yazar: Değer 255'ten sonra başa sarar"
  - "Panikler: *attempt to add with overflow*"
  - "Derlenmez"
answer: 2
explanation: |
  Modül 2'den hatırla: `u8` en fazla 255 tutabilir. Döngünün 6. turunda `can` 255'ten 256'ya çıkmaya
  çalışır. Debug derlemesinde tamsayı taşması programı **paniğe** sokar. Release derlemesinde ise değer
  sessizce başa sarardı (sonuç 4 olurdu); bu yüzden taşmanın beklendiği yerlerde `wrapping_add`,
  `checked_add` ya da `saturating_add` kullanmak gerekir. `_` ise döngü değişkenini kullanmayacağımızı
  söyler.
feedback:
  - "`u8` 255'ten büyük bir değer tutamaz."
  - "Sarmalama (wrap) yalnızca **release** derlemesinde olur; debug derlemesinde program panikler."
  - Doğru!
  - Derleyici bu taşmayı derleme zamanında göremez; değer döngüyle, çalışma sırasında büyüyor.
````

```fill
prompt: |
  Bankaya 1000 TL yatırdın ve her yıl bakiyenin onda biri kadar faiz ekleniyor (tamsayı bölmesi). Boşlukları
  doldur: Program, bakiyenin **kaç yılda en az 2000 TL'ye** ulaştığını hesaplayıp `8 yıl` yazdırsın.
code: |
  fn main() {
      let mut bakiye = 1000;
      let mut yil = 0;
      ___0 bakiye < 2000 {
          bakiye += bakiye ___1 10;
          yil += 1;
      }
      println!("{yil} yıl");
  }
blanks:
  - ["while"]
  - ["/"]
output: "8 yıl"
explanation: |
  "Bakiye 2000'in altında **olduğu sürece**" dönmek tam bir `while` işi: Koşul her turdan önce sınanır.
  Her yıl bakiyenin onda biri (`bakiye / 10`) eklenir: 1100, 1210, 1331, 1464, 1610, 1771, 1948, 2142.
  Sekizinci yılın sonunda bakiye 2000'i geçer ve koşul yanlış olur.
```

```parsons
prompt: |
  Satırları sıraya koy: Program, 1 ile 9 arasında çarpımı 24, toplamı 10 olan **ilk** sayı çiftini bulsun,
  `4 ve 6` yazdırsın ve bulduğu anda **iki döngüyü birden** bitirsin.
lines: |
  fn main() {
      'dis: for a in 1..=9 {
          for b in 1..=9 {
              if a * b == 24 && a + b == 10 {
                  println!("{a} ve {b}");
                  break 'dis;
              }
          }
      }
  }
distractors: |2
                  break;
      for a in 1..=9 {
explanation: |
  Dış döngüye `'dis:` etiketi verip `break 'dis;` dediğimizde iki döngü birden biter. Etiketsiz `break;`
  yalnızca içteki döngüyü bitirirdi: `a = 6` turunda `6 ve 4` de yazdırılırdı. Etiketi kullanabilmek için
  dış döngünün `'dis: for a in 1..=9` diye etiketlenmiş olması şart.
```

## Bölüm 4: Proje ve son alıştırmalar

```compiles
code: |
  fn main() {
      let girdi = String::from(" 42\n");
      let sayi = girdi.trim().parse().expect("Sayı bekleniyordu");
      println!("{sayi}");
  }
answer: false
error: E0284
explanation: |
  `parse` metni pek çok tipe çevirebilir: `i32`, `u8`, `f64`... Derleyici hangisini istediğini bilemez:
  *type annotations needed* (`E0284`). Modül 2'den ve tahmin oyunundan hatırla: Hedef tipi
  `let sayi: u32 = ...` ile ya da turbofish ile (`parse::<u32>()`) söylemen gerekir.
```

```quiz
question: |
  Tahmin oyununda oyuncu sayı yerine `abc` yazıyor. Programın **çökmeden** yeniden tahmin istemesi için
  döngünün içinde `let sonuc = girdi.trim().parse::<u32>();` satırından sonra ne yapılmalı?
options:
  - "`let tahmin = sonuc.expect(\"Sayı yaz!\");` yazmak"
  - "`if sonuc.is_err() { println!(\"Sayı değil\"); continue; }` ile kontrol edip sonra `sonuc.unwrap()` ile sayıyı almak"
  - "`if sonuc.is_err() { println!(\"Sayı değil\"); break; }` yazmak"
  - "`trim`'i bir kez daha çağırmak"
answer: 1
explanation: |
  `continue` döngünün bu turunu bitirip başa, yani yeni bir tahmin istemeye döner. Hata olmadığından emin
  olduktan sonra `unwrap` güvenle sayıyı çıkarır. (`match` ile daha deyimsel bir yazımı Modül 7 ve 10'da
  göreceksin.)
feedback:
  - "`expect` hata durumunda programı mesajla **durdurur**; oyun çöker."
  - Doğru!
  - "`break` döngüyü, dolayısıyla oyunu bitirir. Oyuncu bir harf yazdı diye oyunun bitmesini istemeyiz."
  - "`trim` yalnızca baştaki ve sondaki boşlukları siler; `abc` hiçbir zaman sayıya dönüşmez."
```

````exercise
id: m03-boss-otopark
title: Otopark ücreti
difficulty: 2
prompt: |
  Bir AVM otoparkının ücret tarifesi şöyle:

  - İlk **15 dakika ücretsizdir** (15 dakika dahil).
  - Bunun dışında **başlayan her saat 40 TL**'dir: 16 dakika da 60 dakika da 1 saat sayılır, 61 dakika
    2 saattir.
  - Bir günlük ücret en fazla **250 TL** olabilir (tavan).

  `otopark_ucreti(dakika: u32) -> u32` fonksiyonunu yaz. `dakika` en fazla 1440'tır (bir gün).
starter: |
  fn otopark_ucreti(dakika: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("{} TL", otopark_ucreti(10));
      println!("{} TL", otopark_ucreti(95));
      println!("{} TL", otopark_ucreti(600));
  }
solution: |
  fn otopark_ucreti(dakika: u32) -> u32 {
      if dakika <= 15 {
          return 0;
      }
      let saat = (dakika + 59) / 60;
      let ucret = saat * 40;
      if ucret > 250 { 250 } else { ucret }
  }

  fn main() {
      println!("{} TL", otopark_ucreti(10));
      println!("{} TL", otopark_ucreti(95));
      println!("{} TL", otopark_ucreti(600));
  }
check: tests
tests: |
  #[test]
  fn ilk_on_bes_dakika_ucretsiz() {
      assert_eq!(otopark_ucreti(0), 0, "0 dakika ücretsiz");
      assert_eq!(otopark_ucreti(15), 0, "15 dakika dahil ücretsiz");
  }

  #[test]
  fn baslayan_her_saat_tam_ucret() {
      assert_eq!(otopark_ucreti(16), 40, "16 dakika: başlayan 1 saat → 40 TL");
      assert_eq!(otopark_ucreti(60), 40, "60 dakika tam 1 saattir → 40 TL");
      assert_eq!(otopark_ucreti(61), 80, "61 dakika: 2. saat başladı → 80 TL");
      assert_eq!(otopark_ucreti(125), 120, "125 dakika: 3 saat → 120 TL");
  }

  #[test]
  fn gunluk_tavan() {
      assert_eq!(otopark_ucreti(360), 240, "6 saat → 240 TL, henüz tavanın altında");
      assert_eq!(otopark_ucreti(361), 250, "7 saat 280 TL olurdu, ama tavan 250 TL");
      assert_eq!(otopark_ucreti(1440), 250, "bütün gün → tavan 250 TL");
  }
hints:
  - "Önce ücretsiz durumu bir koruma koşuluyla ayıkla: `if dakika <= 15 { return 0; }`."
  - "\"Başlayan her saat\" demek, dakikayı saate **yukarı** yuvarlamak demek. Tamsayı bölmesi aşağı yuvarlar; `(dakika + 59) / 60` ise yukarı yuvarlar: 60 → 1, 61 → 2."
  - "Ücreti hesapla: `let ucret = saat * 40;`. Son ifade tavanı uygulasın: `if ucret > 250 { 250 } else { ucret }`."
explanation: |
  Çözüm üç adımlı bir hikâye: koruma koşulu (erken dönüş), hesap ve son ifade olarak bir `if`.

  `(dakika + 59) / 60` hilesi neden çalışır? Tamsayı bölmesi her zaman aşağı yuvarlar (Modül 2). Bölmeden
  önce `bolen - 1` eklersen, tam bölünmeyen her değer bir üst sayıya geçer: 61 + 59 = 120 → 2, ama
  60 + 59 = 119 → 1. Alternatif: `let mut saat = dakika / 60; if dakika % 60 != 0 { saat += 1; }`.
  Rust'ta bu iş için hazır bir metot da var: `dakika.div_ceil(60)`.

  Tavanı uygulamanın kısa yolu `ucret.min(250)`'dir: İki sayıdan küçük olanı verir. `if ucret > 250 { 250 }
  else { ucret }` ile tamamen aynı işi görür.
````

````exercise
id: m03-boss-kumbara
title: Kumbara hedefi
difficulty: 3
prompt: |
  Elif bisiklet almak için para biriktiriyor. İlk gün kumbaraya `ilk_gun` TL atıyor ve **her gün bir
  önceki günden `artis` TL fazla** atıyor. Örneğin `ilk_gun = 10`, `artis = 5` ise günlük atılanlar
  10, 15, 20, 25... TL olur.

  `hedefe_kac_gun(hedef: u32, ilk_gun: u32, artis: u32) -> u32` fonksiyonunu yaz: Kumbaradaki toplam para
  **kaçıncı günün sonunda ilk kez `hedef`'e ulaşır ya da onu geçer**, onu döndürsün.

  - `hedef` 0 ise hiç gün gerekmez: Cevap 0.
  - `ilk_gun` her zaman en az 1'dir (yani hedefe mutlaka ulaşılır).

  Örnek: `hedefe_kac_gun(26, 10, 5)` → 3 (10 + 15 = 25 yetmez, 10 + 15 + 20 = 45 yeter).
starter: |
  fn hedefe_kac_gun(hedef: u32, ilk_gun: u32, artis: u32) -> u32 {
      todo!()
  }

  fn main() {
      let gun = hedefe_kac_gun(1000, 10, 5);
      println!("Elif bisikleti {gun}. günün sonunda alabilir.");
  }
solution: |
  fn hedefe_kac_gun(hedef: u32, ilk_gun: u32, artis: u32) -> u32 {
      if hedef == 0 {
          return 0;
      }
      let mut gun = 0;
      let mut atilan = ilk_gun;
      let mut toplam = 0;
      loop {
          gun += 1;
          toplam += atilan;
          if toplam >= hedef {
              break gun;
          }
          atilan += artis;
      }
  }

  fn main() {
      let gun = hedefe_kac_gun(1000, 10, 5);
      println!("Elif bisikleti {gun}. günün sonunda alabilir.");
  }
check: tests
tests: |
  #[test]
  fn hedef_sifirsa_gun_gerekmez() {
      assert_eq!(hedefe_kac_gun(0, 10, 5), 0, "hedef 0 TL ise hiç beklemeye gerek yok");
  }

  #[test]
  fn sinirlar() {
      assert_eq!(hedefe_kac_gun(10, 10, 5), 1, "ilk gün atılan 10 TL, 10 TL'lik hedefe tam ulaşır");
      assert_eq!(hedefe_kac_gun(25, 10, 5), 2, "10 + 15 = 25: 2. gün tam ulaşılır");
      assert_eq!(hedefe_kac_gun(26, 10, 5), 3, "10 + 15 = 25 < 26; 3. gün toplam 45 olur");
  }

  #[test]
  fn artis_sifir_olabilir() {
      assert_eq!(hedefe_kac_gun(100, 10, 0), 10, "her gün 10 TL ile 100 TL'ye 10. gün ulaşılır");
      assert_eq!(hedefe_kac_gun(1, 1, 0), 1, "her gün 1 TL ile 1 TL'ye ilk gün ulaşılır");
  }

  #[test]
  fn uzun_birikimler() {
      assert_eq!(hedefe_kac_gun(1000, 10, 5), 19, "10, 15, 20... ile 1000 TL'ye 19. gün ulaşılır (toplam 1045)");
      assert_eq!(hedefe_kac_gun(5000, 1, 1), 100, "1 + 2 + ... + 100 = 5050: 100. gün");
  }
hints:
  - "Kaç gün süreceği belli değil, ama bulduğunda bir değer (gün sayısını) döndürmek istiyorsun: `loop` ve `break deger`. Önce `if hedef == 0 { return 0; }` ile özel durumu ayıkla."
  - "Üç değiştirilebilir değişken tut: `gun` (sayaç), `atilan` (o gün atılan para, `ilk_gun` ile başlar) ve `toplam`. Her turda önce `gun` artır ve `atilan`'ı `toplam`'a ekle, sonra kontrol et."
  - "İskelet: `loop { gun += 1; toplam += atilan; if toplam >= hedef { break gun; } atilan += artis; }`, bu `loop`'u fonksiyonun son ifadesi yap."
explanation: |
  Döngünün bitiş anı ancak gövdenin içinde, toplam hesaplandıktan sonra anlaşılıyor ve sonunda bir değer
  döndürüyoruz: Bu tam bir `loop` + `break gun` işi. `loop` fonksiyonun son ifadesi olduğu için ürettiği
  değer doğrudan dönüş değeri olur.

  Sıralama kritik: `atilan += artis;` satırını kontrolden **önce** yazsaydın ilk gün 10 yerine 15 atılmış
  olurdu (bir-fazla hatası). "Önce bugünü işle, sonra kontrol et, sonra yarına hazırlan" sırası,
  testlerdeki sınır durumlarını (`25` → 2, `26` → 3) doğru verir.

  `hedef == 0` kontrolü neden gerekli? Onsuz döngü en az bir tur döner ve 1 döndürürdü; ama 0 TL'lik bir
  hedef için beklemeye gerek yok. `while toplam < hedef { ... }` ile yazılan bir çözüm bu durumu kendiliğinden
  doğru ele alır, çünkü koşul baştan yanlıştır:

  ```rust
  fn hedefe_kac_gun(hedef: u32, ilk_gun: u32, artis: u32) -> u32 {
      let mut gun = 0;
      let mut atilan = ilk_gun;
      let mut toplam = 0;
      while toplam < hedef {
          toplam += atilan;
          atilan += artis;
          gun += 1;
      }
      gun
  }
  ```
````

````exercise
id: m03-boss-dijital-kok
title: Dijital kök
difficulty: 4
prompt: |
  Bir sayının **dijital kökü**, rakamları toplanarak tek basamaklı bir sayı elde edilene kadar bu işlem
  tekrarlandığında ulaşılan sayıdır:

  9875 → 9 + 8 + 7 + 5 = 29 → 2 + 9 = 11 → 1 + 1 = **2**

  Muhasebeciler eskiden uzun toplamaları bu yöntemle (dokuz sağlaması) kontrol ederdi. İki fonksiyon yaz:

  1. `rakam_toplami(n: u32) -> u32` - `n`'nin rakamlarının toplamını döndürsün. Örnek: `2024` → 8.
     `0` için cevap 0.
  2. `dijital_kok(n: u32) -> u32` - `n` tek basamaklı olana kadar `rakam_toplami`'nı tekrar tekrar
     uygulasın. Tek basamaklı bir sayının (0 dahil) dijital kökü kendisidir. **İçinde `rakam_toplami`'nı
     kullan.**
starter: |
  fn rakam_toplami(n: u32) -> u32 {
      todo!()
  }

  fn dijital_kok(n: u32) -> u32 {
      todo!()
  }

  fn main() {
      println!("2024'ün rakam toplamı: {}", rakam_toplami(2024));
      println!("9875'in dijital kökü: {}", dijital_kok(9875));
  }
solution: |
  fn rakam_toplami(n: u32) -> u32 {
      let mut kalan = n;
      let mut toplam = 0;
      while kalan > 0 {
          toplam += kalan % 10;
          kalan /= 10;
      }
      toplam
  }

  fn dijital_kok(n: u32) -> u32 {
      let mut sayi = n;
      while sayi >= 10 {
          sayi = rakam_toplami(sayi);
      }
      sayi
  }

  fn main() {
      println!("2024'ün rakam toplamı: {}", rakam_toplami(2024));
      println!("9875'in dijital kökü: {}", dijital_kok(9875));
  }
check: tests
tests: |
  #[test]
  fn rakam_toplami_hesaplar() {
      assert_eq!(rakam_toplami(0), 0, "0'ın rakam toplamı 0'dır");
      assert_eq!(rakam_toplami(7), 7, "tek basamaklı sayının rakam toplamı kendisidir");
      assert_eq!(rakam_toplami(2024), 8, "2 + 0 + 2 + 4 = 8");
      assert_eq!(rakam_toplami(9875), 29, "9 + 8 + 7 + 5 = 29");
  }

  #[test]
  fn tek_basamakli_sayilar() {
      assert_eq!(dijital_kok(0), 0, "0'ın dijital kökü 0'dır");
      assert_eq!(dijital_kok(7), 7, "tek basamaklı sayının dijital kökü kendisidir");
  }

  #[test]
  fn birden_cok_tur_gerekenler() {
      assert_eq!(dijital_kok(9875), 2, "9875 → 29 → 11 → 2: üç tur gerekir");
      assert_eq!(dijital_kok(999_999_999), 9, "999999999 → 81 → 9");
      assert_eq!(dijital_kok(4_294_967_295), 3, "u32'nin en büyük değeri: → 57 → 12 → 3");
  }

  #[test]
  fn dokuz_kurali() {
      for n in 1..=1000 {
          let beklenen = 1 + (n - 1) % 9;
          assert_eq!(dijital_kok(n), beklenen, "{n} için dijital kök {beklenen} olmalı");
      }
  }
hints:
  - "`rakam_toplami` için bir sayının son rakamını `n % 10` verir, `n / 10` ise son rakamı atar (2024 → 202). Bu ikisini sayı 0 olana kadar bir `while` döngüsünde tekrarla."
  - "`dijital_kok` için: Sayı 10 ya da daha büyük olduğu sürece (`while sayi >= 10`), onu kendi rakam toplamıyla değiştir: `sayi = rakam_toplami(sayi);`."
  - "Parametreler değişmez; iki fonksiyonda da önce `let mut kalan = n;` gibi bir kopya al ya da parametreyi `mut n: u32` diye tanımla. İki fonksiyon da döngüden sonra noktalı virgülsüz sonucu (`toplam` / `sayi`) döndürmeli."
explanation: |
  Problem iki iç içe tekrardan oluşuyor: Rakamları toplamak bir döngü, bu toplamayı tek basamak kalana
  kadar tekrarlamak başka bir döngü. Bunları tek bir fonksiyonda iç içe iki `while` olarak yazmak mümkün,
  ama iki ayrı fonksiyona bölünce her biri tek bir işi yapan, ayrı ayrı test edilebilen ve okunması kolay
  iki küçük parça elde ediyoruz.

  `rakam_toplami(0)` neden ek bir kontrol gerektirmiyor? `while kalan > 0` koşulu baştan yanlış olduğu
  için döngü hiç çalışmaz ve `toplam` 0 olarak döner. `dijital_kok` da tek basamaklı sayılarda döngüye hiç
  girmez.

  Dokuz kuralı: Testlerdeki son test bir sırrı ele veriyor. Pozitif bir `n` için dijital kök her zaman
  `1 + (n - 1) % 9`'dur, çünkü bir sayı ile rakamları toplamı 9'a bölündüğünde aynı kalanı verir
  (10 = 9 + 1 olduğu için her basamak değeri 9'a göre 1 gibi davranır). Yani döngüsüz bir çözüm de mümkün:

  ```rust
  fn dijital_kok(n: u32) -> u32 {
      if n == 0 { 0 } else { 1 + (n - 1) % 9 }
  }
  ```

  Ama soru `rakam_toplami`'nı kullanmanı istiyordu; matematiksel kısayolu bilmek güzel, döngüyü kurabilmek
  ise bu modülün asıl hedefi.
````
