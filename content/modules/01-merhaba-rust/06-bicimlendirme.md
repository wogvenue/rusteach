---
id: m01-l06
title: "Çıktıyı biçimlendirmek: hizalama, hassasiyet ve format!"
minutes: 18
type: lesson
objectives:
  - "Genişlik, hizalama ve dolgu belirteçleriyle (`{:>8}`, `{:<8}`, `{:^8}`, `{:08}`) düzgün sütunlu çıktılar üretebilmek"
  - "`{:.2}` ile ondalık hassasiyetini ayarlayıp yuvarlamanın nasıl çalıştığını açıklayabilmek"
  - "`print!`, `println!`, `eprintln!` ve `format!` arasından amaca uygun olanı seçebilmek"
  - Standart çıktı (stdout) ile standart hata akışının (stderr) neden ayrı olduğunu açıklayabilmek
keywords: [biçimlendirme, genişlik, hizalama, dolgu, hassasiyet, "print!", "eprintln!", "format!", stdout, stderr]
---

Bir market fişini düşün: Ürün adları solda, fiyatlar sağda, kuruşlar alt alta, en altta kalın bir
çizgi ve toplam. Bu düzen olmasa fişi okumak bir bulmacaya dönerdi. Önceki derste değerleri metne
yerleştirmeyi öğrendin; bu derste onları **nasıl** yerleştireceğini, kaç karakterlik yer
kaplayacaklarını, sağa mı sola mı yaslanacaklarını, kaç basamak gösterileceğini, öğreneceksin. Bir
de ekrana yazmanın `println!`'den başka yollarını.

## Genişlik: sütunları hizalamak

Önce sorunu görelim. Bu program bir fiyat listesi yazdırıyor, ama sütunlar kayık:

```rust
fn main() {
    println!("{} {}", "Çay", 10);
    println!("{} {}", "Türk kahvesi", 60);
    println!("{} {}", "Su", 5);
}
```

Çözüm, her değere **sabit bir genişlik** (*width*) vermek. Yer tutucunun içine iki nokta üst üste ve
bir sayı yazarsın: `{:15}` "bu değer **en az** 15 karakter yer kaplasın" demektir. Değer daha kısaysa
geri kalanı boşlukla doldurulur. Peki boşluklar değerin hangi tarafına gelir? Tahmin et:

```predict
code: |
  fn main() {
      println!("[{:6}]", "abc");
      println!("[{:6}]", 42);
  }
options:
  - |
    [abc   ]
    [42    ]
  - |
    [abc   ]
    [    42]
  - |
    [   abc]
    [    42]
answer: 1
explanation: |
  Şaşırtıcı ama mantıklı: **Metinler varsayılan olarak sola**, **sayılar sağa** yaslanır. Çünkü
  metinleri soldan okuruz; sayıları ise birler, onlar, yüzler basamağı alt alta gelsin diye sağa
  yaslarız. Köşeli parantezleri, boşlukları görünür kılmak için ekledik.
```

Artık fiyat listesini düzeltebiliriz:

```rust
fn main() {
    println!("{:15}{:5} TL", "Çay", 10);
    println!("{:15}{:5} TL", "Türk kahvesi", 60);
    println!("{:15}{:5} TL", "Su", 5);
}
```

Biçim belirtecinin genel yapısı şudur: **`{` hangi değer `:` nasıl yazılacağı `}`**. İki nokta üst
üsteden **önce** değerin kendisini seçersin (boş, `0`, ya da `ad`); **sonra** da biçimi. Önceki
dersteki her yazımla birleşir:

| Yazım | Anlamı |
|---|---|
| `{:8}` | Sıradaki argüman, en az 8 karakter |
| `{1:8}` | 1 numaralı argüman, en az 8 karakter |
| `{fiyat:8}` | `fiyat` değişkeni, en az 8 karakter |
| `{fiyat:?}` | `fiyat` değişkeni, Debug biçimi (`?` de bir biçim belirtecidir!) |

:::warning Genişlik bir alt sınırdır, kesmez
`{:3}` ile `"uzun metin"` yazdırırsan metin kesilmez, olduğu gibi yazılır: `[uzun metin]`. Genişlik
"en az bu kadar yer kapla" demektir; değer zaten daha uzunsa hiçbir şey eklenmez. Sütunlarının
kaymasını istemiyorsan genişliği en uzun değere göre seç.
:::

## Hizalama ve dolgu

Varsayılan yönü beğenmiyorsan genişliğin önüne bir **hizalama** (*alignment*) işareti koyarsın:

| Belirteç | Anlamı | `"ab"` için sonuç |
|---|---|---|
| `{:<6}` | Sola yasla | `[ab    ]` |
| `{:>6}` | Sağa yasla | `[    ab]` |
| `{:^6}` | Ortala | `[  ab  ]` |
| `{:*^6}` | Ortala, boşluk yerine `*` ile doldur | `[**ab**]` |
| `{:06}` | (sayılar için) başını sıfırla doldur | `42` → `[000042]` |

Ok işaretleri gibi düşünebilirsin: `<` değeri sola, `>` sağa iter; `^` ortada tutar. Hizalama
işaretinin **önüne** tek bir karakter yazarsan boşluk yerine o karakterle doldurulur: `{:-^20}`,
`{:.<12}`, `{:=>8}`... Bu, başlıklar ve çizgiler için birebirdir:

```rust
fn main() {
    println!("{:=^30}", " KARNE ");
    println!("{:.<20}{:>10}", "Matematik", 85);
    println!("{:.<20}{:>10}", "Türkçe", 92);
    println!("{:.<20}{:>10}", "Fizik", 78);
    println!("{:-<30}", "");
    println!("Okul no: {:06}", 1453);
}
```

Son iki satıra dikkat: `{:-<30}` boş bir metni (`""`) 30 karakterlik alana yerleştirip kalanını `-`
ile doldurarak bir çizgi çizer. `{:06}` ise `1453`'ü `001453` yapar. Sıfır dolgusu sayının işaretini
de hesaba katar: `-42`, `{:05}` ile `-0042` olur; eksi işareti en başta kalır.

:::analogy Kutucuklu form
Bankada ya da postanede doldurduğun, her harf için bir kutucuk olan formları hatırla. "Ad" alanında
10 kutu var; adın "Ali" ise ilk üç kutuya yazar, kalan yedi kutuyu boş bırakırsın (**sola
yaslama**). Tutar alanında ise rakamları sağdan doldurursun ki kuruşlar ve liralar hep aynı
kutulara düşsün (**sağa yaslama**). Genişlik kutu sayısıdır, hizalama ise yazmaya hangi uçtan
başladığın.
:::

````fill
prompt: |
  Boşlukları doldur. Çıktı tam olarak şu olmalı (ürün adları 10 karakterlik alanda sola, adetler 4
  karakterlik alanda sağa yaslı; başlık 14 karakterlik alanda `*` ile ortalanmış):

  ```text
  *** Sepet ****
  Elma         3
  Karpuz      12
  ```
code: |
  fn main() {
      println!("{:___0}", " Sepet ");
      println!("{:<10}{:___1}", "Elma", 3);
      println!("{:<10}{:___2}", "Karpuz", 12);
  }
blanks:
  - ["*^14"]
  - [">4", "4"]
  - [">4", "4"]
explanation: |
  `" Sepet "` 7 karakterdir; 14 karakterlik alanda ortalanınca 7 dolgu karakteri kalır. Tam ortaya
  bölünemediği için Rust fazla karakteri **sağa** koyar: solda 3, sağda 4 yıldız. Adetler sayı
  olduğu için `{:4}` de zaten sağa yaslardı; `{:>4}` ise niyetini açıkça gösterir.
````

## Hassasiyet: kaç basamak?

Ondalık sayılarla (Modül 2'de ayrıntılı göreceğin `f64` tipi) çalışırken çoğu zaman bütün basamakları
göstermek istemezsin. Fiyatlar iki, sıcaklıklar bir basamak ister. Nokta ve bir sayı, yani
`{:.2}`, **hassasiyeti** (*precision*) belirler:

```rust
fn main() {
    let boy = 1.78456; // metre
    println!("{boy}");
    println!("{boy:.2}");
    println!("{boy:.0}");
    println!("[{boy:8.3}]");
    println!("[{boy:>8.1}] [{boy:<8.1}] [{boy:08.2}]");
    println!("{:.2} TL", 7.5);
}
```

- `{:.2}` virgülden sonra **tam 2 basamak** gösterir; gerekirse **yuvarlar** (`1.78456` → `1.78`),
  gerekirse **sıfır ekler** (`7.5` → `7.50`).
- Genişlik ve hassasiyet birlikte kullanılabilir: `{:8.3}` "toplam en az 8 karakter, virgülden
  sonra 3 basamak" demektir. Genişliğe nokta ve basamaklar da dahildir.
- Satır içi biçimde sıra hep aynıdır: **ad, iki nokta, dolgu/hizalama, genişlik, hassasiyet**:
  `{fiyat:>8.2}`.

Peki hassasiyet bir **metne** uygulanırsa ne olur? Tahmin et:

```predict
code: |
  fn main() {
      println!("[{:.3}]", "Merhaba");
      println!("[{:6.2}]", "Merhaba");
  }
options:
  - |
    [Mer]
    [Me    ]
  - |
    [Merhaba]
    [Merhaba]
  - |
    [Merhaba.000]
    [Merhaba.00]
answer: 0
explanation: |
  Metinlerde hassasiyet, **en fazla kaç karakter** yazılacağını belirler: `{:.3}` ilk 3 karakteri
  alır ve gerisini **keser**. Genişlik bir alt sınırdır (kesmez), hassasiyet ise metinler için bir
  üst sınırdır. `{:6.2}`'de önce `Me`'ye kesilir, sonra 6 karakterlik alana sola yaslanır.
```

:::deep Yuvarlama sana sürpriz yapabilir
`println!("{:.2}", 2.675);` ekrana `2.68` değil **`2.67`** yazar. Neden? Bilgisayarlar ondalık
sayıları ikilik sistemde (*binary*) saklar ve `2.675` ikilik sistemde tam olarak ifade edilemez;
bellekte aslında `2.67499999999999982236431605997495353221893310546875` durur. Rust bu gerçek değeri
yuvarlar. Bir de şu var: Değer **tam ortadaysa** (örneğin ikilikte tam ifade edilebilen `0.125`),
Rust "yarımı çift sayıya yuvarla" (*round half to even*) kuralını uygular: `{:.2}` ile `0.125` →
`0.12`, `0.375` → `0.38`. Bu kural, çok sayıda yuvarlamada hataların birikmesini önler.
Ondalık sayıların inceliklerini Modül 2'de, para gibi kesin hesap gerektiren durumların nasıl
ele alındığını ise ilerleyen modüllerde göreceksin.
:::

:::tip Genişliği bir değişkenden almak
Genişliği programın çalışırken belirlemesi gerekiyorsa sayının yerine bir değişken adı ve `$`
yazarsın: `{:>genislik$}`. Hassasiyet için de aynısı geçerli: `{:.basamak$}`.
```text
let genislik = 12;
println!("[{:>genislik$}]", "sağda");   → [       sağda]
```
:::

Biçim belirteçleri bunlarla bitmez. Şimdilik bilmen yeterli olan birkaçı:

| Belirteç | Anlamı | Örnek | Sonuç |
|---|---|---|---|
| `{:+}` | Pozitif sayılarda da işaret göster | `7` | `+7` |
| `{:b}` | İkilik (*binary*) sistemde yaz | `5` | `101` |
| `{:x}` | Onaltılık (*hexadecimal*) sistemde yaz | `255` | `ff` |
| `{:#x}` | Onaltılık, `0x` önekiyle | `255` | `0xff` |
| `{:e}` | Bilimsel gösterim | `1234.5` | `1.2345e3` |

```quiz
question: |
  `let ort = 72.456;` için `println!("[{ort:>7.1}]");` ne yazdırır?
options:
  - "`[   72.5]`"
  - "`[72.5   ]`"
  - "`[   72.4]`"
  - "`[72.456 ]`"
answer: 0
explanation: |
  `.1` virgülden sonra bir basamak bırakır ve yuvarlar: `72.456` → `72.5` (çünkü atılan kısım
  `0.056`, yarımdan büyük). Sonuç 4 karakterdir; `>7` onu 7 karakterlik alanda sağa yaslar, yani
  başına 3 boşluk koyar.
feedback:
  - Doğru!
  - "`>` sağa yaslar; boşluklar sola gelir."
  - "`72.456`'yı bir basamağa yuvarlarken `0.056` atılır, bu da yukarı yuvarlamayı gerektirir: `72.5`."
  - Hassasiyet (`.1`) uygulanmamış; `.1` yalnızca bir ondalık basamak bırakır.
```

## print! ve println!

`println!`'in adı **print line**'dan gelir: Yazar ve **satır sonuna geçer**. Kardeşi **`print!`** ise
yazar ama **alt satıra geçmez**; bir sonraki çıktı aynı satırda devam eder:

```rust
fn main() {
    print!("Yükleniyor");
    print!(".");
    print!(".");
    print!(".");
    println!(" tamam!");
    println!();
    println!("Yukarıda boş bir satır var.");
}
```

`println!();` (argümansız) yalnızca bir satır sonu yazar, yani **boş bir satır** üretir. Aslında
`println!("x")` ile `print!("x\n")` aynı işi yapar.

```predict
code: |
  fn main() {
      print!("A");
      println!("B");
      print!("C");
      print!("D");
      println!();
      print!("E\n");
      println!("F");
  }
options:
  - |
    AB
    CD
    E
    F
  - |
    A
    B
    C
    D
    E
    F
  - |
    AB
    CDE
    F
answer: 0
explanation: |
  `print!("A")` satırı açık bırakır; `println!("B")` aynı satıra `B` yazıp satırı kapatır → `AB`.
  `C` ve `D` aynı satıra yazılır, argümansız `println!()` satırı kapatır → `CD`. `print!("E\n")`
  içindeki `\n` satırı kendisi kapatır → `E`. Son olarak `F`.
```

:::info print! neden bazen hemen görünmez?
Ekrana yazmak işletim sistemi açısından görece pahalı bir işlemdir. Bu yüzden Rust standart çıktıya
yazılanları önce bir **arabellekte** (*buffer*) biriktirir ve genellikle bir satır sonu geldiğinde
toplu olarak gönderir. `print!` satır sonu yazmadığı için, metin bazen arabellekte bekler. Kullanıcıdan
girdi okuyan programlarda "Adını gir: " gibi bir istemin hemen görünmesi için arabelleği elle
boşaltmak (*flush*) gerekir; bunu girdi okuyan programlar yazmaya başladığında göreceksin. Program bittiğinde
arabellek her zaman boşaltılır, bu yüzden buradaki örneklerde sorun yaşamazsın.
:::

## eprintln!: hatalar için ayrı bir kanal

Her program, işletim sisteminden iki ayrı çıktı kanalıyla doğar:

- **Standart çıktı** (*standard output*, **stdout**): Programın asıl ürünü. `print!` ve `println!`
  buraya yazar.
- **Standart hata** (*standard error*, **stderr**): Hata mesajları, uyarılar, ilerleme bilgileri.
  `eprint!` ve **`eprintln!`** buraya yazar (baştaki `e`, *error*'dan gelir).

Terminalde ikisi de aynı ekranda görünür, bu yüzden fark ilk bakışta anlaşılmaz. Fark, çıktıyı bir
dosyaya **yönlendirdiğinde** ortaya çıkar:

```rust
fn main() {
    println!("Isparta: 21 derece");
    println!("Antalya: 31 derece");
    eprintln!("Uyarı: Erzurum verisi alınamadı!");
}
```

```console
PS C:\RustProjeleri\hava> cargo run > rapor.txt
   Compiling hava v0.1.0 (C:\RustProjeleri\hava)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.48s
     Running `target\debug\hava.exe`
Uyarı: Erzurum verisi alınamadı!
PS C:\RustProjeleri\hava> Get-Content rapor.txt
Isparta: 21 derece
Antalya: 31 derece
```

`>` işareti stdout'u `rapor.txt` dosyasına yönlendirdi; rapor temiz kaldı. Uyarı ise stderr'den
geldiği için ekranda, tam da görülmesi gereken yerde göründü. Fark ettin mi? Cargo'nun kendi
`Compiling`, `Finished`, `Running` satırları da ekranda kaldı: Cargo da durum mesajlarını stderr'e
yazar ki programının çıktısına karışmasın.

:::analogy İki boru
Bir evin iki ayrı borusu vardır: temiz su ve atık su. İkisi de evden geçer ama asla karışmaz ve
farklı yerlere gider. stdout programının "temiz suyu", yani asıl ürünüdür; başka bir programa ya da
dosyaya akabilir. stderr ise sorunların aktığı ayrı borudur. Hata mesajlarını stdout'a yazmak, atık
suyu musluktan akıtmak gibidir: Çıktını kullanan herkes onu da içmek zorunda kalır.
:::

Rusteach'te bir programı çalıştırdığında stderr'e yazılanlar, stdout'un **altında**, kesikli bir
çizgiyle ayrılmış olarak görünür. İki akış ayrı ayrı toplandığı için, kodda hangi sırayla yazılmış
olursa olsun stderr satırları en altta yer alır. Derleyicinin uyarıları ve hataları da aynı
bölümde görünür; çünkü `rustc` ve `cargo` da onları stderr'e yazar.

```quiz
question: |
  Bir program, bulduğu öğrenci notlarını yazdırıyor; çıktısı `cargo run > notlar.txt` ile dosyaya
  kaydedilecek. "3 kayıt bozuk, atlandı" mesajı için hangisi doğru seçimdir?
options:
  - "`println!`, çünkü bütün mesajlar aynı yere gitmeli"
  - "`eprintln!`, çünkü bu bir uyarı; dosyadaki asıl veriye karışmamalı ve kullanıcı ekranda görmeli"
  - "`print!`, çünkü satır sonu gerekmiyor"
  - Fark etmez; ikisi de aynı ekrana yazar
answer: 1
explanation: |
  `notlar.txt` yalnızca notları içermeli; ileride başka bir program onu okuyabilir. Uyarı mesajı
  stdout'a yazılırsa dosyaya karışır ve hem dosyayı bozar hem de kullanıcı uyarıyı göremez.
  `eprintln!` ile stderr'e yazılan mesaj, yönlendirmeden etkilenmez ve ekranda kalır.
feedback:
  - Bu durumda uyarı `notlar.txt`'ye karışır ve kullanıcı onu ekranda görmez.
  - Doğru!
  - "`print!` da stdout'a yazar; sorun satır sonu değil, mesajın gittiği kanal."
  - Terminalde aynı görünürler, ama yönlendirme yapıldığında farklı yerlere giderler.
```

## format!: metni ekrana değil, bir değere yaz

Bazen biçimlendirilmiş metni hemen yazdırmak yerine **saklamak** istersin: Daha sonra kullanmak,
birkaç yerde tekrar etmek ya da başka bir metnin parçası yapmak için. **`format!`** tam olarak
`println!` gibi çalışır, aynı yer tutucular, aynı belirteçler, ama ekrana yazmak yerine sonucu bir
**`String`** değeri olarak **döndürür**:

```rust
fn main() {
    let ad = "Elif";
    let puan = 9.456;
    let etiket = format!("{ad} ({puan:.1} puan)");
    println!("Birinci: {etiket}");
    println!("[{etiket:^20}]");
    let cizgi = format!("{:-<20}", "");
    println!("{cizgi}");
}
```

`format!` hiçbir şey yazdırmaz; ürettiği metin `etiket` değişkenine konur ve sonra istediğin kadar
kullanılabilir. Hatta biçimlendirilmiş bir metni bir kez daha biçimlendirebilirsin (`{etiket:^20}`).
`String`, Rust'ın büyüyebilen metin tipidir; nasıl çalıştığını Modül 4'te, ayrıntılarını Modül 9'da
göreceksin.

Bütün yazdırma makrolarını bir arada görelim:

| Makro | Nereye yazar? | Satır sonu? |
|---|---|---|
| `print!` | stdout | Hayır |
| `println!` | stdout | Evet |
| `eprint!` | stderr | Hayır |
| `eprintln!` | stderr | Evet |
| `format!` | Hiçbir yere; bir `String` döndürür | - |

Hepsi aynı biçim "dilini" konuşur; birini öğrenmek hepsini öğrenmek demektir. (Arkalarında aynı
`format_args!` makrosu çalışır; 3. dersteki "Derinlemesine" kutusunu hatırla.)

````parsons
prompt: |
  Satırları sıraya koy. Program bir başlığı `format!` ile hazırlayıp iki kez kullanmalı ve şunu
  yazdırmalı:

  ```text
  == Menü ==
  Pide: 180 TL
  == Menü ==
  ```
lines: |
  fn main() {
      let baslik = format!("{:=^10}", " Menü ");
      println!("{baslik}");
      println!("Pide: {} TL", 180);
      println!("{baslik}");
  }
distractors: |
      let baslik = println!("{:=^10}", " Menü ");
      format!("{baslik}");
explanation: |
  `format!` metni üretip `baslik`'e verir; değişken tanımlandıktan sonra iki kez kullanılabilir.
  Hatalı satırlar: `println!` ekrana yazar ama kullanışlı bir değer döndürmez, bu yüzden
  `baslik`'e bir başlık metni koymaz. `format!("{baslik}")` ise metni üretip hiçbir yere
  koymadığı için ekranda bir şey görünmez (derleyici de bunun için uyarı verir).
````

İlk alıştırma: Bir market fişi. Bu tür alıştırmalarda çıktı **karakteri karakterine** karşılaştırılır;
boşluk sayıları da önemli.

````exercise
id: m01-e-market-fisi
title: Market fişi
difficulty: 2
prompt: |
  Ürünler ve fiyatlar değişkenlerde hazır. Biçim belirteçlerini kullanarak tam olarak şu fişi
  yazdır:

  ```text
  Ekmek          12.50 TL
  Süt            38.00 TL
  Peynir        189.90 TL
  -----------------------
  TOPLAM        240.40 TL
  ```

  - Ürün adları (ve `TOPLAM`) **10** karakterlik alanda sola yaslı.
  - Fiyatlar **10** karakterlik alanda sağa yaslı, virgülden sonra **2** basamaklı; ardından ` TL`.
  - Çizgi **23** tane `-`'den oluşuyor; onu da bir biçim belirteciyle üret.

  Boşlukları elle sayıp yazmak yok: Hizalamayı biçim belirteçleri yapmalı.
starter: |
  fn main() {
      let urun1 = "Ekmek";
      let fiyat1 = 12.5;
      let urun2 = "Süt";
      let fiyat2 = 38.0;
      let urun3 = "Peynir";
      let fiyat3 = 189.9;
      let toplam = fiyat1 + fiyat2 + fiyat3;

      println!("{urun1} {fiyat1} TL");
      println!("{urun2} {fiyat2} TL");
      println!("{urun3} {fiyat3} TL");
      println!("TOPLAM {toplam} TL");
  }
solution: |
  fn main() {
      let urun1 = "Ekmek";
      let fiyat1 = 12.5;
      let urun2 = "Süt";
      let fiyat2 = 38.0;
      let urun3 = "Peynir";
      let fiyat3 = 189.9;
      let toplam = fiyat1 + fiyat2 + fiyat3;

      println!("{urun1:<10}{fiyat1:>10.2} TL");
      println!("{urun2:<10}{fiyat2:>10.2} TL");
      println!("{urun3:<10}{fiyat3:>10.2} TL");
      println!("{:-<23}", "");
      println!("{:<10}{toplam:>10.2} TL", "TOPLAM");
  }
check: output
expected_output: |
  Ekmek          12.50 TL
  Süt            38.00 TL
  Peynir        189.90 TL
  -----------------------
  TOPLAM        240.40 TL
forbid:
  - pattern: "\"[^\"\\n]*   [^\"\\n]*\""
    message: Metinlerin içine art arda boşluklar yazma; hizalamayı genişlik belirteçleriyle yap.
  - pattern: "12\\.50|38\\.00|189\\.90|240\\.40"
    message: Fiyatları elle yazma; `{fiyat1:>10.2}` gibi bir hassasiyet belirteci kullan.
  - pattern: "-----"
    message: Çizgiyi elle yazma; `{:-<23}` gibi bir dolgu belirteciyle üret.
require:
  - pattern: "\\.2\\}"
    message: "Fiyatlarda iki basamak için hassasiyet belirteci (`.2`) kullanmalısın."
hints:
  - |
    Bir satır iki parçadan oluşuyor: 10 karakterlik sola yaslı ad (`{urun1:<10}`) ve 10 karakterlik
    sağa yaslı fiyat. Fiyatın belirteci hem hizalama hem genişlik hem de hassasiyet içerir.
  - |
    Fiyat için: `{fiyat1:>10.2}`. Çizgi için boş bir metni dolgu karakteriyle doldur:
    `println!("{:-<23}", "");`
  - |
    `TOPLAM` bir değişken değil, bir metin; onu argüman olarak verebilirsin:
    `println!("{:<10}{toplam:>10.2} TL", "TOPLAM");`
explanation: |
  Her satır iki "kutudan" oluşur: 10 karakterlik ad kutusu (`<10`, sola yaslı) ve 10 karakterlik
  fiyat kutusu (`>10.2`, sağa yaslı, 2 basamak). Kutuların genişliği sabit olduğu için ad ne kadar
  kısa ya da uzun olursa olsun (10 karakteri geçmedikçe) fiyatlar hep aynı sütunda, kuruşlar alt alta
  durur. `38.0`'ın `38.00` olması da `.2`'nin işidir: Gerekirse sıfır ekler.

  Çizgi için kullandığımız `{:-<23}` hilesi yaygındır: Boş metni 23 karakterlik alana koyup kalanını
  `-` ile doldurur. `TOPLAM` satırında satır içi argüman (`{toplam:>10.2}`) ile sıralı argümanı
  (`{:<10}` → `"TOPLAM"`) aynı biçim metninde karıştırdık; bu serbesttir.

  Bir not: Gerçek muhasebe programları parayı ondalık sayılarla değil, kuruş cinsinden tamsayılarla
  ya da özel ondalık tiplerle tutar; ondalık sayıların yuvarlama inceliklerini Modül 2'de göreceksin.
````

İkinci alıştırma bütün dersi birleştiriyor: `format!`, hassasiyet, hizalama ve `eprintln!`.

````exercise
id: m01-e-hava-durumu
title: Hava durumu raporu
difficulty: 3
prompt: |
  Bir hava durumu programı, raporunu stdout'a, uyarılarını stderr'e yazacak. Programın
  **stdout**'u tam olarak şu olmalı:

  ```text
  ====== HAVA DURUMU ======
  Isparta    |   21.5 °C
  Antalya    |   31.0 °C
  Erzurum    |   -3.7 °C
  ```

  - Başlık: `" HAVA DURUMU "` metni **25** karakterlik alanda `=` ile ortalanmış. Başlığı önce
    `format!` ile bir değişkene koy, sonra yazdır.
  - Şehir adları **10** karakterlik alanda sola yaslı; ardından ` | `.
  - Sıcaklıklar **6** karakterlik alanda sağa yaslı, virgülden sonra **1** basamaklı; ardından ` °C`.
  - Ek olarak `Uyarı: Erzurum'da sıcaklık sıfırın altında!` mesajını **stderr**'e yaz. (Kontrol
    yalnızca stdout'a bakar; mesajı yanlış kanala yazarsan stdout'ta fazladan bir satır olur!)
starter: |
  fn main() {
      let sehir1 = "Isparta";
      let derece1 = 21.456;
      let sehir2 = "Antalya";
      let derece2 = 31.04;
      let sehir3 = "Erzurum";
      let derece3 = -3.68;

      println!("HAVA DURUMU");
      println!("{sehir1} {derece1}");
      println!("{sehir2} {derece2}");
      println!("{sehir3} {derece3}");
  }
solution: |
  fn main() {
      let sehir1 = "Isparta";
      let derece1 = 21.456;
      let sehir2 = "Antalya";
      let derece2 = 31.04;
      let sehir3 = "Erzurum";
      let derece3 = -3.68;

      let baslik = format!("{:=^25}", " HAVA DURUMU ");
      println!("{baslik}");
      println!("{sehir1:<10} | {derece1:>6.1} °C");
      println!("{sehir2:<10} | {derece2:>6.1} °C");
      println!("{sehir3:<10} | {derece3:>6.1} °C");
      eprintln!("Uyarı: {sehir3}'da sıcaklık sıfırın altında!");
  }
check: output
expected_output: |
  ====== HAVA DURUMU ======
  Isparta    |   21.5 °C
  Antalya    |   31.0 °C
  Erzurum    |   -3.7 °C
forbid:
  - pattern: "\"[^\"\\n]*   [^\"\\n]*\""
    message: Metinlerin içine art arda boşluklar yazma; hizalamayı genişlik belirteçleriyle yap.
  - pattern: "21\\.5\\b|31\\.0\\b|-3\\.7\\b"
    message: Sıcaklıkları elle yuvarlayıp yazma; `.1` hassasiyet belirteci yuvarlamayı senin için yapar.
  - pattern: "======"
    message: Başlıktaki `=` işaretlerini elle yazma; `{:=^25}` gibi bir dolgu belirteci kullan.
require:
  - pattern: "format!"
    message: Başlığı `format!` ile bir değişkene koymalısın.
  - pattern: "eprintln!"
    message: Uyarı mesajını `eprintln!` ile stderr'e yazmalısın.
  - pattern: "\\.1\\}"
    message: "Sıcaklıklarda tek basamak için hassasiyet belirteci (`.1`) kullanmalısın."
hints:
  - |
    Başlık: `let baslik = format!("{:=^25}", " HAVA DURUMU ");` - sonra `println!("{baslik}");`.
  - |
    Bir satırın kalıbı: önce 10 karakter sola yaslı şehir, sonra ` | `, sonra 6 karakter sağa yaslı
    ve 1 basamaklı sıcaklık. Yani `{sehir1:<10}` ve `{derece1:>6.1}`.
  - |
    `println!("{sehir1:<10} | {derece1:>6.1} °C");` - diğer iki şehri aynı kalıpla yaz. Uyarı için
    `eprintln!("Uyarı: {sehir3}'da sıcaklık sıfırın altında!");`
explanation: |
  `.1` hassasiyeti her sıcaklığı tek basamağa yuvarladı: `21.456` → `21.5`, `31.04` → `31.0`
  (sıfır korunur), `-3.68` → `-3.7`. `>6` ise eksi işareti dahil sonucu 6 karakterlik alanda sağa
  yasladı; bu sayede ondalık noktalar alt alta geldi.

  Uyarıyı `eprintln!` ile yazdığımız için stdout yalnızca rapordan oluşuyor; `cargo run > rapor.txt`
  dersen dosya tertemiz olur, uyarı ise ekranda görünür. Uyarıda da şehir adını tekrar yazmak
  yerine `{sehir3}` kullandık: Veri değişirse mesaj da kendiliğinden doğru kalır.

  `format!` ile hazırladığımız `baslik`, raporun altına da aynı başlığı koymak ya da onu bir dosyaya
  yazmak istesek yeniden kullanılabilirdi. Biçimlendirme ile yazdırmayı ayırmak, kodu esnek kılar.
````

## Özet

:::remember
- Biçim belirteci yapısı: **`{değer:dolgu hizalama genişlik .hassasiyet}`** → `{fiyat:*>10.2}`.
- **Genişlik** (`{:8}`) bir alt sınırdır, kesmez. Metinler varsayılan olarak **sola**, sayılar
  **sağa** yaslanır.
- **`<` sola, `>` sağa, `^` ortaya**; önüne bir karakter yazarsan dolgu o olur (`{:-^20}`).
  **`{:05}`** sayının başını sıfırla doldurur.
- **`{:.2}`** ondalıklarda basamak sayısını belirler (yuvarlar, gerekirse sıfır ekler); metinlerde
  ise en fazla karakter sayısıdır (keser).
- **`print!`** satır sonu eklemez; **`println!`** ekler; **`println!()`** boş satır yazar.
- **`eprintln!`** stderr'e yazar: hatalar ve uyarılar için. **`format!`** yazdırmaz, bir `String`
  döndürür.
:::

```reflect
prompt: |
  Bir program hem sonuçlarını hem de hata mesajlarını `println!` ile yazıyor. Arkadaşın "Ne fark
  eder, hepsi ekranda görünüyor zaten" diyor. Bu yaklaşımın hangi durumda sorun çıkaracağını ve
  `eprintln!`'in bunu nasıl çözdüğünü açıkla.
answer: |
  Model cevap: Terminalde stdout ve stderr aynı ekranda göründüğü için fark ilk bakışta anlaşılmaz.
  Ama programın çıktısı bir dosyaya yönlendirildiğinde (`cargo run > sonuc.txt`) ya da başka bir
  programa aktarıldığında, `println!` ile yazılan hata mesajları da asıl verinin arasına karışır:
  Dosya bozulur, kullanıcı da hatayı ekranda göremez. `eprintln!` hataları ayrı bir kanala (stderr)
  yazar; stdout yalnızca asıl çıktıyı taşır, hata mesajları ise yönlendirmeden etkilenmeden ekranda
  kalır.
```

```flashcards
- front: "`{:6}` ile yazdırılan bir metin ve bir sayı varsayılan olarak hangi yöne yaslanır?"
  back: Metin sola, sayı sağa.
- front: "`{:<8}`, `{:>8}` ve `{:^8}` ne yapar?"
  back: Değeri 8 karakterlik alanda sırasıyla sola, sağa yaslar ve ortalar.
- front: "`println!(\"{:*^7}\", \"ab\");` ne yazdırır?"
  back: "`**ab***`, dolgu tam bölünmezse fazla karakter sağa gelir."
- front: "`{:05}` biçimiyle `42` nasıl yazılır?"
  back: "`00042`"
- front: "`{:.2}` bir ondalık sayıya ve bir metne uygulanınca ne yapar?"
  back: "Ondalık sayıda virgülden sonra 2 basamak gösterir (yuvarlar); metinde ilk 2 karakteri alır (keser)."
- front: "`{:3}` ile `\"uzun metin\"` yazdırılırsa metin kesilir mi?"
  back: Hayır. Genişlik bir alt sınırdır; daha uzun değerler olduğu gibi yazılır.
- front: "`println!` ile `eprintln!` arasındaki fark nedir?"
  back: "`println!` standart çıktıya (stdout), `eprintln!` standart hata akışına (stderr) yazar. Hatalar ve uyarılar stderr'e gider."
- front: "`format!` ne döndürür?"
  back: Biçimlendirilmiş metni bir `String` olarak döndürür; ekrana hiçbir şey yazmaz.
```
