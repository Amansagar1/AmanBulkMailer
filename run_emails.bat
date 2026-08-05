@echo off
echo Starting AmanMail Backend (Flask)...
cd backend
start "AmanMail Backend" cmd /k "python app.py"
cd ..

echo Starting AmanMail Frontend (Next.js)...
cd frontend
start "AmanMail Frontend" cmd /k "npm run dev"

echo Both servers are starting up! 
echo The frontend will be available at http://localhost:3000
