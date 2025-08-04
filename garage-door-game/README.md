# 🏠 Garage Door Game - Data Collection Platform

A gamified platform for collecting garage door data through Street View image analysis and user submissions.

## 🎯 Project Overview

The Garage Door Game combines data collection with gamification, allowing users to:
- **Play Games**: Identify garage door details from Street View images
- **Submit Data**: Upload photos and details of garage doors they encounter
- **Earn Points**: Get rewarded for accurate guesses and valuable submissions
- **Compete**: Climb leaderboards and compete with other players

## 🏗️ Architecture

### Frontend (Svelte 5 + TypeScript)
- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Features**: Responsive design, modern UI components, real-time updates
- **Port**: http://localhost:5173

### Backend (Express.js + TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: SQLite with comprehensive schema
- **Authentication**: JWT-based user authentication
- **APIs**: RESTful API with rate limiting and security
- **Port**: http://localhost:3001

## 📊 Database Schema

### Users Table
- User authentication and profile data
- Points, games played, accuracy tracking
- Role-based access control

### Jobs Table
- User-submitted garage door data
- Address, coordinates, measurements
- Photo uploads and verification status

### Game Sessions Table
- Individual game attempts and results
- Guess accuracy and points earned
- Time tracking and performance metrics

### Leaderboard View
- Real-time ranking system
- Performance statistics
- Achievement tracking

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd garage-door-game
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api

## 🔧 Configuration

### Backend Environment Variables
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=./database/garage_game.db
JWT_SECRET=your-super-secret-jwt-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
GOOGLE_STREET_VIEW_API_KEY=your-google-street-view-api-key
```

### Frontend Environment Variables
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_APP_NAME=Garage Door Game
```

## 📱 Features

### ✅ Production Implementation (COMPLETE)
- ✅ **Full-Stack Architecture**: Express.js backend + SvelteKit frontend
- ✅ **User Authentication**: JWT-based register/login system
- ✅ **Game Interface**: Complete Street View integration with Google API
- ✅ **Data Collection**: Photo upload and garage door data submission
- ✅ **Scoring System**: Points, accuracy tracking, and leaderboards
- ✅ **Real-Time Gaming**: Timer-based challenges with immediate feedback
- ✅ **Production Deployment**: Google Cloud Run with auto-scaling
- ✅ **Security Features**: Rate limiting, CORS, input validation
- ✅ **Mobile Responsive**: Retro gaming UI optimized for all devices
- ✅ **Database**: SQLite with comprehensive schema and migrations

### 🚀 Production URLs
- **Frontend**: https://garage-door-frontend-75suuscifq-uc.a.run.app
- **Backend API**: https://garage-door-backend-75suuscifq-uc.a.run.app
- **API Health**: https://garage-door-backend-75suuscifq-uc.a.run.app/health

## 🎮 Game Flow

1. **User Registration**: Create account and profile
2. **Game Selection**: Choose from available game modes
3. **Image Analysis**: View Street View images and make guesses
4. **Scoring**: Earn points based on accuracy
5. **Data Submission**: Upload own garage door photos
6. **Leaderboard**: Track progress and compete

## 🔒 Security Features

- JWT-based authentication
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- Helmet.js security headers
- SQL injection prevention
- File upload restrictions

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Game
- `POST /api/game/start` - Start new game session
- `POST /api/game/guess` - Submit game guess
- `GET /api/game/random-job` - Get random job for game

### Jobs
- `POST /api/jobs` - Submit new job
- `GET /api/jobs` - Get user jobs
- `PUT /api/jobs/:id` - Update job

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard
- `GET /api/leaderboard/rank/:userId` - Get user rank

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run db:init      # Initialize database
npm run db:seed      # Seed with sample data
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## 📦 Deployment

### Production Build
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

### Docker Support (Coming Soon)
- Dockerfile for backend
- Dockerfile for frontend
- Docker Compose for full stack

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/api

## 📞 Support

For questions or issues:
1. Check the documentation
2. Review existing issues
3. Create a new issue with details

---

## 🎉 Production Status

**Status**: ✅ **FULLY OPERATIONAL PRODUCTION SYSTEM**
- **Backend**: Deployed and serving real Google Street View images
- **Frontend**: Complete Svelte application with all game features
- **Database**: Production SQLite with user data and game sessions
- **APIs**: All endpoints operational with proper authentication
- **Security**: Production-ready with rate limiting and validation

**Current Phase**: ✅ **Phase 3 Complete** - Full production deployment with Svelte frontend
**Achievement**: 🏆 **Production-ready garage door data collection game platform**
