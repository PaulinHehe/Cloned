#!/bin/bash

echo "Starting Docker services..."
docker-compose up -d --build

# --- Attendre les services essentiels ---

# 1. Attendre que la base de données MySQL soit prête (port 3306)
# Bien que l'API ait depends_on sur la DB, c'est une bonne pratique d'attendre le port aussi
echo "Waiting for MySQL database on localhost:3306..."
./wait-for-it.sh localhost:3306 --timeout=60 -- echo "MySQL DB is up!"
if [ $? -ne 0 ]; then
  echo "MySQL DB did not start in time. Please check Docker logs."
  exit 1
fi

# 2. Attendre que l'API Flask principale soit prête (port 5000)
echo "Waiting for Flask API on localhost:5000..."
./wait-for-it.sh localhost:5000 --timeout=180 -- echo "Flask API is up!"
if [ $? -ne 0 ]; then
  echo "Flask API did not start in time. Please check Docker logs."
  exit 1
fi

# 3. Attendre que la base de données TimescaleDB (PostgreSQL) soit prête (port 5432)
echo "Waiting for TimescaleDB on localhost:5432..."
./wait-for-it.sh localhost:5432 --timeout=60 -- echo "TimescaleDB is up!"
if [ $? -ne 0 ]; then
  echo "TimescaleDB did not start in time. Please check Docker logs."
  exit 1
fi

# 4. Attendre que l'API Archeologist soit prête (port 3000)
echo "Waiting for Archeologist API on localhost:3000..."
./wait-for-it.sh localhost:3000 --timeout=180 -- echo "Archeologist API is up!"
if [ $? -ne 0 ]; then
  echo "Archeologist API did not start in time. Please check Docker logs."
  exit 1
fi

# 5. Attendre que le Frontend soit prêt (port 4000)
# C'est la dernière étape avant d'ouvrir le navigateur
echo "Waiting for Frontend service on localhost:4000..."
./wait-for-it.sh localhost:4000 --timeout=180 -- echo "Frontend is up!"
if [ $? -ne 0 ]; then
  echo "Frontend did not start in time. Please check Docker logs."
  exit 1
fi

# --- Ouvrir le navigateur si tout est OK ---
if [ $? -eq 0 ]; then
  echo "Opening application in browser..."
  if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:4000
  elif command -v open > /dev/null; then
    open http://localhost:4000
  elif command -v start > /dev/null; then
    start "" "http://localhost:4000"
  else
    echo "Could not find a command to open the browser. Please open http://localhost:4000 manually."
  fi
else
  echo "Frontend did not start in time. Please check Docker logs."
fi

echo "Docker services are running in the background."