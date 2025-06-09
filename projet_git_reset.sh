#!/bin/bash
echo "Shutting down containers and wiping volumes"
docker compose down      
docker volume rm projet-git_repo-data
docker volume rm projet-git_archeologist-data
docker volume rm projet-git_mysql-data
docker volume ls