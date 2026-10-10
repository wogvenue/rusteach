---
id: m01-boss
title: "Boss: Merhaba Rust"
minutes: 30
type: boss
keywords: [boss, tekrar, derleyici, cargo, println!, biçimlendirme, hata mesajları]
---

Modül 1'in sonuna geldin! Bu sınavda programların nasıl çalıştığını, Rust araçlarını, `println!` ile
yer tutucuları, biçimlendirmeyi ve derleyici mesajlarını okumayı bir arada kullanacaksın. Bir
sonraki modülün kilidini açmak için **%80** başarı gerekiyor.

:::tip Sınav taktiği
Cevaplamadan önce derse dönüp bakmak yerine **önce hatırlamaya çalış**. Yanlış cevaplar dünyanın
sonu değil: Hepsi tekrar kuyruğuna girer ve sana tam zamanında yeniden sorulur. Alıştırmalarda
derleyicinin mesajlarını okumak serbest — hatta beklenen bu!
:::

## Programlar, derleyiciler ve araçlar

```quiz
question: |
  Ayşe bir Python programı, Mehmet bir Rust programı yazdı. İkisi de programlarını Python ya da
  Rust kurulu olmayan bir arkadaşlarına göndermek istiyor. Hangisi **doğrudur**?
options:
  - İkisi de kaynak kodu gönderebilir; arkadaşları dosyaya çift tıklayınca çalışır
  - "Mehmet derlenmiş `.exe` dosyasını gönderebilir; Ayşe'nin arkadaşının ise programı çalıştırmak için bir Python yorumlayıcısına ihtiyacı vardır"
  - "Ayşe'nin programı derlenmiş olduğu için doğrudan çalışır; Mehmet'in programı yorumlayıcı ister"
  - İkisinin de arkadaşı programı çalıştırmak için kendi bilgisayarında derlemek zorundadır
answer: 1
explanation: |
  Rust **derlenen** bir dildir: `rustc` (ya da `cargo build`) kaynak kodu bir kez makine koduna
  çevirir ve ortaya çıkan `.exe`, derleyici olmadan çalışır. Python ise **yorumlanan** bir dildir:
  Kod her çalıştırıldığında bir yorumlayıcı tarafından okunup uygulanır, bu yüzden çalıştıracak
  bilgisayarda Python kurulu olmalıdır.
feedback:
  - Kaynak kod, makine kodu değildir; tek başına çalışmaz.
  - Doğru!
  - Tam tersi — Python yorumlanır, Rust derlenir.
  - "Mehmet'in arkadaşı derlenmiş `.exe`'yi doğrudan çalıştırabilir."
```

```quiz
question: |
  Rust, C/C++'taki "serbest bırakılmış belleği kullanmak" (use-after-free) gibi bellek hatalarını
  **çöp toplayıcı (GC) olmadan** nasıl önler?
options:
  - Program çalışırken arka planda belleği tarayan bir çöp toplayıcı kullanarak
  - Bellek kurallarını **derleme zamanında** denetleyip kuralları çiğneyen programı derlemeyerek
  - Bütün bellek işlerini programcıya bırakıp hataları kullanıcının bildirmesini bekleyerek
  - Her bellek erişiminden önce programı yavaşlatan ek denetimler ekleyerek ve hatada programı sessizce düzelterek
answer: 1
explanation: |
  Rust'ın temel fikri, bellek güvenliği kurallarını **program çalışmadan önce**, derleyiciye
  denetletmektir. Kuralları çiğneyen kod derlenmez; derlenen kodda ise çalışma zamanında bir çöp
  toplayıcıya gerek kalmaz. Böylece hem C kadar hızlı hem de bellek açısından güvenli programlar
  yazılabilir. Bu kuralların ne olduğunu (sahiplik, ödünç alma) Modül 4 ve 5'te öğreneceksin.
feedback:
  - Bu, Java, C#, Go ve Python'un yoludur; Rust'ta çöp toplayıcı yoktur.
  - Doğru!
  - Bu C/C++'ın yoludur ve bellek hatalarının asıl kaynağıdır.
  - Rust hataları sessizce düzeltmez; asıl iş derleme zamanında yapılır.
```

```quiz
question: |
  Aşağıdaki işlerden hangileri **`rustup`**'ın görevidir? (Birden fazla seçenek işaretleyebilirsin.)
options:
  - "Rust araç zincirini en son kararlı sürüme güncellemek (`rustup update`)"
  - "Bir projeyi derleyip çalıştırmak"
  - "Rust belgelerini ve resmî kitabı çevrimdışı açmak (`rustup doc`)"
  - "`Cargo.toml`'daki kütüphaneleri indirmek"
answer: [0, 2]
explanation: |
  **rustup**, Rust'ın **kurulum yöneticisidir**: `rustc`, `cargo`, standart kütüphane, belgeler,
  `rustfmt` ve `clippy`'yi kurar, günceller ve sürümler arasında geçiş yapar. Projeleri derlemek,
  çalıştırmak ve bağımlılıkları indirmek ise **cargo**'nun işidir.
feedback:
  - Doğru — her 6 haftada bir yeni kararlı sürüm çıkar, `rustup update` onu getirir.
  - Bu `cargo build` / `cargo run`'ın işidir.
  - Doğru — `rustup doc --book` resmî kitabı açar.
  - Bağımlılıkları Cargo indirir.
```

```quiz
question: |
  Bir projede kod yazıyorsun ve yalnızca "**kodum derleniyor mu?**" sorusuna olabildiğince hızlı
  cevap istiyorsun. Hangi komutu kullanırsın?
options:
  - "`cargo build --release`"
  - "`cargo run`"
  - "`cargo check`"
  - "`cargo new`"
answer: 2
explanation: |
  `cargo check` bütün denetimleri (sözdizimi, adlar, tipler, bellek kuralları) yapar ama **makine
  kodu üretmez**; bu yüzden en hızlı geri bildirimi verir. `cargo run` derleyip çalıştırır,
  `--release` ise optimizasyon yaptığı için en yavaş derlenen seçenektir.
feedback:
  - Optimize derleme en yavaşıdır; dağıtım ve performans ölçümü içindir.
  - Gereğinden fazlasını yapar — makine kodu üretir ve programı çalıştırır.
  - Doğru!
  - Bu yeni bir proje oluşturur.
```

```quiz
question: |
  Bir Cargo projesiyle ilgili şu ifadelerden hangisi **yanlıştır**?
options:
  - "`Cargo.toml` projenin adını, sürümünü, edisyonunu ve bağımlılıklarını tanımlar"
  - "`Cargo.lock` bağımlılıkların tam sürümlerini kaydeder ve elle düzenlenmez"
  - "`target` klasörü derleme çıktılarını içerir ve git'e eklenmez"
  - "`cargo build --release` ile derlenen program `target\\debug` klasörüne yazılır"
answer: 3
explanation: |
  Release derlemeleri **`target\release`** klasörüne yazılır; `target\debug` ise `cargo build` ve
  `cargo run`'ın varsayılan (debug) çıktı klasörüdür. Diğer üç ifade doğrudur.
feedback:
  - Bu doğru bir ifade.
  - Bu doğru bir ifade.
  - Bu doğru bir ifade; `cargo clean` bu klasörü siler.
  - "Doğru seçim! Release çıktısı `target\\release`'e gider."
```

## Programın yapısı ve yer tutucular

```compiles
code: |
  fn main() {
      let urun = "çay";
      println!("{} bardak {} istiyorum", urun);
  }
answer: false
explanation: |
  Derlenmez: Biçim metninde **iki** yer tutucu var ama yalnızca **bir** argüman verilmiş
  (`2 positional arguments in format string, but there is 1 argument`). `println!` bir makro
  olduğu için bu uyuşmazlığı derleme zamanında yakalar. Doğrusu, örneğin:
  `println!("{} bardak {urun} istiyorum", 2);`
```

```predict
code: |
  fn main() {
      // println!("Başlıyoruz");
      println!("{0}-{1}-{0}", "tik", "tak"); /* println!("ara"); */
      println!("Yol: C:\\Oyun\t\"son\"");
  }
options:
  - |
    tik-tak-tik
    Yol: C:\Oyun	"son"
  - |
    Başlıyoruz
    tik-tak-tik
    ara
    Yol: C:\Oyun	"son"
  - |
    tik-tak-tak
    Yol: C:\\Oyun\t\"son\"
answer: 0
explanation: |
  `//` ve `/* */` içindeki her şey yorumdur, bu yüzden `Başlıyoruz` ve `ara` yazılmaz. `{0}` iki kez
  birinci argümanı (`tik`) kullanır. Son satırda `\\` tek bir ters eğik çizgi, `\t` bir sekme, `\"`
  bir çift tırnak üretir.
```

```fill
prompt: |
  Boşlukları doldur. Program tam olarak şunu yazdırmalı:

  `Ferris dedi ki: "Merhaba" {selam}`

  `soz` değişkeninin tırnaklı hâlini **Debug** biçimiyle, `{selam}` metnini ise kaçış ile üret.
code: |
  fn main() {
      let ad = "Ferris";
      let soz = "Merhaba";
      println!("___0 dedi ki: ___1 ___2", ad);
  }
blanks:
  - ["{0}", "{}"]
  - ["{soz:?}"]
  - ["{{selam}}"]
explanation: |
  `ad` argüman olarak verildiği için `{}` ya da `{0}` onu alır. Burada `{ad}` yazsaydın derleme
  hatası alırdın (`redundant argument`): Yer tutucu `ad` değişkenini doğrudan yakalar, sondaki `ad`
  argümanı da boşta kalır. `{soz:?}` Debug biçimidir ve metni tırnak içinde yazar. `{{selam}}` ise
  yer tutucu değildir: `{{` ve `}}` ekrana birer süslü parantez yazar.
```

## Biçimlendirme ve çıktı kanalları

```predict
code: |
  fn main() {
      let ad = "Kalem";
      let fiyat = 7.456;
      println!("[{ad:<8}|{fiyat:>7.2}]");
      println!("[{:^9}]", "orta");
      println!("[{:03}] [{:.3}]", 7, "Rustacean");
  }
options:
  - |
    [Kalem   |   7.46]
    [  orta   ]
    [007] [Rus]
  - |
    [   Kalem|7.46   ]
    [  orta   ]
    [007] [Rustacean]
  - |
    [Kalem   |   7.45]
    [   orta  ]
    [  7] [Rus]
answer: 0
explanation: |
  `{ad:<8}` metni 8 karakterlik alanda sola yaslar. `{fiyat:>7.2}` önce iki basamağa yuvarlar
  (`7.456` → `7.46`), sonra 7 karakterlik alanda sağa yaslar. `"orta"` 9 karakterlik alanda
  ortalanınca kalan 5 boşluğun 2'si sola, 3'ü sağa gelir. `{:03}` sayının başını sıfırla doldurur;
  metinlere uygulanan `.3` ise ilk 3 karakteri alıp gerisini keser.
```

```quiz
question: |
  Bir program, işlediği siparişleri yazdırıyor; çıktısı `cargo run > siparisler.txt` ile bir
  dosyaya kaydediliyor. Ayrıca her siparişin satırını, ekrana yazmadan önce bir değişkende
  hazırlayıp iki yerde kullanmak istiyorsun. Hangi eşleştirme doğrudur?
options:
  - "Hata mesajları için `println!`, satırı hazırlamak için `print!`"
  - "Hata mesajları için `eprintln!`, satırı hazırlamak için `format!`"
  - "Hata mesajları için `format!`, satırı hazırlamak için `eprintln!`"
  - "Hata mesajları için `print!`, satırı hazırlamak için `println!`"
answer: 1
explanation: |
  `eprintln!` stderr'e yazar; mesajlar dosyaya karışmaz ve ekranda görünür. `format!` ise hiçbir
  şey yazdırmadan biçimlendirilmiş bir `String` döndürür, bu yüzden sonucu bir değişkende saklayıp
  istediğin kadar kullanabilirsin.
feedback:
  - "`println!` ile yazılan hatalar dosyaya karışır; `print!` ise bir değer döndürmez, ekrana yazar."
  - Doğru!
  - "`format!` bir şey yazdırmaz; `eprintln!` ise bir değer döndürmez."
  - İkisi de stdout'a yazar ve kullanılabilir bir değer döndürmez.
```

```parsons
prompt: |
  Satırları sıraya koy. Program başlığı `format!` ile hazırlayıp başta ve sonda kullanmalı, aradaki
  satırda puanı 6 karakterlik alana sağa yaslı yazmalı. Dikkat: Hatalı satırlar da var.
lines: |
  fn main() {
      let puan = 42;
      let cizgi = format!("{:-<12}", "");
      println!("{cizgi}");
      println!("Puan:{puan:>6}");
      println!("{cizgi}");
  }
distractors: |
      let cizgi = println!("{:-<12}", "");
      println!("Puan:{puan:6>}");
explanation: |
  `format!` çizgiyi bir `String` olarak üretip `cizgi`'ye verir; değişken tanımlandıktan sonra
  istediğin kadar kullanılır. Hatalı satırlar: `println!` ekrana yazar ama metin döndürmez; `6>`
  ise yanlış sıradır, hizalama işareti genişlikten **önce** gelir (`>6`).
```

## Derleyiciyle sohbet

````quiz
question: |
  Şu hata mesajını aldın. Programı düzeltmek için **ne** yapmalısın?

  ```text
  error[E0425]: cannot find value `toplamm` in this scope
   --> src/main.rs:4:24
    |
  4 |     println!("Toplam: {toplamm}");
    |                        ^^^^^^^
    |
  help: a local variable with a similar name exists
    |
  4 -     println!("Toplam: {toplamm}");
  4 +     println!("Toplam: {toplam}");
    |
  ```
options:
  - "`toplamm` adında yeni bir değişken oluşturmak zorundasın; başka yolu yok"
  - "4\\. satırdaki yer tutucuda adı yanlış yazmışsın; `{toplam}` olarak düzeltmelisin"
  - "`println!`'i `print!` ile değiştirmelisin"
  - "24\\. satırda bir hata var"
answer: 1
explanation: |
  `E0425`, "bu adı bulamadım" demektir. Konum satırı (`src/main.rs:4:24`) hatanın 4. satırın 24.
  sütununda olduğunu söyler; `help` satırı da benzer adlı bir `toplam` değişkeni olduğunu
  bildirip düzeltmeyi gösterir. Çözüm genellikle böyle küçük bir yazım düzeltmesidir.
feedback:
  - Mümkün ama yanlış çözüm; derleyici zaten var olan `toplam`'ı öneriyor.
  - Doğru!
  - Sorun makroda değil, yer tutucunun içindeki addadır.
  - "`4:24` satır 4, sütun 24 demektir."
````

```compiles
code: |
  fn main() {
      let sicaklik = 23;
      let nem = 60;
      println!("Sıcaklık: {sicaklik} derece");
  }
answer: true
explanation: |
  **Derlenir** ve `Sıcaklık: 23 derece` yazar. `nem` hiç kullanılmadığı için derleyici bir
  **uyarı** verir (`unused variable: nem`) ama uyarılar derlemeyi durdurmaz. Uyarıyı gidermek
  için `nem`'i kullanmalı, silmeli ya da bilerek tutuyorsan adını `_nem` yapmalısın.
```

Şimdi üç alıştırma: her biri bir öncekinden biraz daha zorlu.

````exercise
id: m01-boss-e-otobus-bileti
title: Otobüs bileti
difficulty: 2
prompt: |
  Değişkenleri ve biçim belirteçlerini kullanarak tam olarak şu bileti yazdır:

  ```text
  === OTOBÜS BİLETİ ===
  Güzergâh : Isparta -> Ankara
  Koltuk   : 14
  Ücret    : 650.00 TL
  ```

  - Başlık: `" OTOBÜS BİLETİ "` metni **21** karakterlik alanda `=` ile ortalanmış.
  - Etiketler (`Güzergâh`, `Koltuk`, `Ücret`) **9** karakterlik alanda sola yaslı; ardından `: `.
  - Ücret **2** ondalık basamaklı.

  Boşlukları ve `=` işaretlerini elle yazma; değerleri tekrar yazma.
starter: |
  fn main() {
      let kalkis = "Isparta";
      let varis = "Ankara";
      let koltuk = 14;
      let ucret = 650.0;

      println!("OTOBÜS BİLETİ");
      println!("Güzergâh: {kalkis} {varis}");
      println!("Koltuk: {koltuk}");
      println!("Ücret: {ucret}");
  }
solution: |
  fn main() {
      let kalkis = "Isparta";
      let varis = "Ankara";
      let koltuk = 14;
      let ucret = 650.0;

      println!("{:=^21}", " OTOBÜS BİLETİ ");
      println!("{:<9}: {kalkis} -> {varis}", "Güzergâh");
      println!("{:<9}: {koltuk}", "Koltuk");
      println!("{:<9}: {ucret:.2} TL", "Ücret");
  }
check: output
expected_output: |
  === OTOBÜS BİLETİ ===
  Güzergâh : Isparta -> Ankara
  Koltuk   : 14
  Ücret    : 650.00 TL
forbid:
  - pattern: "\"[^\"\\n]*  [^\"\\n]*\""
    message: Metinlerin içine art arda boşluklar yazma; hizalamayı genişlik belirteçleriyle yap.
  - pattern: "==="
    message: "Başlıktaki `=` işaretlerini elle yazma; `{:=^21}` gibi bir dolgu belirteci kullan."
  - pattern: "650\\.00|Isparta[\\s\\S]*Isparta|Ankara[\\s\\S]*Ankara|14[\\s\\S]*14"
    message: Değerleri elle yazma; değişkenleri ve hassasiyet belirtecini kullan.
require:
  - pattern: "\\.2\\}"
    message: "Ücret için iki basamaklı hassasiyet belirteci (`.2`) kullanmalısın."
hints:
  - |
    Başlık için 6. dersteki kalıp: `println!("{:=^21}", " OTOBÜS BİLETİ ");`
  - |
    Etiketi bir argüman olarak verip 9 karakterlik alana sola yaslayabilirsin:
    `println!("{:<9}: {koltuk}", "Koltuk");`
  - |
    Ücret satırı: `println!("{:<9}: {ucret:.2} TL", "Ücret");` — `Güzergâh` satırında ise iki
    değişken ve aralarında ` -> ` var.
explanation: |
  Etiketleri argüman olarak verip `{:<9}` ile aynı genişliğe yerleştirmek, iki nokta üst üstelerin
  alt alta gelmesini sağladı; etiketlerin uzunluğu farklı olsa da sütun bozulmadı. Başlıktaki
  `{:=^21}`, 15 karakterlik metni 21 karakterlik alanda ortalayıp her iki yana 3 `=` koydu.
  `{ucret:.2}` ise `650.0`'ı `650.00` olarak yazdı. Aynı biçimlendirmeyi değişkenlerle de
  yapabilirdin; önemli olan, hizalamayı elle sayılmış boşluklara değil biçim belirteçlerine
  bırakmak: Böylece bir etiket ya da değer değiştiğinde düzen kendiliğinden korunur.
````

````exercise
id: m01-boss-e-kargo-takip
title: Kargo takip ekranı
difficulty: 3
prompt: |
  Bir kargo şirketinin takip ekranını yazdıran program derlenmiyor. Hataları derleyicinin
  mesajlarını okuyarak düzelt. Dikkat: Derleme hataları bittikten sonra bile çıktıda bir sorun
  kalacak; takip numarası **8 haneli ve başında sıfırlarla** yazılmalı. Doğru çıktı:

  ```text
  Kargo #00048213
  Alıcı: Elif Kaya
  Şehir: İzmir
  Tahmini teslim: 2 gün içinde
  ```

  Değerleri metinlere elle yazma; değişkenleri kullan.
starter: |
  fn main() {
      let takip_no = 48213;
      let alici = "Elif Kaya";
      let sehir = "İzmir";
      let gun = 2;
      println!("Kargo #{takip_no:8}")
      println!("Alıcı: {alic}");
      println("Şehir: {}", sehir);
      println!("Tahmini teslim: {} gün içinde");
  }
starter_compiles: false
solution: |
  fn main() {
      let takip_no = 48213;
      let alici = "Elif Kaya";
      let sehir = "İzmir";
      let gun = 2;
      println!("Kargo #{takip_no:08}");
      println!("Alıcı: {alici}");
      println!("Şehir: {}", sehir);
      println!("Tahmini teslim: {} gün içinde", gun);
  }
check: output
expected_output: |
  Kargo #00048213
  Alıcı: Elif Kaya
  Şehir: İzmir
  Tahmini teslim: 2 gün içinde
forbid:
  - pattern: "48213[\\s\\S]*48213"
    message: Takip numarasını tekrar yazma; `takip_no` değişkenini kullan.
  - pattern: "Elif[\\s\\S]*Elif|İzmir[\\s\\S]*İzmir"
    message: Alıcıyı ve şehri tekrar yazma; değişkenleri kullan.
  - pattern: "teslim: 2"
    message: Gün sayısını elle yazma; `gun` değişkenini kullan.
hints:
  - |
    Derleyici bu kez dört hatayı birden listeler; yukarıdan başla. İlki: 6. satırın sonunda eksik
    bir `;` var. İkincisi: `1 positional argument in format string, but no arguments were given`;
    son satırdaki `{}` yer tutucusunu dolduracak argümanı (`gun`) ekle.
  - |
    Kalan iki hata `E0425` (yanlış yazılmış bir ad) ve `E0423` (`!` eksik). İkisinin de `help`
    satırı düzeltmeyi gösteriyor.
  - |
    Program derlenince ilk satır `Kargo #   48213` yazar: `{takip_no:8}` boşlukla doldurur. Sıfırla
    doldurmak için genişliğin önüne `0` koy: `{takip_no:08}`.
explanation: |
  Dört derleme hatası ve bir biçim hatası vardı:

  1. 6\. satırın sonunda eksik `;` (sözdizimi hatası, ilk aşamada raporlanır). Bu kez `;`'si eksik
     satırın içinde başka bir derleme hatası olmadığı için, diğer üç hata da aynı anda listelendi.
  2. `{alic}` → `E0425`; doğru ad `alici`. Derleyici benzer adı önerir.
  3. `println` → `E0423`; makrolar `!` ile çağrılır.
  4. Eksik argüman → `{}` için `gun` eklendi.
  5. `{takip_no:8}` derlenir ama boşlukla doldurur. `{takip_no:08}` ise 8 haneye sıfırla tamamlar.

  Son madde, "derlendi" ile "doğru" arasındaki farkı yine hatırlatıyor: Çıktıyı beklenenle
  karşılaştırmak senin işin.
````

````exercise
id: m01-boss-e-karne
title: Karne tablosu
difficulty: 4
prompt: |
  Bir okul uygulaması için karne tablosu hazırla. Programın **stdout**'u tam olarak şu olmalı:

  ```text
  {"ogrenci": "Deniz"}
  ---------------------
  Matematik......  88.5
  Fizik..........  71.9
  Kimya..........  95.0
  ---------------------
  Ortalama.......  85.1
  ```

  - İlk satırdaki tırnaklı adı **Debug** biçimiyle, süslü parantezleri kaçışla üret.
  - Çizgi 21 tane `-`'den oluşuyor. Onu **`format!`** ile bir kez üretip bir değişkende sakla ve iki
    kez kullan.
  - Ders adları (ve `Ortalama`) **15** karakterlik alanda sola yaslı ve boşluk yerine `.` ile
    doldurulmuş; notlar **6** karakterlik alanda sağa yaslı ve **1** ondalık basamaklı.
  - Ayrıca `Bilgi: 3 ders işlendi.` mesajını **stderr**'e yaz.

  Değerleri, noktaları, çizgileri ya da boşlukları elle yazma.
starter: |
  fn main() {
      let ogrenci = "Deniz";
      let ders1 = "Matematik";
      let not1 = 88.46;
      let ders2 = "Fizik";
      let not2 = 71.94;
      let ders3 = "Kimya";
      let not3 = 94.96;
      let ortalama = (not1 + not2 + not3) / 3.0;

      println!("Öğrenci: {ogrenci}");
      println!("{ders1} {not1}");
      println!("{ders2} {not2}");
      println!("{ders3} {not3}");
      println!("Ortalama {ortalama}");
  }
solution: |
  fn main() {
      let ogrenci = "Deniz";
      let ders1 = "Matematik";
      let not1 = 88.46;
      let ders2 = "Fizik";
      let not2 = 71.94;
      let ders3 = "Kimya";
      let not3 = 94.96;
      let ortalama = (not1 + not2 + not3) / 3.0;

      let cizgi = format!("{:-<21}", "");
      println!("{{\"ogrenci\": {ogrenci:?}}}");
      println!("{cizgi}");
      println!("{ders1:.<15}{not1:>6.1}");
      println!("{ders2:.<15}{not2:>6.1}");
      println!("{ders3:.<15}{not3:>6.1}");
      println!("{cizgi}");
      println!("{:.<15}{ortalama:>6.1}", "Ortalama");
      eprintln!("Bilgi: 3 ders işlendi.");
  }
check: output
expected_output: |
  {"ogrenci": "Deniz"}
  ---------------------
  Matematik......  88.5
  Fizik..........  71.9
  Kimya..........  95.0
  ---------------------
  Ortalama.......  85.1
forbid:
  - pattern: "\"[^\"\\n]*  [^\"\\n]*\""
    message: Metinlerin içine art arda boşluklar yazma; hizalamayı genişlik belirteçleriyle yap.
  - pattern: "-----|\\.\\.\\.\\."
    message: "Çizgileri ve noktaları elle yazma; `{:-<21}` ve `{ders1:.<15}` gibi dolgu belirteçleri kullan."
  - pattern: "88\\.5\\b|71\\.9\\b|95\\.0\\b|85\\.1\\b"
    message: Notları elle yuvarlayıp yazma; `.1` hassasiyet belirteci bunu senin için yapar.
  - pattern: "Deniz[\\s\\S]*Deniz"
    message: Öğrencinin adını tekrar yazma; `ogrenci` değişkenini kullan.
require:
  - pattern: "format!"
    message: Çizgiyi `format!` ile üretip bir değişkende saklamalısın.
  - pattern: "eprintln!"
    message: "Bilgi mesajını `eprintln!` ile stderr'e yazmalısın."
  - pattern: "ogrenci:\\?"
    message: "Öğrencinin adını tırnaklı yazmak için Debug biçimini kullan: `{ogrenci:?}`"
hints:
  - |
    Parça parça ilerle. Önce çizgi: `let cizgi = format!("{:-<21}", "");` ve onu iki kez
    `println!("{cizgi}");` ile yazdır. Sonra ilk satır: `{{` ve `}}` süslü parantezleri,
    `{ogrenci:?}` ise tırnaklı adı üretir.
  - |
    Bir ders satırı: `{ders1:.<15}` adı 15 karakterlik alana sola yaslar ve kalan yeri `.` ile
    doldurur; `{not1:>6.1}` notu 6 karakterlik alanda sağa yaslar ve bir basamağa yuvarlar.
  - |
    Ortalama satırında `Ortalama` bir metin: `println!("{:.<15}{ortalama:>6.1}", "Ortalama");`.
    En sona `eprintln!("Bilgi: 3 ders işlendi.");` ekle; stderr'e yazılan satır, kontrol edilen
    stdout'u etkilemez.
explanation: |
  Bu alıştırma modülün bütün biçimlendirme araçlarını bir araya getirdi:

  - `{{\"ogrenci\": {ogrenci:?}}}` → kaçışlı süslü parantezler + Debug biçiminin eklediği tırnaklar.
  - `format!("{:-<21}", "")` → bir kez üretilen, iki kez kullanılan çizgi.
  - `{ders1:.<15}` → dolgu karakteri (`.`), hizalama (`<`) ve genişlik (`15`) bir arada.
  - `{not1:>6.1}` → hizalama, genişlik ve hassasiyet: `88.46` → `88.5`, `94.96` → `95.0`.
  - `eprintln!` → bilgi mesajı ayrı kanalda; `cargo run > karne.txt` ile kaydedilen dosya temiz kalır.

  Tablonun düzeni tamamen biçim belirteçlerinden geldiği için, bir dersin adı ya da notu değişse
  bile sütunlar hizalı kalır. Tebrikler, Modül 1'in bütün araçlarını kullanabiliyorsun! 🦀
````
