# Consultation Booking Module with Google Meet Integration

A free, embeddable consultation booking system that automatically creates Google Meet links using the Google Calendar API. Perfect for consultants, coaches, therapists, and anyone who needs to schedule online meetings.

## Features

- ✅ **Automatic Google Meet Link Generation** - Creates Meet links instantly when bookings are made
- ✅ **Google OAuth 2.0 Integration** - Secure authentication with Google Calendar API
- ✅ **Email Notifications** - Automatic confirmation emails with Meet links
- ✅ **Email Reminders** - 10-minute reminder emails before meetings
- ✅ **Embeddable** - Can be embedded in any website via iframe
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **Free Services Only** - Uses only free Google APIs and services
- ✅ **Modern UI** - Beautiful, professional interface

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google account with Calendar access
- Gmail account for sending emails

## Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd consultation-booking-module
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Then edit the `.env` file with your credentials (see setup instructions below).

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Main booking page: `http://localhost:3000`
   - Embeddable version: `http://localhost:3000/embed`

## Google OAuth 2.0 Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Consultation Booking")
4. Click "Create"

### Step 2: Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: Your consultation booking app name
   - User support email: Your email
   - Developer contact information: Your email
   - Save and continue through the steps

4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Consultation Booking Web Client
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
   - Click "Create"

5. **Save the Client ID and Client Secret** - You'll need these for the `.env` file

### Step 4: Configure Environment Variables

Edit your `.env` file with the following values:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id_from_step_3
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_3
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Email Configuration (Gmail SMTP)
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password

# Server Configuration
PORT=3000
NODE_ENV=development

# Database (using JSON file for simplicity)
DB_FILE=bookings.json
```

### Step 5: Gmail App Password Setup

For sending emails, you need to create an App Password:

1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Navigate to "Security" → "2-Step Verification" (enable if not already)
3. Go to "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Enter "Consultation Booking" as the name
6. Copy the generated 16-character password
7. Use this password in your `.env` file as `EMAIL_PASS`

## Usage

### First Time Setup

1. Start the server: `npm start`
2. Visit `http://localhost:3000`
3. Click "Connect with Google" to authenticate
4. Grant calendar permissions when prompted
5. You'll be redirected back and can now create bookings

### Creating Bookings

1. Fill out the booking form with:
   - Full name
   - Email address
   - Date and time
2. Click "Book Consultation"
3. The system will:
   - Create a Google Calendar event
   - Generate a Google Meet link
   - Send a confirmation email
   - Display the Meet link on screen

### Embedding on Your Website

Use this iframe code to embed the booking form on any website:

```html
<iframe 
  src="http://localhost:3000/embed" 
  width="100%" 
  height="600" 
  frameborder="0"
  style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</iframe>
```

For production, replace `localhost:3000` with your domain.

## File Structure

```
consultation-booking-module/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── env.example            # Environment variables template
├── README.md              # This file
├── public/
│   ├── index.html         # Main booking page
│   └── embed.html         # Embeddable version
├── bookings.json          # Database file (created automatically)
└── tokens.json           # OAuth tokens (created automatically)
```

## API Endpoints

- `GET /` - Main booking page
- `GET /embed` - Embeddable booking form
- `GET /auth/google` - Google OAuth authentication
- `GET /auth/google/callback` - OAuth callback handler
- `POST /api/book` - Create a new booking
- `GET /api/bookings` - Get all bookings

## Email Features

### Confirmation Email
- Sent immediately after booking
- Contains meeting details and Google Meet link
- Professional HTML template

### Reminder Email
- Sent 10 minutes before the meeting
- Includes the Meet link for easy access
- Automated using cron jobs

## Customization

### Changing Time Slots
Edit the time options in both `public/index.html` and `public/embed.html`:

```html
<select id="time" name="time" required>
    <option value="">Select a time</option>
    <option value="09:00">9:00 AM</option>
    <option value="10:00">10:00 AM</option>
    <!-- Add or modify time slots here -->
</select>
```

### Customizing Email Templates
Edit the email templates in `server.js`:

- `sendBookingConfirmation()` - Confirmation email
- `sendReminderEmail()` - Reminder email

### Styling
The CSS is embedded in the HTML files. You can customize:
- Colors and fonts
- Layout and spacing
- Responsive breakpoints

## Production Deployment

### Environment Variables for Production
```env
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASS=your_production_app_password
PORT=3000
NODE_ENV=production
```

### Google Cloud Console Changes for Production
1. Add your production domain to authorized redirect URIs
2. Update the OAuth consent screen with production details
3. Consider publishing the app if you have many users

### Deployment Options
- **Heroku**: Easy deployment with Git integration
- **Vercel**: Great for Node.js apps
- **DigitalOcean**: Full control over the server
- **AWS/GCP**: Enterprise-grade hosting

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI" error**
   - Make sure the redirect URI in Google Console matches your `.env` file
   - Include the protocol (http:// or https://)

2. **"Invalid credentials" error**
   - Check that your Client ID and Secret are correct
   - Ensure you copied them from the right OAuth client

3. **Email not sending**
   - Verify your Gmail app password is correct
   - Check that 2-factor authentication is enabled
   - Ensure the email address is correct

4. **"Calendar API not enabled" error**
   - Go to Google Cloud Console and enable the Calendar API
   - Wait a few minutes for the changes to propagate

### Debug Mode
Run with debug logging:
```bash
NODE_ENV=development DEBUG=* npm start
```

## Security Considerations

- Never commit your `.env` file to version control
- Use environment variables for all sensitive data
- Regularly rotate your OAuth credentials
- Consider implementing rate limiting for production
- Use HTTPS in production

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify your Google OAuth setup
3. Check the server logs for error messages
4. Ensure all environment variables are set correctly

## Contributing

Feel free to submit issues and enhancement requests! 