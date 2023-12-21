from flask import Flask
from flask_mysqldb import MySQL
from flask_login import LoginManager
from flask_socketio import SocketIO
from .models import User
from .config import MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB, SECRET_KEY

app = Flask(__name__)
app.config.from_object(config)

#Configurates server and database

app.config["MYSQL_HOST"] = MYSQL_HOST
app.config["MYSQL_USER"] = MYSQL_USER
app.config["MYSQL_PASSWORD"] = MYSQL_PASSWORD
app.config["MYSQL_DB"] = MYSQL_DB
app.config["SECRET_KEY"] = SECRET_KEY

#Connects server to database
try:
    mysql = MySQL(app)
except Exception as e:
    print("Error connecting to the database:", e)
    # Add better error handling here


#Websockets

socketio = SocketIO(app, async_mode="threading")

@socketio.on('connect')
def handle_connect():
    # Handle a new WebSocket connection
    pass

@socketio.on('message')
def handle_message(message):
    # Handle incoming messages from clients
    pass

from .views import views
from .auth import auth

app.register_blueprint(views, url_prefix='/')
app.register_blueprint(auth, url_prefix='/')

login_manager = LoginManager(app)
login_manager.login_view = "auth.login"

#Loads user from database into User object
@login_manager.user_loader
def loadUser(userID):
    conn = mysql.connection
    cursor = conn.cursor()

    sql = "SELECT * FROM users WHERE UserID = %s"
    cursor.execute(sql, (userID,))
    user = cursor.fetchone()

    cursor.close()

    if user:
        return User(*user)
    else:
        return None


mysql = MySQL()