import os
from datetime import datetime
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, joinedload, mapped_column, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/voorraad.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if DATABASE_URL.startswith("sqlite"):
    os.makedirs("data", exist_ok=True)
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

class Base(DeclarativeBase):
    pass

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    article_number: Mapped[str] = mapped_column(String(100), default="", index=True)
    category: Mapped[str] = mapped_column(String(100), default="")
    unit: Mapped[str] = mapped_column(String(40), default="stuks")
    location: Mapped[str] = mapped_column(String(100), default="")
    stock: Mapped[float] = mapped_column(Float, default=0)
    minimum_stock: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    mutations: Mapped[list["StockMutation"]] = relationship(back_populates="product", cascade="all, delete-orphan")

class StockMutation(Base):
    __tablename__ = "stock_mutations"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    change: Mapped[float] = mapped_column(Float)
    stock_after: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(200), default="")
    employee: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    product: Mapped[Product] = relationship(back_populates="mutations")

Base.metadata.create_all(engine)

app = FastAPI(title="Jan Bos Voorraad")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, q: str = "", category: str = "", low: int = 0):
    with Session(engine) as db:
        stmt = select(Product)
        if q:
            like = f"%{q}%"
            stmt = stmt.where((Product.name.ilike(like)) | (Product.article_number.ilike(like)) | (Product.location.ilike(like)))
        if category:
            stmt = stmt.where(Product.category == category)
        if low:
            stmt = stmt.where(Product.stock <= Product.minimum_stock)
        products = list(db.scalars(stmt.order_by(Product.name)))
        categories = [x for x in db.scalars(select(Product.category).where(Product.category != "").distinct().order_by(Product.category))]
        total_products = db.scalar(select(func.count(Product.id))) or 0
        low_count = db.scalar(select(func.count(Product.id)).where(Product.stock <= Product.minimum_stock)) or 0
        mutations = list(db.scalars(select(StockMutation).options(joinedload(StockMutation.product)).order_by(StockMutation.created_at.desc()).limit(12)))
    return templates.TemplateResponse("index.html", {
        "request": request, "products": products, "categories": categories, "q": q,
        "selected_category": category, "low": low, "total_products": total_products,
        "low_count": low_count, "mutations": mutations
    })

@app.post("/products")
def add_product(
    name: str = Form(...), article_number: str = Form(""), category: str = Form(""),
    unit: str = Form("stuks"), location: str = Form(""), stock: float = Form(0),
    minimum_stock: float = Form(0), notes: str = Form("")
):
    name = name.strip()
    if not name:
        raise HTTPException(400, "Productnaam ontbreekt")
    with Session(engine) as db:
        p = Product(name=name, article_number=article_number.strip(), category=category.strip(), unit=unit.strip() or "stuks", location=location.strip(), stock=stock, minimum_stock=minimum_stock, notes=notes.strip())
        db.add(p)
        db.flush()
        if stock:
            db.add(StockMutation(product_id=p.id, change=stock, stock_after=stock, reason="Beginvoorraad", employee="Systeem"))
        db.commit()
    return RedirectResponse("/", status_code=303)

@app.post("/products/{product_id}/mutate")
def mutate_stock(product_id: int, amount: float = Form(...), direction: str = Form(...), reason: str = Form(""), employee: str = Form("")):
    if amount <= 0:
        raise HTTPException(400, "Aantal moet groter zijn dan nul")
    change = amount if direction == "in" else -amount
    with Session(engine) as db:
        p = db.get(Product, product_id)
        if not p:
            raise HTTPException(404, "Product niet gevonden")
        if p.stock + change < 0:
            raise HTTPException(400, "Onvoldoende voorraad")
        p.stock += change
        db.add(StockMutation(product_id=p.id, change=change, stock_after=p.stock, reason=reason.strip(), employee=employee.strip()))
        db.commit()
    return RedirectResponse("/", status_code=303)

@app.post("/products/{product_id}/edit")
def edit_product(product_id: int, name: str = Form(...), article_number: str = Form(""), category: str = Form(""), unit: str = Form("stuks"), location: str = Form(""), minimum_stock: float = Form(0), notes: str = Form("")):
    with Session(engine) as db:
        p = db.get(Product, product_id)
        if not p:
            raise HTTPException(404, "Product niet gevonden")
        p.name = name.strip(); p.article_number = article_number.strip(); p.category = category.strip(); p.unit = unit.strip() or "stuks"; p.location = location.strip(); p.minimum_stock = minimum_stock; p.notes = notes.strip()
        db.commit()
    return RedirectResponse("/", status_code=303)

@app.post("/products/{product_id}/delete")
def delete_product(product_id: int):
    with Session(engine) as db:
        p = db.get(Product, product_id)
        if p:
            db.delete(p); db.commit()
    return RedirectResponse("/", status_code=303)

@app.get("/export.xlsx")
def export_excel():
    with Session(engine) as db:
        products = list(db.scalars(select(Product).order_by(Product.name)))
    wb = Workbook(); ws = wb.active; ws.title = "Voorraad"
    ws.append(["Jan Bos Voorraadoverzicht", datetime.now().strftime("%d-%m-%Y %H:%M")])
    ws.append([])
    headers = ["Product", "Artikelnummer", "Categorie", "Voorraad", "Eenheid", "Minimum", "Locatie", "Status", "Opmerking"]
    ws.append(headers)
    for c in ws[3]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="173F5F"); c.alignment = Alignment(horizontal="center")
    for p in products:
        status = "BESTELLEN" if p.stock <= p.minimum_stock else "OK"
        ws.append([p.name, p.article_number, p.category, p.stock, p.unit, p.minimum_stock, p.location, status, p.notes])
    widths = [30, 18, 18, 12, 12, 12, 16, 14, 35]
    for i, width in enumerate(widths, 1): ws.column_dimensions[chr(64+i)].width = width
    ws.freeze_panes = "A4"
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    filename = f"voorraad_{datetime.now():%Y%m%d_%H%M}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
