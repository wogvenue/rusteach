---
id: m01-l03
title: "İlk programın: Merhaba, Dünya!"
minutes: 17
type: lesson
objectives:
  - Bir Rust programının main fonksiyonu, süslü parantezler ve deyimlerden oluşan yapısını açıklayabilmek
  - println! makrosunu ve kaçış dizilerini kullanarak istenen çıktıyı üretebilmek
  - rustc ile bir programı derleyip oluşan .exe dosyasını çalıştırabilmek
  - Noktalı virgül, tırnak ve parantez hatalarını derleyici mesajlarından tanıyıp düzeltebilmek
keywords: [main, fn, println!, makro, string, kaçış dizisi, noktalı virgül, rustc, exe]
---

1978'den beri neredeyse her programlama kitabı aynı şekilde başlar: ekrana "Merhaba, Dünya!"
(*Hello, World!*) yazdırarak. Bu gelenek, Brian Kernighan ve Dennis Ritchie'nin ünlü C kitabından
kalma. Sen de bu geleneği sürdüreceksin, ama bu kez yazdığın her karakterin **ne işe yaradığını**
bilerek.

## Satır satır: fn main() { ... }

İşte dünyanın en ünlü programının Rust hâli. Önce çalıştır:

```rust
fn main() {
    println!("Merhaba, Dünya!");
}
```

Üç satırlık bu programda yedi farklı parça var:

| Parça | Anlamı |
|---|---|
| `fn` | "Bir **fonksiyon** tanımlıyorum." Fonksiyon, bir adı olan kod bloğudur (*function*). |
| `main` | Fonksiyonun adı. `main` özeldir: Program **buradan başlar**. |
| `()` | Fonksiyonun aldığı girdiler (parametreler). `main` hiç girdi almaz, bu yüzden boştur. |
| `{` ... `}` | Fonksiyonun **gövdesi**: Süslü parantezlerin arasındaki her şey `main`'e aittir. |
| `println!` | Ekrana bir satır yazdıran **makro** (birazdan neden `!` olduğunu göreceğiz). |
| `"Merhaba, Dünya!"` | Ekrana yazılacak metin: bir **string** (metin) değeri. |
| `;` | Deyimin (talimatın) bittiğini gösterir. |

Bir Rust programı çalıştırıldığında işletim sistemi `main` fonksiyonunu çağırır; gövdesindeki
talimatlar yukarıdan aşağıya çalışır ve `}` satırına gelindiğinde program biter. Kendi fonksiyonlarını
yazmayı Modül 3'te öğreneceksin.

:::analogy Binanın ana giriş kapısı
Bir alışveriş merkezinin onlarca kapısı ve yüzlerce dükkânı olabilir, ama ziyaretçiler hep **ana giriş
kapısından** girer. `main` programının ana giriş kapısıdır: Programın ne kadar büyük olursa olsun,
çalışma her zaman `main`'in ilk satırından başlar.
:::

Diğer dillerle karşılaştıralım:

```c
#include <stdio.h>

int main(void) {               // C: main bir sayı döndürür
    printf("Merhaba, Dünya!\n");
    return 0;
}
```

```python
print("Merhaba, Dünya!")       # Python: main gerekmez, dosya baştan sona çalışır
```

```java
public class Main {            // Java: her şey bir sınıfın içinde olmalı
    public static void main(String[] args) {
        System.out.println("Merhaba, Dünya!");
    }
}
```

Rust, C'nin `main` geleneğini sürdürür ama gereksiz törenleri atar: `#include` yok, `return 0` yok,
sınıf yok. Bir fark daha: Python'da girinti (satır başındaki boşluklar) programın anlamını belirler;
Rust'ta belirlemez. Bloğun sınırlarını süslü parantezler çizer. Yine de Rust topluluğu okunabilirlik
için **4 boşluk** girinti kullanır.

:::error
`main` olmadan bir program derlemeye çalışırsan derleyici giriş kapısını bulamaz:
```text
error[E0601]: `main` function not found in crate `playground`
 --> src/main.rs:3:2
  |
3 | }
  |  ^ consider adding a `main` function to `src/main.rs`
```
(`playground`, kodun Rust Playground'da derlendiği projenin adıdır; kendi bilgisayarında kendi
proje adını görürsün.) Derleyici dosyanın sonuna kadar okudu ve `main`'i bulamadı; bir tane eklemeni
öneriyor.
:::

```quiz
question: |
  Bir Rust programında birçok fonksiyon olabilir. Program çalıştırıldığında ilk hangi kod çalışır?
options:
  - Dosyadaki ilk fonksiyonun ilk satırı
  - "`main` fonksiyonunun gövdesindeki ilk satır"
  - Dosyanın en üstündeki satır, hangisi olursa olsun
  - En kısa fonksiyon
answer: 1
explanation: |
  Programın giriş noktası (*entry point*) her zaman `main` fonksiyonudur. `main` dosyanın en altında
  bile olsa çalışma oradan başlar; diğer fonksiyonlar ancak çağrıldıklarında çalışır.
feedback:
  - Fonksiyonların dosyadaki sırası önemli değildir.
  - Doğru!
  - Bu Python gibi dillerde geçerli; Rust'ta çalışma `main`'den başlar.
  - Fonksiyonların uzunluğunun çalışma sırasıyla ilgisi yoktur.
```

## println! bir makrodur

Önce bir tahmin: Aşağıdaki kodda tek bir karakter eksik. Sence derlenir mi?

````compiles
question: |
  `println`'in sonundaki ünlem işareti unutulmuş. Bu kod derlenir mi?
code: |
  fn main() {
      println("Merhaba, Dünya!");
  }
answer: false
error: E0423
explanation: |
  Derlenmez! Derleyici `println` adında bir **fonksiyon** arar ve bulamaz:

  ```text
  error[E0423]: cannot find function `println` in this scope
   --> src/main.rs:2:5
    |
  2 |     println("Merhaba, Dünya!");
    |     ^^^^^^^ not found in this scope
    |
    = note: a macro named `println` exists in another namespace
  help: use `!` to invoke the macro
  ```

  Notu oku: "`println` adında bir **makro** var." `help` satırı da çözümü söylüyor: Makroyu çağırmak
  için `!` kullan.
````

Rust'ta adının sonunda `!` olan her şey bir **makrodur** (*macro*). Fonksiyon, program çalışırken bir
iş yapan koddur. Makro ise **derleme sırasında kod üreten** koddur: Derleyici `println!("...")`
satırını görünce onu, ekrana yazmayı sağlayan daha uzun bir koda dönüştürür ve öyle derler.

Peki ekrana yazmak gibi basit bir iş neden fonksiyonla değil de makroyla yapılıyor? İki büyük neden var:

1. **Değişken sayıda girdi:** `println!` bazen yalnızca bir metin, bazen bir metin ve beş değer alır.
   Rust fonksiyonları ise her zaman sabit sayıda parametre alır.
2. **Derleme zamanında denetim:** Makro, biçim metnini **derleme sırasında** inceler. C'deki
   `printf("%d elma, %d armut\n", 5);` satırı derlenir ve ikinci sayının yerine bellekteki rastgele
   bir değer yazdırabilir: tanımsız davranış! Rust'ta aynı hatayı yaparsan program **derlenmez**
   (değerleri metne yerleştirmeyi 5. derste öğreneceksin).

:::deep println! perde arkasında neye dönüşür?
Derleyici, `println!("Merhaba, Dünya!");` satırını derlemeden önce yaklaşık olarak şu koda genişletir:
```text
{
    ::std::io::_print(format_args!("Merhaba, Dünya!\n"));
};
```
Yani `println!`, metnin sonuna `\n` (yeni satır) ekleyip standart kütüphanenin yazdırma fonksiyonunu
çağırır. `format_args!` de derleyicinin kendisine gömülü, biçim metnini denetleyen bir makrodur. Bir
projedeki makroların neye genişlediğini görmek istersen ileride `cargo expand` aracını
kullanabilirsin.
:::

Kurs boyunca başka makrolarla da tanışacaksın. Şimdilik adlarını duyman yeter:

| Makro | Ne yapar? | Nerede? |
|---|---|---|
| `print!` | Alt satıra **geçmeden** yazar. | 6. ders |
| `eprintln!` | Hata akışına (stderr) yazar. | 6. ders |
| `format!` | Metni ekrana değil, bir değere yazar. | 6. ders |
| `vec!` | Bir liste (vektör) oluşturur. | Modül 9 |
| `panic!` | Programı bir hata mesajıyla durdurur. | Modül 10 |
| `todo!` | "Burası henüz yazılmadı" der; çalışırsa programı durdurur. | İleride |

```quiz
question: |
  `println!` neden bir fonksiyon değil de makrodur? (Birden fazla seçenek işaretleyebilirsin.)
options:
  - Değişken sayıda girdi alabilmesi gerektiği için
  - Biçim metnini derleme zamanında denetleyip hataları önceden yakalayabilmesi için
  - Makrolar programı her zaman daha hızlı çalıştırdığı için
  - Rust'ta fonksiyonlar ekrana yazı yazamadığı için
answer: [0, 1]
explanation: |
  Rust fonksiyonları sabit sayıda parametre alır; `println!` ise istediğin kadar değer alabilir.
  Üstelik makro, derleme sırasında çalıştığı için biçim metniyle değerlerin uyuşup uyuşmadığını
  **derleme zamanında** denetler. C'nin `printf`'inde bu hatalar ancak çalışma zamanında, çoğu zaman
  sessizce ortaya çıkar.
feedback:
  - Doğru, Rust fonksiyonları sabit sayıda parametre alır.
  - Doğru, hatalı biçimler program çalışmadan yakalanır.
  - Hayır; makro olmak tek başına hız kazandırmaz. Asıl kazanç esneklik ve güvenliktir.
  - Hayır; fonksiyonlar da yazabilir - `println!` sonunda standart kütüphanedeki bir fonksiyonu çağırır.
```

## Metinler ve kaçış dizileri

Çift tırnak içindeki metne **string** denir. Ama bir metnin içine çift tırnağın kendisini ya da bir
"alt satıra geç" komutunu nasıl koyarsın? Önce tahmin et:

```predict
question: |
  Bu program ne yazdırır? Ters eğik çizgilere (`\`) dikkat et.
code: |
  fn main() {
      println!("Çay\nSimit");
      println!("Ferris \"🦀\" dedi");
  }
options:
  - |
    Çay\nSimit
    Ferris \"🦀\" dedi
  - |
    Çay
    Simit
    Ferris "🦀" dedi
  - |
    Çay Simit
    Ferris 🦀 dedi
answer: 1
explanation: |
  Ters eğik çizgi (`\`), arkasındaki karakterin özel anlamda okunmasını sağlar. `\n` "yeni satır"
  (*newline*) demektir, bu yüzden "Çay" ve "Simit" ayrı satırlara yazılır. `\"` ise metni bitirmeyen,
  sıradan bir çift tırnaktır. Bu iki karakterlik kalıplara **kaçış dizisi** (*escape sequence*) denir.
```

En sık kullanılan kaçış dizileri:

| Yazdığın | Ekranda | Açıklama |
|---|---|---|
| `\n` | (yeni satır) | Alt satıra geç |
| `\t` | (sekme) | Sekme (*tab*) boşluğu bırak |
| `\"` | `"` | Metni bitirmeyen çift tırnak |
| `\\` | `\` | Ters eğik çizginin kendisi |
| `\u{1F980}` | 🦀 | Unicode kod noktasıyla karakter yaz |

Rust metinleri **UTF-8** biçimindedir; Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) ve emojileri doğrudan
yazabilirsin. Hepsini bir arada görelim:

```rust
fn main() {
    println!("Kahve\nÇay");
    println!("Ferris \"🦀\" dedi");
    println!("C:\\Users\\Ayşe");
    println!("Sekme:\tA\tB");
    println!("\u{1F980} ve \u{015F}");
    println!("Bu satır \
              tek satırda kalır");
}
```

Son örnekteki satır sonundaki `\`, metni bir sonraki satırda **boşlukları atlayarak** sürdürür; uzun
metinleri kodda bölmenin yoludur.

:::error
Metinleri **tek tırnakla** yazarsan:
```text
error: character literal may only contain one codepoint
 --> src/main.rs:2:14
  |
2 |     println!('Merhaba');
  |              ^^^^^^^^^
  |
help: if you meant to write a string literal, use double quotes
```
Python ve JavaScript'te tek ve çift tırnak birbirinin yerine kullanılabilir; Rust'ta kullanılamaz. Tek
tırnak yalnızca **tek bir karakter** içindir (`'a'`, `'ğ'`, Modül 2). Metinler için çift tırnak şart.
:::

:::error
Windows dosya yollarını olduğu gibi yazarsan:
```text
error: unknown character escape: `U`
 --> src/main.rs:2:18
  |
2 |     println!("C:\Users\Ayşe");
  |                  ^ unknown character escape
```
Derleyici `\U`'yu bir kaçış dizisi sanır ama böyle bir dizi yoktur (aynı hata `\A` için de verilir).
Çözüm: Her ters eğik çizgiyi iki kez yaz: `"C:\\Users\\Ayşe"`.
:::

:::deep Ham metinler (raw strings)
Çok sayıda `\` ya da `"` içeren metinler için Rust'ın **ham metin** sözdizimi vardır: `r"..."`
içinde kaçış dizileri işlenmez. Metnin içinde çift tırnak da olacaksa `r#"..."#` kullanılır.
```text
println!(r"C:\Users\Ayşe");            → C:\Users\Ayşe
println!(r#"Ham: "tırnak" ve \n"#);    → Ham: "tırnak" ve \n
```
Ham metinler özellikle dosya yolları ve düzenli ifadeler (*regex*) için çok kullanışlıdır.
:::

## Noktalı virgül ve süslü parantezler

Rust'ta her talimatın sonuna noktalı virgül konur. Peki son satırdaki noktalı virgülü unutursan ne
olur? Tahmin et:

```compiles
question: |
  Son `println!`'in sonunda noktalı virgül yok. Bu kod derlenir mi?
code: |
  fn main() {
      println!("Birinci satır");
      println!("İkinci satır")
  }
answer: true
explanation: |
  Şaşırtıcı ama **derlenir!** Rust'ta bir bloğun **son** satırı noktalı virgülsüz yazılırsa o satır,
  bloğun "sonuç değeri" sayılır. `println!` ekrana yazdıktan sonra "boş" bir değer döndürür; `main`
  de zaten boş bir değer beklediği için sorun çıkmaz. Bu ifade/deyim ayrımını Modül 3'te ayrıntılı
  göreceğiz. Yine de alışkanlık olarak her `println!`'in sonuna `;` koy: Tutarlı kod daha az sürpriz
  demektir.
```

Ama noktalı virgül **ortadaki** bir satırda eksikse durum farklıdır:

:::error
```text
error: expected `;`, found `println`
 --> src/main.rs:2:20
  |
2 |     println!("Bir")
  |                    ^ help: add `;` here
3 |     println!("İki");
  |     ------- unexpected token
```
Derleyici bir sonraki satırda yeni bir `println` görünce önceki talimatın bitmediğini anlar ve tam
olarak nereye `;` eklemen gerektiğini gösterir (`help: add ; here`).
:::

Kapanmamış süslü parantezler de sık yapılan bir hatadır:

:::error
```text
error: this file contains an unclosed delimiter
 --> src/main.rs:2:34
  |
1 | fn main() {
  |           - unclosed delimiter
2 |     println!("Merhaba, Dünya!");
  |                                 ^
```
`unclosed delimiter`, "kapanmamış ayraç" demektir. Derleyici `{`'nin nerede açıldığını işaretliyor;
dosya bittiği hâlde kapanış `}`'si gelmemiş. Her `(`, `{` ve `[`'in bir eşi olmalıdır. İyi bir
editör, imleç bir parantezin üstündeyken eşini vurgulayarak bunu kolaylaştırır.
:::

```fill
prompt: |
  Boşlukları doldur. Program alt alta `Bir` ve `İki` yazmalı.
code: |
  fn main() ___0
      println!("Bir")___1
      println!("İki");
  ___2
blanks:
  - ["{"]
  - [";"]
  - ["}"]
output: |
  Bir
  İki
explanation: |
  Fonksiyonun gövdesi `{` ile açılır ve `}` ile kapanır. Ortadaki `println!("Bir")` bloğun son satırı
  olmadığı için noktalı virgül **zorunludur**; yoksa derleyici "`;` bekleniyordu" hatası verir.
```

## rustc ile derle ve çalıştır

Rusteach'te **Çalıştır**'a bastığında derleme ve çalıştırma senin için arka planda yapılır. Şimdi aynı
işi kendi bilgisayarında, elle yapalım. (Rust'ı henüz kurmadıysan adımları okuyup geç; sonraki
derslerde de karşına çıkacaklar.)

Önce bir klasör oluştur ve içinde `main.rs` adlı bir dosya aç. Rust kaynak dosyalarının uzantısı
`.rs`'dir.

```powershell
mkdir C:\RustProjeleri\merhaba   # projelerin için bir klasör oluştur
cd C:\RustProjeleri\merhaba      # klasöre geç
code main.rs                     # main.rs dosyasını VS Code'da aç
```

Dosyaya bu dersin ilk programını yazıp kaydet. Ardından terminalde derleyip çalıştır:

```console
PS C:\RustProjeleri\merhaba> rustc main.rs
PS C:\RustProjeleri\merhaba> ls -Name
main.exe
main.pdb
main.rs
PS C:\RustProjeleri\merhaba> .\main.exe
Merhaba, Dünya!
```

Neler oldu?

- **`rustc main.rs`** kaynak kodu derledi. Hata yoksa hiçbir şey yazmaz, Rust araçlarında sessizlik
  iyi haberdir.
- **`main.exe`**, makine kodunu içeren **çalıştırılabilir dosyadır**. Çift tıklayarak da
  çalıştırabilirsin (ama pencere hemen kapanır, çünkü program yazıp bitiyor).
- **`main.pdb`**, hata ayıklama (*debugging*) araçlarının kullandığı bilgileri içerir; programın
  çalışması için gerekmez.
- **`.\main.exe`** programı çalıştırdı. PowerShell, güvenlik nedeniyle bulunduğun klasördeki
  programları ancak başına `.\` yazarsan çalıştırır. (Linux ve macOS'ta dosyanın adı `main` olur ve
  `./main` ile çalıştırılır.)

Bu, Python'dan önemli bir farktır: Rust'ta **derlemek** ve **çalıştırmak** iki ayrı adımdır. `main.exe`
dosyasını Rust kurulu olmayan bir arkadaşına gönderebilirsin; programı çalıştırmak için ne kaynak
koda ne de derleyiciye ihtiyacı olur. (Yalnızca çoğu Windows bilgisayarında zaten bulunan Microsoft
Visual C++ çalışma zamanı dosyaları gerekebilir.)

Tek dosyalık denemeler için `rustc` yeterlidir. Gerçek projelerde ise bir sonraki derste
tanışacağın `cargo`'yu kullanacaksın.

```quiz
question: |
  `main.rs` dosyasında metni "Merhaba, Dünya!" yerine "Merhaba, Rust!" yaptın ve kaydettin. Sonra
  **yeniden derlemeden** `.\main.exe` komutunu çalıştırdın. Ne görürsün?
options:
  - Merhaba, Rust!
  - Merhaba, Dünya!
  - Bir derleme hatası
  - Hiçbir şey; dosya değiştiği için program açılmaz
answer: 1
explanation: |
  `main.exe`, kaynak kodun **derlendiği andaki** hâlinin makine koduna çevrilmiş kopyasıdır. Kaynak
  kodu değiştirmek bu kopyayı değiştirmez. Değişikliğin yansıması için önce `rustc main.rs` ile
  yeniden derlemelisin. (Cargo bunu senin yerine hatırlar: 4. ders.)
feedback:
  - Ancak yeniden derlersen! Eski `.exe` hâlâ eski kodun çevirisi.
  - Doğru, çalıştırılabilir dosya eski kodun çevirisidir.
  - Derleme yapmadın ki hata çıksın; yalnızca eski programı çalıştırdın.
  - Eski `.exe` hâlâ geçerli bir programdır ve sorunsuz çalışır.
```

## Küçük değişiklikler, büyük adımlar

Öğrendiklerini birleştiren bir örnekle başlayalım. Okul kantininin dijital panosuna duyuru yazan bir
program:

```rust
fn main() {
    println!("=== Kantin Duyurusu ===");
    println!("Bugün:\tMercimek çorbası");
    println!("Fiyat:\t40 TL");
    println!("\"Afiyet olsun!\"");
}
```

Her satır bir `println!`; `\t` sütunları hizalamak için bir sekme bırakır, `\"` ise tırnakları metnin
parçası yapar. Şimdi sıra sende.

```parsons
prompt: |
  Satırları sıraya koyarak çay demleme talimatlarını yazdıran programı kur. Dikkat: Bazı satırlar
  **hatalı**; onları dışarıda bırak.
lines: |
  fn main() {
      println!("1. Suyu kaynat.");
      println!("2. Demliğe çay koy.");
      println!("3. Kaynar suyu dök ve demlenmeye bırak.");
      println!("Çay hazır!");
  }
distractors: |
  fn main {
      println!('2. Demliğe çay koy.');
      println("1. Suyu kaynat.");
explanation: |
  Program `fn main() {` ile başlar ve `}` ile biter; talimatlar yukarıdan aşağıya çalıştığı için
  adımlar sırayla yazılır. Hatalı satırlar: Tek tırnaklı metin (Rust'ta metinler çift tırnak ister),
  ünlem işareti unutulmuş `println` (makro `!` ile çağrılır) ve parantezleri unutulmuş `fn main`.
```

İlk alıştırman: bir kantin menüsü. **Kodu kopyalayıp yapıştırmak yerine kendin yaz**; parmaklarının
alışması da öğrenmenin bir parçası.

````exercise
id: m01-e-kantin-menusu
title: Kantin menüsü
difficulty: 1
prompt: |
  Program şu an yalnızca başlığı yazdırıyor. Altına üç `println!` daha ekleyerek tam olarak şu
  çıktıyı üret:

  ```text
  --- Kantin Menüsü ---
  Simit: 15 TL
  Çay: 10 TL
  Tost: 60 TL
  ```
starter: |
  fn main() {
      println!("--- Kantin Menüsü ---");
      // Ürünleri buraya ekle
  }
solution: |
  fn main() {
      println!("--- Kantin Menüsü ---");
      println!("Simit: 15 TL");
      println!("Çay: 10 TL");
      println!("Tost: 60 TL");
  }
check: output
expected_output: |
  --- Kantin Menüsü ---
  Simit: 15 TL
  Çay: 10 TL
  Tost: 60 TL
hints:
  - |
    Her ürün ayrı bir satırda; yani her ürün için ayrı bir `println!` gerekiyor.
  - |
    Başlık satırını örnek al: `println!("...");` kalıbını kopyala, tırnakların içini değiştir. Her
    satırın sonunda `;` olmalı.
  - |
    İlk ürün satırı şöyle: `println!("Simit: 15 TL");` - diğer ikisini aynı kalıpla yaz. Büyük harf
    "Ç"yi ve iki nokta üst üsteden sonraki boşluğu unutma.
explanation: |
  Her `println!` bir satır yazar ve talimatlar sırayla çalışır; bu yüzden çıktıdaki satır sırası,
  koddaki `println!` sırasıyla aynıdır. `// Ürünleri buraya ekle` satırı bir yorumdur ve çıktıyı
  etkilemez; istersen silebilirsin.
````

Şimdi biraz daha zor bir görev: Bu kez **tek bir** `println!` kullanacaksın.

````exercise
id: m01-e-kartvizit
title: Tek println! ile kartvizit
difficulty: 2
prompt: |
  Ferris için bir kartvizit yazdır. Çıktı tam olarak şu üç satır olmalı:

  ```text
  Ad: Ferris
  Meslek: "Rust maskotu"
  Adres: C:\Okyanus\Kaya
  ```

  Kural: Programda yalnızca **bir tane** `println!` olabilir (`print!` da kullanma). Satırları,
  tırnakları ve ters eğik çizgileri kaçış dizileriyle üret.
starter: |
  fn main() {
      println!("Ad: Ferris");
  }
solution: |
  fn main() {
      println!("Ad: Ferris\nMeslek: \"Rust maskotu\"\nAdres: C:\\Okyanus\\Kaya");
  }
check: output
expected_output: |
  Ad: Ferris
  Meslek: "Rust maskotu"
  Adres: C:\Okyanus\Kaya
forbid:
  - pattern: "println![\\s\\S]*println!"
    message: Yalnızca bir tane `println!` kullanmalısın. Satırları `\n` ile ayır.
  - pattern: "print!\\("
    message: Bu alıştırmada `print!` kullanma; tek bir `println!` yeterli.
hints:
  - |
    Tek bir `println!` ile birden fazla satır yazmak için satırların arasına `\n` koy.
  - |
    Metnin içindeki çift tırnaklar `\"` ile, ters eğik çizgiler `\\` ile yazılır. Tek bir `\`
    yazarsan derleyici onu bir kaçış dizisinin başlangıcı sanır.
  - |
    İkinci satırın parçası şöyle görünmeli: `\nMeslek: \"Rust maskotu\"` - üçüncü satırda da
    `C:\\Okyanus\\Kaya` yaz.
explanation: |
  Tek satırlık çözüm:

  ```rust,norun
  println!("Ad: Ferris\nMeslek: \"Rust maskotu\"\nAdres: C:\\Okyanus\\Kaya");
  ```

  `\n` yeni satırlar, `\"` metni bitirmeyen tırnaklar, `\\` ise tek bir ters eğik çizgi üretir.
  Alternatif olarak ham metin de kullanılabilirdi: `r#"..."#` içinde tırnaklar ve ters eğik
  çizgiler olduğu gibi yazılır (satırları ise gerçekten alt satıra geçerek yazman gerekir).
  Okunabilirlik açısından gerçek programlarda genellikle her satır için ayrı bir `println!` tercih
  edilir; bu alıştırma kaçış dizilerini pekiştirmek içindi.
````

## Özet

:::remember
- Her Rust programı **`fn main() { ... }`** ile başlar; çalışma `main`'in ilk satırından başlar ve
  talimatlar yukarıdan aşağıya yürür.
- **`println!`** bir **makrodur** (`!`): Değişken sayıda girdi alır ve biçim metnini **derleme
  zamanında** denetler.
- Metinler **çift tırnakla** yazılır; tek tırnak yalnızca tek karakter içindir.
- Kaçış dizileri: `\n` yeni satır, `\t` sekme, `\"` tırnak, `\\` ters eğik çizgi.
- Talimatların sonuna **`;`** konur; her `{`'nin bir `}` eşi olmalıdır.
- **`rustc main.rs`** derler, **`.\main.exe`** çalıştırır. Kodu değiştirince **yeniden derle**.
:::

```reflect
prompt: |
  Python bilen bir arkadaşın "Bizde `print("Merhaba")` yazmak yetiyor, Rust'ta neden bu kadar çok
  şey var?" diyor. `fn main() { println!("Merhaba"); }` satırındaki her parçanın görevini kendi
  cümlelerinle ona açıkla.
answer: |
  Model cevap: `fn main()` programın giriş kapısı olan `main` fonksiyonunu tanımlar; işletim sistemi
  programı çalıştırınca ilk onu çağırır. Süslü parantezler bu fonksiyonun gövdesinin sınırlarını
  çizer. `println!` bir makrodur: Derleme sırasında ekrana yazdıran koda dönüşür ve biçim metnini
  önceden denetler. Tırnaklar arasındaki metin yazdırılacak string'dir, `;` ise talimatın bittiğini
  söyler. Python bu yapıların bazılarını gizler; Rust ise açık olmayı tercih eder - ve karşılığında
  hataları program çalışmadan yakalar.
```

```flashcards
- front: Bir Rust programı çalışmaya nereden başlar?
  back: "`main` fonksiyonunun ilk satırından."
- front: "`println!`'deki `!` neyi gösterir?"
  back: Bunun bir fonksiyon değil, bir **makro** çağrısı olduğunu. Makrolar derleme sırasında kod üretir.
- front: "`println!` neden bir makrodur?"
  back: Değişken sayıda girdi alabilmek ve biçim metnini derleme zamanında denetleyebilmek için.
- front: '`\n` ve `\t` ne işe yarar?'
  back: '`\n` yeni satıra geçer, `\t` bir sekme (tab) boşluğu bırakır.'
- front: Bir metnin içine çift tırnak ve ters eğik çizgi nasıl yazılır?
  back: '`\"` ve `\\` ile.'
- front: Rust'ta metinler neden tek tırnakla yazılamaz?
  back: Tek tırnak yalnızca tek bir karakter (`'a'`) içindir. Metinler (string) çift tırnak ister.
- front: Windows'ta `rustc main.rs` hangi dosyaları üretir?
  back: "`main.exe` (çalıştırılabilir program) ve `main.pdb` (hata ayıklama bilgileri)."
- front: Kaynak kodu değiştirdin ama `.exe` eski metni yazıyor. Neden?
  back: Yeniden derlemedin. Çalıştırılabilir dosya, kodun derlendiği andaki hâlinin çevirisidir.
```
