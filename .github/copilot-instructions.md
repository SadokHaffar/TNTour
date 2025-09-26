# TNTour - Travel & Tourism Platform

## Project Overview
TNTour is a modern, responsive web application built with Next.js, Tailwind CSS, and Firebase. It features role-based authentication with separate dashboards for users and administrators.

## Architecture & Tech Stack
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS for responsive design
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **State Management**: React Context API

## Key Features Implemented
- ✅ User authentication (login/signup)
- ✅ Role-based access control (user/admin)
- ✅ Protected routes with middleware
- ✅ Responsive design with Tailwind CSS
- ✅ User dashboard with "Hello World" functionality
- ✅ Admin dashboard with "Hello World" functionality
- ✅ Firebase integration for auth and database

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard
│   ├── dashboard/         # User dashboard  
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── unauthorized/      # Unauthorized access page
│   └── layout.tsx         # Root layout with AuthProvider
├── components/            # Reusable components
│   └── ProtectedRoute.tsx # Route protection HOC
├── context/               # React contexts
│   └── AuthContext.tsx    # Authentication state management
├── lib/                   # Utility libraries
│   └── firebase.ts        # Firebase configuration
└── middleware.ts          # Next.js middleware for route protection
```

## Authentication Flow
1. Users can sign up with email/password and select role (user/admin)
2. User data is stored in Firestore with role information
3. Protected routes check user authentication and role
4. Users are automatically redirected to appropriate dashboards
5. Middleware handles route protection at the application level

## Current Status
- ✅ Complete project setup with all dependencies
- ✅ Firebase configuration ready (requires environment variables)
- ✅ Authentication system fully implemented
- ✅ Role-based routing functional
- ✅ Basic dashboards with "Hello World" content
- ✅ Responsive design implemented
- ✅ Error handling and loading states

## Next Steps for Development
This foundational setup provides a solid base for expanding the application with:
- Booking management system
- Destination browsing and search
- User profile management
- Admin content management
- Payment integration
- Real-time notifications
- Advanced analytics

## Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling consistency
- Implement proper error boundaries
- Maintain responsive design principles
- Follow Firebase security best practices
- Use React Context appropriately for state management