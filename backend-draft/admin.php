<?php
session_start();
require_once 'db.php';

// Check if user is admin
if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    header("Location: login.php");
    exit();
}

// Get stats for dashboard
$stmt = $pdo->query("SELECT COUNT(*) as total_books FROM books");
$totalBooks = $stmt->fetch()['total_books'];

$stmt = $pdo->query("SELECT COUNT(*) as total_users FROM users");
$totalUsers = $stmt->fetch()['total_users'];

$stmt = $pdo->query("SELECT COUNT(*) as total_orders FROM orders");
$totalOrders = $stmt->fetch()['total_orders'];

$stmt = $pdo->query("SELECT SUM(total_amount) as total_revenue FROM orders");
$totalRevenue = $stmt->fetch()['total_revenue'] ?? 0;

// Get recent orders
$stmt = $pdo->query("SELECT o.order_id, u.email, o.order_date, o.total_amount, o.status 
                     FROM orders o JOIN users u ON o.user_id = u.user_id 
                     ORDER BY o.order_date DESC LIMIT 5");
$recentOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get recent users
$stmt = $pdo->query("SELECT user_id, first_name, last_name, email, created_at 
                     FROM users ORDER BY created_at DESC LIMIT 5");
$recentUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get recently added books
$stmt = $pdo->query("SELECT book_id, title, author, created_at 
                     FROM books ORDER BY created_at DESC LIMIT 5");
$recentBooks = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!-- Update your admin dashboard to display the dynamic data -->
<div class="row mb-4">
    <div class="col-md-3 mb-3">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Total Books</h5>
                <h2 class="card-text"><?= $totalBooks ?></h2>
            </div>
        </div>
    </div>
    <!-- Other stats cards -->
</div>

<!-- Recent Orders Table -->
<?php foreach ($recentOrders as $order): ?>
<tr>
    <td>#ORD-<?= $order['order_id'] ?></td>
    <td><?= htmlspecialchars($order['email']) ?></td>
    <td><?= $order['total_amount'] ?></td>
    <td><?= $order['status'] ?></td>
    <td><a href="order-details.php?id=<?= $order['order_id'] ?>" class="btn btn-sm btn-custom">View</a></td>
</tr>
<?php endforeach; ?>