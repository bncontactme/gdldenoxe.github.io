# Secret Lover Mail Setup

This page sends emails directly from the browser using EmailJS (free service).

## Quick Setup (5 minutes):

1. **Sign up at EmailJS:**
   - Go to https://www.emailjs.com/
   - Create a free account (200 emails/month free)

2. **Add an email service:**
   - Go to Email Services tab
   - Click "Add New Service"
   - Choose your email provider (Gmail, Outlook, etc.)
   - Follow instructions to connect

3. **Create an email template:**
   - Go to Email Templates tab
   - Click "Create New Template"
   - Use this template content:
     ```
     Subject: {{subject}}
     
     From: {{from_name}}
     
     {{message}}
     ```
   - Save and note the Template ID

4. **Get your credentials:**
   - Public Key: Account > API Keys
   - Service ID: From your email service
   - Template ID: From your template

5. **Update script.js:**
   - Line 3: Replace `YOUR_PUBLIC_KEY` with your public key
   - Line 22: Replace `YOUR_SERVICE_ID` with your service ID
   - Line 22: Replace `YOUR_TEMPLATE_ID` with your template ID

That's it! The page will now send emails directly without opening an email client.
