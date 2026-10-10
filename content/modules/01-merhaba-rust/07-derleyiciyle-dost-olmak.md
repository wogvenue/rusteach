---
id: m01-l07
title: Derleyiciyle dost olmak
minutes: 18
type: lesson
objectives:
  - Bir derleyici hata mesajının parçalarını (kod, özet, konum, etiketler, note/help) tek tek açıklayabilmek
  - Hata ile uyarı arasındaki farkı söyleyip rustc --explain ile bir hata kodunun açıklamasını bulabilmek
  - Birden fazla hata veren bir programı, hataları sırayla okuyup birer birer düzelterek derlenir hâle getirebilmek
  - cargo fmt ve cargo clippy araçlarının ne işe yaradığını açıklayıp kullanabilmek
keywords: [derleyici hatası, uyarı, warning, E0425, E0423, "rustc --explain", rustfmt, "cargo fmt", clippy, "cargo clippy", lint]
---

Birçok dilde derleyici hataları korkutucudur: kısa, şifreli, çoğu zaman da yanlış yeri gösteren
mesajlar. Rust bu konuda bilinçli olarak farklı bir yol seçti. Derleyici ekibi, hata mesajlarını
dilin **en önemli özelliklerinden biri** olarak görür ve yıllardır onları iyileştirmek için çalışır.
Bu modül boyunca pek çok hata mesajı gördün. Bu derste onları bir öğretmenin kırmızı kalemle
düştüğü notlar gibi okumayı ve kodunu bu notlarla kendi başına düzeltmeyi öğreneceksin.

:::ferris
Rust programcılarının arasında şöyle bir söz dolaşır: "Derleyiciyle kavga edilmez, sohbet edilir."
Ben de her gün derleyiciden bir şeyler öğreniyorum. Hata almak, yanlış yaptığın anlamına değil,
öğrenmekte olduğun anlamına gelir! 🦀
:::

## Bir hata mesajının anatomisi

Önce bir hata mesajına yakından bakalım. Bu programda iki hata var:

```rust,compile_fail
fn main() {
    let sehir = "Isparta";
    let derece = 21;
    println("Şehir: {sehir}");
    println!("Sıcaklık: {derce} derece");
}
```

Derleyici şu çıktıyı verir. Şimdilik yalnızca ilk hatayı inceleyelim:

```text
error[E0425]: cannot find value `derce` in this scope
 --> src/main.rs:5:26
  |
5 |     println!("Sıcaklık: {derce} derece");
  |                          ^^^^^
  |
help: a local variable with a similar name exists
  |
5 |     println!("Sıcaklık: {derece} derece");
  |                             +
```

Her parçanın bir görevi var:

| Parça | Anlamı |
|---|---|
| `error` | **Düzey**: Bu bir hata; program derlenmeyecek. (Uyarılarda `warning` yazar.) |
| `[E0425]` | **Hata kodu**: Bu hata türünün kimlik numarası. Ayrıntılı açıklamasını bu kodla bulursun. |
| `cannot find value ...` | **Özet**: "Bu kapsamda `derce` adında bir değer bulunamadı." |
| `--> src/main.rs:5:26` | **Konum**: dosya, **satır** (5) ve **sütun** (26). |
| `5 \|` ve kod satırı | Hatalı satırın kendisi, solda satır numarasıyla. |
| `^^^^^` | **Birincil etiket**: Sorunun tam yeri. Bazen yanında kısa bir açıklama olur. |
| `-----` | **İkincil etiket**: Hikâyenin diğer parçaları ("burada açıldı", "burada kullanıldı"...). |
| `= note:` | Ek bilgi: Neden böyle olduğu. |
| `help:` | **Öneri**: Nasıl düzelteceğin. Burada `+` işareti, eklenecek karakteri gösteriyor. |

Bu mesajda derleyici yazım hatasını bulmakla kalmadı, adı `derece` olan bir değişken olduğunu fark
edip **düzeltmeyi bile önerdi**. `help` satırındaki `+`, `derce`'ye eklenmesi gereken `e` harfini
işaret ediyor. Bazı öneriler eklenecek satırları `+`, silinecek satırları `-` ile, bir "fark"
(*diff*) gibi gösterir; bunu 5. dersteki `{adi}` örneğinde görmüştün.

:::analogy Öğretmenin kırmızı kalemi
İyi bir öğretmen yazılı kâğıdına sadece "yanlış" yazmaz. Hatanın **altını çizer** (`^^^^^`),
kenarına **ne olduğunu** yazar (özet), ilgili yerleri **okla** bağlar (ikincil etiketler) ve en
alta "şu konuyu tekrar et" diye bir **öneri** düşer (`help`). Rust derleyicisi böyle bir öğretmen.
Notları okumadan kâğıdı buruşturan öğrenci aynı hatayı tekrar yapar; okuyan ise bir daha yapmaz.
:::

```quiz
question: |
  Bir hata mesajında `--> src/main.rs:12:9` yazıyor. Bu ne anlama gelir?
options:
  - "`src/main.rs` dosyasında 12 hata ve 9 uyarı var"
  - "`src/main.rs` dosyasının 12. satırının 9. sütununda (karakterinde) bir sorun var"
  - "Hata 12. ve 9. satırlar arasında bir yerde"
  - "Hata kodu E1209'dur"
answer: 1
explanation: |
  `-->` satırı her zaman **dosya:satır:sütun** biçimindedir. Sütun, satırın başından itibaren
  kaçıncı karakterde olduğunu söyler (satır başındaki 4 boşluklu girinti de sayılır). VS Code'da
  bu konuma tıklayarak doğrudan hatalı yere gidebilirsin; editörün sağ alt köşesi de imlecin satır
  ve sütununu gösterir.
feedback:
  - Hata ve uyarı sayıları en altta, `due to 2 previous errors` gibi bir satırda yazar.
  - Doğru!
  - İki sayı satır ve sütundur, bir aralık değil.
  - Hata kodu köşeli parantez içinde, `error[E0425]` gibi yazılır.
```

## Hatalar ve uyarılar

Derleyicinin iki tür mesajı vardır:

- **Hata** (*error*): Program **derlenmez**. Çalıştırılabilir dosya üretilmez; düzeltmek zorundasın.
- **Uyarı** (*warning*): Program **derlenir ve çalışır**, ama derleyici bir şeyin şüpheli ya da
  gereksiz olduğunu düşünüyor.

Bir tahmin: Aşağıdaki programda hiç kullanılmayan bir değişken var. Derlenir mi?

````compiles
code: |
  fn main() {
      let sayi = 7;
      let kullanilmayan = 3;
      println!("{sayi}");
  }
answer: true
explanation: |
  **Derlenir** ve `7` yazar. Ama derleyici bir **uyarı** verir:

  ```text
  warning: unused variable: `kullanilmayan`
   --> src/main.rs:3:9
    |
  3 |     let kullanilmayan = 3;
    |         ^^^^^^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_kullanilmayan`
    |
    = note: `#[warn(unused_variables)]` (part of `#[warn(unused)]`) on by default
  ```

  Kullanılmayan bir değişken programı bozmaz, ama çoğu zaman bir hatanın işaretidir: Belki
  yazdırmayı unuttun, belki yanlış değişkeni kullandın.
````

Uyarıyı okuyalım: "Kullanılmayan değişken: `kullanilmayan`." `help` iki yol sunuyor: Değişkeni
kullan ya da bilerek kullanmıyorsan adının başına alt çizgi koy (`_kullanilmayan`); alt çizgi,
derleyiciye "bunu biliyorum" demenin yoludur. `note` satırındaki `unused_variables` ise bu uyarı
kuralının adıdır. Derleyicinin bu tür kurallarına **lint** denir.

:::warning Uyarıları görmezden gelme
Uyarılar derlemeyi durdurmadığı için onları göz ardı etmek çok kolaydır. Ama on uyarının arasında
önemli bir tanesi kaybolur. İyi Rust programcıları kodlarını **sıfır uyarıyla** tutar. Rusteach'teki
bütün örnek kodlar da uyarısız olacak şekilde denetlendi. Çıktıdaki `run cargo fix` önerisi ise bazı
uyarıların Cargo tarafından otomatik düzeltilebileceğini söyler (`cargo fix`).
:::

Rusteach'te bir programı çalıştırdığında, derleyicinin uyarıları ve hataları çıktının altında
renklendirilmiş olarak görünür. `E0425` gibi hata kodları birer **düğmeye** dönüşür: Üzerine
tıklarsan hatanın Türkçe açıklamasını görürsün. Bütün hata kodlarının listesi **Sözlük > Hata
Rehberi** bölümünde.

## rustc --explain: hata kodunun uzun açıklaması

Her hata kodunun, örnekli uzun bir açıklaması vardır. Çıktının sonundaki satır bunu zaten söyler:

```text
For more information about this error, try `rustc --explain E0425`.
```

Terminalde bu komutu çalıştırırsan (Rust kuruluysa çevrimdışı da çalışır):

```console
PS C:\RustProjeleri\merhaba> rustc --explain E0425
An unresolved name was used.

Erroneous code examples:

    something_that_doesnt_exist::foo;
    // error: unresolved name `something_that_doesnt_exist::foo`
...
Please verify that the name wasn't misspelled and ensure that the
identifier being referred to is valid for the given situation.
```

"Çözümlenemeyen bir ad kullanıldı. Adın yanlış yazılmadığından emin ol..." Açıklamalar İngilizcedir,
hatalı ve doğru kod örnekleri içerir. Aynı metinleri internette **Rust Compiler Error Index**
sayfasında da bulabilirsin: `https://doc.rust-lang.org/error_codes/E0425.html`.

Her hatanın bir kodu yoktur. Örneğin `expected ;` gibi **sözdizimi** (*syntax*) hataları ve 5. derste
gördüğün biçim metni hataları genellikle kodsuz gelir; bunlar zaten kendi kendini açıklar. Kodlar,
açıklaması daha uzun sürecek hatalar içindir.

```quiz
question: |
  Hiç görmediğin bir `E0599` hatası aldın ve mesajı anlamadın. En iyi ilk adım hangisi?
options:
  - Kodu silip baştan yazmak
  - Mesajın tamamını (özet, etiketler, note ve help) okumak; hâlâ anlamadıysan `rustc --explain E0599` ile uzun açıklamaya bakmak
  - Hata kodunu görmezden gelip programı yine de çalıştırmayı denemek
  - Rastgele noktalı virgüller ekleyip yeniden derlemek
answer: 1
explanation: |
  Mesajın kendisi genellikle sorunu ve çoğu zaman çözümü söyler; `help` satırı özellikle değerlidir.
  Yeterli olmazsa `rustc --explain` (ya da Rusteach'te hata koduna tıklamak) hatanın neden var
  olduğunu örneklerle anlatır. Hata mesajlarını okuma alışkanlığı, Rust öğrenirken edinebileceğin en
  değerli alışkanlıklardan biridir.
feedback:
  - Hatanın nedenini öğrenmeden baştan yazarsan büyük olasılıkla aynı hatayı tekrar yaparsın.
  - Doğru!
  - Hata varken çalıştırılabilir dosya üretilmez; çalıştıracak bir şey yoktur.
  - Rastgele değişiklikler sorunu çözmez, çoğu zaman yeni hatalar ekler.
```

## Birden fazla hata: yukarıdan aşağıya, birer birer

Bu dersin başındaki programı hatırla: iki hatası vardı (`println`'de eksik `!` ve `derce` yazım
hatası). Programı biraz değiştirelim ve bir satırın sonundaki noktalı virgülü de silelim:

```rust,compile_fail
fn main() {
    let sehir = "Isparta";
    let derece = 21;
    println("Şehir: {sehir}")
    println!("Sıcaklık: {derce} derece");
}
```

Üç hata olduğuna göre üç mesaj bekleriz, değil mi? Derleyici şunu verir:

:::error
```text
error: expected `;`, found `println`
 --> src/main.rs:4:30
  |
4 |     println("Şehir: {sehir}")
  |                              ^ help: add `;` here
5 |     println!("Sıcaklık: {derce} derece");
  |     ------- unexpected token

error[E0425]: cannot find value `derce` in this scope
 --> src/main.rs:5:26
...
error: could not compile `playground` (bin "playground") due to 2 previous errors
```
Yalnızca **iki** hata! Eksik `!` hatası (E0423) listede yok. Noktalı virgülü ekleyip yeniden
derlersen, bu kez E0425 ile birlikte E0423 de görünür.
:::

Neden? Derleyici kodunu **aşamalar** hâlinde işler: önce metni okuyup yapısını çıkarır
(**ayrıştırma**, *parsing*), sonra makroları açar, sonra adları çözer, sonra tipleri denetler...
Erken bir aşamada sorun çıkarsa, derleyici kafası karışmış hâlde ilerleyip yanıltıcı mesajlar
üretmek yerine bazı denetimleri **atlar**. Bu yüzden:

1. **İlk hatadan başla.** Bir hata, başka hatalara yol açabilir ya da onları gizleyebilir. Listenin
   başındaki hata çoğu zaman asıl nedendir.
2. **Mesajın tamamını oku.** Özet, etiketler, `note` ve `help` birlikte bir hikâye anlatır.
3. **Gösterilen satıra ve bir öncekine bak.** Eksik `;` hatası, eksikliğin fark edildiği yerde, yani
   **bir sonraki** satırın başında (`unexpected token`) raporlanır.
4. **Birer birer düzelt, yeniden derle.** Bir düzeltme birkaç mesajı birden yok edebilir ya da yeni
   mesajları ortaya çıkarabilir. Hata sayısının bir anda artması kötü haber değildir: Derleyici
   bir aşama daha ilerleyebildi demektir.
5. **Hızlı denetim için `cargo check`.** Makine kodu üretmediği için çok daha hızlıdır (4. ders).

:::tip "Derlendi" her şey doğru demek değildir
Derleyici sözdizimini, adları, tipleri ve bellek kurallarını denetler. Ama programının **ne
yapması gerektiğini** bilemez: `"Toplam: {}"` yerine `"Ortalama: {}"` yazdıysan ya da yanlış
değişkeni yazdırdıysan, kod derlenir ama yanlış çıktı verir. Bu tür **mantık hatalarını** çıktıyı
dikkatle kontrol ederek ve ileride **testler** yazarak (Modül 13) yakalarsın.
:::

```parsons
prompt: |
  Bu programın ilk hâlinde üç hata vardı: eksik `!`, eksik `;` ve yanlış yazılmış bir değişken adı
  (`{puann}`). Hataları düzeltilmiş satırları doğru sıraya koy. Program `Ferris: 120 puan` ve ardından
  `Tebrikler!` yazmalı. Dikkat: Hâlâ hatalı olan satırlar da var.
lines: |
  fn main() {
      let oyuncu = "Ferris";
      let puan = 120;
      println!("{oyuncu}: {puan} puan");
      println!("Tebrikler!");
  }
distractors: |
      println!("{oyuncu}: {puann} puan");
      println("Tebrikler!");
      println!("{oyuncu}: {puan} puan")
explanation: |
  Düzeltilmiş program: `println!`'lerde `!` var, ortadaki satırda `;` var ve yer tutucu, tanımlı
  olan `puan` değişkenini kullanıyor. Hatalı satırlar sırasıyla E0425 (`puann` bulunamadı), E0423
  (`println` fonksiyonu yok, makroyu `!` ile çağır) ve `expected ;` hatası verirdi.
```

## Yardımcı araçlar: rustfmt ve clippy

Derleyicinin iki yardımcısı daha var. 2. derste Rust'ı kurarken ikisi de bilgisayarına geldi.

### rustfmt: tek bir stil, sıfır tartışma

Bu program **derlenir ve çalışır**, ama okuması bir işkence:

```rust
fn main(){println!("Bir");
        println!(  "İki" ) ;
  println!("Üç");}
```

Proje klasöründe **`cargo fmt`** komutunu çalıştırırsan, **rustfmt** aracı bütün dosyaları Rust'ın
resmî stil kurallarına göre yeniden düzenler:

```rust
fn main() {
    println!("Bir");
    println!("İki");
    println!("Üç");
}
```

4 boşluk girinti, süslü parantezlerin yeri, boşluklar, uzun satırların bölünmesi... Hepsi otomatik.
Bunun asıl değeri güzellikten öte: Dünyadaki neredeyse bütün Rust kodu **aynı stilde** yazıldığı
için, başkasının kodunu okumak kolaylaşır ve ekipler "süslü parantez nereye konur" tartışmasına
zaman harcamaz. (C ve C++ dünyasında böyle tek bir standart yoktur; JavaScript'te Prettier, Go'da
`gofmt` benzer bir rol oynar.)

```console
PS C:\RustProjeleri\merhaba> cargo fmt            # bütün dosyaları biçimlendir
PS C:\RustProjeleri\merhaba> cargo fmt --check    # yalnızca denetle: biçimsiz dosya varsa söyle
```

`cargo fmt` de hata olmadığında hiçbir şey yazmaz. `--check` dosyaları değiştirmez; biçimsiz bir
yer varsa farkı gösterir ve başarısız olur. Ekipler bunu, kod paylaşılmadan önce otomatik çalışan
denetimlerde kullanır. 2. derste VS Code'u **kaydederken biçimlendirecek** şekilde ayarladıysan,
rust-analyzer her kayıtta rustfmt'yi senin için çalıştırır.

### clippy: deneyimli bir göz

**Clippy**, derleyicinin denetimlerine ek olarak yüzlerce **lint** içeren bir araçtır. Kodun
**derlenen ama daha iyi yazılabilecek**, gereksiz ya da büyük olasılıkla hatalı yerlerini bulur.
Adı, eski Microsoft Office sürümlerindeki meşhur ataş asistanı Clippy'yi çağrıştırır (*clip*: ataş). Bu programı
`cargo clippy` ile denetleyelim:

```rust
fn main() {
    println!("");
    println!("{}", "Merhaba");
    let x = 5;
    let y = x * 1;
    println!("{y}");
}
```

Program derlenir ve sorunsuz çalışır. Clippy ise şunları söyler (kısaltılmış):

```text
warning: empty string literal in `println!`
 --> src/main.rs:2:5
  |
2 |     println!("");
  |     ^^^^^^^^^--^
  |              |
  |              help: remove the empty string

warning: literal with an empty format string
 --> src/main.rs:3:20
  |
3 |     println!("{}", "Merhaba");
  |                    ^^^^^^^^^
  |
help: try
  |
3 -     println!("{}", "Merhaba");
3 +     println!("Merhaba");
  |

warning: this operation has no effect
 --> src/main.rs:5:13
  |
5 |     let y = x * 1;
  |             ^^^^^ help: consider reducing it to: `x`
```

1. Boş satır için `println!("")` yerine `println!()` yeterli.
2. Sabit bir metni `{}` ile yerleştirmek gereksiz; metni doğrudan yaz. (5. derste yer tutucuları
   öğretmek için bunu bilerek yaptık!)
3. Bir sayıyı 1 ile çarpmak hiçbir şey değiştirmez.

Clippy'nin lint'leri gruplara ayrılır: **correctness** (neredeyse kesin hata; varsayılan olarak
**hata** düzeyindedir), **suspicious** (şüpheli), **style** (stil), **complexity** (gereksiz
karmaşıklık), **perf** (performans) ve varsayılan olarak kapalı olan, daha titiz **pedantic**. Mesela
`let pi = 3.14;` yazarsan clippy bunu bir **hata** sayar ve sana Rust'ın hazır, çok daha hassas
`std::f64::consts::PI` sabitini kullanmanı önerir. Her lint'in açıklaması, mesajdaki bağlantıda
örnekleriyle anlatılır.

:::info Clippy'yi editöründe kullan
2. derste VS Code ayarlarına eklediğin `"rust-analyzer.check.command": "clippy"` satırı sayesinde,
clippy'nin önerileri kaydettiğin anda editörde dalgalı çizgiler olarak görünür. Clippy'yi bir
öğretmen gibi düşün: Önerilerinin her biri, deneyimli Rust programcılarının yıllar içinde biriktirdiği
bir alışkanlığı öğretir.
:::

```quiz
question: |
  Aşağıdaki eşleştirmelerden hangisi **doğrudur**?
options:
  - "`cargo fmt` hataları düzeltir, `cargo clippy` kodu biçimlendirir"
  - "`cargo fmt` kodu resmî stile göre biçimlendirir; `cargo clippy` derlenen ama iyileştirilebilecek ya da şüpheli kodu bulur"
  - "`cargo fmt` ve `cargo clippy` aynı işi yapar; biri eski, biri yeni sürümdür"
  - "`cargo clippy` programı daha hızlı çalışacak şekilde derler"
answer: 1
explanation: |
  **rustfmt** (`cargo fmt`) yalnızca kodun **görünüşüyle** ilgilenir: girinti, boşluklar, satır
  bölme. Kodun anlamını asla değiştirmez. **Clippy** (`cargo clippy`) ise kodun **içeriğine** bakar:
  gereksiz işlemler, şüpheli kalıplar, daha deyimsel (*idiomatic*) yazım önerileri. İkisi birbirini
  tamamlar; çoğu Rust projesinde ikisi de düzenli olarak çalıştırılır.
feedback:
  - Tam tersi değil, ikisi farklı işler yapar ve hiçbiri derleme hatalarını senin yerine düzeltmez.
  - Doğru!
  - İkisi farklı araçlardır ve farklı sorunlara bakarlar.
  - "Hızlı çalışan derleme için `cargo build --release` kullanılır (4. ders)."
```

## Pratik: hataları düzelt

Artık sıra sende. Bu alıştırmalarda başlangıç kodu **derlenmiyor**; önce **Çalıştır**'a basıp
hata mesajlarını oku, sonra düzelt. Mesajlardaki ipuçlarını kullanmak kopya değildir, tam tersine
asıl beceri budur!

````exercise
id: m01-e-kutuphane-duyurusu
title: Kütüphane duyurusu
difficulty: 2
prompt: |
  Bu program bir kütüphane duyurusu yazdırmalı ama derlenmiyor. Derleyicinin mesajlarını okuyarak
  bütün hataları düzelt. Program düzeldiğinde tam olarak şunu yazdırmalı:

  ```text
  İl Halk Kütüphanesi bugün açık.
  Açılış saati: 9:00
  Herkesi bekleriz!
  ```

  Değişkenleri silme; değerleri metinlere elle yazmak yerine değişkenleri kullanmaya devam et.
starter: |
  fn main() {
      let kutuphane = "İl Halk Kütüphanesi";
      let saat = 9;
      println("{kutuphane} bugün açık.");
      println!("Açılış saati: {saaat}:00")
      println!("Herkesi bekleriz!");
  }
starter_compiles: false
solution: |
  fn main() {
      let kutuphane = "İl Halk Kütüphanesi";
      let saat = 9;
      println!("{kutuphane} bugün açık.");
      println!("Açılış saati: {saat}:00");
      println!("Herkesi bekleriz!");
  }
check: output
expected_output: |
  İl Halk Kütüphanesi bugün açık.
  Açılış saati: 9:00
  Herkesi bekleriz!
forbid:
  - pattern: "Kütüphanesi[\\s\\S]*Kütüphanesi"
    message: Kütüphane adını tekrar yazma; `{kutuphane}` yer tutucusunu kullan.
  - pattern: "saati: 9"
    message: Saati elle yazma; `{saat}` yer tutucusunu kullan.
hints:
  - |
    Mesajları yukarıdan aşağıya oku. İlki `expected ;` hatası: 5. satırın sonunda bir şey eksik.
    Onu düzeltip yeniden çalıştır; daha önce görünmeyen bir mesaj belirecek.
  - |
    `E0423` mesajındaki `help` satırını oku: `println` bir fonksiyon değil, bir makro. Makrolar
    nasıl çağrılır?
  - |
    Son hata `E0425`: `saaat` adında bir değişken yok. Derleyicinin önerdiği adı kullan: `{saat}`.
explanation: |
  Programda üç hata vardı ama ilk çalıştırmada yalnızca ikisini gördün:

  1. 5\. satırın sonunda eksik `;` → bir **sözdizimi** hatası. Derleyici bunu ilk aşamada yakalar.
  2. `println` yerine `println!` → `E0423`. Bu hata ilk çalıştırmada da listedeydi.
  3. `{saaat}` → `E0425`. Bu hata ancak `;` eklenince ortaya çıktı: Derleyici, sözdizimi bozuk olan
     5\. satırı düzgün okuyamadığı için o satırın içini hiç denetlememişti. Ders metnindeki örnekte
     de saklanan hata, `;`'si eksik satırdaki hataydı (orada E0423).

  Bir ilginçlik daha: `!` eksikken `"{kutuphane} bugün açık."` sıradan bir metindi; makroya
  dönüşünce biçim metni oldu ve içindeki adlar denetlenmeye başlandı. Hataların birbirini gizlemesi
  ve bir düzeltmenin yeni mesajları ortaya çıkarması Rust'ta çok normaldir. Önemli olan, her
  seferinde ilk mesajdan başlayıp mesajın tamamını okumak.
````

````exercise
id: m01-e-sinav-sonucu
title: Sınav sonucu bildirimi
difficulty: 3
prompt: |
  Bir deneme sınavı uygulaması, öğrenciye sonucunu bildiriyor. Program derlenmiyor; üstelik bir
  satırda derleyicinin yakalayamayacağı bir **mantık hatası** da var. Hepsini düzelt. Doğru çıktı:

  ```text
  Öğrenci: Can
  Doğru: 34, Yanlış: 6
  Toplam soru: 40
  Can, 40 sorunun 34 tanesini doğru yaptı.
  Rozet: {Can}
  ```

  Kural: `Can`, `34`, `6` ve `40` değerlerini metinlere elle yazma; değişkenleri ve argümanları
  kullan. (Toplam soru sayısını hesaplat.)
starter: |
  fn main() {
      let ogrenci = "Can";
      let dogru = 34;
      let yanlis = 6;
      println!("Öğrenci: {}", ogrenci, dogru);
      println!("Doğru: {dogru}, Yanlış: {yanlis}")
      println!("Toplam soru: {dogru + yanlis}");
      println!("{0}, {1} sorunun {2} tanesini doğru yaptı.", ogrenci, dogru + yanlis);
      println!("Rozet: {{ogrenci}}");
  }
starter_compiles: false
solution: |
  fn main() {
      let ogrenci = "Can";
      let dogru = 34;
      let yanlis = 6;
      println!("Öğrenci: {}", ogrenci);
      println!("Doğru: {dogru}, Yanlış: {yanlis}");
      println!("Toplam soru: {}", dogru + yanlis);
      println!("{0}, {1} sorunun {2} tanesini doğru yaptı.", ogrenci, dogru + yanlis, dogru);
      println!("Rozet: {{{ogrenci}}}");
  }
check: output
expected_output: |
  Öğrenci: Can
  Doğru: 34, Yanlış: 6
  Toplam soru: 40
  Can, 40 sorunun 34 tanesini doğru yaptı.
  Rozet: {Can}
forbid:
  - pattern: "Can[\\s\\S]*Can"
    message: Öğrencinin adını tekrar yazma; `ogrenci` değişkenini kullan.
  - pattern: "34[\\s\\S]*34"
    message: Doğru sayısını tekrar yazma; `dogru` değişkenini kullan.
  - pattern: "\\b40\\b"
    message: "Toplam soru sayısını elle yazma; `dogru + yanlis` ile hesaplat."
  - pattern: "Yanlış: 6"
    message: Yanlış sayısını elle yazma; `{yanlis}` yer tutucusunu kullan.
hints:
  - |
    Mesajları sırayla oku. Dört derleme hatası var: eksik `;`, kullanılmayan bir argüman
    (`argument never used`), yer tutucunun içinde bir hesaplama ve var olmayan bir sıra numarası
    (`{2}`). Hepsi bu modülde gördüğün hatalar. (Hesaplama hatasının mesajı 5. derstekinden biraz
    farklı: Derleyici `+`'yı bir biçim işareti sanıyor, ama sorun yine "yer tutucuda ifade".)
  - |
    `{dogru + yanlis}` yazılamaz: Satır içi yer tutucuya yalnızca ad yazılır. Hesaplamayı argüman
    olarak ver: `println!("Toplam soru: {}", dogru + yanlis);`. `{2}` için de üçüncü bir argüman
    (`dogru`) ekle.
  - |
    Program derlendikten sonra çıktıyı karşılaştır: Son satır `Rozet: {ogrenci}` yazıyor, çünkü `{{`
    ve `}}` kaçış dizileri. Hem süslü parantez hem değer için üç tane gerekir: `{{{ogrenci}}}`.
explanation: |
  Düzeltmeler:

  | Satır | Sorun | Düzeltme |
  |---|---|---|
  | `"Öğrenci: {}", ogrenci, dogru` | Fazla argüman (`argument never used`) | `dogru`'yu sil |
  | `"Doğru: ..."` | Eksik `;` | Satır sonuna `;` |
  | `{dogru + yanlis}` | Yer tutucuda ifade | `{}` ve argüman olarak `dogru + yanlis` |
  | `{2}` | Yalnızca 2 argüman var (0 ve 1) | Üçüncü argüman: `dogru` |
  | `{{ogrenci}}` | **Mantık hatası**: derlenir ama `{ogrenci}` yazar | `{{{ogrenci}}}` |

  Son satır bu alıştırmanın en önemli dersi: Derleyici `{{ogrenci}}`'ye hiç itiraz etmez, çünkü
  sözdizimi tamamen geçerlidir. Programın **ne yapması gerektiğini** bilen tek kişi sensin. Bu
  yüzden "derlendi" ile "doğru çalışıyor" arasındaki farkı her zaman çıktıyı kontrol ederek
  kapatırsın; ileride bunu testlerle otomatikleştireceksin.
````

## Özet

:::remember
- Hata mesajının parçaları: **düzey ve kod** (`error[E0425]`), **özet**, **konum**
  (`dosya:satır:sütun`), **etiketler** (`^^^` asıl yer, `---` ilgili yerler), **`note`** ve
  **`help`** (çoğu zaman çözümün kendisi).
- **Hata** derlemeyi durdurur; **uyarı** durdurmaz ama ciddiye alınmalıdır. Kullanılmayan bir
  değişkeni bilerek tutuyorsan adını `_` ile başlat.
- **`rustc --explain E0425`** bir hata kodunun örnekli uzun açıklamasını gösterir.
- Hatalar **aşama aşama** raporlanır: **ilk hatadan başla**, mesajın tamamını oku, **birer birer
  düzelt ve yeniden derle**.
- **`cargo fmt`** kodu resmî stile göre biçimlendirir; **`cargo clippy`** derlenen ama
  iyileştirilebilecek ya da şüpheli kodu bulur.
- **Derlenmek doğru çalışmak demek değildir**: Çıktıyı her zaman kontrol et.
:::

```reflect
prompt: |
  Bu modülün başında bir hata mesajı gördüğünde ne hissediyordun, şimdi ne hissediyorsun? Bir hata
  mesajıyla karşılaştığında izleyeceğin adımları kendi cümlelerinle sırala.
answer: |
  Model cevap: Hata mesajları artık bana bir engel değil, bir yol tarifi gibi geliyor. Bir hata
  aldığımda önce listenin başındaki ilk hatayı seçiyorum. Hata kodunu ve özeti okuyup konuma
  (dosya:satır:sütun) gidiyorum; `^^^` ile işaretlenen yere ve gerekirse bir önceki satıra
  bakıyorum. `note` ve `help` satırlarını okuyorum, çünkü çözüm çoğu zaman orada yazıyor.
  Anlamadığım bir kod varsa `rustc --explain` ile açıklamasına bakıyorum. Sonra yalnızca o hatayı
  düzeltip yeniden derliyorum. Program derlendiğinde de çıktının gerçekten istediğim gibi olup
  olmadığını kontrol ediyorum.
```

```flashcards
- front: "`--> src/main.rs:5:26` satırındaki 5 ve 26 neyi gösterir?"
  back: Hatanın 5. satırda ve 26. sütunda (karakterde) olduğunu.
- front: Bir hata mesajındaki `help:` satırı ne işe yarar?
  back: Sorunu nasıl düzelteceğine dair somut bir öneri sunar; çoğu zaman eklenecek ya da değiştirilecek kodu gösterir.
- front: Hata (error) ile uyarı (warning) arasındaki fark nedir?
  back: Hata derlemeyi durdurur, çalıştırılabilir dosya üretilmez. Uyarıda program derlenir ve çalışır ama şüpheli bir şey vardır.
- front: Kullanılmayan bir değişken uyarısını, değişkeni silmeden nasıl susturursun?
  back: "Adının başına alt çizgi koyarak: `_kullanilmayan`."
- front: Bir hata kodunun uzun açıklamasını terminalde nasıl görürsün?
  back: "`rustc --explain E0425` (kendi hata kodunla)."
- front: Birden fazla hata aldığında hangisinden başlamalısın ve neden?
  back: İlkinden. Derleyici aşama aşama çalışır; erken bir hata başka hatalara yol açabilir ya da onları gizleyebilir.
- front: "`cargo fmt` ne yapar?"
  back: Projedeki kodu rustfmt ile Rust'ın resmî stiline göre biçimlendirir. Kodun anlamını değiştirmez.
- front: "`cargo clippy` ne yapar?"
  back: Derlenen ama gereksiz, şüpheli ya da daha iyi yazılabilecek kodu bulan yüzlerce lint'i çalıştırır ve öneriler sunar.
```
