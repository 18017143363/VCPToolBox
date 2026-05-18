import base64, json
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives import serialization

with open('_temp_private.pem', 'rb') as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None)
with open('_temp_client_id.txt', 'r') as f:
    client_id = f.read().strip()

ciphertext = 'H6pkNMDhftHpJsKZP15aAfpJo76c9aIlAbk1XYh1cFtIoo9SK0ciyXHQ7VLQ Y+BIjR7nbl/9/jJBO2/wPiHHQkTd6hiX5thqBVewrHSdOb8JpF8AJdmhnGel cJiUzh0fIIdf/2Aimr6gzRYpWgqSbrF2LKSsGzpwXC0j3q4g8w088mg6pKOB C05EoBBGovm0+Z6CiEbVsjB2v1YzlvTNW6BCXeq5GTeR3tEI1Fhj4rhmM6wu 7putER0Rh2X4HPjxjonfVwrQfuY+ROPIGUD32MXsWlGpRVTRECgB+VOUsvQh XmoC7X1uEBkmMssmLZp/XfIdaOd/5sUePCMoLkfBcA=='
ciphertext = ciphertext.replace(' ', '').replace('\n', '')

decrypted = private_key.decrypt(base64.b64decode(ciphertext), asym_padding.PKCS1v15())
data = json.loads(decrypted)

print('API_KEY:', data.get('key'))
print('CLIENT_ID:', client_id)