# Özet Kartı: Closure'lar ve Iterator'lar

## Closure sözdizimi

```rust
fn main() {
    let artir = |x| x + 1;                      // tipler çıkarılır
    let kare = |x: i32| -> i32 { x * x };       // dönüş tipi yazılırsa gövde { } içinde
    let esik = 50;
    let gecti_mi = |not: u32| not >= esik;      // `esik`'i yakalar (fn bunu yapamaz → E0434)
    println!("{} {} {}", artir(1), kare(4), gecti_mi(72));
}
```

- Closure'lar **generic değildir**: parametre tipleri **ilk kullanımda** sabitlenir; sonra başka tiple çağırmak **E0308**.
- Yakalama closure **oluşturulurken** olur; ödünç, closure'ın **son kullanımına** kadar sürer.
- Tembel varsayılan: `unwrap_or_else(|| pahali())` closure'ı sadece gerekirse çağırır; `unwrap_or(pahali())` hep hesaplar.
- Std'de her yerde: `sort_by_key(|o| o.yas)`, `retain(|x| ...)`, `entry(..).or_insert_with(Vec::new)`.

## Yakalama biçimi → trait

| gövde yakaladığına ne yapıyor? | yakalama | trait | kaç kez çağrılır? |
|---|---|---|---|
| sadece okuyor | `&T` | `Fn` | istediğin kadar, paylaşarak |
| değiştiriyor (`+=`, `push`) | `&mut T` | `FnMut` | tekrar tekrar, ama `let mut f` gerekir |
| tüketiyor (taşıyor, `drop`, döndürüyor) | `T` | `FnOnce` | **bir kez** |

- Her `Fn` bir `FnMut`, her `FnMut` bir `FnOnce`'tır. Trait'i **gövde** belirler, `move` değil.
- `move ||` yakalamayı **değerle** yapmaya zorlar (`Copy` tipler kopyalanır). Closure yakaladığından
  uzun yaşayacaksa (`return`, thread, Modül 18) gerekir, yoksa **E0373**.

## Closure alan ve döndüren fonksiyonlar

```rust
fn uygula<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 { f(x) }       // generic sınır
fn tekrarla(n: u32, mut f: impl FnMut()) { for _ in 0..n { f(); } }
fn bir_kez<F>(f: F) -> String where F: FnOnce() -> String { f() }
fn carpan(k: i32) -> impl Fn(i32) -> i32 { move |x| x * k }        // döndürürken move!
fn ikiye_katla(x: i32) -> i32 { x * 2 }

fn main() {
    let mut sayac = 0;
    tekrarla(3, || sayac += 1);
    let ad = String::from("Ayşe");
    let selam = bir_kez(move || ad + " hoş geldin");
    let uc_kat = carpan(3);
    println!("{} {} {sayac} {selam}", uygula(&uc_kat, 5), uygula(ikiye_katla, 5));
}
```

- Fonksiyon yazarken **en gevşek** sınırı iste: bir kez → `FnOnce`, sırayla tekrar → `FnMut`, paylaşarak → `Fn`.
- Her closure **kendine özgü** bir tiptir: `if`/`else` iki farklı closure döndüremez (E0308) → `Box<dyn Fn(..)>` (Modül 17/20).
- `fn(i32) -> i32` bir **fonksiyon işaretçisi** tipidir: fonksiyonları ve **yakalamayan** closure'ları kabul eder.
- Closure isteyen yere fonksiyon adı verilebilir: `.map(ikiye_katla)`, `.unwrap_or_else(String::new)`.

## Iterator trait'i ve for

```rust,ignore
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;   // tek zorunlu metot; 70+ metot bedava
}
// for x in k  ≈  let mut it = k.into_iter(); while let Some(x) = it.next() { ... }
```

| yazım | eşdeğeri | eleman | koleksiyon sonra? |
|---|---|---|---|
| `for x in &v` | `v.iter()` | `&T` | duruyor |
| `for x in &mut v` | `v.iter_mut()` | `&mut T` | duruyor (değişmiş olabilir) |
| `for x in v` | `v.into_iter()` | `T` | **tüketildi** (sonra kullanmak E0382) |

- Iterator'lar **tembeldir**: `v.iter().map(f);` tek başına hiçbir şey yapmaz (derleyici uyarır).
- `next` iterator'ı değiştirir → `let mut it = v.iter();` (koleksiyon değil, iterator `mut`).
- Gezerken koleksiyonu değiştirmek (döngü içinde `v.push`) **E0502**: iterator geçersizleşmesi derleme anında engellenir.

## Adaptörler (iterator → iterator, tembel)

| adaptör | ne yapar | not |
|---|---|---|
| `map(f)` / `filter(p)` | dönüştür / süz | `filter` closure'ı `&Item` alır → `iter()`'de `&&T` |
| `copied()` / `cloned()` | `&T` → `T` | sayılarla zincirin başında |
| `enumerate()` | `(indeks, eleman)` | indeks `usize`, 0'dan |
| `zip(b)` / `chain(b)` | çiftle / arka arkaya ekle | `zip` **kısa olanda** durur |
| `take(n)` / `skip(n)` | ilk n / ilk n'yi atla | sonsuz iterator'ı sınırlar |
| `take_while(p)` / `skip_while(p)` | koşul **ilk bozulana** kadar | sonra bir daha bakmaz |
| `step_by(k)` / `rev()` | her k'da bir / ters | `rev` iki uçlu iterator ister |
| `flat_map(f)` | iç içe olanı düzleştir | `map(..).flatten()` ile aynı |
| `filter_map(f)` | `Option` ile süz + dönüştür | ör. `s.parse().ok()` döndüren closure |
| `peekable()` | `peek()` ile almadan bak | iterator `mut` olmalı |
| `windows(k)` / `chunks(k)` | örtüşen / örtüşmeyen parçalar | **dilim** metotları (`&[T]`) |

Zincir **eleman eleman** akar; ara `Vec` oluşmaz. `take(2)` ikinci elemanı aldığında zincir durur, kalanlara hiç bakılmaz.

## Tüketiciler (iterator'ı çalıştırır)

| tüketici | sonuç | boş iterator'da |
|---|---|---|
| `sum()` / `product()` / `count()` | sayı | `0` / `1` / `0` |
| `fold(baslangic, f)`, `f(acc, x)` | biriktirici | `baslangic` |
| `any(p)` / `all(p)` | `bool`, **kısa devre** | `false` / `true` |
| `find(p)` / `position(p)` | `Option<Item>` / `Option<usize>` | `None` |
| `max()` / `min()` / `max_by_key(f)` / `max_by(cmp)` | `Option` | `None`, eşitlikte `max` **sonuncuyu**, `min` **ilkini** verir |
| `last()` / `nth(n)` | `Option` | `None`, `nth` önündekileri tüketir |
| `collect()` | `Vec`, `String`, `HashMap`, `HashSet`, `BTreeMap`... | boş koleksiyon |

```rust
use std::collections::HashMap;

fn main() {
    let kayitlar = ["Ali:85", "Ece:92", "Can:x"];
    let toplam: u32 = (1..=4).sum(); // tip notu şart (yoksa E0283)
    let carpim = (1..=4).product::<u32>(); // ya da turbofish
    let notlar: HashMap<&str, u32> = kayitlar
        .iter()
        .filter_map(|s| s.split_once(':'))
        .filter_map(|(ad, n)| n.parse().ok().map(|n| (ad, n))) // "Can:x" atlanır
        .collect();
    let hepsi: Result<Vec<u32>, _> = ["7", "x", "9"].iter().map(|s| s.parse::<u32>()).collect();
    println!("{toplam} {carpim} {} {}", notlar.len(), hepsi.is_err()); // ilk Err'de durur
}
```

## Kendi iterator'ın

```rust
struct GeriSayim {
    kalan: u32, // durum struct'ta
}

impl Iterator for GeriSayim {
    type Item = u32; // unutulursa E0046
    fn next(&mut self) -> Option<u32> {
        if self.kalan == 0 {
            return None;
        }
        self.kalan -= 1;
        Some(self.kalan + 1)
    }
}

fn main() {
    let ciftler: Vec<u32> = GeriSayim { kalan: 6 }.filter(|n| n % 2 == 0).collect(); // bedava metotlar
    let kuvvetler = std::iter::successors(Some(1u32), |&n| n.checked_mul(2)); // taşınca biter
    let mut a = 0;
    let uce_kadar = std::iter::from_fn(move || {
        a += 1;
        if a <= 3 { Some(a) } else { None }
    });
    println!("{ciftler:?} {} {:?}", kuvvetler.count(), uce_kadar.collect::<Vec<_>>());
}
```

- Sonsuz iterator (Fibonacci) hep `Some` döndürebilir → `take`, `take_while` ya da kısa devre yapan bir tüketiciyle sınırla.
- Iterator döndürmek: `fn gecenler(&self) -> impl Iterator<Item = &Ogrenci>` (edition 2024 yaşam süresini kendisi yakalar).
- Her iterator için sor: **bu iterator biter mi?** (hiç ilerlemeyen bir adım = sonsuz `Some`).

## Performans ve üslup

- **Sıfır maliyetli soyutlama**: `--release`'de zincirler inline edilir, sınır kontrolleri kalkar, SIMD'ye açılır →
  elle yazılmış indeksli döngü kadar (çoğu zaman daha) hızlı. Ölçümü daima `--release` ile yap.
- `for i in 0..v.len()` + `v[i]` yerine `for x in &v` / `v.iter()`: en az onun kadar hızlı ve panik riski yok.
- Seçim **okunabilirlik** meselesi: tek sonuçlu dönüştür/süz/topla → boru hattı; birden çok sonuç, erken
  `return`, `?`, karmaşık yan etki → düz `for` döngüsü.

## Sık hatalar

| hata | sebep | çözüm |
|---|---|---|
| `E0308 mismatched types` (closure) | Closure ilk çağrıda başka tiple sabitlendi | Tek tip kullan ya da generic `fn` yaz |
| `E0434 can't capture dynamic environment in a fn item` | İç `fn` yerel değişkene erişiyor | Closure kullan |
| `E0596 cannot borrow ... as mutable` | `FnMut` closure `let mut` ile tanımlanmamış | `let mut f = ...` |
| `E0502` (closure / döngü) | Closure ya da iterator ödünç tutarken koleksiyon değiştiriliyor | Önce bitir, sonra değiştir; ya da `retain` |
| `E0594 ... captured variable in a Fn closure` | `Fn` isteyen yere değiştiren closure | Sınırı `FnMut` yap |
| `E0525 expected ... Fn ... only implements FnOnce` | Gövde yakaladığını tüketiyor | `clone()` ile ver ya da sınırı `FnOnce` yap |
| `E0507 cannot move out of ... in an FnMut closure` | Tekrar çağrılacak closure değer taşıyor | Her çağrıda yeni değer (`clone`) |
| `E0373 closure may outlive the current function` | Döndürülen/thread'e giden closure ödünç alıyor | `move` ekle |
| `E0283 type annotations needed` | `collect`/`sum` hedef tipi belli değil | `let v: Vec<_> = ...` ya da `::<Vec<_>>()` |
| `E0382 borrow of moved value` (for sonrası) | `for x in v` vektörü tüketti | `for x in &v` |
| `E0046 missing: Item` | `impl Iterator`'da `type Item` yok | `type Item = T;` ekle |
| Uyarı: `iterators are lazy and do nothing unless consumed` | Zincirde tüketici yok | `for`, `collect`, `sum`... ekle |
