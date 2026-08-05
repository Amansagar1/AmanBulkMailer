import smtplib
from email.message import EmailMessage
import os

SENDER_EMAIL = "kumaramansagar01@gmail.com"
SENDER_PASSWORD = "bpokynscqhvjfgxs" 
RECIPIENT_EMAIL = "sagarsharmaofficial0@gmail.com"
RESUME_FILE = "amansagar.pdf" 

SUBJECT_TEMPLATE = "Application for {role} - Kumar Aman Sagar"

BODY_TEMPLATE = """Dear Hiring Team at {company},

I am writing to express my strong interest in the {role} position. With approximately 3 years of hands-on experience building scalable, cloud-native web applications, I have developed deep expertise in full-stack engineering using React, Next.js, Node.js, and MongoDB.

In my recent roles, I have successfully delivered high-impact technical solutions:
• Scalable Architecture: Architected and deployed microservices-based applications, improving system scalability by 25%.
• AI & IoT Integrations: Integrated AI tools for automated lead management and built IoT telemetry modules to process real-time sensor data.
• Security & Performance: Implemented secure JWT and RBAC mechanisms, and optimized full-stack platforms (achieving ~1.8s load times).
• End-to-End Delivery: Managed complete CI/CD pipelines (Docker, GitHub Actions) to ensure stable production deployments.

I am highly confident that my technical background and problem-solving mindset align perfectly with the engineering goals at {company}. 

I have attached my resume for your review. I would welcome the opportunity to discuss how my skills can bring immediate value to your team.

Thank you for your time and consideration.

Best regards,
Kumar Aman Sagar
kumaramansagar01@gmail.com | +91 8434120273
LinkedIn: https://www.linkedin.com/in/kumaramansagar/
GitHub: https://github.com/Amansagar1
"""

def send_test_email():
    print("Connecting to Gmail server for test...")
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        print("Successfully logged in!")
    except Exception as e:
        print(f"\n[FAILED TO LOGIN]: {e}")
        return

    company_name = "Test Company Inc."
    job_role = "Senior Full Stack Engineer"

    msg = EmailMessage()
    msg['Subject'] = SUBJECT_TEMPLATE.format(role=job_role)
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECIPIENT_EMAIL
    
    personalized_body = BODY_TEMPLATE.format(company=company_name, role=job_role)
    msg.set_content(personalized_body)

    if RESUME_FILE and os.path.exists(RESUME_FILE):
        with open(RESUME_FILE, 'rb') as f:
            file_data = f.read()
            file_name = os.path.basename(RESUME_FILE)
        msg.add_attachment(file_data, maintype='application', subtype='pdf', filename=file_name)

    try:
        server.send_message(msg)
        print(f"SUCCESS: Test email sent to {RECIPIENT_EMAIL}")
    except Exception as e:
        print(f"ERROR: Failed to send test email. Error: {e}")

    server.quit()

if __name__ == "__main__":
    send_test_email()
