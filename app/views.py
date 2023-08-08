from flask import Blueprint, render_template
from flask_login import login_required, current_user

views = Blueprint('views', __name__)

@views.route('/dashboard')
@login_required
def dashboard():
    return render_template("dashboard.html")

@views.route('/profile')
@login_required
def profile():
    return render_template("profile.html")