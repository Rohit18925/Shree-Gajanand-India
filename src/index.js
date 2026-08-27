const SESSION_COOKIE = "sgi_session";
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/portal") {
      return Response.redirect(`${url.origin}/portal/login.html`, 302);
    }

    if (url.pathname.startsWith("/portal/api/")) {
      return handlePortalApi(request, env, url);
    }

    if (url.pathname === "/submit-form") {
      return handleContactForm(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handlePortalApi(request, env, url) {
  if (!env.DB) return apiError("Portal database is not configured.", 503);

  if (url.pathname === "/portal/api/setup-status" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
    return apiOk({ setupRequired: Number(row?.count || 0) === 0 });
  }

  if (url.pathname === "/portal/api/setup" && request.method === "POST") {
    return setupFirstAdmin(request, env);
  }

  if (url.pathname === "/portal/api/login" && request.method === "POST") {
    return login(request, env);
  }

  if (url.pathname === "/portal/api/logout" && request.method === "POST") {
    return logout(request, env);
  }

  const auth = await authenticate(request, env);
  if (!auth) return apiError("Unauthorized.", 401);

  if (url.pathname === "/portal/api/me" && request.method === "GET") {
    return apiOk({ user: publicUser(auth.user) });
  }
  if (url.pathname === "/portal/api/dashboard" && request.method === "GET") {
  return dashboard(env, auth.user);
}

  if (url.pathname === "/portal/api/sites" && request.method === "GET") {
  let result;

  if (auth.user.role === "supervisor") {
    if (!auth.user.site_id) {
      return apiOk({ sites: [] });
    }

    result = await env.DB.prepare(
      `SELECT id, site_code, name, location, is_active, created_at
       FROM sites
       WHERE id = ?
       ORDER BY name COLLATE NOCASE ASC`
    ).bind(auth.user.site_id).all();
  } else {
    result = await env.DB.prepare(
      `SELECT id, site_code, name, location, is_active, created_at
       FROM sites
       ORDER BY is_active DESC, name COLLATE NOCASE ASC`
    ).all();
  }

  return apiOk({ sites: result.results || [] });
}

if (url.pathname === "/portal/api/sites" && request.method === "POST") {
  if (auth.user.role !== "admin") {
    return apiError("Only Admin can create sites.", 403);
  }

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const siteCode = clean(body.siteCode, 30).toUpperCase();
  const name = clean(body.name, 120);
  const location = clean(body.location, 200);

  if (!siteCode || !name) {
    return apiError("Site code and site name are required.", 400);
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO sites (site_code, name, location, is_active, created_at) VALUES (?, ?, ?, 1, ?)"
    ).bind(
      siteCode,
      name,
      location || null,
      new Date().toISOString()
    ).run();

    return apiOk({
      message: "Site created successfully.",
      siteId: result.meta?.last_row_id
    }, 201);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return apiError("This site code already exists.", 409);
    }
    throw error;
  }
}

if (url.pathname === "/portal/api/sites" && request.method === "PUT") {
  if (auth.user.role !== "admin") {
    return apiError("Only Admin can update sites.", 403);
  }

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const id = Number(body.id);
  const siteCode = clean(body.siteCode, 30).toUpperCase();
  const name = clean(body.name, 120);
  const location = clean(body.location, 200);
  const isActive = Number(body.isActive) === 0 ? 0 : 1;

  if (!Number.isInteger(id) || id <= 0 || !siteCode || !name) {
    return apiError("Valid site ID, site code and site name are required.", 400);
  }

  try {
    const result = await env.DB.prepare(
      `UPDATE sites
       SET site_code = ?, name = ?, location = ?, is_active = ?
       WHERE id = ?`
    ).bind(
      siteCode,
      name,
      location || null,
      isActive,
      id
    ).run();

    if (!result.meta?.changes) {
      return apiError("Site not found.", 404);
    }

    return apiOk({ message: "Site updated successfully." });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return apiError("This site code already exists.", 409);
    }
    throw error;
  }
}

const siteDeleteMatch = url.pathname.match(/^\/portal\/api\/sites\/(\d+)$/);

if (siteDeleteMatch && request.method === "DELETE") {
  if (auth.user.role !== "admin") {
    return apiError("Only Admin can delete sites.", 403);
  }

  const siteId = Number(siteDeleteMatch[1]);

  const site = await env.DB.prepare(
    "SELECT id, site_code, name FROM sites WHERE id = ? LIMIT 1"
  ).bind(siteId).first();

  if (!site) {
    return apiError("Site not found.", 404);
  }

  const employeeRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM employees WHERE site_id = ?"
  ).bind(siteId).first();

  const userRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE site_id = ?"
  ).bind(siteId).first();

  const attendanceRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM attendance WHERE site_id = ?"
  ).bind(siteId).first();

  const photoRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM daily_photos WHERE site_id = ?"
  ).bind(siteId).first();

  const linked =
    Number(employeeRow?.count || 0) +
    Number(userRow?.count || 0) +
    Number(attendanceRow?.count || 0) +
    Number(photoRow?.count || 0);

  if (linked > 0) {
    return apiError(
      "This site cannot be deleted because employees, users, attendance or photo records are linked. Deactivate the site instead.",
      409
    );
  }

  await env.DB.prepare(
    "DELETE FROM sites WHERE id = ?"
  ).bind(siteId).run();

  return apiOk({
    message: "Site deleted successfully."
  });
}

if (url.pathname === "/portal/api/employees" && request.method === "GET") {
  if (auth.user.role !== "admin" && auth.user.role !== "hr") {
    return apiError("You do not have access to employee records.", 403);
  }

  const result = await env.DB.prepare(
    `SELECT
      e.id,
      e.employee_code,
      e.full_name,
      e.mobile,
      e.designation,
      e.joining_date,
      e.shift,
      e.monthly_salary,
      e.status,
      e.site_id,
      s.site_code,
      s.name AS site_name,
      s.is_active AS site_is_active
    FROM employees e
    LEFT JOIN sites s ON s.id = e.site_id
    ORDER BY
      CASE e.status
        WHEN 'active' THEN 1
        WHEN 'suspended' THEN 2
        ELSE 3
      END,
      e.full_name COLLATE NOCASE ASC`
  ).all();

  return apiOk({ employees: result.results || [] });
}
if (url.pathname === "/portal/api/employees" && request.method === "POST") {
  if (auth.user.role !== "admin" && auth.user.role !== "hr") {
    return apiError("You do not have permission to add employees.", 403);
  }

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const fullName = clean(body.fullName, 120);
  const fatherName = clean(body.fatherName, 120);
  const dateOfBirth = clean(body.dateOfBirth, 20);
  const mobile = clean(body.mobile, 20);
  const address = clean(body.address, 500);
  const aadhaarLast4 = clean(body.aadhaarLast4, 4);
  const pan = clean(body.pan, 20).toUpperCase();
  const bankAccount = clean(body.bankAccount, 50);
  const ifsc = clean(body.ifsc, 20).toUpperCase();
  const uan = clean(body.uan, 30);
  const esic = clean(body.esic, 30);
  const joiningDate = clean(body.joiningDate, 20);
  const designation = clean(body.designation, 120);
  const siteId = body.siteId ? Number(body.siteId) : null;
  const shift = clean(body.shift, 50);
  const monthlySalary = Number(body.monthlySalary || 0);

  if (!fullName) {
    return apiError("Employee name is required.", 400);
  }

  if (mobile && !/^[0-9+\-\s]{7,20}$/.test(mobile)) {
    return apiError("Enter a valid mobile number.", 400);
  }

  if (aadhaarLast4 && !/^[0-9]{4}$/.test(aadhaarLast4)) {
    return apiError("Aadhaar last 4 digits must contain exactly 4 numbers.", 400);
  }

  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
    return apiError("Enter a valid monthly salary.", 400);
  }

  if (siteId !== null) {
    if (!Number.isInteger(siteId) || siteId <= 0) {
      return apiError("Select a valid site.", 400);
    }

    const site = await env.DB.prepare(
      "SELECT id FROM sites WHERE id = ? AND is_active = 1 LIMIT 1"
    ).bind(siteId).first();

    if (!site) {
      return apiError("Selected site does not exist or is inactive.", 400);
    }
  }

  const nextRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM employees"
  ).first();

  const nextId = Number(nextRow?.next_id || 1);
  const employeeCode = `SGI-${String(nextId).padStart(4, "0")}`;
  const now = new Date().toISOString();

  try {
    const result = await env.DB.prepare(
      `INSERT INTO employees (
        employee_code,
        full_name,
        father_name,
        date_of_birth,
        mobile,
        address,
        aadhaar_last4,
        pan,
        bank_account,
        ifsc,
        uan,
        esic,
        joining_date,
        designation,
        site_id,
        shift,
        monthly_salary,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).bind(
      employeeCode,
      fullName,
      fatherName || null,
      dateOfBirth || null,
      mobile || null,
      address || null,
      aadhaarLast4 || null,
      pan || null,
      bankAccount || null,
      ifsc || null,
      uan || null,
      esic || null,
      joiningDate || null,
      designation || null,
      siteId,
      shift || null,
      monthlySalary,
      now,
      now
    ).run();

    return apiOk({
      message: "Employee added successfully.",
      employeeId: result.meta?.last_row_id,
      employeeCode
    }, 201);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return apiError("Unable to generate employee code. Please try again.", 409);
    }

    throw error;
  }
}
if (url.pathname === "/portal/api/employees" && request.method === "PUT") {
  if (auth.user.role !== "admin" && auth.user.role !== "hr") {
    return apiError("You do not have permission to update employees.", 403);
  }

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const id = Number(body.id);
  const fullName = clean(body.fullName, 120);
  const fatherName = clean(body.fatherName, 120);
  const dateOfBirth = clean(body.dateOfBirth, 20);
  const mobile = clean(body.mobile, 20);
  const address = clean(body.address, 500);
  const aadhaarLast4 = clean(body.aadhaarLast4, 4);
  const pan = clean(body.pan, 20).toUpperCase();
  const bankAccount = clean(body.bankAccount, 50);
  const ifsc = clean(body.ifsc, 20).toUpperCase();
  const uan = clean(body.uan, 30);
  const esic = clean(body.esic, 30);
  const joiningDate = clean(body.joiningDate, 20);
  const designation = clean(body.designation, 120);
  const siteId = body.siteId ? Number(body.siteId) : null;
  const shift = clean(body.shift, 50);
  const monthlySalary = Number(body.monthlySalary || 0);
  const status = clean(body.status, 20).toLowerCase();

  if (!Number.isInteger(id) || id <= 0 || !fullName) {
    return apiError("Valid employee ID and employee name are required.", 400);
  }

  if (!["active", "left", "suspended"].includes(status)) {
    return apiError("Invalid employee status.", 400);
  }

  if (mobile && !/^[0-9+\-\s]{7,20}$/.test(mobile)) {
    return apiError("Enter a valid mobile number.", 400);
  }

  if (aadhaarLast4 && !/^[0-9]{4}$/.test(aadhaarLast4)) {
    return apiError("Aadhaar last 4 digits must contain exactly 4 numbers.", 400);
  }

  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
    return apiError("Enter a valid monthly salary.", 400);
  }

  if (siteId !== null) {
    const site = await env.DB.prepare(
      "SELECT id FROM sites WHERE id = ? LIMIT 1"
    ).bind(siteId).first();

    if (!site) {
      return apiError("Selected site does not exist.", 400);
    }
  }

  const result = await env.DB.prepare(
    `UPDATE employees SET
      full_name = ?,
      father_name = ?,
      date_of_birth = ?,
      mobile = ?,
      address = ?,
      aadhaar_last4 = ?,
      pan = ?,
      bank_account = ?,
      ifsc = ?,
      uan = ?,
      esic = ?,
      joining_date = ?,
      designation = ?,
      site_id = ?,
      shift = ?,
      monthly_salary = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?`
  ).bind(
    fullName,
    fatherName || null,
    dateOfBirth || null,
    mobile || null,
    address || null,
    aadhaarLast4 || null,
    pan || null,
    bankAccount || null,
    ifsc || null,
    uan || null,
    esic || null,
    joiningDate || null,
    designation || null,
    siteId,
    shift || null,
    monthlySalary,
    status,
    new Date().toISOString(),
    id
  ).run();

  if (!result.meta?.changes) {
    return apiError("Employee not found.", 404);
  }

  return apiOk({ message: "Employee updated successfully." });
}
const employeeDetailMatch = url.pathname.match(/^\/portal\/api\/employees\/(\d+)$/);

if (employeeDetailMatch && request.method === "GET") {
  if (auth.user.role !== "admin" && auth.user.role !== "hr") {
    return apiError("You do not have access to employee records.", 403);
  }

  const employeeId = Number(employeeDetailMatch[1]);

  const employee = await env.DB.prepare(
    `SELECT
      id,
      employee_code,
      full_name,
      father_name,
      date_of_birth,
      mobile,
      address,
      aadhaar_last4,
      pan,
      bank_account,
      ifsc,
      uan,
      esic,
      joining_date,
      designation,
      site_id,
      shift,
      monthly_salary,
      status,
      photo_url,
      created_at,
      updated_at
    FROM employees
    WHERE id = ?
    LIMIT 1`
  ).bind(employeeId).first();

  if (!employee) {
    return apiError("Employee not found.", 404);
  }

  return apiOk({ employee });
}

if (employeeDetailMatch && request.method === "DELETE") {
  if (auth.user.role !== "admin") {
    return apiError("Only Admin can delete employees.", 403);
  }

  const employeeId = Number(employeeDetailMatch[1]);

  const employee = await env.DB.prepare(
    "SELECT id, employee_code, full_name FROM employees WHERE id = ? LIMIT 1"
  ).bind(employeeId).first();

  if (!employee) {
    return apiError("Employee not found.", 404);
  }

  const attendanceRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM attendance WHERE employee_id = ?"
  ).bind(employeeId).first();

  const salaryRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM salary_records WHERE employee_id = ?"
  ).bind(employeeId).first();

  const attendanceCount = Number(attendanceRow?.count || 0);
  const salaryCount = Number(salaryRow?.count || 0);

  if (attendanceCount > 0 || salaryCount > 0) {
    return apiError(
      "This employee cannot be deleted because attendance or salary records are linked. Change the employee status instead.",
      409
    );
  }

  await env.DB.prepare(
    "DELETE FROM employees WHERE id = ?"
  ).bind(employeeId).run();

  return apiOk({
    message: "Employee deleted successfully."
  });
}

if (url.pathname === "/portal/api/attendance" && request.method === "GET") {

  if (
    auth.user.role !== "admin" &&
    auth.user.role !== "hr" &&
    auth.user.role !== "supervisor"
  ) {
    return apiError("You do not have access to attendance records.", 403);
  }

  const date = clean(url.searchParams.get("date"), 20);
  const requestedSiteId = url.searchParams.get("siteId");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError("Valid attendance date is required.", 400);
  }

  let siteId = requestedSiteId ? Number(requestedSiteId) : null;

  if (auth.user.role === "supervisor") {
    if (!auth.user.site_id) {
      return apiOk({ attendance: [] });
    }

    siteId = Number(auth.user.site_id);
  }

  if (siteId !== null) {
    if (!Number.isInteger(siteId) || siteId <= 0) {
      return apiError("Invalid site.", 400);
    }

    const site = await env.DB.prepare(
      "SELECT id FROM sites WHERE id = ? LIMIT 1"
    ).bind(siteId).first();

    if (!site) {
      return apiError("Site not found.", 404);
    }
  }

  let result;

  if (siteId !== null) {
    result = await env.DB.prepare(
      `SELECT
        a.id,
        a.employee_id,
        a.site_id,
        a.work_date,
        a.status,
        a.in_time,
        a.out_time,
        a.overtime_minutes,
        a.remarks,
        a.marked_by,
        a.created_at,
        a.updated_at,
        e.employee_code,
        e.full_name,
        e.designation,
        s.site_code,
        s.name AS site_name
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.work_date = ?
        AND a.site_id = ?
      ORDER BY e.full_name COLLATE NOCASE ASC`
    ).bind(date, siteId).all();
  } else {
    result = await env.DB.prepare(
      `SELECT
        a.id,
        a.employee_id,
        a.site_id,
        a.work_date,
        a.status,
        a.in_time,
        a.out_time,
        a.overtime_minutes,
        a.remarks,
        a.marked_by,
        a.created_at,
        a.updated_at,
        e.employee_code,
        e.full_name,
        e.designation,
        s.site_code,
        s.name AS site_name
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.work_date = ?
      ORDER BY
        s.name COLLATE NOCASE ASC,
        e.full_name COLLATE NOCASE ASC`
    ).bind(date).all();
  }

  return apiOk({
    attendance: result.results || []
  });
}


if (url.pathname === "/portal/api/attendance" && request.method === "POST") {
  if (
    auth.user.role !== "admin" &&
    auth.user.role !== "hr" &&
    auth.user.role !== "supervisor"
  ) {
    return apiError("You do not have permission to mark attendance.", 403);
  }

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const employeeId = Number(body.employeeId);
  const workDate = clean(body.workDate, 20);
  const status = clean(body.status, 20).toLowerCase();
  const inTime = clean(body.inTime, 10);
  const outTime = clean(body.outTime, 10);
  const overtimeMinutes = Number(body.overtimeMinutes || 0);
  const remarks = clean(body.remarks, 500);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return apiError("Valid employee is required.", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return apiError("Valid attendance date is required.", 400);
  }

  if (!["present", "absent", "leave", "weekly_off", "holiday", "half_day"].includes(status)) {
    return apiError("Invalid attendance status.", 400);
  }

  if (!Number.isInteger(overtimeMinutes) || overtimeMinutes < 0) {
    return apiError("Overtime minutes must be a valid positive number.", 400);
  }

  const employee = await env.DB.prepare(
    `SELECT id, site_id, status
     FROM employees
     WHERE id = ?
     LIMIT 1`
  ).bind(employeeId).first();

  if (!employee) {
    return apiError("Employee not found.", 404);
  }

  if (employee.status === "left") {
    return apiError("Attendance cannot be marked for an employee who has left the company.", 409);
  }

  const employeeSiteId = employee.site_id ? Number(employee.site_id) : null;

  if (!employeeSiteId) {
    return apiError("Employee does not have an assigned site.", 400);
  }

  if (auth.user.role === "supervisor") {
    if (!auth.user.site_id || Number(auth.user.site_id) !== employeeSiteId) {
      return apiError("You can only mark attendance for employees at your assigned site.", 403);
    }
  }

  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    `SELECT id
     FROM attendance
     WHERE employee_id = ? AND work_date = ?
     LIMIT 1`
  ).bind(employeeId, workDate).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE attendance SET
        site_id = ?,
        status = ?,
        in_time = ?,
        out_time = ?,
        overtime_minutes = ?,
        remarks = ?,
        marked_by = ?,
        updated_at = ?
       WHERE id = ?`
    ).bind(
      employeeSiteId,
      status,
      inTime || null,
      outTime || null,
      overtimeMinutes,
      remarks || null,
      auth.user.id,
      now,
      existing.id
    ).run();

    return apiOk({
      message: "Attendance updated successfully.",
      attendanceId: existing.id
    });
  }

  const result = await env.DB.prepare(
    `INSERT INTO attendance (
      employee_id,
      site_id,
      work_date,
      status,
      in_time,
      out_time,
      overtime_minutes,
      remarks,
      marked_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    employeeId,
    employeeSiteId,
    workDate,
    status,
    inTime || null,
    outTime || null,
    overtimeMinutes,
    remarks || null,
    auth.user.id,
    now,
    now
  ).run();

  return apiOk({
    message: "Attendance marked successfully.",
    attendanceId: result.meta?.last_row_id
  }, 201);
}
async function setupFirstAdmin(request, env) {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  if (Number(existing?.count || 0) > 0) return apiError("Portal setup is already complete.", 409);
  if (!env.PORTAL_SETUP_KEY) return apiError("PORTAL_SETUP_KEY is not configured.", 500);

  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const setupKey = clean(body.setupKey, 200);
  const fullName = clean(body.fullName, 120);
  const username = clean(body.username, 80).toLowerCase();
  const password = String(body.password || "");

  if (setupKey !== env.PORTAL_SETUP_KEY) return apiError("Invalid setup key.", 403);
  if (!fullName || !/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 10) {
    return apiError("Enter a valid name, username and a password of at least 10 characters.", 400);
  }

  const salt = randomBase64(16);
  const passwordHash = await hashPassword(password, salt);

  await env.DB.prepare(
    "INSERT INTO users (full_name, username, password_hash, password_salt, role, is_active, created_at) VALUES (?, ?, ?, ?, 'admin', 1, ?)"
  ).bind(fullName, username, passwordHash, salt, new Date().toISOString()).run();

  return apiOk({ message: "Admin account created." }, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return apiError("Invalid request.", 400);

  const username = clean(body.username, 80).toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) return apiError("Username and password are required.", 400);

  const user = await env.DB.prepare(
    "SELECT id, full_name, username, password_hash, password_salt, role, site_id, is_active FROM users WHERE username = ? LIMIT 1"
  ).bind(username).first();

  if (!user || !Number(user.is_active)) return apiError("Invalid username or password.", 401);

  const candidate = await hashPassword(password, user.password_salt);
  if (!timingSafeStringEqual(candidate, user.password_hash)) return apiError("Invalid username or password.", 401);

  const token = randomBase64(32);
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);

  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, user.id, now.toISOString(), expires.toISOString()).run();

  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now.toISOString()).run();

  return new Response(JSON.stringify({ ok: true, user: publicUser(user) }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`
    }
  });
}

async function logout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
}

async function authenticate(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await env.DB.prepare(
    "SELECT u.id, u.full_name, u.username, u.role, u.site_id, u.is_active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1 LIMIT 1"
  ).bind(tokenHash, new Date().toISOString()).first();
  return user ? { user } : null;
}

async function dashboard(env, user) {
  const today = new Date().toISOString().slice(0, 10);
  const supervisor = user.role === "supervisor" && user.site_id;
  const employeeRow = supervisor
    ? await env.DB.prepare("SELECT COUNT(*) AS count FROM employees WHERE status='active' AND site_id=?").bind(user.site_id).first()
    : await env.DB.prepare("SELECT COUNT(*) AS count FROM employees WHERE status='active'").first();
  const siteRow = supervisor
    ? { count: 1 }
    : await env.DB.prepare("SELECT COUNT(*) AS count FROM sites WHERE is_active=1").first();
  const presentRow = supervisor
    ? await env.DB.prepare("SELECT COUNT(*) AS count FROM attendance WHERE work_date=? AND status='present' AND site_id=?").bind(today, user.site_id).first()
    : await env.DB.prepare("SELECT COUNT(*) AS count FROM attendance WHERE work_date=? AND status='present'").bind(today).first();
  const absentRow = supervisor
    ? await env.DB.prepare("SELECT COUNT(*) AS count FROM attendance WHERE work_date=? AND status='absent' AND site_id=?").bind(today, user.site_id).first()
    : await env.DB.prepare("SELECT COUNT(*) AS count FROM attendance WHERE work_date=? AND status='absent'").bind(today).first();

  let salaryPending = 0;
  if (user.role !== "supervisor") {
    const salaryRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM salary_records WHERE payment_status='pending'").first();
    salaryPending = Number(salaryRow?.count || 0);
  }

  return apiOk({
    user: publicUser(user),
    stats: {
      employees: Number(employeeRow?.count || 0),
      sites: Number(siteRow?.count || 0),
      presentToday: Number(presentRow?.count || 0),
      absentToday: Number(absentRow?.count || 0),
      salaryPending
    },
    modules: modulesForRole(user.role)
  });
}

function modulesForRole(role) {
  const all = [
    { key: "employees", label: "Employees", icon: "EMP" },
    { key: "sites", label: "Sites", icon: "SITE" },
    { key: "attendance", label: "Daily Attendance", icon: "ATT" },
    { key: "photos", label: "Daily Photos", icon: "PHOTO" },
    { key: "salary", label: "Salary", icon: "PAY" },
    { key: "reports", label: "Reports", icon: "REP" },
    { key: "users", label: "Users & Roles", icon: "USER" },
    { key: "settings", label: "Settings", icon: "SET" }
  ];
  const allowed = {
    admin: all.map((x) => x.key),
    hr: ["employees", "sites", "attendance", "salary", "reports"],
    supervisor: ["attendance", "photos"]
  };
  return all.filter((item) => (allowed[role] || []).includes(item.key));
}

async function handleContactForm(request, env) {
  if (request.method !== "POST") return jsonResponse({ result: "error", error: "Method not allowed." }, 405);

  let body;
  try {
    const contentType = request.headers.get("content-type") || "";
    body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return jsonResponse({ result: "error", error: "Invalid form data." }, 400);
  }

  const name = clean(body.name, 100);
  const phone = clean(body.phone, 20);
  const email = clean(body.email, 254);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 3000);
  const website = clean(body.website, 200);

  if (website) return jsonResponse({ result: "success" });
  if (!name || !phone || !email || !subject || !message) return jsonResponse({ result: "error", error: "Please fill in all required fields." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ result: "error", error: "Please enter a valid email address." }, 400);
  if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) return jsonResponse({ result: "error", error: "Please enter a valid phone number." }, 400);
  if (!env.RESEND_API_KEY) return jsonResponse({ result: "error", error: "Email service is not configured." }, 500);

  const recipient = env.EMAIL_TO || "shreegajanandindia751@gmail.com";
  const from = env.RESEND_FROM || "Shree Gajanand India Website <onboarding@resend.dev>";
  const emailText = [
    "New enquiry from Shree Gajanand India website",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message
  ].join("\n");

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], reply_to: email, subject: `Website Enquiry: ${safeHeader(subject)}`, text: emailText })
    });
    if (!resendResponse.ok) return jsonResponse({ result: "error", error: "Unable to send enquiry right now." }, 502);
    return jsonResponse({ result: "success" });
  } catch {
    return jsonResponse({ result: "error", error: "Unable to send enquiry right now." }, 500);
  }
}

async function hashPassword(password, saltBase64) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(saltBase64), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

function randomBase64(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function publicUser(user) {
  return {
    id: Number(user.id),
    fullName: user.full_name,
    username: user.username,
    role: user.role,
    siteId: user.site_id ? Number(user.site_id) : null
  };
}

function clean(value, maxLength) {
  return String(value || "").trim().replace(/\0/g, "").slice(0, maxLength);
}

function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 160);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function apiOk(data, status = 200) {
  return jsonResponse({ ok: true, ...data }, status);
}

function apiError(error, status = 400) {
  return jsonResponse({ ok: false, error }, status);
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

}

