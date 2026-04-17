from PIL import Image
import os

img = Image.open(r"E:\VCP\image\geminiimagegen\8aad1ada-54ef-4c1a-ad8d-49ff6af474c3.jpeg")
w, h = img.size
cols, rows = 5, 3
cell_w = w // cols
cell_h = h // rows

output_dir = r"E:\VCP\image\geminiimagegen\cropped_spring"
os.makedirs(output_dir, exist_ok=True)

names = [
    "spring-smell-sakura",
    "spring-butterfly",
    "spring-flower-field",
    "spring-petal-twirl",
    "spring-bouquet-shy",
    "spring-reading-sakura",
    "spring-catch-petals",
    "spring-flower-crown",
    "spring-feed-bird",
    "spring-rain-dance",
    "spring-strawberry",
    "spring-kite",
    "spring-dandelion",
    "spring-sunset"
]

# Grid positions (row, col) - skip (2,2) which is the picnic with boy
positions = [
    (0,0),(0,1),(0,2),(0,3),(0,4),
    (1,0),(1,1),(1,2),(1,3),(1,4),
    (2,0),(2,1),
    (2,3),(2,4)
]

for i, (row, col) in enumerate(positions):
    left = col * cell_w
    top = row * cell_h
    right = left + cell_w
    bottom = top + cell_h
    cell = img.crop((left, top, right, bottom))
    cell.save(os.path.join(output_dir, f"{names[i]}.png"))
    print(f"Saved {names[i]}.png ({cell.size})")

print(f"Done! {len(names)} stickers saved to {output_dir}")