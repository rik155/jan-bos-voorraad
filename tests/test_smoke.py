import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import os
os.environ['DATABASE_URL'] = 'sqlite:///./data/test_voorraad.db'
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'

def test_pages():
    assert client.get('/').status_code == 200
    assert client.get('/inventarisatie').status_code == 200
    assert client.get('/scan').status_code == 200

def test_unknown_barcode():
    r = client.get('/api/barcode/9999999999999')
    assert r.status_code == 200
    assert r.json()['found'] is False
