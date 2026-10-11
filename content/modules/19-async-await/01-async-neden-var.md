---
id: m19-l01
title: Async neden var?
minutes: 15
type: lesson
objectives:
  - Bir işin I/O-bound mı CPU-bound mı olduğunu ayırt edip async'in hangisinde fayda sağladığını açıklayabilmek
  - "Thread başına bağlantı modelinin bellek ve bağlam değiştirme (context switch) maliyetini hesaplayabilmek"
  - İşbirlikçi çoklu görev (cooperative multitasking) fikrini elle yazılmış bir zamanlayıcıyla uygulayabilmek
  - "Rust future'larının tembel (lazy) olduğunu JavaScript Promise'leri ve Python asyncio ile karşılaştırabilmek"
keywords: [async, await, future, I/O-bound, CPU-bound, cooperative multitasking, runtime, tokio, C10k]
---

Bir kargo şirketinin takip sunucusunu yazdığını düşün. Aynı anda **10.000 kişi** "Kargom nerede?" diye soruyor.
Her istek için sunucu veritabanına soruyor, cevap 50 milisaniye sonra geliyor. Bu 50 ms boyunca işlemci ne yapıyor?
**Hiçbir şey.** Sadece bekliyor.

Modül 18'de her işe bir thread açmayı öğrendin. Peki 10.000 thread açmak iyi bir fikir mi? Bu derste
**async** programlamanın hangi sorunu çözmek için doğduğunu, Rust'ın bu soruna neden diğer dillerden farklı
yaklaştığını ve modülün geri kalanında kullanacağın kavramların büyük resmini göreceksin.

## Beklemek de bir iştir: I/O-bound ve CPU-bound

Programların yaptığı işleri iki büyük gruba ayırabiliriz:

- **CPU-bound (işlemciye bağlı)** iş: Süreyi işlemcinin hızı belirler. Bir resmi sıkıştırmak, bir milyon sayıyı
  sıralamak, asal sayı aramak. İşlemci hep meşguldür.
- **I/O-bound (girdi/çıktıya bağlı)** iş: Süreyi **beklemek** belirler. Ağdan cevap, diskten dosya, veritabanından
  kayıt, kullanıcıdan tuş, zamanlayıcıdan sinyal. İşlemci zamanının çoğunu boşta geçirir.

Bir web sunucusunun tipik isteği şöyle görünür: 0,1 ms işlem → 40 ms veritabanı beklemesi → 0,2 ms işlem →
20 ms başka bir servisi bekleme → 0,1 ms cevap hazırlama. Yani zamanın **%99'undan fazlası beklemek**.

Önce Modül 18'deki araçlarla bir deney yapalım. Üç "indirme" işini (her biri 100 ms bekliyor) önce sırayla,
sonra her birine bir thread açarak çalıştırıyoruz:

```rust
use std::thread;
use std::time::{Duration, Instant};

fn indir(dosya: &str) -> String {
    thread::sleep(Duration::from_millis(100)); // ağdan cevap bekliyormuş gibi
    format!("{dosya} indi")
}

fn main() {
    let basla = Instant::now();
    for dosya in ["a.txt", "b.txt", "c.txt"] {
        println!("{}", indir(dosya));
    }
    println!("sırayla: ~{} ms", basla.elapsed().as_millis() / 100 * 100);

    let basla = Instant::now();
    let mut kollar = Vec::new();
    for dosya in ["a.txt", "b.txt", "c.txt"] {
        kollar.push(thread::spawn(move || indir(dosya)));
    }
    for kol in kollar {
        println!("{}", kol.join().unwrap());
    }
    println!("thread'lerle: ~{} ms", basla.elapsed().as_millis() / 100 * 100);
}
```

Sırayla ~300 ms, thread'lerle ~100 ms. Beklemeler **üst üste bindi**. Bekleyen bir iş işlemciyi kullanmadığı
için, bekleme sürelerini çakıştırmak her şeyi hızlandırdı. İşte async'in de temel fikri bu: **beklerken başka
işe geçmek.** Fark, bunu thread açmadan yapmasıdır.

```quiz
question: Aşağıdakilerden hangileri **I/O-bound** iştir? (Birden fazla seçenek doğru olabilir.)
options:
  - Bir hava durumu API'sinden 81 ilin sıcaklığını çekmek
  - 4K bir videoyu farklı bir formata dönüştürmek
  - Bir sohbet sunucusunda 5.000 kullanıcının mesajını beklemek
  - Bir dizideki 10 milyon sayının ortalamasını hesaplamak
answer: [0, 2]
explanation: |
  API çağrısı ve kullanıcı mesajı beklemek, zamanın neredeyse tamamını **ağdan cevap beklerken** geçirir: tipik
  I/O-bound iş. Video dönüştürmek ve büyük bir dizide hesap yapmak ise işlemciyi sürekli meşgul eder: CPU-bound.
  Async, I/O-bound işlerde parlar. CPU-bound işi hızlandırmak için gereken şey **paralellik**tir (Modül 18'deki
  thread'ler, `rayon`).
feedback:
  - "Doğru: istek atıp cevabı beklemek I/O-bound'dur."
  - "Video kodlama işlemciyi sürekli çalıştırır; CPU-bound'dur."
  - "Doğru: sunucu zamanının çoğunu mesaj gelmesini bekleyerek geçirir."
  - "Bu saf hesaplama, yani CPU-bound. Async tek başına onu hızlandırmaz."
```

## Thread başına bir bağlantı: neden ölçeklenmiyor?

Thread'lerle de bekleme süreleri çakıştı. O hâlde 10.000 bağlantıya 10.000 thread açalım? Sorun, her
**işletim sistemi thread'inin (OS thread)** bir bedeli olması:

1. **Bellek:** Her thread'in kendi stack'i vardır. Rust'ta `thread::spawn` ile açılan bir thread varsayılan olarak
   **2 MiB** stack ayırır. 10.000 thread × 2 MiB = yaklaşık **20 GB** sanal bellek. İşletim sistemi sayfaları
   kullanıldıkça verse de bu sınırlara hızla çarparsın.
2. **Bağlam değiştirme (context switch):** İşletim sistemi bir thread'i durdurup diğerini çalıştırırken
   register'ları kaydeder, önbellekleri (cache) soğutur, çekirdek (kernel) moduna geçer. Her geçiş birkaç
   mikrosaniye sürer; binlerce thread'de bu, işin kendisinden pahalı hâle gelir.
3. **Oluşturma maliyeti:** Thread açmak bir sistem çağrısıdır; kısa ömürlü binlerce iş için her seferinde
   thread açıp kapatmak israftır.

Bu soruna 1999'da **C10k problemi** ("10.000 eşzamanlı bağlantı") adı verildi. Apache'nin ilk sürümleri her
bağlantıya bir süreç/thread verirken, nginx ve Node.js birkaç thread üzerinde **olay döngüsü (event loop)**
kullanarak çok daha fazla bağlantıyı az bellekle taşıdı. Rust'ın async'i de aynı fikrin, **sıfır maliyetli
soyutlama** ilkesine uygun bir hâlidir.

```memory
title: "10.000 bağlantı: thread'ler ve async görevler"
steps:
  - caption: "Thread başına bağlantı: her bağlantının **kendi stack'i** var (2 MiB). Çoğu sadece cevap bekliyor."
    stack:
      - frame: "thread #1 (2 MiB stack)"
        vars:
          - { name: baglanti, type: TcpStream, value: "cevap bekliyor…", note: uyuyor }
      - frame: "thread #2 (2 MiB stack)"
        vars:
          - { name: baglanti, type: TcpStream, value: "cevap bekliyor…", note: uyuyor }
      - frame: "… thread #10000 (2 MiB stack)"
        vars:
          - { name: baglanti, type: TcpStream, value: "cevap bekliyor…", note: uyuyor }
    heap: []
  - caption: "Async: birkaç thread, her bağlantı **küçük bir görev** (future). Bekleyen görev sadece kendi durumunu heap'te tutar."
    stack:
      - frame: "çalışan thread (runtime)"
        vars:
          - { name: sira, type: kuyruk, value: "hazır görevler", to: g1 }
    heap:
      - { id: g1, label: "görev #1 (~yüzlerce bayt)", value: "durum: veritabanını bekliyor" }
      - { id: g2, label: "görev #2", value: "durum: cevap yazılıyor" }
      - { id: g3, label: "… görev #10000", value: "durum: istek bekliyor" }
```

Modül 18'den bir hatırlatma: thread'ler ve async aynı ödünç alma kurallarına tabidir. Bu kod derlenir mi?

```compiles
code: |
  use std::thread;

  fn main() {
      let sehir = String::from("Isparta");
      let kol = thread::spawn(|| {
          println!("{sehir} için hava durumu soruluyor");
      });
      kol.join().unwrap();
  }
answer: false
error: E0373
explanation: |
  `thread::spawn`'a verilen closure, `main`'den **daha uzun yaşayabilir** (derleyici `join`'in çağrılacağını
  bilemez). Closure `sehir`'i ödünç aldığı için `E0373` hatası çıkar; çözüm `move ||` ile sahipliği closure'a
  taşımaktır. Async'te `tokio::spawn` ile **aynı hatayı** göreceksin ve çözüm yine `move` olacak.
```

```quiz
question: "Bir sohbet sunucusu thread başına bağlantı modeliyle 20.000 bağlantı taşıyacak. Rust'ın varsayılan thread stack boyutuyla yalnızca stack'ler için ne kadar sanal bellek ayrılır?"
options:
  - Yaklaşık 40 MB
  - Yaklaşık 4 GB
  - Yaklaşık 40 GB
  - Hiç; thread'ler heap kullanır
answer: 2
explanation: |
  20.000 × 2 MiB ≈ 40.000 MiB ≈ **40 GB** sanal bellek. Bellek gerçekten kullanıldıkça fiziksel sayfalara
  bağlansa da, bu kadar thread'in oluşturma ve bağlam değiştirme maliyeti de eklenince model ölçeklenmez.
  Async bir görev ise çoğu zaman yalnızca **birkaç yüz bayt** ile birkaç KB arası yer kaplar.
feedback:
  - "Birimleri kontrol et: her thread 2 **MiB**, 20.000 tane var."
  - "20.000 × 2 MiB'ı tekrar hesapla; 4 GB, 2.000 thread'e denk gelir."
  - "Doğru!"
  - "Her thread'in kendi **stack**'i vardır; tam da sorun bu."
```

## İşbirlikçi çoklu görev (cooperative multitasking)

İşletim sistemi thread'leri **kesintili (preemptive)** çalışır: işletim sistemi bir thread'i istediği an durdurur
ve başkasını çalıştırır. Thread "durmak istiyorum" demez, durdurulur.

Async görevler ise **işbirlikçi (cooperative)** çalışır: bir görev yalnızca kendi isteğiyle, **bekleme
noktalarında** (`.await`) kontrolü bırakır. "Ben şu an cevap bekliyorum, sırayı bir başkasına ver" der.
Runtime da (çalışma zamanı) sırası gelen başka bir görevi ilerletir.

:::analogy Tek garson, on masa
Bir lokantada her masaya ayrı bir garson koymak **thread başına bağlantı** modelidir: garsonların çoğu mutfaktan
yemek gelmesini bekleyerek masanın başında dikilir. İyi bir garson ise siparişi mutfağa iletir, **beklemeden**
sıradaki masaya geçer; yemek hazır olunca mutfak zili çalar, garson dönüp yemeği servis eder. Tek garson on masaya
yetişir, çünkü **bekleme anlarını başka işlerle doldurur**. Garson = thread, masalar = görevler,
"siparişi ilet ve diğer masaya geç" = `.await`, mutfak zili = Waker (Ders 5'te göreceğiz).
:::

Bu fikri async sözdizimi olmadan, düz Rust ile kuralım. Her "indirme" görevi bir **durum makinesi (state
machine)**: her çağrıldığında bir adım ilerliyor ve "devam edeceğim" ya da "bittim" diyor. Bir döngü de görevleri
sırayla dürtüyor:

```rust
#[derive(Debug)]
enum Adim {
    Bekliyor,
    Bitti(String),
}

struct Indirme {
    ad: String,
    kalan_parca: u32,
}

impl Indirme {
    fn ilerlet(&mut self) -> Adim {
        if self.kalan_parca > 0 {
            self.kalan_parca -= 1;
        }
        if self.kalan_parca == 0 {
            Adim::Bitti(format!("{} tamam", self.ad))
        } else {
            Adim::Bekliyor
        }
    }
}

fn main() {
    let mut gorevler = vec![
        Indirme { ad: String::from("harita.png"), kalan_parca: 2 },
        Indirme { ad: String::from("ses.mp3"), kalan_parca: 1 },
    ];
    let mut tur = 0;
    while !gorevler.is_empty() {
        tur += 1;
        // Her turda bitmemiş her görevi bir adım ilerlet; bitenleri listeden çıkar.
        gorevler.retain_mut(|g| match g.ilerlet() {
            Adim::Bekliyor => true,
            Adim::Bitti(mesaj) => {
                println!("{tur}. tur: {mesaj}");
                false
            }
        });
    }
}
```

Tek bir thread, iki görevi **sırayla dürterek** aynı anda ilerletti. Hiçbir görev diğerini beklemedi.
Tahmin et: görev sayısını artırırsak ne olur?

```predict
code: |
  # #[derive(Debug)]
  # enum Adim {
  #     Bekliyor,
  #     Bitti(String),
  # }
  # struct Indirme {
  #     ad: String,
  #     kalan_parca: u32,
  # }
  # impl Indirme {
  #     fn ilerlet(&mut self) -> Adim {
  #         if self.kalan_parca > 0 {
  #             self.kalan_parca -= 1;
  #         }
  #         if self.kalan_parca == 0 {
  #             Adim::Bitti(format!("{} tamam", self.ad))
  #         } else {
  #             Adim::Bekliyor
  #         }
  #     }
  # }
  fn main() {
      // ilerlet() ve Adim yukarıdaki örnekle aynı
      let mut gorevler = vec![
          Indirme { ad: String::from("A"), kalan_parca: 3 },
          Indirme { ad: String::from("B"), kalan_parca: 1 },
          Indirme { ad: String::from("C"), kalan_parca: 2 },
      ];
      let mut tur = 0;
      while !gorevler.is_empty() {
          tur += 1;
          gorevler.retain_mut(|g| match g.ilerlet() {
              Adim::Bekliyor => true,
              Adim::Bitti(mesaj) => {
                  println!("{tur}: {mesaj}");
                  false
              }
          });
      }
      println!("toplam tur: {tur}");
  }
options:
  - |
    1: A tamam
    2: B tamam
    3: C tamam
    toplam tur: 3
  - |
    1: B tamam
    2: C tamam
    3: A tamam
    toplam tur: 3
  - |
    1: B tamam
    2: C tamam
    3: A tamam
    toplam tur: 6
answer: 1
explanation: |
  Her turda **her** görev bir adım ilerliyor. B'nin 1 parçası var, ilk turda biter; C ikinci turda, A üçüncü
  turda biter. Toplam tur sayısı parçaların **toplamı** (6) değil, **en uzun görevin** parça sayısı (3).
  Sırayla çalıştırsaydık 6 tur gerekirdi. Eşzamanlı ilerlemenin kazancı tam olarak budur: toplam süre ≈ en uzun iş.
```

## Future: tembel bir durum makinesi

Yukarıda elle yazdığın `Indirme`, Rust'taki **future** kavramının ta kendisidir. Bir **future (gelecek değer)**,
"ileride tamamlanacak bir hesaplamayı" temsil eden bir değerdir. Üç önemli özelliği var:

1. **Durum makinesidir.** Derleyici her `async fn`'i, `Indirme` gibi bir yapıya (aslında bir `enum`'a) dönüştürür.
   Her `.await` noktası, makinenin bir durumudur. Bekleme sırasında hayatta kalması gereken yerel değişkenler
   bu yapının içinde saklanır, thread'in stack'inde değil.
2. **Dürtülerek ilerler.** Future'ı ilerletmenin yolu, onu **yoklamaktır (poll)**: "hazır mısın?" diye sormak.
   Cevap ya "hazırım, değer şu" (`Ready`) ya da "henüz değil" (`Pending`) olur. Yukarıdaki `ilerlet` ve `Adim`
   tam olarak bunun basitleştirilmiş hâli.
3. **Tembeldir (lazy).** Bir future oluşturmak **hiçbir iş yapmaz**. Biri onu yoklayana kadar tek satırı bile
   çalışmaz. Iterator'lar gibi (Modül 14): `map` çağırmak bir şey hesaplamaz, ancak tüketici çağrılınca iş başlar.

Bu tasarımın büyük avantajı: bir future kendi başına **heap'te yer ayırmaz, thread açmaz, çöp toplayıcı istemez.**
Derleme zamanında boyutu bilinen sıradan bir değerdir. (Runtime bir future'ı bağımsız bir görev olarak başlatınca onu
bir kez heap'e koyar; yukarıdaki diyagramdaki görevler bunlar.) 10.000 görev, 10.000 küçük struct demektir.

:::info Neden "durum makinesi"?
Bir `async fn`'in içinde üç `.await` varsa, derleyici kabaca şöyle bir `enum` üretir: `Basladi`, `IlkBeklemede {..}`,
`IkinciBeklemede {..}`, `UcuncuBeklemede {..}`, `Bitti`. Her yoklamada makine bulunduğu durumdan bir sonrakine
geçmeye çalışır. Ders 5'te bunu gerçek `Future` trait'iyle kendin yazacaksın.
:::

Şimdi aynı fikri kendin uygula: görevleri sırayla dürten bir zamanlayıcı (scheduler), runtime'ların kalbi.

```exercise
id: m19-e-zamanlayici
title: Kendi zamanlayıcını yaz
difficulty: 3
prompt: |
  Bir runtime'ın en basit hâlini yazacaksın. `Indirme` görevleri ve `ilerlet` metodu hazır.
  `zamanla` fonksiyonunu tamamla:

  - Görev listesi boşalana kadar **turlar** hâlinde çalış.
  - Her turda, bitmemiş **her** görevin `ilerlet` metodunu listedeki sırasıyla **bir kez** çağır.
  - `Adim::Bitti(mesaj)` dönen görevin mesajını sonuç listesine ekle ve görevi listeden çıkar.
  - Bitiş mesajlarını ve toplam tur sayısını `(Vec<String>, u32)` olarak döndür.

  Örnek: A(3 parça), B(1), C(2) → `(["B tamam", "C tamam", "A tamam"], 3)`. Boş liste → `([], 0)`.
starter: |
  #[derive(Debug, PartialEq)]
  enum Adim {
      Bekliyor,
      Bitti(String),
  }

  struct Indirme {
      ad: String,
      kalan_parca: u32,
  }

  impl Indirme {
      fn new(ad: &str, kalan_parca: u32) -> Indirme {
          Indirme { ad: String::from(ad), kalan_parca }
      }

      fn ilerlet(&mut self) -> Adim {
          if self.kalan_parca > 0 {
              self.kalan_parca -= 1;
          }
          if self.kalan_parca == 0 {
              Adim::Bitti(format!("{} tamam", self.ad))
          } else {
              Adim::Bekliyor
          }
      }
  }

  fn zamanla(gorevler: Vec<Indirme>) -> (Vec<String>, u32) {
      todo!()
  }

  fn main() {
      let gorevler = vec![Indirme::new("A", 3), Indirme::new("B", 1), Indirme::new("C", 2)];
      let (bitenler, tur) = zamanla(gorevler);
      println!("{bitenler:?} - {tur} tur");
  }
solution: |
  #[derive(Debug, PartialEq)]
  enum Adim {
      Bekliyor,
      Bitti(String),
  }

  struct Indirme {
      ad: String,
      kalan_parca: u32,
  }

  impl Indirme {
      fn new(ad: &str, kalan_parca: u32) -> Indirme {
          Indirme { ad: String::from(ad), kalan_parca }
      }

      fn ilerlet(&mut self) -> Adim {
          if self.kalan_parca > 0 {
              self.kalan_parca -= 1;
          }
          if self.kalan_parca == 0 {
              Adim::Bitti(format!("{} tamam", self.ad))
          } else {
              Adim::Bekliyor
          }
      }
  }

  fn zamanla(mut gorevler: Vec<Indirme>) -> (Vec<String>, u32) {
      let mut bitenler = Vec::new();
      let mut tur = 0;
      while !gorevler.is_empty() {
          tur += 1;
          let mut i = 0;
          while i < gorevler.len() {
              match gorevler[i].ilerlet() {
                  Adim::Bekliyor => i += 1,
                  Adim::Bitti(mesaj) => {
                      bitenler.push(mesaj);
                      gorevler.remove(i);
                  }
              }
          }
      }
      (bitenler, tur)
  }

  fn main() {
      let gorevler = vec![Indirme::new("A", 3), Indirme::new("B", 1), Indirme::new("C", 2)];
      let (bitenler, tur) = zamanla(gorevler);
      println!("{bitenler:?} - {tur} tur");
  }
check: tests
tests: |
  #[test]
  fn ornekteki_sira() {
      let g = vec![Indirme::new("A", 3), Indirme::new("B", 1), Indirme::new("C", 2)];
      let (bitenler, tur) = zamanla(g);
      assert_eq!(bitenler, vec!["B tamam", "C tamam", "A tamam"], "kısa görevler önce bitmeli");
      assert_eq!(tur, 3, "toplam tur, en uzun görevin parça sayısı kadar olmalı (3), toplam değil (6)");
  }

  #[test]
  fn bos_liste() {
      let (bitenler, tur) = zamanla(Vec::new());
      assert!(bitenler.is_empty(), "görev yoksa bitiş mesajı da olmamalı");
      assert_eq!(tur, 0, "görev yoksa hiç tur atılmamalı");
  }

  #[test]
  fn ayni_turda_bitenler_liste_sirasini_korur() {
      let g = vec![Indirme::new("x", 2), Indirme::new("y", 2), Indirme::new("z", 1)];
      let (bitenler, tur) = zamanla(g);
      assert_eq!(bitenler, vec!["z tamam", "x tamam", "y tamam"], "aynı turda bitenler listedeki sırayla eklenmeli");
      assert_eq!(tur, 2);
  }

  #[test]
  fn tek_uzun_gorev() {
      let (bitenler, tur) = zamanla(vec![Indirme::new("büyük.iso", 5)]);
      assert_eq!(bitenler, vec!["büyük.iso tamam"]);
      assert_eq!(tur, 5, "tek görev her turda bir adım ilerler");
  }
hints:
  - "Dış döngü: `while !gorevler.is_empty()`. Her turun başında tur sayacını artır. Parametreyi değiştirebilmek için `mut gorevler` yaz."
  - "Bir turda listeyi gezerken eleman silmek için indeksle yürü: `Bekliyor` ise `i += 1`, `Bitti` ise `remove(i)` (indeksi artırma, sıradaki eleman o konuma kaydı)."
  - "Daha kısası: `gorevler.retain_mut(|g| match g.ilerlet() { Adim::Bekliyor => true, Adim::Bitti(m) => { bitenler.push(m); false } });`"
explanation: |
  Bu fonksiyon, gerçek bir async runtime'ın (executor) çekirdek fikrini taşıyor: **hazır görevleri sırayla
  yokla, biten görevleri kuyruktan çıkar.** Tek thread üç görevi aynı anda ilerletti ve toplam süre
  `max(parçalar)` oldu, `toplam(parçalar)` değil.

  İndeksli `while` döngüsünde `remove(i)` sonrası `i`'yi artırmamak kritik: silinen elemanın yerine bir sonraki
  geçer. Alternatif olarak `Vec::retain_mut` (Modül 9'daki `retain`'in `&mut` alan kardeşi) aynı işi tek satırda
  ve O(n) maliyetle yapar; `remove` ise her seferinde elemanları kaydırdığı için O(n²) olabilir.

  Gerçek executor'lar iki noktada daha akıllıdır: (1) **Pending** dönen görevi hemen tekrar dürtmezler; görev
  "beni uyandır" diye bir **Waker** bırakır ve ancak beklediği olay gerçekleşince tekrar kuyruğa girer (boşa
  dönen döngü yok). (2) Görevleri birden fazla thread'e dağıtabilirler (tokio'nun çok thread'li runtime'ı).
```

## Sözdizimi bir bakışta ve runtime'lar

Elle durum makinesi yazmak zahmetli. Rust bunu senin yerine yapar: `async` ve `.await` anahtar kelimeleriyle
**sıralı görünen** kod yazarsın, derleyici onu bir durum makinesine çevirir. İşte bir sonraki dersin önizlemesi:

```rust
use std::time::{Duration, Instant};
use tokio::time::sleep;

async fn indir(dosya: &str) -> String {
    sleep(Duration::from_millis(100)).await; // beklerken thread'i bırakır
    format!("{dosya} indi")
}

#[tokio::main]
async fn main() {
    let basla = Instant::now();
    // join!: üç future'ı aynı anda ilerlet, hepsi bitince sonuçları ver (Ders 3)
    let (a, b, c) = tokio::join!(indir("a.txt"), indir("b.txt"), indir("c.txt"));
    println!("{a}, {b}, {c}");
    println!("~{} ms, tek thread'de, thread açmadan", basla.elapsed().as_millis() / 100 * 100);
}
```

Üç bekleme yine çakıştı (~100 ms), ama bu sefer **tek bir thread** yetti. Burada üç yeni şey var:
`async fn` (future döndüren fonksiyon), `.await` (future'ın bitmesini bekle, beklerken kontrolü bırak) ve
`#[tokio::main]` (programı bir **runtime** içinde başlat). Hepsini sıradaki derste tek tek açacağız.

**Runtime (çalışma zamanı) nedir?** Future'lar kendi kendine ilerlemez; birinin onları yoklaması, uyandırılınca
tekrar yoklaması, zamanlayıcıları ve ağ soketlerini işletim sistemiyle takip etmesi gerekir. Bunu yapan
kütüphaneye **executor** ya da **runtime** denir. İlginç olan şu: **Rust'ın standart kütüphanesinde runtime yok.**
Dil yalnızca `Future` trait'ini ve `async`/`.await` sözdizimini verir; runtime'ı sen seçersin:

| Runtime | Nerede kullanılır |
|---|---|
| **tokio** | Fiilî standart: web sunucuları (axum), veritabanı sürücüleri, ağ servisleri. Bu modülde onu kullanıyoruz. |
| **smol** | Küçük, sade bir runtime. (Eski **async-std** artık geliştirilmiyor; yerine smol öneriliyor.) |
| **embassy** | Gömülü sistemler: işletim sistemi olmayan mikrodenetleyiciler. |

Neden standart kütüphanede değil? Çünkü bir mikrodenetleyicinin ihtiyacı ile 64 çekirdekli bir sunucunun
ihtiyacı çok farklı. Rust "tek beden herkese uyar" yerine, sıfır maliyetli bir arayüz (`Future`) ve
seçilebilir uygulamalar sunar.

:::deep Diğer dillerle karşılaştırma
- **JavaScript:** Promise'ler **heveslidir (eager)**: `fetch(url)` çağrıldığı anda istek başlar, `await` etmesen bile.
  Olay döngüsü dilin içindedir ve tek thread'lidir.
- **Python asyncio:** Coroutine'ler Rust gibi **tembeldir**: `indir()` çağırmak bir coroutine nesnesi döndürür,
  `await` edilmeden çalışmaz. Olay döngüsü standart kütüphanededir (`asyncio.run`).
- **C# / Java:** C#'ın `Task`'ı heveslidir ve bir thread havuzunda çalışır. Java 21'in **sanal thread'leri
  (virtual threads)** ise farklı bir yol seçer: async sözdizimi yok, runtime bekleyen thread'leri kendisi park eder
  (bunun için bir runtime ve çöp toplayıcı gerekir).
- **Rust:** Tembel future'lar + seçilebilir runtime + çöp toplayıcı yok. Bedeli: biraz daha fazla kavram
  (`Pin`, `Send` sınırları); kazancı: C seviyesinde performans ve gömülü sistemlerde bile çalışabilme.
:::

```quiz
question: "JavaScript'te `const p = fetch(url);` yazınca istek hemen gönderilir. Rust'ta `let f = indir(url);` (`indir` bir `async fn`) yazınca ne olur?"
options:
  - İstek hemen arka planda gönderilir; `.await` sadece sonucu almak içindir
  - "Hiçbir şey çalışmaz; `f` tembel bir future'dır, yoklanana (örneğin `.await` edilene) kadar tek satır işlemez"
  - Program, istek bitene kadar o satırda bekler
  - "Derleme hatası: `async fn` yalnızca `.await` ile birlikte çağrılabilir"
answer: 1
explanation: |
  Rust future'ları **tembeldir**: `indir(url)` yalnızca durum makinesini oluşturur. İş, future bir executor
  tarafından yoklandığında (`.await`, `join!`, `tokio::spawn`...) başlar. Python'daki coroutine'ler de böyledir;
  JavaScript Promise'leri ve C# Task'ları ise heveslidir. Future'ı hiç kullanmazsan derleyici bir **uyarı** verir
  ama derleme hatası vermez.
feedback:
  - "Bu JavaScript/C# davranışı. Rust'ta arka planda kendiliğinden çalışan bir şey yok."
  - "Doğru! Future oluşturmak ucuzdur ve hiçbir yan etki üretmez."
  - "O satır beklemez; daha çalışmaya bile başlamamıştır."
  - "Çağırmak serbesttir; sadece döndürülen future kullanılmazsa uyarı alırsın."
```

## Özet

:::remember
- Async, **I/O-bound** işler içindir: beklerken thread'i bırakıp başka işe geçmek. CPU-bound işin ilacı paralelliktir.
- OS thread'leri pahalıdır: stack (Rust'ta varsayılan 2 MiB), bağlam değiştirme, oluşturma maliyeti → **C10k** sorunu.
- Async görevler **işbirlikçidir**: yalnızca `.await` noktalarında kontrolü bırakırlar.
- Bir **future**, derleyicinin ürettiği **tembel bir durum makinesidir**; yoklanınca (poll) ilerler: `Ready` ya da `Pending`.
- Rust'ın standart kütüphanesinde **runtime yoktur**; future'ları tokio gibi bir executor çalıştırır.
:::

```reflect
prompt: Kendi cümlelerinle açıkla, 10.000 bağlantılı bir sunucuda async görevler neden 10.000 thread'den daha verimlidir? "Bekleme" kavramını cevabında kullan.
answer: |
  Model cevap: Bağlantıların çoğu zamanını ağdan cevap **bekleyerek** geçirir. Thread modelinde her bekleyen
  bağlantı bir OS thread'ini (megabaytlarca stack, bağlam değiştirme maliyeti) boşuna meşgul eder. Async'te
  bekleyen görev yalnızca küçük bir durum makinesidir; `.await` noktasında kontrolü bırakır ve az sayıdaki thread,
  hazır olan diğer görevleri ilerletir. Böylece bekleme süreleri çakışır ama bellek ve işlemci boşa gitmez.
```

```flashcards
- front: I/O-bound ve CPU-bound işi bir cümleyle ayırt et.
  back: "I/O-bound işin süresini **beklemek** (ağ, disk, zamanlayıcı) belirler; CPU-bound işin süresini **işlemcinin hesaplama hızı** belirler."
- front: "Rust'ta `thread::spawn` ile açılan bir thread'in varsayılan stack boyutu nedir?"
  back: "**2 MiB**. 10.000 thread ≈ 20 GB sanal bellek demektir."
- front: Kesintili (preemptive) ve işbirlikçi (cooperative) çoklu görev arasındaki fark nedir?
  back: "Kesintili: işletim sistemi thread'i istediği an durdurur. İşbirlikçi: görev kontrolü **kendi isteğiyle**, yalnızca bekleme noktalarında (`.await`) bırakır."
- front: Rust'ta bir future'ı "tembel" yapan nedir?
  back: Future oluşturmak hiçbir iş yapmaz; kod ancak bir executor onu **yokladığında (poll)** çalışmaya başlar.
- front: "Future yoklandığında hangi iki cevaptan birini verir?"
  back: "`Ready(değer)`, bitti; `Pending`, henüz değil, sonra tekrar sor."
- front: Rust standart kütüphanesi neden bir async runtime içermez?
  back: "İhtiyaçlar çok farklı (gömülü sistem ↔ büyük sunucu); dil yalnızca `Future` arayüzünü verir, runtime'ı (tokio, smol, embassy) sen seçersin."
- front: "JS `Promise` ile Rust future'ı arasındaki temel davranış farkı nedir?"
  back: "Promise **heveslidir** (oluşunca çalışır); Rust future'ı **tembeldir** (yoklanınca çalışır)."
```
