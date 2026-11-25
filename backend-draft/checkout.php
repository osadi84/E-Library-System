<?php
session_start();
require_once 'db.php';
require_once 'header.php';

// Redirect if cart is empty
if (!isset($_SESSION['cart']) || empty($_SESSION['cart'])) {
    header("Location: cart.php");
    exit();
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['user_id'])) {
        header("Location: login.php?redirect=checkout");
        exit();
    }
    
    // Process order
    try {
        $pdo->beginTransaction();
        
        // Create order
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, total_amount) VALUES (?, ?)");
        $stmt->execute([$_SESSION['user_id'], $_POST['total']]);
        $orderId = $pdo->lastInsertId();
        
        // Add order items
        foreach ($_SESSION['cart'] as $bookId => $quantity) {
            $stmt = $pdo->prepare("SELECT price FROM books WHERE book_id = ?");
            $stmt->execute([$bookId]);
            $book = $stmt->fetch();
            
            $stmt = $pdo->prepare("INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?, ?, ?, ?)");
            $stmt->execute([$orderId, $bookId, $quantity, $book['price']]);
        }
        
        $pdo->commit();
        
        // Clear cart
        unset($_SESSION['cart']);
        
        // Redirect to order confirmation
        header("Location: order.php?id=$orderId");
        exit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        $error = "Order processing failed: " . $e->getMessage();
    }
}

// Get cart total
$total = 0;
if (isset($_SESSION['cart'])) {
    $bookIds = array_keys($_SESSION['cart']);
    $placeholders = implode(',', array_fill(0, count($bookIds), '?'));
    $stmt = $pdo->prepare("SELECT book_id, price FROM books WHERE book_id IN ($placeholders)");
    $stmt->execute($bookIds);
    
    while ($book = $stmt->fetch()) {
        $total += $book['price'] * $_SESSION['cart'][$book['book_id']];
    }
}
?>

<!-- Your checkout form with the calculated total -->
<input type="hidden" name="total" value="<?= $total ?>">