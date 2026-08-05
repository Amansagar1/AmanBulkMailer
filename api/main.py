import pandas as pd
import smtplib
from email.message import EmailMessage
import os
import time
from datetime import datetime
import uuid
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# ==========================================
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
MONGO_URI = os.getenv("MONGO_URI")

# MongoDB Setup
mongo_client = None
campaigns_col = None
logs_col = None
users_col = None
sessions_col = None

try:
    if MONGO_URI:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client['email_automation']
        campaigns_col = db['campaigns']
        logs_col = db['email_logs']
        users_col = db['users']
        sessions_col = db['sessions']
except Exception as e:
    print(f"MongoDB connection error: {e}")
    mongo_client = None

FILES_TO_PROCESS = [
    "Bangalore_Startups.csv",
    "Bengaluru_FullStack_Target_Companies_Kumar_Aman_Sagar.xlsx",
    "EdTech_Startups_FullStack_Developers_Bengaluru.xlsx"
]
RESUME_FILE = "amansagar.pdf" 

# Templates are now dynamically supplied from the frontend via process_uploaded_file
DEFAULT_SUBJECT_TEMPLATE = "Application for {role} -Kumar Aman Sagar"
DEFAULT_BODY_TEMPLATE = """Dear Hiring Team at {company},

I am writing to express my strong interest in the {role} position. With approximately 3 years of hands-on experience building scalable, cloud-native web applications, I have developed deep expertise in full-stack engineering using React, Next.js, Node.js, and MongoDB.

I have attached my resume for your review. I would welcome the opportunity to discuss how my skills can bring immediate value to your team.

Best regards,
Kumar Aman Sagar"""
# ==========================================

import re

def get_valid_email(row):
    """Helper function to find a valid email address by checking all columns."""
    for col_name, value in row.items():
        val_str = str(value).strip()
        # Basic email validation regex
        if re.match(r"[^@]+@[^@]+\.[^@]+", val_str):
            if val_str.lower() != 'nan' and val_str.lower() != 'not publicly available':
                return val_str
    return None

def log_to_mongo(campaign_id, company, email, role, status, message=None):
    if mongo_client:
        try:
            logs_col.insert_one({
                "campaign_id": campaign_id,
                "company": company,
                "email": email,
                "role": role,
                "status": status,
                "message": message,
                "timestamp": datetime.utcnow()
            })
        except Exception as e:
            print(f"Failed to log to Mongo: {e}")

def send_emails():
    # Only for CLI script usage
    yield '{"status": "start", "total": 0}\n\n'
    # For CLI, we won't log campaigns as nicely, but it works
    print("Connecting to Gmail server...")
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        print("Successfully connected and logged in.")
    except Exception as e:
        yield f'{{"status": "error", "message": "Failed to login to SMTP server: {e}"}}\n\n'
        return

    for file in FILES_TO_PROCESS:
        yield from process_file(server, file)

def process_file(server, file_path, resume_path=None, campaign_id=None, subject_template=None, body_template=None, sender_email=None):
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path)
        else:
            yield f'{{"status": "error", "message": "Unsupported file format for {file_path}"}}\n\n'
            return
    except Exception as e:
        yield f'{{"status": "error", "message": "Error reading {file_path}: {e}"}}\n\n'
        return

    # Fallback to default if None
    actual_subject = subject_template if subject_template else DEFAULT_SUBJECT_TEMPLATE
    actual_body = body_template if body_template else DEFAULT_BODY_TEMPLATE
    actual_sender_email = sender_email if sender_email else SENDER_EMAIL

    total_rows = len(df)
    yield f'{{"status": "start", "total": {total_rows}}}\n\n'
    yield f'{{"status": "info", "message": "Started processing {total_rows} rows..."}}\n\n'

    for index, row in df.iterrows():
        # Normalize column names in this row to handle BOM, spaces, and casing
        normalized_row = {str(k).replace('\ufeff', '').strip().lower(): v for k, v in row.items()}
        
        # Dynamically find the company name column
        company_name = 'Hiring Team'
        for col_variant in ['company name', 'company', 'organization', 'startup name', 'startup', 'employer']:
            if col_variant in normalized_row and str(normalized_row[col_variant]).strip().lower() != 'nan':
                company_name = str(normalized_row[col_variant]).strip()
                break
        
        # Dynamically find the job role column
        job_role = 'Software Engineer'
        for col_variant in ['target role', 'roles hiring', 'role', 'job title', 'position']:
            if col_variant in normalized_row and str(normalized_row[col_variant]).strip().lower() != 'nan':
                job_role = str(normalized_row[col_variant]).strip()
                break
        recipient_email = get_valid_email(row)

        if not recipient_email:
            msg = f"Skipped {company_name} - No valid email found."
            yield f'{{"index": {index+1}, "status": "skipped", "message": "{msg}"}}\n\n'
            log_to_mongo(campaign_id, company_name, "N/A", job_role, "Skipped", "No valid email found")
            continue

        try:
            msg = EmailMessage()
            msg['Subject'] = actual_subject.format(role=job_role, company=company_name)
            msg['From'] = f"Kumar Aman Sagar <{actual_sender_email}>"
            msg['To'] = recipient_email

            personalized_body = actual_body.format(company=company_name, role=job_role)
            msg.set_content(personalized_body)

            # Use dynamic resume if provided, otherwise fallback to default
            actual_resume_path = resume_path if resume_path else RESUME_FILE
            if actual_resume_path and os.path.exists(actual_resume_path):
                with open(actual_resume_path, 'rb') as f:
                    file_data = f.read()
                    file_name = os.path.basename(actual_resume_path)
                msg.add_attachment(file_data, maintype='application', subtype='pdf', filename=file_name)

            server.send_message(msg)
            success_msg = f"Email successfully sent to {company_name} ({recipient_email})"
            yield f'{{"index": {index+1}, "status": "success", "message": "{success_msg}"}}\n\n'
            log_to_mongo(campaign_id, company_name, recipient_email, job_role, "Success")
            
            time.sleep(2)
        except Exception as e:
            err_msg = f"Failed to send to {recipient_email}. Error: {e}"
            yield f'{{"index": {index+1}, "status": "error", "message": "ERROR: {err_msg}"}}\n\n'
            log_to_mongo(campaign_id, company_name, recipient_email, job_role, "Failed", str(e))

    yield f'{{"status": "complete", "message": "Done! Successfully sent emails."}}\n\n'

def process_uploaded_file(file_path, resume_path=None, subject_template=None, body_template=None, sender_email=None, sender_password=None, user_email=None):
    campaign_id = str(uuid.uuid4())
    
    if mongo_client:
        try:
            campaigns_col.insert_one({
                "campaign_id": campaign_id,
                "file_name": os.path.basename(file_path),
                "timestamp": datetime.utcnow(),
                "status": "Running",
                "user_email": user_email
            })
        except Exception as e:
            print(f"Campaign logging error: {e}")

    actual_sender_email = sender_email if sender_email else SENDER_EMAIL
    actual_sender_password = sender_password if sender_password else SENDER_PASSWORD

    yield f'{{"status": "info", "message": "Connecting to Gmail server..."}}\n\n'
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(actual_sender_email, actual_sender_password)
        yield f'{{"status": "info", "message": "Successfully connected and logged in."}}\n\n'
    except Exception as e:
        yield f'{{"status": "error", "message": "Failed to login to SMTP server: {e}"}}\n\n'
        if mongo_client:
            campaigns_col.update_one({"campaign_id": campaign_id}, {"$set": {"status": "Failed"}})
        return

    yield from process_file(server, file_path, resume_path, campaign_id, subject_template, body_template, actual_sender_email)
    
    server.quit()
    
    if mongo_client:
        campaigns_col.update_one({"campaign_id": campaign_id}, {"$set": {"status": "Completed"}})
        
    yield f'{{"status": "complete", "message": "Finished processing uploaded file."}}\n\n'

if __name__ == "__main__":
    for progress in send_emails():
        print(progress.strip())
