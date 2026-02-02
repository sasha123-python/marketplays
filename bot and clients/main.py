
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from db import init_db, get_clients, delete_client, delete_by_id

app = FastAPI()

# HTML шаблони
templates = Jinja2Templates(directory=".")



# Ініціалізація БД
init_db()


# ---------------- LOGIN PAGE ----------------

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
def login_action(username: str = Form(...), password: str = Form(...)):
    if username == "admin" and password == "1239500":
        return RedirectResponse(url="/admin", status_code=302)
    return RedirectResponse(url="/login", status_code=302)


# ---------------- ADMIN PAGE ----------------

@app.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request, from_date: str = None, to_date: str = None):
    clients = get_clients(from_date, to_date)
    return templates.TemplateResponse("admin.html", {
        "request": request,
        "clients": clients
    })

@app.post("/admin/delete/{client_id}")
def delete_client(client_id: int):
    delete_by_id(client_id)
    return RedirectResponse(url="/admin", status_code=303)


# ---------------- DELETE RECORD ----------------

@app.get("/delete/{client_id}")
def delete_record(client_id: int):
    delete_client(client_id)
    return RedirectResponse(url="/admin", status_code=302)
