import os, json
from secrets import token_urlsafe
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from urllib.parse import urlencode

host = "https://linux.do"
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_key = private_key.public_key()
pub_pem = public_key.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
client_id = token_urlsafe()

# Save for step2
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, '_temp_private.pem'), 'wb') as f:
    f.write(private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
with open(os.path.join(script_dir, '_temp_client_id.txt'), 'w') as f:
    f.write(client_id)

query = urlencode({"application_name": "DiscourseReader", "client_id": client_id, "scopes": "read,write", "public_key": pub_pem, "nonce": "1"})
url = host + "/user-api-key/new?" + query

print("CLIENT_ID:", client_id)
print()
print("AUTH_URL:", url)
print()
print("Open the URL in browser, click Authorize, copy the encrypted key, then run step2.")