---
id: m02-boss
title: "Boss: Değişkenler ve Veri Tipleri"
minutes: 35
type: boss
keywords: [boss, let, mut, const, gölgeleme, tamsayı, taşma, f64, bool, char, as, tuple, dizi, tip çıkarımı, parse]
---

Modül 2'nin sonuna geldin! Bu sınavda değişkenleri, sabitleri, gölgelemeyi, sayı tiplerini, taşmayı,
`bool` ve `char`'ı, `as` dönüşümlerini, tuple ve dizileri ve tip çıkarımını bir arada kullanacaksın.
Arada Modül 1'den de birkaç soru var. Geçmek için **%80** gerekiyor.

:::tip Strateji
Her değişkenin yanına kâğıtta **tipini** de yaz: `x: u8 = 200`. Bu modüldeki tuzakların neredeyse
hepsi tiplerden gelir: hangi tip, kaç bit, sığar mı, karışır mı?
:::

## Bölüm 1: Değişkenler, sabitler ve gölgeleme

```compiles
code: |
  fn main() {
      let puan = 0;
      puan += 10;
      println!("{puan}");
  }
answer: false
error: E0384
explanation: |
  `puan += 10` bir **atamadır** (`puan = puan + 10`'un kısası). `puan` `mut` olmadan tanımlandığı için
  değiştirilemez: *cannot assign twice to immutable variable*. Çözüm `let mut puan = 0;`. Bileşik
  atama operatörleri de normal atama gibi `mut` ister.
```

```predict
code: |
  fn main() {
      let kod = "  42 ";
      let kod = kod.trim();
      {
          let kod = kod.len();
          println!("{kod}");
      }
      let kod: u32 = kod.parse().unwrap();
      println!("{}", kod * 2);
  }
options:
  - "2\n84"
  - "5\n84"
  - "2\n4242"
  - Derlenmez, çünkü `kod`'un tipi değişemez
answer: 0
explanation: |
  Her `let kod` **yeni** bir değişkendir (gölgeleme), bu yüzden tip değişebilir. `trim` sonrası
  `kod` = `"42"`. İç bloktaki `kod` bu metnin uzunluğudur: `2`. Blok bitince iç `kod` yok olur ve
  `"42"` metni geri gelir. Sonra metin `u32`'ye çevrilir: `42 * 2 = 84`.

  `5` seçtiysen `trim`'i atladın; `mut` ile tip değiştirmek gerçekten derlenmezdi, ama burada `mut`
  yok, gölgeleme var.
```

```compiles
code: |
  fn main() {
      let oran = 20;
      const KDV_ORANI: u32 = oran;
      println!("{KDV_ORANI}");
  }
answer: false
error: E0435
explanation: |
  `const`'un değeri **derleme zamanında** bilinmelidir; `oran` ise bir `let` değişkenidir ve programın
  çalışması sırasında var olur: *attempt to use a non-constant value in a constant*. Çözüm:
  `const KDV_ORANI: u32 = 20;` (sabitler genellikle `main`'in dışında, dosyanın başında tanımlanır).
```

```predict
question: "Modül 1'den: Bu program ne yazdırır?"
code: |
  fn main() {
      println!("[{:>5}] [{:<5}] [{:^5}]", 42, "ab", 'x');
      println!("[{:.2}] [{:06.1}]", 9.87654, 2.5);
  }
options:
  - "[   42] [ab   ] [  x  ]\n[9.88] [0002.5]"
  - "[42   ] [   ab] [  x  ]\n[9.88] [0002.5]"
  - "[   42] [ab   ] [  x  ]\n[9.87654] [2.5]"
  - "[   42] [ab   ] [ x   ]\n[9.87] [002.50]"
answer: 0
explanation: |
  `>` sağa, `<` sola, `^` ortaya hizalar; `5` toplam genişliktir. `{:.2}` virgülden sonra 2 basamak
  yazar ve **yuvarlar**, kesmez: `9.87654` → `9.88`. `{:06.1}` ise "toplam 6 karakter, başı sıfırla
  dolu, virgülden sonra 1 basamak" demektir: `2.5` üç karakter, başına üç sıfır eklenir: `0002.5`.
```

## Bölüm 2: Sayılar, bool, char ve dönüşümler

```predict
code: |
  fn main() {
      let x: u8 = 200;
      println!("{:?}", x.checked_add(100));
      println!("{}", x.saturating_add(100));
      println!("{}", x.wrapping_add(100));
      println!("{} {}", -7 / 2, -7 % 2);
  }
options:
  - "None\n255\n44\n-3 -1"
  - "Some(300)\n255\n44\n-4 1"
  - "None\n255\n0\n-3 -1"
  - "None\n44\n255\n-3 1"
answer: 0
explanation: |
  `200 + 100 = 300` bir `u8`'e sığmaz: `checked_add` → `None`, `saturating_add` → sınırda `255`,
  `wrapping_add` → `300 - 256 = 44`. Tamsayı bölmesi sıfıra doğru keser (`-3`) ve kalanın işareti
  bölünenle aynıdır (`-1`). `-4 1` Python'un cevabı olurdu.
```

```predict
code: |
  fn main() {
      let a = 256_u32 as u8;
      let b = -1.9_f64 as i32;
      let c = 'a' as u8 + 1;
      let d = c as char;
      println!("{a} {b} {c} {d}");
  }
options:
  - "0 -1 98 b"
  - "255 -2 98 b"
  - "0 -2 97 a"
  - "255 -1 98 b"
answer: 0
explanation: |
  - `256` = `1_0000_0000` (ikilik). `as u8` yalnızca son 8 biti alır: `0`. (Sınırda durma, `as`'ın
    **ondalıktan** tamsayıya dönüşümünde olur, tamsayıdan tamsayıya değil.)
  - `-1.9 as i32` ondalığı atar (sıfıra doğru): `-1`.
  - `'a'` 97'dir, `+ 1` → `98`; `98_u8 as char` → `'b'`.
```

```quiz
question: "`char` tipi hakkında hangisi **doğrudur**?"
options:
  - "`'ş'` bir `char` değişkeninde 2 bayt, `'A'` 1 bayt yer kaplar"
  - "Her `char` 4 bayttır ve tek bir Unicode skaler değeri tutar; `'🇹🇷'` iki değerden oluştuğu için bir `char` olamaz"
  - "`'🦀'` gibi emojiler `char`'a sığmaz; onlar için `\"🦀\"` yazmak zorunludur"
  - "`\"a\"` ile `'a'` aynı tiptir; tırnak türü yalnızca bir yazım tercihidir"
answer: 1
explanation: |
  Rust'ın `char`'ı sabit **4 bayttır** ve tek bir Unicode skaler değeri tutar; `'ş'` (351) de `'🦀'`
  (129408) de tek bir değerdir ve sığar. Bayrak emojisi ise iki "bölgesel gösterge" değerinin
  birleşimidir, bu yüzden `'🇹🇷'` derlenmez. Değişken boyutlu olan, karakterlerin bir **metnin içindeki**
  UTF-8 hâlidir (`"şey".len()` → 4).
feedback:
  - "Bu, karakterlerin bir metin içindeki UTF-8 boyutu. Bir `char` değişkeni ise her zaman 4 bayttır."
  - Doğru!
  - "`'🦀'` tek bir Unicode skaler değeridir (129408) ve bir `char`'a rahatça sığar."
  - "`'a'` bir `char`, `\"a\"` ise bir metindir (`&str`); ikisi farklı tiplerdir."
```

```compiles
code: |
  fn main() {
      let toplam: u32 = 250;
      let adet: u32 = 4;
      let ortalama: f64 = toplam / adet;
      println!("{ortalama}");
  }
answer: false
error: E0308
explanation: |
  `toplam / adet` iki `u32`'nin bölmesidir; sonucu da `u32`'dir (`62`, ondalık kısım atılır). Bir `u32`
  bir `f64` değişkenine atanamaz: *expected `f64`, found `u32`*. Doğrusu, bölmeden **önce** iki değeri
  de çevirmek: `toplam as f64 / adet as f64` → `62.5`. `(toplam / adet) as f64` derlenir ama `62.0`
  verir; ondalık kısım çoktan kaybolmuştur.
```

```quiz
question: |
  `let ogrenci = 0;` iken `let basarili = ogrenci > 0 && 100 / ogrenci > 5;` satırı çalışınca ne olur?
options:
  - "Sıfıra bölme paniği olur"
  - "`basarili` `false` olur; bölme hiç yapılmaz"
  - "`basarili` `true` olur"
  - Derlenmez, çünkü `&&`'nin iki yanı farklı tipte
answer: 1
explanation: |
  `&&` **kısa devre** yapar: sol taraf (`0 > 0`) `false` olduğu için sonuç zaten `false`'tur ve sağ
  taraftaki bölme hiç hesaplanmaz. Bu yüzden sıfıra bölme paniği oluşmaz. Koşulların sırası önemlidir:
  önce güvenlik kontrolü, sonra tehlikeli işlem.
feedback:
  - Bölme yapılsaydı panik olurdu; ama `&&` sol taraf `false` iken sağ tarafa hiç bakmaz.
  - Doğru!
  - "`0 > 0` yanlıştır; `false && ...` her zaman `false`."
  - İki taraf da `bool` üretir (`ogrenci > 0` ve `100 / ogrenci > 5`), tipler uyumludur.
```

```quiz
question: "Modül 1 ve Ders 3'ten: Aşağıdaki komutların hangisiyle derlenen programda tamsayı taşması **panik yerine başa sarar**?"
options:
  - "`cargo run`"
  - "`cargo build`"
  - "`cargo run --release`"
  - "`cargo check`"
answer: 2
explanation: |
  `--release` hız için optimize edilmiş derlemedir ve taşma kontrolleri varsayılan olarak **kapalıdır**:
  `255u8 + 1` → `0`. `cargo run` ve `cargo build` debug derlemesi yapar; taşmada panik olur.
  `cargo check` ise programı hiç çalıştırmaz, yalnızca derlenip derlenmediğini kontrol eder.
feedback:
  - "`cargo run` debug modunda derler; taşma kontrolleri açıktır ve panik olur."
  - "`cargo build` da debug derlemesidir."
  - Doğru!
  - "`cargo check` çalıştırılabilir bir program üretmez; yalnızca hataları kontrol eder."
```

## Bölüm 3: Tuple, dizi ve tip çıkarımı

```predict
code: |
  fn main() {
      let skorlar = [40, 75, 90];
      let mut yedek = skorlar;
      yedek[0] += 10;
      let (ilk, son) = (skorlar[0], yedek[0]);
      let bilgi = (skorlar.len(), son - ilk);
      println!("{ilk} {son} {bilgi:?}");
  }
options:
  - "40 50 (3, 10)"
  - "50 50 (3, 0)"
  - "40 50 (2, 10)"
  - "40 40 (3, 0)"
answer: 0
explanation: |
  `let mut yedek = skorlar;` diziyi **kopyalar**; `yedek[0] += 10` yalnızca kopyayı değiştirir:
  `skorlar[0]` hâlâ `40`, `yedek[0]` `50`. `.len()` eleman sayısıdır (`3`, son indeks değil).
  `bilgi` bir tuple'dır: `(3, 10)`; `{:?}` ile yazdırılır.
```

```compiles
code: |
  fn main() {
      let notlar = [70, 85, 90];
      let i = 2;
      println!("{}", notlar[i]);
  }
answer: true
explanation: |
  Derlenir ve `90` yazdırır. `i` için tip yazılmadı; varsayılan `i32` olacağını düşünebilirsin. Ama
  **tip çıkarımı** `i`'nin bir dizi indeksi olarak kullanıldığını görür ve onu `usize` yapar. Hata
  yalnızca `let i: i32 = 2;` gibi tipi açıkça başka bir şey yaparsan çıkar.
```

```fill
prompt: Formdan gelen `" 1.80 "` metnini temizleyip `f64`'e çevir. Birinci boşlukta metodu, ikincide turbofish ile tipi yaz.
code: |
  fn main() {
      let boy_metni = " 1.80 ";
      let boy = boy_metni.___0().parse::<___1>().unwrap();
      let boy_cm = (boy * 100.0).round() as u32;
      println!("Boyun {boy_cm} cm.");
  }
blanks:
  - ["trim"]
  - ["f64", "f32"]
output: Boyun 180 cm.
explanation: |
  `trim` baştaki ve sondaki boşlukları atar; atmasaydın `parse` `Err` döndürür ve `unwrap` panik
  yapardı. `parse::<f64>()` hedef tipi doğrudan metoda söyler. `round()` çağrısı da önemli: kayan nokta
  hataları yüzünden böyle çarpımlar bazen tam sayının hemen altında kalır (örneğin `1.13 * 100.0`
  sonucu `112.99999999999999`'dur). `as u32` ondalığı **keseceği** için önce yuvarlamak, `112` gibi
  bir hatalı sonuç yerine doğru tamsayıyı almanı garanti eder.
```

````quiz
question: |
  Aşağıdaki programın derlenmesi için **en az** hangi değişiklik gerekir?

  ```rust
  fn main() {
      let adet = "12".parse().unwrap();
      let fiyat: u32 = 15;
      println!("{}", adet * fiyat);
  }
  ```
options:
  - "Değişiklik gerekmez; `adet * fiyat` satırından `adet`'in `u32` olduğu çıkarılır"
  - "`adet`'e tip yazmak: `let adet: u32 = \"12\".parse().unwrap();`"
  - "`fiyat`'ın tipini silmek"
  - "`unwrap` yerine `expect` kullanmak"
answer: 1
explanation: |
  `parse` hangi tipe çevireceğini bilmek zorundadır ve sonraki satırdaki `adet * fiyat` çarpması bu
  kararı vermek için yeterli değildir: `*` birden fazla tip çifti için tanımlı olduğundan derleyici
  `adet`'in tipini bu işlemden kesin olarak çıkaramaz. Derleyici `E0284: type annotations needed` der.
  Anotasyon (`let adet: u32`) ya da turbofish (`"12".parse::<u32>()`) sorunu çözer.
feedback:
  - "Çıkarım sonraki satırlara bakar ve `let k: u32 = adet;` gibi bir atama yeterli olurdu; ama bir **işlem** (`adet * fiyat`) tek bir tip belirlemez. Bu program `E0284` verir."
  - Doğru!
  - "`fiyat`'ın tipi sorun değil; sorun `parse`'ın hedef tipinin belli olmaması."
  - "`expect` yalnızca panik mesajını değiştirir; tip sorununu çözmez."
````

## Bölüm 4: Alıştırmalar

````exercise
id: m02-boss-e-termometre
title: Dijital termometre
difficulty: 2
prompt: |
  Bir hava durumu uygulaması sıcaklığı santigrat (°C) olarak ölçüyor ama Amerikalı kullanıcılar için
  fahrenhayt (°F) göstermesi gerekiyor. Ekranda yalnızca **tam sayı** gösterilecek.

  `fahrenhayt(santigrat)` fonksiyonunu tamamla: `F = C × 9 / 5 + 32` formülünü kullan ve sonucu **en
  yakın tamsayıya yuvarlayarak** `i32` döndür.

  - `fahrenhayt(100.0)` → `212`
  - `fahrenhayt(36.6)` → `98` (97,88 → 98)
starter: |
  fn fahrenhayt(santigrat: f64) -> i32 {
      todo!()
  }

  fn main() {
      println!("Vücut sıcaklığı: {} °F", fahrenhayt(36.6));
  }
solution: |
  fn fahrenhayt(santigrat: f64) -> i32 {
      (santigrat * 9.0 / 5.0 + 32.0).round() as i32
  }

  fn main() {
      println!("Vücut sıcaklığı: {} °F", fahrenhayt(36.6));
  }
check: tests
tests: |
  #[test]
  fn kaynama_ve_donma_noktasi() {
      assert_eq!(fahrenhayt(100.0), 212, "suyun kaynama noktası 212 °F");
      assert_eq!(fahrenhayt(0.0), 32, "suyun donma noktası 32 °F");
  }

  #[test]
  fn negatif_sicakliklar() {
      assert_eq!(fahrenhayt(-40.0), -40, "-40 derecede iki ölçek eşittir");
      assert_eq!(fahrenhayt(-17.9), 0, "-17,9 °C = -0,22 °F → 0'a yuvarlanmalı");
  }

  #[test]
  fn yuvarlama_kesme_degil() {
      assert_eq!(fahrenhayt(36.6), 98, "36,6 °C = 97,88 °F → 98'e yuvarlanmalı (kesilirse 97 olur)");
      assert_eq!(fahrenhayt(21.4), 71, "21,4 °C = 70,52 °F → 71'e yuvarlanmalı");
  }
hints:
  - "Formüldeki bütün sayıları ondalıklı yaz: `9.0`, `5.0`, `32.0`. `f64` ile tamsayı karıştırılamaz."
  - "`as i32` ondalık kısmı **keser**, yuvarlamaz. Önce `.round()` çağır."
  - "`(santigrat * 9.0 / 5.0 + 32.0).round() as i32`"
explanation: |
  Formül ondalıklı yapılır, çünkü `santigrat` bir `f64`'tür ve Rust tamsayı ile ondalığı karıştırmaz.
  Sonra `.round()` en yakın tama yuvarlar ve `as i32` onu tamsayıya çevirir. Sadece `as i32` deseydin
  `97.88` → `97` olurdu: `as` ondalık kısmı atar. Negatif sayılarda da aynı mantık:
  `(-0.22_f64).round()` → `-0.0` → `as i32` ile `0`.
````

````exercise
id: m02-boss-e-adim-sayaci
title: Haftalık adım sayacı
difficulty: 3
prompt: |
  Bir akıllı saat, pazartesiden pazara günlük adım sayılarını `[u32; 7]` dizisinde tutuyor
  (indeks 0 pazartesi, 6 pazar). `hafta_ozeti(adimlar)` fonksiyonunu tamamla; bir **tuple** döndürsün:

  1. hafta içi (pazartesi-cuma) toplam adım (`u32`)
  2. hafta sonu (cumartesi-pazar) toplam adım (`u32`)
  3. haftanın **günlük ortalaması** (`f64`, yuvarlama yok)

  Örnek: `[8000, 6500, 7000, 9000, 5500, 12000, 3000]` → `(36000, 15000, 7285.714...)`
starter: |
  fn hafta_ozeti(adimlar: [u32; 7]) -> (u32, u32, f64) {
      todo!()
  }

  fn main() {
      let adimlar = [8000, 6500, 7000, 9000, 5500, 12000, 3000];
      let (hafta_ici, hafta_sonu, ortalama) = hafta_ozeti(adimlar);
      println!("Hafta içi: {hafta_ici}, hafta sonu: {hafta_sonu}, ortalama: {ortalama:.0}");
  }
solution: |
  fn hafta_ozeti(adimlar: [u32; 7]) -> (u32, u32, f64) {
      let hafta_ici = adimlar[0] + adimlar[1] + adimlar[2] + adimlar[3] + adimlar[4];
      let hafta_sonu = adimlar[5] + adimlar[6];
      let ortalama = (hafta_ici + hafta_sonu) as f64 / adimlar.len() as f64;
      (hafta_ici, hafta_sonu, ortalama)
  }

  fn main() {
      let adimlar = [8000, 6500, 7000, 9000, 5500, 12000, 3000];
      let (hafta_ici, hafta_sonu, ortalama) = hafta_ozeti(adimlar);
      println!("Hafta içi: {hafta_ici}, hafta sonu: {hafta_sonu}, ortalama: {ortalama:.0}");
  }
check: tests
tests: |
  #[test]
  fn ornek_hafta() {
      let (ici, sonu, ort) = hafta_ozeti([8000, 6500, 7000, 9000, 5500, 12000, 3000]);
      assert_eq!(ici, 36000, "hafta içi toplamı: 8000 + 6500 + 7000 + 9000 + 5500");
      assert_eq!(sonu, 15000, "hafta sonu toplamı: 12000 + 3000");
      assert!((ort - 51000.0 / 7.0).abs() < 1e-9, "ortalama 51000 / 7 ≈ 7285,71 olmalı, {ort} bulundu");
  }

  #[test]
  fn gunler_dogru_ayrilir() {
      let (ici, sonu, _) = hafta_ozeti([1, 2, 3, 4, 5, 100, 200]);
      assert_eq!(ici, 15, "indeks 0-4 hafta içidir: 1 + 2 + 3 + 4 + 5");
      assert_eq!(sonu, 300, "indeks 5 ve 6 hafta sonudur: 100 + 200");
  }

  #[test]
  fn ortalama_ondalikli_kalir() {
      let (_, _, ort) = hafta_ozeti([1, 1, 1, 1, 1, 1, 2]);
      assert!((ort - 8.0 / 7.0).abs() < 1e-9, "8 / 7 ≈ 1,142857 olmalı; tamsayı bölmesi yapılırsa 1 çıkar. {ort} bulundu");
  }

  #[test]
  fn hareketsiz_hafta() {
      let (ici, sonu, ort) = hafta_ozeti([0; 7]);
      assert_eq!((ici, sonu), (0, 0), "hiç adım yoksa toplamlar 0 olmalı");
      assert!(ort.abs() < 1e-9, "hiç adım yoksa ortalama 0 olmalı");
  }
hints:
  - "Pazartesi-cuma indeksleri 0, 1, 2, 3, 4; cumartesi 5, pazar 6."
  - "Ortalamayı tamsayıyla hesaplarsan ondalık kaybolur. Toplamı ve gün sayısını önce `as f64` ile çevir."
  - "`let ortalama = (hafta_ici + hafta_sonu) as f64 / 7.0;` ve son satırda `(hafta_ici, hafta_sonu, ortalama)` döndür."
explanation: |
  Döngüleri henüz öğrenmediğimiz için toplamları indekslerle açıkça yazdık; Modül 3'te `for` ile bunu
  tek satırda yapacaksın. Ortalamada `as f64` dönüşümü **bölmeden önce** yapılmalı; yoksa `8 / 7 = 1`
  tamsayı bölmesi ondalığı yutar. Gün sayısı için `7.0` yerine `adimlar.len() as f64` yazmak, dizinin
  boyutu değişirse kodun da doğru kalmasını sağlar. Sonucu bir tuple olarak döndürmek, `main`'de onu
  hemen parçalara ayırmamızı (`let (hafta_ici, hafta_sonu, ortalama) = ...`) mümkün kıldı.
````

````exercise
id: m02-boss-e-kumbara
title: Kumbara sayımı
difficulty: 4
prompt: |
  Bir kumbara sayma makinesi, içindeki madeni paraların **adetlerini** bir web formuna metin olarak
  gönderiyor. Dizinin sırası sabit: `[1 TL, 50 kuruş, 25 kuruş, 10 kuruş]`. Metinlerin başında ve
  sonunda boşluk olabilir.

  `kumbara_say(adetler)` fonksiyonunu tamamla: toplam parayı `(TL, kuruş)` tuple'ı olarak döndürsün.
  Örnek: `["3", " 4", "2 ", "5"]` → 300 + 200 + 50 + 50 = 600 kuruş → `(6, 0)`.

  - Adet metni çevrilemezse program `adet bir tamsayı olmalı` mesajıyla panik yapmalı.
  - Bu makine bankalar için de kullanılıyor: adetler **milyarları** bulabilir. Tipini dikkatli seç!
starter: |
  fn kumbara_say(adetler: [&str; 4]) -> (u64, u64) {
      todo!()
  }

  fn main() {
      let (tl, kurus) = kumbara_say(["3", " 4", "2 ", "7"]);
      println!("Kumbarada {tl} TL {kurus} kuruş var.");
  }
solution: |
  const DEGERLER_KURUS: [u64; 4] = [100, 50, 25, 10];

  fn kumbara_say(adetler: [&str; 4]) -> (u64, u64) {
      let bir_tl: u64 = adetler[0].trim().parse().expect("adet bir tamsayı olmalı");
      let elli: u64 = adetler[1].trim().parse().expect("adet bir tamsayı olmalı");
      let yirmi_bes: u64 = adetler[2].trim().parse().expect("adet bir tamsayı olmalı");
      let on: u64 = adetler[3].trim().parse().expect("adet bir tamsayı olmalı");
      let toplam_kurus = bir_tl * DEGERLER_KURUS[0]
          + elli * DEGERLER_KURUS[1]
          + yirmi_bes * DEGERLER_KURUS[2]
          + on * DEGERLER_KURUS[3];
      (toplam_kurus / 100, toplam_kurus % 100)
  }

  fn main() {
      let (tl, kurus) = kumbara_say(["3", " 4", "2 ", "7"]);
      println!("Kumbarada {tl} TL {kurus} kuruş var.");
  }
check: tests
tests: |
  #[test]
  fn tam_tl_eder() {
      assert_eq!(kumbara_say(["3", " 4", "2 ", "5"]), (6, 0), "300 + 200 + 50 + 50 = 600 kuruş = 6 TL 0 kuruş");
  }

  #[test]
  fn kuruslu_toplam() {
      assert_eq!(kumbara_say(["1", "1", "1", "1"]), (1, 85), "100 + 50 + 25 + 10 = 185 kuruş = 1 TL 85 kuruş");
      assert_eq!(kumbara_say(["  12 ", "0", "3", "7"]), (13, 45), "1200 + 0 + 75 + 70 = 1345 kuruş = 13 TL 45 kuruş");
  }

  #[test]
  fn bos_kumbara() {
      assert_eq!(kumbara_say(["0", "0", "0", "0"]), (0, 0), "boş kumbarada 0 TL 0 kuruş olmalı");
  }

  #[test]
  fn milyarlarca_para_tasmaz() {
      assert_eq!(
          kumbara_say(["5000000000", "0", "0", "3"]),
          (5_000_000_000, 30),
          "5 milyar adet bir u32'ye sığmaz; adetleri u64 olarak çevir"
      );
  }

  #[test]
  #[should_panic(expected = "adet bir tamsayı olmalı")]
  fn gecersiz_adet_panik() {
      kumbara_say(["3", "dört", "2", "5"]);
  }
hints:
  - "Her adet için: `adetler[0].trim().parse().expect(\"adet bir tamsayı olmalı\")`. Hedef tipi anotasyonla söyle."
  - "5 milyar bir `u32`'ye sığmaz (sınırı ≈ 4,29 milyar). Adetleri ve toplamı `u64` tut. Para değerlerini kuruş cinsinden yaz: 100, 50, 25, 10."
  - "Toplam kuruşu bulduktan sonra `(toplam_kurus / 100, toplam_kurus % 100)` döndür."
require:
  - pattern: "trim"
    message: Metinlerdeki boşlukları `trim` ile temizlemelisin.
  - pattern: "expect"
    message: Geçersiz adette açıklayıcı bir panik için `expect` kullanmalısın.
explanation: |
  Bu alıştırma modülün bütün parçalarını birleştiriyor:

  - **Dizi indeksleme** (Ders 5): dört adet `adetler[0]`...`adetler[3]` ile okunuyor; para değerleri de
    bir `const` dizide (`DEGERLER_KURUS`) duruyor, böylece "sihirli sayılar" kodun içine dağılmıyor.
  - **`trim` + `parse` + anotasyon + `expect`** (Ders 2 ve 6): her metin temizlenip `u64`'e çevriliyor.
  - **Tip seçimi** (Ders 3): `u32` seçseydin `"5000000000"` hiç çevrilemezdi (`PosOverflow`) ve
    `expect` panik yapardı; `u64` 18 kentilyona kadar gider.
  - **Para tamsayıda** (Ders 4): bütün hesap kuruş cinsinden; ondalık sayı ve yuvarlama hatası yok.
  - **Bölme ve kalan** (Ders 3) ile **tuple dönüşü** (Ders 5): `toplam / 100` TL'yi, `toplam % 100`
    kuruşu veriyor.

  Dört neredeyse aynı satır biraz tekrar gibi görünüyor, değil mi? Modül 3'teki döngülerle bunu tek bir
  `for` ile yazabileceksin; Modül 14'teki iterator'larla ise tek bir zincirle.
````
