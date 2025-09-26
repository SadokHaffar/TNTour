# TNTour - Travel & Tourism Platform

A modern, responsive web application built with Next.js, Tailwind CSS, and Firebase, featuring role-based authentication and user management.

## Features

- 🔐 **Authentication**: Secure user authentication with Firebase
- 👥 **Role-based Access**: Separate dashboards for users and admins
- 🎨 **Responsive Design**: Modern UI built with Tailwind CSS
- 🚀 **Next.js 14**: Built with the latest Next.js features including App Router
- 🔥 **Firebase Integration**: Real-time database and authentication
- 📱 **Mobile-first**: Fully responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase account

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Firebase Setup**
   
   a. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   
   b. Enable Authentication and Firestore Database
   
   c. Get your Firebase configuration from Project Settings
   
   d. Update the `.env.local` file with your Firebase credentials:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard
│   ├── dashboard/         # User dashboard  
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── unauthorized/      # Unauthorized access page
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   └── ProtectedRoute.tsx # Route protection component
├── context/               # React contexts
│   └── AuthContext.tsx    # Authentication context
├── lib/                   # Utility libraries
│   └── firebase.ts        # Firebase configuration
└── middleware.ts          # Next.js middleware for route protection
```

## User Roles

### User
- Access to user dashboard
- View and manage personal bookings
- Browse destinations and packages
- Create wishlists and reviews

### Admin  
- Access to admin dashboard
- Manage all users and bookings
- Manage destinations and packages
- View analytics and reports
- Full platform administration

## Authentication Flow

1. **Public Access**: Home page accessible to all
2. **Sign Up/Login**: Users can create accounts or sign in
3. **Role Assignment**: Users are assigned either 'user' or 'admin' role
4. **Protected Routes**: Access controlled based on user roles
5. **Automatic Redirection**: Users redirected to appropriate dashboard

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

Required environment variables in `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`  
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
