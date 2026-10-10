# Özet Kartı: Unsafe Rust ve FFI

## unsafe: beş süper güç, sıfır kural iptali

| # | Süper güç | Örnek |
|---|-----------|-------|
| 1 | Ham işaretçi **çözmek** | `unsafe { *p }` |
| 2 | `unsafe fn` / işaretsiz `extern` öğesi **çağırmak** | `unsafe { strlen(s) }` |
| 3 | `static mut`'a **erişmek** (okumak da) | `unsafe { SAYAC += 1 }` |
| 4 | `unsafe trait` **uygulamak** | `unsafe impl Send for T {}` |
| 5 | `union` alanı **okumak** | `unsafe { u.f }` |

- `unsafe` borrow checker'ı, tip kontrolünü ve yaşam sürelerini **kapatmaz** (iki `&mut` hâlâ **E0499**).
- Süper gücü `unsafe` olmadan kullanmak → **E0133**. `impl Send` (unsafe'siz) → **E0200**.
- Güvenli olanlar: işaretçi **oluşturmak** (`&raw const x`, `&raw mut x`, `v.as_ptr()`), union alanına **yazmak**, `&raw mut STATIK`.

## Ham işaretçiler

```rust
fn main() {
    let mut puanlar = [10, 20, 30];
    let n = puanlar.len();
    let p = puanlar.as_mut_ptr(); // *mut i32: oluşturmak güvenli
    // SAFETY: n - 1 < n, işaretçi dizinin içinde; diziye başka erişim yok.
    unsafe {
        *p.add(n - 1) += 5; // add ELEMAN sayar: (n-1) × 4 bayt
    }
    println!("{puanlar:?}"); // [10, 20, 35]
}
```

- Ham işaretçiler null, sarkan, hizasız olabilir; yaşam süresi ve ödünç kuralı yok; `Copy`'dirler; `Send`/`Sync` değildirler.
- `add`/`offset` sonucu aynı bellek bloğunun içinde ya da **bir sonrasında** kalmalı (okumasan bile).
- `v.as_ptr()` + `v.push(..)` → yeniden tahsis → sarkan işaretçi. Referansla derleyici yakalar, ham işaretçiyle yakalamaz.

## Güvenli soyutlama = küçük unsafe + güvenli kontrol + SAFETY

```rust
use std::slice;

fn ikiye_bol(v: &mut [i32], orta: usize) -> (&mut [i32], &mut [i32]) {
    let n = v.len();
    assert!(orta <= n); // şartı GÜVENLİ kodda sağla (debug_assert değil!)
    let p = v.as_mut_ptr();
    // SAFETY: orta <= n; [0, orta) ve [orta, n) çakışmaz ve v'nin içinde.
    unsafe {
        (
            slice::from_raw_parts_mut(p, orta),
            slice::from_raw_parts_mut(p.add(orta), n - orta),
        )
    }
}

fn main() {
    let mut v = [1, 2, 3, 4];
    let (a, b) = ikiye_bol(&mut v, 1);
    a[0] = 9;
    b[0] = 8;
    println!("{v:?}"); // [9, 8, 3, 4]
}
```

- `unsafe fn` → sözleşmeyi **çağıran** sağlar (`/// # Safety` belgesi). `unsafe { }` → "şartları **ben** sağladım" (`// SAFETY:` yorumu).
- Edition 2024: `unsafe fn` gövdesi güvenli sayılır; içerideki tehlikeli işlem kendi `unsafe` bloğunu ister (`unsafe_op_in_unsafe_fn` uyarısı).
- **Sound** API: hiçbir güvenli çağrı UB üretemez. Değişmezleri (invariant) koruyan alanları gizli (`pub` olmayan) tut.

## FFI: C ile konuşmak

```rust
use std::ffi::{c_char, c_int};

unsafe extern "C" {
    safe fn abs(x: c_int) -> c_int; // safe: unsafe blok gerekmez (INT_MIN'e dikkat!)
    fn strlen(s: *const c_char) -> usize; // işaretsiz = unsafe fn
}

#[unsafe(no_mangle)] // 2024: unsafe(...) şart
pub extern "C" fn kdv_ekle(fiyat: f64) -> f64 {
    fiyat * 1.20
}

fn main() {
    let s = c"çay"; // &CStr, \0 ile biter
    // SAFETY: s geçerli, \0 ile biten bir C dizgisi.
    let n = unsafe { strlen(s.as_ptr()) };
    println!("{} {n} {}", abs(-3), kdv_ekle(100.0)); // 3 4 120
}
```

| İhtiyaç | Araç |
|---------|------|
| Rust → C dizgi | `let c = CString::new(s)?;` sonra `c.as_ptr()` (sahibi **değişkende** yaşasın!) |
| C → Rust dizgi | `unsafe { CStr::from_ptr(p) }.to_str()` |
| C tipleri | `c_int`, `c_long`, `c_char`, `c_void`, `c_double` (`c_long` platforma göre değişir) |
| C'ye struct | `#[repr(C)]` |
| C kaynağı (aç/kapat) | `Drop` uygulayan RAII sarmalayıcı |
| Bildirim üretmek | bindgen (C → Rust), cbindgen (Rust → C), `-sys` crate'leri |

- Edition 2024'te `extern "C" { }` → "extern blocks must be unsafe"; `#[no_mangle]` → "unsafe attribute used without unsafe".
- `extern "C" fn` içinden panik dışarı çıkamaz → program **abort** eder.

## static, unsafe trait, union

| Durum | Doğru araç |
|-------|------------|
| İsimli sabit değer | `const` (her kullanımda kopya!) |
| Sayaç / bayrak | `static S: AtomicU32 = AtomicU32::new(0);` |
| Değişen karmaşık veri | `static L: Mutex<Vec<T>> = Mutex::new(Vec::new());` |
| Bir kez başlatılan | `OnceLock` / `LazyLock` |
| Gerçekten ham erişim | `static mut` + `&raw mut S` (2024'te `&S`/`&mut S` **reddedilir**: `static_mut_refs`) |

- `unsafe trait` → sözleşmeyi **uygulayan** sağlar (`Send`, `Sync`, `bytemuck::Pod`).
- `union` etiketsizdir: hangi alanın geçerli olduğunu sen takip edersin. Saf Rust'ta `enum` ya da `to_bits`/`from_bits`.

## Tanımsız davranış (UB) ve Miri

- UB: veri yarışı · geçersiz/sarkan/hizasız işaretçi çözmek · sınır dışı `add` · aliasing ihlali · geçersiz değer (`bool` = 2, null `&T`, geçersiz enum) · başlatılmamış bellek · yanlış FFI imzası · `unchecked` sözleşmesini çiğnemek.
- Panik UB **değildir** (`v[10]`, `RefCell`'de çift `borrow_mut`): kontrollü durma.
- "Çalışıyor" UB için hiçbir şey kanıtlamaz; derleyici UB'nin olmayacağını varsayarak optimize eder.

```console
$ rustup +nightly component add miri
$ cargo +nightly miri test
error: Undefined Behavior: memory access failed: ... beyond the end of the allocation
```

## Bellek düzeni

```rust
use std::mem::{MaybeUninit, offset_of};
use std::num::NonZeroU32;

#[allow(dead_code)]
#[repr(C)]
struct Sensor {
    aktif: u8,  // bayt 0, ardından 3 bayt dolgu
    deger: u32, // bayt 4-7
    kanal: u8,  // bayt 8, ardından 3 bayt dolgu
}

fn main() {
    println!("{} {}", size_of::<Sensor>(), offset_of!(Sensor, deger)); // 12 4
    println!("{}", size_of::<Option<&u8>>()); // 8: niş (null = None)
    println!("{}", size_of::<Option<NonZeroU32>>()); // 4: niş (0 = None)
    println!("{}", size_of::<Option<u32>>()); // 8: niş yok, etiket + dolgu

    let mut kutu = MaybeUninit::<[u8; 3]>::uninit();
    let p = kutu.as_mut_ptr() as *mut u8;
    for i in 0..3 {
        // SAFETY: i < 3, dizinin içinde.
        unsafe { p.add(i).write(i as u8) };
    }
    // SAFETY: üç eleman da yazıldı.
    println!("{:?}", unsafe { kutu.assume_init() }); // [0, 1, 2]
}
```

| `repr` | Anlamı |
|--------|--------|
| (yok) | Derleyici yeniden sıralar, **garanti yok** |
| `C` | Bildirim sırası + C hizası/dolgusu |
| `u8`, `i32`... | Enum ayırt edicisinin tipi (sayı → enum: `match`/`TryFrom`, asla `transmute`) |
| `transparent` | Tek alanla aynı düzen ve ABI (fazla alan → **E0690**) |
| `packed` | Dolgu yok; `&p.alan` → **E0793** (kopyala ya da `read_unaligned`) |
| `align(N)` | Hizayı büyüt (false sharing'e karşı) |

- **Boyut her zaman hizanın katıdır.** Dolgu: alan öncesi (hizaya yuvarlama) + sonda (toplamı hizaya yuvarlama).
- `MaybeUninit`: `uninit()` → `ptr.write(x)` (asla `*p = x`) → `unsafe { assume_init() }`. Eksik başlatma = UB; içeriği drop etmez.

**Sırada:** The Rustonomicon · *Learn Rust With Entirely Too Many Linked Lists* · `std::ptr`/`std::mem` belgelerindeki `# Safety` bölümleri · Miri.
