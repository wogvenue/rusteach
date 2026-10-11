---
title: "Özet Kartı: Ödünç Alma ve Dilimler"
---

# Ödünç Alma ve Dilimler: Özet Kartı

## Referans türleri

| Sözdizimi | Anlamı | Not |
|-----------|--------|-----|
| `&x` | `x`'e **değişmez** referans (okumak için ödünç) | Sahiplik taşınmaz; `&T` `Copy`'dir |
| `&mut x` | `x`'e **değiştirilebilir** referans | `x` `let mut` olmalı; `&mut T` `Copy` değildir |
| `*r` | Referansın gösterdiği değer (çözümleme) | `*r += 1;`, metot çağrılarında otomatik: `r.len()` |
| `&s[a..b]` | `String` / `&str` dilimi → `&str` | İndeksler **bayt** sayar, `b` hariç |
| `&v[a..b]` | Dizi/vektör dilimi → `&[T]` | İndeksler **eleman** sayar |
| `&mut v[a..b]` | Değiştirilebilir dilim → `&mut [T]` | Bir bölümü yerinde değiştirir |

Aralık kısayolları: `[..b]` baştan, `[a..]` sona kadar, `[..]` hepsi, `[a..=b]` `b` dahil.

## Altın kural

> Bir değer için aynı anda **ya tek bir `&mut`** ya da **istediğin kadar `&`** olabilir.
> Her referans, gösterdiği değerden **önce** ölmelidir.

- Ödünç, oluşturulduğu yerden **son kullanıldığı yere** kadar yaşar (**NLL**), kapsamın sonuna kadar değil.
- Ödünçteyken sahip de kurala uyar: `&mut` varken okuyamaz; herhangi bir ödünç varken atayamaz, taşıyamaz.

```rust
fn main() {
    let mut s = String::from("merhaba");
    let r1 = &s;
    let r2 = &s;
    println!("{r1} {r2}"); // r1 ve r2 burada biter
    let w = &mut s; // artık serbest
    w.push_str(" dünya");
    println!("{s}");
}
```

## İmza seçimi

| Fonksiyon ne yapacak? | Parametre / dönüş |
|-----------------------|-------------------|
| Metni sadece okuyacak | `&str` (`&String` değil) |
| Listeyi sadece okuyacak | `&[T]` (`&Vec<T>` değil) |
| Elemanları yerinde değiştirecek | `&mut [T]` |
| Eleman ekleyip silecek | `&mut Vec<T>` |
| Metni değiştirecek (`push_str`) | `&mut String` |
| Sahiplik alacak (tüketecek, saklayacak) | `String`, `Vec<T>` |
| Yeni bir değer **üretip** döndürecek | `-> String` (yerel değere `&` döndürülemez) |

## Hata kodları ve tipik çözümler

| Kod | Ne oldu? | Tipik çözüm |
|-----|----------|-------------|
| E0596 | `&` üzerinden değiştirme / `mut` olmayan değişkenden `&mut` | `&mut` al, `let mut` yap |
| E0499 | Aynı değere iki `&mut` | Ödünçleri sırala, iç kapsam, `split_at_mut` |
| E0502 | `&` ile `&mut` çakışıyor | Ödüncü kısalt, önce oku sonra yaz, indeks tut |
| E0506 | Ödünçteki değere atama | Atamayı referansın son kullanımından sonraya al |
| E0505 | Ödünçteki değeri taşıma | Referansla işi önce bitir |
| E0507 | Referans/indeks üzerinden taşıma | `&` ile ödünç al ya da bilinçli `.clone()` |
| E0597 | Değer, referanstan önce ölüyor | Sahibi dış kapsamda tanımla |
| E0106 / E0515 | Yerel değere referans döndürme | Sahipli değer döndür (`-> String`) |

## Borrow checker ile düşünmek

1. **Kim sahip?** (Hata mesajında adı geçen değer.)
2. **Kim ödünç alıyor, nasıl?** (`... borrow occurs here` etiketleri; metotlar da gizlice `&`/`&mut` alır.)
3. **Ne kadar süreyle?** (`... later used here` = çizginin sonu.)

Beş çözüm: **ödüncü kısalt** · **bilinçli `clone`** · **sahipli veri döndür** · **referans yerine indeks** · **önce oku, sonra yaz**.

Koleksiyonu dolaşırken büyütmek (`for x in &v { v.push(..) }` → E0502):

```rust
fn main() {
    let mut v = vec![3, 8, 1];
    let n = v.len(); // uzunluğu önceden sabitle
    for i in 0..n {
        if v[i] > 2 {
            let yeni = v[i] * 10; // önce oku
            v.push(yeni); // sonra yaz
        }
    }
    println!("{v:?}"); // [3, 8, 1, 30, 80]
}
```

## UTF-8 tuzağı

- `ş ç ğ ı ö ü` UTF-8'de **2 bayt**. `len()` bayt sayar: `"çay".len() == 4`.
- Bir karakterin ortasından dilim almak **panik** verir: `&"şeker"[0..1]`. Sınırı `s.is_char_boundary(i)` ile kontrol et.
- ASCII bir ayırıcının (boşluk, `.`, `,`) bayt indeksinden kesmek her zaman güvenlidir.
