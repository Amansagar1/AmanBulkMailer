from flask import Flask, request, jsonify, Response
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
import os
import json
import uuid
import datetime
from main import process_uploaded_file, campaigns_col, logs_col, users_col, sessions_col

app = Flask(__name__)
CORS(app)

import tempfile
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
    file.save(file_path)

    resume_path = None
    if 'resume' in request.files:
        resume_file = request.files['resume']
        if resume_file.filename != '':
            resume_filename = secure_filename(resume_file.filename)
            resume_path = os.path.join(app.config['UPLOAD_FOLDER'], resume_filename)
            resume_file.save(resume_path)

    # Save templates if provided
    subject_template = request.form.get('subjectTemplate')
    body_template = request.form.get('bodyTemplate')
    sender_email = request.form.get('senderEmail')
    sender_password = request.form.get('senderPassword')
    template_path = None
    
    if subject_template and body_template:
        template_id = str(uuid.uuid4())
        template_path = os.path.join(app.config['UPLOAD_FOLDER'], f"template_{template_id}.json")
        with open(template_path, 'w') as f:
            json.dump({
                "subject": subject_template,
                "body": body_template,
                "sender_email": sender_email,
                "sender_password": sender_password
            }, f)

    return jsonify({
        "message": "Files successfully uploaded", 
        "filePath": file_path,
        "resumePath": resume_path,
        "templatePath": template_path
    }), 200

@app.route('/api/process', methods=['GET'])
def process():
    file_path = request.args.get('filePath')
    resume_path = request.args.get('resumePath')
    template_path = request.args.get('templatePath')
    
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 400

    subject_template = None
    body_template = None
    sender_email = None
    sender_password = None
    if template_path and os.path.exists(template_path):
        try:
            with open(template_path, 'r') as f:
                templates = json.load(f)
                subject_template = templates.get('subject')
                body_template = templates.get('body')
                sender_email = templates.get('sender_email')
                sender_password = templates.get('sender_password')
        except Exception as e:
            print(f"Error loading templates: {e}")
        
    def generate():
        try:
            for progress_update in process_uploaded_file(file_path, resume_path, subject_template, body_template, sender_email, sender_password):
                # Ensure the update is stripped of extra newlines and formatted for SSE
                clean_update = progress_update.strip()
                yield f"data: {clean_update}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/history', methods=['GET'])
def history():
    if campaigns_col is None:
        return jsonify({"error": "MongoDB not connected"}), 500
        
    campaigns = list(campaigns_col.find().sort("timestamp", -1).limit(20))
    for c in campaigns:
        c['_id'] = str(c['_id'])
        c['timestamp'] = c['timestamp'].isoformat()
        
        # Count success and failed for this campaign
        success_count = logs_col.count_documents({"campaign_id": c['campaign_id'], "status": "Success"})
        failed_count = logs_col.count_documents({"campaign_id": c['campaign_id'], "status": {"$in": ["Failed", "Skipped"]}})
        c['success_count'] = success_count
        c['failed_count'] = failed_count
        
    return jsonify({"campaigns": campaigns}), 200

@app.route('/api/signup', methods=['POST'])
def signup():
    if users_col is None:
        return jsonify({"error": "Database not connected. Please set MONGO_URI."}), 500
        
    data = request.json
    email = data.get('email')
    password = data.get('password')
    senderEmail = data.get('senderEmail')
    senderPassword = data.get('senderPassword')
    name = data.get('name')
    company = data.get('company')
    mobile = data.get('mobile')
    
    if not all([email, password, senderEmail, senderPassword, name]):
        return jsonify({"error": "Missing required fields"}), 400
        
    if users_col.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400
        
    hashed_password = generate_password_hash(password)
    users_col.insert_one({
        "email": email,
        "password": hashed_password,
        "senderEmail": senderEmail,
        "senderPassword": senderPassword,
        "name": name,
        "company": company,
        "mobile": mobile,
        "created_at": datetime.datetime.utcnow()
    })
    
    # Generate token
    token = str(uuid.uuid4())
    sessions_col.insert_one({
        "token": token,
        "email": email,
        "created_at": datetime.datetime.utcnow()
    })
    
    return jsonify({"message": "User created", "token": token}), 201

@app.route('/api/login', methods=['POST'])
def login():
    if users_col is None:
        return jsonify({"error": "Database not connected. Please set MONGO_URI."}), 500
        
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401
        
    token = str(uuid.uuid4())
    sessions_col.insert_one({
        "token": token,
        "email": email,
        "created_at": datetime.datetime.utcnow()
    })
    
    return jsonify({"message": "Login successful", "token": token}), 200

@app.route('/api/me', methods=['GET'])
def get_me():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({"error": "No token provided"}), 401
        
    token = token.replace("Bearer ", "")
    session = sessions_col.find_one({"token": token})
    if not session:
        return jsonify({"error": "Invalid token"}), 401
        
    user = users_col.find_one({"email": session['email']})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({
        "email": user.get("email"),
        "senderEmail": user.get("senderEmail"),
        "senderPassword": user.get("senderPassword"),
        "name": user.get("name")
    }), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)
