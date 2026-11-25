<?php
session_start();
require_once 'db.php';
require_once 'header.php';

// Handle adding to cart
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['book_id'])) {
    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }
    
    $bookId = $_POST['book_id'];
    $quantity = $_POST['quantity'] ?? 1;
    
    if (isset($_SESSION['cart'][$bookId])) {
        $_SESSION['cart'][$bookId] += $quantity;
    } else {
        $_SESSION['cart'][$bookId] = $quantity;
    }
    
    header("Location: cart.php");
    exit();
}

// Handle removing from cart
if (isset($_GET['remove'])) {
    $bookId = $_GET['remove'];
    if (isset($_SESSION['cart'][$bookId])) {
        unset($_SESSION['cart'][$bookId]);
    }
    header("Location: cart.php");
    exit();
}

// Handle updating quantities
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_cart'])) {
    foreach ($_POST['quantity'] as $bookId => $quantity) {
        if ($quantity > 0) {
            $_SESSION['cart'][$bookId] = $quantity;
        } else {
            unset($_SESSION['cart'][$bookId]);
        }
    }
    header("Location: cart.php");
    exit();
}

// Get cart items with book details
$cartItems = [];
$total = 0;

if (isset($_SESSION['cart']) && !empty($_SESSION['cart'])) {
    $bookIds = array_keys($_SESSION['cart']);
    $placeholders = implode(',', array_fill(0, count($bookIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM books WHERE book_id IN ($placeholders)");
    $stmt->execute($bookIds);
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($books as $book) {
        $quantity = $_SESSION['cart'][$book['book_id']];
        $subtotal = $book['price'] * $quantity;
        $total += $subtotal;
        
        $cartItems[] = [
            'book' => $book,
            'quantity' => $quantity,
            'subtotal' => $subtotal
        ];
    }
}
?>

<!-- Update your cart HTML to display $cartItems -->
<?php foreach ($cartItems as $item): ?>
<tr>
    <td>
        <div class="d-flex align-items-center">
            <img src="<?= htmlspecialchars($item['book']['cover_image']) ?>" class="cart-item-img me-3" alt="Book cover">
            <div>
                <h6 class="mb-1"><?= htmlspecialchars($item['book']['title']) ?></h6>
                <p class="mb-0 text-muted small">by <?= htmlspecialchars($item['book']['author']) ?></p>
            </div>
        </div>
    </td>
    <td>$<?= number_format($item['book']['price'], 2) ?></td>
    <td>
        <input type="number" name="quantity[<?= $item['book']['book_id'] ?>]" value="<?= $item['quantity'] ?>" min="1" class="form-control form-control-sm bg-dark text-white border-secondary quantity-selector">
    </td>
    <td>$<?= number_format($item['subtotal'], 2) ?></td>
    <td class="text-end">
        <a href="cart.php?remove=<?= $item['book']['book_id'] ?>" class="btn btn-sm btn-outline-danger">
            <i class="fas fa-trash"></i>
        </a>
    </td>
</tr>
<?php endforeach; ?>