from flask import Flask
from flask_restful import Api, Resource
from .config import Config
from .routes.groups import GroupsAPI
from .routes.analysis import AnalysisAPI  
from .routes.students import StudentsAPI
from flask_cors import CORS
from .routes.repositories_groups import GroupRepositoriesAPI
from .routes.repositories_students import StudentRepositoriesAPI
from .utils.dir_manager import DirManager
from .utils.json_to_db import JSONToDB
from .routes.stats import StatsAPI
from .routes.audit import AuditAPI
import logging
import sys

def create_app():
    """Initialise l'application Flask avec ses routes et configurations."""
    app = Flask(__name__)
    CORS(app) 
    """CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})"""
    app.config.from_object(Config)

    # Initialisation de l'API
    api = Api(app)

    # Vérifie si l'application est en mode débogage
    if app.debug:
        app.logger.setLevel(logging.DEBUG)
        # Ensure a StreamHandler is added for console output in debug mode
        if not any(isinstance(handler, logging.StreamHandler) for handler in app.logger.handlers):
            stream_handler = logging.StreamHandler(sys.stdout)
            stream_handler.setLevel(logging.DEBUG)
            formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
            stream_handler.setFormatter(formatter)
            app.logger.addHandler(stream_handler)

    # Ajout des routes API
    api.add_resource(GroupsAPI, '/api/groups', '/api/groups/<int:gr_id>')
    api.add_resource(StudentsAPI, '/api/students', '/api/students/<int:st_id>')
    api.add_resource(AnalysisAPI, '/api/analyze')
    api.add_resource(DirManager, '/api/clone')
    api.add_resource(StatsAPI, '/api/stats')
    api.add_resource(GroupRepositoriesAPI, '/api/groups/<int:group_id>/repositories')
    api.add_resource(StudentRepositoriesAPI, '/api/students/<int:student_id>/repositories')
    api.add_resource(AuditAPI, '/api/audit')

    with app.app_context():
        if JSONToDB.import_json_data():
            app.logger.info("Data imported successfully!") # Use app.logger for Flask context
        else:
            app.logger.error("Data import failed.") # Use app.logger for Flask context
    
    return app
