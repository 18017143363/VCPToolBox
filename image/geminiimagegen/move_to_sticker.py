import shutil, os
src = r'E:\VCP\image\geminiimagegen\cropped'
dst = r'E:\VCP\image\Rosa表情包'
names = ['nurse','chef','detective','teacher','artist','astronaut','witch','scientist','pirate','idol','firefighter','ninja']
for n in names:
    shutil.copy2(os.path.join(src, f'{n}.png'), os.path.join(dst, f'cosplay-{n}.png'))
    print(f'Copied cosplay-{n}.png')
print('Done!')