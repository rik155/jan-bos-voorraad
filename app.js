import os
from datetime import datetime
from io import BytesIO

import qrcode
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, create_engine, func, select
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

class Base(DeclarativeBase): pass
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
def health(): return {"status":"ok"}

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, q: str = "", category: str = "", low: int = 0):
    with Session(engine) as db:
        stmt = select(Product)
        if q:
            like=f"%{q}%"; stmt=stmt.where((Product.name.ilike(like))|(Product.article_number.ilike(like))|(Product.location.ilike(like)))
        if category: stmt=stmt.where(Product.category==category)
        if low: stmt=stmt.where(Product.stock<=Product.minimum_stock)
        products=list(db.scalars(stmt.order_by(Product.name)))
        categories=list(db.scalars(select(Product.category).where(Product.category!="").distinct().order_by(Product.category)))
        total=db.scalar(select(func.count(Product.id))) or 0
        low_count=db.scalar(select(func.count(Product.id)).where(Product.stock<=Product.minimum_stock)) or 0
        popular_ids=[r[0] for r in db.execute(select(StockMutation.product_id,func.count(StockMutation.id)).group_by(StockMutation.product_id).order_by(func.count(StockMutation.id).desc()).limit(6))]
        popular=[db.get(Product,i) for i in popular_ids]
        mutations=list(db.scalars(select(StockMutation).options(joinedload(StockMutation.product)).order_by(StockMutation.created_at.desc()).limit(8)))
    return templates.TemplateResponse("index.html",{"request":request,"products":products,"popular":popular,"categories":categories,"q":q,"selected_category":category,"low":low,"total_products":total,"low_count":low_count,"mutations":mutations})

@app.get("/product/{product_id}", response_class=HTMLResponse)
def product_page(request: Request, product_id: int):
    with Session(engine) as db:
        p=db.get(Product,product_id)
        if not p: raise HTTPException(404,"Product niet gevonden")
        history=list(db.scalars(select(StockMutation).where(StockMutation.product_id==product_id).order_by(StockMutation.created_at.desc()).limit(10)))
    return templates.TemplateResponse("product.html",{"request":request,"p":p,"history":history})

@app.get("/product/{product_id}/qr.png")
def product_qr(request: Request, product_id:int):
    with Session(engine) as db:
        p=db.get(Product,product_id)
        if not p: raise HTTPException(404,"Product niet gevonden")
    url=str(request.base_url).rstrip("/")+f"/product/{product_id}"
    img=qrcode.make(url); buf=BytesIO(); img.save(buf,format="PNG"); buf.seek(0)
    return StreamingResponse(buf,media_type="image/png",headers={"Content-Disposition":f'inline; filename="qr_product_{product_id}.png"'})

@app.post("/products")
def add_product(name:str=Form(...),article_number:str=Form(""),category:str=Form(""),unit:str=Form("stuks"),location:str=Form(""),stock:float=Form(0),minimum_stock:float=Form(0),notes:str=Form("")):
    if not name.strip(): raise HTTPException(400,"Productnaam ontbreekt")
    with Session(engine) as db:
        p=Product(name=name.strip(),article_number=article_number.strip(),category=category.strip(),unit=unit.strip() or "stuks",location=location.strip(),stock=stock,minimum_stock=minimum_stock,notes=notes.strip()); db.add(p); db.flush()
        if stock: db.add(StockMutation(product_id=p.id,change=stock,stock_after=stock,reason="Beginvoorraad",employee="Systeem"))
        db.commit()
    return RedirectResponse("/",303)

def change_stock(product_id:int, change:float, reason:str="Snel geboekt", employee:str=""):
    with Session(engine) as db:
        p=db.get(Product,product_id)
        if not p: raise HTTPException(404,"Product niet gevonden")
        if p.stock+change<0: raise HTTPException(400,"Onvoldoende voorraad")
        p.stock+=change; db.add(StockMutation(product_id=p.id,change=change,stock_after=p.stock,reason=reason.strip(),employee=employee.strip())); db.commit()

@app.post("/products/{product_id}/quick")
def quick(product_id:int, change:float=Form(...), return_to:str=Form("/")):
    change_stock(product_id,change)
    return RedirectResponse(return_to if return_to.startswith("/") else "/",303)

@app.post("/products/{product_id}/mutate")
def mutate(product_id:int,amount:float=Form(...),direction:str=Form(...),reason:str=Form(""),employee:str=Form(""),return_to:str=Form("/")):
    if amount<=0: raise HTTPException(400,"Aantal moet groter zijn dan nul")
    change_stock(product_id,amount if direction=="in" else -amount,reason,employee)
    return RedirectResponse(return_to if return_to.startswith("/") else "/",303)

@app.post("/products/{product_id}/edit")
def edit(product_id:int,name:str=Form(...),article_number:str=Form(""),category:str=Form(""),unit:str=Form("stuks"),location:str=Form(""),minimum_stock:float=Form(0),notes:str=Form("")):
    with Session(engine) as db:
        p=db.get(Product,product_id)
        if not p: raise HTTPException(404,"Product niet gevonden")
        p.name=name.strip();p.article_number=article_number.strip();p.category=category.strip();p.unit=unit.strip() or "stuks";p.location=location.strip();p.minimum_stock=minimum_stock;p.notes=notes.strip();db.commit()
    return RedirectResponse("/",303)

@app.post("/products/{product_id}/delete")
def delete(product_id:int):
    with Session(engine) as db:
        p=db.get(Product,product_id)
        if p: db.delete(p);db.commit()
    return RedirectResponse("/",303)

@app.get("/export.xlsx")
def export_excel():
    with Session(engine) as db: products=list(db.scalars(select(Product).order_by(Product.name)))
    wb=Workbook();ws=wb.active;ws.title="Voorraad";ws.append(["Jan Bos Voorraadoverzicht",datetime.now().strftime("%d-%m-%Y %H:%M")]);ws.append([])
    headers=["Product","Artikelnummer","Categorie","Voorraad","Eenheid","Minimum","Locatie","Status","Opmerking"];ws.append(headers)
    for c in ws[3]: c.font=Font(bold=True,color="FFFFFF");c.fill=PatternFill("solid",fgColor="173F5F");c.alignment=Alignment(horizontal="center")
    for p in products: ws.append([p.name,p.article_number,p.category,p.stock,p.unit,p.minimum_stock,p.location,"BESTELLEN" if p.stock<=p.minimum_stock else "OK",p.notes])
    for i,w in enumerate([30,18,18,12,12,12,16,14,35],1): ws.column_dimensions[chr(64+i)].width=w
    ws.freeze_panes="A4";buf=BytesIO();wb.save(buf);buf.seek(0)
    return StreamingResponse(buf,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":f'attachment; filename="voorraad_{datetime.now():%Y%m%d_%H%M}.xlsx"'})
