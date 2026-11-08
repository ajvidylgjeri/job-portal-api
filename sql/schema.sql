CREATE DATABASE IF NOT EXISTS job_portal_db;
USE job_portal_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,          -- bcrypt hash
  role ENUM('candidate','employer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  company VARCHAR(150) NOT NULL,
  location VARCHAR(150) NOT NULL,
  salary DECIMAL(12,2) NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  job_type ENUM('full-time','part-time','internship') NOT NULL,
  employer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_location (location),
  INDEX idx_type (job_type)
);

CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  candidate_id INT NOT NULL,
  status ENUM('applied','shortlisted','rejected') NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_job_candidate (job_id, candidate_id)   -- one application per job
);
