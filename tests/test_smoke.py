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

def test_backups_page():
    assert client.get('/backups').status_code == 200

def test_export_creates_backup_and_downloads():
    r = client.get('/export.xlsx')
    assert r.status_code == 200
    assert 'spreadsheetml' in r.headers.get('content-type', '')
    page = client.get('/backups')
    assert page.status_code == 200
    assert 'Jan_Bos_Voorraad_backup_' in page.text

def test_control_flow():
    # Create one uniquely named product with barcode.
    barcode = '9912345678901'
    client.post('/products', data={
        'name': 'V19 testproduct', 'article_number': 'V19', 'barcode': barcode,
        'category': '', 'unit': 'stuks', 'location': '', 'stock': '10', 'minimum_stock': '3'
    })
    r = client.post('/controle/start', follow_redirects=False)
    assert r.status_code == 303
    location = r.headers['location']
    assert location.startswith('/controle?session_id=')
    session_id = int(location.split('session_id=')[1])
    page = client.get(f'/controle?session_id={session_id}&barcode={barcode}')
    assert page.status_code == 200
    assert 'V19 testproduct' in page.text
    # Resolve product id via barcode API.
    product_id = client.get(f'/api/barcode/{barcode}').json()['id']
    r = client.post(f'/controle/{session_id}/count/{product_id}', data={'counted_stock': '8'}, follow_redirects=False)
    assert r.status_code == 303
    finish = client.post(f'/controle/{session_id}/finish', follow_redirects=False)
    assert finish.status_code == 303
    summary = client.get(f'/controle/{session_id}/samenvatting')
    assert summary.status_code == 200
    assert 'Controle afgerond' in summary.text

def test_daily_scan_take_with_note():
    barcode = '9923456789012'
    client.post('/products', data={
        'name': 'V20 uitgifteproduct', 'article_number': 'V20', 'barcode': barcode,
        'category': '', 'unit': 'stuks', 'location': '', 'stock': '20', 'minimum_stock': '2'
    })
    data = client.get(f'/api/barcode/{barcode}').json()
    assert data['found'] is True
    product_id = data['id']
    page = client.get(f'/product/{product_id}?mode=scan')
    assert page.status_code == 200
    assert 'Hoeveel pak je?' in page.text
    assert 'Opmerking' in page.text
    r = client.post(f'/products/{product_id}/take', data={'amount': '3', 'note': 'Project: Nijmegen'}, follow_redirects=False)
    assert r.status_code == 303
    assert r.headers['location'] == '/scan?saved=1'
    after = client.get(f'/api/barcode/{barcode}').json()
    assert after['stock'] == 17
