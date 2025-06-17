# Address Verification System

A web-based application for managing and verifying user address information. The system allows administrators to import user data from CSV/Excel files and automatically sends verification emails to users.

## Features

- Clean, modern user interface built with Tailwind CSS
- Secure admin dashboard with JWT authentication
- CSV/Excel file import with field mapping
- Email verification system using Nodemailer
- Address change notifications
- User management
- Search and filtering capabilities
- Responsive design
- File upload handling with Multer
- Input validation with Express Validator

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- SQLite3

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd address-verification-system
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Application
PORT=3000
APP_URL=http://localhost:3000

# Database
DB_PATH=database.sqlite

# JWT
JWT_SECRET=your-secret-key-here

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Admin Email for Notifications
ADMIN_EMAIL=admin@example.com
```

## Usage

1. Start the application:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

2. Access the application:
- User interface: http://localhost:3000

## Database Schema

### Users Table
- id (INTEGER, PRIMARY KEY)
- client_number (TEXT, UNIQUE)
- name (TEXT)
- first_name (TEXT)
- last_name (TEXT)
- phone_number (TEXT)
- alt_number (TEXT)
- address (TEXT)
- email (TEXT, UNIQUE)
- alt_email (TEXT)
- verification_token (TEXT)
- is_verified (BOOLEAN)
- created_at (DATETIME)
- updated_at (DATETIME)

### Admin Users Table
- id (INTEGER, PRIMARY KEY)
- username (TEXT, UNIQUE)
- email (TEXT, UNIQUE)
- password (TEXT)
- created_at (DATETIME)

### Address Changes Table
- id (INTEGER, PRIMARY KEY)
- user_id (INTEGER, FOREIGN KEY)
- old_address (TEXT)
- new_address (TEXT)
- changed_at (DATETIME)

## File Import Format

The system supports CSV and Excel files with the following fields:
- Client Number
- Name
- First Name
- Last Name
- Phone Number
- Alt Number
- Address
- Email
- Alt Email

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Secure email verification
- Input validation with Express Validator
- XSS protection
- CSRF protection
- Secure file upload handling

## API Endpoints

### User Endpoints
- POST /api/verify - Submit verification
- GET /api/verify/:token - Verify email token

### Admin Endpoints
- GET /api/admin/check-setup - Check if admin account exists
- POST /api/admin/login - Admin login
- GET /api/admin/check-auth - Check authentication
- POST /api/admin/upload - Upload users file
- GET /api/admin/users - Get users with pagination
- GET /api/admin/users/search - Search users
- GET /api/admin/users/:id - Get user details
- DELETE /api/admin/users/:id - Delete user
- GET /api/admin/stats - Get dashboard stats

## Dependencies

### Production
- express: Web framework
- sqlite3: Database
- bcrypt: Password hashing
- jsonwebtoken: JWT authentication
- nodemailer: Email sending
- multer: File upload handling
- xlsx: Excel file processing
- csv-parse: CSV file processing
- cors: Cross-origin resource sharing
- dotenv: Environment variables
- express-validator: Input validation

### Development
- nodemon: Development server with auto-reload

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 