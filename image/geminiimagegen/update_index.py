import codecs
path = r'E:\VCPCHAT\AppData\generated_lists\Rosa表情包.txt'
with open(path, 'r', encoding='utf-8') as f:
    old = f.read()
new_items = '|cosplay-nurse.png|cosplay-chef.png|cosplay-detective.png|cosplay-teacher.png|cosplay-artist.png|cosplay-astronaut.png|cosplay-witch.png|cosplay-scientist.png|cosplay-pirate.png|cosplay-idol.png|cosplay-firefighter.png|cosplay-ninja.png'
with open(path, 'w', encoding='utf-8') as f:
    f.write(old + new_items)
print('Done! Index updated.')