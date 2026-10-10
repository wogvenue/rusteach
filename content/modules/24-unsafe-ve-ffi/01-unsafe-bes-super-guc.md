---
id: m24-l01
title: "Unsafe'in beş süper gücü"
minutes: 22
type: lesson
objectives:
  - "`unsafe`'in neden var olduğunu ve neyi **değiştirmediğini** (borrow checker hâlâ açık) açıklayabilmek"
  - "`unsafe`'in beş süper gücünü sayabilmek ve bir işlemin `unsafe` gerektirip gerektirmediğine karar verebilmek"
  - "`&raw const` / `&raw mut` ile ham işaretçi oluşturup `unsafe` blokta okuyup yazabilmek"
  - "`add` ve `offset` ile işaretçi aritmetiği yapıp dilimin sınırları içinde kalabilmek"
keywords: [unsafe, ham işaretçi, raw pointer, "*const T", "*mut T", "&raw const", "&raw mut", E0133, add, offset, süper güç]
---

Yirmi üç modül boyunca derleyici senin koruma meleğin oldu: sarkan referanslar, veri yarışları, çift
serbest bırakmalar... hepsini daha program çalışmadan yakaladı. Peki her gün kullandığın `Vec::push`,
`String`, `Mutex` ve `thread::spawn` nasıl yazılmış? Sürpriz: içlerinde, derleyicinin denetleyemediği
işlemleri yapan **`unsafe`** kod var.

Bu derste Rust'ın "kapağını açıp" o katmana ineceksin. Amaç her yerde `unsafe` yazmak değil; tam tersine,
**ne zaman** gerektiğini, **neyi** açtığını ve **hangi sorumluluğu** üstlendiğini bilmek.

:::ferris
`unsafe` "kuralsız mod" değil, "sorumluluk bende" modudur. Kurallar aynı kalıyor; sadece bazılarını
derleyici yerine sen kontrol ediyorsun. Hazırsan, koruyucu gözlüklerini tak! 🦀
:::

## Neden unsafe var?

Rust'ın borrow checker'ı **muhafazakârdır (conservative)**: bir programın güvenli olduğunu
**kanıtlayamıyorsa** reddeder. Bu, bazı *aslında doğru* programların da reddedilmesi demektir. Derleyicinin
"emin olamıyorum, derlemiyorum" demesi, "kesin hatalı" demesiyle aynı şey değildir.

Bazı işler ise doğası gereği derleyicinin göremeyeceği bilgiye dayanır:

| Durum | Neden derleyici kontrol edemez? |
|-------|----------------------------------|
| **Donanımla konuşmak** (gömülü sistemler, işletim sistemi çekirdeği) | `0x4000_0000` adresinde bir LED kaydı olduğunu derleyici bilemez |
| **FFI** — C kütüphanesi çağırmak | C kodu Rust'ın kurallarını bilmez; derleyici C'nin içini göremez |
| **Performans** — sınır kontrolünü atlamak, özel veri yapıları | "Bu indeks kesinlikle geçerli" bilgisi programcının kafasındadır |
| **Temel soyutlamalar** — `Vec`, `Rc`, `Mutex` | Ham bellekle çalışırlar; güvenliği tasarımları sağlar |

Diğer diller de bu kaçış kapısına sahiptir: Python'ın C uzantıları (`ctypes`, CPython C API), Java'nın
JNI'ı ve `sun.misc.Unsafe`'i, C#'ın `unsafe` anahtar kelimesi. Fark şu: C ve C++'ta **bütün program**
"unsafe"tir; Rust'ta ise tehlikeli bölge **açıkça işaretlenmiş, küçük ve aranabilir** bir alandır.
Bir güvenlik denetçisi projende `grep unsafe` yaparak bakması gereken yerleri saniyeler içinde bulur.

:::analogy Kimya laboratuvarındaki kilitli dolap
Bir okul laboratuvarında deney tüpleri, ölçü kapları herkesin kullanımına açıktır. Ama asit ve zehirli
maddeler **kilitli bir dolaptadır**. Dolabı açmak yasak değildir; anahtar yetkili öğretmendedir ve
dolabı her açışında **deftere imza atar**. `unsafe` bloğu o imzadır: "Bu dolabı ben açtım, içindekini
güvenli kullanmanın sorumluluğu bende." Laboratuvarın geri kalanının kuralları (gözlük tak, koşma) ise
dolap açıkken bile geçerlidir.
:::

`unsafe` anahtar kelimesinin iki yönü vardır; bunu modül boyunca göreceğiz:

- **`unsafe { ... }` bloğu** (ve `unsafe impl`): "Burada derleyicinin kontrol edemediği bir şart var
  ve ben o şartın sağlandığına **söz veriyorum**."
- **`unsafe fn`** (ve `unsafe trait`): "Beni kullanan kişinin yerine getirmesi gereken bir şart var;
  **çağıran söz vermeli**."

```quiz
question: "Aşağıdakilerden hangisi `unsafe` kodun var olma nedenlerinden biri **değildir**?"
options:
  - Derleyicinin kanıtlayamadığı ama doğru olan bir işlemi yapabilmek
  - C ile yazılmış bir kütüphanenin fonksiyonunu çağırabilmek
  - Bir donanım kaydına (register) belirli bir adresten erişebilmek
  - Borrow checker'ın verdiği E0499 hatasını kapatabilmek
answer: 3
explanation: |
  `unsafe` borrow checker'ı **kapatmaz**. İki `&mut` referans `unsafe` bloğun içinde de yasaktır.
  `unsafe` yalnızca derleyicinin hiç kontrol edemediği **beş ek işleme** izin verir. Bir sonraki adımda
  bunu kendi gözünle göreceksin.
feedback:
  - "Bu tam olarak `unsafe`'in amacı: derleyici muhafazakârdır, bazı doğru programları kanıtlayamaz."
  - "FFI, `unsafe`'in en yaygın kullanım alanlarından biridir (3. ders)."
  - "Gömülü sistemlerde donanım kayıtlarına ham işaretçilerle erişilir."
  - "Doğru! `unsafe` referans kurallarını devre dışı bırakmaz; bu yaygın bir yanılgıdır."
```

## Unsafe borrow checker'ı kapatmaz

Pek çok kişi `unsafe`'i "derleyiciyi susturan bir düğme" sanır. Modül 5'teki kuralı hatırla: aynı anda
**ya tek bir `&mut` ya da istediğin kadar `&`**. Önce tahmin et — bu kod `unsafe` blok sayesinde derlenir mi?

```compiles
code: |
  fn main() {
      let mut sepet = String::from("elma");
      unsafe {
          let a = &mut sepet;
          let b = &mut sepet;
          a.push_str(", armut");
          b.push_str(", ayva");
      }
      println!("{sepet}");
  }
answer: false
error: E0499
explanation: |
  `unsafe` bloğu **referans** kurallarını değiştirmez. `a` hâlâ kullanılırken ikinci bir `&mut`
  oluşturmak, Modül 5'teki gibi `E0499` verir. Tip kontrolü, sahiplik, ödünç alma, yaşam süreleri —
  hepsi `unsafe` içinde de aynen çalışır. Derleyici ayrıca "gereksiz `unsafe` bloğu" uyarısı da verir,
  çünkü bu blok içinde unsafe bir işlem yok.
```

Peki `unsafe` tam olarak neyi açıyor? Sadece şu **beş süper güç**:

1. **Ham işaretçiyi çözmek (dereference)** — `*p` (bu ders)
2. **`unsafe` fonksiyon ya da metot çağırmak** — C fonksiyonları dahil (2. ve 3. ders)
3. **Değiştirilebilir statik değişkene (`static mut`) erişmek** (4. ders)
4. **`unsafe` bir trait'i uygulamak** — `unsafe impl Send for ...` (4. ders)
5. **`union` alanlarını okumak** (4. ders)

Bu kadar. Başka hiçbir şey. `unsafe` içinde yazdığın her şey, bu beşi dışında, normal Rust kurallarına
tabidir.

:::info Edition 2024 notu: "unsafe" yazılan diğer yerler
Edition 2024 ile `unsafe` kelimesi birkaç **bildirimde** de zorunlu hâle geldi: `unsafe extern "C" { ... }`
blokları ve `#[unsafe(no_mangle)]` gibi nitelikler (attribute). Bunlar yeni süper güç değildir; "bu
bildirimin doğruluğunu ben garanti ediyorum" sözünün görünür yazılmasıdır. 3. derste göreceğiz.
:::

```quiz
question: Aşağıdaki işlemlerden hangileri bir `unsafe` blok **gerektirir**? (Birden fazla seçenek)
options:
  - "Ham işaretçi oluşturmak: `let p = &raw const x;`"
  - "Ham işaretçinin gösterdiği değeri okumak: `*p`"
  - "`static mut SAYAC: u32` değişkenini artırmak"
  - "Bir `union`'ın alanını okumak"
  - "Bir `Vec`'in elemanına `v[3]` ile erişmek"
answer: [1, 2, 3]
explanation: |
  Ham işaretçi **oluşturmak** güvenlidir; tehlike onu **kullanırken** ortaya çıkar. `v[3]` ise güvenli
  koddur: sınır dışıysa program panikler (Modül 9), tanımsız davranış oluşmaz. `*p`, `static mut` ve
  `union` alanı okumak beş süper güçten üçüdür.
feedback:
  - Oluşturmak güvenli! Sadece bir adres hesaplıyorsun; o adrese henüz dokunmadın.
  - "Doğru — süper güç #1."
  - "Doğru — süper güç #3."
  - "Doğru — süper güç #5."
  - "`v[3]` sınır kontrolü yapar; geçersizse **panik** olur, bu güvenli bir davranıştır."
```

## Ham işaretçiler: *const T ve *mut T

Rust'ta iki tür **ham işaretçi (raw pointer)** vardır:

- `*const T` — gösterdiği yerden okunabilir (C'deki `const T*`)
- `*mut T` — gösterdiği yere yazılabilir de (C'deki `T*`)

Buradaki `*` çözme operatörü değil, tip adının parçasıdır. Ham işaretçi oluşturmanın modern yolu
**`&raw const`** ve **`&raw mut`** sözdizimidir (Rust 1.82):

```rust
fn main() {
    let seviye = 7;
    let oku: *const i32 = &raw const seviye; // güvenli: sadece adres alıyoruz

    let mut puan = 10;
    let yaz: *mut i32 = &raw mut puan; // `puan` mut olmalı

    // Eski yöntem: referansı `as` ile ham işaretçiye çevirmek (hâlâ geçerli)
    let eski = &seviye as *const i32;

    // Boş (null) işaretçi de güvenle oluşturulabilir
    let bos: *const i32 = std::ptr::null();

    println!("oku = {oku:p}, eski = {eski:p}");
    println!("bos null mu? {}", bos.is_null());

    unsafe {
        println!("seviye = {}", *oku); // süper güç #1: ham işaretçiden okumak
        *yaz += 5; // süper güç #1: ham işaretçiye yazmak
        println!("puan = {}", *yaz);
    }
    println!("puan (doğrudan) = {puan}");
}
```

`{:p}` biçimi adresi onaltılık yazdırır; her çalıştırmada farklı bir adres görebilirsin ama `oku` ile
`eski` her zaman **aynı** adresi gösterir, çünkü ikisi de `seviye`'nin adresidir. Ham işaretçiler
referanslardan çok farklıdır:

| Özellik | `&T` / `&mut T` | `*const T` / `*mut T` |
|---------|-----------------|------------------------|
| Null olabilir mi? | Asla | Evet |
| Geçerli veriyi göstermesi garanti mi? | Evet | Hayır (sarkan olabilir) |
| Hizalı (aligned) olması garanti mi? | Evet | Hayır |
| Yaşam süresi (lifetime) var mı? | Evet, borrow checker izler | Hayır |
| Ödünç alma kuralları | Tek `&mut` **veya** çok `&` | Yok: istediğin kadar `*mut` aynı yeri gösterebilir |
| `Copy` mi? | `&T` evet, `&mut T` hayır | İkisi de evet |
| Çözmek (`*p`) | Güvenli | **`unsafe`** |

```memory
title: "let yaz = &raw mut puan;"
steps:
  - caption: "`puan` stack'te bir `i32`. `yaz` ise sadece bir **adres** tutar; borrow checker onu takip etmez."
    stack:
      - frame: main
        vars:
          - { name: puan, type: i32, value: "10", mut: true }
          - { name: yaz, type: "*mut i32", value: "0x7ffd…a4", to: puan, note: ham işaretçi }
  - caption: "`unsafe { *yaz += 5; }` adresteki değeri değiştirir. Adresin geçerli olduğunu derleyici değil **sen** garanti ettin."
    stack:
      - frame: main
        vars:
          - { name: puan, type: i32, value: "15", mut: true }
          - { name: yaz, type: "*mut i32", value: "0x7ffd…a4", to: puan, note: ham işaretçi }
```

Ham işaretçiler `Copy` olduğundan, birini kopyalamak aynı adresi gösteren ikinci bir işaretçi üretir.
Tahmin et:

```predict
code: |
  fn main() {
      let mut puan = 10;
      let p = &raw mut puan;
      let q = p; // ham işaretçiyi kopyala
      unsafe {
          *q += 5;
          *p *= 2;
      }
      println!("{puan}");
  }
options:
  - "30"
  - "25"
  - "20"
  - "Derlenmez: `p` taşındı (E0382)"
answer: 0
explanation: |
  `*mut i32` bir `Copy` tiptir; `let q = p;` adresi kopyalar, `p` geçerliliğini korur. İki işaretçi de
  aynı `puan`'ı gösterir: önce `10 + 5 = 15`, sonra `15 * 2 = 30`. İki `&mut` referansla bu kod
  **derlenmezdi** (E0499); ham işaretçilerde ödünç alma kuralı yoktur. Bu özgürlük güçtür, ama aynı
  zamanda veri yarışlarını önleme sorumluluğunun artık sende olduğu anlamına gelir.
```

:::deep Neden `&raw` sözdizimi eklendi?
`&x as *const i32` önce bir **referans** oluşturur, sonra onu işaretçiye çevirir. Bazı durumlarda o ara
referansın kendisi bile tanımsız davranıştır: hizalanmamış (unaligned) bir alana referans oluşturmak ya da
başka bir yerde değiştirilen bir `static mut`'a referans almak gibi. `&raw const x` ise **hiç referans
oluşturmadan** doğrudan adres üretir. Eskiden bunun için `std::ptr::addr_of!(x)` ve `addr_of_mut!(x)`
makroları kullanılırdı; eski kodlarda görürsen aynı şey olduğunu bil.
:::

## Ham işaretçiyi çözmek neden tehlikeli?

Oluşturmak serbest, çözmek `unsafe`. Neden? Çünkü bir ham işaretçinin **geçersiz** bir yeri göstermesi
güvenli kodda bile çok kolaydır:

```rust
fn main() {
    let p: *const String;
    {
        let gecici = String::from("kısa ömürlü");
        p = &raw const gecici;
        println!("blok içinde p null mu? {}", p.is_null());
    } // `gecici` burada drop edildi, heap belleği serbest kaldı

    // `p` hâlâ eski adresi tutuyor ama o adres artık geçerli değil.
    // unsafe { println!("{}", *p); } // ← tanımsız davranış! Asla yapma.
    println!("p hâlâ var ama sarkan (dangling) bir işaretçi");
}
```

Modül 5'te bir referansla bunu yapmaya çalışsaydın, derleyici `does not live long enough` hatası verirdi.
Ham işaretçinin yaşam süresi olmadığı için derleyici sessiz kalır. Bu kodu çalıştırmak güvenlidir, çünkü
`p`'yi hiç **çözmüyoruz**. Yorum satırını açsaydın, program serbest bırakılmış belleği okurdu:
**use-after-free**, C dünyasındaki en tehlikeli hatalardan biri.

Bu yüzden `*p` yazabilmek için derleyici senden imza ister. İmzasız denersen:

:::error
```text
error[E0133]: dereference of raw pointer is unsafe and requires unsafe block
 --> src/main.rs:4:20
  |
4 |     println!("{}", *p);
  |                    ^^ dereference of raw pointer
  |
  = note: raw pointers may be null, dangling or unaligned; they can violate aliasing rules and cause data races: all of these are undefined behavior
```
`note:` satırı bir ham işaretçiyi çözmeden önce kontrol etmen gereken her şeyi sayıyor: işaretçi
**null** mı, **sarkan** mı, **hizasız** mı, başka bir referansla **çakışıyor** mu, bir **veri yarışına**
yol açıyor mu? Hepsinin cevabı "hayır" olmalı. E0133, süper güçlerden birini `unsafe` olmadan
kullandığında aldığın ortak hata kodudur; tek istisna `unsafe` trait'tir: `unsafe impl` yazmayı unutursan
**E0200** alırsın (4. ders).
:::

**Tanımsız davranış (undefined behavior, UB)**, "program çöker" demek değildir. UB olan bir program
çökebilir, doğru çalışıyormuş gibi görünebilir, yanlış sonuç verebilir ya da derleyici optimizasyonları
yüzünden tamamen beklenmedik şeyler yapabilir. En kötüsü, bugün çalışan kodun yarın başka bir derleyici
sürümünde bozulmasıdır. UB kataloğunu 4. derste ayrıntılı göreceğiz.

Şimdi Modül 9'daki bir dersi hatırla: bir `Vec`'e eleman eklemek, yer kalmazsa **yeniden tahsis
(reallocation)** yapar ve tüm elemanları yeni bir adrese taşır.

````quiz
question: |
  Bu kod hakkında hangisi doğrudur?

  ```rust
  let mut v = vec![1, 2, 3];
  let p = v.as_ptr(); // ilk elemanın ham adresi
  v.push(4);
  unsafe { println!("{}", *p); }
  ```
options:
  - "Derlenmez: `p` duruyorken `push` yapmak E0502 verir"
  - "Derlenir ve her zaman `1` yazdırır"
  - "Derlenir ama tanımsız davranıştır: `push` belleği yeniden tahsis etmiş olabilir, `p` sarkan bir işaretçidir"
answer: 2
explanation: |
  Referansla (`let r = &v[0];`) bu kod Modül 9'daki gibi `E0502` ile reddedilirdi; işte o kural tam olarak
  bu hatayı önlemek içindi. Ham işaretçinin yaşam süresi olmadığından derleyici sessiz kalır. `vec![1, 2, 3]`'ün
  kapasitesi 3'tür; `push(4)` yeni bir bellek alanı ayırır, eskisini serbest bırakır. `p` artık serbest
  bırakılmış belleği gösterir. Program `1` yazdırabilir de, saçma bir sayı da; ikisi de "şans eseri"dir.
feedback:
  - "Referans olsaydı öyle olurdu. Ham işaretçiler borrow checker tarafından takip edilmez."
  - "Belki bazen öyle görünür, ama garanti yoktur: bu tanımsız davranıştır."
  - "Doğru! Ham işaretçi kullanırken borrow checker'ın sana verdiği korumayı artık kendin sağlamalısın."
````

## İşaretçi aritmetiği: add ve offset

C'de bir dizinin elemanlarına işaretçi ilerleterek erişmek çok yaygındır: `*(p + 2)`. Rust'ta bunun
karşılığı ham işaretçilerin **`add`** ve **`offset`** metotlarıdır:

- `p.add(n)` — `n` **eleman** ileri (n: `usize`)
- `p.offset(n)` — `n` eleman ileri ya da geri (n: `isize`, negatif olabilir)
- `p.sub(n)` — `n` eleman geri

Birim **bayt değil, eleman**dır: `*const i32` üzerinde `add(1)` adresi 4 bayt ilerletir, C'deki `p + 1`
ile aynı.

```rust
fn main() {
    let sicakliklar = [18, 21, 25, 23, 19];
    let bas = sicakliklar.as_ptr(); // dilimin ilk elemanının adresi
    let mut toplam = 0;

    for i in 0..sicakliklar.len() {
        // SAFETY: i < len, dolayısıyla bas.add(i) dizinin içinde kalır ve
        // başlatılmış (initialized), hizalı bir i32'yi gösterir.
        let deger = unsafe { *bas.add(i) };
        toplam += deger;
    }

    println!("toplam = {toplam}, ortalama = {}", toplam / sicakliklar.len() as i32);
}
```

```memory
title: "bas.add(i) ile dizide gezinmek"
steps:
  - caption: "`bas` dizinin ilk elemanını gösterir. Her `i32` 4 bayttır."
    stack:
      - frame: main
        vars:
          - { name: sicakliklar, type: "[i32; 5]", value: "18 | 21 | 25 | 23 | 19" }
          - { name: bas, type: "*const i32", value: "adres + 0", to: sicakliklar, note: "eleman 0" }
  - caption: "`bas.add(2)` adresi 2 × 4 = 8 bayt ilerletir ve `25`'i gösterir. `bas`'ın kendisi değişmez."
    stack:
      - frame: main
        vars:
          - { name: sicakliklar, type: "[i32; 5]", value: "18 | 21 | 25 | 23 | 19" }
          - { name: bas, type: "*const i32", value: "adres + 0", to: sicakliklar, note: "eleman 0" }
          - { name: "bas.add(2)", type: "*const i32", value: "adres + 8 bayt", to: sicakliklar, note: "eleman 2 → 25" }
```

`add`'in kendisi de bir `unsafe fn`'dir. Sözleşmesi: sonuç **aynı bellek bloğunun (allocation) içinde ya
da bir eleman sonrasında** kalmalıdır. Dizinin dışına taşan bir `add`, o adresi hiç okumasan bile UB'dir.
Gerçekten sınır dışına çıkabilecek bir adres hesaplıyorsan güvenli `wrapping_add` metodunu kullan; o da
çözme anında yine geçerli bir adres ister.

```predict
code: |
  fn main() {
      let notlar = [70, 85, 90, 55];
      let p = notlar.as_ptr();
      unsafe {
          let ucuncu = p.add(2);
          let ikinci = ucuncu.offset(-1);
          println!("{} {}", *ucuncu, *ikinci);
      }
  }
options:
  - "90 85"
  - "85 70"
  - "70 70"
  - "90 55"
answer: 0
explanation: |
  İndeksler 0'dan başlar: `p.add(2)` üçüncü elemanı (`90`) gösterir. `offset(-1)` bir eleman **geri**
  gider: `85`. `add`'in bayt değil eleman saydığını unutmamak önemli; bayt sayılsaydı `p.add(2)` bir
  `i32`'nin ortasına düşerdi (`70 70` seçeneği bu yanılgıyı temsil ediyor).
```

Sıra sende. Bir dilimin **son** elemanını ham işaretçiyle oku:

```fill
prompt: "`son_olcum` boş olmayan bir dilimin son elemanını ham işaretçi aritmetiğiyle döndürsün."
code: |
  fn son_olcum(olcumler: &[u32]) -> Option<u32> {
      if olcumler.is_empty() {
          return None;
      }
      let bas = olcumler.___0();
      // SAFETY: dilim boş değil, dolayısıyla len - 1 geçerli bir indekstir.
      let son = unsafe { *bas.___1(olcumler.len() - 1) };
      Some(son)
  }

  fn main() {
      println!("{:?}", son_olcum(&[12, 40, 7]));
      println!("{:?}", son_olcum(&[]));
  }
blanks:
  - ["as_ptr"]
  - ["add"]
output: |
  Some(7)
  None
explanation: |
  `as_ptr()` dilimin ilk elemanını gösteren bir `*const u32` verir; `add(len - 1)` son elemana ilerler.
  Boş dilim kontrolü kritik: boş bir dilimde `len() - 1` ifadesi `usize`'da taşma (overflow) yapar
  (Modül 2). Güvenli kodda `olcumler.last().copied()` aynı işi yapar; gerçek hayatta onu tercih et.
```

```exercise
id: m24-e-ters-cevir
title: Pikselleri ham işaretçiyle ters çevir
difficulty: 3
prompt: |
  Bir görüntü işleme kütüphanesi yazıyorsun. Bir satırdaki piksel değerlerini **yerinde (in-place)**
  ters çeviren `ters_cevir` fonksiyonunu ham işaretçilerle yaz: `[1, 2, 3, 4]` → `[4, 3, 2, 1]`.

  Kurallar:
  - `dizi.as_mut_ptr()` ile başlangıç adresini al ve iki uçtan ortaya doğru ilerle.
  - Elemanları `*sol` ve `*sag` üzerinden takas et.
  - `reverse`, `swap` ve `v[i]` gibi indeksleme kullanma — amaç işaretçi aritmetiği.
  - `unsafe` bloğunun üstüne neden güvenli olduğunu anlatan bir `// SAFETY:` yorumu yaz.
starter: |
  fn ters_cevir(dizi: &mut [i32]) {
      todo!()
  }

  fn main() {
      let mut satir = [10, 20, 30, 40, 50];
      ters_cevir(&mut satir);
      println!("{satir:?}");
  }
solution: |
  fn ters_cevir(dizi: &mut [i32]) {
      let n = dizi.len();
      if n < 2 {
          return; // boş ya da tek elemanlı dilimde yapacak iş yok
      }
      let bas = dizi.as_mut_ptr();
      let mut i = 0;
      let mut j = n - 1;
      while i < j {
          // SAFETY: 0 <= i < j < n olduğundan iki işaretçi de dilimin içinde ve
          // farklı, başlatılmış elemanları gösteriyor. `dizi`'yi bu sırada başka
          // bir yoldan kullanmıyoruz.
          unsafe {
              let sol = bas.add(i);
              let sag = bas.add(j);
              let gecici = *sol;
              *sol = *sag;
              *sag = gecici;
          }
          i += 1;
          j -= 1;
      }
  }

  fn main() {
      let mut satir = [10, 20, 30, 40, 50];
      ters_cevir(&mut satir);
      println!("{satir:?}");
  }
check: tests
tests: |
  #[test]
  fn cift_uzunlukta_ters_cevirir() {
      let mut v = [1, 2, 3, 4];
      ters_cevir(&mut v);
      assert_eq!(v, [4, 3, 2, 1], "çift uzunluklu dilim ters çevrilmeli");
  }

  #[test]
  fn tek_uzunlukta_ortayi_yerinde_birakir() {
      let mut v = [7, 8, 9, 10, 11];
      ters_cevir(&mut v);
      assert_eq!(v, [11, 10, 9, 8, 7], "tek uzunlukta ortadaki eleman yerinde kalmalı");
  }

  #[test]
  fn bos_ve_tek_elemanli_dilim() {
      let mut bos: [i32; 0] = [];
      ters_cevir(&mut bos);
      assert_eq!(bos.len(), 0, "boş dilimde panik olmamalı (n - 1 taşmasına dikkat!)");
      let mut tek = [42];
      ters_cevir(&mut tek);
      assert_eq!(tek, [42], "tek elemanlı dilim değişmemeli");
  }

  #[test]
  fn negatif_ve_tekrarli_degerler() {
      let mut v = vec![-3, 5, 5, 0, -3, 8];
      ters_cevir(&mut v);
      assert_eq!(v, vec![8, -3, 0, 5, 5, -3]);
  }
hints:
  - "İki indeks tut: `i` baştan (0), `j` sondan (`n - 1`). `i < j` olduğu sürece takas et, sonra `i`'yi artır, `j`'yi azalt."
  - "Boş dilimde `n - 1` ifadesi `usize`'ı taşırır ve panik verir. `n < 2` ise hemen `return` et."
  - "Döngü gövdesi: `let sol = bas.add(i); let sag = bas.add(j); let gecici = *sol; *sol = *sag; *sag = gecici;` — hepsi bir `unsafe { }` içinde."
forbid:
  - pattern: "\\.reverse\\(|\\.swap\\("
    message: "`reverse`/`swap` kullanmadan, ham işaretçilerle çöz!"
  - pattern: "dizi\\s*\\["
    message: "İndeksleme (`dizi[i]`) yerine `bas.add(i)` kullan."
require:
  - pattern: "as_mut_ptr\\(\\)"
    message: "Başlangıç adresini `dizi.as_mut_ptr()` ile almalısın."
  - pattern: "SAFETY"
    message: "`unsafe` bloğunun neden güvenli olduğunu bir `// SAFETY:` yorumuyla açıkla."
explanation: |
  Çözüm iki işaretçiyi ortaya doğru yaklaştırır; `i < j` koşulu sayesinde `sol` ve `sag` **asla aynı ya da
  sınır dışı** bir elemanı göstermez. `SAFETY` yorumu tam olarak bunu belgeliyor: neden her `add` dilimin
  içinde kalıyor ve neden takas güvenli.

  `i32` `Copy` olduğundan `let gecici = *sol;` değeri kopyalar. `String` gibi `Copy` olmayan bir tip
  olsaydı `*sol`'dan dışarı taşımak derlenmezdi; o durumda `std::ptr::swap(sol, sag)` kullanılır.

  Gerçek hayatta `dizi.reverse()` yazarsın: std'nin içinde de benzer bir `unsafe` döngü vardır, ama sen
  onu **güvenli bir arayüzle** kullanırsın. Bir sonraki ders tam olarak bunu, yani unsafe kodu güvenli bir
  fonksiyonun içine saklamayı anlatıyor.
```

## Özet

:::remember
- `unsafe` borrow checker'ı **kapatmaz**; sadece beş ek işleme izin verir: ham işaretçi çözmek, `unsafe fn`
  çağırmak, `static mut`'a erişmek, `unsafe trait` uygulamak, `union` alanı okumak.
- Ham işaretçi **oluşturmak** güvenlidir (`&raw const x`, `&raw mut x`), **çözmek** (`*p`) `unsafe`'tir → yoksa **E0133**.
- Ham işaretçiler null, sarkan ya da hizasız olabilir; yaşam süreleri ve ödünç alma kuralları yoktur; `Copy`'dirler.
- `p.add(n)` / `p.offset(n)` **eleman** sayar ve sonuç aynı bellek bloğunun içinde kalmalıdır.
- Her `unsafe` bloğun üstüne neden güvenli olduğunu anlatan bir `// SAFETY:` yorumu yaz.
:::

```reflect
prompt: Kendi cümlelerinle açıkla — ham işaretçi oluşturmak neden güvenli ama onu çözmek neden `unsafe`?
answer: |
  Model cevap: İşaretçi oluşturmak sadece bir adres hesaplamaktır; o adresteki belleğe dokunulmaz, bu
  yüzden hiçbir zarar oluşmaz. Çözmek ise o adresteki belleği okumak ya da yazmaktır. Ham işaretçinin
  yaşam süresi olmadığı için derleyici o adresin hâlâ geçerli, hizalı, null olmayan ve başka bir
  referansla çakışmayan bir yeri gösterdiğini kanıtlayamaz. Bu garantiyi programcının vermesi gerekir;
  `unsafe` bloğu bu sözün yazılı hâlidir.
```

```flashcards
- front: "`unsafe`'in beş süper gücü nelerdir?"
  back: "1) ham işaretçi çözmek, 2) `unsafe fn`/metot çağırmak, 3) `static mut`'a erişmek, 4) `unsafe trait` uygulamak, 5) `union` alanı okumak."
- front: "`unsafe` blok içinde iki `&mut` referans aynı anda kullanılabilir mi?"
  back: "Hayır. `unsafe` borrow checker'ı kapatmaz; yine `E0499` alırsın."
- front: "Referans kullanmadan bir değişkenin `*mut` ham işaretçisini oluşturan modern sözdizimi nedir?"
  back: "`&raw mut x` (salt okunur için `&raw const x`)."
- front: Ham işaretçiyi `unsafe` blok olmadan çözmeye çalışınca hangi hata kodu çıkar?
  back: "`E0133` — dereference of raw pointer is unsafe and requires unsafe block."
- front: "`*const i32` üzerinde `p.add(3)` adresi kaç bayt ilerletir?"
  back: "12 bayt. `add` eleman sayar: 3 × `size_of::<i32>()` = 3 × 4."
- front: Ham işaretçilerin referanslardan farklı olarak sahip olmadığı üç garanti say.
  back: "Null olmama, geçerli (sarkmayan) veriyi gösterme, hizalı olma — ayrıca yaşam süresi ve ödünç alma kuralı yoktur."
- front: "`v.as_ptr()` aldıktan sonra `v.push(..)` yapmak neden tehlikelidir?"
  back: "`push` belleği yeniden tahsis edebilir; eski işaretçi sarkan (dangling) olur ve onu çözmek tanımsız davranıştır."
```
