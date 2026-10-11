---
id: m04-l03
title: Taşıma (move)
minutes: 18
type: lesson
objectives:
  - Bir atamanın, fonksiyon çağrısının ya da döngünün bir değeri ne zaman **taşıdığını** söyleyebilmek
  - Taşıma sırasında stack ve heap'te ne olduğunu bellek diyagramıyla adım adım açıklayabilmek
  - "`E0382` hatasının etiketli satırlarını okuyup hatayı `clone` kullanmadan düzeltebilmek"
  - Taşımanın, değerin drop edileceği yeri de değiştirdiğini bir örnek üzerinde gösterebilmek
keywords: [move, taşıma, sahiplik, E0382, String, Vec, double free, use of moved value]
---

Önceki derste her değerin **tek bir sahibi** olduğunu ve iç bloktan dışarı verilen bir `String`'in drop
edilmediğini, sadece **sahibinin değiştiğini** gördün. Bu derste o sahip değişikliğinin kendisini
inceleyeceğiz: **taşıma (move)**.

Taşıma, Rust'a yeni gelenlerin en çok şaşırdığı kuraldır. Python, Java ya da JavaScript'te `b = a`
yazmak hiçbir şeyi bozmaz; Rust'ta ise bazen `a`'yı bir daha kullanamazsın. Bunun keyfî bir yasak değil,
önceki iki derste gördüğün bellek hatalarına karşı alınmış bir önlem olduğunu göreceksin.

:::ferris
Bu ders Rust yolculuğunun dönüm noktalarından biri. Taşımayı anladığında derleyicinin `E0382` mesajları
sana bir azar değil, bir harita gibi gelecek! 🦀
:::

## Önce tahmin et

Aşağıdaki iki program neredeyse aynı. Biri `i32`, diğeri `String` kullanıyor. Açıklamaları okumadan
önce ikisi için de karar ver, yanılsan bile tahmin etmek öğrenmeni güçlendirir.

```compiles
code: |
  fn main() {
      let a = 5;
      let b = a;
      println!("a = {a}, b = {b}");
  }
answer: true
explanation: |
  `i32` atamada **kopyalanır**: `a` ve `b` birbirinden bağımsız iki `5` değeridir; ikisi de geçerlidir.
  Şimdilik kaba bir kural olarak düşün: heap'te hiçbir şey tutmayan `i32`, `bool`, `char` gibi basit
  tipler kopyalanır. Kuralın tam hâlini (`Copy` trait'i) Ders 4'te göreceksin.
```

```compiles
code: |
  fn main() {
      let s1 = String::from("merhaba");
      let s2 = s1;
      println!("s1 = {s1}, s2 = {s2}");
  }
answer: false
error: E0382
explanation: |
  `String` heap'te veri tutar. `let s2 = s1;` satırı heap'teki veriyi kopyalamaz; **sahipliği `s2`'ye
  taşır**. Taşımadan sonra `s1` artık geçersizdir ve onu kullanmaya çalışmak `E0382` hatası verir.
  Neden böyle olduğunu bir sonraki adımda bellek diyagramıyla göreceğiz.
```

## Bellekte ne olur?

Ders 1'den hatırla: bir `String` stack'te üç parçalı bir **başlık** tutar, heap'teki veriye
**işaretçi (ptr)**, **uzunluk (len)** ve **kapasite (cap)**, karakterlerin kendisi heap'tedir.
`let s2 = s1;` satırını adım adım izle:

```memory
title: let s2 = s1; adım adım
steps:
  - caption: "`s1` oluşturuldu: stack'te işaretçi + uzunluk + kapasite, heap'te karakterler."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "`let s2 = s1;` yalnızca stack'teki 24 baytlık başlığı kopyalar. Heap'teki karakterlere **dokunulmaz**."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: s2, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "Rust `s1`'i **geçersiz** sayar. Artık heap verisinin tek sahibi `s2`'dir; kapsam sonunda belleği yalnızca o geri verecek."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", moved: true, note: taşındı }
          - { name: s2, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
```

İkinci adıma dikkat et: bir an için **iki** başlık aynı heap alanını gösteriyor. Rust `s1`'i geçersiz
saymasaydı ne olurdu? Kural 3'e göre ikisi de kapsamın sonunda kendi değerini drop ederdi:

```memory
title: "Rust taşımasaydı: double free"
steps:
  - caption: "Varsayalım ki `s1` ve `s2` ikisi de geçerli. `main`'in `}`'si geldi; önce `s2` drop edilir ve heap alanını geri verir."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: s2, type: String, value: "ptr · len=7 · cap=7", to: h1, note: drop edildi }
    heap:
      - { id: h1, value: "m e r h a b a", freed: true, label: "geri verildi" }
  - caption: "Sonra `s1` drop edilir ve **aynı** alanı ikinci kez geri vermeye çalışır: double free! Rust bu durumu derleme zamanında imkânsız kılar."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", to: h1, note: "ikinci free!" }
    heap:
      - { id: h1, value: "m e r h a b a", freed: true, label: "ZATEN geri verilmişti" }
```

Bir dil `b = a` gördüğünde aslında üç şeyden birini yapabilir:

| Yaklaşım | Örnek dil | Ne olur? | Bedeli |
|---|---|---|---|
| **Derin kopya** | C++: `std::string s2 = s1;` | Heap verisi de kopyalanır; iki bağımsız metin | Her atama gizlice bellek ayırır ve bayt kopyalar |
| **Paylaşım** | Python, Java, JS: `b = a` | İki isim aynı nesneyi gösterir; temizliği GC yapar | GC maliyeti; birinden yapılan değişiklik ötekinde de görünür |
| **Taşıma** | Rust: `let s2 = s1;` | Sadece başlık kopyalanır, eski isim geçersiz olur | Eski ismi kullanamazsın, derleyici bunu denetler |

Rust'ın seçimi hem **ucuz** (24 bayt kopyalanır, metin ne kadar uzun olursa olsun) hem de **güvenli**
(heap verisinin her an tek sahibi var). Derin kopya istiyorsan bunu açıkça söylersin; bir sonraki dersin
konusu `.clone()` tam olarak bu.

:::analogy Ev tapusu
Bir evin tapusunu birine devrettiğinde evin kendisini kopyalamazsın, sadece **sahiplik belgesi** el
değiştirir. Devirden sonra eski tapun geçersizdir; evi satmaya kalkarsan noter seni durdurur. Rust'ta
noterin adı **borrow checker**'dır ve kontrolü ev satılmadan, yani program çalışmadan önce yapar.
:::

Heap verisinin gerçekten yerinden kıpırdamadığını kendin görebilirsin. `as_ptr()` metodu bir
`String`'in heap verisinin **adresini** verir (adreslerin kendisiyle çalışmayı Modül 24'te göreceğiz;
şimdilik onu bir ölçü aleti gibi kullanıyoruz):

```rust
fn main() {
    let s1 = String::from("merhaba");
    let adres_once = s1.as_ptr(); // heap verisinin adresi
    let s2 = s1; // taşıma
    let adres_sonra = s2.as_ptr();
    println!("Heap verisi aynı yerde mi? {}", adres_once == adres_sonra);
    println!("{s2}");
}
```

```quiz
question: "`let s2 = s1;` (`s1` bir `String`) satırı çalıştığında heap'teki karakterlere ne olur?"
options:
  - Karakterler heap'te ikinci kez kopyalanır; `s1` ve `s2` ayrı metinlere sahip olur
  - Hiçbir şey; yalnızca stack'teki işaretçi, uzunluk ve kapasite kopyalanır ve sahiplik `s2`'ye geçer
  - Karakterler silinir, `s2` boş bir `String` olarak başlar
  - "`s1` ve `s2` aynı karakterleri paylaşır ve ikisi de kullanılmaya devam edebilir"
answer: 1
explanation: |
  Taşıma **ucuzdur**: yalnızca stack'teki üç küçük değer (24 bayt) kopyalanır. Heap verisi yerinde kalır,
  sadece sahibi değişir. Eski sahip `s1` geçersiz sayılır ki aynı bellek iki kez geri verilmesin.
feedback:
  - Bu bir **derin kopya** olurdu (C++'ın varsayılanı). Rust bunu yalnızca sen `.clone()` dediğinde yapar.
  - Doğru! Başlık kopyalanır, sahiplik el değiştirir.
  - Veri kaybolmaz; aynı baytlar yerinde durur, sadece sahibi değişir.
  - "Bu Python/Java tarzı paylaşım olurdu. Rust'ta iki sahip olamaz (kural 2): `s1` geçersiz sayılır."
```

## E0382 hatasını okumak

Dersin başındaki hatalı `String` programını derlediğinde Rust sana tam olarak neyin yanlış gittiğini anlatır:

:::error
```text
error[E0382]: borrow of moved value: `s1`
 --> src/main.rs:4:21
  |
2 |     let s1 = String::from("merhaba");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here
4 |     println!("s1 = {s1}, s2 = {s2}");
  |                     ^^ value borrowed here after move
  |
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let s2 = s1.clone();
  |                ++++++++
```
Okuma sırası: **1)** hata kodu ve özet: *taşınmış bir değerin ödünç alınması* (`println!` bir değeri
yazdırmak için onu ödünç alır, ödünç almayı Modül 5'te göreceğiz). **2)** Konum: `4:21` → 4. satır,
21. sütun. **3)** Etiketli satırlar hikâyeyi yukarıdan aşağı anlatır: `s1` `Copy` olmayan bir `String`
(2. satır), *burada taşındı* (3. satır), *taşındıktan sonra burada kullanıldı* (4. satır).
**4)** `help` bir öneri sunar, ama "performans maliyeti kabul edilebilirse" diye başladığına dikkat et.
:::

Mesajın sonundaki `help` satırı tek çözüm değildir, çoğu zaman en iyisi de değildir. `E0382` ile
karşılaştığında kendine sırayla şunları sor:

1. **Eski ismi gerçekten kullanmam gerekiyor mu?** Çoğu zaman yeni sahibi kullanmak yeterlidir.
2. **İşimi taşımadan önce bitirebilir miyim?** İhtiyacın olan bilgiyi (örneğin uzunluğu) taşımadan önce
   al ya da satırların sırasını değiştir.
3. **Gerçekten iki bağımsız kopya mı lazım?** O zaman bilinçli olarak `.clone()` çağır (Ders 4).
4. **Değeri taşımak yerine ödünç verebilir miyim?** Bu, Modül 5'in konusu.

```rust
fn main() {
    let s1 = String::from("merhaba");
    println!("Taşımadan önce: {s1}"); // önce işini bitir...
    let s2 = s1; // ...sonra taşı
    println!("Taşımadan sonra: {s2}"); // artık yalnızca yeni sahibi kullan
}
```

Taşıma **değişkeni** değil, içindeki **değeri** götürür. Değişken `mut` ise, taşındıktan sonra ona yeni
bir değer verip yeniden kullanabilirsin. Önce tahmin et:

```compiles
code: |
  fn main() {
      let mut kutu = String::from("eski oyuncaklar");
      let bagis = kutu;
      kutu = String::from("yeni oyuncaklar");
      println!("{kutu} / {bagis}");
  }
answer: true
explanation: |
  Derlenir ve `yeni oyuncaklar / eski oyuncaklar` yazar. `let bagis = kutu;` satırından sonra `kutu`
  **boş bir kutu** gibidir: içindeki değer gitti. Ondan *okumak* `E0382` verirdi, ama ona yeni bir değer
  *koymak* serbesttir. Atamadan sonra `kutu` yeniden geçerli bir değerin sahibidir. (Eski değer çoktan
  `bagis`'e geçtiği için bu atama hiçbir şeyi drop etmez.)
```

## Taşıma, drop yerini de taşır

Kural 3'ü hatırla: değer, **sahibi** kapsamdan çıktığında drop edilir. Taşıma sahibi değiştirdiğine göre,
değerin **nerede** drop edileceğini de değiştirir. Ders 2'deki `Balon` tipi yine yanımızda: drop edildiği
anda `... balon patladı` yazıyor. Bu sefer balon iç bloktaki bir değişkene taşınıyor:

```predict
question: Bu program ne yazdırır?
code: |
  # struct Balon(&'static str);
  # impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
  fn main() {
      let kirmizi = Balon("kırmızı");
      {
          let _yeni_sahip = kirmizi;
          println!("iç blok bitiyor");
      }
      println!("main bitiyor");
  }
options:
  - |
    iç blok bitiyor
    main bitiyor
    kırmızı balon patladı
  - |
    iç blok bitiyor
    kırmızı balon patladı
    main bitiyor
  - |
    iç blok bitiyor
    kırmızı balon patladı
    main bitiyor
    kırmızı balon patladı
answer: 1
explanation: |
  Balon iç bloktaki `_yeni_sahip`'e taşındı. Artık onun tek sahibi `_yeni_sahip` ve onun kapsamı iç bloğun
  `}`'sinde bitiyor; balon tam orada patlıyor. `main`'in sonunda `kirmizi` için hiçbir şey yapılmaz,
  çünkü `kirmizi` artık hiçbir değerin sahibi değildir. Değer bir kez oluşturuldu, bir kez drop edildi:
  double free yok.
feedback:
  - "`kirmizi` `main`'de tanımlandı, ama balonun sahibi artık iç bloktaki `_yeni_sahip`. Drop yerini sahip belirler."
  - Doğru! Sahiplik iç bloğa taşındı, drop da onunla birlikte iç bloğa taşındı.
  - Taşınmış değişken kapsam sonunda **drop edilmez**; aksi hâlde aynı balon iki kez patlardı (double free).
```

Derleyici bunu nasıl başarıyor? Her değişken için "şu satırda hâlâ bir değerin sahibi mi?" sorusunu
derleme sırasında yanıtlar ve drop kodunu yalnızca gerçekten sahip olunan değerler için yerleştirir.
Çoğu durumda cevap kesindir ve çalışma zamanında hiçbir sayaç, hiçbir kontrol gerekmez (istisnayı
bir sonraki adımda, koşullu taşımada göreceksin).

Taşıma bir değerin **değişebilirliğini** de serbestçe değiştirebilir. `mut` bir değerin değil, bir
**değişkenin (bağlamanın)** özelliğidir. Değeri `mut` bir değişkene taşırsan, yeni sahip onu
değiştirebilir:

```rust
fn main() {
    let siparis = String::from("2 çay"); // mut değil
    let mut fis = siparis; // değer mut bir değişkene taşındı
    fis.push_str(", 1 simit");
    fis.push_str(", 1 poğaça");
    println!("{fis}");
}
```

Bu, Rust'ta hiç de garip değil: değerin tek sahibi `fis` olduğu için, onu değiştirmek başka hiç kimseyi
etkileyemez. Python'da `fis = siparis` yazıp iki ismin aynı listeyi paylaşmasını sağlasaydın,
`fis.append(...)` iki ismi birden etkilerdi; Rust'ta ise eski isim zaten geçersizdir. Aynı fikirle `let mut siparis = siparis;` yazarak
gölgeleme (Modül 2) ile de bir değeri "değiştirilebilir hâle" getirebilirsin.

:::deep C++'taki std::move ile farkı
C++11 de taşıma kavramını ekledi: `std::string s2 = std::move(s1);`. Ama iki önemli fark var. Birincisi,
C++'ta varsayılan davranış **derin kopyadır**; taşımak için `std::move` yazman gerekir. Rust'ta ise
varsayılan taşımadır, kopya için `.clone()` yazarsın, pahalı işlem görünür olandır. İkincisi, C++'ta
taşınmış `s1` hâlâ kullanılabilir (geçerli ama "belirsiz" bir durumda kalır) ve onu yanlışlıkla okumak
derleyiciyi hiç rahatsız etmez; kapsam sonunda taşınmış nesnenin yıkıcısı (destructor) da yine çalışır.
Rust'ta taşınmış bir değişkeni okumak **derleme hatasıdır** ve onun için drop hiç çalışmaz.

Bir fark daha: C++'ta taşımanın ne yapacağını sınıfı yazan kişi belirler (move constructor). Rust'ta
taşıma **her zaman** değerin baytlarının basit bir kopyasıdır (`memcpy`) ve özelleştirilemez; derleyici
bu kopyayı da çoğu zaman tamamen ortadan kaldırır.
:::

## Fonksiyonlar, koşullar ve döngüler

Atama tek taşıma yolu değil. Bir `String`'i fonksiyona argüman olarak verdiğinde de sahiplik
fonksiyonun **parametresine** taşınır. Fonksiyon bittiğinde parametre kapsamdan çıkar ve değer drop
edilir (geri döndürülmediyse, ayrıntıları Ders 5'te):

```rust
fn kaydet(not: String) {
    println!("Kaydedildi: {not}");
} // not burada drop edilir, heap belleği geri verilir

fn main() {
    let not = String::from("süt al");
    kaydet(not); // sahiplik kaydet'in parametresine taşındı
    // println!("{not}"); // ← bu satırı açarsan E0382 alırsın
    let adet = 3;
    println!("adet hâlâ geçerli: {adet}"); // i32 kopyalanır, taşınmaz
}
```

Yorum satırını açarsan derleyici, `help`'ten önce yeni bir `note` ekler: *"bu parametre değerin
sahipliğini alıyor; sahiplik gerekmiyorsa parametreyi ödünç alacak şekilde değiştirmeyi düşün"*. O
"ödünç alma"nın nasıl yapıldığını Modül 5'te göreceksin.

```predict
code: |
  fn uzunluk(s: String) -> usize {
      s.len()
  }

  fn main() {
      let kelime = String::from("çay");
      let n = uzunluk(kelime);
      println!("{n}");
  }
options:
  - "3"
  - "4"
  - Derlenmez (E0382)
answer: 1
explanation: |
  Program derlenir, çünkü `kelime` taşındıktan sonra bir daha kullanılmıyor - taşımanın kendisi hata
  değildir, taşınmış değeri **kullanmak** hatadır. Peki neden 4? `len()` **bayt** sayısını verir; `ç`
  harfi UTF-8 kodlamasında 2 bayt tutar: `ç`(2) + `a`(1) + `y`(1) = 4. (Bu ayrıntıya Modül 9'da
  döneceğiz.)
feedback:
  - "`len()` karakter değil **bayt** sayar; `ç` 2 bayttır."
  - Doğru! Hem taşıma kuralını hem bayt sayımını yakaladın.
  - "`kelime` taşındı ama sonra hiç kullanılmıyor; taşımanın kendisi hata değil."
```

Peki taşıma **çalışma zamanında** gerçekleşmeyecek bir dalda olursa? Modül 3'teki `if`'i hatırlayarak
tahmin et:

```compiles
code: |
  fn main() {
      let acil = false;
      let mesaj = String::from("Sunucu yavaşladı");
      if acil {
          let _alarm = mesaj;
      }
      println!("{mesaj}");
  }
answer: false
error: E0382
explanation: |
  `acil` `false` olduğu için `if`'in içi hiç çalışmayacak - ama derleyici programı **çalıştırmaz**, sadece
  inceler. Onun bakış açısından `println!`'e iki yoldan gelinebilir ve yollardan birinde `mesaj` taşınmış
  olur. "Belki taşındı" bir değer, kullanılamaz bir değerdir. Rust burada temkinlidir: her olası yolun
  güvenli olduğunu kanıtlayamıyorsa kodu reddeder. Hata mesajı yine `value moved here` diyerek `if`'in
  içindeki satırı gösterir.
```

:::deep Drop bayrakları (drop flags)
Değer yalnızca **bazı** dallarda taşınıyorsa, kapsam sonunda drop gerekip gerekmediği ancak program
çalışırken belli olur. Derleyici bu durumda stack'e gizli, küçük bir **bayrak** koyar: "bu değişken hâlâ
sahip mi?". Kapsam sonunda bayrağa bakar ve yalnızca gerekiyorsa drop eder. Maliyeti tek bir `bool`
kontrolüdür ve çoğu zaman optimize eden derleyici onu da siler.

```rust
# struct Balon(&'static str);
# impl Drop for Balon { fn drop(&mut self) { println!("{} balon patladı", self.0); } }
fn main() {
    let gonder = false; // true yapıp yeniden çalıştır
    let balon = Balon("mor");
    if gonder {
        let _alici = balon; // yalnızca bu dalda taşınır
        println!("balon gönderildi");
    }
    println!("main bitiyor");
} // balon taşınmadıysa burada patlar: derleyici bunu gizli bir bayrakla izler
```

`if`'ten sonra `balon`'u **kullanamazsın** (az önce gördüğün "belki taşındı" kuralı), ama kapsam
sonundaki drop'u derleyici doğru yönetir: değer her durumda tam olarak bir kez drop edilir.
:::

Aynı mantık **döngülerde** daha da sık karşına çıkar. Bir döngünün içinde bir değeri taşırsan, ilk
turda taşınır ve ikinci turda taşınacak bir şey kalmaz:

```rust,compile_fail,E0382
fn main() {
    let mesaj = String::from("Toplantı 14:00'te");
    for _ in 0..3 {
        let gonderilen = mesaj;
        println!("gönderildi: {gonderilen}");
    }
}
```

:::error Döngüde taşıma
```text
error[E0382]: use of moved value: `mesaj`
 --> src/main.rs:4:26
  |
2 |     let mesaj = String::from("Toplantı 14:00'te");
  |         ----- move occurs because `mesaj` has type `String`, which does not implement the `Copy` trait
3 |     for _ in 0..3 {
  |     ------------- inside of this loop
4 |         let gonderilen = mesaj;
  |                          ^^^^^ value moved here, in previous iteration of loop
```
Bu sefer özet **`use of moved value`** diyor: değer okunmak için değil, yine taşınmak için kullanılıyor.
Anahtar ifade `in previous iteration of loop`: *döngünün önceki turunda taşındı*. Döngüler, iteratorlar
ve sahiplik ilişkisini Modül 9 ve 14'te çok daha ayrıntılı göreceksin.
:::

Son olarak: taşıma `String`'e özgü değildir. Heap'te veri tutan **her** tip aynı kurala uyar (aslında
kural daha da geniş: `Copy` olmayan her tip taşınır, Ders 4). Modül 9'da
derinlemesine göreceğin, büyüyebilen liste tipi **`Vec`** de öyle (şimdilik `vec![...]` ile oluşturup
`len()` ile uzunluğuna bakmak yeterli):

```rust,compile_fail,E0382
fn main() {
    let notlar = vec![85, 92, 78];
    let yedek = notlar; // Vec de taşınır!
    println!("{} not var", notlar.len());
    println!("{}", yedek.len());
}
```

Hata mesajı bu kez `move occurs because notlar has type Vec<i32>, which does not implement the Copy
trait` der. Kural aynı: başlık kopyalanır, heap'teki elemanlar yerinde kalır, eski isim geçersiz olur.

## Alıştırma zamanı

Önce kısa bir boşluk doldurma. Fonksiyon bir `String` alıyor ve yeni bir `String` döndürüyor; dönen
değeri aynı isimle gölgeleyerek kullanmaya devam ediyoruz:

```fill
prompt: Boşlukları doldur. Program `RUST` yazdırmalı.
code: |
  fn buyut(s: String) -> ___0 {
      s.to_uppercase()
  }

  fn main() {
      let metin = String::from("rust");
      let metin = buyut(___1);
      println!("{metin}");
  }
blanks:
  - ["String"]
  - ["metin"]
output: RUST
explanation: |
  `buyut` bir `String`'in sahipliğini alır ve **yeni** bir `String` döndürür (`to_uppercase` harfleri
  büyütülmüş yeni bir metin üretir). Eski `metin` fonksiyona taşındı; dönen değeri aynı isimle
  gölgeleyerek (Modül 2) `metin`'i kullanmaya devam ediyoruz. Fonksiyon bittiğinde parametre `s` drop
  edilir; dışarı yalnızca yeni metin çıkar.
```

````exercise
id: m04-e-kargo-etiketi
title: Kargo etiketi
difficulty: 2
prompt: |
  Bir kargo şirketinin programı, alıcının adresini etikete **taşıyor** ve etikete bir uyarı ekliyor. Ama
  en sonda adresin orijinal uzunluğunu da raporlamak istiyor ve bu yüzden derlenmiyor (`E0382`).

  Programı **`clone` kullanmadan** düzelt. Çıktı tam olarak şu olmalı:

  ```text
  Etiket: Atatürk Cad. No: 5, İzmir - KIRILACAK EŞYA
  Adres uzunluğu: 27 bayt
  ```

  İpucu olmadan önce düşün: adresin uzunluğuna **ne zaman** bakman gerekiyor?
starter: |
  fn main() {
      let adres = String::from("Atatürk Cad. No: 5, İzmir");
      let mut etiket = adres;
      etiket.push_str(" - KIRILACAK EŞYA");
      println!("Etiket: {etiket}");
      println!("Adres uzunluğu: {} bayt", adres.len());
  }
starter_compiles: false
solution: |
  fn main() {
      let adres = String::from("Atatürk Cad. No: 5, İzmir");
      let uzunluk = adres.len();
      let mut etiket = adres;
      etiket.push_str(" - KIRILACAK EŞYA");
      println!("Etiket: {etiket}");
      println!("Adres uzunluğu: {uzunluk} bayt");
  }
check: output
expected_output: |
  Etiket: Atatürk Cad. No: 5, İzmir - KIRILACAK EŞYA
  Adres uzunluğu: 27 bayt
forbid:
  - pattern: '\.clone\('
    message: Bu alıştırmayı `clone` kullanmadan çöz, amaç taşımadan önce işini bitirmek!
  - pattern: '27'
    message: "Uzunluğu elle yazma; `len()` ile hesapla (adres değişirse program yine doğru çalışmalı)."
  - pattern: '\.to_string\(\)|\.to_owned\(\)|String::from\(\s*(&|adres)'
    message: Adresin ikinci bir kopyasını oluşturma (bu da gizli bir `clone` olur), taşımadan önce işini bitir!
require:
  - pattern: '\.len\(\)'
    message: Uzunluğu `len()` ile hesaplamalısın.
  - pattern: 'let\s+mut\s+etiket\s*(:\s*String\s*)?=\s*adres\s*;'
    message: "Adres yine etikete taşınmalı: `let mut etiket = adres;` satırı kalsın."
hints:
  - "Hatayı oku: `adres` 3. satırda `etiket`'e taşınıyor ve son satırda taşındıktan **sonra** kullanılıyor."
  - "`adres.len()` bir `usize` (sayı) döndürür ve sayılar `Copy`'dir. Uzunluğu taşımadan **önce** bir değişkene alırsan, o sayı taşımadan etkilenmez."
  - "`let mut etiket = adres;` satırından hemen önce `let uzunluk = adres.len();` yaz; son satırda da `{uzunluk}` kullan."
explanation: |
  Kural "taşınmış değeri kullanma"dır, "taşınacak değeri hiç kullanma" değil. İhtiyacın olan bilgiyi
  (uzunluğu) **taşımadan önce** alırsan sorun kalmaz: `adres.len()` bir `usize` döndürür ve `usize` gibi
  sayılar kopyalanan (`Copy`) tiplerdir. `uzunluk` değişkeni adresin heap verisiyle hiçbir bağ taşımaz,
  bu yüzden taşımadan etkilenmez.

  Neden 27 bayt? Adreste 25 karakter var, ama `ü` ve `İ` bellekte ikişer bayt tutar.

  `etiket.len()` kullanmak işe yaramazdı: etikete uyarı eklendiği için o uzunluk çok daha büyük. Bu
  yüzden "taşımadan önce ölç" kalıbı burada en temiz çözüm. `clone` da derlenirdi, ama sadece bir sayı
  için bütün adresi heap'te kopyalamak gereksiz bir maliyet olurdu.
````

Şimdi taşımayı bilinçli olarak **kullanan** bir fonksiyon yaz. Fonksiyon iki `String` alıyor: birini
dışarı geri verecek, diğeri fonksiyonun sonunda drop edilecek.

````exercise
id: m04-e-en-uzun-isim
title: Takımın en uzun ismi
difficulty: 2
prompt: |
  Bir okul takımının formalarına basılacak isimlerden **daha uzun** olanı seçen `en_uzun` fonksiyonunu
  yaz. Fonksiyon iki `String`'in sahipliğini alır ve **uzunluğu (bayt sayısı) daha büyük olanı**
  döndürür. Uzunluklar eşitse **ilk** parametreyi döndür.

  | çağrı | sonuç |
  |---|---|
  | `en_uzun("Ali", "Zeynep")` | `"Zeynep"` |
  | `en_uzun("Mehmet", "Ece")` | `"Mehmet"` |
  | `en_uzun("Can", "Ece")` | `"Can"` (eşit: ilki) |

  (Tablodaki argümanlar kısalık için tırnakla yazıldı; gerçekte hepsi `String::from(...)` ile oluşturulur.)
starter: |
  fn en_uzun(a: String, b: String) -> String {
      todo!()
  }

  fn main() {
      let kazanan = en_uzun(String::from("Ali"), String::from("Zeynep"));
      println!("Formaya basılacak: {kazanan}");
  }
solution: |
  fn en_uzun(a: String, b: String) -> String {
      if b.len() > a.len() { b } else { a }
  }

  fn main() {
      let kazanan = en_uzun(String::from("Ali"), String::from("Zeynep"));
      println!("Formaya basılacak: {kazanan}");
  }
check: tests
tests: |
  #[test]
  fn ikinci_daha_uzunsa_ikinciyi_dondurur() {
      let sonuc = en_uzun(String::from("Ali"), String::from("Zeynep"));
      assert_eq!(sonuc, "Zeynep", "\"Zeynep\" (6 bayt), \"Ali\"den (3 bayt) uzun");
  }

  #[test]
  fn ilk_daha_uzunsa_ilkini_dondurur() {
      let sonuc = en_uzun(String::from("Mehmet"), String::from("Ece"));
      assert_eq!(sonuc, "Mehmet", "\"Mehmet\" (6 bayt), \"Ece\"den (3 bayt) uzun");
  }

  #[test]
  fn esitlikte_ilk_parametre_kazanir() {
      let sonuc = en_uzun(String::from("Can"), String::from("Ece"));
      assert_eq!(sonuc, "Can", "uzunluklar eşitse (3 = 3) ilk parametre döndürülmeli");
  }

  #[test]
  fn bos_isim_her_zaman_kaybeder() {
      assert_eq!(en_uzun(String::new(), String::from("Su")), "Su", "boş String 0 bayttır");
      assert_eq!(en_uzun(String::from("Su"), String::new()), "Su", "boş String 0 bayttır");
  }

  #[test]
  fn uzunluk_bayt_olarak_olculur() {
      let sonuc = en_uzun(String::from("Şükrü"), String::from("Selim"));
      assert_eq!(sonuc, "Şükrü", "\"Şükrü\" 5 harf ama 8 bayt (ş, ü, ü ikişer bayt); \"Selim\" 5 bayt");
      let sonuc = en_uzun(String::from("Selim"), String::from("Şükrü"));
      assert_eq!(
          sonuc,
          "Şükrü",
          "harf sayısı eşit (5 = 5) ama bayt olarak \"Şükrü\" (8) daha uzun; karakter değil `len()` (bayt) karşılaştır"
      );
  }
hints:
  - "Modül 3'ü hatırla: `if` bir **ifadedir** ve bir değer üretebilir. Fonksiyonun gövdesi tek bir `if ... { ... } else { ... }` olabilir."
  - "Koşul `b.len() > a.len()` olsun. Eşitlikte `a` kazanmalı; bu yüzden `>=` değil `>` kullan."
  - "Tam gövde: `if b.len() > a.len() { b } else { a }`, noktalı virgül yok, çünkü bu ifade fonksiyonun dönüş değeri."
explanation: |
  `if b.len() > a.len() { b } else { a }` bir ifade olduğu için doğrudan fonksiyonun dönüş değeridir
  (Modül 3). Sahiplik açısından olan şu: hangi dal seçilirse o `String` fonksiyondan **dışarı taşınır**;
  seçilmeyen parametre ise fonksiyonun `}`'sinde kapsamdan çıkar ve **drop edilir**. Derleyici her iki
  dalda da hangi değerin taşındığını bildiği için doğru drop kodunu iki dala ayrı ayrı yerleştirir.

  `len()` çağrıları değeri taşımaz, sadece okur; bu yüzden koşulda `a` ve `b`'yi kullandıktan sonra
  dallarda onları taşıyabiliyoruz. Testlerdeki "Şükrü" örneği, `len()`'in karakter değil bayt saydığını
  hatırlatıyor. Karakter saymak istersen `s.chars().count()` kullanabilirsin (Modül 9).
````

## Özet

:::remember
- `Copy` olmayan tipler, örneğin heap verisi tutan `String` ve `Vec`, atamada, fonksiyon çağrısında
  ve döngülerde **taşınır**.
- Taşıma ucuzdur: `String`/`Vec` için yalnızca stack'teki başlık (24 bayt) kopyalanır; heap verisi
  yerinde kalır.
- Taşınan değişken geçersizdir → kullanırsan **E0382** (`borrow of moved value` / `use of moved value`).
- Taşıma, değerin **drop edileceği yeri** de taşır; taşınmış değişken kapsam sonunda drop edilmez.
- `mut` değişkenin özelliğidir: değeri `let mut` bir değişkene taşıyıp değiştirebilirsin; taşınmış `mut`
  bir değişkene yeni değer atayabilirsin.
- Derleyici temkinlidir: bir dalda ya da döngünün önceki turunda "belki taşındı" bir değer kullanılamaz.
- `E0382` çözümleri: yeni sahibi kullan, işini taşımadan önce bitir, bilinçli `clone` (Ders 4), ödünç ver
  (Modül 5).
:::

```reflect
prompt: |
  Kendi cümlelerinle açıkla: `let s2 = s1;` sonrasında Rust neden `s1`'i geçersiz sayıyor? Rust aynı
  satırda heap verisini de kopyalasaydı ne kaybederdik?
answer: |
  İkisi de geçerli kalsaydı, iki başlık aynı heap alanını gösterirdi ve kapsam bittiğinde her ikisi de o
  belleği geri vermeye çalışırdı: double free. Rust, her değerin tek sahibi olması kuralıyla bunu derleme
  zamanında engeller: sahiplik `s2`'ye geçer, `s1` kullanılamaz ve sadece `s2` drop edilir.
  Heap verisini her atamada kopyalamak (C++'ın varsayılanı gibi) güvenli olurdu ama pahalı: her atama
  gizlice bellek ayırır ve bütün baytları kopyalardı. Taşıma ise metnin uzunluğundan bağımsız olarak
  yalnızca 24 baytlık başlığı kopyalar. Rust hem ucuz hem güvenli olanı varsayılan yapıp pahalı kopyayı
  açık bir `.clone()` çağrısına bırakıyor.
```

```flashcards
- front: "`let s2 = s1;` (`s1: String`) satırından sonra `s1` kullanılabilir mi?"
  back: Hayır. Sahiplik `s2`'ye **taşındı**; `s1`'i kullanmak `E0382` hatası verir.
- front: Taşıma (move) sırasında heap'teki veri kopyalanır mı?
  back: Hayır. Sadece stack'teki başlık (işaretçi, uzunluk, kapasite) kopyalanır; sahiplik el değiştirir.
- front: Rust neden taşınan değişkeni geçersiz sayar?
  back: İki sahip aynı belleği kapsam sonunda iki kez serbest bırakmasın (**double free**) diye.
- front: "`E0382` hatasındaki `value moved here, in previous iteration of loop` ne demektir?"
  back: Değer döngünün içinde taşınıyor; ilk turda taşındığı için sonraki turlarda kullanılacak değer kalmıyor.
- front: Bir değer iç bloktaki bir değişkene taşınırsa ne zaman drop edilir?
  back: Yeni sahibinin, yani iç bloktaki değişkenin kapsamı bittiğinde. Taşınmış eski değişken için drop yapılmaz.
- front: "`let a = String::from(\"x\"); let mut b = a; b.push('!');` derlenir mi?"
  back: "Evet. `mut` değişkenin özelliğidir; değer `mut` bir değişkene taşınınca yeni sahip onu değiştirebilir."
- front: "Bir `String`'i `if`'in bir dalında taşıyıp `if`'ten sonra kullanmak neden derlenmez?"
  back: Derleyici programı çalıştırmaz; o dalın çalışabileceğini varsayar. "Belki taşındı" bir değer kullanılamaz.
- front: "`E0382` ile karşılaşınca `clone`'dan önce hangi çözümleri düşünmelisin?"
  back: Yeni sahibi kullanmak, işini taşımadan önce bitirmek (satır sırasını değiştirmek) ve Modül 5'te göreceğin ödünç vermek.
```
