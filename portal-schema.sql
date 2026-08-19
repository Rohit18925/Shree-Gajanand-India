PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'supervisor')),
  site_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  father_name TEXT,
  date_of_birth TEXT,
  mobile TEXT,
  address TEXT,
  aadhaar_last4 TEXT,
  pan TEXT,
  bank_account TEXT,
  ifsc TEXT,
  uan TEXT,
  esic TEXT,
  joining_date TEXT,
  designation TEXT,
  site_id INTEGER,
  shift TEXT,
  monthly_salary REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'suspended')),
  photo_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'weekly_off', 'holiday', 'half_day')),
  in_time TEXT,
  out_time TEXT,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  marked_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (employee_id, work_date),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS daily_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  shift TEXT,
  category TEXT,
  caption TEXT,
  image_url TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS salary_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  salary_month TEXT NOT NULL,
  gross_salary REAL NOT NULL DEFAULT 0,
  working_days REAL NOT NULL DEFAULT 0,
  present_days REAL NOT NULL DEFAULT 0,
  overtime_amount REAL NOT NULL DEFAULT 0,
  pf_deduction REAL NOT NULL DEFAULT 0,
  esic_deduction REAL NOT NULL DEFAULT 0,
  advance_deduction REAL NOT NULL DEFAULT 0,
  other_deduction REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (employee_id, salary_month),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_site_date ON attendance(site_id, work_date);
CREATE INDEX IF NOT EXISTS idx_daily_photos_site_date ON daily_photos(site_id, work_date);
CREATE INDEX IF NOT EXISTS idx_salary_month ON salary_records(salary_month);
