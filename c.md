#to configure backend

cd backend\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python wsgi.py


#to run backend

cd backend\backend
.venv\Scripts\Activate.ps1
python wsgi.py
