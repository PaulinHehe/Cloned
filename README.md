# Projet-GIT 

PROJET-GIT
├── backend/
        ├── app/
                ├── modules/
                ├── routes/
                ├── utils/
                ├── __init__.py
                ├── config.py
        ├── main.py
├── db_init/
├── node/
        ├── node_modules/
        ├── Dockerfile.node
        ├── server.js
        ├── package-lock.json
        ├── package.json
├── .env
├── docker-compose.yml
├── Dockerfile.flask
├── README.md
├── requirements.txt


PARAMETRAGE
Pour changer la config (notamment de la BDD) il faut build de nouveau 
l'application avec les nouveaux paramètres

Port par défaut de MySQL : 3306

On peut rajouter des paramètres supplémentaires dans .env

A. Parametres pour les container Docker
docker-compose.yml

B. Parametres sans container
config.py



LANCER L'APPLICATION
A. Depuis un container Docker
--> Build :
docker-compose up --build
--> Run :
docker run -p 5000:5000 flask-repo-analyzer

B. Sans container (il faudra avoir installé au préalable la BDD, les dépendances, etc)
--> Lancer :
python backend/main.py


