from PIL import Image
import os

img = Image.open(r'E:\VCP\image\geminiimagegen\62903562-cc9a-4b87-8643-970c57b2e893.jpeg')
w, h = img.size
cw, ch = w // 2, h // 6
out = r'E:\VCP\image\geminiimagegen\cropped'
os.makedirs(out, exist_ok=True)
names = ['nurse','chef','detective','teacher','artist','astronaut','witch','scientist','pirate','idol','firefighter','ninja']
for i in range(12):
    col, row = i % 2, i // 2
    box = (col*cw, row*ch, (col+1)*cw, (row+1)*ch)
    img.crop(box).save(os.path.join(out, f'{names[i]}.png'))
    print(f'Saved {names[i]}.png')
print('Done!')