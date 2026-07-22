import os, tempfile
os.environ['DATABASE_URL'] = 'sqlite:///' + tempfile.mktemp(suffix='.db')
from fastapi.testclient import TestClient
from app.main import app
c=TestClient(app)
def test_health(): assert c.get('/health').json()=={'status':'ok'}
def test_add_and_export():
    r=c.post('/products',data={'name':'Kit wit','stock':'10','minimum_stock':'3','unit':'stuks'},follow_redirects=False)
    assert r.status_code==303
    assert 'Kit wit' in c.get('/').text
    assert c.get('/export.xlsx').status_code==200
