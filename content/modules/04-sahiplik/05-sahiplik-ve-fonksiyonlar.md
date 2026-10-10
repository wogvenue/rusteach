---
id: m04-l05
title: Sahiplik ve fonksiyonlar
minutes: 18
type: lesson
objectives:
  - Bir fonksiyon çağrısında argümanın taşındığını ya da kopyalandığını tipine bakarak söyleyebilmek
  - Bir fonksiyon imzasını okuyarak sahipliğin nereye gittiğini (tüketme, üretme, al-işle-geri ver) açıklayabilmek
  - Sahipliği tuple ile geri veren fonksiyonlar yazabilmek ve bu yöntemin neden zahmetli olduğunu açıklayabilmek
keywords: [sahiplik, fonksiyon, parametre, dönüş değeri, return, tuple, mut parametre, E0382, E0308]
---

Ders 3'te bir `String`'i fonksiyona verdiğinde sahipliğin fonksiyonun parametresine taşındığını kısaca
gördün. Bu dersin sorusu daha büyük: **sahiplik fonksiyonların sınırlarını nasıl geçer?** İçeri nasıl
girer, dışarı nasıl çıkar, ve fonksiyon bittiğinde geride ne kalır?

Bunu anladığında bir Rust fonksiyon imzasına bakıp, gövdesini hiç okumadan, "bu fonksiyon değerimi
alıp götürüyor mu, yoksa bana geri mi veriyor?" sorusunu cevaplayabileceksin. Ders sonunda da
Modül 5'in neden var olduğunu kendi gözünle göreceksin.

## Parametre yeni bir sahiptir

Bir fonksiyonu `f(x)` diye çağırmak, fonksiyonun parametresine `let parametre = x;` yazmak gibidir. Yani
Ders 3'teki bütün taşıma kuralları aynen geçerli. Ders 2'den tanıdığın `Balon` ile tahmin et:

```predict
question: Bu program ne yazdırır?
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  fn incele(b: Balon) {
      println!("{} balon inceleniyor", b.0);
  }

  fn main() {
      let balon = Balon("mor");
      incele(balon);
      println!("main devam ediyor");
  }
options:
  - |
    mor balon inceleniyor
    main devam ediyor
    mor balon patladı
  - |
    mor balon inceleniyor
    mor balon patladı
    main devam ediyor
  - |
    mor balon patladı
    mor balon inceleniyor
    main devam ediyor
answer: 1
explanation: |
  `incele(balon)` çağrısı balonu `incele`'nin parametresi `b`'ye **taşır**. Artık balonun sahibi `b` ve
  `b`'nin kapsamı fonksiyonun `}`'sinde bitiyor. Balon, fonksiyon döner dönmez patlar; `main` kaldığı
  yerden devam ettiğinde balon çoktan yoktur. (`b.0` ifadesi balonun içindeki metne ulaşır; kendi
  tiplerini yazmayı Modül 6'da öğreneceksin.)
feedback:
  - "Balonun sahibi artık `main`'deki `balon` değil, `incele`'deki `b`. Drop, sahibin kapsamı bitince olur: fonksiyonun sonunda."
  - Doğru! Değer fonksiyona taşındı, fonksiyonla birlikte drop edildi.
  - Taşıma değeri yok etmez; balon önce incelenir, fonksiyon bitince patlar.
```

Aynı hikâye bir `String` ile de geçerli. Ders 3'teki `kaydet` gibi `String` alan bir
`fn selamla(isim: String)` fonksiyonu düşün ve `selamla(ad)` çağrısını bellekte izle. Çağrı yığınını Ders 1'den hatırla: her fonksiyon çağrısı
stack'e kendi çerçevesini ekler.

```memory
title: selamla(ad) çağrısı bellekte
steps:
  - caption: "`main`'de `ad` bir `String`'in sahibi."
    stack:
      - frame: main
        vars:
          - { name: ad, type: String, value: "ptr · len=5 · cap=5", to: h1 }
    heap:
      - { id: h1, value: "A y ş e" }
  - caption: "`selamla(ad)` çağrıldı: başlık yeni çerçevedeki `isim` parametresine kopyalandı ve sahiplik **taşındı**. `main`'deki `ad` artık geçersiz."
    stack:
      - frame: main
        vars:
          - { name: ad, type: String, value: "ptr · len=5 · cap=5", moved: true, note: taşındı }
      - frame: selamla
        vars:
          - { name: isim, type: String, value: "ptr · len=5 · cap=5", to: h1 }
    heap:
      - { id: h1, value: "A y ş e" }
  - caption: "`selamla` döndü: çerçevesi kaldırıldı, sahibi `isim` olan heap verisi **drop edildi**. `main`'e geri döndüğümüzde metin artık yok."
    stack:
      - frame: main
        vars:
          - { name: ad, type: String, value: "ptr · len=5 · cap=5", moved: true, note: taşındı }
    heap:
      - { id: h1, value: "A y ş e", freed: true, label: "selamla'nın sonunda geri verildi" }
```

`Copy` tiplerde ise fonksiyona giden bir **kopyadır**; asıl değer çağıranda kalır. Modül 3'teki
fonksiyonları ve Modül 2'deki `mut`'u birlikte düşünerek tahmin et:

```predict
code: |
  fn ikiye_katla(mut puan: i32) -> i32 {
      puan *= 2;
      puan
  }

  fn main() {
      let puan = 21;
      let yeni = ikiye_katla(puan);
      println!("{puan} {yeni}");
  }
options:
  - "21 42"
  - "42 42"
  - "21 21"
  - Derlenmez, çünkü main'deki puan mut değil
answer: 0
explanation: |
  `i32` `Copy` olduğu için `ikiye_katla`'ya `21`'in bir **kopyası** gider. Parametredeki `mut`, yalnızca
  fonksiyonun kendi değişkeninin (parametrenin) değiştirilebileceğini söyler; çağıranın değişkeniyle bir
  ilgisi yoktur. Fonksiyon kopyayı 42 yapıp döndürür; `main`'deki `puan` 21 kalır.
feedback:
  - Doğru! Kopya değişti, asıl değer yerinde.
  - Fonksiyon bir kopya üzerinde çalışıyor; `main`'deki `puan`'a dokunamaz.
  - "Fonksiyon değiştirdiği kopyayı **döndürüyor**; `yeni` 42 olur."
  - "Parametredeki `mut` fonksiyonun kendi değişkenine aittir. `main`'deki `puan` hiç değiştirilmiyor, `mut` olması gerekmez."
```

Parametreyi `mut` yapmak (`fn f(mut x: T)`), `let mut x = ...;` yazmakla aynıdır: değer artık fonksiyonun
**kendi** değişkenindedir ve onu istediği gibi değiştirebilir. Bu, çağıranı hiçbir şekilde etkilemez.

## Dönüş değeri sahipliği dışarı verir

Sahiplik fonksiyondan içeri girdiği gibi dışarı da çıkabilir. Bir fonksiyon bir değer **döndürdüğünde**,
o değerin sahipliği çağırana taşınır:

```rust
fn karsilama_mesaji() -> String {
    let mut mesaj = String::from("Hoş geldin");
    mesaj.push_str(", yolcu!");
    mesaj // sahiplik çağırana taşınıyor; burada drop YOK
}

fn main() {
    let ekran = karsilama_mesaji();
    println!("{ekran} ({} bayt, kapasite {})", ekran.len(), ekran.capacity());
} // ekran burada drop edilir
```

```memory
title: karsilama_mesaji() dönerken
steps:
  - caption: "Fonksiyonun içi: `mesaj`, kendi çerçevesinde heap'teki metnin sahibi. `main`'in `ekran` değişkeni henüz değerini bekliyor."
    stack:
      - frame: main
        vars: []
      - frame: karsilama_mesaji
        vars:
          - { name: mesaj, type: String, value: "ptr · len=19 · cap=22", to: h1, mut: true }
    heap:
      - { id: h1, value: "Hoş geldin, yolcu!" }
  - caption: "Dönüş: başlık `main`'deki `ekran`'a taşındı, fonksiyonun çerçevesi kaldırıldı. Heap verisi **yerinde** — yalnızca sahibi değişti, hiçbir şey drop edilmedi."
    stack:
      - frame: main
        vars:
          - { name: ekran, type: String, value: "ptr · len=19 · cap=22", to: h1 }
    heap:
      - { id: h1, value: "Hoş geldin, yolcu!" }
```

Bu, C'deki klasik bir sorunu kökünden çözer. C'de fonksiyon içindeki bir diziye işaretçi döndürürsen,
dizi fonksiyonun stack çerçevesiyle birlikte yok olur ve elinde **sarkan bir işaretçi** kalır.
`malloc` ile ayırıp döndürürsen bu sefer başka bir soru doğar: "bunu kim `free` edecek?" Cevap ancak bir
yorum satırında ya da dokümantasyonda yazar. Rust'ta cevap **tipin kendisindedir**: `-> String` diyen bir
fonksiyon, "bu değerin sahipliğini sana veriyorum, artık sorumluluk senin" demektir; temizliği de
kural 3 halleder.

Böylece bir fonksiyon imzası bir **sözleşmeye** dönüşür:

| İmza | Sahiplik açısından anlamı |
|---|---|
| `fn arsivle(rapor: String)` | "Değeri bana ver, geri vermeyeceğim." — **tüketir** |
| `fn rapor_olustur() -> String` | "Yeni bir değer üretip sahipliğini sana veririm." — **üretir** |
| `fn duzelt(rapor: String) -> String` | "Al, işle, geri ver." |
| `fn incele(rapor: String) -> (String, usize)` | "Geri veririm, yanında bir de sonuç." |
| `fn puanla(not: i32) -> i32` | "Kopyasını alırım; seninki sende kalır." (`Copy` tip) |

```quiz
question: |
  `fn faturayi_kapat(fatura: String)` imzalı bir fonksiyonu `faturayi_kapat(f);` diye çağırdın
  (`f` bir `String`). Çağrıdan sonra hangisi doğrudur?
options:
  - "`f` kullanılmaya devam edebilir; fonksiyon işi bitince değeri geri verir"
  - "`f` artık kullanılamaz; değer fonksiyona taşındı ve fonksiyonun sonunda drop edildi"
  - "`f` kullanılabilir ama içi boş bir `String`'dir"
  - "Derleyici `f`'yi otomatik olarak kopyalayıp fonksiyona kopyayı verir"
answer: 1
explanation: |
  İmzada dönüş tipi yok: fonksiyon değeri **tüketir**. Sahiplik `fatura` parametresine taşındı;
  parametrenin kapsamı fonksiyonun sonunda bittiği için değer orada drop edildi (fonksiyon onu başka bir
  yere taşımadıysa — ama her durumda sana geri gelmez). `f`'yi kullanmaya kalkarsan `E0382` alırsın.
feedback:
  - "Değeri geri vermek için imzada bir dönüş tipi (`-> String`) olması gerekirdi."
  - Doğru! Dönüş tipi olmayan, `String` alan bir fonksiyon değeri tüketir.
  - "Rust taşınmış değişkeni \"boş\" bırakmaz; onu tamamen kullanılamaz sayar."
  - Rust asla gizlice heap kopyası yapmaz; kopya istiyorsan `f.clone()` yazmalısın.
```

"Tüketen" fonksiyonun en saf örneği standart kütüphanede: **`drop`**. Bir değeri kapsamın sonunu
beklemeden **bilerek erken** bırakmak istediğinde `drop(deger)` çağırırsın. İşin sırrı şu: `drop`'un
gövdesi **boştur**! Değeri parametre olarak alır (sahiplik taşınır) ve hiçbir şey yapmadan biter;
parametrenin kapsamı bittiği için değer, kural 3 gereği orada drop edilir. (Tam tanımı
`fn drop<T>(_x: T) {}`; `<T>` "her tip olabilir" demektir, generic'leri Modül 11'de göreceksin.)

```rust
# struct Balon(&'static str);
# impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
fn main() {
    let balon = Balon("turuncu");
    drop(balon); // sahiplik drop fonksiyonuna taşındı; fonksiyon bitince balon patlar
    println!("main devam ediyor"); // balon burada çoktan yok
    // println!("{}", balon.0); // ← açarsan E0382: balon taşındı
}
```

## Al, işle, geri ver

Değeri alıp değiştiren ve sonra geri veren fonksiyonlar Rust'ta yaygın bir kalıptır. Parametreyi `mut`
yaparsın, değeri değiştirirsin ve son ifade olarak geri döndürürsün:

```rust
fn soyad_ekle(mut ad: String) -> String {
    ad.push_str(" Yılmaz");
    ad
}

fn unvan_ekle(mut ad: String) -> String {
    ad.push_str(", Öğretmen");
    ad
}

fn main() {
    let ad = String::from("Elif");
    let ad = soyad_ekle(ad); // ver, geri al (gölgeleme)
    let ad = unvan_ekle(ad); // tekrar ver, tekrar geri al
    println!("{ad}");
}
```

Heap verisi baştan sona aynı yerde kalır ve sadece büyür; fonksiyonlar arasında gidip gelen her
seferinde 24 baytlık başlıktır. Gölgeleme (Modül 2) burada çok işe yarar: geri gelen değere aynı ismi
vererek kodu temiz tutarız.

:::analogy Kuru temizleme
Ceketini kuru temizlemeciye verirsin (taşıma). Ceket dükkândayken onu giyemezsin. Temizlemeci onu
temizler (`mut` parametre) ve **fişini göstererek** geri alırsın (dönüş değeri). Ama fişi alıp ceketini
almadan çıkarsan, ceket sende değildir — dönüş değerini bir değişkene almazsan aynı durum Rust'ta da olur.
:::

Bu son cümleyi test edelim:

```compiles
code: |
  fn soyad_ekle(mut ad: String) -> String {
      ad.push_str(" Yılmaz");
      ad
  }

  fn main() {
      let ad = String::from("Elif");
      soyad_ekle(ad);
      println!("{ad}");
  }
answer: false
error: E0382
explanation: |
  `soyad_ekle(ad)` değeri taşıdı ve büyütülmüş metni geri **döndürdü**, ama dönen değer hiçbir değişkene
  alınmadı. Sahibi olmayan dönüş değeri o satırın sonunda drop edildi; `ad` ise çoktan taşınmıştı.
  Derleyicinin `help` satırı burada da `ad.clone()` önerir — ama doğru çözüm kopya değil, dönen değeri
  yakalamaktır: `let ad = soyad_ekle(ad);`
```

Bir de Modül 3'ün en ünlü tuzağı. Bu fonksiyon derlenir mi?

````compiles
code: |
  fn unlem_ekle(mut s: String) -> String {
      s.push('!');
      s;
  }

  fn main() {
      let s = unlem_ekle(String::from("Harika"));
      println!("{s}");
  }
answer: false
error: E0308
explanation: |
  Son satırdaki `s;` bir **deyim**dir (Modül 3): noktalı virgül ifadeyi değerinden ayırır ve gövde `()`
  döndürür. İmza `String` söz verdiği için tipler uyuşmaz:

  ```text
  error[E0308]: mismatched types
   --> src/main.rs:1:33
    |
  1 | fn unlem_ekle(mut s: String) -> String {
    |    ----------                   ^^^^^^ expected `String`, found `()`
    |    |
    |    implicitly returns `()` as its body has no tail or `return` expression
  2 |     s.push('!');
  3 |     s;
    |      - help: remove this semicolon to return this value
  ```

  Sahiplik açısından da ilginç: noktalı virgüllü hâliyle `s` dışarı verilmez, tam o `s;` satırında drop
  edilirdi (derleyici ayrıca `path statement drops value` uyarısı verir). Noktalı virgülü kaldırınca
  sahiplik çağırana taşınır.
````

````exercise
id: m04-e-dilekce
title: Dilekçe hattı
difficulty: 2
prompt: |
  Bir okulun öğrenci işleri programı, bir dilekçeyi üç fonksiyondan geçirerek hazırlıyor. Her fonksiyon
  dilekçenin sahipliğini alıp metin ekliyor ve **geri veriyor**. Ama `main` dönen değerleri kullanmıyor ve
  program derlenmiyor.

  Fonksiyonlara dokunmadan **sadece `main`'i** düzelt. Çıktı şu olmalı:

  ```text
  Sayın Yetkili,
  Kayıt yenileme talebimi arz ederim.
  Saygılarımla,
  Mert Demir
  ```
starter: |
  fn selam_ekle(mut d: String) -> String {
      d.push_str("Sayın Yetkili,\n");
      d
  }

  fn govde_ekle(mut d: String) -> String {
      d.push_str("Kayıt yenileme talebimi arz ederim.\n");
      d
  }

  fn imza_ekle(mut d: String) -> String {
      d.push_str("Saygılarımla,\nMert Demir");
      d
  }

  fn main() {
      let dilekce = String::new();
      selam_ekle(dilekce);
      govde_ekle(dilekce);
      imza_ekle(dilekce);
      println!("{dilekce}");
  }
starter_compiles: false
solution: |
  fn selam_ekle(mut d: String) -> String {
      d.push_str("Sayın Yetkili,\n");
      d
  }

  fn govde_ekle(mut d: String) -> String {
      d.push_str("Kayıt yenileme talebimi arz ederim.\n");
      d
  }

  fn imza_ekle(mut d: String) -> String {
      d.push_str("Saygılarımla,\nMert Demir");
      d
  }

  fn main() {
      let dilekce = String::new();
      let dilekce = selam_ekle(dilekce);
      let dilekce = govde_ekle(dilekce);
      let dilekce = imza_ekle(dilekce);
      println!("{dilekce}");
  }
check: output
expected_output: |
  Sayın Yetkili,
  Kayıt yenileme talebimi arz ederim.
  Saygılarımla,
  Mert Demir
forbid:
  - pattern: '\.clone\('
    message: "`clone` gerekmiyor: fonksiyonlar değeri zaten geri veriyor!"
  - pattern: 'Sayın[\s\S]*Sayın|arz ederim[\s\S]*arz ederim|Mert Demir[\s\S]*Mert Demir'
    message: Metni elle yazma; dilekçe fonksiyonlardan geçerek oluşmalı.
require:
  - pattern: '(=|\()\s*selam_ekle\('
    message: "`selam_ekle`'nin döndürdüğü değer kullanılmalı (ör. `let dilekce = selam_ekle(dilekce);`)."
  - pattern: '(=|\()\s*govde_ekle\('
    message: "`govde_ekle`'nin döndürdüğü değer kullanılmalı (ör. `let dilekce = govde_ekle(dilekce);`)."
  - pattern: '(=|\()\s*imza_ekle\('
    message: "`imza_ekle`'nin döndürdüğü değer kullanılmalı (ör. `let dilekce = imza_ekle(dilekce);`)."
hints:
  - "Derleyici `selam_ekle(dilekce);` satırında değerin taşındığını, bir sonraki satırda da taşınmış değerin kullanıldığını söylüyor."
  - "Her fonksiyon büyütülmüş dilekçeyi **geri döndürüyor**. Dönen değeri bir değişkene almazsan, o satırın sonunda drop edilir."
  - "Her çağrıyı gölgeleme ile yaz: `let dilekce = selam_ekle(dilekce);` — diğer ikisi için de aynısını yap."
explanation: |
  Her çağrı dilekçeyi fonksiyona **taşır**, fonksiyon da büyütülmüş hâlini geri **taşır**. Dönen değeri
  `let dilekce = ...;` ile yakaladığımızda sahiplik zinciri kopmaz: heap'teki metin baştan sona tek bir
  sahipten diğerine geçer, hiç kopyalanmaz.

  Alternatif: çağrıları iç içe yazmak da aynı işi görür:

  ```rust,ignore
  let dilekce = imza_ekle(govde_ekle(selam_ekle(String::new())));
  ```

  En içteki çağrının sonucu doğrudan bir sonrakine taşınır. Okunabilirlik için çoğu zaman adım adım
  gölgeleme tercih edilir.
````

## Sahipliği geri vermek: tuple

Peki fonksiyon bir **sonuç** hesaplasın ama değeri de geri versin istiyorsak? Örneğin bir metnin
uzunluğunu ölçen ama metni yutmayan bir fonksiyon. Bir fonksiyon yalnızca tek bir değer döndürebilir —
ama o değer bir **tuple** (Modül 2) olabilir. Önce şu kısa yolu dene:

````compiles
code: |
  fn uzunluk_ve_kendisi(s: String) -> (String, usize) {
      (s, s.len())
  }

  fn main() {
      let (s, n) = uzunluk_ve_kendisi(String::from("rust"));
      println!("{s}: {n}");
  }
answer: false
error: E0382
explanation: |
  Tuple'ın elemanları **soldan sağa** değerlendirilir. Önce `s` tuple'ın içine **taşınır**; ardından
  `s.len()` çağrısı taşınmış bir değeri kullanmaya çalışır:

  ```text
  error[E0382]: borrow of moved value: `s`
    |
    |     (s, s.len())
    |      -  ^ value borrowed here after move
    |      |
    |      value moved here
  ```

  Çözüm Ders 3'teki kalıp: **işini taşımadan önce bitir**. Önce `let n = s.len();`, sonra `(s, n)`.
  Ya da sırayı çevir: `(s.len(), s)` derlenir, çünkü uzunluk `s` taşınmadan önce ölçülür — ama o zaman
  tuple'ın tipi de `(usize, String)` olur.
````

Doğru sürüm:

```rust
fn uzunluk_ve_kendisi(s: String) -> (String, usize) {
    let n = s.len(); // önce ölç (len sadece okur)
    (s, n) // sonra taşı
}

fn main() {
    let sehir = String::from("Eskişehir");
    let (sehir, n) = uzunluk_ve_kendisi(sehir); // sahiplik geri geldi
    println!("{sehir}: {n} bayt");
}
```

Çağıran taraftaki `let (sehir, n) = ...;` satırı tuple'ı açar (destructuring, Modül 2): ilk eleman
`String`'in sahipliğini geri alır, ikincisi sayıyı. Şimdi aynı kalıbı sen kur:

```fill
prompt: |
  `unlemle_bitiyor_mu` bir metin alıp metni **geri veriyor**, yanında da metnin `"!"` ile bitip
  bitmediğini döndürüyor. Boşlukları doldur; program `Dikkat!: true` yazdırmalı.
code: |
  fn unlemle_bitiyor_mu(s: String) -> (String, ___0) {
      let sonuc = s.ends_with('!');
      (___1, sonuc)
  }

  fn main() {
      let uyari = String::from("Dikkat!");
      let (uyari, var_mi) = unlemle_bitiyor_mu(___2);
      println!("{uyari}: {var_mi}");
  }
blanks:
  - ["bool"]
  - ["s"]
  - ["uyari"]
output: "Dikkat!: true"
explanation: |
  `ends_with` metnin verilen karakterle bitip bitmediğini söyleyen bir `bool` döndürür; değeri yalnızca
  okur, taşımaz. Bu yüzden önce sonucu hesaplayıp sonra `s`'yi tuple'ın içinde geri taşıyabiliyoruz.
  Çağıranda `let (uyari, var_mi) = ...;` hem metnin sahipliğini geri alır hem de sonucu açar.
```

## Neden zahmetli?

Tuple ile geri vermek **çalışır**. Ama bir metin hakkında üç farklı şey öğrenmek istediğini düşün:

```rust
fn uzunluk(s: String) -> (String, usize) {
    let n = s.len();
    (s, n)
}

fn bosluk_sayisi(s: String) -> (String, usize) {
    let mut sayi = 0;
    for harf in s.chars() {
        if harf == ' ' {
            sayi += 1;
        }
    }
    (s, sayi)
}

fn unlemle_bitiyor_mu(s: String) -> (String, bool) {
    let sonuc = s.ends_with('!');
    (s, sonuc)
}

fn main() {
    let cumle = String::from("Rust ile güvenli kod yazmak çok keyifli!");
    let (cumle, n) = uzunluk(cumle);
    let (cumle, b) = bosluk_sayisi(cumle);
    let (cumle, u) = unlemle_bitiyor_mu(cumle);
    println!("\"{cumle}\"");
    println!("{n} bayt, {b} boşluk, ünlemle bitiyor mu: {u}");
}
```

(`for harf in s.chars()` bir metnin karakterlerini tek tek gezer; ayrıntısı Modül 9'da.)

Kod doğru, ama bir şeyler ters: üç fonksiyonun hiçbiri metni **değiştirmiyor**, hepsi sadece **okuyor**.
Yine de her biri sahipliği alıp geri vermek zorunda; her çağrıda tuple açıp aynı ismi yeniden bağlıyoruz;
fonksiyon imzaları asıl söylemek istediğimizi ("bu fonksiyon metne sadece bakar") gizliyor. Birini
geri vermeyi unutursan metni kaybedersin.

Gerçek hayatta bir arkadaşın kitabına bakmak istediğinde ondan **tapusunu** istemezsin; kitabı **ödünç**
alırsın. Rust'ta bunun karşılığı **referanslar (references)** ve **ödünç alma (borrowing)**. Bir sonraki
modülün konusu tam olarak bu. Bir fragman:

```rust
fn uzunluk(s: &String) -> usize { // & : "sadece ödünç al"
    s.len()
}

fn main() {
    let cumle = String::from("Rust ile güvenli kod");
    let n = uzunluk(&cumle); // cumle'yi ödünç ver, sahiplik bende kalsın
    println!("{cumle}: {n} bayt"); // cumle hâlâ geçerli!
}
```

Tuple yok, gölgeleme yok, kayıp yok. `&` işaretinin bütün kurallarını Modül 5'te öğreneceksin.

:::ferris
Tuple ile geri vermek zahmetli geldiyse doğru yoldasın! Bu sıkıntıyı hissetmek, Modül 5'teki ödünç
almanın neden bu kadar değerli olduğunu anlamanın en iyi yolu. 🦀
:::

## Alıştırma: sesli harf sayacı

````exercise
id: m04-e-sesli-harf
title: Sesli harf sayacı
difficulty: 3
prompt: |
  Bir Türkçe öğrenme uygulaması için `sesli_harf_say` fonksiyonunu yaz. Fonksiyon bir metnin
  sahipliğini alır, içindeki **sesli harfleri** sayar ve metni **geri verir**: dönüş tipi
  `(String, usize)`.

  Türkçe sesli harfler: `a e ı i o ö u ü` ve büyük hâlleri `A E I İ O Ö U Ü`.

  | çağrı | sonuç |
  |---|---|
  | `sesli_harf_say(String::from("merhaba"))` | `("merhaba", 3)` |
  | `sesli_harf_say(String::from("İstanbul"))` | `("İstanbul", 3)` |
  | `sesli_harf_say(String::new())` | `("", 0)` |
starter: |
  fn sesli_harf_say(metin: String) -> (String, usize) {
      todo!()
  }

  fn main() {
      let kelime = String::from("merhaba");
      let (kelime, sayi) = sesli_harf_say(kelime);
      println!("{kelime}: {sayi} sesli harf");
  }
solution: |
  fn sesli_harf_say(metin: String) -> (String, usize) {
      let sesliler = "aeıioöuüAEIİOÖUÜ";
      let mut sayi = 0;
      for harf in metin.chars() {
          if sesliler.contains(harf) {
              sayi += 1;
          }
      }
      (metin, sayi)
  }

  fn main() {
      let kelime = String::from("merhaba");
      let (kelime, sayi) = sesli_harf_say(kelime);
      println!("{kelime}: {sayi} sesli harf");
  }
check: tests
tests: |
  #[test]
  fn kucuk_harfli_kelime() {
      let (_, sayi) = sesli_harf_say(String::from("merhaba"));
      assert_eq!(sayi, 3, "\"merhaba\": e, a, a → 3 sesli harf");
  }

  #[test]
  fn metni_degistirmeden_geri_verir() {
      let (metin, _) = sesli_harf_say(String::from("Ödev teslim"));
      assert_eq!(metin, "Ödev teslim", "metin olduğu gibi geri verilmeli");
  }

  #[test]
  fn buyuk_ve_turkce_harfler() {
      let (_, sayi) = sesli_harf_say(String::from("İstanbul"));
      assert_eq!(sayi, 3, "\"İstanbul\": İ, a, u → 3 (büyük İ de sesli harftir)");
      let (_, sayi) = sesli_harf_say(String::from("ÖĞÜT"));
      assert_eq!(sayi, 2, "\"ÖĞÜT\": Ö, Ü → 2 (Ğ ünsüzdür)");
  }

  #[test]
  fn sesli_harfsiz_ve_bos_metin() {
      assert_eq!(sesli_harf_say(String::from("rst!")).1, 0, "\"rst!\" içinde sesli harf yok");
      let (metin, sayi) = sesli_harf_say(String::new());
      assert_eq!((metin.as_str(), sayi), ("", 0), "boş metin: boş metin ve 0");
  }

  #[test]
  fn bosluklu_cumle() {
      let (_, sayi) = sesli_harf_say(String::from("Çay ve simit"));
      assert_eq!(sayi, 4, "\"Çay ve simit\": a, e, i, i → 4");
  }
hints:
  - "Bir sayaç (`let mut sayi = 0;`) tut ve `for harf in metin.chars()` ile karakterleri tek tek gez. `chars()` metni taşımaz, sadece üzerinde gezinir."
  - "Bir karakterin sesli olup olmadığını anlamanın kısa yolu: bütün sesli harfleri bir metne yaz ve `contains` sor: `\"aeıioöuüAEIİOÖUÜ\".contains(harf)` bir `bool` döndürür."
  - "Döngüden sonra metni geri ver: fonksiyonun son ifadesi noktalı virgülsüz `(metin, sayi)` olmalı."
explanation: |
  Fonksiyon metnin sahibi olduğu için onu okuyabilir ve sonunda geri taşıyabilir. `metin.chars()` ve
  `sesliler.contains(harf)` değeri yalnızca **okur**; bu yüzden döngüden sonra `metin` hâlâ geçerlidir ve
  `(metin, sayi)` ile çağırana geri verilebilir. `sayi`'nin tipi, dönüş tipinden dolayı `usize` olarak
  çıkarılır (tip çıkarımı, Modül 2).

  Neden baytlar değil de `chars()`? Çünkü `ö`, `ü`, `İ` gibi harfler birden fazla bayt tutar (bu yüzden
  `"İstanbul".len()` 8 değil 9'dur); baytlar üzerinde gezinmek harfleri bölerdi. `chars()` her seferinde tam bir `char` (Modül 2) verir.

  **Dikkat**: Bu fonksiyon metni hiç değiştirmiyor, sadece okuyor; yine de sahipliği alıp geri vermek
  zorunda kaldık. Modül 5'te böyle fonksiyonları `fn sesli_harf_say(metin: &str) -> usize` gibi bir
  imzayla, tuple olmadan yazmayı öğreneceksin.
````

## Özet

:::remember
- Fonksiyon çağırmak, argümanı parametreye **atamak** gibidir: `Copy` olmayan değerler **taşınır**,
  `Copy` olanlar kopyalanır.
- Taşınan değer, geri döndürülmezse fonksiyonun sonunda **drop edilir**.
- Dönüş değeri sahipliği çağırana **taşır**; heap verisi yerinde kalır, drop olmaz.
- İmza bir sözleşmedir: `fn f(s: String)` tüketir, `fn f() -> String` üretir, `fn f(s: String) -> String`
  al-işle-geri ver demektir.
- Dönen değeri yakalamayı unutma (`let s = f(s);`); son ifadeye noktalı virgül koyma (`E0308`).
- Sahipliği geri verip bir de sonuç döndürmek için **tuple**: `(s, n)`. Ama önce hesapla, sonra taşı.
- Sadece okuyan fonksiyonlar için tuple zahmetlidir → çözüm Modül 5'te: **referanslar**.
:::

```reflect
prompt: |
  `fn sesli_harf_say(metin: String) -> (String, usize)` imzası, fonksiyonun gerçekte yaptığı işi neden
  yanlış anlatıyor? Sahiplik açısından bu fonksiyonun gerçekte neye ihtiyacı var?
answer: |
  İmza, fonksiyonun metnin **sahipliğini** istediğini söylüyor; oysa fonksiyon metni ne değiştiriyor ne de
  saklıyor, sadece okuyor. Sahipliği almak zorunda olduğu için onu tuple içinde geri vermesi gerekiyor ve
  çağıran da her seferinde tuple'ı açıp değişkeni yeniden bağlamak zorunda kalıyor. Geri vermeyi unutursa
  metin fonksiyonun sonunda drop edilir. Fonksiyonun gerçekte ihtiyacı olan şey metne geçici olarak
  **bakabilmek**, yani ödünç almak; Modül 5'teki referanslar tam bunu sağlar: sahiplik çağıranda kalır.
```

```flashcards
- front: "`f(x)` çağrısında `x` bir `String` ise ne olur?"
  back: "Sahiplik `f`'nin parametresine taşınır; `x` artık kullanılamaz. Değer geri döndürülmezse `f`'nin sonunda drop edilir."
- front: "`fn ikiye_katla(mut n: i32)` içinde `n` değiştirilirse çağıranın değişkeni değişir mi?"
  back: "Hayır. `i32` `Copy`'dir; fonksiyona kopya gider. Parametredeki `mut` yalnızca fonksiyonun kendi değişkenine aittir."
- front: Bir fonksiyon bir `String` döndürdüğünde heap verisine ne olur?
  back: Yerinde kalır; yalnızca başlık çağırana taşınır ve sahiplik çağırana geçer. Drop olmaz.
- front: "`fn arsivle(rapor: String)` imzası sahiplik hakkında ne söyler?"
  back: Fonksiyon değeri tüketir; sahipliği alır ve geri vermez. Değer fonksiyonun sonunda drop edilir.
- front: "`let ad = String::from(\"Elif\"); soyad_ekle(ad); println!(\"{ad}\");` neden derlenmez ve doğru çözüm nedir?"
  back: "`ad` taşındı ve dönen değer yakalanmadı (`E0382`). Çözüm `clone` değil: `let ad = soyad_ekle(ad);`"
- front: "`(s, s.len())` neden `E0382` verir?"
  back: Tuple elemanları soldan sağa değerlendirilir; `s` önce taşınır, sonra `s.len()` taşınmış değeri kullanır. Önce `let n = s.len();` yaz.
- front: Sahipliği tuple ile geri vermenin dezavantajı nedir?
  back: Sadece okuyan fonksiyonlar bile sahiplik alıp geri vermek zorunda kalır; her çağrıda tuple açmak gerekir. Çözüm Modül 5'teki referanslardır.
```
