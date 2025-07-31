# Video Consultation Platform

A modern, secure video consultation platform built with Next.js, React, and WebRTC. This project was extracted from the [sanhome repository](https://github.com/nourhb/sanhome.git) and simplified to focus on video consultation functionality.

## Features

- 🎥 **High-Quality Video Calls**: Crystal clear video and audio for effective consultations
- 🔒 **Secure & Private**: End-to-end encryption ensures your privacy
- 📅 **Easy Scheduling**: Book appointments at your convenience
- 👨‍⚕️ **Professional Care**: Connect with qualified healthcare professionals
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🚀 **Real-time Communication**: Built with WebRTC for low-latency video calls
- 🔌 **RESTful APIs**: Complete API structure for rooms and consultations

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Video**: WebRTC (Web Real-Time Communication)
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Notifications**: Custom toast system
- **APIs**: Next.js API Routes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd video-consultation
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory (optional):
```env
# Firebase Configuration (optional for demo)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Structure

The application includes a complete RESTful API structure built with Next.js API Routes:

### **API Endpoints:**

#### **Rooms API:**
- `POST /api/rooms` - Create a new video room
- `GET /api/rooms` - Get all rooms or specific room by ID
- `GET /api/rooms/[id]` - Get specific room
- `PUT /api/rooms/[id]` - Join/leave room or update room status
- `DELETE /api/rooms/[id]` - Delete a room

#### **Consultations API:**
- `POST /api/consultations` - Schedule a new consultation
- `GET /api/consultations` - Get all consultations or filter by patient email
- `GET /api/consultations?id=[id]` - Get specific consultation

### **API Testing:**

Visit [http://localhost:3000/api-test](http://localhost:3000/api-test) to test the APIs interactively.

### **API Usage Examples:**

```typescript
import { roomApi, consultationApi } from '@/lib/api';

// Create a room
const result = await roomApi.createRoom('My Video Call', 'user123');

// Schedule a consultation
const consultation = await consultationApi.createConsultation({
  patientName: 'John Doe',
  patientEmail: 'john@example.com',
  consultationDate: '2024-01-15',
  consultationTime: '14:30',
  notes: 'Follow-up consultation'
});
```

## Usage

### Creating a New Call

1. Navigate to the home page
2. Click "Create New Call" 
3. A new room ID will be generated
4. Share the room ID with others to join

### Joining an Existing Call

1. Navigate to the video consultation page
2. Enter the room ID in the "Join Existing Call" section
3. Click "Join Call"
4. Allow camera and microphone permissions

### Scheduling a Consultation

1. Click "Schedule Consultation" from the main page
2. Fill in your details and preferred time
3. Submit the form to receive a confirmation

### Testing APIs

1. Navigate to [http://localhost:3000/api-test](http://localhost:3000/api-test)
2. Click "Test Room API" to test room creation and retrieval
3. Click "Test Consultation API" to test consultation scheduling
4. View results in the test results panel

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── rooms/         # Room management APIs
│   │   ├── consultations/ # Consultation management APIs
│   │   └── auth/          # Authentication APIs (future)
│   ├── (app)/             # App routes
│   │   └── video-consult/ # Video consultation pages
│   ├── api-test/          # API testing page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI components (buttons, cards, etc.)
│   └── VideoCall.tsx     # Main video call component
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
│   ├── api.ts           # API utility functions
│   ├── firebase.ts      # Firebase configuration
│   └── utils.ts         # General utilities
└── contexts/             # React contexts (if needed)
```

## Key Components

### VideoCall Component

The main video call component (`src/components/VideoCall.tsx`) handles:
- Camera and microphone access
- Local video stream display
- Call controls (mute, video toggle, hang up)
- Room management
- User interface for video calls

### API Routes

- **Rooms** (`src/app/api/rooms/`): Manage video room creation, joining, and deletion
- **Consultations** (`src/app/api/consultations/`): Handle consultation scheduling and retrieval
- **API Utilities** (`src/lib/api.ts`): Helper functions for frontend API interactions

### Video Consultation Pages

- **Main Page** (`src/app/page.tsx`): Landing page with feature overview
- **Video Consult** (`src/app/(app)/video-consult/page.tsx`): Main video consultation interface
- **Schedule** (`src/app/(app)/video-consult/schedule/page.tsx`): Consultation scheduling form
- **API Test** (`src/app/api-test/page.tsx`): Interactive API testing interface

## Demo Features

This is a demo implementation that includes:

- ✅ Local video stream capture and display
- ✅ Camera and microphone controls
- ✅ Room ID generation and management
- ✅ Responsive UI design
- ✅ Form validation and user feedback
- ✅ Toast notifications
- ✅ Complete RESTful API structure
- ✅ Interactive API testing interface

### Limitations (Demo Version)

- ❌ No actual WebRTC peer-to-peer connection (would require signaling server)
- ❌ No Firebase integration (removed for simplicity)
- ❌ No authentication system
- ❌ No persistent data storage (uses in-memory storage)

## Production Considerations

To make this production-ready, you would need to add:

1. **Signaling Server**: For WebRTC peer discovery and connection establishment
2. **Authentication**: User login and session management
3. **Database**: Store consultation data and user information (PostgreSQL, MongoDB, etc.)
4. **STUN/TURN Servers**: For NAT traversal in WebRTC connections
5. **Security**: HTTPS, proper CORS, and security headers
6. **Error Handling**: Comprehensive error handling and recovery
7. **Testing**: Unit and integration tests
8. **Environment Variables**: Proper configuration management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is based on the [sanhome repository](https://github.com/nourhb/sanhome.git). Please check the original repository for licensing information.

## Acknowledgments

- Original project: [sanhome](https://github.com/nourhb/sanhome.git) by [nourhb](https://github.com/nourhb)
- UI components: [Radix UI](https://www.radix-ui.com/)
- Icons: [Lucide React](https://lucide.dev/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)

## Support

For questions or issues, please open an issue in the repository or contact the maintainers. 