<?php
// Start session
session_start();

// Simple header content
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My e-Library</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background-color: #121212; color: #fff; font-family: 'Segoe UI', sans-serif; }
    .navbar { background-color: #1f1f1f; }
  </style>
</head>
<body>
  <!-- Navbar -->
  <nav class="navbar navbar-expand-lg navbar-dark px-4">
    <a class="navbar-brand" href="index.php">
      <img src="logo.png" height="40" class="d-inline-block align-top" alt="">
      My e-Library
    </a>
  </nav>

<!-- Your existing index.php content goes here -->