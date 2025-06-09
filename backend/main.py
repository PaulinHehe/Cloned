 # Lancement du serveur  


from app import create_app
app = create_app()

print("| DB_NAME =", app.config["DB_NAME"])
print("| DB_HOST =", app.config["DB_HOST"])                   
print("| DB_PORT =", app.config["DB_PORT"])

if __name__ == '__main__':
    # Activation du mode débogage avec la dernière version de Flask
    app.run(debug=True, host='0.0.0.0', port=5000)

