from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets" / "realistic"
OUT.mkdir(parents=True, exist_ok=True)

random.seed(42)


def grain(img: Image.Image, intensity: int = 20) -> Image.Image:
    noise = Image.effect_noise(img.size, intensity).convert("L")
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, noise_rgb, 0.15)


def base_scene(size=(1600, 900), top=(18, 26, 37), bottom=(8, 12, 18)):
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def label(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, fill=(210, 232, 240)):
    draw.text((x, y), text, fill=fill)


def save_jpg(name: str, img: Image.Image):
    img = grain(img).filter(ImageFilter.GaussianBlur(0.4))
    img.save(OUT / name, format="JPEG", quality=90)


def save_png(name: str, img: Image.Image):
    img = grain(img, 14)
    img.save(OUT / name, format="PNG")


def truck_arrival(name: str, plate: str):
    img = base_scene()
    d = ImageDraw.Draw(img)
    d.rectangle((60, 650, 1540, 860), fill=(25, 34, 46))
    d.rectangle((180, 440, 1220, 700), fill=(30, 44, 62), outline=(80, 120, 150), width=2)
    d.rectangle((220, 360, 620, 520), fill=(26, 54, 68), outline=(98, 160, 180), width=2)
    d.ellipse((300, 680, 410, 790), fill=(10, 14, 20))
    d.ellipse((880, 680, 990, 790), fill=(10, 14, 20))
    d.rectangle((680, 470, 1120, 560), fill=(240, 245, 230))
    label(d, plate, 760, 500, (25, 35, 45))
    label(d, "Arrival Camera / Gate-03", 80, 60)
    label(d, "TEMP STAGING ASSET (CC0)", 1250, 40, (120, 160, 180))
    save_jpg(name, img)


def weighbridge(name: str, gross: float, tare: float):
    img = base_scene(top=(14, 25, 30), bottom=(7, 14, 18))
    d = ImageDraw.Draw(img)
    d.rectangle((120, 180, 1480, 760), fill=(14, 26, 34), outline=(70, 120, 130), width=2)
    d.rectangle((260, 360, 1340, 620), fill=(18, 34, 42), outline=(90, 145, 150), width=2)
    net = gross - tare
    label(d, "Weighbridge Cam / Scale-A", 90, 70)
    label(d, f"Gross {gross:.2f} t   Tare {tare:.2f} t   Net {net:.2f} t", 340, 670)
    label(d, "TEMP STAGING ASSET (CC0)", 1240, 40, (120, 160, 180))
    save_jpg(name, img)


def unloading(name: str):
    img = base_scene(top=(20, 22, 28), bottom=(9, 12, 16))
    d = ImageDraw.Draw(img)
    d.rectangle((90, 170, 1510, 780), fill=(18, 24, 30), outline=(70, 95, 110), width=2)
    d.polygon([(260, 530), (760, 530), (650, 730), (320, 730)], fill=(37, 52, 62))
    d.rectangle((800, 460, 1320, 650), fill=(26, 42, 50), outline=(95, 130, 145), width=2)
    label(d, "Unloading Camera / Hopper-02", 90, 70)
    label(d, "TEMP STAGING ASSET (CC0)", 1240, 40, (120, 160, 180))
    save_jpg(name, img)


def invoice(name: str, invoice_id: str, supplier: str):
    img = Image.new("RGB", (1200, 1500), (245, 247, 246))
    d = ImageDraw.Draw(img)
    d.rectangle((70, 60, 1130, 1440), fill=(252, 252, 251), outline=(130, 140, 145), width=2)
    d.rectangle((110, 120, 1080, 250), fill=(18, 28, 42))
    label(d, "INFRA DELIVERY INVOICE", 140, 170, (220, 235, 240))
    label(d, f"Invoice: {invoice_id}", 120, 320, (20, 30, 40))
    label(d, f"Supplier: {supplier}", 120, 360, (20, 30, 40))
    y = 460
    for i in range(7):
        d.rectangle((120, y, 1080, y + 70), outline=(160, 170, 175), width=1)
        label(d, f"Line {i+1}  Material Lot  Qty {round(8 + random.random()*20,2)} t", 140, y + 24, (40, 50, 60))
        y += 92
    label(d, "TEMP STAGING ASSET (CC0)", 820, 1420, (120, 130, 140))
    save_png(name, img)


def anpr(name: str, plate: str, conf: float):
    img = Image.new("RGB", (1280, 720), (8, 12, 20))
    d = ImageDraw.Draw(img)
    d.rectangle((80, 80, 1200, 640), outline=(60, 100, 120), width=2)
    d.rectangle((420, 280, 860, 370), fill=(230, 236, 220))
    label(d, plate, 520, 312, (20, 30, 35))
    label(d, "ANPR Capture / Gate Lane 2", 90, 42, (195, 225, 238))
    label(d, f"Confidence {conf:.2f}", 980, 680, (160, 190, 205))
    label(d, "TEMP STAGING ASSET (CC0)", 890, 40, (120, 160, 180))
    save_jpg(name, img)


def industrial(name: str):
    img = base_scene(top=(16, 20, 24), bottom=(6, 8, 12))
    d = ImageDraw.Draw(img)
    d.rectangle((100, 150, 1500, 790), fill=(15, 19, 24), outline=(70, 90, 100), width=2)
    for x in range(180, 1480, 180):
        d.rectangle((x, 220, x + 70, 720), fill=(22, 30, 36))
    label(d, "Industrial Checkpoint / Crushing Plant", 90, 70)
    label(d, "TEMP STAGING ASSET (CC0)", 1240, 40, (120, 160, 180))
    save_jpg(name, img)


truck_arrival("truck-arrival-1.jpg", "TN-45-AB6789")
truck_arrival("truck-arrival-2.jpg", "TN-87-XZ2345")
truck_arrival("truck-arrival-3.jpg", "TN-12-XY9876")
weighbridge("weighbridge-1.jpg", 28.5, 2.1)
weighbridge("weighbridge-2.jpg", 31.2, 2.6)
unloading("unloading-1.jpg")
unloading("unloading-2.jpg")
invoice("invoice-1.png", "INV-26045-54321", "Narayana Sand Co.")
invoice("invoice-2.png", "INV-26045-67890", "Karan Bricks")
anpr("anpr-1.jpg", "TN-45-AB6789", 0.94)
anpr("anpr-2.jpg", "TN-87-XZ2345", 0.91)
industrial("industrial-checkpoint-1.jpg")
industrial("industrial-checkpoint-2.jpg")

print(f"Generated raster staging assets in {OUT}")
