# Özet Kartı: Akıllı İşaretçiler

**Akıllı işaretçi** = işaretçi gibi davranan (`Deref`), çoğu zaman verinin sahibi olan ve kapsam bitince
temizlik yapan (`Drop`) bir struct. `String` ve `Vec` de birer akıllı işaretçidir.

## Hangisini seçmeli?

| tip | sahip | değiştirme | denetim | tipik kullanım |
|---|---|---|---|---|
| `Box<T>` | tek | `&mut` ile | derleme zamanı | özyinelemeli tip, büyük veri, `Box<dyn Trait>` |
| `Rc<T>` | çok | yok (salt okuma) | derleme zamanı | paylaşılan salt okunur veri, ortak liste kuyruğu |
| `Cell<T>` | tek | `&self` ile, kopyalayarak (`T: Copy`) | gerekmez | sayaç, bayrak |
| `RefCell<T>` | tek | `&self` ile, `borrow_mut()` | **çalışma zamanı** (ihlal = panik) | önbellek, mock, `Rc` ile paylaşılan durum |
| `Rc<RefCell<T>>` | çok | evet | çalışma zamanı | birden çok sahibin değiştirdiği veri |
| `Weak<T>` | **sahip değil** | `upgrade()` ile | - | çocuk → ebeveyn, gözlemci, döngü kırma |

Karar sırası: **Kaç sahip?** (tek → `Box`/düz değer, çok → `Rc`) → **Değişecek mi?** (çok sahip + değişiklik
→ `Rc<RefCell<T>>`) → **Geri bağlantı var mı?** (evet → `Weak`). `Rc`, `Cell` ve `RefCell` tek thread
içindir; thread'ler arası karşılıkları `Arc`, `Mutex`, `RwLock` (Modül 18).

## `Box<T>`: heap'te tek sahip

```rust
enum Liste {
    Dugum(i32, Box<Liste>), // Box olmadan: E0072 (sonsuz boyut)
    Bos,
}

struct AgacDugumu {
    deger: i32,
    sol: Option<Box<AgacDugumu>>, // boşken tahsis yok, boyut = bir işaretçi
    sag: Option<Box<AgacDugumu>>,
}

fn main() {
    let b = Box::new(5); // 5 heap'te, stack'te 8 baytlık adres
    let toplam = *b + 1; // * ile değere ulaş
    let liste = Liste::Dugum(1, Box::new(Liste::Dugum(2, Box::new(Liste::Bos))));
    let kok = AgacDugumu { deger: 8, sol: None, sag: None };
    let yaprak = kok.sol.is_none() && kok.sag.is_none();
    if let Liste::Dugum(ilk, kalan) = liste {
        if let Liste::Dugum(ikinci, _) = *kalan {
            println!("{toplam} {ilk}→{ikinci} {} {yaprak}", kok.deger);
        }
    }
}
```

- `Box` `Copy` değildir, atamada **taşınır**; taşıma ucuzdur (yalnızca adres kopyalanır).
- `let s: String = *kutu;` → içeriği `*` ile dışarı taşımaya yalnızca `Box` izin verir.

## `Deref`, `DerefMut` ve deref zorlaması

```rust,ignore
impl<T> Deref for Kutum<T> {
    type Target = T;
    fn deref(&self) -> &T { &self.0 }          // *k  ==  *(k.deref())
}
impl<T> DerefMut for Kutum<T> {
    fn deref_mut(&mut self) -> &mut T { &mut self.0 }
}
```

- **Zorlama** derleme zamanında, zincirleme ve bedavadır: `&Box<String>` → `&String` → `&str`. Metot
  çağrılarında da otomatik (`kutu.len()`).
- İzinli yönler: `&T → &U`, `&mut T → &mut U`, `&mut T → &U`. **Asla** `&T → &mut U`.
- `Deref`'i akıllı işaretçiler ve ince sarmalayıcılar (newtype) için kullan; kalıtım taklidi için değil.

## `Drop`: temizlik kodu

```rust,ignore
impl Drop for Zamanlayici {
    fn drop(&mut self) { println!("{} bitti", self.ad); } // kapsam bitince otomatik
}
```

| durum | drop zamanı |
|---|---|
| yerel değişkenler | tanımlanmanın **tersi** sırasıyla |
| struct alanları / `Vec` elemanları | **tanımlanma** sırasıyla / baştan sona |
| `let _ = x;` | hemen (bağlanmaz) |
| `let _x = x;` | kapsam sonunda |
| yeniden atama `x = yeni;` | eski değer hemen |
| `drop(x)` (`std::mem::drop`) | o anda, işi **taşıma** yapar |

- **RAII koruyucu**: kaynağı kurucuda al, `drop`'ta bırak; `return`, `?` ve panikte bile çalışır.
- `x.drop()` yasak (**E0040**); `Drop` + `Copy` birlikte olmaz (**E0184**).

## `Rc<T>`, `RefCell<T>`, `Cell<T>` ve `Weak<T>`

```rust
use std::cell::{Cell, RefCell};
use std::rc::{Rc, Weak};

struct Klasor {
    ad: String,
    ebeveyn: RefCell<Weak<Klasor>>,     // yukarı: ZAYIF
    cocuklar: RefCell<Vec<Rc<Klasor>>>, // aşağı: GÜÇLÜ
    acilma: Cell<u32>,
}

fn klasor(ad: &str) -> Rc<Klasor> {
    Rc::new(Klasor {
        ad: ad.to_string(),
        ebeveyn: RefCell::new(Weak::new()),
        cocuklar: RefCell::new(Vec::new()),
        acilma: Cell::new(0),
    })
}

fn main() {
    let kok = klasor("ev");
    let belge = klasor("belgeler");
    *belge.ebeveyn.borrow_mut() = Rc::downgrade(&kok); // weak_count(kok) = 1
    kok.cocuklar.borrow_mut().push(Rc::clone(&belge)); // strong_count(belge) = 2
    belge.acilma.set(belge.acilma.get() + 1);

    let ust = belge.ebeveyn.borrow().upgrade(); // Option<Rc<Klasor>>
    println!(
        "{} → {:?} | güçlü {} zayıf {} | açılma {} | çocuk {}",
        belge.ad,
        ust.map(|k| k.ad.clone()),
        Rc::strong_count(&belge),
        Rc::weak_count(&kok),
        belge.acilma.get(),
        kok.cocuklar.borrow().len()
    );
}
```

- `Rc::clone(&a)` derin kopya **değil**: sayacı artırır. `Rc::strong_count` ömrü belirler, `weak_count` yalnızca bilgi verir.
- `Rc::ptr_eq(&a, &b)` = aynı kutu mu? `a == b` = içerikler eşit mi?
- `RefCell`: aynı anda **ya bir** `borrow_mut()` **ya da çok** `borrow()`. İhlal → `RefCell already borrowed`
  paniği. Panik yerine `Result` için `try_borrow` / `try_borrow_mut`. `Ref`/`RefMut` koruyucularını kısa tut.
- `Cell`: `get` / `set` / `replace` / `take`; hiç referans vermez → panik de yok.
- **Döngü = sızıntı**: iki `Rc` birbirini tutarsa güçlü sayaç 0'a inmez, `drop` çalışmaz; güvenli Rust sızıntıyı
  engellemez. Kural: sahiplik aşağı (`Rc`), geri bakan bağlar `Weak`. Gerçek graflarda indeksli **arena** (`Vec` + `usize`).

## Sık hatalar

| belirti | sebep | çözüm |
|---|---|---|
| `E0072 recursive type has infinite size` | Tip kendini doğrudan içeriyor | `Box<T>` / `Option<Box<T>>` ile dolaylılık |
| `E0614 type ... cannot be dereferenced` | Kendi tipinde `Deref` yok | `impl Deref` |
| `E0596 cannot borrow data in dereference of ... as mutable` | `DerefMut` yok ya da `Rc` üzerinden `push` | `DerefMut` uygula / `Rc<RefCell<T>>` |
| `E0594 cannot assign to data in an Rc` | `Rc` içeriğine atama | `RefCell`, `Cell` ya da `Rc::make_mut` |
| `E0040 explicit use of destructor method` | `x.drop()` çağrısı | `drop(x)` |
| `E0184 ... Copy ... destructor` | `Drop` + `Copy` birlikte | Birini kaldır |
| `E0382 use of moved value` | `Box`/`Rc` taşındı | `Rc::clone(&a)` ya da referans |
| `E0609 no field ... on Weak<T>` | `Weak`'in `Deref`'i yok | Önce `upgrade()` → `Option<Rc<T>>` |
| `panicked: RefCell already borrowed` | Okuyucu yaşarken `borrow_mut()` | Koruyucuyu kısa tut, `drop(r)` / `try_borrow_mut` |
| Bellek hiç boşalmıyor, `drop` mesajı yok | `Rc` döngüsü | Geri bağlantıyı `Weak` yap |
