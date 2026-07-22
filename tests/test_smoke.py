import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_inventory_flow():
    response = client.post(
        "/products",
        data={"name": "Kit wit", "stock": "10", "minimum_stock": "3", "unit": "kokers"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    page = client.get("/")
    assert page.status_code == 200
    assert "Kit wit" in page.text
    assert client.get("/export.xlsx").status_code == 200
    assert client.get("/product/1/qr.png").status_code == 200
