---
id: m13-l05
title: Test Güdümlü Geliştirme (TDD)
minutes: 28
type: lesson
objectives:
  - Kırmızı-yeşil-yeniden düzenle döngüsünü adımlarıyla açıklayıp küçük bir fonksiyonu test önce yazarak geliştirebilmek
  - "`(girdi, beklenen)` dizisi üzerinde dönen tablo güdümlü testler yazabilmek ve hangi vakanın kaldığını mesajla gösterebilmek"
  - "Bir fonksiyon için sınır ve uç durumları (boş, sıfır, sınır değer, taşma, Türkçe karakter) sistematik olarak listeleyebilmek"
  - İyi bir testin özelliklerini (davranışı anlatan ad, tek davranış, bağımsız, deterministik) bir test üzerinde değerlendirebilmek
keywords: [TDD, kırmızı-yeşil-yeniden düzenle, red-green-refactor, tablo güdümlü test, uç durum, test adı, Roma rakamı]
---

Bu modül boyunca önce kodu yazdın, sonra testini. Şimdi sırayı **tersine çevireceğiz**: önce test, sonra kod.
Kulağa garip geliyor, var olmayan bir şeyi nasıl test edersin? Ama bu yaklaşım, yani **test güdümlü
geliştirme (Test-Driven Development, TDD)**, dünyanın dört bir yanındaki ekiplerin kullandığı bir tasarım
disiplinidir. Bu derste bir Roma rakamı çeviricisini adım adım, **testlerin güdümünde** inşa edeceksin.

:::ferris
TDD'de ilk adımın her zaman kırmızı, yani başarısız bir testtir. Burada kırmızı kötü haber değil, bir
**pusula**: sana bir sonraki adımda tam olarak neyi yazacağını söyler. 🦀
:::

## Kırmızı → Yeşil → Yeniden düzenle

TDD, Kent Beck'in 2002'de *Test-Driven Development: By Example* kitabıyla yaygınlaştırdığı üç adımlık
bir döngüdür. Her tur birkaç dakika sürer:

| adım | ne yaparsın? | ne zaman biter? |
|---|---|---|
| 🔴 **Kırmızı (red)** | Henüz desteklenmeyen **tek bir** davranış için küçük bir test yaz | Test **doğru sebepten** kalınca (derleme hatası da sayılır) |
| 🟢 **Yeşil (green)** | Testi geçirecek **en basit** kodu yaz, şıklık yok, genelleme yok | Bütün testler geçince |
| 🔵 **Yeniden düzenle (refactor)** | Tekrarı kaldır, adları düzelt, yapıyı iyileştir, davranışı değiştirmeden | Kod temiz ve testler hâlâ yeşil olunca |

Neden bu kadar zahmet? Çünkü test önce yazılınca:

1. **API'yi kullanıcı gözüyle tasarlarsın.** Fonksiyonu yazmadan önce onu *çağırmak* zorundasın: adı ne olmalı,
   ne almalı, ne döndürmeli? Çağırması rahatsız edici bir fonksiyonu daha yazmadan fark edersin.
2. **Sadece gerekeni yazarsın.** Her satır kod, kalan bir testi geçirmek için vardır. "Belki lazım olur" diye
   yazılan karmaşıklık (*YAGNI: You Aren't Gonna Need It*) doğmaz.
3. **Testin gerçekten çalıştığını görürsün.** Sonradan yazılan bir test, hiç kalmadığı için belki de hiçbir şeyi
   kontrol etmiyordur. TDD'de her testi önce **kırmızı** görürsün; yani testin hatayı yakalayabildiği kanıtlanmıştır.
4. **Yeniden düzenlemeden korkmazsın.** Her davranış bir testle korunduğu için kodu cesurca değiştirebilirsin.

:::analogy İki ölç, bir biç
Terzi kumaşı kesmeden önce ölçü alır ve ölçüyü bir kâğıda yazar; prova sırasında elbiseyi o ölçülere göre
kontrol eder. Test, kodun **ölçüsüdür**: kodu yazmadan önce "bu fonksiyon 4 için `IV` döndürmeli" diye
yazarsın. Ölçüsüz kesilen kumaş ya bol gelir ya dar; testsiz yazılan kod da ya eksik kalır ya gereksiz
karmaşık olur.
:::

```quiz
question: TDD'nin "kırmızı" adımıyla ilgili hangisi **doğrudur**?
options:
  - Önce fonksiyonun bütün testleri yazılır, sonra tüm kod bir seferde yazılır
  - Tek bir küçük davranış için test yazılır ve testin kaldığı **görülür**; fonksiyon henüz yoksa derleme hatası da kırmızı sayılır
  - Kırmızı adım isteğe bağlıdır; test geçiyorsa doğrudan yeniden düzenlemeye geçilir
  - Kırmızı adımda kod yeniden düzenlenir ve testler geçici olarak kapatılır
answer: 1
explanation: |
  TDD **bir test, bir adım** ilerler. Yeni testin kaldığını görmek kritiktir: yeni yazdığın bir test daha
  ilk çalıştırmada geçiyorsa ya o davranış zaten vardır ya da test hiçbir şeyi kontrol etmiyordur.
  Fonksiyon henüz yoksa test derlenmez (`E0425`); bu da geçerli bir kırmızıdır - derleyici sana bir
  sonraki adımı söyler: "bu fonksiyonu tanımla".
feedback:
  - Bu "test önce" değil, "plan önce" olur; TDD küçük adımlarla ilerler.
  - Doğru! Tek davranış, görülen başarısızlık.
  - Hemen geçen yeni bir test şüphelidir; kırmızı adım atlanmaz.
  - Yeniden düzenleme döngünün üçüncü adımıdır ve testler her zaman açık kalır.
```

## Kırmızı: önce test

Hedef: `roma(n: u32) -> String`, 1 ile 3999 arasındaki bir sayıyı Roma rakamına çeviren fonksiyon.
Kuralları biliyoruz: `I=1, V=5, X=10, L=50, C=100, D=500, M=1000`; küçük bir sembol büyüğün **önünde**
ise çıkarılır (`IV = 4`, `IX = 9`, `XL = 40`, `CM = 900`).

**Tur 1, kırmızı.** Fonksiyon yok; sadece testi yazıyoruz:

```rust,ignore
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bir_i_ile_yazilir() {
        assert_eq!(roma(1), "I");
    }
}
```

:::error
```text
error[E0425]: cannot find function `roma` in this scope
 --> src/lib.rs:7:20
  |
7 |         assert_eq!(roma(1), "I");
  |                    ^^^^ not found in this scope
```
Kırmızı! Derleyici bir sonraki adımı söylüyor: `roma` diye bir fonksiyon tanımla. Önce gövdesiz bir iskelet
(`todo!()`) yazarız; test bu sefer derlenir ama `not yet implemented` paniğiyle kalır. İkisi de
"doğru sebepten kırmızı"dır.
:::

**Tur 1, yeşil.** En basit kod nedir? Gülümseyebilirsin ama cevap gerçekten bu:

```rust
pub fn roma(_n: u32) -> String {
    String::from("I") // "sahte yap" (fake it): şimdilik sadece testi geçir
}

fn main() {
    println!("{}", roma(1));
    println!("{}", roma(7)); // açıkça yanlış - ama henüz bunu isteyen bir test yok!
}
```

Bu bir hile değil, bilinçli bir tekniktir: **sahte yap (fake it)**. Testi en kısa yoldan yeşile çevirirsin ve
bir sonraki test seni **genellemeye zorlar**. Kodu daha fazla test zorlamadıkça genel hâle getirmemek, her
satırın bir gerekçesi olmasını sağlar. Bu yöntemin adı **üçgenleme (triangulation)**: birden fazla örnek,
doğru genellemenin yerini "üçgenler".

**Tur 2.** Yeni test `assert_eq!(roma(2), "II");` → kırmızı (`left: "I"`, `right: "II"`). Yeşil için artık
gerçekten bir şeyler yapmalıyız: `n` kez `'I'` ekleyelim.

```predict
question: Tur 2'nin yeşil kodu aşağıda. Bu sürüm hangi çıktıyı verir ve bir sonraki testin ne olması gerektiğini nasıl gösterir?
code: |
  pub fn roma(n: u32) -> String {
      let mut sonuc = String::new();
      for _ in 0..n {
          sonuc.push('I');
      }
      sonuc
  }

  fn main() {
      println!("{}", roma(3));
      println!("{}", roma(4));
      println!("{}", roma(5));
  }
options:
  - |
    III
    IV
    V
  - |
    III
    IIII
    IIIII
  - |
    III
    IIII
    V
answer: 1
explanation: |
  Döngü `n` kez `'I'` ekler; başka hiçbir kural bilmiyor. `1`, `2`, `3` için doğru, ama `4` ve `5` için
  yanlış. TDD'de bir sonraki adım bellidir: kodu "zaten bildiğin" kurallarla doldurmak yerine, şu anki kodu
  **kıran en küçük testi** yazarsın - `assert_eq!(roma(4), "IV");`. Kod ancak bu test kırmızıya dönünce
  çıkarma kuralını öğrenir.
```

## Yeşil ve yeniden düzenle

Turlar böyle devam eder: `roma(4) == "IV"` için özel bir durum, `roma(5) == "V"` için bir tane daha,
`roma(9)`, `roma(10)`... Birkaç turdan sonra kodda `if n >= 10 { ... } if n >= 9 { ... } if n >= 5 { ... }`
gibi **tekrarlayan bir kalıp** belirir. İşte **yeniden düzenleme** anı: testler yeşilken tekrarı bir
**tabloya** dönüştürürüz.

```rust
pub fn roma(n: u32) -> String {
    assert!((1..=3999).contains(&n), "Roma rakamları 1-3999 arası yazılır: {n}");
    let tablo = [
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ];
    let mut kalan = n;
    let mut sonuc = String::new();
    for (deger, sembol) in tablo {
        while kalan >= deger {
            sonuc.push_str(sembol);
            kalan -= deger;
        }
    }
    sonuc
}

fn main() {
    for n in [1, 4, 9, 14, 40, 1994, 2026, 3999] {
        println!("{n:>4} → {}", roma(n));
    }
}
```

Algoritma **açgözlü (greedy)**: her adımda sığan en büyük değeri çıkarır. `1994` için: `M` (994 kaldı),
`CM` (94), `XC` (4), `IV` (0) → `MCMXCIV`. Çıkarma kuralı (`IV`, `CM`...) ayrı bir `if` olarak değil,
tablonun içinde birer satır olarak yaşıyor; yeni bir kural, yeni bir satır demek.

Burada TDD'nin iki ödülünü görüyorsun. Birincisi: if zincirinden tabloya geçerken **korkmadın**, çünkü
yazdığın her test hâlâ yeşil mi diye anında kontrol edebiliyordun. İkincisi: `assert!` ile eklediğimiz
aralık kontrolü de bir test turunun sonucu, `#[should_panic(expected = "1-3999")] fn sifir_yazilamaz()`
testi (Ders 2'deki `should_panic` kalıbı) bu satırı **talep etti**.

:::warning Yeniden düzenleme ≠ yeni özellik
Yeniden düzenleme adımında **davranış değişmez**: hiçbir test eklenmez, hiçbir test kırmızıya dönmez.
Yeni bir davranış istiyorsan önce kırmızıya dön ve testini yaz. İkisini aynı anda yaparsan, bir test
kaldığında sebebin yeniden düzenleme mi yoksa yeni kod mu olduğunu bilemezsin.
:::

## Tablo güdümlü testler

Roma örneğinde onlarca vaka var. Her biri için ayrı bir `#[test]` fonksiyonu yazmak sıkıcı ve tekrarlı olur.
Çözüm, vakaları bir **tablo** olarak yazmak: `(girdi, beklenen)` çiftlerinden oluşan bir dizi ve üzerinde
dönen tek bir döngü. Go'da *table-driven tests*, Python'un `pytest`'inde `@pytest.mark.parametrize` olarak
bilinen bu kalıp, Rust'ta Modül 2 ve 3'teki dizi ve `for` bilgisiyle yazılır:

```fill
prompt: Tablo güdümlü testi tamamla. Hata mesajı hangi girdinin kaldığını göstermeli.
code: |
  pub fn roma(n: u32) -> String {
      let tablo = [
          (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
          (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
          (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
      ];
      let mut kalan = n;
      let mut sonuc = String::new();
      for (deger, sembol) in tablo {
          while kalan >= deger {
              sonuc.push_str(sembol);
              kalan -= deger;
          }
      }
      sonuc
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn bilinen_degerler() {
          let vakalar = [(1, "I"), (4, "IV"), (9, "IX"), (58, "LVIII"), (1994, "MCMXCIV")];
          for (___0, beklenen) in ___1 {
              assert_eq!(roma(girdi), ___2, "roma({girdi}) yanlış");
          }
      }
  }
blanks:
  - ["girdi"]
  - ["vakalar"]
  - ["beklenen"]
explanation: |
  `for (girdi, beklenen) in vakalar` her tuple'ı iki değişkene **ayrıştırır** (destructuring, Modül 2).
  Mesajdaki `{girdi}` çok önemli: test kaldığında `roma(9) yanlış` gibi bir satır, tablonun **hangi
  satırının** bozuk olduğunu söyler. Mesajsız bir tablo testinde sadece `left`/`right` görürsün ve
  hangi vakaya ait olduğunu tahmin etmek zorunda kalırsın.
```

Tablo testlerinin bir zayıflığı var: döngüdeki ilk `assert_eq!` patladığında test biter, **sonraki vakalar
hiç denenmez**. On vakadan üçü bozuksa sadece birincisini görürsün. İstersen hataları bir `Vec`'te toplayıp
sonda tek seferde raporlayabilirsin. Önce mantığını sıradan bir programda gör:

```rust
# pub fn roma(n: u32) -> String {
#     let tablo = [
#         (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
#         (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
#         (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
#     ];
#     let mut kalan = n;
#     let mut sonuc = String::new();
#     for (deger, sembol) in tablo {
#         while kalan >= deger {
#             sonuc.push_str(sembol);
#             kalan -= deger;
#         }
#     }
#     sonuc
# }
fn main() {
    let vakalar = [(3, "III"), (4, "IV"), (9, "IX"), (40, "XL"), (2026, "MMXXVI")];
    let mut hatalar: Vec<String> = Vec::new();
    for (girdi, beklenen) in vakalar {
        let gelen = roma(girdi);
        if gelen != beklenen {
            hatalar.push(format!("roma({girdi}) = {gelen}, beklenen {beklenen}"));
        }
    }
    // Testte bunun yerine: assert!(hatalar.is_empty(), "{hatalar:#?}");
    println!("{} vaka denendi, {} hata", vakalar.len(), hatalar.len());
}
```

```predict
question: Bu sefer `roma`'nın tablosuna çıkarma kurallarından **yalnızca** `IV` yazılmış; `IX`, `XL`, `XC`, `CD` ve `CM` satırları unutulmuş. Program ne yazdırır?
code: |
  pub fn roma(n: u32) -> String {
      let tablo = [(1000, "M"), (500, "D"), (100, "C"), (50, "L"), (10, "X"), (5, "V"), (4, "IV"), (1, "I")];
      let mut kalan = n;
      let mut sonuc = String::new();
      for (deger, sembol) in tablo {
          while kalan >= deger {
              sonuc.push_str(sembol);
              kalan -= deger;
          }
      }
      sonuc
  }

  fn main() {
      let vakalar = [(4, "IV"), (9, "IX"), (14, "XIV"), (40, "XL"), (2026, "MMXXVI")];
      let mut hatalar: Vec<String> = Vec::new();
      for (girdi, beklenen) in vakalar {
          let gelen = roma(girdi);
          if gelen != beklenen {
              hatalar.push(format!("roma({girdi}) = {gelen}, beklenen {beklenen}"));
          }
      }
      println!("{} hata:", hatalar.len());
      for h in &hatalar {
          println!("{h}");
      }
  }
options:
  - |
    1 hata:
    roma(9) = VIV, beklenen IX
  - |
    2 hata:
    roma(9) = VIV, beklenen IX
    roma(40) = XXXX, beklenen XL
  - |
    2 hata:
    roma(9) = VIIII, beklenen IX
    roma(40) = XXXX, beklenen XL
answer: 1
explanation: |
  `9` için tabloda `IX` yok: önce `V` (4 kaldı), sonra `IV` → `VIV`. `40` için `XL` yok: dört kez `X` →
  `XXXX`. `4`, `14` ve `2026` ise doğru çıkar. Hataları toplamak sayesinde **iki** bozuk vakayı tek
  çalıştırmada gördük; döngü içinde doğrudan `assert_eq!` kullansaydık sadece `roma(9)` hatasını
  görürdük. Bir de dikkat: `VIV` için hata mesajı, eksik olanın tam olarak `9` satırı olduğunu ele veriyor.
  Peki `XC`, `CD`, `CM` de eksikken neden yalnızca iki hata var? Çünkü vaka tablosunda 90, 400 ya da 900
  içeren bir sayı **yok**: test, ancak denediğin girdiler kadar hata bulabilir.
```

:::tip Ne zaman tablo, ne zaman ayrı test?
Tablo testi, **aynı davranışın** farklı girdilerle denendiği durumlar için idealdir ("bilinen değerler").
Farklı davranışlar (geçerli girdi, sıfır, aralık dışı → panik) **ayrı ve adı anlamlı** testler hak eder:
`sifir_yazilamaz`, `en_buyuk_sayi_3999`. Test adı, test çıktısında okuyacağın ilk şeydir.
:::

## İyi bir test nasıl olur?

TDD'de yazdığın testler kodun en uzun yaşayan belgeleridir. İyi testlerin ortak özellikleri:

**1. Adı davranışı anlatır.** `test1` ya da `roma_testi` kaldığında hiçbir şey söylemez.
`kirk_xl_ile_yazilir` ya da `bos_sepetin_toplami_sifirdir` ise test çıktısında okunduğu anda neyin
bozulduğunu söyler. İyi bir ad, bir **cümle** gibi okunur.

**2. Hazırla → Çalıştır → Doğrula.** (İngilizcede *Arrange-Act-Assert*.) Her test üç bölümden oluşur ve
bölümler göz ile ayırt edilir:

```rust
pub struct Sepet {
    urunler: Vec<(String, u32)>, // (ad, fiyat kuruş)
}

impl Sepet {
    pub fn yeni() -> Sepet {
        Sepet { urunler: Vec::new() }
    }

    pub fn ekle(&mut self, ad: &str, fiyat: u32) {
        self.urunler.push((String::from(ad), fiyat));
    }

    pub fn toplam(&self) -> u32 {
        let mut t = 0;
        for (_, fiyat) in &self.urunler {
            t += fiyat;
        }
        t
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iki_urunun_toplami_fiyatlarin_toplamidir() {
        // Hazırla
        let mut sepet = Sepet::yeni();
        sepet.ekle("simit", 1_500);
        sepet.ekle("ayran", 2_000);

        // Çalıştır
        let toplam = sepet.toplam();

        // Doğrula
        assert_eq!(toplam, 3_500);
    }

    #[test]
    fn bos_sepetin_toplami_sifirdir() {
        assert_eq!(Sepet::yeni().toplam(), 0);
    }
}
```

**3. Tek bir davranışı test eder.** Bir test kaldığında sebebi tek olmalı. "Ekle, sil, toplamı al, indirimi
uygula" adımlarının hepsini aynı testte doğrularsan, kalan testin adı sana hiçbir ipucu vermez.

**4. Bağımsız ve deterministiktir.** Test her çalıştırmada aynı sonucu vermeli: rastgele sayıya, saate,
ağa, başka bir testin bıraktığı dosyaya bağlı olmamalı (Ders 2'deki paralel thread'leri hatırla).
Bazen geçip bazen kalan bir teste (*flaky test*) kimse güvenmez.

**5. Uç durumları dener.** Bir fonksiyon için şu listeyi zihninde tara:

| uç durum | örnek |
|---|---|
| boş girdi | `""`, boş `Vec`, boş sepet |
| tek eleman | `[42]`, tek harfli metin |
| sıfır ve sınır değerleri | `0`, eşik değeri ve hemen altı/üstü (`89`/`90`) |
| en büyük değer / taşma | `u32::MAX`, `3999` |
| geçersiz girdi | `"kırk"`, negatif anlamlı değerler, aralık dışı |
| Unicode / Türkçe karakter | `"çiçek"`, `"İstanbul"`, bayt sayısı ≠ karakter sayısı |

````quiz
question: |
  Bir isim alanının en fazla 5 **harf** olabilmesi gerekiyor ve şu fonksiyon yazılmış:

  ```rust
  fn isim_gecerli(isim: &str) -> bool {
      isim.len() <= 5
  }
  ```

  Testler `"Ali"`, `"Ahmet"` ve `"Mehmet"` ile yazıldı ve hepsi geçti. Hangi test hatayı ortaya çıkarırdı?
options:
  - "`assert!(isim_gecerli(\"Can\"));`"
  - "`assert!(isim_gecerli(\"Çağrı\"));`"
  - "`assert!(!isim_gecerli(\"Mustafa\"));`"
  - "`assert!(isim_gecerli(\"\"));`"
answer: 1
explanation: |
  Modül 9'u hatırla: `len()` **bayt** sayısını verir. `"Çağrı"` 5 harftir ama `Ç`, `ğ` ve `ı` UTF-8'de ikişer
  bayt tuttuğu için `len()` **8** döner; fonksiyon geçerli bir ismi reddeder. ASCII harflerden oluşan
  `"Ali"`, `"Can"`, `"Mustafa"` bu hatayı asla göstermez. Türkçe yazılımlarda "Unicode / Türkçe karakter"
  satırı uç durum listesinin vazgeçilmezidir. Doğrusu karakterleri saymaktır: `isim.chars().count() <= 5`
  (Modül 9). Not: `char` bile her zaman ekranda görünen tek bir "harf" değildir; birleşik karakterlerle
  (Modül 9'daki grapheme cluster'lar) yazılmış metinlerde sayı yine farklı çıkabilir. Türkçe metinlerin
  büyük çoğunluğu hazır (tek `char`) harflerle yazıldığından `chars().count()` burada yeterlidir.
feedback:
  - ASCII bir isim; bayt sayısı harf sayısına eşit, hata görünmez.
  - Doğru! 5 harf ama 8 bayt.
  - 7 harf, 7 bayt; fonksiyon doğru şekilde reddeder.
  - Boş isim 0 bayttır; hata görünmez (ayrıca geçerli olup olmadığı ayrı bir karar).
````

```quiz
question: Aşağıdaki test adlarından hangisi, test çıktısında `FAILED` olarak gördüğünde sana **en çok** bilgi verir?
options:
  - "`test_3`"
  - "`sepet_testi`"
  - "`indirim_kuponu_yuzde_yuzu_gecemez`"
  - "`calisiyor_mu`"
answer: 2
explanation: |
  Test adı bir **davranış cümlesi** olmalı: hangi birimin (`indirim_kuponu`), hangi koşulda (`yuzde_yuzu`),
  ne yapması gerektiği (`gecemez`). `FAILED` yanında bu adı gördüğünde kodu açmadan bile hangi kuralın
  bozulduğunu bilirsin. Diğerleri sadece "bir şeyler bozuk" der.
feedback:
  - Sıra numarası hiçbir davranış anlatmaz.
  - Hangi birim belli ama hangi davranışın bozulduğu belli değil.
  - Doğru! Birim + koşul + beklenen davranış.
  - Neyin çalışıp çalışmadığını söylemiyor.
```

## Sıra sende: test önce

İlk alıştırmada kuralları birer birer TDD ile ekle: her kural için önce testini yaz, kırmızıyı gör, sonra
kodu yaz. Başlangıçta bir test hazır.

```exercise
id: m13-e-sifre-dogrulayici
title: TDD ile şifre doğrulayıcı
difficulty: 3
prompt: |
  Bir banka uygulaması için `sifre_kontrol(sifre)` fonksiyonunu yaz. Kurallar **bu sırayla** kontrol edilir
  ve ilk ihlal edilen kuralın hatası döner:

  1. En az **8 karakter** olmalı (bayt değil, **karakter**!) → `SifreHatasi::Kisa`
  2. **Boşluk** içermemeli → `SifreHatasi::BoslukVar`
  3. En az bir **rakam** içermeli → `SifreHatasi::RakamYok`
  4. En az bir **büyük harf** içermeli (Türkçe `Ş`, `İ` gibi harfler de sayılır) → `SifreHatasi::BuyukHarfYok`

  Hepsi sağlanıyorsa `Ok(())`. **TDD ile ilerle:** başlangıçtaki teste ek olarak her kural için kendi testini
  yaz (toplam en az 3 `#[test]`), her seferinde önce kırmızıyı gör. Gizli testler sınır ve Türkçe karakter
  vakalarını da deneyecek.
starter: |
  #[derive(Debug, PartialEq)]
  pub enum SifreHatasi {
      Kisa,
      BoslukVar,
      RakamYok,
      BuyukHarfYok,
  }

  pub fn sifre_kontrol(sifre: &str) -> Result<(), SifreHatasi> {
      todo!()
  }

  fn main() {
      println!("{:?}", sifre_kontrol("Guvenli2026"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn kisa_sifre_reddedilir() {
          assert_eq!(sifre_kontrol("Ab1"), Err(SifreHatasi::Kisa));
      }

      // Sıradaki kuralın testini yaz → kırmızıyı gör → kodu yaz → yeşil!
  }
solution: |
  #[derive(Debug, PartialEq)]
  pub enum SifreHatasi {
      Kisa,
      BoslukVar,
      RakamYok,
      BuyukHarfYok,
  }

  pub fn sifre_kontrol(sifre: &str) -> Result<(), SifreHatasi> {
      let mut uzunluk = 0;
      let mut bosluk_var = false;
      let mut rakam_var = false;
      let mut buyuk_var = false;
      for c in sifre.chars() {
          uzunluk += 1;
          if c.is_whitespace() {
              bosluk_var = true;
          }
          if c.is_ascii_digit() {
              rakam_var = true;
          }
          if c.is_uppercase() {
              buyuk_var = true;
          }
      }
      if uzunluk < 8 {
          return Err(SifreHatasi::Kisa);
      }
      if bosluk_var {
          return Err(SifreHatasi::BoslukVar);
      }
      if !rakam_var {
          return Err(SifreHatasi::RakamYok);
      }
      if !buyuk_var {
          return Err(SifreHatasi::BuyukHarfYok);
      }
      Ok(())
  }

  fn main() {
      println!("{:?}", sifre_kontrol("Guvenli2026"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn kisa_sifre_reddedilir() {
          assert_eq!(sifre_kontrol("Ab1"), Err(SifreHatasi::Kisa));
      }

      #[test]
      fn bosluklu_sifre_reddedilir() {
          assert_eq!(sifre_kontrol("Guvenli Sifre1"), Err(SifreHatasi::BoslukVar));
      }

      #[test]
      fn rakamsiz_sifre_reddedilir() {
          assert_eq!(sifre_kontrol("GuvenliSifre"), Err(SifreHatasi::RakamYok));
      }

      #[test]
      fn buyuk_harfsiz_sifre_reddedilir() {
          assert_eq!(sifre_kontrol("guvenlisifre1"), Err(SifreHatasi::BuyukHarfYok));
      }

      #[test]
      fn kurallara_uyan_sifre_kabul_edilir() {
          assert_eq!(sifre_kontrol("Guvenli2026"), Ok(()));
      }
  }
check: tests
tests: |
  #[test]
  fn uzunluk_siniri_sekiz_karakter() {
      assert_eq!(sifre_kontrol("Abcdef1"), Err(SifreHatasi::Kisa), "7 karakter kısadır");
      assert_eq!(sifre_kontrol("Abcdefg1"), Ok(()), "tam 8 karakter yeterlidir");
  }

  #[test]
  fn uzunluk_bayt_degil_karakter_sayilir() {
      // 7 karakter ama 12 bayt: len() ile sayan bir çözüm bunu yanlışlıkla kabul eder
      assert_eq!(sifre_kontrol("Şğüçİ1a"), Err(SifreHatasi::Kisa), "\"Şğüçİ1a\" 7 karakterdir");
  }

  #[test]
  fn kurallar_sirayla_kontrol_edilir() {
      let vakalar = [
          ("a b", SifreHatasi::Kisa),
          ("guvenli sifre", SifreHatasi::BoslukVar),
          ("guvenlisifre", SifreHatasi::RakamYok),
          ("guvenlisifre9", SifreHatasi::BuyukHarfYok),
      ];
      for (sifre, beklenen) in vakalar {
          assert_eq!(sifre_kontrol(sifre), Err(beklenen), "şifre: {sifre:?}");
      }
  }

  #[test]
  fn turkce_buyuk_harf_sayilir() {
      assert_eq!(sifre_kontrol("güvenliŞifre9"), Ok(()), "Ş bir büyük harftir");
      assert_eq!(sifre_kontrol("istanbulİ2026"), Ok(()), "İ bir büyük harftir");
  }
hints:
  - "Karakterleri `for c in sifre.chars()` ile tek tek dolaş. `sifre.len()` **bayt** sayar (Modül 9): `\"ş\".len()` 2'dir. Karakter sayısı için döngüde bir sayaç artır (ya da `sifre.chars().count()` kullan)."
  - "Döngüde üç bayrak tut: `bosluk_var`, `rakam_var`, `buyuk_var`. Yardımcı metotlar: `c.is_whitespace()`, `c.is_ascii_digit()`, `c.is_uppercase()` (Unicode'u bilir; `Ş` ve `İ` için de `true`)."
  - "Döngü bittikten sonra kuralları **sırayla** kontrol et ve ilk ihlalde `return Err(...)` ile çık: önce `uzunluk < 8`, sonra `bosluk_var`, sonra `!rakam_var`, sonra `!buyuk_var`. Sonda `Ok(())`."
require:
  - pattern: "(#\\[test\\][\\s\\S]*){3}"
    message: TDD ile ilerle, test modülünde en az üç `#[test]` olmalı (başlangıçtaki dahil).
explanation: |
  Kuralları **döngü sırasında değil, döngüden sonra** kontrol etmek, "ilk ihlal edilen kural" sırasını
  garanti eder. Döngü içinde boşluk görünce hemen `BoslukVar` döndürseydin, `"a b"` gibi kısa ve boşluklu
  bir şifre `Kisa` yerine `BoslukVar` alırdı - gizli testteki tablo tam bu sırayı denetliyor.

  İki tuzak daha: `sifre.len() < 8` yazsaydın `"Şğüçİ1a"` (7 karakter, 12 bayt) geçerdi; `is_ascii_uppercase()`
  kullansaydın `"güvenliŞifre9"` reddedilirdi. İkisi de sadece ASCII ile test edilen kodda **asla** görünmeyen
  hatalardır. TDD'de uç durum listesini (boş, sınır, Türkçe karakter) baştan düşünmek bu yüzden değerlidir.

  Iterator'ları öğrendiğinde (Modül 14) bu döngüyü `sifre.chars().any(|c| c.is_ascii_digit())` gibi tek
  satırlık kontrollerle yazabileceksin; testlerin sayesinde o yeniden düzenlemeyi de korkmadan yaparsın.
```

İkinci alıştırmada TDD'nin en güçlü silahlarından birini kullanacaksın: **gidiş-dönüş (round-trip)** testi.
Elinde zaten doğru çalışan `roma` var; onun tersini yazarsan `roma_coz(&roma(n)) == Some(n)` her `n` için
doğru olmalı.

```exercise
id: m13-e-roma-coz
title: "Roma rakamını çöz: tablo testiyle"
difficulty: 4
prompt: |
  `roma_coz(metin)` fonksiyonunu yaz: bir Roma rakamını sayıya çevirir. Metin boşsa ya da `I V X L C D M`
  dışında (küçük harf dahil) bir karakter içeriyorsa `None` döner.

  Kural: soldan sağa okurken bir sembol, **hemen sağındaki** sembolden küçükse çıkarılır (`IV = 5 - 1`),
  aksi hâlde eklenir. Kural yalnızca komşuya bakar; standart dışı yazımlar da bu kuralla hesaplanır:
  `IIV` = 1 + (5 - 1) = 5. Fonksiyon standart dışı girdilerde de **panik yapmamalı**.

  Ayrıca `tests` modülüne, `(girdi, beklenen)` çiftlerinden oluşan bir dizi üzerinde
  `for (girdi, beklenen) in ...` ile dönen bir **tablo güdümlü test** yaz.

  Gizli testler 1'den 3999'a kadar **her** sayı için `roma_coz(&roma(n)) == Some(n)` kontrolü yapacak.
starter: |
  pub fn roma(n: u32) -> String {
      let tablo = [
          (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
          (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
          (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
      ];
      let mut kalan = n;
      let mut sonuc = String::new();
      for (deger, sembol) in tablo {
          while kalan >= deger {
              sonuc.push_str(sembol);
              kalan -= deger;
          }
      }
      sonuc
  }

  pub fn roma_coz(metin: &str) -> Option<u32> {
      todo!()
  }

  fn main() {
      println!("{:?}", roma_coz("MCMXCIV"));
      println!("{:?}", roma_coz("ABC"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      // Tablo güdümlü testini buraya yaz.
  }
solution: |
  pub fn roma(n: u32) -> String {
      let tablo = [
          (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
          (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
          (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
      ];
      let mut kalan = n;
      let mut sonuc = String::new();
      for (deger, sembol) in tablo {
          while kalan >= deger {
              sonuc.push_str(sembol);
              kalan -= deger;
          }
      }
      sonuc
  }

  fn sembol_degeri(c: char) -> Option<u32> {
      match c {
          'I' => Some(1),
          'V' => Some(5),
          'X' => Some(10),
          'L' => Some(50),
          'C' => Some(100),
          'D' => Some(500),
          'M' => Some(1000),
          _ => None,
      }
  }

  pub fn roma_coz(metin: &str) -> Option<u32> {
      if metin.is_empty() {
          return None;
      }
      // Sağdan sola: hemen sağındaki sembolden küçük olan sembol çıkarılır.
      let mut toplam = 0;
      let mut sagdaki = 0;
      for c in metin.chars().rev() {
          let d = sembol_degeri(c)?;
          if d < sagdaki {
              toplam -= d;
          } else {
              toplam += d;
          }
          sagdaki = d;
      }
      Some(toplam)
  }

  fn main() {
      println!("{:?}", roma_coz("MCMXCIV"));
      println!("{:?}", roma_coz("ABC"));
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn bilinen_roma_rakamlari() {
          let vakalar = [("I", 1), ("IV", 4), ("IX", 9), ("XLII", 42), ("MCMXCIV", 1994)];
          for (girdi, beklenen) in vakalar {
              assert_eq!(roma_coz(girdi), Some(beklenen), "girdi: {girdi}");
          }
      }
  }
check: tests
tests: |
  #[test]
  fn bilinen_degerler() {
      let vakalar = [("III", 3), ("IV", 4), ("IX", 9), ("XIV", 14), ("XL", 40), ("XC", 90), ("CD", 400), ("CM", 900), ("MMXXVI", 2026)];
      for (girdi, beklenen) in vakalar {
          assert_eq!(roma_coz(girdi), Some(beklenen), "roma_coz({girdi:?})");
      }
  }

  #[test]
  fn gecersiz_girdiler_none() {
      assert_eq!(roma_coz(""), None, "boş metin bir sayı değildir");
      assert_eq!(roma_coz("ABC"), None, "A ve B Roma sembolü değildir");
      assert_eq!(roma_coz("iv"), None, "küçük harfler kabul edilmez");
      assert_eq!(roma_coz("X V"), None, "boşluk bir sembol değildir");
  }

  #[test]
  fn standart_disi_yazimlar_komsu_kuraliyla() {
      assert_eq!(roma_coz("IIII"), Some(4), "IIII = 1 + 1 + 1 + 1");
      assert_eq!(roma_coz("IIV"), Some(5), "IIV = 1 + (5 - 1): yalnızca hemen sağdaki sembole bakılır");
      assert_eq!(roma_coz("IIIIIIV"), Some(9), "IIIIIIV = 5 × 1 + (5 - 1); panik olmamalı");
  }

  #[test]
  fn gidis_donus_1_den_3999_a() {
      for n in 1..=3999 {
          let yazi = roma(n);
          assert_eq!(roma_coz(&yazi), Some(n), "roma({n}) = {yazi} geri çözülemedi");
      }
  }
hints:
  - "Önce her karakteri değerine çeviren bir yardımcı yaz: `fn sembol_degeri(c: char) -> Option<u32>` ve içinde `match c { 'I' => Some(1), ..., _ => None }`. Döngüde `let d = sembol_degeri(c)?;` yazarsan `?` (Modül 10) geçersiz karakterde fonksiyondan hemen `None` ile çıkar. Boş metni en başta ayrıca kontrol et."
  - "Çıkarma kuralı için komşu sembole bakman gerekir. Kolay yol: **sağdan sola** dolaş (`for c in metin.chars().rev()`, Modül 9) ve bir önceki adımda gördüğün (yani hemen sağdaki) değeri `sagdaki` adlı bir değişkende tut: mevcut değer ondan küçükse çıkar, değilse ekle; sonra `sagdaki = d;`."
  - "Tablo testi: `let vakalar = [(\"IV\", 4), (\"IX\", 9), (\"MCMXCIV\", 1994)]; for (girdi, beklenen) in vakalar { assert_eq!(roma_coz(girdi), Some(beklenen), \"girdi: {girdi}\"); }`"
require:
  - pattern: "#\\[test\\][\\s\\S]*for\\s*&?\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*\\)\\s+in\\b"
    message: "Test modülünde `for (girdi, beklenen) in vakalar` biçiminde bir tablo güdümlü test olmalı."
explanation: |
  Neden sağdan sola? Soldan sağa giderken `IV`'deki `I`'yı gördüğün an, onun çıkarılacağını bilmek için
  bir sonrakine bakman gerekir; ayrıca `toplam -= 1` ile başlamak `u32`'yi **eksiye düşürür** (debug modda
  taşma paniği - Ders 2). Sağdan sola giderken ise çıkarılan sembolün hemen sağındaki daha büyük değer
  **zaten toplanmıştır**. Üstelik Roma sembolleri öyle seçilmiştir ki her sembol, kendisinden küçük
  **bütün** sembollerin toplamından büyüktür (`V` > `I`, `X` > `V + I`, ... `M` > `D + C + L + X + V + I`
  = 666). Arka arkaya çıkarmalar (`IVX` gibi) olsa bile `toplam` bu yüzden asla eksiye düşmez. Soldan
  sağa yazmak istersen ya bir sonraki sembolü indeksle okursun ya da "önce ekle, gerekirse iki katını
  geri al" hilesini kullanırsın.

  Dikkat: "hemen sağdaki" yerine "o ana kadar görülen en büyük" değerle karşılaştıran bir sürüm de bütün
  standart sayıları doğru çözer - ama `IIV` için 3 bulur, `IIIIIIV` içinse `5 - 6` hesaplayıp debug
  modda **taşma paniği** verir. Gizli `standart_disi_yazimlar_komsu_kuraliyla` testi bu farkı yakalar:
  şartnameyi (`prompt`) test eden testler, iki "neredeyse aynı" algoritmayı birbirinden ayırır.
  (Toplama ise ancak milyonlarca `M`'lik bir metinde taşabilir; onu da kapatmak istersen
  `toplam = toplam.checked_add(d)?;` yazarsın.)

  Gizli `gidis_donus_1_den_3999_a` testi bu dersin en önemli fikrini gösteriyor: elinde güvendiğin bir
  fonksiyon (`roma`) varsa, onun tersini **3999 vakayla** sınayan testi tek döngüde yazabilirsin. Bu tür
  testler, elle seçilmiş birkaç örneğin kaçırabileceği hataları yakalar ve "sabit cevap döndür" hilesini
  imkânsız kılar. (Bu fikrin daha güçlü bir hâli *property-based testing* olarak bilinir: `proptest` gibi crate'ler
  aynı özelliği yüzlerce **rastgele** girdiyle sınar.)

  Fark etmiş olabilirsin: `roma_coz("IIII")` → `Some(4)` ve `roma_coz("IC")` → `Some(99)` döner; yani
  fonksiyon bu şartnameyle **standart dışı** yazımları da kabul ediyor. Gerçek bir projede bunları
  reddetmek istersen şartname değişmiş demektir ve TDD sırası bellidir: önce beklentiyi değiştir
  (`assert_eq!(roma_coz("IIII"), None)` - kırmızı!), sonra en kısa çözümü bul - ipucu:
  `if roma(toplam) != metin { return None; }` (yalnızca `roma`'nın üreteceği kanonik yazımı kabul eder).
```

## Özet

:::remember
- **TDD döngüsü**: 🔴 tek bir davranış için kalan bir test yaz → 🟢 en basit kodla geçir → 🔵 testler yeşilken yeniden düzenle.
- Derleme hatası da kırmızıdır. Yeni bir test hemen geçiyorsa şüphelen.
- **Sahte yap** ve **üçgenleme**: önce sabit cevap, sonra yeni testler genellemeye zorlar.
- Yeniden düzenleme davranışı değiştirmez; yeni davranış = yeni kırmızı test.
- **Tablo güdümlü test**: `for (girdi, beklenen) in vakalar { assert_eq!(f(girdi), beklenen, "girdi: {girdi}"); }`
- **Gidiş-dönüş testi**: `coz(&yaz(n)) == Some(n)` binlerce vakayı tek döngüde sınar.
- İyi test: davranışı anlatan ad, Hazırla-Çalıştır-Doğrula, tek davranış, bağımsız ve deterministik, uç durumlar (boş, sınır, taşma, Türkçe karakter).
:::

```reflect
prompt: |
  TDD'de "en basit kodla testi geçir" kuralı, ilk turda `String::from("I")` gibi açıkça yanlış bir kod
  yazmamıza yol açtı. Bu neden zaman kaybı değil? Üçgenleme kavramını kullanarak açıkla.
answer: |
  Model cevap: Sahte kod, testin gerçekten çalıştığını ve test altyapısının doğru kurulduğunu birkaç saniyede
  doğrular. Asıl değer sonraki adımlardadır: her yeni test (2 → "II", 4 → "IV") mevcut kodun yetersiz
  kaldığı **tam noktayı** gösterir ve kodu sadece o kadar genellemeye zorlar. Birden çok örnek, doğru
  genellemenin yerini üçgenler; böylece hiçbir satır testsiz, "belki lazım olur" diye yazılmaz. Sonuçta
  ortaya çıkan kodun her davranışı en az bir testle korunur ve tablo yapısına geçmek gibi büyük yeniden
  düzenlemeler güvenle yapılabilir.
```

```flashcards
- front: TDD döngüsünün üç adımı nedir?
  back: "🔴 Kırmızı (kalan bir test yaz), 🟢 Yeşil (en basit kodla geçir), 🔵 Yeniden düzenle (davranışı değiştirmeden iyileştir)."
- front: TDD'de yeni yazdığın bir test **ilk çalıştırmada geçerse** ne düşünmelisin?
  back: Ya davranış zaten vardır ya da test hiçbir şeyi kontrol etmiyordur, test şüphelidir; kırmızıyı görmeden ilerleme.
- front: "\"Sahte yap\" (fake it) ve üçgenleme nedir?"
  back: Testi önce sabit bir cevapla geçirmek; sonra eklenen yeni örnek testlerin kodu adım adım doğru genellemeye zorlaması.
- front: Yeniden düzenleme (refactor) adımının altın kuralı nedir?
  back: Davranış değişmez, test eklenmez, hiçbir test kırmızıya dönmez. Yeni davranış için önce yeni bir kırmızı test yazılır.
- front: Tablo güdümlü testin temel kalıbı nedir?
  back: "`for (girdi, beklenen) in vakalar { assert_eq!(f(girdi), beklenen, \"girdi: {girdi}\"); }`"
- front: Tablo güdümlü testte hata mesajına girdiyi neden eklersin?
  back: Kalan satırı (hangi vakanın bozuk olduğunu) gösterir; yoksa sadece `left`/`right` görürsün.
- front: Gidiş-dönüş (round-trip) testi nedir?
  back: "Bir dönüşümün tersini kullanarak `coz(&yaz(n)) == Some(n)` gibi bir özelliği çok sayıda girdi üzerinde döngüyle sınamak."
- front: "Türkçe metin işleyen bir fonksiyonda hangi uç durum mutlaka test edilmeli ve neden?"
  back: "`ç, ş, ğ, ı, İ` gibi harfler içeren girdiler: UTF-8'de 2 bayttırlar, `len()` bayt sayar; karakter sayısı farklıdır."
```
