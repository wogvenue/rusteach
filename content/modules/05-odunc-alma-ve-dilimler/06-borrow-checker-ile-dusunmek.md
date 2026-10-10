---
id: m05-l06
title: Borrow checker ile düşünmek
minutes: 22
type: lesson
objectives:
  - "Bir ödünç hatasını \"kim sahip, kim ödünç alıyor, ne kadar süreyle?\" sorularıyla adım adım çözümleyebilmek"
  - "Beş temel düzeltme yolundan (ödüncü kısaltmak, bilinçli `clone`, sahipli veri döndürmek, indeks tutmak, önce okuyup sonra yazmak) duruma uygun olanı seçebilmek"
  - "Bir koleksiyonu dolaşırken değiştirme (E0502) sorununu indeks tabanlı bir döngüyle çözebilmek"
  - "Kısa bir programın derlenip derlenmeyeceğini çalıştırmadan, ödünçlerin zaman çizelgesine bakarak tahmin edebilmek"
keywords: [borrow checker, ödünç denetleyicisi, E0502, E0499, E0506, E0507, clone, indeks, NLL, zihinsel model]
---

Bu modülde ödünç almanın bütün kurallarını öğrendin. Ama kuralları **bilmek** ile gerçek bir programda
kırmızı bir hata mesajıyla karşılaştığında **ne yapacağını bilmek** farklı şeyler. Rust'a yeni başlayan
herkes bir noktada "borrow checker ile kavga ediyorum" hissine kapılır: Bir hatayı düzeltirsin, başka
bir yerde yenisi çıkar. Sonunda her yere `.clone()` serpiştirirsin.

Bu derste kavga etmeyi bırakıp **derleyici gibi düşünmeyi** öğreneceksin. Önce her ödünç hatasını
çözümleyen üç soruluk bir yöntem, sonra en sık kullanılan beş düzeltme yolu, en sonda da bol bol
"derlenir mi?" antrenmanı.

:::ferris
Deneyimli Rust programcıları borrow checker'la kavga etmez; onunla **konuşur**. Hata mesajı bir
azar değil, bir sorudur: "Bu referans burada hâlâ geçerli mi, emin misin?" 🦀
:::

## Üç soru: kim sahip, kim ödünç alıyor, ne kadar süreyle?

Bir market uygulaması yazıyorsun. Sepetteki ilk ürünü bir kenara not ediyor, sonra sepete yeni bir ürün
ekliyorsun. Derlenir mi?

```compiles
code: |
  fn main() {
      let mut sepet = vec![String::from("ekmek"), String::from("süt")];
      let ilk = &sepet[0];
      sepet.push(String::from("peynir"));
      println!("İlk ürün: {ilk}");
  }
answer: false
error: E0502
explanation: |
  `ilk`, `sepet`'in içindeki bir elemanı gösteren değişmez bir ödünç ve son satırda hâlâ kullanılıyor.
  Arada `push` çağrısı `sepet`'i değiştirmek için `&mut` istiyor. Bir `&` canlıyken `&mut` alınamaz.
```

Bu hatayı ezberlenmiş bir kuralla değil, **üç soruyla** çözümleyelim. Her ödünç hatası bu üç sorunun
cevabında saklıdır:

1. **Kim sahip?** Verinin sahibi `sepet`. Elemanlar da (her biri bir `String`) `sepet`'in heap
   alanında yaşıyor.
2. **Kim ödünç alıyor, nasıl?** `ilk` → `&` (okumak için). `sepet.push(...)` → `&mut` (değiştirmek için;
   `push` metodu gizlice `&mut sepet` alır).
3. **Ne kadar süreyle?** Her ödünç, **oluşturulduğu yerden son kullanıldığı yere** kadar yaşar (NLL).

Üçüncü soruyu bir zaman çizelgesiyle cevaplamak en kolayı. Her ödüncü bir dikey çizgiyle göster:

```text
let ilk = &sepet[0];                ─┐ ilk (&) canlı
sepet.push(String::from("peynir"));  │   ← &mut sepet burada lazım: ÇAKIŞMA!
println!("İlk ürün: {ilk}");        ─┘ ilk'in son kullanımı
```

`&` çizgisinin **içine** bir `&mut` düşüyor. Kural (ya tek `&mut` ya da çok `&`) tam olarak burada
çiğneniyor. Bellekte neden tehlikeli olduğunu da hatırla:

```memory
title: "let ilk = &sepet[0]; sepet.push(...) (Rust izin verseydi)"
steps:
  - caption: "`ilk`, `sepet`'in heap alanındaki **ilk elemanı** gösteriyor. Alan dolu: len=2, cap=2."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<String>", value: "ptr · len=2 · cap=2", to: h1, mut: true }
          - { name: ilk, type: "&String", value: "adres", to: h1, note: "sepet[0]'ı gösterir" }
    heap:
      - { id: h1, value: "[ekmek] [süt]", label: "sepet'in elemanları" }
  - caption: "`push` yer bulamaz, elemanları yeni ve daha büyük bir alana taşır, eskisini **serbest bırakır**. `ilk` sarkar."
    stack:
      - frame: main
        vars:
          - { name: sepet, type: "Vec<String>", value: "ptr · len=3 · cap=4", to: h2, mut: true }
          - { name: ilk, type: "&String", value: "adres", to: h1, note: "sarkan referans!" }
    heap:
      - { id: h1, value: "[ekmek] [süt]", freed: true, label: "eski alan" }
      - { id: h2, value: "[ekmek] [süt] [peynir] [ _ ]", label: "yeni alan" }
```

Derleyicinin mesajı da aynı üç soruyu cevaplar. Etiketleri bul:

:::error
```text
error[E0502]: cannot borrow `sepet` as mutable because it is also borrowed as immutable
 --> src/main.rs:4:5
  |
3 |     let ilk = &sepet[0];
  |                ----- immutable borrow occurs here
4 |     sepet.push(String::from("peynir"));
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ mutable borrow occurs here
5 |     println!("İlk ürün: {ilk}");
  |                          --- immutable borrow later used here
```
- Mesajın ilk satırında adı geçen `sepet` → **sahip**.
- `immutable borrow occurs here` ve `mutable borrow occurs here` → **ödünçler ve türleri**.
- `immutable borrow later used here` → birinci ödüncün **son kullanımı**, yani çizginin alt ucu.
  Çözümün anahtarı çoğu zaman bu satırdır.
:::

:::analogy Kütüphanenin ödünç defteri
Borrow checker, bir kütüphanecinin ödünç defteri gibi çalışır. Defterde her satır şunu söyler:
**hangi kitap** (sahip), **kime** ve **okuma mı, düzeltme mi** için (`&` ya da `&mut`), **hangi
tarihe kadar** (son kullanım). Biri "bu kitabı düzeltmeye alacağım" dediğinde kütüphaneci deftere
bakar: O tarihler arasında kitap başkasında okumadaysa izin vermez. Kütüphaneci kitabın içeriğiyle
ilgilenmez; sadece **defterdeki tarihlerin çakışıp çakışmadığına** bakar.
:::

Şimdi bu okumayı başka bir hatada sen yap:

````quiz
question: |
  Şu hatayı alan bir programın **en küçük** düzeltmesi hangisidir?

  ```text
  error[E0502]: cannot borrow `sepet` as immutable because it is also borrowed as mutable
  3 |     let ilk = &mut sepet[0];
    |                    ----- mutable borrow occurs here
  4 |     println!("{}", sepet.len());
    |                    ^^^^^ immutable borrow occurs here
  5 |     ilk.push_str(" (tam buğday)");
    |     --- mutable borrow later used here
  ```
options:
  - "`println!` satırını `ilk.push_str(...)` satırının **altına** taşımak"
  - "`let ilk = &mut sepet[0];` yerine `let ilk = &sepet[0];` yazmak"
  - "`sepet.len()` yerine `sepet.clone().len()` yazmak"
  - "`sepet`'i `let mut` yerine `let` ile tanımlamak"
answer: 0
explanation: |
  `&mut` ödüncün çizgisi 3. satırda başlıyor, 5. satırda (`later used here`) bitiyor. `sepet.len()` bu
  çizginin **içine** düşüyor. `println!`'i 5. satırın altına alırsan `&mut` ödünç zaten bitmiş olur ve
  `sepet` serbestçe okunabilir. Çözüm: Ödünçlerin zaman çizelgesini çakışmayacak şekilde düzenlemek.
feedback:
  - "Doğru! Ödüncün **son kullanımından sonra** sahibi yeniden okuyabilirsin (NLL)."
  - "O zaman `ilk.push_str(...)` derlenmez: Değişmez bir referansla değişiklik yapılamaz (E0596)."
  - "`clone()` çağırmak için de önce `sepet`'i `&` ile ödünç almak gerekir; çakışma aynen sürer."
  - "Değişmez bir değişkenden `&mut` alınamaz; işler daha da kötüleşir (E0596)."
````

## Çözüm 1 ve 2: Ödüncü kısalt ya da değeri kopyala

Ödünç hatalarının çoğu **zaman çizelgesi** sorunudur. En ucuz ve çoğu zaman en doğru çözüm, ödüncün
çizgisini **kısaltmaktır**: Referansla işini, çakışan işlemden **önce** bitir.

```rust
fn main() {
    let mut sepet = vec![String::from("ekmek"), String::from("süt")];
    let ilk = &sepet[0];
    println!("İlk ürün: {ilk}"); // ilk'in son kullanımı: ödünç burada biter
    sepet.push(String::from("peynir")); // artık çakışma yok
    println!("Sepette {} ürün var", sepet.len());
}
```

Ama bazen değere çakışan işlemden **sonra** da gerçekten ihtiyacın vardır. O zaman sorman gereken
soru şu: **Referansa mı ihtiyacım var, yoksa değere mi?** Modül 4'ten hatırla, `i32` gibi `Copy` tipleri
atamada kopyalanır. Tahmin et:

```predict
code: |
  fn main() {
      let mut fiyatlar = vec![40, 25, 60];
      let ilk = fiyatlar[0];
      fiyatlar.push(15);
      fiyatlar[0] = 99;
      println!("{ilk} {}", fiyatlar.len());
  }
options:
  - "40 4"
  - "99 4"
  - Derlenmez (E0502)
answer: 0
explanation: |
  `fiyatlar[0]` bir `i32` ve `i32` `Copy`'dir. `let ilk = fiyatlar[0];` bir **referans değil, kopya**
  oluşturur: `ilk`, `fiyatlar`'ı ödünç almaz. Bu yüzden `push` ve atama serbest, sonradan `fiyatlar[0]`'ı
  `99` yapmak da `ilk`'i etkilemez: `40`. `push` sonrası uzunluk `4`.

  "Derlenmez" diyen `&fiyatlar[0]` ile `fiyatlar[0]`'ı karıştırmıştır. `&` olmadan, değer kopyalanır.
```

`Copy` olmayan bir tipte aynı numara işe yarar mı?

```compiles
code: |
  fn main() {
      let mut sepet = vec![String::from("ekmek"), String::from("süt")];
      let ilk = sepet[0];
      sepet.clear();
      println!("İlk ürün: {ilk}");
  }
answer: false
error: E0507
explanation: |
  `String` `Copy` değildir, yani `let ilk = sepet[0];` elemanı vektörün içinden **taşımaya** çalışır.
  Buna izin verilseydi vektörün içinde "taşınmış", geçersiz bir delik kalırdı ve vektör drop edilince
  aynı `String` iki kez serbest bırakılırdı. Rust indeksle taşımayı yasaklar: `cannot move out of index
  of Vec<String>`. Derleyici iki öneri sunar: `&sepet[0]` (ödünç al) ya da `sepet[0].clone()` (kopyala).
```

:::error
```text
error[E0507]: cannot move out of index of `Vec<String>`
 --> src/main.rs:3:15
  |
3 |     let ilk = sepet[0];
  |               ^^^^^^^^ move occurs because value has type `String`, which does not implement the `Copy` trait
  |
help: consider borrowing here
  |
3 |     let ilk = &sepet[0];
  |               +
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let ilk = sepet[0].clone();
  |                       ++++++++
```
İkinci öneriye dikkat: "*if the performance cost is acceptable*" (maliyet kabul edilebilirse).
Derleyici bile `clone`'un bedava olmadığını hatırlatıyor.
:::

Burada `&sepet[0]` işe yaramaz, çünkü hemen ardından `sepet.clear()` geliyor. Sepet boşaldıktan sonra
ilk ürünün adını **gerçekten** kullanmak istiyorsak bağımsız bir kopyaya ihtiyacımız var. İşte
**bilinçli `clone`** budur: Veri değişecek ya da yok olacak, ama sen onun **o anki hâlini** saklamak
istiyorsun. Örneğin zamdan önceki fiyat listesini ve zamlı listeyi yan yana göstermek için:

```rust
fn main() {
    let mut fiyatlar = vec![100, 250, 40];
    let eski = fiyatlar.clone(); // bilinçli karar: zamdan önceki hâlin bağımsız bir kopyası
    for f in fiyatlar.iter_mut() {
        *f += *f / 10; // %10 zam
    }
    println!("Eski: {eski:?}");
    println!("Yeni: {fiyatlar:?}");
}
```

`let eski = &fiyatlar;` yazsaydık `iter_mut()` E0502 verirdi. Burada iki farklı hâle **aynı anda**
ihtiyacımız var, bu yüzden `clone` doğru araç.

:::warning "Clone yağmuru" kötü bir alışkanlıktır
Her ödünç hatasına `.clone()` ile cevap vermek kodu derler, ama iki bedeli vardır:

1. **Performans:** Her `clone` yeni bir heap alanı ayırır ve bütün veriyi kopyalar. Bir döngü içinde
   büyük bir `Vec<String>`'i klonlamak, programını fark etmeden onlarca kat yavaşlatabilir.
2. **Doğruluk:** Kopya, aslından **bağımsızdır**. Aslındaki değişiklikler kopyaya yansımaz. Bunu
   istemiyorsan `clone` hatayı susturur ama bir **mantık hatası** yaratır.

Kendine sor: "Gerçekten iki bağımsız kopya mı istiyorum, yoksa sadece ödüncün zamanlamasını mı
düzeltmem gerekiyor?" Java veya Python'da her nesne zaten paylaşılan bir referanstır ve kopya
istediğinde bunu açıkça söylersin (Python'da `copy()`, Java'da `clone()`). Rust'ta da kopyalamak açık
bir karardır ve bedeli kodda görünür.
:::

## Çözüm 3 ve 4: Sahipli veri döndür ya da indeks tut

Şimdi işin içine fonksiyonlar giriyor. `en_uzun` fonksiyonu bir şehir listesindeki en uzun ismi
bulup ona bir referans döndürüyor. Ardından listeye yeni bir şehir ekliyoruz:

```compiles
code: |
  fn en_uzun(v: &Vec<String>) -> &String {
      let mut en = &v[0];
      for s in v {
          if s.len() > en.len() {
              en = s;
          }
      }
      en
  }

  fn main() {
      let mut sehirler = vec![String::from("Rize"), String::from("İstanbul")];
      let e = en_uzun(&sehirler);
      sehirler.push(String::from("Van"));
      println!("En uzun: {e}");
  }
answer: false
error: E0502
explanation: |
  `en_uzun` bir `&String` döndürüyor ve bu referans **parametreden** (`v`'den) geliyor. Yani `e`
  canlı olduğu sürece `sehirler` de ödünçte sayılır. `e` son satırda kullanıldığı için `push` çakışır.
  Derleyici `e`'nin `sehirler`'in içini gösterdiğini fonksiyonun **imzasından** anlar.
```

Buradaki önemli fikir şu: **Derleyici fonksiyonun gövdesine bakmaz, imzasına bakar.** `fn en_uzun(v:
&Vec<String>) -> &String` imzası şunu vaat eder: "Döndürdüğüm referans, bana verdiğin vektörün içinden
ödünç alınmıştır." Bu yüzden çağıran tarafta dönen referans yaşadıkça vektör de ödünçte kalır. Bu
**yerel akıl yürütme (local reasoning)** sayesinde derleyici her fonksiyonu ayrı ayrı denetleyebilir.
Sen de imzayı okuyarak, gövdeyi hiç görmeden, hangi değerin ne kadar ödünçte kalacağını bilebilirsin.
(İmzalardaki bu bağların açık yazılışını, yani **yaşam süresi parametrelerini**, Modül 12'de göreceğiz.)

Bu durumda iki iyi çıkış yolu var:

- **Sahipli veri döndür:** `-> String` ile ismin bir **kopyasını** döndür (`en.clone()`). Çağıran artık
  vektöre bağlı değildir. Bedeli bir `clone`.
- **Referans yerine indeks döndür:** `-> usize` ile en uzun ismin **sırasını** döndür. Bir `usize`
  sadece bir sayıdır; hiçbir şeyi ödünç almaz. Bedeli sıfır.

```memory
title: Referans tutmak ile indeks tutmak
steps:
  - caption: "`e: &String` vektörün **içini** gösteriyor. `e` yaşadıkça `sehirler` ödünçte; `push` yasak."
    stack:
      - frame: main
        vars:
          - { name: sehirler, type: "Vec<String>", value: "ptr · len=2 · cap=2", to: h1, mut: true }
          - { name: e, type: "&String", value: "adres", to: h1, note: "sehirler[1]'i gösterir" }
    heap:
      - { id: h1, value: "[Rize] [İstanbul]" }
  - caption: "`i: usize` sadece bir sayı; hiçbir şeyi göstermiyor. `sehirler` serbest: `push` yapılabilir, sonra `sehirler[i]` ile okunur."
    stack:
      - frame: main
        vars:
          - { name: sehirler, type: "Vec<String>", value: "ptr · len=3 · cap=4", to: h2, mut: true }
          - { name: i, type: usize, value: "1", note: "ödünç değil, bir sıra numarası" }
    heap:
      - { id: h2, value: "[Rize] [İstanbul] [Van] [ _ ]" }
```

İndeks yaklaşımının çalışan hâli:

```rust
fn en_uzun_indeks(v: &[String]) -> usize {
    let mut en = 0;
    for i in 1..v.len() {
        if v[i].len() > v[en].len() {
            en = i;
        }
    }
    en
}

fn main() {
    let mut sehirler = vec![String::from("Rize"), String::from("İstanbul")];
    let i = en_uzun_indeks(&sehirler); // ödünç bu satırda başlar ve biter
    sehirler.push(String::from("Van"));
    println!("En uzun: {} ({} şehir içinde)", sehirler[i], sehirler.len());
}
```

:::info İndeks bir "söz" değil, bir "adres tarifi"dir
Bir indeks, referansın verdiği garantiyi vermez. Vektörden eleman silersen `i` başka bir elemanı ya da
listenin dışını gösterebilir. Ama en kötü ihtimalle yanlış elemanı okursun ya da program kontrollü bir
**panik** ile durur (`index out of bounds`). Serbest bırakılmış belleği okumak (C++'taki tanımsız
davranış) **asla** olmaz, çünkü her `v[i]` erişiminde sınır kontrolü yapılır. Bu yüzden indeks tutmak,
Rust'ta oyun motorlarından derleyicilere kadar çok yaygın bir desendir.
:::

Şimdi sıra sende. Market fiyatları arasında en ucuz ürünün **indeksini** bulup o ürüne 2 TL indirim
yapan programı tamamla:

```fill
prompt: "`en_ucuz_indeks` bir referans değil, bir **sıra numarası** döndürsün; `main` de indirimi o sıradaki fiyata uygulasın."
code: |
  fn en_ucuz_indeks(fiyatlar: &[u32]) -> ___0 {
      let mut en = 0;
      for i in 1..fiyatlar.len() {
          if fiyatlar[i] < fiyatlar[en] {
              en = i;
          }
      }
      en
  }

  fn main() {
      let mut fiyatlar = vec![45, 12, 30];
      let i = en_ucuz_indeks(&fiyatlar);
      fiyatlar[___1] -= 2;
      println!("{fiyatlar:?}");
  }
blanks:
  - ["usize"]
  - ["i"]
output: "[45, 10, 30]"
explanation: |
  İndeksler her zaman `usize`'dır (Modül 2: işaretçi boyutunda işaretsiz tamsayı). `en_ucuz_indeks`
  çağrısı bittiği anda `&fiyatlar` ödüncü de biter, çünkü dönen `usize` hiçbir şeyi ödünç almaz.
  Böylece `fiyatlar[i] -= 2` ile vektörü rahatça değiştirebiliyoruz.

  Fonksiyon boş olmayan bir dilim varsayıyor (boşsa `0` döner ve `fiyatlar[0]` panik verir). "Değer
  olmayabilir" durumunu düzgünce ifade etmeyi Modül 7'de `Option` ile öğreneceksin.
```

## Çözüm 5: Önce oku, sonra yaz

Bazen sorun zamanlama değil, **sıralama**dır: Aynı ifadenin içinde hem okuyup hem yazmaya çalışırsın.
Tahmin et:

```compiles
code: |
  fn ekle(liste: &mut Vec<i32>, deger: i32) {
      liste.push(deger);
  }

  fn main() {
      let mut v = vec![1, 2, 3];
      ekle(&mut v, v[0]);
      println!("{v:?}");
  }
answer: false
error: E0502
explanation: |
  Fonksiyon argümanları **soldan sağa** değerlendirilir. Önce `&mut v` oluşturulur, ardından `v[0]`
  okunmaya çalışılır. Ama o anda `v` zaten `&mut` olarak ödünçte ve bu ödünç `ekle` çağrısı bitene kadar
  sürecek. Okuma, yazma ödüncünün içine düşüyor.
```

:::error
```text
error[E0502]: cannot borrow `v` as immutable because it is also borrowed as mutable
 --> src/main.rs:7:18
  |
7 |     ekle(&mut v, v[0]);
  |     ---- ------  ^ immutable borrow occurs here
  |     |    |
  |     |    mutable borrow occurs here
  |     mutable borrow later used by call
```
`mutable borrow later used by call`: `&mut` ödünç, **çağrının kendisi** tarafından kullanılacak. Yani
çizgi bütün çağrıyı kapsıyor.
:::

Düzeltmesi basit: **Önce oku, sonra yaz.** Okuma işini ayrı bir satıra al, sonucu bir değişkende tut:

```rust
fn ekle(liste: &mut Vec<i32>, deger: i32) {
    liste.push(deger);
}

fn main() {
    let mut v = vec![1, 2, 3];
    let ilk = v[0]; // önce oku (i32 Copy: kopya alınır, ödünç kalmaz)
    ekle(&mut v, ilk); // sonra yaz
    println!("{v:?}");
}
```

:::deep Peki `v.push(v[0])` neden derleniyor?
Şaşırtıcı ama `v.push(v[0]);` derlenir! Metot çağrısında derleyici `&mut v` ödüncünü iki aşamada ele
alır (**two-phase borrows**): Önce `&mut v`'yi "ayırır" ama henüz kullanmaz. Argümanlar bu arada okunabilir.
Asıl değiştirme, argümanlar hesaplandıktan sonra başlar. Bu küçük istisna sadece `v.metot(...)` biçimindeki
otomatik ödünç almalar için vardır, `ekle(&mut v, ...)` gibi açıkça yazılmış `&mut` için yoktur. Kafa
karışıklığından kaçınmanın en temiz yolu yine de aynı: Önce oku, sonra yaz.
:::

Aynı sorunun en sık görülen biçimi, bir koleksiyonu **dolaşırken değiştirmek**tir. Kelime kartı
uygulamasında, puanı 50'nin altında kalan kartları tekrar için listenin sonuna eklemek isteyelim:

```rust,compile_fail,E0502
fn main() {
    let mut puanlar = vec![80, 30, 45, 90];
    for p in puanlar.iter() {
        if *p < 50 {
            puanlar.push(*p); // HATA: dolaşılan liste değiştirilemez
        }
    }
    println!("{puanlar:?}");
}
```

:::error
```text
error[E0502]: cannot borrow `puanlar` as mutable because it is also borrowed as immutable
 --> src/main.rs:5:13
  |
3 |       for p in puanlar.iter() {
  |       -        --------------
  |       |        |
  |       |        immutable borrow occurs here
  |  _____|        immutable borrow later used here
  | |
4 | |         if *p < 50 {
5 | |             puanlar.push(*p);
  | |             ^^^^^^^^^^^^^^^^ mutable borrow occurs here
6 | |         }
7 | |     }
  | |_____- this for loop borrows `puanlar` immutably, preventing mutation within its body
  |
  = help: consider using an index-based loop instead, or collecting modifications into a separate collection
```
`for` döngüsü listeyi **bütün döngü boyunca** ödünç alır. Son satırdaki `help` iki çözümü birden
söylüyor: **indeks tabanlı döngü** ya da değişiklikleri **ayrı bir koleksiyonda toplamak**.
:::

Diğer diller aynı programa ne yapar? Java çalışma zamanında `ConcurrentModificationException` fırlatır.
Python hata vermez, dolaşmaya devam eder: Sona eklenen `30` ve `45`'i de görür, onları yeniden ekler,
sonra yine görür... Bu örnek Python'da **sonsuz döngüye** girer. C++'ta `push_back` vektörü yeniden ayırırsa
yineleyici sarkar ve tanımsız davranış başlar. Rust ise programı hiç çalıştırmadan durdurur.

İndeks tabanlı çözümde uzunluğu **önceden** bir değişkene almak önemlidir. Böylece döngü sadece
orijinal elemanları dolaşır, sona eklediklerimizi değil. Satırları sırala:

```parsons
prompt: "Programı kur: 2'den büyük her sayının 10 katını listenin sonuna ekle. Çıktı `[3, 8, 1, 30, 80]` olmalı."
lines: |
  fn main() {
      let mut v = vec![3, 8, 1];
      let n = v.len();
      for i in 0..n {
          if v[i] > 2 {
              let yeni = v[i] * 10;
              v.push(yeni);
          }
      }
      println!("{v:?}");
  }
distractors: |
      for x in &v {
          v.push(x * 10);
explanation: |
  `let n = v.len();` döngüden önce okunur ve bir `usize` olarak saklanır; `0..n` aralığı da `v`'yi ödünç
  almaz. Döngünün içinde önce `v[i]` okunur (`i32` kopyalanır, ödünç kalmaz), sonra `push` yapılır.
  `for x in &v` ise `v`'yi bütün döngü boyunca ödünç alırdı ve içerideki `push` E0502 verirdi.
```

## Derleyici gibi düşün: karışık antrenman

Artık elinde bir yöntem ve beş çözüm var. Aşağıdaki tablo, hata kodunu gördüğünde hangi soruyu
soracağını ve en sık hangi çözüme gideceğini özetliyor:

| Hata | Ne oldu? | Kendine sor | Sık çözüm |
|------|----------|-------------|-----------|
| E0499 | Aynı değere iki `&mut` | Birinci `&mut`'un son kullanımı nerede? | Ödüncü kısalt, iç kapsam, farklı değerler/`split_at_mut` |
| E0502 | `&` ile `&mut` çakışıyor | Hangi ödüncün çizgisi diğerinin içine düşüyor? | Ödüncü kısalt, önce oku sonra yaz, indeks tut |
| E0506 | Ödünçteki değere atama | Referans atamadan sonra da kullanılıyor mu? | Atamayı son kullanımdan sonraya al |
| E0505 | Ödünçteki değeri taşımak | Taşımadan sonra referans kullanılıyor mu? | Referansla işini önce bitir, ya da bilinçli `clone` |
| E0507 | Ödünç/indeks üzerinden taşımak | Değere mi ihtiyacım var, referansa mı? | `&` ile ödünç al ya da bilinçli `clone` |
| E0597 / E0515 | Değer referanstan önce ölüyor | Sahip kim, nerede ölüyor? | Sahibi daha uzun yaşat, sahipli veri döndür |

:::warning Kolay ama yanlış "çözümler"
- **Her yere `mut` eklemek.** `mut` bir izin, bir çözüm değil. Çakışan ödünçleri ortadan kaldırmaz.
- **Her hatayı `clone` ile susturmak.** Bazen doğru, ama önce zamanlamayı düzeltmeyi dene.
- **Derleyiciyi "aptal" sanmak.** Borrow checker bazen güvenli bir programı da reddeder (Ders 5'teki
  `&mut v[0]` ve `&mut v[1]` örneğini hatırla). Ama reddettiği programların ezici çoğunluğunda gerçek
  bir hata saklıdır. Önce "Bu gerçekten güvenli mi?" diye sor.
:::

Şimdi defteri kendin tut. Her örnekte ödünçlerin çizgilerini kafanda çiz:

```compiles
code: |
  fn main() {
      let mut sicaklik = 18;
      let olcum = &sicaklik;
      sicaklik = 25;
      println!("Ölçüm: {olcum}");
  }
answer: false
error: E0506
explanation: |
  `olcum` ödüncü 3. satırdan son satıra kadar yaşıyor. Arada `sicaklik = 25;` ile **sahibin kendisi**
  değeri değiştirmeye çalışıyor: `cannot assign to sicaklik because it is borrowed`. Ödünç alınmış bir
  değeri sahibi bile değiştiremez. Düzeltme: `println!`'i atamanın üstüne al.
```

```compiles
code: |
  fn main() {
      let mut ali = String::from("Ali");
      let mut ayse = String::from("Ayşe");
      let r1 = &mut ali;
      let r2 = &mut ayse;
      r1.push_str(" geldi");
      r2.push_str(" geldi");
      println!("{ali}, {ayse}");
  }
answer: true
explanation: |
  Derlenir! Aynı anda iki `&mut` var, ama **farklı değerlere** (`ali` ve `ayse`). Kural tek bir değer
  için geçerlidir. Ayrıca `r1` ve `r2`'nin son kullanımı `push_str` satırları; `println!` geldiğinde
  ikisi de bitmiş olduğu için sahipler serbestçe okunabilir (NLL).
```

Son olarak Modül 2'deki **gölgeleme (shadowing)** ile birleştirelim:

```predict
code: |
  fn main() {
      let mesaj = String::from("eski");
      let r = &mesaj;
      let mesaj = String::from("yeni");
      println!("{r} {mesaj}");
  }
options:
  - "eski yeni"
  - "yeni yeni"
  - Derlenmez (E0505)
answer: 0
explanation: |
  Gölgeleme **yeni bir değişken** oluşturur; eskisini taşımaz, değiştirmez, drop etmez. İlk `mesaj`
  (`"eski"`) adı gizlenmiş olsa da kapsamın sonuna kadar yaşamaya devam eder. `r` hâlâ onu gösterir.
  İkinci `mesaj` ise tamamen ayrı bir `String`'tir (`"yeni"`).

  "yeni yeni" diyen, gölgelemeyi `mut` ile atama gibi düşünmüştür. Atama olsaydı (`mesaj = ...`) kod
  E0506 verirdi. Gölgelemede ise ortada çakışan hiçbir şey yok.
```

## Alıştırmalar

İlk alıştırmada derlenmeyen bir fonksiyonu düzelteceksin. Kod, en yüksek notu bir **referansla**
takip etmeye çalışıyor. Hatayı oku, üç soruyu sor ve bu derste öğrendiğin çözümlerden birini uygula.

````exercise
title: En yüksek nota bonus
difficulty: 3
prompt: |
  Öğretmen, sınıfın **en yüksek** notuna `bonus` puan eklemek istiyor:

  - En yüksek not birden fazla öğrencide varsa bonus **ilk** sıradakine eklenir.
  - Not 100'ü **geçemez**: Bonusla 100'ü aşan not 100 olur.
  - Liste boşsa hiçbir şey yapılmaz (ve program panik vermemeli).

  Aşağıdaki kod derlenmiyor: Biri E0502, diğeri onun yakın akrabası E0503 (`cannot use notlar[_]
  because it was mutably borrowed`, yani "`&mut` ödünçteyken kullanılamaz") olmak üzere iki hata
  verir. Hata mesajlarını oku ve fonksiyonu **derlenecek ve doğru çalışacak** şekilde yeniden yaz.
starter_compiles: false
starter: |
  fn en_yuksege_bonus(notlar: &mut [u32], bonus: u32) {
      let mut en_yuksek = &mut notlar[0];
      for i in 0..notlar.len() {
          if notlar[i] > *en_yuksek {
              en_yuksek = &mut notlar[i];
          }
      }
      *en_yuksek += bonus;
  }

  fn main() {
      let mut notlar = vec![70, 85, 60];
      en_yuksege_bonus(&mut notlar, 10);
      println!("{notlar:?}");
  }
solution: |
  fn en_yuksege_bonus(notlar: &mut [u32], bonus: u32) {
      if notlar.is_empty() {
          return;
      }
      let mut en = 0;
      for i in 1..notlar.len() {
          if notlar[i] > notlar[en] {
              en = i;
          }
      }
      notlar[en] += bonus;
      if notlar[en] > 100 {
          notlar[en] = 100;
      }
  }

  fn main() {
      let mut notlar = vec![70, 85, 60];
      en_yuksege_bonus(&mut notlar, 10);
      println!("{notlar:?}");
  }
check: tests
tests: |
  #[test]
  fn bonus_en_yuksek_nota_eklenir() {
      let mut notlar = vec![70, 85, 60];
      en_yuksege_bonus(&mut notlar, 10);
      assert_eq!(notlar, vec![70, 95, 60], "en yüksek not (85) 95 olmalı, diğerleri değişmemeli");
  }

  #[test]
  fn esitlikte_ilk_siradaki_alir() {
      let mut notlar = vec![80, 90, 90, 40];
      en_yuksege_bonus(&mut notlar, 5);
      assert_eq!(notlar, vec![80, 95, 90, 40], "iki tane 90 varsa bonus ilk 90'a eklenmeli");
  }

  #[test]
  fn not_100u_gecemez() {
      let mut notlar = vec![40, 96];
      en_yuksege_bonus(&mut notlar, 10);
      assert_eq!(notlar, vec![40, 100], "96 + 10 = 106 olmaz; not 100'de durmalı");
  }

  #[test]
  fn en_yuksek_ilk_ya_da_tek_elemansa() {
      let mut notlar = vec![99, 10, 20];
      en_yuksege_bonus(&mut notlar, 0);
      assert_eq!(notlar, vec![99, 10, 20], "0 bonus hiçbir şeyi değiştirmemeli");
      let mut tek = vec![50];
      en_yuksege_bonus(&mut tek, 7);
      assert_eq!(tek, vec![57], "tek elemanlı listede o eleman bonus almalı");
  }

  #[test]
  fn bos_liste_panik_vermez() {
      let mut notlar: Vec<u32> = vec![];
      en_yuksege_bonus(&mut notlar, 10);
      assert!(notlar.is_empty(), "boş liste boş kalmalı");
  }
hints:
  - "Üç soru: `en_yuksek` bir `&mut` ödünç ve son satıra kadar yaşıyor. Döngüdeki `notlar.len()` ve `notlar[i]` okumaları bu çizginin **içine** düşüyor."
  - "Referans yerine en yüksek notun **indeksini** (`usize`) tut: `let mut en = 0;` ve döngüde `if notlar[i] > notlar[en] { en = i; }`. Eşitlikte ilk kalsın diye `>` kullan, `>=` değil."
  - "Döngüden sonra tek bir değişiklik yap: `notlar[en] += bonus;` ardından 100'ü aşıyorsa `notlar[en] = 100;`. En başta da `if notlar.is_empty() { return; }` ile boş listeyi ele al."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: Bu alıştırmada `clone` gerekmez; referans yerine bir indeks tutmayı dene.
explanation: |
  Orijinal kodda `en_yuksek` bir `&mut` ödünçtü ve fonksiyonun sonuna kadar yaşıyordu. Döngüdeki her
  `notlar[i]` okuması bu `&mut`'un çizgisinin içine düştüğü için derleyici reddetti. Haklıydı da:
  `&mut` canlıyken aynı veriyi başka bir yoldan okumak "aliasing XOR mutation" kuralını çiğner.

  Çözümün iki aşaması var. **Okuma aşaması:** Döngü sadece okur ve bir `usize` indeks hesaplar. İndeks
  hiçbir şeyi ödünç almaz. **Yazma aşaması:** Döngü bittikten sonra tek bir `notlar[en] += bonus` ile
  değişiklik yapılır. "Önce oku, sonra yaz" ve "referans yerine indeks" çözümleri birlikte çalıştı.

  Neden döngü `1`'den başlıyor? `en = 0` ile ilk elemanı zaten aday kabul ettik. Neden `>`?
  `>=` kullansaydın eşitlikte **son** en yüksek not bonusu alırdı.

  Alternatifler: 100 sınırını `notlar[en] = (notlar[en] + bonus).min(100);` ile tek satırda da
  yazabilirsin (`min` iki sayıdan küçüğünü verir). Hatta Modül 2'deki `saturating_add`'i hatırlarsan,
  çok büyük bir `bonus` verildiğinde `u32` taşmasını da önlemek için `notlar[en].saturating_add(bonus)`
  kullanmak daha da sağlam olur.
````

İkinci alıştırmada bir koleksiyonu **dolaşırken büyüteceksin**. Yukarıdaki derlenmeyen kelime kartı
örneğini hatırla.

````exercise
title: Zayıf kartları tekrar kuyruğuna ekle
difficulty: 3
prompt: |
  Bir kelime ezberleme uygulamasında her kartın son puanı `puanlar` listesinde tutuluyor. Puanı
  **50'nin altında** olan her kart, aynı oturumda bir kez daha sorulmak üzere listenin **sonuna**
  eklenmeli:

  - Eklenen kartlar orijinal sıralarını korur: `[80, 30, 45, 90]` → `[80, 30, 45, 90, 30, 45]`.
  - Sona eklenen kartlar **tekrar** değerlendirilmez (yoksa sonsuz döngü olurdu!).
  - Tam 50 puan zayıf sayılmaz.
  - Fonksiyon, sona kaç kart eklediğini döndürür.

  Dikkat: `for p in puanlar.iter() { ... puanlar.push(*p) ... }` derlenmez (E0502). Bu derste
  öğrendiğin çözümlerden birini kullan.
starter: |
  fn tekrar_ekle(puanlar: &mut Vec<u32>) -> usize {
      todo!()
  }

  fn main() {
      let mut puanlar = vec![80, 30, 45, 90];
      let eklenen = tekrar_ekle(&mut puanlar);
      println!("{eklenen} kart eklendi: {puanlar:?}");
  }
solution: |
  fn tekrar_ekle(puanlar: &mut Vec<u32>) -> usize {
      let n = puanlar.len();
      let mut eklenen = 0;
      for i in 0..n {
          if puanlar[i] < 50 {
              let puan = puanlar[i];
              puanlar.push(puan);
              eklenen += 1;
          }
      }
      eklenen
  }

  fn main() {
      let mut puanlar = vec![80, 30, 45, 90];
      let eklenen = tekrar_ekle(&mut puanlar);
      println!("{eklenen} kart eklendi: {puanlar:?}");
  }
check: tests
tests: |
  #[test]
  fn zayif_kartlar_sirasiyla_sona_eklenir() {
      let mut p = vec![80, 30, 45, 90];
      let n = tekrar_ekle(&mut p);
      assert_eq!(p, vec![80, 30, 45, 90, 30, 45], "30 ve 45 bu sırayla sona eklenmeli");
      assert_eq!(n, 2, "iki kart eklendi, fonksiyon 2 döndürmeli");
  }

  #[test]
  fn elli_puan_zayif_sayilmaz() {
      let mut p = vec![50, 70, 100];
      let n = tekrar_ekle(&mut p);
      assert_eq!(p, vec![50, 70, 100], "50 ve üstü puanlar tekrar eklenmemeli");
      assert_eq!(n, 0, "hiç kart eklenmediyse 0 döndürmeli");
  }

  #[test]
  fn hepsi_zayifsa_liste_iki_katina_cikar() {
      let mut p = vec![10, 0, 49];
      let n = tekrar_ekle(&mut p);
      assert_eq!(p, vec![10, 0, 49, 10, 0, 49], "eklenen kartlar yeniden değerlendirilmemeli (her kart bir kez eklenir)");
      assert_eq!(n, 3);
  }

  #[test]
  fn bos_liste() {
      let mut p: Vec<u32> = vec![];
      assert_eq!(tekrar_ekle(&mut p), 0, "boş listeye hiçbir şey eklenmemeli");
      assert!(p.is_empty());
  }
hints:
  - "`for p in puanlar.iter()` listeyi bütün döngü boyunca ödünç alır. Bunun yerine indeksle dolaş: `for i in 0..n`."
  - "Döngüden **önce** orijinal uzunluğu sakla: `let n = puanlar.len();`. Böylece sona eklenenler dolaşılmaz."
  - "Döngü içinde önce oku, sonra yaz: `let puan = puanlar[i]; puanlar.push(puan); eklenen += 1;`. En sonda `eklenen`'i döndür."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: Listenin tamamını klonlamak gereksiz bir kopya; indeksle dolaşmayı ya da eklenecekleri ayrı bir listede toplamayı dene.
explanation: |
  Çözüm iki fikri birleştiriyor:

  1. **İndeks tabanlı döngü:** `0..n` aralığı `puanlar`'ı ödünç almaz. Her turda `puanlar[i]` kısa bir
     okuma yapar (`u32` kopyalanır) ve ödünç orada biter. Ardından gelen `push` ile çakışma yok.
  2. **Uzunluğu önceden sabitlemek:** `n`, eklemelerden **önceki** uzunluk. Böylece sona eklenen kartlar
     döngüye girmez. Python'daki "listeyi dolaşırken eklersen sonsuz döngü" tuzağına Rust'ta bilerek
     kapıyı kapattık.

  Alternatif (derleyicinin önerdiği ikinci yol): Eklenecekleri önce **ayrı bir listede** topla, sonra
  ekle:

  ```rust,ignore
  let mut eklenecek = vec![];
  for p in puanlar.iter() {
      if *p < 50 {
          eklenecek.push(*p);
      }
  }
  for p in eklenecek.iter() {
      puanlar.push(*p);
  }
  ```

  Birinci döngü sadece okur, ikinci döngü sadece yazar. Okuma ve yazma aşamaları birbirinden tamamen
  ayrıldığı için ödünçler hiç çakışmaz. (Modül 9'da `extend` gibi metotlarla bunu tek satırda yapmayı
  göreceksin.)
````

## Özet: zihinsel model

:::remember
- Her ödünç hatasında üç soru: **Kim sahip? Kim ödünç alıyor (`&` mi `&mut` mu)? Ne kadar süreyle (son kullanıma kadar)?**
- Hata mesajındaki üç etiket bu soruların cevabıdır: `... borrow occurs here` (×2) ve `... later used here`.
- Beş çözüm: **1)** ödüncü kısalt, **2)** bilinçli `clone` (gerçekten bağımsız kopya gerekiyorsa), **3)** sahipli veri döndür, **4)** referans yerine indeks tut, **5)** önce oku, sonra yaz.
- `Copy` bir değer (`v[0]` bir `i32` ise) ödünç değil **kopya** alır; `&v[0]` ise ödünçtür.
- Derleyici fonksiyonun **imzasına** bakar: `-> &T` dönen bir referans, parametreyi ödünçte tutar.
- Koleksiyonu dolaşırken değiştirme: **indeks tabanlı döngü** (uzunluğu önceden sakla) ya da değişiklikleri **ayrı bir listede topla**.
:::

```reflect
prompt: |
  Bir arkadaşın her ödünç hatasında `.clone()` eklediğini ve "zaten derleniyor" dediğini söylüyor.
  Ona hangi durumda `clone`'un doğru, hangi durumda yanlış bir çözüm olduğunu kendi cümlelerinle anlat.
  Bir örnek ver.
answer: |
  Model cevap: `clone` verinin bağımsız bir kopyasını yapar; yeni bir heap alanı ayırır ve bütün veriyi
  kopyalar. Bu, verinin **o anki hâline** değişiklikten sonra da gerçekten ihtiyacın varsa doğrudur.
  Örneğin zamdan önceki ve sonraki fiyat listesini yan yana göstermek gibi. Ama çoğu ödünç hatası bir
  zamanlama sorunudur: Referansın son kullanımını öne almak, bir indeks tutmak ya da önce okuyup sonra
  yazmak hatayı bedavaya çözer. Gereksiz `clone` hem programı yavaşlatır hem de kopya aslındaki
  değişiklikleri görmediği için gizli mantık hatalarına yol açabilir.
```

```flashcards
- front: Bir ödünç hatasını çözümlerken sorulan üç soru nedir?
  back: "Kim sahip? Kim ödünç alıyor ve nasıl (`&` / `&mut`)? Ödünç ne kadar sürüyor (son kullanıma kadar)?"
- front: "E0502 mesajında `immutable borrow later used here` etiketi neyi gösterir?"
  back: Birinci ödüncün **son kullanımını**, yani çakışan çizginin bittiği yeri. Çözüm çoğu zaman bu satırla ilgilidir.
- front: "`v: Vec<i32>` iken `let x = v[0];` ile `let x = &v[0];` arasındaki fark nedir?"
  back: "`v[0]` `i32` olduğu için ilki bir **kopya** alır, `v`'yi ödünç almaz. İkincisi `v`'yi ödünç alır."
- front: "`let ilk = sepet[0];` (`sepet: Vec<String>`) hangi hatayı verir, neden?"
  back: "**E0507**: `String` `Copy` değil; indeksle vektörün içinden taşıma yapılamaz. Çözüm `&sepet[0]` ya da `sepet[0].clone()`."
- front: "`fn en_uzun(v: &Vec<String>) -> &String` dönüşü yaşadıkça neden `v.push(...)` yapılamaz?"
  back: "İmza, dönen referansın `v`'den ödünç alındığını söyler; derleyici gövdeye değil **imzaya** bakar."
- front: Referans yerine indeks (`usize`) tutmanın avantajı nedir?
  back: Bir indeks hiçbir şeyi ödünç almaz; koleksiyon serbestçe değiştirilebilir. En kötü ihtimalle kontrollü bir panik olur, tanımsız davranış asla.
- front: "`ekle(&mut v, v[0])` neden E0502 verir, nasıl düzeltilir?"
  back: "Argümanlar soldan sağa değerlendirilir; `&mut v` canlıyken `v[0]` okunur. Önce oku, sonra yaz: `let x = v[0]; ekle(&mut v, x);`"
- front: Bir listeyi dolaşırken sonuna eleman eklemenin iki güvenli yolu nedir?
  back: "1) Uzunluğu önceden saklayıp indeksle dolaşmak (`for i in 0..n`). 2) Eklenecekleri ayrı bir listede toplayıp döngüden sonra eklemek."
```
