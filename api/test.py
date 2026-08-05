import urllib.request
import urllib.parse
import json

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n'
    'Content-Type: text/csv\r\n\r\n'
    'Company Name\r\nTest\r\n'
    f'--{boundary}\r\n'
    'Content-Disposition: form-data; name="resume"; filename="test.pdf"\r\n'
    'Content-Type: application/pdf\r\n\r\n'
    'PDF content\r\n'
    f'--{boundary}--\r\n'
)

req = urllib.request.Request('http://127.0.0.1:5000/api/upload')
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
try:
    response = urllib.request.urlopen(req, data=body.encode('utf-8'))
    print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
