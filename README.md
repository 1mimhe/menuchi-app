<div align="center">

<!-- Logo placeholder - Replace with your actual logo -->
<img src="./assets/logo.png" alt="MenuChi Logo" width="120">

# MenuChi

**No-Code Menu Builder for Restaurants**

*Empowering restaurant owners to create interactive digital menus effortlessly*

[![](https://img.shields.io/badge/Database%20Schema-8A2BE2)](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6) [![Frontend Repository](https://img.shields.io/badge/Frontend%20Repository-blue)](https://github.com/asAlwaysZahra/menuchi-angular-frontend)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

[![AWS S3](https://img.shields.io/badge/AWS%20S3-FF9900?style=for-the-badge&logo=amazon-s3&logoColor=white)](https://aws.amazon.com/s3/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![TSOA](https://img.shields.io/badge/TSOA-FF6B6B?style=for-the-badge)](https://tsoa-community.github.io/docs/)

</div>

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎨 **No-Code Experience**
Create and customize digital menus without any coding expertise

### 🔐 **Secure Authentication**
Role-based access control with session handling and Redis caching

</td>
<td width="50%">

### ☁️ **Cloud Storage**
AWS S3 integration for secure image and asset management

### 📖 **Auto Documentation**
Swagger API docs generated automatically with TSOA

</td>
</tr>
</table>

## 🔄 Workflows

MenuChi follows a flexible, hierarchical structure for menu management.

### Two Primary Workflows

1. **Backlog Management**
   - `Restaurant → Branch → Backlog → Categories → Items`
   - Create a restaurant, which automatically generates a default branch and its backlog.
   - Within the backlog, create categories and add items to those categories.

2. **Menu Publishing** 
   - `Branch → Menu → Cylinder → MenuCategory → Items`
   - Create a menu for a branch.
   - Define cylinders, which represent a combination of days (e.g., specific days or recurring schedules like Monday–Friday) to control menu availability.
   - Within each cylinder, select categories from the backlog and include specific items, allowing reuse of categories across different cylinders with unused items.

## 🔐 Authentication Methods

| User Type | Method | Description |
|-----------|--------|-------------|
| **Restaurant Owner** | Phone Number + Password | Secure login for restaurant management |
| **Customer** | Email OTP | Quick one-time password access for ordering |

## 📦 Order Management

### Simple & Efficient Order Handling

- **📝 Order Placement**: Customers place orders through interactive menus
- **📊 Status Tracking**: Real-time order status updates (PENDING → PREPARING → DONE)
- **🔗 Item Linking**: Orders connected to specific menu items with quantities and prices
- **📋 Dashboard Management**: Restaurant owners manage orders through intuitive dashboard

## 📁 Project Structure

```
MenuChi
├── 📂 src
│   ├── config/              # Configuration files
│   │   ├── OtpRedisClient.ts
│   │   ├── RedisClient.ts
│   │   ├── SessionConfig.ts
│   │   ├── swagger.json
│   │   └── TransformersRedisClient.ts
│   ├── controllers/          # API request handlers
│   │   ├── AuthController.ts
│   │   ├── BacklogController.ts
│   │   ├── BranchController.ts
│   │   ├── MenuController.ts
│   │   ├── OrderController.ts
│   │   └── RestaurantController.ts
│   ├── db/                  # Database configuration
│   │   ├── prisma.ts
│   │   └── schema.prisma
│   ├── exceptions/          # Custom error classes
│   ├── middlewares/         # Express middleware
│   ├── services/            # Business logic
│   ├── types/               # TypeScript definitions
│   └── utils/               # Utility functions
├── test/                    # Unit tests
└── Dockerfile               # Container configuration
```

## 🌍 Environment Setup

Create a `.env` file with the following configuration:

```bash
# 🚀 Server Configuration
PORT=3000
MENUCHI_FRONT_URL=http://localhost:3001

# 🗄️ Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/menuchi

# 🔴 Redis Configuration
REDIS_URL=redis://:@localhost:6379
TRANSFORMERS_REDIS_URL=redis://:@localhost:6379/1
OTP_REDIS_URL=redis://:@localhost:32768/5

# 📧 External Services
TRANSFORMERS_STREAM=images
OTP_STREAM=otps
INTERNAL_OTP_URL=http://otp-service:3000
INTERNAL_OTP_ENDPOINT=/verify

# ☁️ AWS S3 Storage
S3_BUCKETNAME=menuchi-bucket
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESSKEYID=your-access-key-id
S3_SECRETACCESSKEY=your-secret-access-key
S3_DEFAULT_KEY=default-key

# 🔐 Security
SESSION_SECRET=your-session-secret
COOKIE_PRIVATE_KEY=your-cookie-private-key
JWT_PRIVATE_KEY=your-jwt-private-key
```

> ⚠️ **Important**: Replace placeholder values with your actual credentials

## 🗄️ Database Schema

The database schema is defined using Prisma and PostgreSQL. A visual representation is available at [DBDiagram](https://dbdiagram.io/d/menuchi-db-67d2dbb575d75cc844f75bb6). Key models include:

- **User**: Stores user details, authentication data, and relationships to restaurants and roles.
- **Role**: Manages RBAC with roles like ADMIN, RESTAURANT_OWNER, and RESTAURANT_CUSTOMER.
- **Restaurant**: Represents a restaurant with details like name, social media links, and associated branches.
- **Branch**: Represents a restaurant branch with address, opening times, and menus.
- **Menu**: Stores menu details with associated cylinders (scheduling) and orders.
- **CategoryName**: Defines reusable category names for menu items.
- **Category**: Links categories to backlogs and menu categories.
- **Item**: Represents menu items with details like price, ingredients, and position.
- **Cylinder**: Manages menu scheduling (e.g., daily availability).
- **Order**: Tracks customer orders with status and associated items.
- **OrderItem**: Links orders to specific menu items.
- **Address**: Stores branch addresses.
- **OpeningTimes**: Manages branch operating hours.

See `src/db/schema.prisma` for the complete schema.

## ⚠️ Error Handling System

MenuChi implements a sophisticated error handling system with **entity-specific error codes**:

### 🏷️ Entity Code Mapping

| Entity | Code | Example |
|--------|------|---------|
| 🌐 General | 0 | `4000` |
| 🏪 Restaurant | 1 | `4041` |
| 📂 CategoryName | 2 | `4042` |
| 🍕 Item | 3 | `4043` |
| ☁️ S3 | 4 | `4044` |
| 👤 User | 5 | `4045` |

### 🛡️ Error Classes

- `MenuchiError` - Base error class
- `AuthError` - Authentication failures
- `DatabaseError` - Database operation errors
- `NotFoundError` - Resource not found
- `ValidationError` - Input validation errors

## 🔗 External Services

### 🖼️ **Transformers Service**
Image processing and compression via Redis Streams

### 📧 **OTP Service**
Email-based one-time password authentication

> 💡 Both services are part of the MenuChi ecosystem and communicate via Redis Streams

## 🚀 Setup and Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/menuchi-project/menuchi-app.git
   cd menuchi-app
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:

   - Copy the `.env.example` to `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

4. **Set Up PostgreSQL**:

   - Ensure PostgreSQL is running and create a database named `menuchi`.
   - Update `DATABASE_URL` in the `.env` file.

5. **Set Up Redis**:

   - Ensure Redis is running and update `REDIS_URL`, `TRANSFORMERS_REDIS_URL`, and `OTP_REDIS_URL` in the `.env` file.

6. **Set Up AWS S3**:

   - Configure S3 credentials (`S3_BUCKETNAME`, `S3_ENDPOINT`, `S3_ACCESSKEYID`, `S3_SECRETACCESSKEY`) in the `.env` file.

7. **Run Database Migrations**:

   ```bash
   npx prisma migrate dev
   ```

## Running the Application

1. **Development Mode**:

   ```bash
   npm run dev
   ```

   This generates TSOA routes and Swagger docs before starting the server.

2. **Production Mode**:

   ```bash
   npm run build
   npm start
   ```

3. **Docker**:

   ```bash
   docker build -t menuchi .
   docker run -p 3000:3000 --env-file .env menuchi
   ```

The application will be available at `http://localhost:3000`. Swagger documentation is accessible at `http://localhost:3000/docs`.

## 🧪 Testing

MenuChi's testing suite leverages **Vitest** for efficient unit testing, focusing on services and API endpoints. Tests use real **Prisma** queries to validate database interactions without mocking the Prisma client, ensuring accurate query-based logic. Authentication endpoints are tested with **Supertest** to simulate HTTP requests.

### Key Testing Features

- **Real Prisma Queries**: Tests execute actual database queries to verify service logic.
- **Supertest for Auth**: Authentication endpoints (e.g., login, OTP verification) are tested via HTTP requests.
- **Mocked Dependencies**: External services (e.g., S3, Redis) are mocked for isolation.
- **Organized Tests**: Tests are structured by controller in `test/routers`.

### Test Structure

```
test
├── routers
│   ├── Auth.test.ts        # Authentication endpoint tests (Supertest)
│   ├── Backlog.test.ts     # Backlog functionality tests
│   ├── Branch.test.ts      # Branch functionality tests
│   ├── CategoryName.test.ts # Category name tests
│   ├── Menu.test.ts        # Menu management tests
│   └── Restaurant.test.ts  # Restaurant functionality tests
├── agents.ts               # Supertest agent setup
├── factories.ts           # Test data factories
├── vitest.config.ts       # Vitest configuration
└── vitest.setup.ts        # Test setup utilities
```

### Running Tests

Configure `.env.test` with test-specific variables (e.g., test database URL) and run:

```bash
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by the [MenuChi Team](https://github.com/menuchi-project)**

</div>
