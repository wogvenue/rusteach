---
id: m04-boss
title: "Boss: Sahiplik"
minutes: 35
type: boss
keywords: [boss, sahiplik, stack, heap, drop, taşıma, move, clone, Copy, fonksiyon, E0382]
---

Modül 4'ün sonuna geldin! Bu sınavda stack ve heap'i, sahiplik kurallarını, taşımayı, `clone` ile
`Copy`'yi ve sahipliğin fonksiyonlar arasında nasıl dolaştığını bir arada kullanacaksın. Arada Modül 2 ve
3'ten de birkaç soru çıkacak. Geçmek için **%80** gerekiyor.

:::tip Strateji
Her sorudan önce kendine üç şey sor: **Bu değerin sahibi kim? Bu satırda sahiplik nereye gidiyor? Sahibin
kapsamı nerede bitiyor?** Kafanda (ya da kâğıtta) küçük bir bellek diyagramı çiz: stack'te kimin başlığı
var, heap'te kimin verisi var, hangi değişken "taşındı" diye gri?
:::

## Bölüm 1: Bellek, kurallar ve drop

```quiz
question: |
  Bir C programı bir döngüde her turda `malloc` ile 1 KB bellek ayırıyor, kullanıyor ve tur bitince
  işaretçiyi bir sonraki tur için yeniden kullanıyor; hiçbir yerde `free` çağırmıyor. Bu hangi hatadır?
options:
  - Double free
  - Use-after-free
  - Bellek sızıntısı (memory leak)
  - Stack taşması (stack overflow)
answer: 2
explanation: |
  Her tur yeni bir heap alanı ayrılıyor ama hiçbiri geri verilmiyor; işaretçinin üzerine yeni adres
  yazılınca eski alana ulaşmanın yolu da kayboluyor. Program çalıştıkça bellek tüketimi büyür: sızıntı.
  Rust'ta bu senaryo kendiliğinden çözülür: döngü içinde oluşturulan bir `String`, sahibinin kapsamı her
  turun sonunda bittiği için her turda drop edilir.
feedback:
  - Double free için aynı alanın iki kez `free` edilmesi gerekirdi; burada hiç `free` yok.
  - Use-after-free, geri verilmiş belleğe erişmektir; burada bellek hiç geri verilmiyor.
  - Doğru! Ayrılan ama hiç geri verilmeyen bellek, sızıntıdır.
  - Stack taşması çok derin çağrı zincirlerinden doğar; `malloc` heap'ten ayırır.
```

```quiz
question: |
  64-bit bir sistemde `kisa` tek harflik, `roman` ise yaklaşık 1 MB'lık bir metin tutan iki `String`
  değişkeni var. İkisinin **stack'te** kapladığı yer için hangisi doğrudur?
options:
  - İkisi de 24 bayt; metnin kendisi heap'te durur ve bu sayıya dahil değildir
  - "`kisa` 1 bayt, `roman` yaklaşık 1 MB"
  - "`kisa` 25 bayt (24 + 1), `roman` yaklaşık 1 MB + 24 bayt"
  - İkisi de 0 bayt; bir `String` tamamen heap'te yaşar
answer: 0
explanation: |
  Bir `String`'in stack'teki kısmı sabit boyutlu bir **başlıktır**: işaretçi, uzunluk ve kapasite (3 × 8 =
  24 bayt). Karakterler heap'tedir; başlık yalnızca onları gösterir. Bu yüzden `size_of::<String>()` her
  `String` için 24'tür ve metin büyüdükçe değişen yalnızca heap'teki kısımdır.
feedback:
  - Doğru! Sabit boyutlu başlık stack'te, değişken boyutlu veri heap'te.
  - Metnin baytları stack'te durmaz; boyutu derleme zamanında bilinmeyen veri heap'e gider.
  - Başlığın boyutu metnin uzunluğundan bağımsızdır; baytlar başlığın içinde değil, heap'tedir.
  - "Değişkenin kendisi (başlık) stack'te, `main`'in çerçevesinde yaşar; heap'te yalnızca karakterler var."
```

```predict
question: Bu program ne yazdırır? (`Balon`, drop edildiğinde `... balon patladı` yazar.)
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  # #[allow(unused_assignments)]
  fn main() {
      let _a = Balon("kırmızı");
      let mut b = Balon("mavi");
      {
          let _c = Balon("yeşil");
          b = Balon("sarı");
          println!("iç blok bitiyor");
      }
      let _b = b;
      println!("main bitiyor");
  }
options:
  - |
    mavi balon patladı
    iç blok bitiyor
    yeşil balon patladı
    main bitiyor
    sarı balon patladı
    kırmızı balon patladı
  - |
    iç blok bitiyor
    yeşil balon patladı
    main bitiyor
    sarı balon patladı
    kırmızı balon patladı
    mavi balon patladı
  - |
    mavi balon patladı
    iç blok bitiyor
    yeşil balon patladı
    main bitiyor
    kırmızı balon patladı
    sarı balon patladı
answer: 0
explanation: |
  Adım adım: `b = Balon("sarı");` bir **yeniden atamadır**; eski değer (mavi) o anda sahipsiz kalır ve
  **hemen** patlar. İç bloğun `}`'sinde `_c` (yeşil) patlar. `let _b = b;` sarı balonu `_b`'ye taşır;
  artık `b` hiçbir şeyin sahibi değil. `main`'in sonunda kapsamdaki sahipler tanımlanma sırasının
  **tersiyle** drop edilir: önce `_b` (sarı), sonra `_a` (kırmızı). `b` taşınmış olduğu için onun için
  drop yapılmaz.
feedback:
  - Doğru! Yeniden atama, kapsam sonu, taşıma ve ters sıra, hepsini doğru izledin.
  - "Yeniden atama (`b = ...`) eski değeri **atama anında** drop eder; mavi balon kapsam sonunu beklemez."
  - "Ters sıra kuralı: `_b`, `_a`'dan **sonra** tanımlandı, bu yüzden önce o drop edilir."
```

```compiles
code: |
  fn main() {
      let mut durum = "hazırlanıyor";
      println!("{durum}");
      durum = "yolda";
      println!("{durum}");
  }
answer: true
explanation: |
  Derlenir. `durum` bir string literali (`&str`) ve `mut`: değişkeni **başka bir literale**
  yönlendirebilirsin. Değiştirilemeyen şey, programın içine gömülü baytların kendisidir; onları
  büyütmek için (`push_str`) bir `String` gerekirdi (`E0599`).
```

## Bölüm 2: Taşıma

```compiles
code: |
  fn main() {
      let siparisler = vec![3, 1, 4];
      for gun in 1..=2 {
          let arsiv = siparisler;
          println!("{gun}. gün: {} sipariş arşivlendi", arsiv.len());
      }
  }
answer: false
error: E0382
explanation: |
  `Vec` de heap verisine sahip olduğu için `String` gibi **taşınır**. İlk turda `siparisler`, `arsiv`'e
  taşınır ve tur sonunda drop edilir; ikinci turda taşınacak bir değer kalmamıştır. Derleyici bunu
  `value moved here, in previous iteration of loop` diye anlatır.
```

```predict
question: Bu program ne yazdırır?
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  fn main() {
      let mut kutu = Balon("sarı");
      let yeni = kutu;
      kutu = Balon("mavi");
      println!("kutuda {}, yenide {}", kutu.0, yeni.0);
  }
options:
  - |
    sarı balon patladı
    kutuda mavi, yenide sarı
    mavi balon patladı
  - |
    kutuda mavi, yenide sarı
    sarı balon patladı
    mavi balon patladı
  - |
    kutuda mavi, yenide sarı
    mavi balon patladı
    sarı balon patladı
answer: 1
explanation: |
  `let yeni = kutu;` sarı balonu `yeni`'ye taşır; `kutu` artık boştur. `kutu = Balon("mavi");` boş bir
  değişkene değer koyar, bu yüzden **hiçbir şey drop edilmez** (eski değer zaten `yeni`'deydi). `main`'in
  sonunda ters tanımlanma sırası geçerli: `yeni` (sarı) `kutu`'dan sonra tanımlandığı için önce o, sonra
  `kutu` (mavi) patlar. (`kutu.0`, balonun içindeki metne ulaşır; Ders 5'teki gibi.)
feedback:
  - "Taşınmış bir değişkene atama yapmak drop **etmez**: sarı balon `yeni`'nin elinde güvende."
  - Doğru! Taşınmış değişkene atama drop etmez; kapsam sonunda ters sıra uygulanır.
  - "Ters sıra, değişkenlerin **tanımlanma** sırasına göredir: `kutu` önce, `yeni` sonra tanımlandı. Önce `yeni` drop edilir."
```

```quiz
question: |
  Bir derleme `E0382: borrow of moved value: rapor` verdi. Hata, `rapor` bir fonksiyona taşındıktan
  sonra yalnızca `rapor.len()` ile uzunluğunu yazdırmaya çalışan satırı gösteriyor. En iyi düzeltme hangisi?
options:
  - "Fonksiyon çağrısını `fonksiyon(rapor.clone())` yapmak"
  - "Uzunluğu fonksiyon çağrısından **önce** bir değişkene almak: `let n = rapor.len();`"
  - "`rapor`'u `let mut rapor` olarak tanımlamak"
  - "Fonksiyon çağrısını tamamen silmek"
answer: 1
explanation: |
  İhtiyacın olan tek şey bir sayı. Onu taşımadan önce ölçersen (`usize` `Copy`'dir) hiçbir kopya
  gerekmez. `clone` derlenir ama yalnızca bir uzunluk için bütün raporu heap'te kopyalar. `mut` taşımayla
  ilgili değildir; çağrıyı silmek ise programın işini bozar.
feedback:
  - "Derlenir ama gereksiz bir heap kopyası: sadece bir sayı için bütün metni kopyalıyorsun."
  - Doğru! İşini taşımadan önce bitir.
  - "`mut` değiştirilebilirlikle ilgilidir; taşınmış bir değeri okumana izin vermez."
  - Programın gereken işini silmek bir düzeltme değildir.
```

## Bölüm 3: Clone ve Copy

```quiz
question: Aşağıdaki tiplerden hangileri `Copy`'dir? (Birden fazla seçenek doğru olabilir.)
options:
  - "`[bool; 8]`"
  - "`(char, f32)`"
  - "`(i32, String)`"
  - "`&'static str` (string literali)"
answer: [0, 1, 3]
explanation: |
  `bool`, `char` ve `f32` heap'te hiçbir şeye sahip olmadığı için onlardan oluşan diziler ve tuple'lar da
  `Copy`'dir. String literalleri de `Copy`'dir: kopyalanan sadece programın içindeki baytları gösteren
  işaretçi ve uzunluktur. Tek bir `String` eleman ise tuple'ı `Copy` olmaktan çıkarır.
feedback:
  - "Doğru: elemanları `Copy` olan sabit boyutlu bir dizi."
  - "Doğru: iki eleman da `Copy`."
  - "`String` drop edildiğinde heap belleğini geri verir; bu yüzden onu içeren tuple taşınır."
  - "Doğru: string literalini kopyalamak baytları kopyalamaz, sadece onları gösteren küçük başlığı kopyalar."
```

```predict
code: |
  fn main() {
      let mut sepet = vec![10, 20];
      let yedek = sepet.clone();
      sepet.push(30);
      let toplam_eleman = sepet.len() + yedek.len();
      println!("{} {} {toplam_eleman}", sepet.len(), yedek.len());
  }
options:
  - "3 2 5"
  - "3 3 6"
  - "2 2 4"
  - Derlenmez (E0382)
answer: 0
explanation: |
  `clone` heap'te yeni bir alan ayırıp elemanları kopyalar: `yedek`, `sepet`'ten tamamen bağımsızdır.
  `sepet`'e eklenen `30` yedeği etkilemez. `clone` taşımadığı için `sepet` kullanılmaya devam eder.
feedback:
  - Doğru! İki bağımsız Vec.
  - "Bu paylaşım olurdu (Python/Java listeleri gibi). `clone` bağımsız bir kopya üretir."
  - "`sepet.push(30)` satırını unutma: `sepet` büyüdü."
  - "`clone` taşımaz; `sepet` sahipliğini korur."
```

```compiles
code: |
  fn main() {
      let sicakliklar = [18, 21, 19];
      let mut duzeltilmis = sicakliklar;
      duzeltilmis[0] = 20;
      println!("{sicakliklar:?} {duzeltilmis:?}");
  }
answer: true
explanation: |
  Derlenir ve `[18, 21, 19] [20, 21, 19]` yazar. Modül 2'deki diziler stack'te durur; elemanları `i32`
  (`Copy`) olan bir dizi de `Copy`'dir. `duzeltilmis` bağımsız bir kopya olarak başlar, `mut` olduğu için
  değiştirilebilir; `sicakliklar`'a dokunulmaz.
```

## Bölüm 4: Sahiplik ve fonksiyonlar

```compiles
code: |
  fn kelime_sayisi(metin: String) -> usize {
      let mut sayi = 1;
      for harf in metin.chars() {
          if harf == ' ' {
              sayi += 1;
          }
      }
      sayi
  }

  fn main() {
      let siir = String::from("Dağlar dağlar");
      let a = kelime_sayisi(siir);
      let b = kelime_sayisi(siir);
      println!("{a} {b}");
  }
answer: false
error: E0382
explanation: |
  `kelime_sayisi` metni yalnızca okuyor, ama imzası `String` istediği için ilk çağrı sahipliği **alır**
  ve fonksiyonun sonunda metni drop eder. İkinci çağrıda `siir` artık yoktur. İmza bir sözleşmedir:
  `metin: String` "bana ver, geri vermem" demektir. (Bu fonksiyon için doğru imzayı Modül 5'te
  yazacaksın: `&str`.)
```

```fill
prompt: |
  `ortalama_ve_isim` bir öğrencinin adının sahipliğini alıyor ve üç notunun ortalamasıyla birlikte
  **geri veriyor**. Boşlukları doldur; program `Selin: 85` yazdırmalı.
code: |
  fn ortalama_ve_isim(isim: String, notlar: [u32; 3]) -> (String, u32) {
      let mut toplam = 0;
      for n in notlar {
          toplam += n;
      }
      (___0, toplam / 3)
  }

  fn main() {
      let isim = String::from("Selin");
      let notlar = [80, 90, 85];
      let (___1, ortalama) = ortalama_ve_isim(isim, notlar);
      println!("{isim}: {ortalama}");
  }
blanks:
  - ["isim"]
  - ["isim"]
output: "Selin: 85"
explanation: |
  Fonksiyon `isim`'i tuple'ın içinde geri **taşır**; çağıran `let (isim, ortalama) = ...;` ile hem
  sahipliği geri alır hem de sonucu açar (yeni `isim`, eskisini gölgeler). `notlar` dizisi ise `Copy`
  olduğu için fonksiyona bir kopyası gider; `main`'deki `notlar` hiç taşınmaz. `for n in notlar`
  (Modül 3) dizinin elemanlarını sırayla gezer; tam sayı bölmesi `255 / 3 = 85` verir.
```

```predict
question: Modül 3'ten bir döngü. Bu program ne yazdırır?
code: |
  fn main() {
      let mut sayac = 0;
      let sonuc = loop {
          sayac += 3;
          if sayac % 2 == 0 {
              continue;
          }
          if sayac > 10 {
              break sayac * 2;
          }
      };
      println!("{sayac} {sonuc}");
  }
options:
  - "15 30"
  - "12 24"
  - "9 18"
  - "15 15"
answer: 0
explanation: |
  `sayac` sırayla 3, 6, 9, 12, 15 olur. Çift değerlerde (6 ve 12) `continue` turun geri kalanını atlar.
  Tek değerlerden 10'u geçen ilki 15'tir; `break sayac * 2` döngüden 30 değeriyle çıkar ve `loop` bir
  ifade olduğu için bu değer `sonuc`'a yazılır (Modül 3).
feedback:
  - Doğru! `continue` çiftleri atladı, `break` değerle çıktı.
  - "12 çift sayı: `continue` onu atlar, `break` satırına hiç gelinmez."
  - "9 tek ama 10'dan büyük değil; döngü devam eder."
  - "`break sayac * 2` döngüden `sayac`'ın iki katıyla çıkar."
```

```parsons
prompt: |
  Modül 3 ve 4 birlikte: `n` tane `"ho"` heceli bir gülüş üreten ve onu **döndüren** fonksiyonu kur.
  `gulus(3)` → `"hohoho!"`. Satırları sıraya koy.
lines: |
  fn gulus(n: u32) -> String {
      let mut sonuc = String::new();
      for _ in 0..n {
          sonuc.push_str("ho");
      }
      sonuc.push('!');
      sonuc
  }
  fn main() {
      println!("{}", gulus(3));
  }
distractors: |
      let sonuc = String::new();
      sonuc;
      for _ in 0..=n {
explanation: |
  `String::new()` boş bir metinle başlar; değiştireceğimiz için `let mut` gerekir. `0..n` tam `n` tur
  döner (`0..=n` bir fazlasını, `n + 1` tur dönerdi - Modül 3'teki "bir eksik/bir fazla" hatası). Son
  satırdaki noktalı virgülsüz `sonuc`, değerin sahipliğini çağırana **taşır**; `sonuc;` yazsaydın fonksiyon
  `()` döndürürdü ve `E0308` alırdın.
```

## Final: kod yazma

````exercise
id: m04-boss-duyuru
title: Üç sınıfa duyuru
difficulty: 2
prompt: |
  Okul müdürünün programı bir duyuruyu üç sınıfa göndermek istiyor. `duyur` fonksiyonu duyurunun
  **sahipliğini alıyor** (her sınıfın panosuna kendi nüshası asılıyor) ve bu imza değişmeyecek. Ama
  program derlenmiyor.

  `duyur` fonksiyonuna dokunmadan programı düzelt. Çıktı şu olmalı:

  ```text
  1. sınıf panosu: Yarın okul tatil!
  2. sınıf panosu: Yarın okul tatil!
  3. sınıf panosu: Yarın okul tatil!
  Müdürlük arşivi: Yarın okul tatil!
  ```
starter: |
  fn duyur(sinif: u32, duyuru: String) {
      println!("{sinif}. sınıf panosu: {duyuru}");
  }

  fn main() {
      let duyuru = String::from("Yarın okul tatil!");
      for sinif in 1..=3 {
          duyur(sinif, duyuru);
      }
      println!("Müdürlük arşivi: {duyuru}");
  }
starter_compiles: false
solution: |
  fn duyur(sinif: u32, duyuru: String) {
      println!("{sinif}. sınıf panosu: {duyuru}");
  }

  fn main() {
      let duyuru = String::from("Yarın okul tatil!");
      for sinif in 1..=3 {
          duyur(sinif, duyuru.clone());
      }
      println!("Müdürlük arşivi: {duyuru}");
  }
check: output
expected_output: |
  1. sınıf panosu: Yarın okul tatil!
  2. sınıf panosu: Yarın okul tatil!
  3. sınıf panosu: Yarın okul tatil!
  Müdürlük arşivi: Yarın okul tatil!
require:
  - pattern: 'fn\s+duyur\s*\(\s*sinif\s*:\s*u32\s*,\s*duyuru\s*:\s*String\s*\)'
    message: "`duyur` fonksiyonunun imzası değişmemeli: `fn duyur(sinif: u32, duyuru: String)`."
  - pattern: 'for\s+sinif\s+in'
    message: Duyuru hâlâ bir döngüyle gönderilmeli.
  - pattern: '\bduyur\(\s*sinif\s*,'
    message: "Her turda `duyur(sinif, ...)` çağrılmalı."
forbid:
  - pattern: 'println!\("1\.|sınıf panosu[\s\S]*sınıf panosu'
    message: Satırları elle yazdırma; duyuru `duyur` fonksiyonuyla gönderilmeli.
hints:
  - "Hata `value moved here, in previous iteration of loop` diyor: ilk turda duyuru `duyur`'a taşınıyor ve fonksiyonun sonunda drop ediliyor."
  - "`duyur` her çağrıda **kendi** `String`'ini istiyor ve döngüden sonra aslı da lazım. Toplam dört bağımsız değere ihtiyacın var. Bu bir \"gereksiz\" kopya mı, yoksa gerekçeli bir kopya mı?"
  - "Her turda fonksiyona bir kopya ver: `duyur(sinif, duyuru.clone());`, asıl `duyuru` döngüden sonra arşiv için kalır."
explanation: |
  Burada `clone` **gerekçeli** bir karardır: `duyur` imzası gereği her çağrıda sahiplik istiyor (her pano
  kendi nüshasını tutuyor) ve döngüden sonra aslı da kullanılacak. Dört bağımsız değer gerektiği için her
  turda bir kopya oluşturmak doğru çözüm. Her kopya `duyur`'un sonunda drop edilir; asıl `duyuru` ise
  `main`'in sonunda.

  Kaç kopya gerekiyor? Üç pano + bir arşiv = dört değer; biri asıl değer olduğuna göre en az üç `clone`
  şart. (Arşiv satırı olmasaydı son turda kopya yerine aslını taşıyarak bir `clone`'dan kurtulabilirdin.)
  Fonksiyon sadece yazdırdığı için gerçek hayatta doğru imza `duyuru: &str` olurdu (Modül 5) ve hiç kopya
  gerekmezdi; ama imzayı değiştirmek senin elinde değilse `clone` doğru araçtır.
````

````exercise
id: m04-boss-en-uzun-kelime
title: Cümlenin en uzun kelimesi
difficulty: 4
prompt: |
  `en_uzun_kelime` fonksiyonu bir cümlenin sahipliğini alır ve iki değer döndürür: cümlenin kendisi
  (**değişmeden**) ve cümledeki **en uzun kelime**.

  - Kelimeler tek bir boşlukla (`' '`) ayrılmıştır.
  - Uzunluk `len()` ile (bayt olarak) ölçülür.
  - Eşit uzunlukta birden fazla kelime varsa **ilk** geleni seç.
  - Boş cümlenin en uzun kelimesi boş metindir.

  | cümle | en uzun kelime |
  |---|---|
  | `"elma armut kiraz"` | `"armut"` (5 = 5, ilk gelen) |
  | `"Rust çok güzel bir dil"` | `"güzel"` |
  | `"merhaba"` | `"merhaba"` |

  Bu alıştırma modülün bütün araçlarını ister: `for harf in cumle.chars()` ile karakterleri gez, o anki
  kelimeyi `push` ile biriktir, gerektiğinde **taşı** ve taşınmış `mut` değişkene yeni bir `String` ata.
starter: |
  fn en_uzun_kelime(cumle: String) -> (String, String) {
      todo!()
  }

  fn main() {
      let (cumle, kelime) = en_uzun_kelime(String::from("Rust çok güzel bir dil"));
      println!("\"{cumle}\" cümlesinin en uzun kelimesi: {kelime}");
  }
solution: |
  fn en_uzun_kelime(cumle: String) -> (String, String) {
      let mut en_uzun = String::new();
      let mut kelime = String::new();
      for harf in cumle.chars() {
          if harf == ' ' {
              if kelime.len() > en_uzun.len() {
                  en_uzun = kelime; // taşı: kopya yok
              }
              kelime = String::new(); // taşınmış (ya da eski) değişkene yeni değer
          } else {
              kelime.push(harf);
          }
      }
      if kelime.len() > en_uzun.len() {
          en_uzun = kelime; // son kelimeyi de unutma
      }
      (cumle, en_uzun)
  }

  fn main() {
      let (cumle, kelime) = en_uzun_kelime(String::from("Rust çok güzel bir dil"));
      println!("\"{cumle}\" cümlesinin en uzun kelimesi: {kelime}");
  }
check: tests
tests: |
  #[test]
  fn ortadaki_kelime_en_uzun() {
      let (_, kelime) = en_uzun_kelime(String::from("Rust çok güzel bir dil"));
      assert_eq!(kelime, "güzel", "\"güzel\" 6 bayt; \"Rust\" ve \"çok\" 4'er bayt");
  }

  #[test]
  fn esitlikte_ilk_kelime() {
      let (_, kelime) = en_uzun_kelime(String::from("elma armut kiraz"));
      assert_eq!(kelime, "armut", "\"armut\" ve \"kiraz\" 5'er bayt; ilk gelen seçilmeli");
  }

  #[test]
  fn son_kelime_en_uzun() {
      let (_, kelime) = en_uzun_kelime(String::from("bir iki kirmizi"));
      assert_eq!(kelime, "kirmizi", "son kelimeden sonra boşluk yok; döngüden sonra da kontrol etmelisin");
  }

  #[test]
  fn uzunluk_bayt_olarak_olculur() {
      let (_, kelime) = en_uzun_kelime(String::from("kalem ağaç"));
      assert_eq!(
          kelime,
          "ağaç",
          "\"ağaç\" 4 harf ama 6 bayt (ğ ve ç ikişer bayt); \"kalem\" 5 bayt - harf değil `len()` (bayt) karşılaştır"
      );
  }

  #[test]
  fn tek_kelime_ve_bos_cumle() {
      let (_, kelime) = en_uzun_kelime(String::from("merhaba"));
      assert_eq!(kelime, "merhaba", "tek kelimelik cümlede o kelime en uzundur");
      let (cumle, kelime) = en_uzun_kelime(String::new());
      assert_eq!((cumle.as_str(), kelime.as_str()), ("", ""), "boş cümle: iki boş metin");
  }

  #[test]
  fn cumle_degismeden_geri_doner() {
      let (cumle, _) = en_uzun_kelime(String::from("Ankara Türkiye'nin başkenti"));
      assert_eq!(cumle, "Ankara Türkiye'nin başkenti", "cümle olduğu gibi geri verilmeli");
  }
hints:
  - "İki `mut` `String` tut: `en_uzun` (şimdiye kadarki en uzun kelime) ve `kelime` (şu an biriktirilen kelime). Boşluk değilse `kelime.push(harf)`."
  - "Boşluk gördüğünde kelime bitti demektir: `kelime.len() > en_uzun.len()` ise `en_uzun = kelime;` ile **taşı** (kopya gerekmez). Sonra `kelime = String::new();` ile yeni bir kelimeye başla, taşınmış bir `mut` değişkene yeni değer atamak serbesttir."
  - "Cümlenin son kelimesinden sonra boşluk yok! Döngüden sonra aynı karşılaştırmayı bir kez daha yap. En sonda `(cumle, en_uzun)` döndür."
explanation: |
  Çözüm modülün bütün fikirlerini bir araya getiriyor:

  - **Sahiplik**: Fonksiyon `cumle`'nin sahibi; `chars()` onu yalnızca okur, bu yüzden en sonda
    `(cumle, en_uzun)` ile geri taşıyabiliyoruz.
  - **Taşıma**: `en_uzun = kelime;` biriktirilen kelimeyi **kopyalamadan** `en_uzun`'a taşır. O satırda
    `en_uzun`'un eski değeri artık sahipsiz kalır ve **hemen drop edilir** (yeniden atama).
  - **Taşınmış değişkene atama**: Taşımadan sonra `kelime` boştur; `kelime = String::new();` ona yeni bir
    değer verir. Taşıma olmadıysa aynı satır eski kelimeyi drop eder. Derleyici iki durumu da izler.
  - **Kenar durumu**: Son kelime boşlukla bitmediği için döngüden sonraki kontrol şarttır.
  - **Kesin büyüktür (`>`)**: Eşitlikte `en_uzun` değişmez, böylece ilk gelen kazanır.

  `en_uzun = kelime.clone();` da çalışırdı, ama her yeni rekor için gereksiz bir heap kopyası yapardı:
  `kelime` zaten hemen sıfırlanacağı için taşımak hem daha hızlı hem daha deyimseldir. Modül 9'da
  `split_whitespace` ile bu işi çok daha kısa yapmayı, Modül 5'te de bir kelimeyi kopyalamadan bir
  **dilim** olarak döndürmeyi (`ilk_kelime`) öğreneceksin.
````
