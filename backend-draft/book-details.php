<?php
require_once 'db.php';
require_once 'header.php';

if (!isset($_GET['id'])) {
    header("Location: index.php");
    exit();
}

$bookId = $_GET['id'];
$stmt = $pdo->prepare("SELECT * FROM books WHERE book_id = ?");
$stmt->execute([$bookId]);
$book = $stmt->fetch();

if (!$book) {
    header("Location: index.php");
    exit();
}
?>

<!-- Your book details HTML, populated with $book data -->
<h1><?= htmlspecialchars($book['title']) ?></h1>
<p>by <?= htmlspecialchars($book['author']) ?></p>
<p>$<?= number_format($book['price'], 2) ?></p>
<p><?= htmlspecialchars($book['description']) ?></p>

<!-- Add to cart form -->
<form action="cart.php" method="POST">
    <input type="hidden" name="book_id" value="<?= $book['book_id'] ?>">
    <input type="number" name="quantity" value="1" min="1" max="10">
    <button type="submit" class="btn btn-custom">Add to Cart</button>
</form>