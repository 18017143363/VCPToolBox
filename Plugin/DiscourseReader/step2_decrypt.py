import sys, os, base64, json
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives import serialization

if len(sys.argv) < 2:
    print("Usage: python step2_decrypt.py <ciphertext>")
    sys.exit(1)

ciphertext = sys.argv[1].replace(' ', '').replace('\n', '')

script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, '_temp_private.pem'), 'rb') as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None)
with open(os.path.join(script_dir, '_temp_client_id.txt'), 'r') as f:
    client_id = f.read().strip()

decrypted = private_key.decrypt(base64.b64decode(ciphertext), asym_padding.PKCS1v15())
data = json.loads(decrypted)

print("API_KEY:", data.get("key"))
print("CLIENT_ID:", client_id)