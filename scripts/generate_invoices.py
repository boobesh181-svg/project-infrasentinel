#!/usr/bin/env python3
import os
import random
import hashlib
import json
import sys
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps


OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'assets', 'realistic', 'generated_invoices')
OUT_DIR = os.path.normpath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

SUPPLIERS = [
    "Narayana Sand Co.",
    "Titan Steel Pvt Ltd",
    "Acme Aggregates",
    "Gita Crushers",
    "Karan Bricks & Co",
    "Eastern Logistics",
    "Delta Materials",
]

def GST_NUM():
    return f"{random.randint(10,99)}{random.randint(10**9,10**10-1)}"

PAGE_W, PAGE_H = 1400, 1800

try:
    FONT_REGULAR = ImageFont.truetype("arial.ttf", 22)
    FONT_BOLD = ImageFont.truetype("arialbd.ttf", 26)
    FONT_MONO = ImageFont.truetype("consola.ttf", 18)
except Exception:
    FONT_REGULAR = ImageFont.load_default()
    FONT_BOLD = ImageFont.load_default()
    FONT_MONO = ImageFont.load_default()


def rand_date():
    base = datetime.now() - timedelta(days=random.randint(0, 30))
    return base - timedelta(hours=random.randint(0, 12), minutes=random.randint(0, 59))


def add_grain(img):
    w, h = img.size
    noise = Image.effect_noise((w, h), random.uniform(80, 180)).convert('L')
    noise = noise.point(lambda p: p * 0.06)
    noise = noise.filter(ImageFilter.GaussianBlur(0.8))
    overlay = ImageOps.colorize(noise, (255,255,255), (245,245,240))
    return Image.blend(img, overlay, random.uniform(0.06, 0.14))


def add_fold(img):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    y = random.randint(int(h*0.38), int(h*0.62))
    draw.line([(0,y),(w,y)], fill=(230,230,230), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.2))


def stamped(draw, x, y, text):
    r = 56
    draw.ellipse((x-r, y-r, x+r, y+r), outline=(160,20,20), width=6)
    draw.text((x-38, y-12), text, fill=(160,20,20), font=FONT_BOLD)


def generate_invoice(idx):
    supplier = random.choice(SUPPLIERS)
    inv_id = f"INV-{datetime.now().year % 100}-{random.randint(10000,99999)}-{idx}"
    date = rand_date()
    material = random.choice(["Cement", "Aggregate", "Steel", "Sand", "Bricks"])
    qty = round(random.uniform(8, 30) + random.random(), 2)
    invoice_filename = f"invoice-{idx:03d}.png"
    path = os.path.join(OUT_DIR, invoice_filename)

    base = Image.new('RGB', (PAGE_W, PAGE_H), color=(250,250,245))
    draw = ImageDraw.Draw(base)

    # header
    draw.rectangle((40, 40, PAGE_W-40, 200), fill=(245,245,240))
    logo_x, logo_y = 60, 60
    draw.rectangle((logo_x, logo_y, logo_x+260, logo_y+100), fill=(30,30,30))
    draw.text((logo_x+14, logo_y+22), supplier, font=FONT_BOLD, fill=(255,255,255))
    draw.text((logo_x+14, logo_y+60), f"GSTIN: {GST_NUM()}", font=FONT_REGULAR, fill=(200,200,200))

    draw.text((PAGE_W-420, 70), "INVOICE", font=FONT_BOLD, fill=(20,20,20))
    draw.text((PAGE_W-420, 110), f"Invoice No: {inv_id}", font=FONT_REGULAR, fill=(40,40,40))
    draw.text((PAGE_W-420, 140), f"Date: {date.strftime('%Y-%m-%d %H:%M')}", font=FONT_REGULAR, fill=(40,40,40))

    # billing block
    draw.rectangle((60, 220, PAGE_W-60, 480), outline=(220,220,215), width=1)
    draw.text((80, 240), f"Bill To: {supplier}", font=FONT_REGULAR, fill=(30,30,30))
    draw.text((80, 280), f"Project: {random.choice(['Eastern Corridor', 'Ring Expressway', 'Delta Port Road'])}", font=FONT_REGULAR, fill=(60,60,60))
    draw.text((80, 320), f"Weighbridge Ref: WB-{random.randint(1000,9999)}", font=FONT_REGULAR, fill=(60,60,60))

    # items table
    table_y = 520
    draw.rectangle((60, table_y, PAGE_W-60, table_y+220), outline=(210,210,200), width=1)
    cols = [80, 320, 820, 980, 1100]
    headers = ["S.No", "Description", "Qty", "Unit", "Remarks"]
    for i, h in enumerate(headers):
        x = cols[i]
        draw.text((x, table_y+12), h, font=FONT_BOLD, fill=(30,30,30))
    draw.text((cols[0], table_y+64), "1", font=FONT_REGULAR, fill=(40,40,40))
    draw.text((cols[1], table_y+64), f"{material} - delivered to site", font=FONT_REGULAR, fill=(40,40,40))
    draw.text((cols[2], table_y+64), str(qty), font=FONT_REGULAR, fill=(40,40,40))
    draw.text((cols[3], table_y+64), "T", font=FONT_REGULAR, fill=(40,40,40))
    draw.text((cols[4], table_y+64), f"WB-{random.randint(10000,99999)}", font=FONT_REGULAR, fill=(60,60,60))

    # footer details
    draw.text((80, table_y+150), f"Transport: Truck / Driver: {random.choice(['RK', 'SS', 'MN'])} / Vehicle: TN-{random.randint(10,99)}-AB{random.randint(1000,9999)}", font=FONT_REGULAR, fill=(60,60,60))
    draw.text((80, table_y+180), f"Payment Terms: {random.choice(['COD', '30 days', 'Immediate'])}", font=FONT_REGULAR, fill=(60,60,60))

    # add stamp, stains, folds
    if random.random() > 0.4:
        stamped(draw, PAGE_W-200, PAGE_H-500, "PAID")
    base = add_grain(base)
    if random.random() > 0.3:
        base = add_fold(base)

    # slight perspective / blur to mimic mobile photo
    if random.random() > 0.5:
        base = base.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 1.2)))

    # apply basic imperfections
    base = add_grain(base)

    # return image and metadata for further post-processing
    return base, {'path': path, 'name': invoice_filename, 'supplier': supplier, 'invoice_id': inv_id, 'date': date.isoformat(), 'qty': qty}


def main(count=1):
    # allow optional preset argument
    import sys
    preset = None
    if len(sys.argv) > 2:
        preset = sys.argv[2]
    count = int(count)
    manifest = []
    for i in range(count):
        img, meta = generate_invoice(i+1)

        # choose preset
        chosen = preset or random.choice(['clean_scan','mobile_daylight','mobile_lowlight','photocopy','whatsapp','folded'])
        img = apply_preset(img, chosen)

        # optionally add handwritten marks
        if random.random() > 0.4:
            img = add_handwritten_marks(img)

        # save with compression/quality according to preset
        final_path = os.path.join(OUT_DIR, meta['name'])
        if chosen in ('whatsapp','mobile_lowlight'):
            # simulate mobile compression
            tmp = final_path + '.jpg'
            img.convert('RGB').save(tmp, format='JPEG', quality=random.randint(45,75))
            # reopen and save PNG to keep consistent references
            img = Image.open(tmp).convert('RGB')
            img.save(final_path, format='PNG', optimize=True)
            try:
                os.remove(tmp)
            except Exception:
                pass
        elif chosen == 'photocopy':
            img = img.convert('L').convert('RGB')
            img = ImageOps.autocontrast(img, cutoff=3)
            img.save(final_path, format='PNG', optimize=True)
        else:
            img.save(final_path, format='PNG', optimize=True)

        # hash and OCR metadata
        h = hashlib.sha256()
        with open(final_path, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                h.update(chunk)

        ocr = generate_ocr_meta(meta)

        entry = {'file': final_path, 'name': meta['name'], 'hash': h.hexdigest(), 'supplier': meta['supplier'], 'invoice_id': meta['invoice_id'], 'date': meta['date'], 'preset': chosen, 'ocr': ocr}
        manifest.append(entry)
        print('generated', final_path)

    manifest_path = os.path.join(OUT_DIR, 'manifest.json')
    with open(manifest_path, 'w') as mf:
        json.dump(manifest, mf, indent=2)
    print('manifest written to', manifest_path)


def apply_preset(img, preset_name):
    # apply perspective, lighting, vignettes based on preset
    w, h = img.size
    if preset_name == 'mobile_lowlight':
        img = uneven_exposure(img, strength=0.45)
        img = perspective_warp(img, max_shift=0.04)
        img = add_desk_shadow(img)
        img = img.filter(ImageFilter.GaussianBlur(0.6))
    elif preset_name == 'mobile_daylight':
        img = uneven_exposure(img, strength=0.18)
        img = perspective_warp(img, max_shift=0.02)
        img = add_desk_shadow(img, opacity=0.15)
    elif preset_name == 'photocopy':
        img = ImageOps.grayscale(img).filter(ImageFilter.GaussianBlur(0.3))
        img = ImageOps.autocontrast(img, cutoff=2)
    elif preset_name == 'whatsapp':
        img = uneven_exposure(img, strength=0.3)
        img = perspective_warp(img, max_shift=0.03)
    elif preset_name == 'folded':
        img = add_fold(img)
        img = perspective_warp(img, max_shift=0.02)
    else:
        # clean_scan
        img = uneven_exposure(img, strength=0.06)
    return img


def perspective_warp(img, max_shift=0.03):
    w, h = img.size
    shift = lambda v: v + random.uniform(-max_shift, max_shift)
    # source quad
    src = [(0,0),(w,0),(w,h),(0,h)]
    # dest quad perturbed
    dst = [(int(w*shift(0.0)), int(h*shift(0.0))), (int(w*shift(1.0)), int(h*shift(0.0))), (int(w*shift(1.0)), int(h*shift(1.0))), (int(w*shift(0.0)), int(h*shift(1.0)))]
    coeffs = find_perspective_coeffs(src, dst)
    return img.transform((w,h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)


def find_perspective_coeffs(pa, pb):
    # pa and pb are lists of four (x,y) pairs
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0]*p1[0], -p2[0]*p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1]*p1[0], -p2[1]*p1[1]])
    A = matrix
    B = [p for point in pb for p in point]
    try:
        import numpy as np
        A = np.array(A)
        B = np.array(B)
        res = np.linalg.lstsq(A, B, rcond=None)[0]
        return res.tolist()
    except Exception:
        # fallback identity
        return [1,0,0,0,1,0,0,0]


def uneven_exposure(img, strength=0.25):
    w, h = img.size
    overlay = Image.new('RGB', (w,h), (0,0,0))
    mask = Image.new('L', (w,h), 0)
    draw = ImageDraw.Draw(mask)
    # radial gradient
    maxr = max(w,h)
    draw.ellipse((-int(w*0.2), -int(h*0.2), w+int(w*0.2), h+int(h*0.2)), fill=int(255*strength))
    mask = mask.filter(ImageFilter.GaussianBlur(int(maxr*0.25)))
    return Image.composite(img, overlay, mask)


def add_desk_shadow(img, opacity=0.28):
    w, h = img.size
    shadow = Image.new('RGBA', (w,h), (0,0,0,0))
    draw = ImageDraw.Draw(shadow)
    # polygon shadow at top-left
    poly = [(0,0),(int(w*0.25), int(h*0.05)), (int(w*0.6), int(h*0.2)), (0,int(h*0.15))]
    draw.polygon(poly, fill=(0,0,0,int(255*opacity)))
    return Image.alpha_composite(img.convert('RGBA'), shadow).convert('RGB')


def add_handwritten_marks(img):
    img = img.convert('RGB')
    draw = ImageDraw.Draw(img)
    w, h = img.size
    # small handwritten ticks near qty
    for _ in range(random.randint(1,3)):
        x = random.randint(int(w*0.6), int(w*0.85))
        y = random.randint(int(h*0.6), int(h*0.8))
        points = [(x + random.randint(-10,10), y + random.randint(-4,4)) for _ in range(6)]
        draw.line(points, fill=(10,10,10), width=random.randint(2,4))
    return img


def generate_ocr_meta(meta):
    # synthetic OCR extraction with confidence values
    supplier = meta['supplier']
    invoice_id = meta['invoice_id']
    qty = meta.get('qty', None)
    ocr = {
        'supplier': {'text': supplier, 'confidence': round(random.uniform(0.85,0.99),2)},
        'invoice_id': {'text': invoice_id, 'confidence': round(random.uniform(0.8,0.98),2)},
        'quantity': {'text': str(qty), 'confidence': round(random.uniform(0.75,0.97),2)}
    }
    return ocr


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else '1'
    main(arg)