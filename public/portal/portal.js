const path=location.pathname;
if(path.endsWith("/employees")||path.endsWith("/employees.html"))initEmployees();
if(path.endsWith("/login")||path.endsWith("/login.html"))initLogin();
if(path.endsWith("/setup")||path.endsWith("/setup.html"))initSetup();
if(path.endsWith("/dashboard")||path.endsWith("/dashboard.html"))initDashboard();
if(path.endsWith("/sites")||path.endsWith("/sites.html"))initSites();

async function initLogin(){
  const status=await api("/portal/api/setup-status",{method:"GET"},false);
  if(status?.ok&&status.setupRequired){location.replace("/portal/setup.html");return}
  const me=await api("/portal/api/me",{method:"GET"},false);
  if(me?.ok){location.replace("/portal/dashboard.html");return}
  const form=document.getElementById("loginForm"),button=document.getElementById("loginButton"),message=document.getElementById("message");
  form.addEventListener("submit",async e=>{
    e.preventDefault();setMessage(message,"");button.disabled=true;button.textContent="Signing In...";
    const result=await api("/portal/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:form.username.value,password:form.password.value})},false);
    button.disabled=false;button.textContent="Sign In";
    if(!result?.ok){setMessage(message,result?.error||"Unable to sign in.","error");return}
    location.replace("/portal/dashboard.html");
  });
}

async function initSetup(){
  const status=await api("/portal/api/setup-status",{method:"GET"},false);
  if(status?.ok&&!status.setupRequired){location.replace("/portal/login.html");return}
  const form=document.getElementById("setupForm"),button=document.getElementById("setupButton"),message=document.getElementById("message");
  form.addEventListener("submit",async e=>{
    e.preventDefault();setMessage(message,"");button.disabled=true;button.textContent="Creating...";
    const result=await api("/portal/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({setupKey:form.setupKey.value,fullName:form.fullName.value,username:form.username.value,password:form.password.value})},false);
    button.disabled=false;button.textContent="Create Admin Account";
    if(!result?.ok){setMessage(message,result?.error||"Unable to create admin.","error");return}
    setMessage(message,"Admin account created. Opening login...","success");
    setTimeout(()=>location.replace("/portal/login.html"),900);
  });
}

async function initDashboard(){
  const data=await api("/portal/api/dashboard",{method:"GET"},false);
  if(!data?.ok){location.replace("/portal/login.html");return}
  const user=data.user;
  document.getElementById("userName").textContent=user.fullName;
  document.getElementById("userRole").textContent=roleLabel(user.role);
  document.getElementById("welcomeTitle").textContent=`Welcome, ${firstName(user.fullName)}`;
  document.getElementById("welcomeText").textContent=dashboardMessage(user.role);
  renderStats(data.stats,user.role);renderModules(data.modules);renderSidebar(data.modules);
  document.getElementById("logoutButton").addEventListener("click",async()=>{await api("/portal/api/logout",{method:"POST"},false);location.replace("/portal/login.html")});
}

async function initSites(){
  const data=await api("/portal/api/dashboard",{method:"GET"},false);

  if(!data?.ok){
    location.replace("/portal/login.html");
    return;
  }

  const user=data.user;
  const isAdmin=user.role==="admin";

  document.getElementById("userName").textContent=user.fullName;
  document.getElementById("userRole").textContent=roleLabel(user.role);

  renderSidebar(data.modules);

  document.getElementById("logoutButton").addEventListener("click",async()=>{
    await api("/portal/api/logout",{method:"POST"},false);
    location.replace("/portal/login.html");
  });

  const form=document.getElementById("siteForm");
  const message=document.getElementById("siteMessage");
  const saveButton=document.getElementById("saveSiteButton");
  const cancelButton=document.getElementById("cancelEditButton");
  const managementCard=form.closest(".management-card");

  let sites=[];

  if(!isAdmin){
    managementCard.hidden=true;
  }

  async function loadSites(){
    const result=await api("/portal/api/sites",{method:"GET"},false);

    if(!result?.ok){
      document.getElementById("sitesTableBody").innerHTML=
        `<tr><td colspan="6" class="table-empty">Unable to load sites.</td></tr>`;
      return;
    }

    sites=result.sites||[];
    renderSitesTable();
  }

  function renderSitesTable(){
    const tbody=document.getElementById("sitesTableBody");

    if(!sites.length){
      tbody.innerHTML=
        `<tr><td colspan="6" class="table-empty">No sites added yet.</td></tr>`;
      return;
    }

    tbody.innerHTML=sites.map(site=>{
      const active=Number(site.is_active)===1;

      return `
        <tr>
          <td><strong>${escapeHtml(site.site_code)}</strong></td>
          <td>${escapeHtml(site.name)}</td>
          <td>${escapeHtml(site.location||"-")}</td>
          <td>
            <span class="status-badge ${active?"active":"inactive"}">
              ${active?"Active":"Inactive"}
            </span>
          </td>
          <td>${escapeHtml(formatPortalDate(site.created_at))}</td>
          <td>
            ${
              isAdmin
                ? `
                  <button class="table-action-btn edit-site-btn" type="button" data-id="${site.id}">
                    Edit
                  </button>
                  <button class="table-action-btn toggle-site-btn" type="button" data-id="${site.id}">
                    ${active?"Deactivate":"Activate"}
                  </button>
                `
                : "-"
            }
          </td>
        </tr>
      `;
    }).join("");

    if(isAdmin){
      document.querySelectorAll(".edit-site-btn").forEach(button=>{
        button.addEventListener("click",()=>startEdit(Number(button.dataset.id)));
      });

      document.querySelectorAll(".toggle-site-btn").forEach(button=>{
        button.addEventListener("click",()=>toggleSite(Number(button.dataset.id)));
      });
    }
  }

  function startEdit(id){
    const site=sites.find(item=>Number(item.id)===id);
    if(!site)return;

    form.siteId.value=site.id;
    form.siteCode.value=site.site_code;
    form.siteName.value=site.name;
    form.siteLocation.value=site.location||"";

    saveButton.textContent="Update Site";
    cancelButton.hidden=false;
    setMessage(message,"");

    window.scrollTo({top:0,behavior:"smooth"});
  }

  function resetForm(){
    form.reset();
    form.siteId.value="";
    saveButton.textContent="Add Site";
    cancelButton.hidden=true;
    setMessage(message,"");
  }

  async function toggleSite(id){
    const site=sites.find(item=>Number(item.id)===id);
    if(!site)return;

    const result=await api("/portal/api/sites",{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        id:site.id,
        siteCode:site.site_code,
        name:site.name,
        location:site.location||"",
        isActive:Number(site.is_active)===1?0:1
      })
    },false);

    if(!result?.ok){
      alert(result?.error||"Unable to update site.");
      return;
    }

    await loadSites();
  }
  

  if(isAdmin){
    cancelButton.addEventListener("click",resetForm);

    form.addEventListener("submit",async event=>{
      event.preventDefault();

      setMessage(message,"");

      const editingId=Number(form.siteId.value)||0;
      const existingSite=sites.find(item=>Number(item.id)===editingId);

      saveButton.disabled=true;
      saveButton.textContent=editingId?"Updating...":"Adding...";

      const result=await api("/portal/api/sites",{
        method:editingId?"PUT":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          id:editingId||undefined,
          siteCode:form.siteCode.value,
          name:form.siteName.value,
          location:form.siteLocation.value,
          isActive:existingSite?Number(existingSite.is_active):1
        })
      },false);

      saveButton.disabled=false;

      if(!result?.ok){
        saveButton.textContent=editingId?"Update Site":"Add Site";
        setMessage(message,result?.error||"Unable to save site.","error");
        return;
      }

      resetForm();
      setMessage(message,result.message||"Site saved successfully.","success");
      await loadSites();
    });
  }

  await loadSites();
}
async function initEmployees(){
  const data=await api("/portal/api/dashboard",{method:"GET"},false);

  if(!data?.ok){
    location.replace("/portal/login.html");
    return;
  }

  const user=data.user;

  if(user.role!=="admin" && user.role!=="hr"){
    location.replace("/portal/dashboard.html");
    return;
  }

  document.getElementById("userName").textContent=user.fullName;
  document.getElementById("userRole").textContent=roleLabel(user.role);

  renderSidebar(data.modules);

  document.getElementById("logoutButton").addEventListener("click",async()=>{
    await api("/portal/api/logout",{method:"POST"},false);
    location.replace("/portal/login.html");
  });

  const form=document.getElementById("employeeForm");
  const message=document.getElementById("employeeMessage");
  const saveButton=document.getElementById("saveEmployeeButton");
  const cancelButton=document.getElementById("cancelEmployeeEditButton");
  const statusGroup=document.getElementById("statusGroup");
  const formTitle=document.getElementById("employeeFormTitle");
  const siteSelect=document.getElementById("siteId");

  let employees=[];
  let sites=[];

  async function loadSites(){
    const result=await api("/portal/api/sites",{method:"GET"},false);

    if(!result?.ok){
      return;
    }

    sites=result.sites||[];

    siteSelect.innerHTML=
      `<option value="">No Site Assigned</option>`+
      sites.map(site=>`
        <option value="${site.id}">
          ${escapeHtml(site.site_code)} - ${escapeHtml(site.name)}
          ${Number(site.is_active)===1?"":" (Inactive)"}
        </option>
      `).join("");
  }

  async function loadEmployees(){
    const result=await api("/portal/api/employees",{method:"GET"},false);

    if(!result?.ok){
      document.getElementById("employeesTableBody").innerHTML=
        `<tr><td colspan="8" class="table-empty">Unable to load employees.</td></tr>`;
      return;
    }

    employees=result.employees||[];
    renderEmployees();
  }

  function renderEmployees(){
    const tbody=document.getElementById("employeesTableBody");

    if(!employees.length){
      tbody.innerHTML=
        `<tr><td colspan="8" class="table-empty">No employees added yet.</td></tr>`;
      return;
    }

    tbody.innerHTML=employees.map(employee=>{
      const status=String(employee.status||"active");

      return `
        <tr>
          <td><strong>${escapeHtml(employee.employee_code)}</strong></td>

          <td>${escapeHtml(employee.full_name)}</td>

          <td>${escapeHtml(employee.designation||"-")}</td>

          <td>
            ${
              employee.site_name
                ? escapeHtml(employee.site_name)
                : "-"
            }
          </td>

          <td>${escapeHtml(employee.mobile||"-")}</td>

          <td>₹${Number(employee.monthly_salary||0).toLocaleString("en-IN")}</td>

          <td>
            <span class="status-badge ${status==="active"?"active":"inactive"}">
              ${escapeHtml(employeeStatusLabel(status))}
            </span>
          </td>

          <td>
            <button
              class="table-action-btn edit-employee-btn"
              type="button"
              data-id="${employee.id}"
            >
              Edit
            </button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".edit-employee-btn").forEach(button=>{
      button.addEventListener("click",()=>{
        startEmployeeEdit(Number(button.dataset.id));
      });
    });
  }

  async function startEmployeeEdit(id){
    setMessage(message,"");

    const result=await api(`/portal/api/employees/${id}`,{
      method:"GET"
    },false);

    if(!result?.ok){
      setMessage(
        message,
        result?.error||"Unable to load employee details.",
        "error"
      );
      return;
    }

    const employee=result.employee;

    form.employeeId.value=employee.id;
    form.fullName.value=employee.full_name||"";
    form.fatherName.value=employee.father_name||"";
    form.dateOfBirth.value=employee.date_of_birth||"";
    form.mobile.value=employee.mobile||"";
    form.address.value=employee.address||"";
    form.aadhaarLast4.value=employee.aadhaar_last4||"";
    form.pan.value=employee.pan||"";
    form.bankAccount.value=employee.bank_account||"";
    form.ifsc.value=employee.ifsc||"";
    form.uan.value=employee.uan||"";
    form.esic.value=employee.esic||"";
    form.joiningDate.value=employee.joining_date||"";
    form.designation.value=employee.designation||"";
    form.siteId.value=employee.site_id||"";
    form.shift.value=employee.shift||"";
    form.monthlySalary.value=Number(employee.monthly_salary||0);
    form.status.value=employee.status||"active";

    statusGroup.hidden=false;
    cancelButton.hidden=false;

    formTitle.textContent=`Edit Employee - ${employee.employee_code}`;
    saveButton.textContent="Update Employee";

    window.scrollTo({
      top:0,
      behavior:"smooth"
    });
  }

  function resetEmployeeForm(){
    form.reset();
    form.employeeId.value="";
    form.monthlySalary.value="0";
    form.status.value="active";

    statusGroup.hidden=true;
    cancelButton.hidden=true;

    formTitle.textContent="Add New Employee";
    saveButton.textContent="Add Employee";

    setMessage(message,"");
  }

  cancelButton.addEventListener("click",resetEmployeeForm);

  form.addEventListener("submit",async event=>{
    event.preventDefault();

    setMessage(message,"");

    const editingId=Number(form.employeeId.value)||0;

    saveButton.disabled=true;
    saveButton.textContent=editingId?"Updating...":"Adding...";

    const payload={
      id:editingId||undefined,
      fullName:form.fullName.value,
      fatherName:form.fatherName.value,
      dateOfBirth:form.dateOfBirth.value,
      mobile:form.mobile.value,
      address:form.address.value,
      aadhaarLast4:form.aadhaarLast4.value,
      pan:form.pan.value,
      bankAccount:form.bankAccount.value,
      ifsc:form.ifsc.value,
      uan:form.uan.value,
      esic:form.esic.value,
      joiningDate:form.joiningDate.value,
      designation:form.designation.value,
      siteId:form.siteId.value||null,
      shift:form.shift.value,
      monthlySalary:form.monthlySalary.value,
      status:editingId?form.status.value:"active"
    };

    const result=await api("/portal/api/employees",{
      method:editingId?"PUT":"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload)
    },false);

    saveButton.disabled=false;

    if(!result?.ok){
      saveButton.textContent=editingId?"Update Employee":"Add Employee";

      setMessage(
        message,
        result?.error||"Unable to save employee.",
        "error"
      );

      return;
    }

    const successMessage=editingId
      ? result.message
      : `${result.message} Employee Code: ${result.employeeCode}`;

    resetEmployeeForm();

    setMessage(
      message,
      successMessage||"Employee saved successfully.",
      "success"
    );

    await loadEmployees();
  });

  await loadSites();
  await loadEmployees();
}

function employeeStatusLabel(status){
  if(status==="suspended")return "Suspended";
  if(status==="left")return "Left Company";
  return "Active";
}

function formatPortalDate(value){
  if(!value)return "-";

  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "-";

  return date.toLocaleDateString("en-IN",{
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
}

function renderStats(stats,role){
  const cards=[["Active Employees",stats.employees],["Active Sites",stats.sites],["Present Today",stats.presentToday],["Absent Today",stats.absentToday]];
  if(role!=="supervisor")cards.push(["Salary Pending",stats.salaryPending]);
  document.getElementById("statsGrid").innerHTML=cards.map(([label,value])=>`<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value||0)}</strong></article>`).join("");
}

function renderModules(modules){
  document.getElementById("moduleGrid").innerHTML=modules.map(m=>`<button class="module-card" type="button" data-module="${escapeHtml(m.key)}"><span class="module-icon">${escapeHtml(m.icon)}</span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(moduleDescription(m.key))}</small></button>`).join("");
  document.querySelectorAll(".module-card").forEach(b=>{
  b.addEventListener("click",()=>{
    if(b.dataset.module==="sites"){
      location.href="/portal/sites.html";
      return;
    }

    if(b.dataset.module==="employees"){
  location.href="/portal/employees.html";
  return;
}

    alert(`${b.dataset.module} module will be connected in the next phase.`);
  });
});
}

function renderSidebar(modules){
  const items=[{key:"dashboard",label:"Dashboard",icon:"HOME"},...modules];

  document.getElementById("sideNav").innerHTML=items.map(i=>`
    <button
      class="nav-item ${
        (i.key==="dashboard" && path.includes("/dashboard")) ||
        (i.key==="sites" && path.includes("/sites")) ||
        (i.key==="employees" && path.includes("/employees"))
          ? "active"
          : ""
      }"
      type="button"
      data-nav="${escapeHtml(i.key)}"
    >
      <span class="nav-badge">${escapeHtml(i.icon)}</span>
      <span>${escapeHtml(i.label)}</span>
    </button>
  `).join("");

  document.querySelectorAll("[data-nav]").forEach(button=>{
    button.addEventListener("click",()=>{
      const key=button.dataset.nav;

      if(key==="dashboard"){
        location.href="/portal/dashboard.html";
        return;
      }

      if(key==="sites"){
        location.href="/portal/sites.html";
        return;
      }

      if(key==="employees"){
        location.href="/portal/employees.html";
        return;
      }

      alert(`${key} module will be connected in the next phase.`);
    });
  });
}

function moduleDescription(key){
  return {employees:"Employee profiles, codes and company records.",sites:"Project and work-site master records.",attendance:"Daily employee attendance and shift status.",photos:"Date-wise work photos from assigned sites.",salary:"Monthly salary, deductions and payment status.",reports:"Attendance, salary and site-wise reports.",users:"Admin, HR/Office and Supervisor access.",settings:"Portal and company-level settings."}[key]||"Company portal module.";
}
function dashboardMessage(role){if(role==="admin")return"Full company access is enabled for your Admin account.";if(role==="hr")return"Employee, salary and reporting access is enabled for HR/Office.";return"Attendance and daily photo access is enabled for your assigned site."}
function roleLabel(role){if(role==="hr")return"HR / Office";if(role==="supervisor")return"Supervisor";return"Admin"}
function firstName(value){return String(value||"").trim().split(/\s+/)[0]||"User"}
async function api(url,options,throwOnNetwork=true){try{const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});return await r.json()}catch(e){if(throwOnNetwork)throw e;return null}}
function setMessage(el,text,type=""){el.textContent=text;el.className=`form-message ${type}`.trim()}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
