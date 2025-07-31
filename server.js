const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Google OAuth 2.0 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Email transporter setup
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Simple JSON database
const DB_FILE = process.env.DB_FILE || 'bookings.json';

function loadBookings() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
  return [];
}

function saveBookings(bookings) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2));
  } catch (error) {
    console.error('Error saving bookings:', error);
  }
}

// Google Calendar API functions
async function createCalendarEvent(booking) {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: `Consultation with ${booking.name}`,
      description: `Consultation booking for ${booking.name} (${booking.email})`,
      start: {
        dateTime: booking.dateTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: moment(booking.dateTime).add(1, 'hour').toISOString(),
        timeZone: 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      attendees: [
        { email: booking.email }
      ]
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

// Email functions
async function sendBookingConfirmation(booking, meetLink) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: booking.email,
    subject: 'Consultation Booking Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Consultation Booking Confirmed!</h2>
        <p>Hello ${booking.name},</p>
        <p>Your consultation has been successfully booked for:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Date & Time:</strong> ${moment(booking.dateTime).format('MMMM Do YYYY, h:mm A')}</p>
          <p><strong>Duration:</strong> 1 hour</p>
        </div>
        <p><strong>Google Meet Link:</strong></p>
        <a href="${meetLink}" style="display: inline-block; background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
          Join Meeting
        </a>
        <p style="margin-top: 20px;">Please join the meeting 5 minutes before the scheduled time.</p>
        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
        <p>Best regards,<br>Your Consultation Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent to:', booking.email);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

async function sendReminderEmail(booking) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: booking.email,
    subject: 'Reminder: Your consultation starts in 10 minutes',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Consultation Reminder</h2>
        <p>Hello ${booking.name},</p>
        <p>This is a friendly reminder that your consultation starts in 10 minutes.</p>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p><strong>Time:</strong> ${moment(booking.dateTime).format('h:mm A')}</p>
          <p><strong>Duration:</strong> 1 hour</p>
        </div>
        <p><strong>Google Meet Link:</strong></p>
        <a href="${booking.meetLink}" style="display: inline-block; background-color: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
          Join Meeting Now
        </a>
        <p style="margin-top: 20px;">Please join the meeting now to ensure you're ready on time.</p>
        <p>Best regards,<br>Your Consultation Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Reminder email sent to:', booking.email);
  } catch (error) {
    console.error('Error sending reminder email:', error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/embed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'embed.html'));
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// Google OAuth routes
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Save tokens (in production, use a proper database)
    fs.writeFileSync('tokens.json', JSON.stringify(tokens));
    
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.redirect('/?auth=error');
  }
});

// API Routes
app.post('/api/book', async (req, res) => {
  try {
    const { name, email, dateTime } = req.body;
    
    if (!name || !email || !dateTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user is authenticated
    const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
    oauth2Client.setCredentials(tokens);
    
    // Create calendar event with Google Meet
    const calendarEvent = await createCalendarEvent({ name, email, dateTime });
    const meetLink = calendarEvent.conferenceData.entryPoints[0].uri;
    
    // Save booking to database
    const bookings = loadBookings();
    const booking = {
      id: Date.now().toString(),
      name,
      email,
      dateTime,
      meetLink,
      createdAt: new Date().toISOString(),
      status: 'confirmed'
    };
    
    bookings.push(booking);
    saveBookings(bookings);
    
    // Send confirmation email
    await sendBookingConfirmation(booking, meetLink);
    
    res.json({
      success: true,
      booking,
      meetLink
    });
    
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', (req, res) => {
  try {
    const bookings = loadBookings();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// Schedule reminder emails (runs every minute)
cron.schedule('* * * * *', () => {
  const bookings = loadBookings();
  const now = moment();
  
  bookings.forEach(booking => {
    if (booking.status === 'confirmed') {
      const meetingTime = moment(booking.dateTime);
      const timeUntilMeeting = meetingTime.diff(now, 'minutes');
      
      // Send reminder 10 minutes before
      if (timeUntilMeeting === 10) {
        sendReminderEmail(booking);
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the booking system`);
  console.log(`Visit http://localhost:${PORT}/embed to get the embeddable version`);
}); 