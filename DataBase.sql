create database Frass;
use Frass;
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100),
    password VARCHAR(50)
);
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50),
    roll VARCHAR(20),
    dept VARCHAR(40),
    gen VARCHAR(10),
    dob DATE,
    email VARCHAR(100),
    contact VARCHAR(15),
    face_encoding TEXT  -- will store JSON later
);
desc students;

