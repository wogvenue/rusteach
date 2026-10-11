---
id: m00-l01
title: Taşıma (Move)
minutes: 14
type: lesson
objectives:
  - Bir atamanın ya da fonksiyon çağrısının değeri ne zaman **taşıdığını** söyleyebilmek
  - Taşıma sonrası belleğin nasıl göründüğünü stack/heap diyagramıyla açıklayabilmek
  - "`E0382: borrow of moved value` hatasını okuyup düzeltebilmek"
keywords: [move, taşıma, sahiplik, E0382, String]
---

Önceki derste her değerin **tek bir sahibi** olduğunu öğrendin. Peki sahibi olan bir değeri başka bir
değişkene atadığında ne olur? Bu derste Rust'ın en şaşırtıcı ama en akıllıca kararlarından birini
keşfedeceksin: **taşıma (move)**.

:::ferris
Bu ders Rust yolculuğunun dönüm noktalarından biri. Burayı anlarsan borrow checker artık düşmanın değil,
yol arkadaşın olur! 🦀
:::

## Önce tahmin et

Aşağıdaki iki program neredeyse aynı. Biri `i32`, diğeri `String` kullanıyor. Açıklamayı okumadan önce
tahmin etmeye çalış, yanılsan bile tahmin etmek öğrenmeni güçlendirir.

```compiles
code: |
  fn main() {
      let a = 5;
      let b = a;
      println!("a = {a}, b = {b}");
  }
answer: true
explanation: |
  `i32` gibi küçük, boyutu derleme zamanında bilinen tipler stack'te yaşar ve atamada
  **kopyalanır**. `a` ve `b` birbirinden bağımsız iki `5` değeridir.
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
  `String` heap'te veri tutar. `let s2 = s1;` satırı veriyi kopyalamaz; **sahipliği `s2`'ye taşır**.
  Taşımadan sonra `s1` artık geçersizdir ve onu kullanmaya çalışmak `E0382` hatası verir.
```

## Taşıma sırasında bellekte ne olur?

Bir `String` aslında üç parçadan oluşur: heap'teki veriye bir **işaretçi (pointer)**, **uzunluk (len)**
ve **kapasite (capacity)**. Bu üç parça stack'te durur; karakterlerin kendisi heap'tedir.

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
  - caption: "`let s2 = s1;` sadece stack'teki 3 parçayı kopyalar. Heap verisi kopyalanmaz!"
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", to: h1 }
          - { name: s2, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
  - caption: "Rust `s1`'i **geçersiz** sayar. Artık heap verisinin tek sahibi `s2`'dir."
    stack:
      - frame: main
        vars:
          - { name: s1, type: String, value: "ptr · len=7 · cap=7", moved: true, note: taşındı }
          - { name: s2, type: String, value: "ptr · len=7 · cap=7", to: h1 }
    heap:
      - { id: h1, value: "m e r h a b a" }
```

Neden `s1` geçersiz sayılıyor? Çünkü ikisi de geçerli olsaydı, kapsam sonunda **ikisi de** aynı heap
belleğini serbest bırakmaya çalışırdı. Buna **çift serbest bırakma (double free)** denir ve C/C++
programlarında ciddi güvenlik açıklarına yol açar.

:::analogy Ev tapusu
Bir evin tapusunu birine devrettiğinde, evin kendisini kopyalamazsın, sadece **sahiplik belgesi** el
değiştirir. Devirden sonra eski tapun geçersizdir; evi satmaya kalkarsan noter seni durdurur.
Rust'ta noterin adı **borrow checker**'dır.
:::

```quiz
question: "`let s2 = s1;` (`s1` bir `String`) satırı çalıştığında heap'teki karakterlere ne olur?"
options:
  - Karakterler heap'te ikinci kez kopyalanır
  - Hiçbir şey; sadece stack'teki işaretçi, uzunluk ve kapasite kopyalanır ve sahiplik `s2`'ye geçer
  - Karakterler silinir, `s2` boş bir `String` olur
answer: 1
explanation: |
  Taşıma **ucuzdur**: yalnızca stack'teki üç küçük değer kopyalanır. Heap verisi yerinde kalır,
  sadece sahibi değişir.
feedback:
  - Bu bir **derin kopya** olurdu; Rust bunu yalnızca sen `.clone()` dediğinde yapar.
  - Doğru!
  - Veri kaybolmaz; sadece sahibi değişir.
```

## E0382 hatasını okumak

Hatalı programı derlediğinde Rust sana tam olarak neyin yanlış gittiğini anlatır:

:::error
```text
error[E0382]: borrow of moved value: `s1`
 --> src/main.rs:4:23
  |
2 |     let s1 = String::from("merhaba");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here
4 |     println!("s1 = {s1}, s2 = {s2}");
  |                    ^^^^ value borrowed here after move
```
Okuma sırası: **1)** hata kodu ve özet, **2)** konum (`4:23` → 4. satır 23. sütun),
**3)** etiketli satırlar, hikâyeyi anlatır: *burada taşındı*, *burada kullanıldı*.
:::

`rustc --explain E0382` komutu bu hatanın uzun açıklamasını gösterir. Çözüm yolların:

1. Taşımadan sonra eski değişkeni **kullanma** (çoğu zaman en doğrusu budur).
2. Gerçekten iki bağımsız kopya istiyorsan **`.clone()`** çağır (bir sonraki dersin konusu).
3. Değeri taşımak yerine **ödünç ver** (Modül 5'te göreceğiz).

```rust
fn main() {
    let s1 = String::from("merhaba");
    let s2 = s1; // sahiplik s2'ye geçti
    println!("s2 = {s2}"); // s1'i artık kullanmıyoruz
}
```

## Fonksiyonlara geçirmek de taşır

Bir `String`'i fonksiyona argüman olarak verdiğinde de sahiplik fonksiyonun parametresine **taşınır**.
Fonksiyon bitince parametre kapsamdan çıkar ve değer `drop` edilir.

```rust
fn selamla(isim: String) {
    println!("Merhaba, {isim}!");
} // isim burada drop edilir, heap belleği serbest kalır

fn main() {
    let ad = String::from("Ayşe");
    selamla(ad);
    // println!("{ad}"); // ← bu satırı açarsan E0382 alırsın
    let sayi = 42;
    println!("sayi hâlâ geçerli: {sayi}"); // i32 kopyalanır, taşınmaz
}
```

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
  - Derlenmez
answer: 1
explanation: |
  Program derlenir çünkü `kelime` taşındıktan sonra bir daha kullanılmıyor. Peki neden 4?
  `len()` **bayt** sayısını verir; `ç` harfi UTF-8'de 2 bayttır: `ç`(2) + `a`(1) + `y`(1) = 4.
  (Bu ayrıntıya Modül 9'da String'leri incelerken döneceğiz.)
```

```fill
prompt: Fonksiyon sahipliği **geri vererek** çağıranın `metin`'i kullanmaya devam etmesini sağlasın.
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
  `buyut` bir `String` alıp yeni bir `String` döndürüyor. Dönen değeri aynı isimle gölgeleyerek
  (shadowing) `metin`'i kullanmaya devam ediyoruz.
```

## Alıştırma zamanı

```exercise
title: Sahipliği geri ver
difficulty: 2
prompt: |
  `uzunluk_ve_kendisi` fonksiyonu bir `String` alıyor. Fonksiyonu, string'in **sahipliğini geri verecek**
  ve uzunluğunu da döndürecek şekilde tamamla: dönüş tipi `(String, usize)`.
starter: |
  fn uzunluk_ve_kendisi(s: String) -> (String, usize) {
      todo!()
  }

  fn main() {
      let s = String::from("sahiplik");
      let (s, n) = uzunluk_ve_kendisi(s);
      println!("{s}: {n} bayt");
  }
solution: |
  fn uzunluk_ve_kendisi(s: String) -> (String, usize) {
      let n = s.len();
      (s, n)
  }

  fn main() {
      let s = String::from("sahiplik");
      let (s, n) = uzunluk_ve_kendisi(s);
      println!("{s}: {n} bayt");
  }
check: tests
tests: |
  #[test]
  fn uzunlugu_dogru_hesaplar() {
      let (_, n) = uzunluk_ve_kendisi(String::from("merhaba"));
      assert_eq!(n, 7, "\"merhaba\" 7 bayttır");
  }

  #[test]
  fn stringi_geri_verir() {
      let (s, _) = uzunluk_ve_kendisi(String::from("rust"));
      assert_eq!(s, "rust", "aynı String geri dönmeli");
  }

  #[test]
  fn bos_string() {
      let (s, n) = uzunluk_ve_kendisi(String::new());
      assert_eq!((s.as_str(), n), ("", 0));
  }
hints:
  - "Bir fonksiyon birden fazla değeri bir **tuple** ile döndürebilir: `(a, b)`."
  - "`s`'yi döndürmeden **önce** uzunluğu hesapla: `let n = s.len();`"
  - "Son ifade noktalı virgülsüz `(s, n)` olmalı."
forbid:
  - pattern: "\\.clone\\(\\)"
    message: Bu alıştırmayı `clone` kullanmadan çöz, amaç sahipliği geri vermek!
explanation: |
  `s.len()` sadece okuma yapar, sahipliği almaz; bu yüzden önce uzunluğu hesaplayıp sonra `s`'yi
  taşıyarak döndürebiliyoruz.

  Dikkat: doğrudan `(s, s.len())` yazsaydın kod **derlenmezdi**. Tuple elemanları soldan sağa
  değerlendirilir: `s` önce tuple'a taşınır, ardından `s.len()` taşınmış bir değeri kullanmaya çalışır
  (E0382). Bu yöntem çalışır ama zahmetli - Modül 5'teki **referanslar** bu sorunu zarifçe çözer.
```

## Özet ve tekrar

:::remember
- Heap verisi tutan tipler (`String`, `Vec<T>`) atamada ve fonksiyon çağrısında **taşınır**.
- Taşıma ucuzdur: yalnızca stack'teki küçük "başlık" kopyalanır.
- Taşınan değişken geçersizdir → kullanırsan **E0382**.
- Basit tipler (`i32`, `bool`, `char`...) **kopyalanır**, taşınmaz.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, `let s2 = s1;` sonrasında Rust neden `s1`'i geçersiz sayıyor?
answer: |
  İkisi de geçerli kalsaydı, kapsam bittiğinde her ikisi de aynı heap belleğini serbest bırakmaya
  çalışırdı (double free). Rust, her değerin **tek sahibi** olması kuralıyla bunu derleme zamanında
  engeller: sahiplik `s2`'ye geçer, `s1` kullanılamaz.
```

```flashcards
- front: "`let s2 = s1;` (`s1: String`) satırından sonra `s1` kullanılabilir mi?"
  back: Hayır. Sahiplik `s2`'ye **taşındı**; `s1`'i kullanmak `E0382` hatası verir.
- front: Taşıma (move) sırasında heap'teki veri kopyalanır mı?
  back: Hayır. Sadece stack'teki işaretçi, uzunluk ve kapasite kopyalanır; sahiplik el değiştirir.
- front: Rust neden taşınan değişkeni geçersiz sayar?
  back: Aynı belleğin iki kez serbest bırakılmasını (**double free**) önlemek için.
- front: "`E0382` hata kodu ne anlama gelir?"
  back: "**borrow of moved value**, taşınmış bir değer kullanılmaya çalışılıyor."
- front: Bir `String`'i fonksiyona argüman olarak vermek ne yapar?
  back: Sahipliği fonksiyonun parametresine taşır; fonksiyon bitince değer `drop` edilir (geri döndürülmezse).
- front: "`let b = a;` satırında `a: i32` ise ne olur?"
  back: "`i32` `Copy` bir tiptir; değer kopyalanır, `a` ve `b` ikisi de geçerlidir."
```
