# My e-Library – Online Bookstore & E-Library

A responsive web-based online bookstore and e-library that allows readers to browse books, manage wishlists, add books to a shopping cart, place orders, and write reviews. It also provides an admin dashboard for managing books, users, orders, and customer messages.

Developed using **HTML5, CSS3, JavaScript, and Bootstrap 5**. The application uses browser `localStorage` for data storage and runs without a backend server.

## Features

### 1. Home Page and Book Browsing
- Featured books and book collections.
- Live book search.
- Category-based browsing.
- Responsive navigation.
- Book catalogue with filtering, sorting, and pagination.
- Book details with descriptions, prices, ratings, and similar books.

### 2. User Account Management
- User registration and login.
- Remember Me functionality.
- User-specific shopping cart and wishlist.
- Role-based user and admin interfaces.
- Logout functionality.

### 3. Shopping Cart and Wishlist
- Add books to the shopping cart.
- Update book quantities and remove items.
- Add and remove books from the wishlist.
- Add all wishlist items to the cart.
- Guest cart support and account cart merging after login.

### 4. Checkout and Order Management
- Four-step shopping process with shipping, payment, order review, and completion.
- Multiple demo payment methods:
  - Cash on Delivery
  - Bank Transfer
  - Card Payment (Demo)
- Automatic shipping fee calculation.
- Order number generation.
- Order history and order details.
- Order status tracking and cancellation.
- Printable order details.

### 5. Book Reviews
- Submit ratings from 1 to 5 stars.
- Write reviews after logging in.
- Calculate average book ratings from submitted reviews.

### 6. Admin Dashboard
- Dashboard statistics for books, users, orders, and revenue.
- Add and delete books.
- Manage user accounts.
- Update order statuses.
- View and delete customer messages.
- Export and import application data using JSON.
- Reset demo data.

### 7. Additional Pages
- About Us
- Blog
- Contact Us
- Help
- Privacy Policy
- Terms and Conditions

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Web page structure |
| CSS3 | Styling and responsive layouts |
| JavaScript | Application logic and functionality |
| Bootstrap 5 | Responsive UI components |
| localStorage | Client-side data storage |
| SVG | Generated book covers, banners, and avatars |
| Node.js | Automated testing environment |
| jsdom | DOM-based testing |
| GitHub Actions | Continuous Integration (CI) |

## System Architecture

The application follows a client-side architecture without a backend server.

The main JavaScript application (`js/app.js`) manages the storage layer, data initialization, Store API, UI helpers, and page controllers.

**Main components:**

1. **Storage Layer:** Stores and retrieves application data using browser localStorage, with an in-memory fallback.
2. **Data Initialization:** Loads initial demo data using `js/seed-books.js`.
3. **Store API:** Handles books, users, authentication, cart, wishlist, orders, reviews, messages, and data management.
4. **UI Helpers:** Manages notifications, navigation badges, login information, and accessibility labels.
5. **Page Controllers:** Controls page-specific functionality based on the current page.

## Sample Data

The application includes demonstration data:

- 56 books across Fiction, Non-Fiction, Textbook, and Classic categories.
- 6 featured books.
- 50 additional books for collections.
- Demo user and admin accounts.
- Sample orders for dashboard demonstration.

Initial data is loaded when the application is accessed for the first time.

## Security and Testing

- Passwords are hashed using SHA-256 before being stored.
- User-provided text is HTML-escaped to reduce XSS risks.
- Order totals are recalculated using stored book prices.
- Login redirect parameters are validated.
- Automated testing includes 46 checks.
- GitHub Actions is configured for continuous integration.

Run the automated tests using:

```bash
npm test
```

## Installation and Usage

1. Clone the repository:

```bash
git clone https://github.com/YOUR-USERNAME/e-library.git
```

2. Open the project folder.

3. Open `index.html` in a web browser or use VS Code Live Server.

4. Explore the bookstore, create a demo account, browse books, and test the shopping features.

## Deployment

The application can be hosted using GitHub Pages because it does not require a backend server.

## Limitations

- All application data is stored locally in the user's browser.
- Data is not shared between different users or devices.
- Authentication and admin access are client-side only and are not suitable for production security.
- Payment processing and delivery operations are simulated.
- No real payment card details are collected.
- Only two educational textbooks currently support actual online reading and PDF downloading.
- Some informational pages contain static content.

**Note:** This project is intended as an academic demonstration and portfolio project. It should not be used to store real user credentials, sensitive personal information, or process actual payments.

## Future Improvements

- Implement a secure backend and centralized database.
- Introduce server-side authentication and authorization.
- Integrate real payment gateway functionality.
- Implement centralized inventory and order management.
- Improve user data security and scalability.

## Author

Developed as a personal web development project to demonstrate frontend development, application logic, data management, responsive design, and software testing.

**Technologies:** HTML5 | CSS3 | JavaScript | Bootstrap 5

---

*Thank you for visiting My e-Library!*
