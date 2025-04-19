<div align="center">

# Roomie 🏠

### Comprehensive Documentation for Developers

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 📑 Table of Contents

- [📘 Introduction](#introduction)
- [🏗️ Architecture Overview](#architecture-overview)
- [⚙️ Development Setup](#development-setup)
- [🧩 Core Components](#core-components)
- [🔌 API Documentation](#api-documentation)
- [💾 Database Schema](#database-schema)
- [🔐 Authentication Flow](#authentication-flow)
- [🚀 Deployment Guide](#deployment-guide)
- [🧪 Testing](#testing)
- [🔧 Troubleshooting](#troubleshooting)
- [❓ FAQs](#faqs)

---

## 📘 Introduction

Roomie is a full-stack web application designed to simplify expense management for roommates. This document provides detailed technical information for developers working on the project.

---

## 🏗️ Architecture Overview

### System Architecture

Roomie follows a client-server architecture with a clear separation of concerns:

<div align="center">

| Component | Description |
|-----------|-------------|
| **Frontend** | React-based single-page application (SPA) |
| **Backend** | Node.js/Express RESTful API server |
| **Database** | MongoDB document database |
| **Authentication** | JWT-based authentication system |

</div>

### Technology Stack Details

#### Frontend

<table>
  <tr>
    <td><strong>React</strong></td>
    <td>UI library for building component-based interfaces</td>
  </tr>
  <tr>
    <td><strong>TypeScript</strong></td>
    <td>Static typing for improved code quality</td>
  </tr>
  <tr>
    <td><strong>Tailwind CSS</strong></td>
    <td>Utility-first CSS framework</td>
  </tr>
  <tr>
    <td><strong>Shadcn UI</strong></td>
    <td>Component library built on Radix UI</td>
  </tr>
  <tr>
    <td><strong>React Query</strong></td>
    <td>Data fetching and state management</td>
  </tr>
  <tr>
    <td><strong>React Hook Form</strong></td>
    <td>Form handling with validation</td>
  </tr>
  <tr>
    <td><strong>Zod</strong></td>
    <td>Schema validation library</td>
  </tr>
</table>

#### Backend

<table>
  <tr>
    <td><strong>Node.js</strong></td>
    <td>JavaScript runtime</td>
  </tr>
  <tr>
    <td><strong>Express</strong></td>
    <td>Web framework for Node.js</td>
  </tr>
  <tr>
    <td><strong>MongoDB</strong></td>
    <td>NoSQL database</td>
  </tr>
  <tr>
    <td><strong>Mongoose</strong></td>
    <td>MongoDB object modeling</td>
  </tr>
  <tr>
    <td><strong>JWT</strong></td>
    <td>JSON Web Tokens for authentication</td>
  </tr>
  <tr>
    <td><strong>SendGrid</strong></td>
    <td>Email service provider</td>
  </tr>
</table>

---

## ⚙️ Development Setup

### Prerequisites

<div align="center">

| Requirement | Version |
|-------------|----------|
| Node.js | v14 or higher |
| npm | v6 or higher |
| MongoDB | Local or Atlas connection |

</div>

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/roomie

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=your_email@example.com

# Application URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### Installation Steps

<details>
<summary><strong>1. Clone the repository</strong></summary>

```bash
git clone https://github.com/yourusername/roomie.git
cd roomie
```
</details>

<details>
<summary><strong>2. Install dependencies</strong></summary>

```bash
npm install
```
</details>

<details>
<summary><strong>3. Start the development server</strong></summary>

```bash
# Start both frontend and backend in development mode
npm run dev

# Start only frontend
npm run dev:client

# Start only backend
npm run dev:server
```
</details>

---

## 🧩 Core Components

### Frontend Structure

```
/client
  /src
    /components      # Reusable UI components
      /ui            # Basic UI elements
      /layout        # Layout components
      /forms         # Form components
    /pages           # Application pages
    /hooks           # Custom React hooks
    /lib             # Utility functions
      /api.ts        # API client
      /auth.ts       # Authentication utilities
      /validation.ts # Validation schemas
    /context         # React context providers
    /types           # TypeScript type definitions
```

### Backend Structure

```
/server
  /routes.ts         # API route definitions
  /auth.ts           # Authentication logic
  /storage.ts        # Database operations
  /email.ts          # Email sending functionality
  /penalty-checker.ts # Automated penalty system
  /middleware        # Express middleware
  /utils             # Utility functions
```

---

## 🔌 API Documentation

### Authentication Endpoints

<details>
<summary><strong>POST /api/auth/register</strong> - Register a new user account</summary>

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "flatName": "Happy Home"
}
```

#### Response:
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "Admin"
  },
  "token": "jwt_token"
}
```
</details>

<details>
<summary><strong>POST /api/auth/login</strong> - Authenticate a user and get a JWT token</summary>

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Response:
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "Admin"
  },
  "token": "jwt_token"
}
```
</details>

### User Management Endpoints

<details>
<summary><strong>POST /api/users/invite</strong> - Invite a new user to the flat</summary>

#### Request Body:
```json
{
  "email": "newuser@example.com",
  "role": "User"
}
```

#### Response:
```json
{
  "message": "Invitation sent successfully",
  "inviteId": "invite_id"
}
```
</details>

### Entries Endpoints

<details>
<summary><strong>GET /api/entries</strong> - Get all entries for the current user's flat</summary>

#### Response:
```json
{
  "entries": [
    {
      "id": "entry_id",
      "name": "Groceries",
      "amount": 50.25,
      "date": "2023-05-15T10:30:00Z",
      "createdBy": "user_id",
      "status": "Approved"
    }
  ]
}
```
</details>

<details>
<summary><strong>POST /api/entries</strong> - Create a new entry</summary>

#### Request Body:
```json
{
  "name": "Electricity Bill",
  "amount": 75.50,
  "date": "2023-05-20T14:00:00Z"
}
```

#### Response:
```json
{
  "id": "entry_id",
  "name": "Electricity Bill",
  "amount": 75.50,
  "date": "2023-05-20T14:00:00Z",
  "createdBy": "user_id",
  "status": "Pending"
}
```
</details>

---

## 💾 Database Schema

### User Collection

```typescript
interface User {
  _id: ObjectId;
  email: string;
  password: string; // Hashed
  name: string;
  role: "Admin" | "Co-Admin" | "User";
  flatId: ObjectId;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Flat Collection

```typescript
interface Flat {
  _id: ObjectId;
  name: string;
  adminId: ObjectId;
  members: ObjectId[];
  penaltySettings: {
    contributionPercentage: number;
    warningPeriod: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Entry Collection

```typescript
interface Entry {
  _id: ObjectId;
  name: string;
  amount: number;
  date: Date;
  flatId: ObjectId;
  createdBy: ObjectId;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: Date;
  updatedAt: Date;
}
```

### Bill Collection

```typescript
interface Bill {
  _id: ObjectId;
  name: string;
  items: {
    name: string;
    amount: number;
  }[];
  totalAmount: number;
  splitAmount: number;
  flatId: ObjectId;
  createdBy: ObjectId;
  payments: {
    userId: ObjectId;
    status: "Paid" | "Pending";
    paidAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Penalty Collection

```typescript
interface Penalty {
  _id: ObjectId;
  userId: ObjectId;
  flatId: ObjectId;
  amount: number;
  reason: string;
  type: "LatePayment" | "Damage" | "RuleViolation" | "MinimumEntry";
  status: "Active" | "Resolved";
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔐 Authentication Flow

<div align="center">

| Step | Description |
|------|-------------|
| **Registration** | • User registers with email, password, name, and flat name<br>• System creates a new user with Admin role<br>• System creates a new flat with the user as admin<br>• JWT token is generated and returned |
| **Login** | • User provides email and password<br>• System validates credentials<br>• JWT token is generated and returned |
| **Invitation** | • Admin invites a user via email<br>• System generates a unique invitation link<br>• User clicks the link and completes registration<br>• User is added to the flat with the specified role |
| **Authentication Middleware** | • JWT token is extracted from Authorization header<br>• Token is verified using the secret key<br>• User information is attached to the request object |

</div>

---

## 🚀 Deployment Guide

### Production Build

```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Deployment Options

<details>
<summary><strong>Heroku Deployment</strong></summary>

1. Create a Heroku account and install the Heroku CLI
2. Create a new Heroku app
   ```bash
   heroku create roomie-app
   ```
3. Set environment variables
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   # Set other environment variables
   ```
4. Deploy the application
   ```bash
   git push heroku main
   ```
</details>

<details>
<summary><strong>Docker Deployment</strong></summary>

1. Build the Docker image
   ```bash
   docker build -t roomie-app .
   ```
2. Run the Docker container
   ```bash
   docker run -p 3000:3000 --env-file .env roomie-app
   ```
</details>

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run frontend tests
npm run test:client

# Run backend tests
npm run test:server
```

### Test Structure

```
/tests
  /unit          # Unit tests
  /integration   # Integration tests
  /e2e           # End-to-end tests
```

---

## 🔧 Troubleshooting

### Common Issues

<details>
<summary><strong>MongoDB Connection Issues</strong></summary>

**Problem**: Unable to connect to MongoDB

**Solution**:
- Check if MongoDB is running
- Verify the connection string in the .env file
- Ensure network connectivity to the MongoDB server
</details>

<details>
<summary><strong>JWT Authentication Issues</strong></summary>

**Problem**: Invalid token or authentication failure

**Solution**:
- Check if the JWT_SECRET is correctly set
- Verify that the token is not expired
- Ensure the token is being sent in the Authorization header
</details>

<details>
<summary><strong>Email Sending Issues</strong></summary>

**Problem**: Emails are not being sent

**Solution**:
- Verify SendGrid API key is correct
- Check email templates for errors
- Ensure the EMAIL_FROM address is verified in SendGrid
</details>

---

## ❓ FAQs

### Development FAQs

<details>
<summary><strong>Q: How do I add a new API endpoint?</strong></summary>

A: Add a new route in the server/routes.ts file and implement the corresponding controller function.
</details>

<details>
<summary><strong>Q: How do I add a new component to the frontend?</strong></summary>

A: Create a new component in the client/src/components directory and import it where needed.
</details>

<details>
<summary><strong>Q: How do I modify the database schema?</strong></summary>

A: Update the corresponding interface in the shared/schema.ts file and ensure all related code is updated accordingly.
</details>

### User FAQs

<details>
<summary><strong>Q: How do I reset my password?</strong></summary>

A: Click on the "Forgot Password" link on the login page and follow the instructions sent to your email.
</details>

<details>
<summary><strong>Q: Can I change my role in the flat?</strong></summary>

A: No, only the Admin can change user roles. Contact your flat Admin for role changes.
</details>

<details>
<summary><strong>Q: How are penalties calculated?</strong></summary>

A: Penalties are calculated based on the penalty settings configured by the Admin, which include contribution percentage and warning period.
</details>

---

<div align="center">

*This documentation is maintained by the Roomie development team. For additional support or questions, please contact us at support@roomie-app.com.*

</div>