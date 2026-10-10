// Starter programs for the playground's "Şablonlar" menu.

export interface PlaygroundTemplate {
  id: string;
  name: string; // tab name
  title: string;
  description: string;
  code: string;
}

export const TEMPLATES: PlaygroundTemplate[] = [
  {
    id: 'merhaba',
    name: 'merhaba.rs',
    title: 'Merhaba dünya',
    description: 'println! ve basit bir döngü',
    code: `fn main() {
    let isim = "Ferris";
    println!("Merhaba, {isim}! 🦀");

    for i in 1..=3 {
        println!("{i}. satır");
    }
}
`,
  },
  {
    id: 'struct',
    name: 'struct.rs',
    title: 'Struct ve metotlar',
    description: 'impl bloğu, ilişkili fonksiyon, &self',
    code: `#[derive(Debug)]
struct Dikdortgen {
    genislik: u32,
    yukseklik: u32,
}

impl Dikdortgen {
    fn new(genislik: u32, yukseklik: u32) -> Self {
        Self { genislik, yukseklik }
    }

    fn alan(&self) -> u32 {
        self.genislik * self.yukseklik
    }

    fn kare_mi(&self) -> bool {
        self.genislik == self.yukseklik
    }
}

fn main() {
    let d = Dikdortgen::new(8, 5);
    println!("{d:?}");
    println!("Alan: {}", d.alan());
    println!("Kare mi? {}", d.kare_mi());
}
`,
  },
  {
    id: 'enum',
    name: 'enum.rs',
    title: 'Enum + match',
    description: 'veri taşıyan varyantlar, kapsamlı eşleme',
    code: `enum Sekil {
    Daire { yaricap: f64 },
    Kare(f64),
    Ucgen { taban: f64, yukseklik: f64 },
}

fn alan(s: &Sekil) -> f64 {
    match s {
        Sekil::Daire { yaricap } => std::f64::consts::PI * yaricap * yaricap,
        Sekil::Kare(kenar) => kenar * kenar,
        Sekil::Ucgen { taban, yukseklik } => taban * yukseklik / 2.0,
    }
}

fn main() {
    let sekiller = [
        Sekil::Daire { yaricap: 1.5 },
        Sekil::Kare(3.0),
        Sekil::Ucgen { taban: 4.0, yukseklik: 2.5 },
    ];

    for s in &sekiller {
        println!("alan = {:.2}", alan(s));
    }
}
`,
  },
  {
    id: 'trait',
    name: 'trait.rs',
    title: 'Trait',
    description: 'varsayılan metot, dyn Trait ile çok biçimlilik',
    code: `trait Hayvan {
    fn isim(&self) -> String;
    fn ses(&self) -> &'static str;

    fn tanit(&self) -> String {
        format!("{} şöyle der: {}", self.isim(), self.ses())
    }
}

struct Kedi;

struct Kopek {
    ad: String,
}

impl Hayvan for Kedi {
    fn isim(&self) -> String {
        "Kedi".to_string()
    }
    fn ses(&self) -> &'static str {
        "miyav"
    }
}

impl Hayvan for Kopek {
    fn isim(&self) -> String {
        self.ad.clone()
    }
    fn ses(&self) -> &'static str {
        "hav hav"
    }
}

fn main() {
    let hayvanlar: Vec<Box<dyn Hayvan>> = vec![
        Box::new(Kedi),
        Box::new(Kopek { ad: String::from("Karabaş") }),
    ];

    for h in &hayvanlar {
        println!("{}", h.tanit());
    }
}
`,
  },
  {
    id: 'iterator',
    name: 'iterator.rs',
    title: 'Iterator zinciri',
    description: 'filter, map, enumerate, collect',
    code: `fn main() {
    let sayilar = vec![3, 8, 1, 12, 7, 4, 10];

    let cift_kareler: Vec<i32> = sayilar
        .iter()
        .filter(|&&n| n % 2 == 0)
        .map(|n| n * n)
        .collect();
    println!("Çift sayıların kareleri: {cift_kareler:?}");

    let toplam: i32 = sayilar.iter().sum();
    let en_buyuk = sayilar.iter().max().unwrap();
    println!("Toplam: {toplam}, en büyük: {en_buyuk}");

    let kelimeler = ["rust", "güvenli", "hızlı"];
    let cumle = kelimeler
        .iter()
        .enumerate()
        .map(|(i, k)| format!("{}:{}", i + 1, k.to_uppercase()))
        .collect::<Vec<_>>()
        .join(" ");
    println!("{cumle}");
}
`,
  },
  {
    id: 'thread',
    name: 'thread.rs',
    title: 'Thread',
    description: 'Arc<Mutex<T>> ile paylaşılan sayaç',
    code: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let sayac = Arc::new(Mutex::new(0));
    let mut kollar = Vec::new();

    for id in 0..4 {
        let sayac = Arc::clone(&sayac);
        kollar.push(thread::spawn(move || {
            for _ in 0..1000 {
                *sayac.lock().unwrap() += 1;
            }
            println!("iş parçacığı {id} bitti");
        }));
    }

    for kol in kollar {
        kol.join().unwrap();
    }
    println!("Toplam: {}", *sayac.lock().unwrap());
}
`,
  },
  {
    id: 'tokio',
    name: 'async.rs',
    title: 'Tokio async',
    description: 'eşzamanlı görevler, tokio::join!',
    code: `use std::time::Duration;
use tokio::time::sleep;

async fn indir(ad: &str, ms: u64) -> String {
    sleep(Duration::from_millis(ms)).await;
    format!("{ad} hazır ({ms} ms)")
}

#[tokio::main]
async fn main() {
    let (a, b, c) = tokio::join!(
        indir("resim.png", 300),
        indir("veri.json", 100),
        indir("video.mp4", 200),
    );
    println!("{a}\\n{b}\\n{c}");
}
`,
  },
  {
    id: 'serde',
    name: 'json.rs',
    title: 'Serde JSON',
    description: 'struct ↔ JSON dönüşümü',
    code: `use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Ogrenci {
    ad: String,
    yas: u8,
    dersler: Vec<String>,
}

fn main() -> Result<(), serde_json::Error> {
    let ogrenci = Ogrenci {
        ad: "Ayşe".into(),
        yas: 21,
        dersler: vec!["Rust".into(), "Algoritmalar".into()],
    };

    let json = serde_json::to_string_pretty(&ogrenci)?;
    println!("{json}");

    let geri: Ogrenci = serde_json::from_str(&json)?;
    println!("{geri:?}");
    Ok(())
}
`,
  },
];

export const DEFAULT_CODE = TEMPLATES[0].code;
